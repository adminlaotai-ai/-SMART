// ໃຊ້ໃນ GitHub Actions: ເອົາ apps-script/Code.gs ແລະ Index.html ໄປແທນໄຟລ໌ໃນໂປຣເຈັກ Apps Script ທີ່ pull ມາ
// (ຮັກສາໄຟລ໌ອື່ນ ແລະ appsscript.json ຂອງໂປຣເຈັກໄວ້ຄືເດີມ)
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
const repo = process.argv[3] || 'apps-script';
const files = readdirSync(dir);
const code = readFileSync(join(repo, 'Code.gs'), 'utf8');
const index = readFileSync(join(repo, 'Index.html'), 'utf8');

const scripts = files.filter(f => /\.(js|gs)$/.test(f));
const withDoGet = scripts.filter(f => /function\s+doGet\s*\(/.test(readFileSync(join(dir, f), 'utf8')));
if (withDoGet.length > 1) throw new Error('ພົບ doGet ຫຼາຍກວ່າ 1 ໄຟລ໌: ' + withDoGet.join(', ') + ' — ກະລຸນາລຶບໄຟລ໌ເກົ່າໃນ Apps Script ອອກ');
const target = withDoGet[0] || (scripts.includes('Code.js') ? 'Code.js' : 'Code.js');
writeFileSync(join(dir, target), code);
console.log('✅ ' + target + ' ← apps-script/Code.gs');

const html = files.find(f => f.toLowerCase() === 'index.html') || 'Index.html';
writeFileSync(join(dir, html), index);
console.log('✅ ' + html + ' ← apps-script/Index.html');

const others = scripts.filter(f => f !== target);
if (others.length) console.log('ℹ️  ໄຟລ໌ script ອື່ນທີ່ຮັກສາໄວ້: ' + others.join(', '));
