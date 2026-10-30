const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { once } = require('node:events');
const { performance } = require('node:perf_hooks');
const { SQLiteConnection } = require('./support/sqlite.cjs');
const Module = require('node:module');
const resolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  const mapped = request.startsWith('@/') ? path.join(__dirname, '../src', request.slice(2)) : request;
  return resolveFilename.call(this, mapped, ...rest);
};
const { LocalDatabase } = require('../src/common/lib/database/localDatabase.ts');
const { migrateDatabase } = require('../src/common/lib/database/migrations/index.ts');
const { initialSchema } = require('../src/common/lib/database/migrations/001_initial.ts');
const { WeatherRepository } = require('../src/common/lib/database/repositories/weatherRepository.ts');
const { weatherSnapshotSchema } = require('../src/features/weather/types/weather.types.ts');
const { weatherArea, weatherPolicy, weatherFreshness, nextWeatherHours } = require('../src/features/weather/utils/weatherPolicy.ts');
const { toWeatherRiskInputs } = require('../src/features/weather/utils/weatherRiskInputs.ts');
const { createWeatherApi } = require('../src/features/weather/api/weatherApi.ts');

const start = Date.parse('2026-10-30T10:16:00Z');
const area = weatherArea(36.75, 3.06);
const providerModule = () => import('../server/weather/openMeteo.mjs');
const serviceModule = () => import('../server/weather/weatherService.mjs');

function rawWeather(now = start) {
  const currentTime = Math.floor(now / 900_000) * 900;
  const hours = Array.from({ length: 9 }, (_, index) => Math.floor(now / 3_600_000) * 3600 + index * 3600);
  const point = {
    temperature_2m: 1.5, relative_humidity_2m: 92, precipitation: 0.4,
    visibility: 4500, wind_speed_10m: 5.2, wind_gusts_10m: 8.1,
    wind_direction_10m: 270, weather_code: 61,
  };
  const day = Math.floor(now / 86_400_000) * 86400;
  return {
    timezone: 'Etc/UTC', current: { time: currentTime, interval: 900, ...point },
    hourly: { time: hours, ...Object.fromEntries(Object.entries(point).map(([key, value]) => [key, hours.map(() => value)])) },
    daily: { time: [day, day + 86400], sunrise: [day + 21600, day + 108000], sunset: [day + 64800, day + 151200] },
  };
}

async function snapshot(now = start, target = area) {
  const { normalizeWeather } = await providerModule();
  return normalizeWeather(rawWeather(now), target, now);
}

test('area cells coalesce GPS jitter, round-trip their centres, and handle poles/dateline', () => {
  assert.equal(weatherArea(36.751, 3.061).id, weatherArea(36.752, 3.062).id);
  assert.notEqual(weatherArea(36.751, 3.061).id, weatherArea(36.851, 3.061).id);
  for (const [lat, lon] of [[90, 180], [-90, -180], [0, 0], [36.75, 3.06]]) {
    const cell = weatherArea(lat, lon);
    assert.equal(weatherArea(cell.latitude, cell.longitude).id, cell.id);
  }
  assert.equal(weatherArea(0, 180).id, weatherArea(0, -180).id);
  assert.throws(() => weatherArea(NaN, 0));
  assert.throws(() => weatherArea(91, 0));
});

test('normalization preserves precipitation intervals, SI units, six future hours and astronomy', async () => {
  const value = await snapshot();
  assert.equal(value.current.precipitationIntervalSeconds, 900);
  assert.equal(value.hourly.length, 6);
  assert.ok(value.hourly.every((hour) => hour.precipitationIntervalSeconds === 3600 && Date.parse(hour.validAt) > start));
  assert.equal(value.current.visibilityM, 4500);
  assert.equal(value.current.windSpeedMs, 5.2);
  assert.equal(value.current.condition, 'rain');
  assert.equal(value.sun.sunriseAt, '2026-10-30T06:00:00.000Z');
  assert.equal(value.freshUntil, '2026-10-30T10:30:00.000Z');
});

test('missing readings, unknown codes and polar sunrise/sunset stay unknown', async () => {
  const { normalizeWeather } = await providerModule();
  const raw = rawWeather();
  raw.current.weather_code = 12345;
  raw.current.wind_gusts_10m = null;
  raw.current.visibility = -1;
  raw.daily.sunrise[0] = null;
  raw.daily.sunset[0] = null;
  const value = normalizeWeather(raw, area, start);
  assert.equal(value.current.condition, 'unknown');
  assert.equal(value.current.windGustMs, null);
  assert.equal(value.current.visibilityM, null);
  assert.equal(value.sun.sunriseAt, null);
  assert.equal(toWeatherRiskInputs(value, true, start).isDay, null);
});

test('midnight selects the current local day and forecasts continue into tomorrow', async () => {
  const value = await snapshot(Date.parse('2026-10-30T23:55:00Z'));
  assert.equal(value.hourly[0].validAt, '2026-10-31T00:00:00.000Z');
  assert.equal(value.hourly.length, 6);
  const nextDay = await snapshot(Date.parse('2026-10-31T00:05:00Z'));
  assert.equal(nextDay.sun.sunriseAt, '2026-10-31T06:00:00.000Z');
});

test('bad provider arrays, invalid timezone, future times and invalid normalized units are rejected', async () => {
  const { normalizeWeather } = await providerModule();
  const raw = rawWeather();
  raw.hourly.visibility.pop();
  assert.throws(() => normalizeWeather(raw, area, start));
  const badTimezone = await snapshot(); badTimezone.sun.timezone = 'invalid/timezone';
  assert.equal(weatherSnapshotSchema.safeParse(badTimezone).success, false);
  const future = rawWeather(); future.current.time += 3600;
  assert.throws(() => normalizeWeather(future, area, start));
  const badUnits = await snapshot(); badUnits.current.precipitationIntervalSeconds = 0;
  assert.equal(weatherSnapshotSchema.safeParse(badUnits).success, false);
});

test('risk inputs preserve a window-average rain rate and never treat missing/stale/other-area data as safe', async () => {
  const value = await snapshot();
  const inputs = toWeatherRiskInputs(value, true, start);
  assert.equal(inputs.available, true);
  assert.equal(inputs.precipitationMmPerHour, 1.6);
  assert.equal(inputs.icingRisk, 'possible');
  assert.equal(inputs.isDay, true);
  for (const [matching, now] of [[false, start], [true, start + weatherPolicy.refreshMs], [true, start + 86_400_000]]) {
    const unknown = toWeatherRiskInputs(value, matching, now);
    assert.equal(unknown.available, false);
    assert.equal(unknown.icingRisk, 'unknown');
    assert.equal(unknown.visibilityM, null);
  }
  value.current.temperatureC = 20;
  assert.equal(toWeatherRiskInputs(value, true, start).icingRisk, 'unknown');
});

test('retrieving an old model cannot make it fresh; expired forecast hours are filtered', async () => {
  const { normalizeWeather } = await providerModule();
  const old = normalizeWeather(rawWeather(start - 7_200_000), area, start);
  assert.equal(weatherFreshness(old, start), 'expired');
  assert.equal(toWeatherRiskInputs(old, true, start).available, false);
  assert.ok(nextWeatherHours(old, start).every((hour) => Date.parse(hour.validAt) > start));
});

test('provider uses fixed HTTPS hosts, cell centres, UTC epochs, SI units and server-only credentials', async () => {
  const { createOpenMeteoProvider } = await providerModule();
  for (const apiKey of ['', 'private-test-key']) {
    let captured;
    const fetchImpl = async (url, options) => {
      captured = { url, options };
      return { ok: true, text: async () => JSON.stringify(rawWeather()) };
    };
    const result = await createOpenMeteoProvider({ apiKey, fetchImpl, now: () => start })(area);
    assert.equal(captured.url.host, apiKey ? 'customer-api.open-meteo.com' : 'api.open-meteo.com');
    assert.equal(captured.url.searchParams.get('wind_speed_unit'), 'ms');
    assert.equal(captured.url.searchParams.get('timeformat'), 'unixtime');
    assert.equal(captured.url.searchParams.get('latitude'), String(area.latitude));
    assert.equal(captured.options.redirect, 'error');
    assert.equal(JSON.stringify(result).includes('private-test-key'), false);
  }
});

test('provider errors omit secret URLs and reject oversized/invalid payloads', async () => {
  const { createOpenMeteoProvider } = await providerModule();
  const provider = createOpenMeteoProvider({ apiKey: 'private', fetchImpl: async () => ({ ok: false }) });
  await assert.rejects(provider(area), (error) => !error.message.includes('private'));
  const oversized = createOpenMeteoProvider({ fetchImpl: async () => ({ ok: true, text: async () => 'x'.repeat(256001) }) });
  await assert.rejects(oversized(area), /too large/);
});

test('mobile transport uses the backend, bypasses account mock data, forwards cancellation and validates its area', async () => {
  let captured;
  let response = await snapshot();
  const client = { get: async (url, options) => { captured = { url, options }; return { data: response }; } };
  const getWeather = createWeatherApi(client, () => 'https://osy.test/');
  const signal = new AbortController().signal;
  assert.deepEqual(await getWeather(area, signal), response);
  assert.equal(captured.url, 'https://osy.test/weather');
  assert.equal(captured.options.adapter, 'fetch');
  assert.equal(captured.options.signal, signal);
  assert.deepEqual(captured.options.params, { latitude: area.latitude, longitude: area.longitude });
  response = await snapshot(start, weatherArea(0, 0));
  await assert.rejects(getWeather(area), (error) => error.kind === 'invalid_response');
  response = { unexpected: true };
  await assert.rejects(getWeather(area), (error) => error.kind === 'invalid_response');
  await assert.rejects(createWeatherApi(client, () => '')(area), /not configured/);
});

test('backend coalesces simultaneous requests and shares one snapshot within an area/time bucket', async () => {
  const { createWeatherService } = await serviceModule();
  let calls = 0;
  const service = createWeatherService({ now: () => start, provider: async (cell) => { calls++; return snapshot(start, cell); } });
  const values = await Promise.all(Array.from({ length: 20 }, () => service.get(36.751, 3.061)));
  assert.equal(calls, 1);
  assert.ok(values.every((value) => value.area.id === area.id));
  await service.get(36.752, 3.062);
  assert.equal(calls, 1);
});

test('backend refreshes a new bucket and preserves original timestamps when falling back during failure', async () => {
  const { createWeatherService } = await serviceModule();
  let time = start; let fail = false; let calls = 0;
  const service = createWeatherService({ now: () => time, provider: async (cell) => {
    calls++; if (fail) throw new Error('private upstream URL'); return snapshot(time, cell);
  } });
  const first = await service.get(36.75, 3.06);
  time += weatherPolicy.refreshMs;
  const fresh = await service.get(36.75, 3.06);
  assert.notEqual(fresh.fetchedAt, first.fetchedAt);
  time += weatherPolicy.refreshMs; fail = true;
  const stale = await service.get(36.75, 3.06);
  assert.equal(stale.fetchedAt, fresh.fetchedAt);
  assert.equal(weatherFreshness(stale, time), 'stale');
  await service.get(36.75, 3.06);
  assert.equal(calls, 3, 'backoff prevents repeated upstream failures');
  await assert.rejects(service.get(0, 0), (error) => !error.message.includes('private'));
});

test('backend bounds cache size and enforces its upstream daily budget', async () => {
  const { createWeatherService } = await serviceModule();
  let calls = 0;
  const service = createWeatherService({ now: () => start, dailyBudget: 2, maxEntries: 1,
    provider: async (cell) => { calls++; return snapshot(start, cell); } });
  await service.get(0, 0);
  await service.get(1, 1);
  await assert.rejects(service.get(0, 0));
  assert.equal(calls, 2);
  assert.ok(await service.get(1, 1), 'cached area remains available at the quota limit');
});

test('SQLite migrates without losing existing data and cache reads remain below the two-second budget', async (t) => {
  const connection = new SQLiteConnection(); t.after(() => connection.close());
  await connection.execAsync(initialSchema);
  await connection.execAsync('PRAGMA user_version = 1');
  await connection.runAsync('INSERT INTO todos (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)',
    'existing-task', 'Keep existing data', new Date(start).toISOString(), new Date(start).toISOString());
  await migrateDatabase(connection);
  assert.equal((await connection.getFirstAsync('SELECT title FROM todos WHERE id = ?', 'existing-task')).title, 'Keep existing data');
  const db = new LocalDatabase(async () => connection);
  const repository = new WeatherRepository(db, () => start);
  const value = await snapshot();
  await repository.save(value);
  const before = performance.now();
  assert.deepEqual(await repository.read(area.id), value);
  assert.ok(performance.now() - before < 2000);
  await migrateDatabase(connection);
  assert.deepEqual(await repository.read(), value);
  assert.equal(await repository.read('grid-v1:1:1'), null);
  assert.equal((await connection.getFirstAsync('SELECT COUNT(*) AS n FROM sync_queue')).n, 0);
});

test('file-backed snapshots survive reopening offline; late requests cannot overwrite newer data', async (t) => {
  const directory = fs.mkdtempSync(path.join(process.cwd(), '.expo', 'weather-test-'));
  const filename = path.join(directory, 'weather.db');
  const connection = new SQLiteConnection(filename);
  await migrateDatabase(connection);
  const repository = new WeatherRepository(new LocalDatabase(async () => connection), () => start);
  const newer = await snapshot(start + 60_000);
  await repository.save(newer);
  await repository.save(await snapshot());
  connection.close();
  const reopened = new SQLiteConnection(filename);
  t.after(() => { reopened.close(); fs.unlinkSync(filename); fs.rmdirSync(directory); });
  const offline = new WeatherRepository(new LocalDatabase(async () => reopened), () => start + 86_400_000);
  assert.deepEqual(await offline.read(area.id), newer);
  assert.equal(weatherFreshness(await offline.read(area.id), start + 86_400_000), 'expired');
});

test('a newly fetched older model cannot replace the last newer model in SQLite', async (t) => {
  const connection = new SQLiteConnection(); t.after(() => connection.close());
  await migrateDatabase(connection);
  const repository = new WeatherRepository(new LocalDatabase(async () => connection), () => start);
  const newer = await snapshot(start + weatherPolicy.refreshMs);
  await repository.save(newer);
  const old = await snapshot();
  old.fetchedAt = new Date(start + 2 * weatherPolicy.refreshMs).toISOString();
  old.freshUntil = old.fetchedAt;
  await repository.save(old);
  assert.deepEqual(await repository.read(area.id), newer);
});

test('SQLite prunes old/overflow areas and tolerates a corrupt payload', async (t) => {
  const connection = new SQLiteConnection(); t.after(() => connection.close());
  await migrateDatabase(connection);
  let time = start;
  const repository = new WeatherRepository(new LocalDatabase(async () => connection), () => time);
  for (let i = 0; i < weatherPolicy.maxAreas + 3; i++) {
    time++;
    await repository.save(await snapshot(time, weatherArea(i, i)));
  }
  assert.equal((await connection.getFirstAsync('SELECT COUNT(*) AS n FROM weather_cache')).n, weatherPolicy.maxAreas);
  await connection.runAsync('UPDATE weather_cache SET payload = ?', '{invalid');
  assert.equal(await repository.read(), null);
  time += weatherPolicy.retentionMs + 1;
  await repository.save(await snapshot(time));
  assert.equal((await connection.getFirstAsync('SELECT COUNT(*) AS n FROM weather_cache')).n, 1);
});

test('HTTP service validates coordinates, limits clients, applies CORS and never returns raw errors', async (t) => {
  const { createWeatherServer } = await import('../server/weather/http.mjs');
  const server = createWeatherServer({ allowedOrigins: ['https://app.test'], service: {
    get: async (lat, lon) => lat === 1 ? Promise.reject(new Error('secret-key')) : snapshot(start, weatherArea(lat, lon)),
  }, now: () => start });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); return new Promise((resolve) => server.close(resolve)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(`${base}/health`)).status, 200);
  for (const query of ['latitude=&longitude=0', 'latitude=NaN&longitude=0', 'latitude=91&longitude=0', 'latitude=0&longitude=0&latitude=2', 'latitude=0&longitude=0&url=https://bad.test']) {
    assert.equal((await fetch(`${base}/weather?${query}`)).status, 422);
  }
  const response = await fetch(`${base}/weather?latitude=0&longitude=0`, { headers: { Origin: 'https://app.test' } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://app.test');
  assert.equal((await fetch(`${base}/weather?latitude=0&longitude=0`, { headers: { Origin: 'https://bad.test' } })).status, 403);
  const failed = await fetch(`${base}/weather?latitude=1&longitude=0`);
  assert.equal(failed.status, 503);
  assert.equal((await failed.text()).includes('secret-key'), false);
  let limited;
  for (let i = 0; i < 121; i++) limited = await fetch(`${base}/weather?latitude=0&longitude=0`);
  assert.equal(limited.status, 429);
});
