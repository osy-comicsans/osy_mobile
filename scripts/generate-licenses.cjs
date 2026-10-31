const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const records = new Map();
const inspect = (directory) => {
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
    const id = `${manifest.name}@${manifest.version}`;
    if (records.has(id)) return;
    const notices = fs.readdirSync(directory).filter((file) => /^(licen[cs]e|copying|notice)(\.|$)/i.test(file))
      .filter((file) => fs.statSync(path.join(directory, file)).isFile())
      .map((file) => fs.readFileSync(path.join(directory, file), 'utf8'));
    const license = typeof manifest.license === 'string' ? manifest.license : 'See notice';
    records.set(id, { name: manifest.name, version: manifest.version, license, text: notices.join('\n\n') || license });
  } catch { /* Packages without metadata are links or platform-only entries. */ }
};
const store = path.join(root, 'node_modules/.pnpm');
for (const entry of fs.readdirSync(store, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const modules = path.join(store, entry.name, 'node_modules');
  if (!fs.existsSync(modules)) continue;
  for (const item of fs.readdirSync(modules, { withFileTypes: true })) {
    if (item.name.startsWith('@')) {
      for (const child of fs.readdirSync(path.join(modules, item.name))) inspect(path.join(modules, item.name, child));
    } else inspect(path.join(modules, item.name));
  }
}
for (const [name, file] of [['IBM Plex Sans Arabic', 'assets/fonts/IBMPlexSansArabic-OFL.txt'], ['Gabarito', 'assets/fonts/Gabarito-OFL.txt']]) {
  if (fs.existsSync(path.join(root, file))) records.set(name, { name, version: 'bundled', license: 'OFL-1.1', text: fs.readFileSync(path.join(root, file), 'utf8') });
}
for (const [name, file] of [['Crash model notices', 'assets/models/NOTICE.md'], ['OCR model notices', 'assets/ocr/NOTICE.md']]) {
  if (fs.existsSync(path.join(root, file))) records.set(name, { name, version: 'bundled', license: 'See notice', text: fs.readFileSync(path.join(root, file), 'utf8') });
}
fs.mkdirSync(path.join(root, 'assets/licenses'), { recursive: true });
const entries = [...records.values()].sort((a, b) => a.name.localeCompare(b.name));
fs.writeFileSync(path.join(root, 'assets/licenses/notices.json'), JSON.stringify(entries));
console.log(`Generated ${entries.length} license notices.`);
