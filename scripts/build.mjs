// ສ້າງ public/ ສຳລັບ Vercel ຈາກ apps-script/Index.html (ໄຟລ໌ດຽວກັນກັບທີ່ໃຊ້ໃນ Apps Script)
import { mkdirSync, readFileSync, writeFileSync, cpSync } from 'node:fs';

// URL ຂອງ Apps Script Web App (ປ່ຽນໄດ້ດ້ວຍ Environment Variable GAS_WEB_APP_URL ໃນ Vercel)
const DEFAULT_GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbye8C16iJBDpvC1btcZ1_z1hZbqbUIyVD1C5qCny1K4HI28SWivogZx10Rl0lCtV4oraA/exec';
const url = (process.env.GAS_WEB_APP_URL || DEFAULT_GAS_WEB_APP_URL).trim();
if (!url) console.warn('⚠️  GAS_WEB_APP_URL ບໍ່ໄດ້ຕັ້ງ — ໜ້າເວັບຈະເປີດໄດ້ ແຕ່ເອີ້ນເຊີບເວີບໍ່ໄດ້');

mkdirSync('public', { recursive: true });
const html = readFileSync('apps-script/Index.html', 'utf8');
const inject = '\n  <script src="/config.js"></script>\n  <script src="/gas-bridge.js"></script>' +
  '\n  <link rel="manifest" href="/manifest.webmanifest">' +
  '\n  <meta name="theme-color" content="#1a365d">' +
  '\n  <meta name="apple-mobile-web-app-capable" content="yes">' +
  '\n  <meta name="mobile-web-app-capable" content="yes">' +
  '\n  <meta name="apple-mobile-web-app-title" content="SMART Fuel">' +
  '\n  <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">' +
  '\n  <link rel="icon" type="image/png" href="/icons/favicon-32.png">' +
  '\n  <script src="/pwa.js" defer></script>';
if (!/<head>/i.test(html)) throw new Error('Index.html ບໍ່ມີ <head>');
writeFileSync('public/index.html', html.replace(/<head>/i, (m) => m + inject));
// ເລກສະບັບຂອງການ build — ແອັບທີ່ຕິດຕັ້ງແລ້ວ ກວດ version.json ເພື່ອອັບເດດຕົວເອງ
const sha = (process.env.GITHUB_SHA || process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7);
const version = (sha ? sha + '-' : '') + new Date().toISOString().replace(/[-:]/g, '').slice(0, 13);
writeFileSync('public/config.js', 'window.SMART_CONFIG = ' + JSON.stringify({ GAS_WEB_APP_URL: url, VERSION: version }) + ';\n');
writeFileSync('public/version.json', JSON.stringify({ version: version }) + '\n');
// gas-bridge.js, pwa.js, sw.js, manifest ແລະ icons
cpSync('web', 'public', { recursive: true });
console.log('✅ Built public/ v' + version + ' (GAS_WEB_APP_URL ' + (url ? 'set' : 'MISSING') + ')');
