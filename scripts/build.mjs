// ສ້າງ public/ ສຳລັບ Vercel ຈາກ apps-script/Index.html (ໄຟລ໌ດຽວກັນກັບທີ່ໃຊ້ໃນ Apps Script)
import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';

// URL ຂອງ Apps Script Web App (ປ່ຽນໄດ້ດ້ວຍ Environment Variable GAS_WEB_APP_URL ໃນ Vercel)
const DEFAULT_GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxi1ckv0Jj1A1irTzXBjXrfxSO4VRHHkpM3to2ZR29cLY8X2vc7AUg_gTMjBJQz1grH2g/exec';
const url = (process.env.GAS_WEB_APP_URL || DEFAULT_GAS_WEB_APP_URL).trim();
if (!url) console.warn('⚠️  GAS_WEB_APP_URL ບໍ່ໄດ້ຕັ້ງ — ໜ້າເວັບຈະເປີດໄດ້ ແຕ່ເອີ້ນເຊີບເວີບໍ່ໄດ້');

mkdirSync('public', { recursive: true });
const html = readFileSync('apps-script/Index.html', 'utf8');
const inject = '\n  <script src="config.js"></script>\n  <script src="gas-bridge.js"></script>';
if (!/<head>/i.test(html)) throw new Error('Index.html ບໍ່ມີ <head>');
writeFileSync('public/index.html', html.replace(/<head>/i, (m) => m + inject));
writeFileSync('public/config.js', 'window.SMART_CONFIG = ' + JSON.stringify({ GAS_WEB_APP_URL: url }) + ';\n');
copyFileSync('web/gas-bridge.js', 'public/gas-bridge.js');
console.log('✅ Built public/ (GAS_WEB_APP_URL ' + (url ? 'set' : 'MISSING') + ')');
