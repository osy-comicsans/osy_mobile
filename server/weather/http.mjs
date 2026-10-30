import { createServer } from 'node:http';

export function createWeatherServer({ service, allowedOrigins = [], now = Date.now }) {
  const clients = new Map();
  return createServer(async (request, response) => {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    const send = (status, value) => { response.writeHead(status); response.end(JSON.stringify(value)); };
    const fail = (status, code) => send(status, { error: { code, message: 'Weather request could not be completed.' } });
    const origin = request.headers.origin;
    if (origin && !allowedOrigins.includes(origin)) { fail(403, 'origin_denied'); return; }
    if (origin) { response.setHeader('Access-Control-Allow-Origin', origin); response.setHeader('Vary', 'Origin'); }
    if (request.method === 'OPTIONS') {
      response.setHeader('Access-Control-Allow-Methods', 'GET');
      response.setHeader('Access-Control-Allow-Headers', 'Accept, Accept-Language, Authorization');
      response.writeHead(204); response.end(); return;
    }
    let url;
    try { url = new URL(request.url ?? '/', 'http://weather.local'); }
    catch { fail(400, 'invalid_request'); return; }
    if (url.pathname === '/health' && request.method === 'GET') { send(200, { status: 'ok' }); return; }
    if (url.pathname !== '/weather') { fail(404, 'not_found'); return; }
    if (request.method !== 'GET') { response.setHeader('Allow', 'GET'); fail(405, 'method_not_allowed'); return; }
    if ([...url.searchParams.keys()].some((key) => !['latitude', 'longitude'].includes(key))
      || ['latitude', 'longitude'].some((key) => url.searchParams.getAll(key).length !== 1 || !url.searchParams.get(key)?.trim())) {
      fail(422, 'invalid_coordinates'); return;
    }
    const latitude = Number(url.searchParams.get('latitude'));
    const longitude = Number(url.searchParams.get('longitude'));
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      fail(422, 'invalid_coordinates'); return;
    }
    // Do not trust X-Forwarded-For from arbitrary callers. Deployments behind
    // a gateway should enforce per-user/IP limits there as well.
    const ip = request.socket.remoteAddress ?? 'unknown';
    const minute = Math.floor(now() / 60_000);
    if (clients.size > 5000) for (const [key, value] of clients) if (value.minute !== minute) clients.delete(key);
    const client = clients.get(ip);
    const count = client?.minute === minute ? client.count + 1 : 1;
    if ((!client && clients.size >= 10_000) || count > 120) {
      response.setHeader('Retry-After', '60'); fail(429, 'rate_limited'); return;
    }
    clients.set(ip, { minute, count });
    try { send(200, await service.get(latitude, longitude)); }
    catch { response.setHeader('Retry-After', '60'); fail(503, 'weather_unavailable'); }
  });
}
