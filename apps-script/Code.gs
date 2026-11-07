// ==========================================
// ⚙️ ຕັ້ງຄ່າຂໍ້ມູນຫຼັກ (CONFIGURATIONS)
// ==========================================
const LINE_ACCESS_TOKEN = sfSecret_('LINE_ACCESS_TOKEN', '');
const GROUP_ID = sfSecret_('GROUP_ID', '');
const DRIVE_FOLDER_ID = sfSecret_('DRIVE_FOLDER_ID', '');
// 🔑 ຄ່າລັບທັງ 3 ຂ້າງເທິງ ຕັ້ງໃນ Apps Script: Project Settings → Script Properties (ບໍ່ເກັບໄວ້ໃນ GitHub)

// 🔔 ຕັ້ງຄ່າແຈ້ງເຕືອນ "ນ້ຳມັນໃກ້ໝົດ" (ຢູ່ໜ້າ "ຄັງນ້ຳມັນ" ໃນເວັບແອັບ)
const LOW_STOCK_THRESHOLD_LITERS = 200; // ຄ່າເລີ່ມຕົ້ນ: ຍັງເຫຼືອ <= ຈຳນວນນີ້ (ລິດ) ຈະສົ່ງແຈ້ງເຕືອນ (ປ່ຽນໄດ້ໃນເວັບ: ຄັງນ້ຳມັນຄົງເຫຼືອ > ຕັ້ງຄ່າແຈ້ງເຕືອນ)
const ALERT_EMAILS = [
  // "admin1@example.com",
  // "admin2@example.com"
]; // ✏️ ໃສ່ email ຂອງຄົນທີ່ຕ້ອງການໃຫ້ຮັບແຈ້ງເຕືອນ "ນ້ຳມັນໃກ້ໝົດ" (ໃສ່ໄດ້ຫຼາຍຄົນ, ຄັ່ນດ້ວຍ comma) - ຖ້າວ່າງ ຈະບໍ່ສົ່ງອີເມວ

// ⚠️ ໂຄງສ້າງຄໍລໍາ Sheet "Users" (ຕ້ອງກົງກັນ - ຖ້າ Sheet ເກົ່າຍັງບໍ່ມີຖັນ G/H, ໃຫ້ເພີ່ມ header ໃສ່ Sheet ດ້ວຍຕົນເອງ):
// A: Email | B: Password | C: Name | D: Role | E: Status | F: CreatedAt |
// G: Permissions (JSON string ຂອງ {recordOut,recordIn,dashboard,tableOut,tableIn,manageUsers}) | H: Station (ສະຖານທີ່ຮັບຜິດຊອບ, ຫວ່າງ = ທັງໝົດ)

// 🌐 WEB APP ENTRY POINT
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
      .setTitle('ລະບົບບັນທຶກນ້ຳມັນ SMART v5')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
}

// ==========================================
// 🌍 JSON API ສຳລັບໜ້າເວັບທີ່ host ຢູ່ Vercel
// ໜ້າເວັບສົ່ງ POST {fn, args} ມາ — ເອີ້ນໄດ້ສະເພາະ function ໃນ SF_FN_SPEC ທີ່ບໍ່ແມ່ນ 'owner'
// ==========================================
function doPost(e) {
  let out;
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const fn = String(req.fn || '');
    const spec = SF_FN_SPEC[fn];
    const target = globalThis[fn];
    if (!spec || spec === 'owner' || typeof target !== 'function') throw new Error('Function not allowed: ' + fn);
    const args = Array.isArray(req.args) ? req.args : [];
    out = { ok: true, result: target.apply(null, args) };
  } catch (err) {
    out = { ok: false, error: (err && err.message) || String(err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

// ==========================================
// 🔐 ຟັງຊັນກາງສຳລັບກວດສິດ (SERVER-SIDE AUTH GUARD)
// ຫ້າມເຊື່ອຖື role ທີ່ສົ່ງມາຈາກ client ໂດຍກົງ - ຕ້ອງກວດຄືນຈາກ Sheet ທຸກຄັ້ງ
// ==========================================

// ລາຍການສິດແບບລະອຽດ (Granular Permissions) - ຕ້ອງກົງກັບ checkbox ຝັ່ງ Client
const PERMISSION_KEYS = ['recordOut', 'recordIn', 'dashboard', 'tableOut', 'tableIn', 'manageUsers', 'stockSummary', 'dailyReport', 'monthlyReport', 'yearlyReport', 'vehicleUsage',
  'rentalContracts', 'rentalLogs', 'rentalBilling', 'rentalPayments', 'rentalReport',
  'mtOverview', 'mtRequest', 'mtApprove', 'mtReqEdit', 'mtSigRequester', 'mtSigSite', 'mtSigMech', 'mtSigApprover', 'mtForm', 'mtHistory', 'mtVehicles', 'mtReport'];
// ສິດປະເພດນີ້ມີ 3 ລະດັບ: 'none' (ບໍ່ມີສິດ) | 'view' (ເບິ່ງຢ່າງດຽວ) | 'edit' (ເບິ່ງ & ແກ້ໄຂ/ລຶບ/ສົ່ງອອກ)
const LEVELED_PERMISSION_KEYS = ['tableOut', 'tableIn', 'rentalContracts', 'rentalLogs', 'rentalBilling', 'rentalPayments', 'rentalReport', 'mtOverview', 'mtRequest', 'mtApprove', 'mtReqEdit', 'mtSigRequester', 'mtSigSite', 'mtSigMech', 'mtSigApprover', 'mtForm', 'mtHistory', 'mtVehicles', 'mtReport'];
// ລະດັບທີ່ອະນຸຍາດສຳລັບບາງໜ້າ (ໜ້າລາຍງານ/ພາບລວມ ມີແຕ່ "ເບິ່ງ", ໜ້າບັນທຶກໃບສ້ອມໃໝ່ ມີແຕ່ "ແກ້ໄຂ")
const PERMISSION_LEVEL_LIMITS = { rentalReport: ['none', 'view'], mtOverview: ['none', 'view'], mtReport: ['none', 'view'], mtForm: ['none', 'edit'], mtApprove: ['none', 'edit'], mtReqEdit: ['none', 'edit'], mtSigRequester: ['none', 'edit'], mtSigSite: ['none', 'edit'], mtSigMech: ['none', 'edit'], mtSigApprover: ['none', 'edit'] };

// ແປງສິດແບບເກົ່າ (rental / maintenance ອັນດຽວ) ເປັນສິດລາຍໜ້າ — ສຳລັບຜູ້ໃຊ້ທີ່ຕັ້ງສິດໄວ້ກ່ອນອັບເດດ
function migrateModulePermissions_(p) {
  if (!p || typeof p !== 'object') return p;
  const groups = { rental: ['rentalContracts', 'rentalLogs', 'rentalBilling', 'rentalPayments', 'rentalReport'], maintenance: ['mtOverview', 'mtRequest', 'mtApprove', 'mtReqEdit', 'mtSigRequester', 'mtSigSite', 'mtSigMech', 'mtSigApprover', 'mtForm', 'mtHistory', 'mtVehicles', 'mtReport'] };
  Object.keys(groups).forEach(old => {
    const v = p[old];
    if (!v || v === 'none' || groups[old].some(k => p[k] !== undefined)) return;
    groups[old].forEach(k => { p[k] = v; });
  });
  return p;
}

// ຄ່າເລີ່ມຕົ້ນ: Admin = ໄດ້ໝົດທຸກສິດສະເໝີ, User ທີ່ຍັງບໍ່ໄດ້ຕັ້ງຄ່າ = ໄດ້ແຕ່ບັນທຶກນ້ຳມັນອອກ (ພຶດຕິກຳເດີມກ່ອນມີລະບົບນີ້)
function defaultPermissions_(role) {
  const p = {};
  PERMISSION_KEYS.forEach(k => {
    if (LEVELED_PERMISSION_KEYS.includes(k)) {
      p[k] = (role === 'Admin') ? 'edit' : 'none';
    } else {
      p[k] = (role === 'Admin');
    }
  });
  if (role !== 'Admin') { p.recordOut = true; p.vehicleUsage = true; }
  return p;
}

// ✅ ປ້ອງກັນຄ່າ Role ຜິດປົກກະຕິໃນ Sheet (ເຊັ່ນ "view"/"Edit" ທີ່ອາດຖືກພິມໃສ່ໂດຍກົງໃນ Sheet ແທນທີ່ຈະຜ່ານຟອມ)
// ຍອມຮັບສະເພາະ "Admin" ເທົ່ານັ້ນ, ນອກນັ້ນຖືວ່າເປັນ "User" ໝົດ - ໃຫ້ໃຊ້ຟັງຊັນນີ້ທຸກບ່ອນທີ່ອ່ານຄ່າ Role ຈາກ Sheet
function normalizeRole_(rawRole) {
  const r = (rawRole || "").toString().trim();
  return (r === 'Admin' || r === 'SuperAdmin') ? 'Admin' : 'User'; // SuperAdmin ໄດ້ທຸກສິດຄື Admin
}

/* ==================== 👑 SuperAdmin ==================== */
// Email ທີ່ຈະຕັ້ງເປັນ SuperAdmin ເມື່ອ Run "sfSetupSuperAdmin" ໃນ editor (ຫຼື ຕັ້ງຜ່ານໜ້າຈັດການຜູ້ໃຊ້ ຕອນຍັງບໍ່ມີ SuperAdmin)
const SUPER_ADMIN_SETUP_EMAIL = 'larkysihavong@gmail.com';
const USER_ACCESS_LEVELS = ['none', 'view', 'edit'];
// 🔐 ສິດທີ່ SuperAdmin ເທົ່ານັ້ນກຳນົດໄດ້ (Admin ກໍຕ້ອງໄດ້ຮັບອະນຸຍາດກ່ອນ)
const SUPER_GRANT_KEYS = ['mtApprove', 'mtReqEdit', 'mtSigRequester', 'mtSigSite', 'mtSigMech', 'mtSigApprover'];
let SA_COUNT_CACHE_ = null;

function isSuperRole_(rawRole) { return (rawRole || '').toString().trim() === 'SuperAdmin'; }

/** ຈຳນວນ SuperAdmin ທີ່ Active ໃນຊີດ Users */
function superAdminCount_() {
  if (typeof SpreadsheetApp === 'undefined') return 1;
  if (SA_COUNT_CACHE_ !== null) return SA_COUNT_CACHE_;
  const sh = sfSS_().getSheetByName('Users');
  if (!sh || sh.getLastRow() < 2) return (SA_COUNT_CACHE_ = 0);
  const v = sh.getDataRange().getValues().slice(1);
  SA_COUNT_CACHE_ = v.filter(r => r[0] && isSuperRole_(r[3]) && !["Inactive", "Disabled", "ປິດໃຊ້ງານ"].includes(String(r[4]).trim())).length;
  return SA_COUNT_CACHE_;
}

/** ລະດັບສິດຈັດການຜູ້ໃຊ້: SuperAdmin = edit · Admin = ຕາມທີ່ SuperAdmin ອະນຸຍາດ · User = ຕາມ checkbox "ຈັດການຜູ້ໃຊ້"
 *  ຖ້າລະບົບຍັງບໍ່ມີ SuperAdmin ເລີຍ → Admin ຍັງຈັດການໄດ້ຄືເກົ່າ (ບໍ່ໃຫ້ລັອກຕົວເອງອອກ ກ່ອນຕັ້ງ SuperAdmin) */
function userAccessOf_(rawRole, rawPermJson, permissions) {
  if (isSuperRole_(rawRole)) return 'edit';
  if (normalizeRole_(rawRole) === 'Admin') {
    if (superAdminCount_() === 0) return 'edit';
    try { const v = JSON.parse(rawPermJson || '{}').adminUserAccess; return USER_ACCESS_LEVELS.includes(v) ? v : 'none'; } catch (e) { return 'none'; }
  }
  return (permissions && permissions.manageUsers) ? 'edit' : 'none';
}

/** ເພີ່ມ isSuper / userAccess ໃຫ້ object ຜູ້ໃຊ້ ແລະ ໃຫ້ permissions.manageUsers ສອດຄ່ອງກັບລະດັບແທ້ */
function withUserAccess_(u, rawRole, rawPermJson) {
  u.isSuper = isSuperRole_(rawRole);
  u.adminGrants = {};
  if (normalizeRole_(rawRole) === 'Admin') { try { const g = JSON.parse(rawPermJson || '{}').adminGrants || {}; SUPER_GRANT_KEYS.forEach(k => { if (g[k] === 'edit') u.adminGrants[k] = 'edit'; }); } catch (e) {} }
  u.userAccess = userAccessOf_(rawRole, rawPermJson, u.permissions);
  if (u.permissions) u.permissions.manageUsers = u.userAccess !== 'none';
  return u;
}

/** ຜູ້ທີ່ມີອຳນາດລະດັບ SuperAdmin (ຫຼື Admin ຕອນລະບົບຍັງບໍ່ມີ SuperAdmin) */
function isSuperEff_(user) { return !!user && (user.isSuper || (user.role === 'Admin' && superAdminCount_() === 0)); }

function requireUserAccess_(requesterUsername, level) {
  const user = requireActiveUser_(requesterUsername);
  const lv = user.userAccess || 'none';
  if (lv === 'none' || (level === 'edit' && lv !== 'edit')) {
    throw new Error(lv === 'view' ? 'ທ່ານມີສິດເບິ່ງຢ່າງດຽວ ໃນໜ້າຈັດການຜູ້ໃຊ້' : 'ທ່ານບໍ່ມີສິດເຂົ້າໜ້າຈັດການຜູ້ໃຊ້ (ຕ້ອງໃຫ້ SuperAdmin ອະນຸຍາດ)');
  }
  return user;
}

/** 👑 SuperAdmin ກົດອະນຸຍາດ / ຖອນສິດ Admin ເຂົ້າໜ້າຈັດການຜູ້ໃຊ້ (none / view / edit) */
function setAdminUserAccess_impl_(requesterUsername, targetUsername, level) {
  try {
    const requester = requireActiveUser_(requesterUsername);
    if (!requester.isSuper) throw new Error('ສະເພາະ SuperAdmin ເທົ່ານັ້ນ');
    if (!USER_ACCESS_LEVELS.includes(level)) throw new Error('ລະດັບສິດບໍ່ຖືກຕ້ອງ');
    const sheet = sfSS_().getSheetByName('Users');
    const data = sheet.getDataRange().getValues();
    const t = (targetUsername || '').toString().trim().toLowerCase();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString().trim().toLowerCase() === t) {
        if (String(data[i][3]).trim() !== 'Admin') throw new Error('ຕັ້ງໄດ້ສະເພາະບັນຊີ Admin');
        let old = {}; try { old = JSON.parse(data[i][6] || '{}'); } catch (e) {}
        const p = defaultPermissions_('Admin'); p.adminUserAccess = level; if (old.adminGrants) p.adminGrants = old.adminGrants;
        sheet.getRange(i + 1, 7).setValue(JSON.stringify(p));
        return { success: true };
      }
    }
    return { success: false, error: 'ບໍ່ພົບຜູ້ໃຊ້ນີ້' };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function sfSanitizeGrants_(g) { const o = {}; SUPER_GRANT_KEYS.forEach(k => { if (g && g[k] === 'edit') o[k] = 'edit'; }); return o; }

/* ---------- 🔑 ລະຫັດຜ່ານທີ່ SuperAdmin ເບິ່ງໄດ້ (ເຂົ້າລະຫັດແບບຖອດໄດ້ ດ້ວຍກະແຈໃນ Script Properties) ---------- */
function sfPwdKey_() {
  const p = PropertiesService.getScriptProperties();
  let k = p.getProperty('SF_PWD_KEY');
  if (!k) { k = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''); p.setProperty('SF_PWD_KEY', k); }
  return k;
}
function sfPwdStream_(iv, n) {
  const key = sfPwdKey_(); let out = [];
  for (let c = 0; out.length < n; c++) out = out.concat(Utilities.computeHmacSha256Signature(iv + ':' + c, key));
  return out.slice(0, n);
}
function sfPwdEnc_(plain) {
  const b = Utilities.newBlob(String(plain)).getBytes(), iv = Utilities.getUuid().replace(/-/g, '').slice(0, 16);
  const ks = sfPwdStream_(iv, b.length);
  return 'enc1$' + iv + '$' + b.map((x, i) => ('0' + (((x ^ ks[i]) & 0xff)).toString(16)).slice(-2)).join('');
}
function sfPwdDec_(enc) {
  const p = String(enc || '').split('$');
  if (p[0] !== 'enc1' || !p[2]) return null;
  const hex = p[2].match(/../g) || [], ks = sfPwdStream_(p[1], hex.length);
  const bytes = hex.map((h, i) => { const v = (parseInt(h, 16) ^ ks[i]) & 0xff; return v > 127 ? v - 256 : v; });
  return Utilities.newBlob(bytes).getDataAsString();
}
function sfPwdCol_(sheet) {
  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim());
  let col = headers.indexOf('PwdView') + 1;
  if (col === 0) { col = lastCol + 1; sheet.getRange(1, col).setValue('PwdView'); }
  return col;
}
function sfPwdStore_(sheet, rowNum, plain) { try { sheet.getRange(rowNum, sfPwdCol_(sheet)).setValue(sfPwdEnc_(plain)); } catch (e) { Logger.log('pwd store: ' + e); } }

/** 👑 SuperAdmin ຕັ້ງລະຫັດຜ່ານໃໝ່ໃຫ້ຜູ້ໃຊ້ */
function sfSetUserPassword_impl_(requesterUsername, targetUsername, newPassword) {
  try {
    const requester = requireActiveUser_(requesterUsername);
    if (!requester.isSuper) throw new Error('ສະເພາະ SuperAdmin ເທົ່ານັ້ນ');
    const pw = String(newPassword || '').trim();
    const sheet = sfSS_().getSheetByName('Users');
    const data = sheet.getDataRange().getValues();
    const t = String(targetUsername || '').trim().toLowerCase();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString().trim().toLowerCase() === t) {
        sheet.getRange(i + 1, 2).setValue(sfHashPassword_(pw));
        sfPwdStore_(sheet, i + 1, pw);
        if (t !== String(requester.username).toLowerCase()) { try { sfRevokeUser_(data[i][0], null); } catch (e) {} }
        return { success: true };
      }
    }
    return { success: false, error: 'ບໍ່ພົບຜູ້ໃຊ້ນີ້' };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/** 🛠️ Run 1 ຄັ້ງໃນ editor: ຕັ້ງ SUPER_ADMIN_SETUP_EMAIL ເປັນ SuperAdmin */
function sfSetupSuperAdmin_impl_() {
  const sheet = sfSS_().getSheetByName('Users');
  const data = sheet.getDataRange().getValues();
  const t = SUPER_ADMIN_SETUP_EMAIL.trim().toLowerCase();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] && data[i][0].toString().trim().toLowerCase() === t) {
      sheet.getRange(i + 1, 4).setValue('SuperAdmin');
      sheet.getRange(i + 1, 5).setValue('Active');
      sheet.getRange(i + 1, 7).setValue(JSON.stringify(defaultPermissions_('Admin')));
      sheet.getRange(i + 1, 8).setValue('[]');
      Logger.log('✅ ຕັ້ງ ' + data[i][0] + ' ເປັນ SuperAdmin ແລ້ວ. Admin ຄົນອື່ນ ຈະເຂົ້າໜ້າຈັດການຜູ້ໃຊ້ບໍ່ໄດ້ ຈົນກວ່າ SuperAdmin ອະນຸຍາດ.');
      return 'OK';
    }
  }
  throw new Error('ບໍ່ພົບ ' + SUPER_ADMIN_SETUP_EMAIL + ' ໃນຊີດ Users — ແກ້ຄ່າ SUPER_ADMIN_SETUP_EMAIL ກ່ອນ');
}

function parsePermissions_(rawJson, role) {
  if (role === 'Admin') return defaultPermissions_('Admin');
  if (!rawJson) return defaultPermissions_('User');
  try {
    const parsed = JSON.parse(rawJson);
    return sanitizePermissionsInput_(migrateModulePermissions_(parsed));
  } catch (e) {
    return defaultPermissions_('User');
  }
}

// Admin ໄດ້ທຸກສິດສະເໝີ. ສຳລັບ key ແບບ leveled (tableOut/tableIn): 'level' ຄືລະດັບຂັ້ນຕ່ຳທີ່ຕ້ອງການ ('view' ຫຼື 'edit', default 'view')
// ສຳລັບ key ແບບ boolean ທົ່ວໄປ: ບໍ່ສົນ 'level', ເບິ່ງແຕ່ true/false
function hasPermission_(user, key, level) {
  if (!user) return false;
  if (SUPER_GRANT_KEYS.indexOf(key) >= 0 && user.role === 'Admin') { if (user.isSuper || superAdminCount_() === 0) return true; return !!(user.adminGrants && user.adminGrants[key] === 'edit'); }
  if (key === 'manageUsers') { const lv = user.userAccess || (user.role === 'Admin' ? 'edit' : (user.permissions && user.permissions.manageUsers ? 'edit' : 'none')); return lv !== 'none' && (level !== 'edit' || lv === 'edit'); }
  if (user.role === 'Admin') return true;
  if (!user.permissions) return false;

  if (LEVELED_PERMISSION_KEYS.includes(key)) {
    const required = level || 'view';
    const val = user.permissions[key];
    if (val === 'edit') return true;
    if (val === 'view' && required === 'view') return true;
    return false;
  }
  return !!user.permissions[key];
}

// ແປງຄ່າ Station ຈາກ Sheet (column H) ເປັນ array ຂອງຊື່ສະຖານທີ່ - ຮອງຮັບ JSON array, ຄັ່ນດ້ວຍ comma, ຫຼືຊື່ດຽວ (ຂໍ້ມູນເກົ່າ)
// array ຫວ່າງ = ບໍ່ຈຳກັດ (ເຫັນທຸກສະຖານທີ່)
function parseStations_(raw) {
  if (!raw) return [];
  const str = raw.toString().trim();
  if (!str) return [];
  try {
    const parsed = JSON.parse(str);
    if (Array.isArray(parsed)) {
      return parsed.map(s => s.toString().trim()).filter(Boolean);
    }
  } catch (e) {
    // ບໍ່ແມ່ນ JSON - ອາດເປັນຂໍ້ມູນເກົ່າ (ຊື່ດຽວ ຫຼື ຄັ່ນດ້ວຍ comma)
  }
  return str.split(',').map(s => s.trim()).filter(Boolean);
}

function getUserRecordByUsername_(username) {
  const ss = sfSS_();
  const sheet = ss.getSheetByName('Users');
  if (!sheet) throw new Error("ບໍ່ພົບຊີດ Users ໃນລະບົບ");

  const data = sheet.getDataRange().getValues();
  const target = (username || "").toString().trim().toLowerCase();
  if (!target) throw new Error("ບໍ່ໄດ້ລະບຸ Email ຜູ້ຮ້ອງຂໍ (Unauthorized)");

  for (let i = 1; i < data.length; i++) {
    const rowUsername = data[i][0] ? data[i][0].toString().trim().toLowerCase() : "";
    if (rowUsername === target) {
      const role = normalizeRole_(data[i][3]);
      const rawPermissions = data[i][6] ? data[i][6].toString() : "";
      const __rec = withUserAccess_({
        rowIndex: i + 1,
        username: data[i][0].toString().trim(),
        name: data[i][2] ? data[i][2].toString() : data[i][0].toString(),
        role: role,
        status: data[i][4] ? data[i][4].toString() : "Active",
        permissions: parsePermissions_(rawPermissions, role),
        stations: parseStations_(data[i][7])
      }, data[i][3], rawPermissions);
      const __ci = sfCoColIdx_(data[0]);
      __rec.companies = sfParseCompanies_(__ci >= 0 ? data[i][__ci] : '', data[i][3]);
      sfCoCheck_(__rec);
      return __rec;
    }
  }
  throw new Error("ບໍ່ພົບຜູ້ໃຊ້ນີ້ໃນລະບົບ (Unauthorized)");
}

// 🔄 ດຶງ role/permissions/status ລ່າສຸດຂອງຜູ້ໃຊ້ (ບໍ່ຕ້ອງໃສ່ password) - ໃຊ້ໂດຍ client ເພື່ອ
// "ອັບເດດ session ທີ່ຄ້າງຢູ່ໃນ browser (localStorage)" ໃຫ້ທັນສະໄໝ ໂດຍບໍ່ຕ້ອງໃຫ້ຜູ້ໃຊ້ logout/login ໃໝ່ທຸກຄັ້ງ
// ທີ່ Admin ໄປແກ້ໄຂສິດ - ເອີ້ນແບບ silent ຢູ່ພື້ນຫຼັງທຸກຄັ້ງທີ່ເປີດແອັບຄືນ (restore session ຈາກ cache)
function refreshMyPermissions_impl_(username) {
  try {
    SF_SKIP_CO_CHECK = true;
    const rec = getUserRecordByUsername_(username);
    SF_SKIP_CO_CHECK = false;
    if (["Inactive", "Disabled", "ປິດໃຊ້ງານ"].includes(rec.status)) {
      return { success: false, error: "ບັນຊີຜູ້ໃຊ້ນີ້ຖືກປິດການໃຊ້ງານແລ້ວ" };
    }
    return {
      success: true,
      user: {
        username: rec.username,
        name: rec.name,
        role: rec.role,
        isSuper: rec.isSuper,
        userAccess: rec.userAccess,
        companies: rec.companies,
        company: sfCompanyId_(),
        companiesReady: sfCoIds_().filter(sfCoReady_),
        status: rec.status,
        permissions: rec.permissions,
        stations: rec.stations,
        token: SF_CURRENT_TOKEN
      },
      companyDenied: rec.companies.indexOf(sfCompanyId_()) < 0
    };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}


// ກວດວ່າຜູ້ຮ້ອງຂໍເປັນ Admin ແລະບັນຊີຍັງໃຊ້ງານໄດ້ - throw error ຖ້າບໍ່ຜ່ານ
function requireAdmin_(requesterUsername) {
  const user = getUserRecordByUsername_(requesterUsername);
  if (["Inactive", "Disabled", "ປິດໃຊ້ງານ"].includes(user.status)) {
    throw new Error("ບັນຊີຜູ້ໃຊ້ນີ້ຖືກປິດການໃຊ້ງານແລ້ວ");
  }
  if (user.role !== "Admin") {
    throw new Error("ທ່ານບໍ່ມີສິດເຂົ້າເຖິງຟັງຊັນນີ້ (ຕ້ອງເປັນ Admin ເທົ່ານັ້ນ)");
  }
  return user;
}

// ກວດວ່າຜູ້ຮ້ອງຂໍເປັນຜູ້ໃຊ້ທີ່ Active (ບໍ່ຈຳກັດ role) - ໃຊ້ກັບຟັງຊັນທົ່ວໄປທີ່ຕ້ອງ login ກ່ອນ
function requireActiveUser_(requesterUsername) {
  const user = getUserRecordByUsername_(requesterUsername);
  if (["Inactive", "Disabled", "ປິດໃຊ້ງານ"].includes(user.status)) {
    throw new Error("ບັນຊີຜູ້ໃຊ້ນີ້ຖືກປິດການໃຊ້ງານແລ້ວ");
  }
  return user;
}

// ກວດວ່າຜູ້ຮ້ອງຂໍ Active ແລະ ມີສິດ (permission key) ທີ່ລະບຸ - throw error ຖ້າບໍ່ຜ່ານ
// level (ໃຊ້ກັບ tableOut/tableIn ເທົ່ານັ້ນ): 'view' ຫຼື 'edit' - ຄ່າ default ຄື 'view'
function requirePermission_(requesterUsername, permissionKey, level) {
  const user = requireActiveUser_(requesterUsername);
  if (!hasPermission_(user, permissionKey, level)) {
    throw new Error("ທ່ານບໍ່ມີສິດເຂົ້າເຖິງຟັງຊັນນີ້");
  }
  return user;
}

// ຮັບ object permissions ຈາກ client (ບໍ່ໜ້າເຊື່ອຖື 100%) ແລ້ວກອງເອົາສະເພາະ key ທີ່ຮູ້ຈັກ
// key ແບບ leveled (tableOut/tableIn): ຄ່າຕ້ອງເປັນ 'none'|'view'|'edit' ເທົ່ານັ້ນ, ຜິດຮູບແບບ = 'none'
// key ອື່ນໆ: coerce ເປັນ boolean
function sanitizePermissionsInput_(rawObj) {
  const p = {};
  PERMISSION_KEYS.forEach(k => {
    if (LEVELED_PERMISSION_KEYS.includes(k)) {
      const v = rawObj && rawObj[k];
      p[k] = ['none', 'view', 'edit'].includes(v) ? v : 'none';
      const lim = PERMISSION_LEVEL_LIMITS[k];
      if (lim && !lim.includes(p[k])) p[k] = (p[k] === 'edit' && lim.includes('view')) ? 'view' : (p[k] === 'view' && lim.includes('edit')) ? 'none' : 'none';
    } else {
      p[k] = !!(rawObj && rawObj[k]);
    }
  });
  return p;
}

// ຮັບ array ຊື່ສະຖານທີ່ຈາກ client ແລ້ວກອງເອົາສະເພາະ string ທີ່ບໍ່ຫວ່າງ
function sanitizeStationsInput_(rawArr) {
  if (!Array.isArray(rawArr)) return [];
  return rawArr.map(s => (s || "").toString().trim()).filter(Boolean);
}

// 🔒 ເປີດເບິ່ງລະຫັດຜ່ານແທ້ຂອງຜູ້ໃຊ້ - ສະເພາະ Admin ເທົ່ານັ້ນ (ບໍ່ໄດ້ຝັງ password ໄວ້ໃນ userList ທົ່ວໄປ)
function revealUserPassword_impl_(requesterUsername, targetUsername) {
  try {
    if (!requireActiveUser_(requesterUsername).isSuper) throw new Error('ສະເພາະ SuperAdmin ເທົ່ານັ້ນທີ່ເບິ່ງລະຫັດຜ່ານໄດ້');
    const ss = sfSS_();
    const sheet = ss.getSheetByName('Users');
    if (!sheet) throw new Error("ບໍ່ພົບຊີດ Users");

    const data = sheet.getDataRange().getValues();
    const target = (targetUsername || "").toString().trim().toLowerCase();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString().trim().toLowerCase() === target) {
        const stored = data[i][1] ? data[i][1].toString() : "";
        if (sfIsHashed_(stored)) {
          const pc = data[0].map(h => String(h).trim()).indexOf('PwdView');
          const plain = pc >= 0 ? sfPwdDec_(data[i][pc]) : null;
          if (plain !== null) return { success: true, password: plain };
          return { success: false, error: "ຍັງບໍ່ມີລະຫັດທີ່ເບິ່ງໄດ້ສຳລັບຜູ້ໃຊ້ນີ້ — ຈະເບິ່ງໄດ້ຫຼັງຜູ້ໃຊ້ Login ຄັ້ງຕໍ່ໄປ ຫຼື ກົດ 🔑 ຕັ້ງລະຫັດໃໝ່ໃຫ້" };
        }
        return { success: true, password: stored };
      }
    }
    return { success: false, error: "ບໍ່ພົບຜູ້ໃຊ້ນີ້" };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// 🛠️ ຟັງຊັນຊ່ວຍຄຳນວນຄວາມຕ່າງຂອງເວລາ (HH:mm) ເປັນຊົ່ວໂມງ
function calculateHoursDiff_impl_(startTimeStr, endTimeStr) {
  if (!startTimeStr || !endTimeStr) return 0;
  const startParts = startTimeStr.toString().split(':');
  const endParts = endTimeStr.toString().split(':');
  if (startParts.length < 2 || endParts.length < 2) return 0;

  const startMin = parseInt(startParts[0], 10) * 60 + parseInt(startParts[1], 10);
  const endMin = parseInt(endParts[0], 10) * 60 + parseInt(endParts[1], 10);
  
  let diffMin = endMin - startMin;
  if (diffMin < 0) diffMin += 24 * 60; // ຮອງຮັບກໍລະນີຂ້າມຄືນ
  return Math.max(0, diffMin / 60);
}

// 🧹 ຟັງຊັນລ້າງ/ຣີເຊັດ ປະຫວັດ Login
function autoClearLoginHistory_impl_() {
  const ss = sfSS_();
  const sheet = ss.getSheetByName("Login_History");
  if (sheet && sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
  }
}

// 🔑 ຟັງຊັນກວດສອບການເຂົ້າລະບົບ + ບັນທຶກປະຫວັດ Login
function checkLogin_impl_(username, password, deviceInfo, locationData) {
  try {
    if (!username || !password) return { success: false, error: "ກະລຸນາປ້ອນ Email ແລະ Password" };

    const ss = sfSS_();
    const sheet = ss.getSheetByName('Users');
    if (!sheet) return { success: false, error: "ບໍ່ພົບຊີດ Users ໃນລະບົບ" };
    
    const data = sheet.getDataRange().getValues();
    const cleanUser = username.toString().trim().toLowerCase();
    const cleanPass = password.toString().trim();

    for (let i = 1; i < data.length; i++) {
      const rowUsername = data[i][0] ? data[i][0].toString().trim().toLowerCase() : "";
      
      if (rowUsername === cleanUser) {
        const rowPassword = data[i][1] ? data[i][1].toString().trim() : "";
        if (!sfVerifyPassword_(cleanPass, rowPassword)) {
          return { success: false, error: "Password ບໍ່ຖືກຕ້ອງ" };
        }
        if (!sfIsHashed_(rowPassword)) { try { sheet.getRange(i + 1, 2).setValue(sfHashPassword_(cleanPass, true)); } catch (e) {} } // ແປງລະຫັດເກົ່າເປັນ hash
        { const pc = data[0].map(h => String(h).trim()).indexOf('PwdView'); if (pc < 0 || !data[i][pc] || sfPwdDec_(data[i][pc]) !== cleanPass) sfPwdStore_(sheet, i + 1, cleanPass); }

        const status = data[i][4] ? data[i][4].toString().trim() : "Active";
        if (["Inactive", "Disabled", "ປິດໃຊ້ງານ"].includes(status)) {
          return { success: false, error: "ບັນຊີຜູ້ໃຊ້ນີ້ຖືກປິດການໃຊ້ງານແລ້ວ! ກະລຸນາຕິດຕໍ່ Admin" };
        }

        const role = normalizeRole_(data[i][3]);
        const rawPermissions = data[i][6] ? data[i][6].toString() : "";

        const userInfo = {
          username: data[i][0].toString().trim(),
          name: data[i][2] ? data[i][2].toString() : data[i][0].toString(),
          role: role,
          status: status,
          permissions: parsePermissions_(rawPermissions, role),
          stations: parseStations_(data[i][7])
        };
        withUserAccess_(userInfo, data[i][3], rawPermissions);
        const __ci = sfCoColIdx_(data[0]);
        userInfo.companies = sfParseCompanies_(__ci >= 0 ? data[i][__ci] : '', data[i][3]);
        userInfo.company = userInfo.companies.find(sfCoReady_) || userInfo.companies[0];
        userInfo.companiesReady = sfCoIds_().filter(sfCoReady_);

        recordLoginTime(ss, userInfo, deviceInfo, locationData);

        return {
          success: true,
          groupId: GROUP_ID,
          user: userInfo
        };
      }
    }
    return { success: false, error: "ບໍ່ພົບ Email ນີ້ໃນລະບົບ" };
  } catch (e) {
    Logger.log("Error checkLogin: " + e.toString());
    return { success: false, error: e.toString() };
  }
}

// 📌 ບັນທຶກ Timestamp, Device, IP/Location ລົງ Login_History
function recordLoginTime_impl_(ss, user, deviceInfo, locationData) {
  try {
    let loginSheet = ss.getSheetByName('Login_History');
    
    if (!loginSheet) {
      loginSheet = ss.insertSheet('Login_History');
      loginSheet.appendRow(['Timestamp', 'Email', 'Name', 'Role', 'Device / OS', 'Latitude', 'Longitude', 'Google Maps Link', 'Action']);
      loginSheet.getRange(1, 1, 1, 9).setFontWeight('bold').setBackground('#1a365d').setFontColor('#ffffff');
    }

    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
    const lat = locationData?.lat || "";
    const lng = locationData?.lng || "";
    const mapUrl = (lat && lng) ? `https://www.google.com/maps?q=${lat},${lng}` : "ບໍ່ໄດ້ຮັບສິດ Location";

    loginSheet.appendRow([
      timestamp, 
      user.username, 
      user.name, 
      user.role, 
      deviceInfo || 'Unknown',
      lat,
      lng,
      mapUrl,
      'Login'
    ]);
  } catch (err) {
    Logger.log("Error recordLoginTime: " + err.toString());
  }
}

// 📌 ບັນທຶກ + ແຈ້ງເຕືອນ LINE ຕອນຜູ້ໃຊ້ອອກຈາກລະບົບ (Logout)
function recordLogout_impl_(requesterUsername) {
  try {
    const user = requireActiveUser_(requesterUsername);
    sfDestroySession_(SF_CURRENT_TOKEN);
    const ss = sfSS_();
    let loginSheet = ss.getSheetByName('Login_History');

    if (!loginSheet) {
      loginSheet = ss.insertSheet('Login_History');
      loginSheet.appendRow(['Timestamp', 'Email', 'Name', 'Role', 'Device / OS', 'Latitude', 'Longitude', 'Google Maps Link', 'Action']);
      loginSheet.getRange(1, 1, 1, 9).setFontWeight('bold').setBackground('#1a365d').setFontColor('#ffffff');
    }

    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
    loginSheet.appendRow([timestamp, user.username, user.name, user.role, '', '', '', '', 'Logout']);

    sendLineNotification(
      `🔴 ອອກຈາກລະບົບ\n👤 ຜູ້ໃຊ້: ${user.name} (${user.username})\n🕒 ເວລາ: ${timestamp}`
    );

    return { success: true };
  } catch (e) {
    Logger.log("Error recordLogout: " + e.toString());
    return { success: false, error: e.toString() };
  }
}

// 📦 ຟັງຊັນດຶງຂໍ້ມູນເລີ່ມຕົ້ນ
// requesterUsername: ໃຊ້ກວດວ່າ session ຍັງ active + ໃຊ້ຕັດສິນວ່າຈະສົ່ງ userList/ຂໍ້ມູນຫຍັງ ອອກໄປບໍ່
function getInitialData_impl_(requesterUsername) {
  try {
    const requester = requireActiveUser_(requesterUsername);
    const isAdmin = requester.role === "Admin";
    // ຜູ້ໃຊ້ທີ່ບໍ່ແມ່ນ Admin ແລະຖືກຈຳກັດສະຖານທີ່ (stations) ຈະເຫັນສະເພາະຂໍ້ມູນຂອງສະຖານທີ່ທີ່ຖືກມອບໝາຍ
    const restrictStations = (!isAdmin && requester.stations && requester.stations.length) ? requester.stations : null;

    const ss = sfSS_();
    const tz = Session.getScriptTimeZone();
    
    // 1. ດຶງຂໍ້ມູນ Settings (ລາຍຊື່ສະໜາມ/ຄັງນ້ຳມັນ)
    const stationSheet = ss.getSheetByName('Settings');
    let stations = [];
    if (stationSheet && stationSheet.getLastRow() > 1) {
      const stData = stationSheet.getRange(2, 1, stationSheet.getLastRow() - 1, 1).getValues();
      stations = stData.map(r => r[0] ? r[0].toString().trim() : "").filter(Boolean);
    }
    if (restrictStations) {
      stations = stations.filter(s => restrictStations.includes(s));
    }
    
    // 2. ດຶງຂໍ້ມູນ Field_Data
    const dataSheet = ss.getSheetByName('Field_Data');
    let rawData = [];
    if (dataSheet && dataSheet.getLastRow() > 1) {
      const allData = dataSheet.getRange(2, 1, dataSheet.getLastRow() - 1, dataSheet.getLastColumn()).getValues();
      
      rawData = allData.map(row => {
        return row.map((cell, colIdx) => {
          if (cell instanceof Date) {
            if (colIdx === 13 || colIdx === 14) {
              return Utilities.formatDate(cell, tz, "HH:mm");
            }
            return Utilities.formatDate(cell, tz, "yyyy-MM-dd HH:mm:ss");
          }
          return (cell === null || cell === undefined) ? "" : cell;
        });
      });
      if (restrictStations) {
        rawData = rawData.filter(row => restrictStations.includes(row[1]));
      }
    }
    
    // 3. ດຶງຂໍ້ມູນ Users
    // 🔐 ຈຳກັດ: ສົ່ງ userList ໃຫ້ສະເພາະຄົນທີ່ມີສິດ "manageUsers" ເທົ່ານັ້ນ, ແລະບໍ່ສົ່ງ password ອອກໄປເລີຍ (ບໍ່ວ່າຈະເປັນໃຜ)
    let userList = [];
    if ((requester.userAccess || 'none') !== 'none') {
      const userSheet = ss.getSheetByName('Users');
      if (userSheet && userSheet.getLastRow() > 1) {
        const uData = userSheet.getDataRange().getValues();
        for (let i = 1; i < uData.length; i++) {
          if (uData[i][0]) {
            let dateAdded = uData[i][5];
            if (dateAdded instanceof Date) {
              try {
                dateAdded = Utilities.formatDate(dateAdded, tz, "yyyy-MM-dd HH:mm:ss");
              } catch(e) {
                dateAdded = String(dateAdded);
              }
            }
            const rowRole = normalizeRole_(uData[i][3]);
            const rawPermissions = uData[i][6] ? uData[i][6].toString() : "";
            let adminUserAccess = '';
            if (String(uData[i][3]).trim() === 'Admin') adminUserAccess = userAccessOf_(uData[i][3], rawPermissions, null);
            let adminGrants = {};
            if (String(uData[i][3]).trim() === 'Admin') { try { adminGrants = sfSanitizeGrants_(JSON.parse(rawPermissions || '{}').adminGrants); } catch (e) {} }
            userList.push({
              adminGrants: adminGrants,
              isSuper: isSuperRole_(uData[i][3]),
              companies: sfParseCompanies_(sfCoColIdx_(uData[0]) >= 0 ? uData[i][sfCoColIdx_(uData[0])] : '', uData[i][3]),
              adminUserAccess: adminUserAccess,
              username: uData[i][0].toString(),
              // password ບໍ່ຖືກສົ່ງອອກໄປໃຫ້ client ອີກຕໍ່ໄປ (ເຄີຍເປັນຊ່ອງໂຫວ່ຮ້າຍແຮງ) - ເບິ່ງໄດ້ຜ່ານ revealUserPassword() ເທົ່ານັ້ນ
              name: uData[i][2] ? uData[i][2].toString() : uData[i][0].toString(),
              role: rowRole,
              status: uData[i][4] ? uData[i][4].toString() : "Active",
              createdAt: dateAdded ? dateAdded.toString() : "-",
              permissions: parsePermissions_(rawPermissions, rowRole),
              stations: parseStations_(uData[i][7])
            });
          }
        }
      }
    }

    const usageDeductions = getUsageDeductionMap_(restrictStations);
    return {
      stations: stations,
      rawData: rawData,
      userList: userList,
      isAdmin: isAdmin,
      isSuper: !!requester.isSuper,
      userAccess: requester.userAccess || 'none',
      superExists: superAdminCount_() > 0,
      company: sfCompanyId_(),
      companiesReady: sfCoIds_().filter(sfCoReady_),
      permissions: requester.permissions,
      stations_assigned: requester.stations,
      usageDeductions: usageDeductions,
      people: getPeopleLists_(),
      vehicleStations: getVehicleStationMap_(),
      consumptionEvents: getActualConsumptionEvents_(restrictStations, usageDeductions)
    };
  } catch (e) {
    Logger.log("Error getInitialData: " + e.toString());
    return { error: e.toString(), stations: [], rawData: [], userList: [], isAdmin: false };
  }
}

// 📅 ຟັງຊັນກັ່ນກອງຂໍ້ມູນຕາມช่วงວັນທີ (ຕ້ອງມີສິດ tableOut ຢ່າງໜ້ອຍ "ເບິ່ງ" - ໃຊ້ໃນຕາຕະລາງລາຍງານ)
function getFilteredDataByDate_impl_(requesterUsername, startDateStr, endDateStr) {
  try {
    const requester = requirePermission_(requesterUsername, 'tableOut', 'view');
    const restrictStations = (requester.role !== "Admin" && requester.stations && requester.stations.length) ? requester.stations : null;
    const ss = sfSS_();
    const sheet = ss.getSheetByName("Field_Data");
    if (!sheet || sheet.getLastRow() <= 1) return [];

    const tz = Session.getScriptTimeZone();
    const start = new Date(startDateStr);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(endDateStr);
    end.setHours(23, 59, 59, 999);
    
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();

    const filtered = data.filter(function(row) {
      if (!row[0]) return false;
      const rowDate = new Date(row[0]);
      if (isNaN(rowDate.getTime()) || rowDate < start || rowDate > end) return false;
      if (restrictStations && !restrictStations.includes(row[1])) return false;
      return true;
    });

    return filtered.map(row => {
      return row.map((cell, colIdx) => {
        if (cell instanceof Date) {
          if (colIdx === 13 || colIdx === 14) {
            return Utilities.formatDate(cell, tz, "HH:mm");
          }
          return Utilities.formatDate(cell, tz, "yyyy-MM-dd HH:mm:ss");
        }
        return (cell === null || cell === undefined) ? "" : cell;
      });
    });
  } catch (e) {
    Logger.log("Error getFilteredDataByDate: " + e.toString());
    return [];
  }
}

// 📌 ເພີ່ມຊື່ສະໜາມ/ຄັງນ້ຳມັນໃໝ່ລົງໃນ Settings (Spreadsheet) - Admin ເທົ່ານັ້ນ
function addNewStation_impl_(requesterUsername, stationName) {
  try {
    requireAdmin_(requesterUsername);
    if (!stationName || !stationName.trim()) {
      return { success: false, error: "ກະລຸນາປ້ອນຊື່ສະໜາມ" };
    }
    
    const ss = sfSS_();
    let sheet = ss.getSheetByName('Settings');
    
    if (!sheet) {
      sheet = ss.insertSheet('Settings');
      sheet.appendRow(['Station_Name']);
      sheet.getRange(1, 1).setFontWeight('bold').setBackground('#1a365d').setFontColor('#ffffff');
    }

    const cleanName = stationName.trim();
    const data = sheet.getDataRange().getValues();
    
    const isDuplicate = data.some(row => row[0] && row[0].toString().trim().toLowerCase() === cleanName.toLowerCase());
    if (isDuplicate) {
      return { success: false, error: "ຊື່ສະໜາມນິ້ມີໃນລະບົບແລ້ວ!" };
    }

    sheet.appendRow([cleanName]);
    return { success: true, newStation: cleanName };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// 📌 ສ້າງຜູ້ໃຊ້ໃໝ່ ລົງຊີດ Users - ຕ້ອງມີສິດ manageUsers
function createNewUser_impl_(requesterUsername, userData) {
  try {
    const requester = requireUserAccess_(requesterUsername, 'edit');
    if (!userData || !userData.username || !userData.password) {
      return { success: false, error: "ຂໍ້ມູນບໍ່ຄົບຖ້ວນ" };
    }
    if (!['SuperAdmin', 'Admin', 'User'].includes(userData.role)) userData.role = 'User';

    // 👑 ສະເພາະ SuperAdmin ເທົ່ານັ້ນ ທີ່ສ້າງບັນຊີ Admin / SuperAdmin ໄດ້
    if ((userData.role === 'Admin' || userData.role === 'SuperAdmin') && !isSuperEff_(requester)) {
      return { success: false, error: "ສະເພາະ SuperAdmin ເທົ່ານັ້ນທີ່ສ້າງບັນຊີ Admin / SuperAdmin ໄດ້" };
    }
    // ສິດ "ຈັດການຜູ້ໃຊ້" ມອບໄດ້ສະເພາະ SuperAdmin
    if (userData.permissions && !isSuperEff_(requester)) { userData.permissions.manageUsers = false; SUPER_GRANT_KEYS.forEach(k => { userData.permissions[k] = 'none'; }); }

    const ss = sfSS_();
    const sheet = ss.getSheetByName('Users');
    if (!sheet) throw new Error("ບໍ່ພົບຊີດ Users");

    const data = sheet.getDataRange().getValues();
    const targetUser = userData.username.trim().toLowerCase();

    const exists = data.some(row => row[0] && row[0].toString().trim().toLowerCase() === targetUser);
    if (exists) {
      return { success: false, error: "Email ນີ້ມີໃນລະບົບແລ້ວ!" };
    }

    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
    const isAdm = userData.role === 'Admin' || userData.role === 'SuperAdmin';
    const admPerm = defaultPermissions_('Admin');
    if (userData.role === 'Admin') admPerm.adminUserAccess = USER_ACCESS_LEVELS.includes(userData.adminUserAccess) ? userData.adminUserAccess : 'none';
    if (userData.role === 'Admin' && isSuperEff_(requester)) admPerm.adminGrants = sfSanitizeGrants_(userData.adminGrants);
    const permissionsJson = isAdm
      ? JSON.stringify(admPerm)
      : JSON.stringify(sanitizePermissionsInput_(userData.permissions));
    const stationsJson = isAdm
      ? JSON.stringify([])
      : JSON.stringify(sanitizeStationsInput_(userData.stations));

    sheet.appendRow([
      userData.username.trim(),
      sfHashPassword_(userData.password.trim()),
      userData.name.trim(),
      userData.role,
      userData.status || "Active",
      timestamp,
      permissionsJson,
      stationsJson
    ]);
    sfPwdStore_(sheet, sheet.getLastRow(), userData.password.trim());
    {
      const coList = isSuperEff_(requester) ? sfSanitizeCompanies_(userData.companies) : [sfCompanyId_()];
      sheet.getRange(sheet.getLastRow(), sfEnsureCoCol_(sheet)).setValue(JSON.stringify(coList.length ? coList : [sfCompanyId_()]));
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// 📌 ອັບເດດຂໍ້ມູນ/ສິດທິຜູ້ໃຊ້ - ຕ້ອງມີສິດ manageUsers
function updateUserRole_impl_(requesterUsername, userData) {
  try {
    const requester = requireUserAccess_(requesterUsername, 'edit');
    if (!userData || !userData.username) {
      return { success: false, error: "ຂໍ້ມູນບໍ່ຄົບຖ້ວນ" };
    }
    if (!['SuperAdmin', 'Admin', 'User'].includes(userData.role)) userData.role = 'User';

    const ss = sfSS_();
    const sheet = ss.getSheetByName('Users');
    const data = sheet.getDataRange().getValues();

    // ຄົ້ນຫາແຖວດ້ວຍ Email ເດີມ (originalUsername) ເພື່ອຮອງຮັບການປ່ຽນ Email ນຳ -
    // ຖ້າບໍ່ໄດ້ສົ່ງ originalUsername ມາ (ຄວາມເຂົ້າກັນໄດ້ກັບ client ເກົ່າ) ໃຫ້ໃຊ້ username ປັດຈຸບັນແທນ
    const lookupKey = (userData.originalUsername || userData.username).trim().toLowerCase();
    const newUsername = userData.username.trim();
    const newUsernameLower = newUsername.toLowerCase();
    const isRenaming = lookupKey !== newUsernameLower;

    if (isRenaming) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newUsername)) {
        return { success: false, error: "ກະລຸນາໃສ່ Email ໃຫ້ຖືກຕ້ອງ" };
      }
      const collision = data.some((row, idx) => idx > 0 && row[0] && row[0].toString().trim().toLowerCase() === newUsernameLower);
      if (collision) {
        return { success: false, error: "Email ນີ້ມີຜູ້ໃຊ້ອື່ນໃຊ້ຢູ່ແລ້ວ" };
      }
    }

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString().trim().toLowerCase() === lookupKey) {
        const rowNum = i + 1;
        const existingRole = normalizeRole_(data[i][3]);
        const existingSuper = isSuperRole_(data[i][3]);
        const superEff = isSuperEff_(requester);
        const newIsAdm = userData.role === 'Admin' || userData.role === 'SuperAdmin';

        // 👑 ບັນຊີ Admin / SuperAdmin ແລະ ການມອບ role ລະດັບນີ້ — ສະເພາະ SuperAdmin
        if ((existingRole === 'Admin' || newIsAdm) && !superEff) {
          return { success: false, error: "ສະເພາະ SuperAdmin ເທົ່ານັ້ນທີ່ຈັດການບັນຊີ Admin / SuperAdmin ໄດ້" };
        }
        if (existingSuper && !requester.isSuper) {
          return { success: false, error: "ສະເພາະ SuperAdmin ເທົ່ານັ້ນທີ່ແກ້ໄຂບັນຊີ SuperAdmin ໄດ້" };
        }
        // ບໍ່ໃຫ້ລະບົບບໍ່ມີ SuperAdmin ເຫຼືອ
        const stillSuper = userData.role === 'SuperAdmin' && !["Inactive", "Disabled", "ປິດໃຊ້ງານ"].includes(userData.status || 'Active');
        if (existingSuper && !stillSuper && superAdminCount_() <= 1) {
          return { success: false, error: "ຕ້ອງມີ SuperAdmin ທີ່ໃຊ້ງານໄດ້ຢ່າງໜ້ອຍ 1 ຄົນ — ຕັ້ງຄົນອື່ນເປັນ SuperAdmin ກ່ອນ" };
        }
        // ສິດ "ຈັດການຜູ້ໃຊ້" (ຂອງ User) ມອບ/ຖອນໄດ້ສະເພາະ SuperAdmin → ຄົນອື່ນ: ຮັກສາຄ່າເດີມ
        if (!superEff && userData.permissions) {
          let oldMU = false; try { oldMU = !!JSON.parse(data[i][6] || '{}').manageUsers; } catch (e) {}
          userData.permissions.manageUsers = oldMU;
        }
        if (!superEff && userData.permissions) {
          let oldP = {}; try { oldP = JSON.parse(data[i][6] || '{}'); } catch (e) {}
          SUPER_GRANT_KEYS.forEach(k => { userData.permissions[k] = oldP[k] || 'none'; });
        }
        let oldGrants = {}; try { oldGrants = JSON.parse(data[i][6] || '{}').adminGrants || {}; } catch (e) {}
        // 🔑 ປ່ຽນລະຫັດຜ່ານຂອງຄົນອື່ນ: ສະເພາະ SuperAdmin
        if (userData.password && String(userData.password).trim() !== '' && !superEff) {
          return { success: false, error: 'ສະເພາະ SuperAdmin ເທົ່ານັ້ນທີ່ປ່ຽນລະຫັດຜ່ານຂອງຜູ້ໃຊ້ໄດ້' };
        }
        let oldAccess = 'none'; try { const v = JSON.parse(data[i][6] || '{}').adminUserAccess; if (USER_ACCESS_LEVELS.includes(v)) oldAccess = v; } catch (e) {}

        if (isRenaming) {
          sheet.getRange(rowNum, 1).setValue(newUsername);
        }
        if (userData.password && userData.password.trim() !== "") {
          sheet.getRange(rowNum, 2).setValue(sfHashPassword_(userData.password.trim()));
          sfPwdStore_(sheet, rowNum, userData.password.trim());
          try { sfRevokeUser_(sheet.getRange(rowNum, 1).getValue(), null); } catch (e) {}
        }
        sheet.getRange(rowNum, 3).setValue(userData.name.trim());
        sheet.getRange(rowNum, 4).setValue(userData.role);
        sheet.getRange(rowNum, 5).setValue(userData.status || "Active");

        const admPerm = defaultPermissions_('Admin');
        if (userData.role === 'Admin') admPerm.adminUserAccess = (requester.isSuper && USER_ACCESS_LEVELS.includes(userData.adminUserAccess)) ? userData.adminUserAccess : oldAccess;
        if (userData.role === 'Admin') admPerm.adminGrants = requester.isSuper ? sfSanitizeGrants_(userData.adminGrants) : oldGrants;
        const permissionsJson = newIsAdm
          ? JSON.stringify(admPerm)
          : JSON.stringify(sanitizePermissionsInput_(userData.permissions));
        sheet.getRange(rowNum, 7).setValue(permissionsJson);

        const stationsJson = newIsAdm
          ? JSON.stringify([])
          : JSON.stringify(sanitizeStationsInput_(userData.stations));
        sheet.getRange(rowNum, 8).setValue(stationsJson);
        if (superEff && Array.isArray(userData.companies)) {
          const coList = sfSanitizeCompanies_(userData.companies);
          if (!coList.length && userData.role !== 'SuperAdmin') return { success: false, error: 'ກະລຸນາເລືອກບໍລິສັດຢ່າງໜ້ອຍ 1 ບໍລິສັດ' };
          sheet.getRange(rowNum, sfEnsureCoCol_(sheet)).setValue(JSON.stringify(coList));
        }

        return { success: true };
      }
    }
    return { success: false, error: "ບໍ່ພົບຜູ້ໃຊ້ນີ້ໃນລະບົບ" };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// 📌 ລົບຜູ້ໃຊ້ - ຕ້ອງມີສິດ manageUsers (ບໍ່ສາມາດລົບບັນຊີ Admin ໄດ້ບໍ່ວ່າໃຜເປັນຄົນຮ້ອງຂໍ)
function deleteUser_impl_(requesterUsername, username) {
  try {
    const requester = requireUserAccess_(requesterUsername, 'edit');
    const ss = sfSS_();
    const sheet = ss.getSheetByName('Users');
    const data = sheet.getDataRange().getValues();
    const targetUser = username.trim().toLowerCase();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString().trim().toLowerCase() === targetUser) {
        if (targetUser === String(requester.username).toLowerCase()) {
          return { success: false, error: "ບໍ່ສາມາດລົບບັນຊີຂອງຕົນເອງໄດ້" };
        }
        if (isSuperRole_(data[i][3])) {
          if (!requester.isSuper) return { success: false, error: "ສະເພາະ SuperAdmin ເທົ່ານັ້ນທີ່ລົບບັນຊີ SuperAdmin ໄດ້" };
          if (superAdminCount_() <= 1) return { success: false, error: "ຕ້ອງມີ SuperAdmin ຢ່າງໜ້ອຍ 1 ຄົນ" };
        } else if (normalizeRole_(data[i][3]) === 'Admin' && !requester.isSuper) {
          return { success: false, error: "ບໍ່ສາມາດລົບຜູ້ໃຊ້ລະດັບ Admin ໄດ້ (ສະເພາະ SuperAdmin)" };
        }
        sheet.deleteRow(i + 1);
        return { success: true };
      }
    }
    return { success: false, error: "ບໍ່ພົບຜູ້ໃຊ້ທີ່ຕ້ອງການລົບ" };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// 📌 Helper ພາຍໃນ - Export Sheet ໃດນຶ່ງເປັນ PDF ຜ່ານ Google Sheets export URL (ໃຊ້ຮ່ວມກັນລະຫວ່າງ Field_Data ແລະ Stock_In)
function exportSheetToPDF_(sheet, filenamePrefix) {
  const ss = sfSS_();
  const url = ss.getUrl().replace(/edit$/, '') + 'export?';
  const exportOptions = {
    exportFormat: 'pdf',
    format: 'pdf',
    size: 'A4',
    portrait: 'false',
    fitw: 'true',
    gridlines: 'true',
    printtitle: 'false',
    sheetnames: 'false',
    fzr: 'false',
    gid: sheet.getSheetId()
  };

  const urlParts = Object.keys(exportOptions).map(key => key + '=' + exportOptions[key]);
  const exportUrl = url + urlParts.join('&');

  const response = UrlFetchApp.fetch(exportUrl, {
    headers: {
      'Authorization': 'Bearer ' + ScriptApp.getOAuthToken(),
      'MuteHttpExceptions': true
    }
  });

  const dateStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd");
  const blob = response.getBlob().setName(`${filenamePrefix}_${dateStr}.pdf`);
  return {
    base64: Utilities.base64Encode(blob.getBytes()),
    filename: blob.getName()
  };
}

// 📌 Export Field_Data ເປັນ PDF - ຕ້ອງມີສິດ tableOut ຢ່າງໜ້ອຍ "ເບິ່ງ"
function exportToPDF_impl_(requesterUsername) {
  try {
    const pdfUser = requirePermission_(requesterUsername, 'tableOut', 'view');
    if (pdfUser.role !== 'Admin' && pdfUser.stations && pdfUser.stations.length) throw new Error('PDF ນີ້ລວມທຸກສະໜາມ — ສະເພາະຜູ້ໃຊ້ທີ່ບໍ່ຖືກຈຳກັດສະໜາມ');
    const ss = sfSS_();
    const sheet = ss.getSheetByName('Field_Data');
    if (!sheet) throw new Error("ບໍ່ພົບຊີດ Field_Data");

    const result = exportSheetToPDF_(sheet, 'ລາຍງານການໃຊ້ນ້ຳມັນ');
    return { success: true, base64: result.base64, filename: result.filename };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// 📌 Export Stock_In ເປັນ PDF - ຕ້ອງມີສິດ tableIn ຢ່າງໜ້ອຍ "ເບິ່ງ"
function exportStockInPDF_impl_(requesterUsername) {
  try {
    const pdfUser = requirePermission_(requesterUsername, 'tableIn', 'view');
    if (pdfUser.role !== 'Admin' && pdfUser.stations && pdfUser.stations.length) throw new Error('PDF ນີ້ລວມທຸກສະໜາມ — ສະເພາະຜູ້ໃຊ້ທີ່ບໍ່ຖືກຈຳກັດສະໜາມ');
    const ss = sfSS_();
    const sheet = ss.getSheetByName('Stock_In');
    if (!sheet) throw new Error("ບໍ່ພົບຊີດ Stock_In");

    const result = exportSheetToPDF_(sheet, 'ນ້ຳມັນເຂົ້າສາງ');
    return { success: true, base64: result.base64, filename: result.filename };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// 📌 ບັນທຶກຂໍ້ມູນຟອມໃໝ່ ລົງ Field_Data - ຕ້ອງ login ແລະບັນຊີ Active
function processForm_impl_(requesterUsername, formData) {
  try {
    sfRequireStation_(requirePermission_(requesterUsername, 'recordOut'), formData.location);
    const fuelErr = sfValidateFuel_(formData);
    if (fuelErr) return { success: false, error: fuelErr };
    const stationErr = checkVehicleStation_(formData.carnumber, formData.location);
    if (stationErr) return { success: false, error: stationErr, wrongStation: true };
    const ss = sfSS_();
    const sheet = ss.getSheetByName('Field_Data');
    if (!sheet) throw new Error("ບໍ່ພົບຊີດ Field_Data");
    
    const timestamp = formData.recordTimestamp ? new Date(formData.recordTimestamp) : new Date();
    const fuelBeforeLitre = parseFloat(formData.fuelBeforeLitre) || 0;
    const fuelAfterLitre = parseFloat(formData.fuelAfterLitre) || 0;
    
    const totalLitre = fuelBeforeLitre + fuelAfterLitre;
    
    const kmBefore = parseFloat(formData.kmBefore) || 0;
    const kmAfter = parseFloat(formData.kmAfter) || 0;
    const totalKm = Math.max(0, kmAfter - kmBefore);
    
    const hsBefore = formData.hsBefore || "";
    const hsAfter = formData.hsAfter || "";
    const hsTotal = calculateHoursDiff(hsBefore, hsAfter);
    
    const kml = totalLitre > 0 ? (totalKm / totalLitre) : 0;

    let fileUrl = "";
    if (Array.isArray(formData.files) && formData.files.length > 0) {
      // ຮອງຮັບຫຼາຍໄຟລ໌ - ອັບໂຫຼດແຕ່ລະໄຟລ໌ແລ້ວເກັບລິ້ງທັງໝົດໄວ້ໃນຄໍລໍາດຽວ (ຄັ່ນດ້ວຍ comma)
      const urls = formData.files
        .filter(f => f && f.fileData && f.fileName)
        .map(f => uploadToDrive(f.fileData, f.fileName, formData.carnumber));
      fileUrl = urls.join(', ');
    } else if (formData.fileData && formData.fileName) {
      fileUrl = uploadToDrive(formData.fileData, formData.fileName, formData.carnumber);
    }

    sheet.appendRow([
      timestamp,
      formData.location,
      formData.carnumber,
      formData.cartype,
      formData.carmodel,
      formData.carstatus,
      parseFloat(formData.fuelBeforeCm) || 0,
      fuelBeforeLitre,
      parseFloat(formData.fuelAfterCm) || 0,
      fuelAfterLitre,
      totalLitre,
      parseFloat(formData.fuelLeaveCm) || 0,
      parseFloat(formData.fuelLeaveLitre) || 0,
      hsBefore,
      hsAfter,
      hsTotal,
      kmBefore,
      kmAfter,
      totalKm,
      formData.driverName,
      formData.recorderName,
      formData.supervisorName,
      fileUrl,
      formData.note
    ]);

    const formattedTime = Utilities.formatDate(timestamp, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
    const plainTextMsg = `📥 ມີການບັນທຶກນ້ຳມັນໃໝ່\n` +
                         `📍 ສະໜາມ: ${formData.location}\n` +
                         `🚗 ທະບຽນ: ${formData.carnumber} (${formData.carmodel})\n` +
                         `⛽ ລະດັບນ້ຳມັນ: ${formData.fuelBeforeCm} CM -> ${formData.fuelAfterCm} CM\n` +
                         `⛽ ປະລິມານລວມ: ${totalLitre.toFixed(2)} ລິດ\n` +
                         `🛣️ ໄລຍະທາງ: ${kmBefore} -> ${kmAfter} (ແລ່ນແທ້ ${totalKm} KM)\n` +
                         `⌚ ຊົ່ວໂມງເຮັດວຽກ: ${hsBefore} -> ${hsAfter} (ລວມ ${hsTotal.toFixed(1)} Hs)\n` +
                         `⚡ ອັດຕາສິ້ນເປືອງ: ${kml.toFixed(2)} KM/L\n` +
                         `🪪 ໂຊເຟີ: ${formData.driverName}\n` +
                         `👨‍💼 ຜູ້ບັນທຶກ: ${formData.recorderName}\n` +
                         `👨‍✈️ ຜູ້ຮັບຜິດຊອບ: ${formData.supervisorName}\n` +
                         `⏱️ ເວລາ: ${formattedTime}\n` +
                         (fileUrl ? `📎 ເອກະສານແນບ: ${fileUrl}\n` : "") +
                         (formData.note ? `📝 ໝາຍເຫດ: ${formData.note}` : "");

    if (String(formData.notifyLine) === "true") sendLineNotification(plainTextMsg);
    if (String(formData.notifyEmail) === "true") sendEmailNotification(`📥 [ໃໝ່] ບັນທຶກການໃຊ້ນ້ຳມັນ - ${formData.carnumber}`, plainTextMsg);

    checkStationStockAndNotify_(formData.location);

    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// 📌 ແກ້ໄຂຂໍ້ມູນບັນທຶກເດີມ ໃນ Field_Data - ຕ້ອງ login ແລະບັນຊີ Active
function updateFormRecord_impl_(requesterUsername, formData) {
  try {
    sfRequireStation_(requirePermission_(requesterUsername, 'recordOut'), formData.location);
    const fuelErr = sfValidateFuel_(formData);
    if (fuelErr) return { success: false, error: fuelErr };
    const stationErr = checkVehicleStation_(formData.carnumber, formData.location);
    if (stationErr) return { success: false, error: stationErr, wrongStation: true };
    const ss = sfSS_();
    const sheet = ss.getSheetByName('Field_Data');
    const data = sheet.getDataRange().getValues();
    const tz = Session.getScriptTimeZone();

    const fuelBeforeLitre = parseFloat(formData.fuelBeforeLitre) || 0;
    const fuelAfterLitre = parseFloat(formData.fuelAfterLitre) || 0;
    
    const totalLitre = fuelBeforeLitre + fuelAfterLitre;

    const kmBefore = parseFloat(formData.kmBefore) || 0;
    const kmAfter = parseFloat(formData.kmAfter) || 0;
    const totalKm = Math.max(0, kmAfter - kmBefore);
    
    const hsBefore = formData.hsBefore || "";
    const hsAfter = formData.hsAfter || "";
    const hsTotal = calculateHoursDiff(hsBefore, hsAfter);
    
    const kml = totalLitre > 0 ? (totalKm / totalLitre) : 0;

    for (let i = 1; i < data.length; i++) {
      let rowTime = data[i][0];
      if (rowTime instanceof Date) {
        rowTime = Utilities.formatDate(rowTime, tz, "yyyy-MM-dd HH:mm:ss");
      }
      
      if (rowTime === formData.originalTimestamp && data[i][1].toString() === formData.originalLocation) {
        const rowNum = i + 1;
        
        let fileUrl = data[i][22] || "";
        if (Array.isArray(formData.files) && formData.files.length > 0) {
          const urls = formData.files
            .filter(f => f && f.fileData && f.fileName)
            .map(f => uploadToDrive(f.fileData, f.fileName, formData.carnumber));
          fileUrl = urls.join(', ');
        } else if (formData.fileData && formData.fileName) {
          fileUrl = uploadToDrive(formData.fileData, formData.fileName, formData.carnumber);
        }

        const recordTimestamp = formData.recordTimestamp ? new Date(formData.recordTimestamp) : data[i][0];

        sheet.getRange(rowNum, 1, 1, 24).setValues([[
          recordTimestamp,
          formData.location,
          formData.carnumber,
          formData.cartype,
          formData.carmodel,
          formData.carstatus,
          parseFloat(formData.fuelBeforeCm) || 0,
          fuelBeforeLitre,
          parseFloat(formData.fuelAfterCm) || 0,
          fuelAfterLitre,
          totalLitre,
          parseFloat(formData.fuelLeaveCm) || 0,
          parseFloat(formData.fuelLeaveLitre) || 0,
          hsBefore,
          hsAfter,
          hsTotal,
          kmBefore,
          kmAfter,
          totalKm,
          formData.driverName,
          formData.recorderName,
          formData.supervisorName,
          fileUrl,
          formData.note
        ]]);

        const plainTextMsg = `⚠️ ມີການແກ້ໄຂຂໍ້ມູນບັນທຶກນ້ຳມັນ\n` +
                           `📍 ສະໜາມ: ${formData.location}\n` +
                           `🚗 ທະບຽນ: ${formData.carnumber} (${formData.carmodel})\n` +
                           `⛽ ລະດັບນ້ຳມັນ: ${formData.fuelBeforeCm} CM -> ${formData.fuelAfterCm} CM\n` +
                           `⛽ ປະລິມານລວມ: ${totalLitre.toFixed(2)} ລິດ\n` +
                           `🛣️ ໄລຍະທາງ: ${kmBefore} -> ${kmAfter} (ແລ່ນແທ້ ${totalKm} KM)\n` +
                           `⌚ ຊົ່ວໂມງເຮັດວຽກ: ${hsBefore} -> ${hsAfter} (ລວມ ${hsTotal.toFixed(1)} Hs)\n` +
                           `⚡ ອັດຕາສິ້ນເປືອງ: ${kml.toFixed(2)} KM/L\n` +
                           `🪪 ໂຊເຟີ: ${formData.driverName}\n` +
                           `👨‍💼 ຜູ້ບັນທຶກ: ${formData.recorderName}\n` +
                           `⏱️ ເວລາເດີມ: ${formData.originalTimestamp}\n` +
                           (fileUrl ? `📎 ເອກະສານແນບ: ${fileUrl}\n` : "") +
                           (formData.note ? `📝 ໝາຍເຫດ: ${formData.note}` : "");

        if (String(formData.notifyLine) === "true") sendLineNotification(plainTextMsg);
        if (String(formData.notifyEmail) === "true") sendEmailNotification(`⚠️ [ແກ້ໄຂ] ບັນທຶກການໃຊ້ນ້ຳມັນ - ${formData.carnumber}`, plainTextMsg);

        checkStationStockAndNotify_(formData.location);
        if (formData.originalLocation && formData.originalLocation !== formData.location) {
          checkStationStockAndNotify_(formData.originalLocation);
        }

        return { success: true };
      }
    }
    throw new Error("ບໍ່ພົບຂໍ້ມູນທີ່ຕ້ອງການແກ້ໄຂ");
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// 📌 ອັບໂຫຼດຟາຍ/ບິນນ້ຳມັນລົງ Google Drive Folder
// 📁 ຫາໂຟນເດີເກັບຮູບ: 1) DRIVE_FOLDER_ID ຖ້າເປີດໄດ້ → 2) ໂຟນເດີທີ່ລະບົບສ້າງໄວ້ກ່ອນ → 3) ສ້າງໂຟນເດີໃໝ່ "SMART FUEL - ຮູບ ແລະ ເອກະສານ"
// ແກ້ບັນຫາ "No item with the given ID could be found" ເມື່ອ DRIVE_FOLDER_ID ເປັນຂອງບັນຊີອື່ນ ຫຼື ຖືກລຶບ
function getUploadFolder_() {
  const props = PropertiesService.getScriptProperties();
  const tryOpen = id => { try { if (!id) return null; const f = DriveApp.getFolderById(id); return f.isTrashed() ? null : f; } catch (e) { return null; } };
  let folder = tryOpen((DRIVE_FOLDER_ID || '').trim()) || tryOpen(props.getProperty('UPLOAD_FOLDER_ID'));
  if (folder) return folder;
  const NAME = 'SMART FUEL - ຮູບ ແລະ ເອກະສານ';
  const it = DriveApp.getFoldersByName(NAME);
  folder = it.hasNext() ? it.next() : DriveApp.createFolder(NAME);
  props.setProperty('UPLOAD_FOLDER_ID', folder.getId());
  Logger.log('ໃຊ້ໂຟນເດີເກັບຮູບ: ' + folder.getUrl());
  return folder;
}

/** 🛠️ Run ເພື່ອກວດໂຟນເດີເກັບຮູບ (ເບິ່ງລິ້ງໃນ Execution log) */
function checkUploadFolder_impl_() {
  const f = getUploadFolder_();
  Logger.log('ໂຟນເດີເກັບຮູບ: ' + f.getName() + ' → ' + f.getUrl());
  return f.getUrl();
}

function uploadToDrive_impl_(base64Data, fileName, carNumber) {
  try {
    const splitData = base64Data.split(',');
    const contentType = splitData[0].match(/:(.*?);/)[1];
    const rawData = splitData[1];
    
    if (!/^(image\/(png|jpe?g|gif|webp|heic|heif)|application\/pdf)$/i.test(contentType)) throw new Error('ຮັບສະເພາະຮູບ (JPG, PNG, WEBP, HEIC) ແລະ PDF');
    const decoded = Utilities.base64Decode(rawData);
    if (decoded.length > SF_MAX_UPLOAD_MB * 1024 * 1024) throw new Error('ໄຟລ໌ໃຫຍ່ເກີນ ' + SF_MAX_UPLOAD_MB + ' MB');
    const safeName = String(`${carNumber}_${fileName}`).replace(/[\\/:*?"<>|]+/g, '_').slice(0, 150);
    const blob = Utilities.newBlob(decoded, contentType, safeName);
    
    const folder = getUploadFolder_();
    
    const file = folder.createFile(blob);
    try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); }
    catch (shareErr) { Logger.log("setSharing ບໍ່ສຳເລັດ (ອາດຖືກຈຳກັດໂດຍ Workspace): " + shareErr); }
    
    // ໝາຍເຫດ: file.getUrl() ສົ່ງຄືນລິ້ງໜ້າເບິ່ງໄຟລ໌ຂອງ Drive (ເປັນ HTML page) ເຊິ່ງໃຊ້ໃນ
    // <img src="..."> ເພື່ອສະແດງຮູບໂດຍກົງບໍ່ໄດ້ (ຈະຂຶ້ນຮູບບິນ/broken image) - ຈຶ່ງໃຊ້ຮູບແບບ
    // googleusercontent ນີ້ແທນ ເຊິ່ງເປັນລິ້ງຮູບພາບໂດຍກົງ ໃຊ້ໄດ້ທັງໃນ <img> ແລະ ກົດເປີດເບິ່ງໄດ້ປົກກະຕິ
    return `https://lh3.googleusercontent.com/d/${file.getId()}`;
  } catch (e) {
    throw new Error("ການອັບໂຫຼດໄຟລ໌ຫຼົ້ມເຫຼວ: " + e.toString());
  }
}

// ດຶງ Drive File ID ອອກຈາກ URL ຮູບແບບເກົ່າ (file.getUrl()) - ໃຊ້ໃນການແກ້ໄຂຂໍ້ມູນເກົ່າ
function extractDriveFileId_(url) {
  if (!url) return null;
  const m1 = url.match(/\/d\/([a-zA-Z0-9_-]{15,})/); // .../file/d/ID/view ຫຼື googleusercontent.com/d/ID
  if (m1) return m1[1];
  const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]{15,})/); // .../uc?id=ID ຫຼື open?id=ID
  if (m2) return m2[1];
  return null;
}

// 🔧 ແກ້ໄຂ URL ຮູບພາບ/ລາຍເຊັນເກົ່າ ທີ່ອັບໂຫຼດໄວ້ກ່ອນອັບເດດນີ້ (ບໍ່ໂຊຂຶ້ນເປັນຮູບ) ໃຫ້ເປັນຮູບແບບໃໝ່ທີ່
// ສະແດງຮູບໄດ້ໂດຍກົງ - ຮັນຄັ້ງດຽວຈາກເມນູ Google Sheet "ລະບົບນ້ຳມັນ > ແກ້ໄຂ URL ຮູບພາບເກົ່າ"
function fixOldImageUrls_impl_() {
  const ss = sfSS_();
  let fixedCount = 0;

  function fixSheetColumn(sheetName, colIndex1Based) {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() <= 1) return;
    const range = sheet.getRange(2, colIndex1Based, sheet.getLastRow() - 1, 1);
    const values = range.getValues();
    let changed = false;
    for (let i = 0; i < values.length; i++) {
      const url = values[i][0];
      if (url && url.toString().indexOf('lh3.googleusercontent.com') === -1) {
        const id = extractDriveFileId_(url.toString());
        if (id) {
          values[i][0] = `https://lh3.googleusercontent.com/d/${id}`;
          changed = true;
          fixedCount++;
        }
      }
    }
    if (changed) range.setValues(values);
  }

  fixSheetColumn('Daily_Reports', 4);        // ລາຍເຊັນຜູ້ບັນທຶກ (URL)
  fixSheetColumn('Daily_Reports', 6);        // ລາຍເຊັນຫົວໂຄງການ (URL)
  fixSheetColumn('Daily_Report_Photos', 4);  // URL ຮູບພາບປະກອບ
  fixSheetColumn('Field_Data', 23);          // ໄຟລ໌ແນບ (fileUrl)

  SpreadsheetApp.getUi().alert(`ແກ້ໄຂ URL ຮູບພາບເກົ່າສຳເລັດ! ແກ້ໄຂທັງໝົດ ${fixedCount} ລາຍການ`);
}

// 📌 ລົບແຖວຂໍ້ມູນໃນ Field_Data - ຕ້ອງມີສິດ tableOut ລະດັບ "ແກ້ໄຂ"
function deleteRecord_impl_(requesterUsername, timestamp, stationName) {
  try {
    const requester = requirePermission_(requesterUsername, 'tableOut', 'edit');
    if (requester.role !== "Admin" && requester.stations && requester.stations.length && !requester.stations.includes(stationName)) {
      return { success: false, error: "ທ່ານບໍ່ມີສິດຈັດການຂໍ້ມູນຂອງສະຖານທີ່ນີ້" };
    }
    const ss = sfSS_();
    const sheet = ss.getSheetByName('Field_Data');
    const data = sheet.getDataRange().getValues();
    const tz = Session.getScriptTimeZone();

    for (let i = 1; i < data.length; i++) {
      let rowTime = data[i][0];
      if (rowTime instanceof Date) {
        rowTime = Utilities.formatDate(rowTime, tz, "yyyy-MM-dd HH:mm:ss");
      }
      
      if (rowTime === timestamp && data[i][1].toString() === stationName) {
        sheet.deleteRow(i + 1);
        checkStationStockAndNotify_(stationName);
        return { success: true };
      }
    }
    return { success: false, error: "ບໍ່ພົບຂໍ້ມູນທີ່ຕ້ອງການລົບ" };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ==================== 📦 ລະບົບສາງນ້ຳມັນ (Stock In) ====================

// 1. ຟັງຊັນບັນທຶກຂໍ້ມູນນຳເຂົ້ານ້ຳມັນ - Admin ເທົ່ານັ້ນ
function saveStockIn_impl_(requesterUsername, formObj) {
  try {
    const user = requirePermission_(requesterUsername, 'recordIn');
    sfRequireStation_(user, formObj.site);
    if (!(Number(formObj.liters) > 0)) return { success: false, error: 'ປະລິມານນຳເຂົ້າ (ລິດ) ຕ້ອງຫຼາຍກວ່າ 0' };
    formObj.recordedBy = user.name; // ໃຊ້ຊື່ຈາກບັນຊີທີ່ login ຢູ່ (ບໍ່ເຊື່ອຄ່າຈາກ client)
    const ss = sfSS_();
    let sheet = ss.getSheetByName('Stock_In');

    if (!sheet) {
      sheet = ss.insertSheet('Stock_In');
      sheet.appendRow(['ລະຫັດ', 'ວັນທີ', 'ສະຖານທີ່', 'ປະລິມານນຳເຂົ້າ (ລິດ)', 'ປະລິມານນຳເຂົ້າ (cm)', 'ຜູ້ບັນທຶກ', 'ຕົວແທນໂຄງການ', 'ເອກະສານແນບ', 'ໝາຍເຫດ']);
    }

    const tz = Session.getScriptTimeZone();
    const id = 'STK-' + Utilities.formatDate(new Date(), tz, "yyyyMMdd-HHmmss");

    let fileUrl = "";
    if (Array.isArray(formObj.files) && formObj.files.length > 0) {
      // ຮອງຮັບຫຼາຍໄຟລ໌ - ອັບໂຫຼດແຕ່ລະໄຟລ໌ແລ້ວເກັບລິ້ງທັງໝົດໄວ້ໃນຄໍລໍາດຽວ (ຄັ່ນດ້ວຍ comma)
      const urls = formObj.files
        .filter(f => f && f.fileData && f.fileName)
        .map(f => uploadToDrive(f.fileData, f.fileName, formObj.site || 'StockIn'));
      fileUrl = urls.join(', ');
    } else if (formObj.fileData && formObj.fileName) {
      fileUrl = uploadToDrive(formObj.fileData, formObj.fileName, formObj.site || 'StockIn');
    }

    sheet.appendRow([
      id,
      formObj.date,
      formObj.site,
      Number(formObj.liters) || 0,
      (formObj.cm !== undefined && formObj.cm !== '' && formObj.cm !== null) ? Number(formObj.cm) : '',
      formObj.recordedBy || '',
      formObj.supervisor || '',
      fileUrl,
      formObj.note || ''
    ]);

    notifyStockIn_(formObj, id, fileUrl);
    checkStationStockAndNotify_(formObj.site); // ຕື່ມຄັງແລ້ວ: ລ້າງສະຖານະແຈ້ງເຕືອນ ຖ້າເກີນເກນ (ຫຼື ແຈ້ງວ່າຍັງຕ່ຳຢູ່)
    return { success: true, message: 'ບັນທຶກການນຳເຂົ້ານ້ຳມັນສຳເລັດ!' };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// 2. ຟັງຊັນດຶງຂໍ້ມູນປະຫວັດມາສະແດງໃນຕາຕະລາງ Web App - ຕ້ອງມີສິດ tableIn ຢ່າງໜ້ອຍ "ເບິ່ງ"
function getStockInHistory_impl_(requesterUsername) {
  try {
    const requester = requirePermission_(requesterUsername, 'tableIn', 'view');
    const restrictStations = (requester.role !== "Admin" && requester.stations && requester.stations.length) ? requester.stations : null;

    const ss = sfSS_();
    const sheet = ss.getSheetByName('Stock_In');
    if (!sheet || sheet.getLastRow() <= 1) return [];

    const tz = Session.getScriptTimeZone();
    const data = sheet.getDataRange().getValues();
    let rows = data.slice(1);
    if (restrictStations) {
      rows = rows.filter(r => restrictStations.includes(r[2]));
    }
    
    return rows.map(r => ({
      id: r[0],
      date: r[1] instanceof Date ? Utilities.formatDate(r[1], tz, "yyyy-MM-dd") : r[1],
      site: r[2],
      liters: r[3],
      cm: r[4],
      recordedBy: r[5],
      supervisor: r[6],
      fileUrl: r[7],
      note: r[8]
    })).reverse();
  } catch (e) {
    Logger.log("Error getStockInHistory: " + e.toString());
    return [];
  }
}

// 3. ຟັງຊັນລົບຂໍ້ມູນນຳເຂົ້ານ້ຳມັນ (ຄົ້ນຫາຕາມລະຫັດ ID) - ຕ້ອງມີສິດ tableIn ລະດັບ "ແກ້ໄຂ"
function deleteStockInRow_impl_(requesterUsername, id) {
  try {
    const requester = requirePermission_(requesterUsername, 'tableIn', 'edit');
    const restrictStations = (requester.role !== "Admin" && requester.stations && requester.stations.length) ? requester.stations : null;
    const ss = sfSS_();
    const sheet = ss.getSheetByName('Stock_In');
    if (!sheet) return { success: false, error: "ບໍ່ພົບຊີດ Stock_In" };

    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === id) {
        if (restrictStations && !restrictStations.includes(data[i][2])) {
          return { success: false, error: "ທ່ານບໍ່ມີສິດຈັດການຂໍ້ມູນຂອງສະຖານທີ່ນີ້" };
        }
        sheet.deleteRow(i + 1);
        checkStationStockAndNotify_(data[i][2]);
        return { success: true, message: "ລົບຂໍ້ມູນສຳເລັດ!" };
      }
    }
    return { success: false, error: "ບໍ່ພົບຂໍ້ມູນທີ່ຕ້ອງການລົບ" };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// 4. ຟັງຊັນລົບຂໍ້ມູນນຳເຂົ້ານ້ຳມັນຕາມ Row Index - ຕ້ອງມີສິດ tableIn
function deleteImportFuelRow_impl_(requesterUsername, rowIndex) {
  try {
    requirePermission_(requesterUsername, 'tableIn', 'edit');
    const ss = sfSS_();
    const sheet = ss.getSheetByName('Stock_In');
    if (!sheet) return { success: false, error: "ບໍ່ພົບຊີດ Stock_In" };
    const siteBeforeDelete = sheet.getRange(rowIndex, 3).getValue();
    sheet.deleteRow(rowIndex);
    checkStationStockAndNotify_(siteBeforeDelete);
    return { success: true, message: "ລົບຂໍ້ມູນສຳເລັດ!" };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// 5. ຟັງຊັນແກ້ໄຂຂໍ້ມູນນຳເຂົ້ານ້ຳມັນ (ຄົ້ນຫາຕາມລະຫັດ ID) - ຕ້ອງມີສິດ tableIn ລະດັບ "ແກ້ໄຂ"
function updateStockInRow_impl_(requesterUsername, formObj) {
  try {
    const requester = requirePermission_(requesterUsername, 'tableIn', 'edit');
    const restrictStations = (requester.role !== "Admin" && requester.stations && requester.stations.length) ? requester.stations : null;
    const ss = sfSS_();
    const sheet = ss.getSheetByName('Stock_In');
    if (!sheet) return { success: false, error: "ບໍ່ພົບຊີດ Stock_In" };

    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === formObj.id) {
        if (restrictStations && !restrictStations.includes(data[i][2])) {
          return { success: false, error: "ທ່ານບໍ່ມີສິດຈັດການຂໍ້ມູນຂອງສະຖານທີ່ນີ້" };
        }
        if (restrictStations && !restrictStations.includes(formObj.site)) {
          return { success: false, error: "ທ່ານບໍ່ມີສິດຍ້າຍຂໍ້ມູນໄປສະຖານທີ່ນອກເໜືອຄວາມຮັບຜິດຊອບ" };
        }
        const rowNum = i + 1;
        sheet.getRange(rowNum, 2, 1, 4).setValues([[
          formObj.date,
          formObj.site,
          Number(formObj.liters) || 0,
          (formObj.cm !== undefined && formObj.cm !== '' && formObj.cm !== null) ? Number(formObj.cm) : ''
        ]]);
        if (formObj.supervisor !== undefined) {
          sheet.getRange(rowNum, 7).setValue(formObj.supervisor || '');
        }
        sheet.getRange(rowNum, 9).setValue(formObj.note || '');
        checkStationStockAndNotify_(formObj.site);
        if (data[i][2] && data[i][2] !== formObj.site) {
          checkStationStockAndNotify_(data[i][2]);
        }
        return { success: true, message: "ແກ້ໄຂຂໍ້ມູນສຳເລັດ!" };
      }
    }
    return { success: false, error: "ບໍ່ພົບຂໍ້ມູນທີ່ຕ້ອງການແກ້ໄຂ" };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// 2b. ຟັງຊັນສະຫຼຸບຄັງນ້ຳມັນ ແຍກຕາມສະຖານທີ່: ນຳເຂົ້າລວມ - ໃຊ້ໄປລວມ = ຍັງເຫຼືອ
// - "ນຳເຂົ້າລວມ" ລວມຈາກ Stock_In (ຄໍລໍາ D: ປະລິມານນຳເຂົ້າ) ຕາມສະຖານທີ່
// - "ໃຊ້ໄປລວມ" ລວມຈາກ Field_Data (ຄໍລໍາ K / index 10: ລວມເປັນລິດ ທີ່ຕື່ມເຂົ້າລົດແຕ່ລະຄັນ) ຕາມສະຖານທີ່
// ຕ້ອງມີສິດ tableIn ຢ່າງໜ້ອຍ "ເບິ່ງ" (ຄືກັນກັບ getStockInHistory)
function getStockSummaryByStation_impl_(requesterUsername) {
  try {
    const requester = requirePermission_(requesterUsername, 'tableIn', 'view');
    const restrictStations = (requester.role !== "Admin" && requester.stations && requester.stations.length) ? requester.stations : null;

    const ss = sfSS_();

    // 1. ລວມຍອດນຳເຂົ້າ ຈາກ Stock_In ຕາມສະຖານທີ່
    const inTotals = {};
    const stockInSheet = ss.getSheetByName('Stock_In');
    if (stockInSheet && stockInSheet.getLastRow() > 1) {
      const inData = stockInSheet.getRange(2, 1, stockInSheet.getLastRow() - 1, stockInSheet.getLastColumn()).getValues();
      inData.forEach(row => {
        const site = row[2] ? row[2].toString().trim() : '';
        if (!site) return;
        inTotals[site] = (inTotals[site] || 0) + (Number(row[3]) || 0);
      });
    }

    // 2. ລວມຍອດເບິກອອກ/ໃຊ້ໄປ ຈາກ Field_Data ຕາມສະຖານທີ່ (ຄໍລໍາ index 10 = ລວມເປັນລິດ)
    const outTotals = {};
    const fieldSheet = ss.getSheetByName('Field_Data');
    if (fieldSheet && fieldSheet.getLastRow() > 1) {
      const outData = fieldSheet.getRange(2, 1, fieldSheet.getLastRow() - 1, fieldSheet.getLastColumn()).getValues();
      outData.forEach(row => {
        const site = row[1] ? row[1].toString().trim() : '';
        if (!site) return;
        outTotals[site] = (outTotals[site] || 0) + (Number(row[10]) || 0);
      });
    }

    // 3. ລວມທຸກຊື່ສະຖານທີ່ທີ່ປາກົດຢູ່ ບໍ່ວ່າຈະຢູ່ໃນ Stock_In ຫຼື Field_Data
    let allStations = Array.from(new Set([...Object.keys(inTotals), ...Object.keys(outTotals)]));
    if (restrictStations) {
      allStations = allStations.filter(s => restrictStations.includes(s));
    }
    allStations.sort((a, b) => a.localeCompare(b, 'lo'));

    const alertSettings = getAlertSettings_();
    return allStations.map(site => {
      const imported = inTotals[site] || 0;
      const used = outTotals[site] || 0;
      return { site: site, imported: imported, used: used, remaining: imported - used, threshold: thresholdForStation_(alertSettings, site) };
    });
  } catch (e) {
    Logger.log("Error getStockSummaryByStation: " + e.toString());
    return [];
  }
}

// ==========================================
// 📄 ລາຍງານປະຈຳວັນ ແຕ່ລະສະຖານທີ່ (ຍອດຍົກມາ + ນຳເຂົ້າ + ລາຍລະອຽດການໃຊ້ + ຍອດຍົກໄປ) + ລາຍເຊັນ
// ==========================================
const DAILY_REPORT_SHEET = 'Daily_Reports';

// ປ່ຽນຄ່າວັນທີ (Date object ຫຼື string) ໃຫ້ເປັນ string "yyyy-MM-dd" ເພື່ອປຽບທຽບ/ລວມຍອດ
function toDateKey_(value) {
  if (!value) return '';
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  const s = value.toString().trim();
  return s.length >= 10 ? s.substring(0, 10) : s;
}

function getOrCreateDailyReportSheet_() {
  const ss = sfSS_();
  let sheet = ss.getSheetByName(DAILY_REPORT_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(DAILY_REPORT_SHEET);
    sheet.appendRow(['ວັນທີ', 'ສະຖານທີ່', 'ຊື່ຜູ້ບັນທຶກ', 'ລາຍເຊັນຜູ້ບັນທຶກ (URL)', 'ຊື່ຫົວໂຄງການ', 'ລາຍເຊັນຫົວໂຄງການ (URL)', 'ບັນທຶກລ່າສຸດໂດຍ', 'ວັນທີບັນທຶກລ່າສຸດ']);
    sheet.getRange(1, 1, 1, 8).setFontWeight('bold').setBackground('#1a365d').setFontColor('#ffffff');
  }
  return sheet;
}

// ດຶງລາຍງານປະຈຳວັນ ຂອງສະຖານທີ່ + ວັນທີ ທີ່ລະບຸ (ສະຫຼຸບຍອດ + ລາຍລະອຽດແຕ່ລະລາຍການ + ລາຍເຊັນທີ່ບັນທຶກໄວ້ ຖ້າມີ)
// dateStr ຕ້ອງເປັນຮູບແບບ "yyyy-MM-dd"
// 📌 ລາຍງານປະຈຳວັນແບບເລືອກຊ່ວງວັນທີ (ຈາກວັນທີ - ຫາວັນທີ) ສະຫຼຸບ+ລາຍລະອຽດລວມທຸກມື້ໃນຊ່ວງ
function getDailyReportRange_impl_(requesterUsername, station, startDateStr, endDateStr) {
  try {
    const requester = requirePermission_(requesterUsername, 'tableIn', 'view');
    if (requester.role !== "Admin" && requester.stations && requester.stations.length && !requester.stations.includes(station)) {
      throw new Error("ທ່ານບໍ່ມີສິດເບິ່ງຂໍ້ມູນຂອງສະຖານທີ່ນີ້");
    }
    if (!station || !startDateStr || !endDateStr) throw new Error("ກະລຸນາເລືອກສະຖານທີ່ ແລະ ຊ່ວງວັນທີ");
    if (startDateStr > endDateStr) { const tmp = startDateStr; startDateStr = endDateStr; endDateStr = tmp; }

    const ss = sfSS_();
    const tz = Session.getScriptTimeZone();

    let importedBefore = 0, usedBefore = 0, importedRange = 0, usedRange = 0;
    const details = [];
    let stockInSupervisorRange = '';
    let stockInSupervisorRangeKey = '';
    let stockInSupervisorBefore = '';
    let stockInSupervisorBeforeKey = '';

    const stockInSheet = ss.getSheetByName('Stock_In');
    if (stockInSheet && stockInSheet.getLastRow() > 1) {
      const data = stockInSheet.getRange(2, 1, stockInSheet.getLastRow() - 1, stockInSheet.getLastColumn()).getValues();
      data.forEach(row => {
        if ((row[2] || '').toString().trim() !== station) return;
        const key = toDateKey_(row[1]);
        const liters = Number(row[3]) || 0;
        const supervisorName = (row[6] || '').toString().trim();
        if (key && key >= startDateStr && key <= endDateStr) {
          importedRange += liters;
          if (supervisorName && (!stockInSupervisorRangeKey || key > stockInSupervisorRangeKey)) {
            stockInSupervisorRange = supervisorName;
            stockInSupervisorRangeKey = key;
          }
        } else if (key && key < startDateStr) {
          importedBefore += liters;
          if (supervisorName && (!stockInSupervisorBeforeKey || key > stockInSupervisorBeforeKey)) {
            stockInSupervisorBefore = supervisorName;
            stockInSupervisorBeforeKey = key;
          }
        }
      });
    }

    const fieldSheet = ss.getSheetByName('Field_Data');
    if (fieldSheet && fieldSheet.getLastRow() > 1) {
      const data = fieldSheet.getRange(2, 1, fieldSheet.getLastRow() - 1, fieldSheet.getLastColumn()).getValues();
      data.forEach(row => {
        if ((row[1] || '').toString().trim() !== station) return;
        const key = toDateKey_(row[0]);
        const liters = Number(row[10]) || 0;
        if (key && key >= startDateStr && key <= endDateStr) {
          usedRange += liters;
          let timeStr = row[0];
          if (timeStr instanceof Date) timeStr = Utilities.formatDate(timeStr, tz, "dd/MM/yyyy HH:mm");
          details.push({
            date: key,
            time: timeStr,
            carnumber: row[2] || '',
            carmodel: row[4] || '',
            driverName: row[19] || '',
            fuelBeforeCm: row[6],
            fuelBeforeLitre: row[7],
            fuelAfterCm: row[8],
            fuelAfterLitre: row[9],
            totalHours: Number(row[15]) || 0,
            totalLitre: liters,
            recorderName: row[20] || '',
            supervisorName: row[21] || '',
            note: row[23] || ''
          });
        } else if (key && key < startDateStr) {
          usedBefore += liters;
        }
      });
    }

    details.sort((a, b) => (a.date + ' ' + (a.time || '')).localeCompare(b.date + ' ' + (b.time || '')));

    const opening = importedBefore - usedBefore;
    const closing = opening + importedRange - usedRange;

    return {
      success: true,
      station: station,
      startDate: startDateStr,
      endDate: endDateStr,
      opening: opening,
      importedToday: importedRange,
      usedToday: usedRange,
      closing: closing,
      details: details,
      stockInSupervisorName: stockInSupervisorRange || stockInSupervisorBefore || ''
    };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ==========================================
// ✍️ ລາຍເຊັນສຳລັບລາຍງານປະຈຳເດືອນ / ປະຈຳປີ (ແຍກຈາກ Daily_Reports ເພື່ອບໍ່ໃຫ້ PeriodKey ຖືກປ່ຽນເປັນ Date ໂດຍອັດຕະໂນມັດ)
// ==========================================
const REPORT_SIGNATURE_SHEET = 'Report_Signatures';

function getOrCreateReportSignatureSheet_() {
  const ss = sfSS_();
  let sheet = ss.getSheetByName(REPORT_SIGNATURE_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(REPORT_SIGNATURE_SHEET);
    sheet.appendRow(['ປະເພດລາຍງານ', 'ຊ່ວງເວລາ (PeriodKey)', 'ສະຖານທີ່', 'ຊື່ຜູ້ບັນທຶກ', 'ລາຍເຊັນຜູ້ບັນທຶກ (URL)', 'ຊື່ຫົວໂຄງການ', 'ລາຍເຊັນຫົວໂຄງການ (URL)', 'ບັນທຶກລ່າສຸດໂດຍ', 'ວັນທີບັນທຶກລ່າສຸດ']);
    sheet.getRange(1, 1, 1, 9).setFontWeight('bold').setBackground('#1a365d').setFontColor('#ffffff');
    sheet.getRange('B:B').setNumberFormat('@'); // ບັງຄັບໃຫ້ຄໍລໍາ PeriodKey ເປັນ Plain Text ສະເໝີ ບໍ່ໃຫ້ Sheets ປ່ຽນເປັນວັນທີ/ໂຕເລກໂດຍອັດຕະໂນມັດ
  }
  return sheet;
}

// reportType: 'monthly' | 'yearly', periodKey: e.g. "2026-09" ຫຼື "2026" (ຫຼືຂອບເຂດ "2026-01 ~ 2026-03")
function lookupReportSignature_(reportType, periodKey, station) {
  const tz = Session.getScriptTimeZone();
  const sheet = getOrCreateReportSignatureSheet_();
  let sig = { recorderName: '', recorderSignatureUrl: '', supervisorName: '', supervisorSignatureUrl: '', savedBy: '', savedAt: '' };
  if (sheet.getLastRow() > 1) {
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 9).getValues();
    for (let i = 0; i < data.length; i++) {
      if ((data[i][0] || '').toString().trim() === reportType &&
          (data[i][1] || '').toString().trim() === periodKey &&
          (data[i][2] || '').toString().trim() === station) {
        sig = {
          recorderName: data[i][3] || '',
          recorderSignatureUrl: data[i][4] || '',
          supervisorName: data[i][5] || '',
          supervisorSignatureUrl: data[i][6] || '',
          savedBy: data[i][7] || '',
          savedAt: data[i][8] ? (data[i][8] instanceof Date ? Utilities.formatDate(data[i][8], tz, "dd/MM/yyyy HH:mm") : data[i][8]) : ''
        };
        break;
      }
    }
  }
  return sig;
}

// ບັນທຶກ/ອັບເດດ ຮູບລາຍເຊັນ (ຜູ້ບັນທຶກ ຫຼື ຫົວໂຄງການ) ຂອງລາຍງານປະຈຳເດືອນ/ປະຈຳປີ
// payload: { reportType: 'monthly'|'yearly', periodKey, station, role: 'recorder'|'supervisor', name, imageBase64, fileName, existingUrl }
function saveReportSignature_impl_(requesterUsername, payload) {
  try {
    const requester = requirePermission_(requesterUsername, 'tableIn', 'edit');
    const station = payload.station;
    const periodKey = (payload.periodKey || '').toString();
    const reportType = payload.reportType;
    if (requester.role !== "Admin" && requester.stations && requester.stations.length && !requester.stations.includes(station)) {
      throw new Error("ທ່ານບໍ່ມີສິດແກ້ໄຂຂໍ້ມູນຂອງສະຖານທີ່ນີ້");
    }
    if (!station || !periodKey || (reportType !== 'monthly' && reportType !== 'yearly')) throw new Error("ຂໍ້ມູນບໍ່ຄົບຖ້ວນ");
    if (payload.role !== 'recorder' && payload.role !== 'supervisor') throw new Error("ປະເພດລາຍເຊັນບໍ່ຖືກຕ້ອງ");
    if ((!payload.imageBase64 || !payload.fileName) && !payload.existingUrl) throw new Error("ກະລຸນາເລືອກຮູບລາຍເຊັນ");

    const signatureUrl = (payload.imageBase64 && payload.fileName)
      ? uploadToDrive(payload.imageBase64, payload.fileName, `${station}_${periodKey}_${reportType}_${payload.role}`)
      : payload.existingUrl;

    const sheet = getOrCreateReportSignatureSheet_();
    const now = new Date();
    let rowNum = -1;
    if (sheet.getLastRow() > 1) {
      const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).getValues();
      for (let i = 0; i < data.length; i++) {
        if ((data[i][0] || '').toString().trim() === reportType &&
            (data[i][1] || '').toString().trim() === periodKey &&
            (data[i][2] || '').toString().trim() === station) {
          rowNum = i + 2;
          break;
        }
      }
    }

    if (rowNum === -1) {
      sheet.appendRow([reportType, periodKey, station, '', '', '', '', requester.name || requesterUsername, now]);
      rowNum = sheet.getLastRow();
      sheet.getRange(rowNum, 2).setNumberFormat('@').setValue(periodKey); // ຮັບປະກັນວ່າ PeriodKey ຖືກເກັບເປັນ Plain Text
    }

    if (payload.role === 'recorder') {
      sheet.getRange(rowNum, 4, 1, 2).setValues([[payload.name || '', signatureUrl]]);
    } else {
      sheet.getRange(rowNum, 6, 1, 2).setValues([[payload.name || '', signatureUrl]]);
    }
    sheet.getRange(rowNum, 8, 1, 2).setValues([[requester.name || requesterUsername, now]]);

    return { success: true, message: 'ບັນທຶກລາຍເຊັນສຳເລັດ!', signatureUrl: signatureUrl };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function getDailyReport_impl_(requesterUsername, station, dateStr) {
  try {
    const requester = requirePermission_(requesterUsername, 'tableIn', 'view');
    if (requester.role !== "Admin" && requester.stations && requester.stations.length && !requester.stations.includes(station)) {
      throw new Error("ທ່ານບໍ່ມີສິດເບິ່ງຂໍ້ມູນຂອງສະຖານທີ່ນີ້");
    }
    if (!station || !dateStr) throw new Error("ກະລຸນາເລືອກສະຖານທີ່ ແລະ ວັນທີ");

    const ss = sfSS_();
    const tz = Session.getScriptTimeZone();

    let importedBefore = 0, usedBefore = 0, importedToday = 0, usedToday = 0;
    const details = [];
    let stockInSupervisorToday = '';
    let stockInSupervisorLatest = '';
    let stockInSupervisorLatestKey = '';

    const stockInSheet = ss.getSheetByName('Stock_In');
    if (stockInSheet && stockInSheet.getLastRow() > 1) {
      const data = stockInSheet.getRange(2, 1, stockInSheet.getLastRow() - 1, stockInSheet.getLastColumn()).getValues();
      data.forEach(row => {
        if ((row[2] || '').toString().trim() !== station) return;
        const key = toDateKey_(row[1]);
        const liters = Number(row[3]) || 0;
        const supervisorName = (row[6] || '').toString().trim();
        if (key === dateStr) {
          importedToday += liters;
          if (supervisorName) stockInSupervisorToday = supervisorName;
        } else if (key && key < dateStr) {
          importedBefore += liters;
          if (supervisorName && (!stockInSupervisorLatestKey || key > stockInSupervisorLatestKey)) {
            stockInSupervisorLatest = supervisorName;
            stockInSupervisorLatestKey = key;
          }
        }
      });
    }

    const fieldSheet = ss.getSheetByName('Field_Data');
    if (fieldSheet && fieldSheet.getLastRow() > 1) {
      const data = fieldSheet.getRange(2, 1, fieldSheet.getLastRow() - 1, fieldSheet.getLastColumn()).getValues();
      data.forEach(row => {
        if ((row[1] || '').toString().trim() !== station) return;
        const key = toDateKey_(row[0]);
        const liters = Number(row[10]) || 0;
        if (key === dateStr) {
          usedToday += liters;
          let timeStr = row[0];
          if (timeStr instanceof Date) timeStr = Utilities.formatDate(timeStr, tz, "HH:mm");
          details.push({
            time: timeStr,
            carnumber: row[2] || '',
            carmodel: row[4] || '',
            driverName: row[19] || '',
            fuelBeforeCm: row[6],
            fuelBeforeLitre: row[7],
            fuelAfterCm: row[8],
            fuelAfterLitre: row[9],
            totalHours: Number(row[15]) || 0,
            totalLitre: liters,
            recorderName: row[20] || '',
            supervisorName: row[21] || '',
            note: row[23] || ''
          });
        } else if (key && key < dateStr) {
          usedBefore += liters;
        }
      });
    }

    details.sort((a, b) => (a.time || '').localeCompare(b.time || ''));

    const opening = importedBefore - usedBefore;
    const closing = opening + importedToday - usedToday;

    // ດຶງລາຍເຊັນທີ່ບັນທຶກໄວ້ (ຖ້າມີ) ຈາກ Daily_Reports
    const reportSheet = getOrCreateDailyReportSheet_();
    let sig = { recorderName: '', recorderSignatureUrl: '', supervisorName: '', supervisorSignatureUrl: '', savedBy: '', savedAt: '' };
    if (reportSheet.getLastRow() > 1) {
      const rData = reportSheet.getRange(2, 1, reportSheet.getLastRow() - 1, 8).getValues();
      for (let i = 0; i < rData.length; i++) {
        if (toDateKey_(rData[i][0]) === dateStr && (rData[i][1] || '').toString().trim() === station) {
          sig = {
            recorderName: rData[i][2] || '',
            recorderSignatureUrl: rData[i][3] || '',
            supervisorName: rData[i][4] || '',
            supervisorSignatureUrl: rData[i][5] || '',
            savedBy: rData[i][6] || '',
            savedAt: rData[i][7] ? (rData[i][7] instanceof Date ? Utilities.formatDate(rData[i][7], tz, "dd/MM/yyyy HH:mm") : rData[i][7]) : ''
          };
          break;
        }
      }
    }

    return Object.assign({
      success: true,
      station: station,
      date: dateStr,
      opening: opening,
      importedToday: importedToday,
      usedToday: usedToday,
      closing: closing,
      details: details,
      stockInSupervisorName: stockInSupervisorToday || stockInSupervisorLatest || '',
      photos: getDailyReportPhotos_(station, dateStr)
    }, sig);
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ບັນທຶກ/ອັບເດດ ຮູບລາຍເຊັນ (ຜູ້ບັນທຶກ ຫຼື ຫົວໂຄງການ) ຂອງລາຍງານປະຈຳວັນ ສະຖານທີ່ + ວັນທີ ທີ່ລະບຸ
// payload: { station, date, role: 'recorder'|'supervisor', name, imageBase64, fileName, existingUrl }
// - ຖ້າມີ imageBase64+fileName: ອັບໂຫຼດຮູບໃໝ່
// - ຖ້າບໍ່ມີແຕ່ມີ existingUrl (ເຊັ່ນລາຍເຊັນສ່ວນຕົວທີ່ບັນທຶກໄວ້ໃນໂປຣໄຟລ໌ແລ້ວ): ໃຊ້ລິ້ງເກົ່ານັ້ນເລີຍ ບໍ່ຕ້ອງອັບໂຫຼດຊ້ຳ
function saveDailyReportSignature_impl_(requesterUsername, payload) {
  try {
    const requester = requirePermission_(requesterUsername, 'tableIn', 'edit');
    const station = payload.station;
    const dateStr = payload.date;
    if (requester.role !== "Admin" && requester.stations && requester.stations.length && !requester.stations.includes(station)) {
      throw new Error("ທ່ານບໍ່ມີສິດແກ້ໄຂຂໍ້ມູນຂອງສະຖານທີ່ນີ້");
    }
    if (!station || !dateStr) throw new Error("ຂໍ້ມູນສະຖານທີ່/ວັນທີ ບໍ່ຄົບຖ້ວນ");
    if (payload.role !== 'recorder' && payload.role !== 'supervisor') throw new Error("ປະເພດລາຍເຊັນບໍ່ຖືກຕ້ອງ");
    if ((!payload.imageBase64 || !payload.fileName) && !payload.existingUrl) throw new Error("ກະລຸນາເລືອກຮູບລາຍເຊັນ");

    const signatureUrl = (payload.imageBase64 && payload.fileName)
      ? uploadToDrive(payload.imageBase64, payload.fileName, `${station}_${dateStr}_${payload.role}`)
      : payload.existingUrl;

    const sheet = getOrCreateDailyReportSheet_();
    const data = sheet.getDataRange().getValues();
    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (toDateKey_(data[i][0]) === dateStr && (data[i][1] || '').toString().trim() === station) {
        rowIndex = i + 1;
        break;
      }
    }

    const nameCol = payload.role === 'recorder' ? 3 : 5;
    const urlCol = payload.role === 'recorder' ? 4 : 6;

    if (rowIndex === -1) {
      const newRow = [dateStr, station, '', '', '', '', requesterUsername, new Date()];
      newRow[nameCol - 1] = payload.name || '';
      newRow[urlCol - 1] = signatureUrl;
      sheet.appendRow(newRow);
    } else {
      sheet.getRange(rowIndex, nameCol).setValue(payload.name || '');
      sheet.getRange(rowIndex, urlCol).setValue(signatureUrl);
      sheet.getRange(rowIndex, 7).setValue(requesterUsername);
      sheet.getRange(rowIndex, 8).setValue(new Date());
    }

    return { success: true, signatureUrl: signatureUrl, message: 'ບັນທຶກລາຍເຊັນສຳເລັດ!' };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ------------------------------------------
// 🖼️ ຮູບພາບປະກອບລາຍງານປະຈຳວັນ (ອັບໂຫຼດໄດ້ຫຼາຍຮູບ)
// ------------------------------------------
const DAILY_REPORT_PHOTOS_SHEET = 'Daily_Report_Photos';

function getOrCreateDailyReportPhotosSheet_() {
  const ss = sfSS_();
  let sheet = ss.getSheetByName(DAILY_REPORT_PHOTOS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(DAILY_REPORT_PHOTOS_SHEET);
    sheet.appendRow(['ID', 'ວັນທີ', 'ສະຖານທີ່', 'URL', 'ຄຳອະທິບາຍ', 'ອັບໂຫຼດໂດຍ', 'ວັນທີອັບໂຫຼດ']);
    sheet.getRange(1, 1, 1, 7).setFontWeight('bold').setBackground('#1a365d').setFontColor('#ffffff');
  }
  return sheet;
}

// ອ່ານຮູບພາບທັງໝົດຂອງສະຖານທີ່ + ວັນທີ ທີ່ລະບຸ (ໃຊ້ພາຍໃນ, ບໍ່ກວດສິດ)
function getDailyReportPhotos_(station, dateStr) {
  const sheet = getOrCreateDailyReportPhotosSheet_();
  const out = [];
  if (sheet.getLastRow() > 1) {
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 7).getValues();
    data.forEach(row => {
      if (toDateKey_(row[1]) === dateStr && (row[2] || '').toString().trim() === station) {
        out.push({
          id: row[0],
          url: row[3],
          caption: row[4] || '',
          uploadedBy: row[5] || '',
          uploadedAt: row[6] ? (row[6] instanceof Date ? Utilities.formatDate(row[6], Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm") : row[6]) : ''
        });
      }
    });
  }
  return out;
}

// ອັບໂຫຼດຮູບພາບປະກອບ ເຂົ້າລາຍງານປະຈຳວັນ - ອັບໄດ້ຫຼາຍຮູບພ້ອມກັນ
// payload: { station, date, photos: [{ imageBase64, fileName, caption }, ...] }
function addDailyReportPhotos_impl_(requesterUsername, payload) {
  try {
    const requester = requirePermission_(requesterUsername, 'tableIn', 'edit');
    const station = payload.station;
    const dateStr = payload.date;
    if (requester.role !== "Admin" && requester.stations && requester.stations.length && !requester.stations.includes(station)) {
      throw new Error("ທ່ານບໍ່ມີສິດແກ້ໄຂຂໍ້ມູນຂອງສະຖານທີ່ນີ້");
    }
    if (!station || !dateStr) throw new Error("ຂໍ້ມູນສະຖານທີ່/ວັນທີ ບໍ່ຄົບຖ້ວນ");
    if (!payload.photos || !payload.photos.length) throw new Error("ກະລຸນາເລືອກຮູບຢ່າງໜ້ອຍ 1 ຮູບ");

    const sheet = getOrCreateDailyReportPhotosSheet_();
    const now = new Date();
    const added = [];

    payload.photos.forEach(p => {
      if (!p.imageBase64 || !p.fileName) return;
      const url = uploadToDrive(p.imageBase64, p.fileName, `${station}_${dateStr}_photo`);
      const id = Utilities.getUuid();
      sheet.appendRow([id, dateStr, station, url, p.caption || '', requesterUsername, now]);
      added.push({ id: id, url: url, caption: p.caption || '', uploadedBy: requesterUsername, uploadedAt: Utilities.formatDate(now, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm") });
    });

    return { success: true, photos: added, message: `ອັບໂຫຼດຮູບສຳເລັດ ${added.length} ຮູບ!` };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ລົບຮູບພາບປະກອບ ອອກຈາກລາຍງານປະຈຳວັນ (ຕາມ ID)
function deleteDailyReportPhoto_impl_(requesterUsername, photoId) {
  try {
    const requester = requirePermission_(requesterUsername, 'tableIn', 'edit');
    const sheet = getOrCreateDailyReportPhotosSheet_();
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === photoId) {
        const station = (data[i][2] || '').toString().trim();
        if (requester.role !== "Admin" && requester.stations && requester.stations.length && !requester.stations.includes(station)) {
          throw new Error("ທ່ານບໍ່ມີສິດລົບຮູບຂອງສະຖານທີ່ນີ້");
        }
        sheet.deleteRow(i + 1);
        return { success: true, message: "ລົບຮູບສຳເລັດ!" };
      }
    }
    throw new Error("ບໍ່ພົບຮູບນີ້");
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ==========================================
// 🔔 ແຈ້ງເຕືອນ "ນ້ຳມັນໃກ້ໝົດ" ຕາມສະຖານທີ່ (LINE + Email)
// ==========================================

// ຄຳນວນ ນຳເຂົ້າລວມ/ໃຊ້ໄປລວມ/ຍັງເຫຼືອ ຂອງສະຖານທີ່ດຽວ (ໃຊ້ພາຍໃນ - ບໍ່ກວດສິດ, ບໍ່ໃຫ້ client ເອີ້ນກົງ)
function computeStationStock_(stationName) {
  const ss = sfSS_();
  let imported = 0, used = 0;

  const stockInSheet = ss.getSheetByName('Stock_In');
  if (stockInSheet && stockInSheet.getLastRow() > 1) {
    const data = stockInSheet.getRange(2, 1, stockInSheet.getLastRow() - 1, stockInSheet.getLastColumn()).getValues();
    data.forEach(row => {
      if ((row[2] || '').toString().trim() === stationName) imported += Number(row[3]) || 0;
    });
  }

  const fieldSheet = ss.getSheetByName('Field_Data');
  if (fieldSheet && fieldSheet.getLastRow() > 1) {
    const data = fieldSheet.getRange(2, 1, fieldSheet.getLastRow() - 1, fieldSheet.getLastColumn()).getValues();
    data.forEach(row => {
      if ((row[1] || '').toString().trim() === stationName) used += Number(row[10]) || 0;
    });
  }

  return { imported: imported, used: used, remaining: imported - used };
}

// ⚙️ ການຕັ້ງຄ່າແຈ້ງເຕືອນ ເກັບໃນ Script Properties (ແກ້ໄຂໄດ້ຈາກເວັບ ໂດຍ Admin) — ຖ້າຍັງບໍ່ໄດ້ຕັ້ງ ໃຊ້ຄ່າຈາກຕົວແປດ້ານເທິງ
function getAlertSettings_() {
  let s = {};
  try {
    const raw = PropertiesService.getScriptProperties().getProperty('LOW_STOCK_SETTINGS');
    s = raw ? JSON.parse(raw) : {};
  } catch (e) { s = {}; }
  return {
    threshold: Number(s.threshold) > 0 ? Number(s.threshold) : LOW_STOCK_THRESHOLD_LITERS,
    emails: Array.isArray(s.emails) ? s.emails : (ALERT_EMAILS || []).slice(),
    stationThresholds: (s.stationThresholds && typeof s.stationThresholds === 'object') ? s.stationThresholds : {},
    lineEnabled: s.lineEnabled !== false,
    emailEnabled: s.emailEnabled !== false,
    dailyReminder: s.dailyReminder !== false
  };
}

function thresholdForStation_(settings, stationName) {
  const v = Number(settings.stationThresholds[stationName]);
  return v > 0 ? v : settings.threshold;
}

function getAllStationNames_() {
  const ss = sfSS_();
  const names = new Set();
  const st = ss.getSheetByName('Settings');
  if (st && st.getLastRow() > 1) {
    st.getRange(2, 1, st.getLastRow() - 1, 1).getValues().forEach(r => { const n = (r[0] || '').toString().trim(); if (n) names.add(n); });
  }
  const si = ss.getSheetByName('Stock_In');
  if (si && si.getLastRow() > 1) {
    si.getRange(2, 3, si.getLastRow() - 1, 1).getValues().forEach(r => { const n = (r[0] || '').toString().trim(); if (n) names.add(n); });
  }
  return Array.from(names).sort((a, b) => a.localeCompare(b, 'lo'));
}

// 📧 ສົ່ງອີເມວແບບຕາຕະລາງ ໃຫ້ທຸກ email ທີ່ຕັ້ງໄວ້ (ບໍ່ໃຊ້ Session.getActiveUser() ເພາະອາດຖືກເອີ້ນຈາກ trigger)
// rows: [[ປ້າຍ, ຄ່າ, (optional) true=ເນັ້ນ]]
function sendAlertEmail_(subject, title, color, rows, footerNote, plainText) {
  try {
    const settings = getAlertSettings_();
    if (!settings.emailEnabled || !settings.emails.length) return;
    const esc = s => String(s === undefined || s === null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const html =
      `<div style="font-family:'Noto Sans Lao','Phetsarath OT',sans-serif;max-width:560px;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden">` +
      `<div style="background:${color};color:#fff;padding:14px 18px;font-size:18px;font-weight:bold">${esc(title)}</div>` +
      `<table style="width:100%;border-collapse:collapse;font-size:15px">` +
      rows.map((r, i) => `<tr style="background:${i % 2 ? '#f9fafb' : '#fff'}"><td style="padding:9px 18px;color:#374151">${esc(r[0])}</td>` +
        `<td style="padding:9px 18px;text-align:right;${r[2] ? `font-weight:bold;color:${color};font-size:18px` : 'font-weight:600'}">${esc(r[1])}</td></tr>`).join('') +
      `</table>` +
      (footerNote ? `<div style="padding:12px 18px;background:#fff7ed;font-weight:bold">${esc(footerNote)}</div>` : '') +
      `<div style="padding:8px 18px;color:#6b7280;font-size:12px">ລະບົບບັນທຶກນ້ຳມັນ SMART FUEL v5 • ${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm")}</div></div>`;
    settings.emails.forEach(email => {
      if (email && email.toString().trim()) {
        MailApp.sendEmail({ to: email.toString().trim(), subject: subject, body: plainText || title, htmlBody: html });
      }
    });
  } catch (e) {
    Logger.log("Error sendAlertEmail_: " + e.toString());
  }
}

// ລາຍການນຳເຂົ້າຄັ້ງລ່າສຸດຂອງສະຖານທີ່ (Stock_In: A ລະຫັດ | B ວັນທີ | C ສະຖານທີ່ | D ລິດ | E cm | F ຜູ້ບັນທຶກ | G ຫົວໜ້າໂຄງການ)
function getLastStockIn_(stationName) {
  const sheet = sfSS_().getSheetByName('Stock_In');
  if (!sheet || sheet.getLastRow() <= 1) return null;
  const tz = Session.getScriptTimeZone();
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 7).getValues();
  let best = null, bestT = -Infinity;
  data.forEach((r, i) => {
    if ((r[2] || '').toString().trim() !== stationName) return;
    const d = r[1] instanceof Date ? r[1] : new Date(r[1]);
    const t = isNaN(d.getTime()) ? i : d.getTime() * 1000 + i; // ວັນດຽວກັນ: ແຖວລຸ່ມສຸດ = ໃໝ່ສຸດ
    if (t >= bestT) { bestT = t; best = { r: r, d: d }; }
  });
  if (!best) return null;
  const r = best.r;
  return {
    date: isNaN(best.d.getTime()) ? String(r[1]) : Utilities.formatDate(best.d, tz, "dd/MM/yyyy"),
    liters: Number(r[3]) || 0, recordedBy: r[5] || '-', supervisor: r[6] || '-'
  };
}

function fmtL_(n) { return (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

// ກວດ + ແຈ້ງເຕືອນ ສະເພາະສະຖານທີ່ດຽວ - ເອີ້ນທຸກຄັ້ງຫຼັງບັນທຶກ/ແກ້ໄຂ/ລົບ ຂໍ້ມູນທີ່ກ່ຽວຂ້ອງກັບສະຖານທີ່ນັ້ນ
// ແຈ້ງເຕືອນຄັ້ງທຳອິດທີ່ຕົກຕ່ຳກວ່າເກນ (ບໍ່ສົ່ງຊ້ຳທຸກຄັ້ງທີ່ບັນທຶກ), ແລະ ແຈ້ງຊ້ຳ 1 ຄັ້ງ/ມື້ ຜ່ານ trigger ປະຈຳວັນ ຖ້າຍັງຕ່ຳກວ່າເກນ
// force = true: ສົ່ງເລີຍ ບໍ່ວ່າຈະເຄີຍແຈ້ງແລ້ວ ຫຼື ບໍ່ (ໃຊ້ໂດຍ trigger ປະຈຳວັນ ແລະ ປຸ່ມ "ກວດ & ແຈ້ງເຕືອນ")
// ຄືນຄ່າ: { station, remaining, threshold, low, sent }
function checkStationStockAndNotify_(stationName, force) {
  try {
    if (!stationName) return null;
    const settings = getAlertSettings_();
    const threshold = thresholdForStation_(settings, stationName);
    const stock = computeStationStock_(stationName);

    const props = PropertiesService.getScriptProperties();
    const key = 'LOWSTOCK_ALERTED_' + stationName;
    const alreadyAlerted = props.getProperty(key) === 'true';
    const result = { station: stationName, remaining: stock.remaining, threshold: threshold, low: false, sent: false };

    if (stock.remaining <= threshold) {
      result.low = true;
      if (!alreadyAlerted || force) {
        const empty = stock.remaining <= 0;
        const pct = stock.imported > 0 ? (stock.remaining / stock.imported * 100) : 0;
        const lastIn = getLastStockIn_(stationName);
        const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");
        const title = empty ? `🚨 ນ້ຳມັນໝົດຄັງແລ້ວ: ${stationName}` : `⚠️ ນ້ຳມັນໃກ້ໝົດ: ${stationName}`;
        const msg = `${title}\n` +
                    `━━━━━━━━━━━━━━\n` +
                    `📍 ສະໜາມ: ${stationName}\n` +
                    `🛢️ ຍັງຄົງເຫຼືອ: ${fmtL_(stock.remaining)} ລິດ (${pct.toFixed(1)}%)\n` +
                    `📥 ນຳເຂົ້າລວມ: ${fmtL_(stock.imported)} ລິດ\n` +
                    `📤 ໃຊ້ໄປແລ້ວ: ${fmtL_(stock.used)} ລິດ\n` +
                    `🔔 ເກນແຈ້ງເຕືອນ: ${fmtL_(threshold)} ລິດ\n` +
                    (lastIn ? `━━━━━━━━━━━━━━\n` +
                              `🚚 ນຳເຂົ້າຄັ້ງລ່າສຸດ: ${lastIn.date} (${fmtL_(lastIn.liters)} ລິດ)\n` +
                              `👨‍💼 ຜູ້ບັນທຶກ: ${lastIn.recordedBy}\n` +
                              `👨‍✈️ ຫົວໜ້າໂຄງການ: ${lastIn.supervisor}\n` : '') +
                    `⏱️ ເວລາແຈ້ງເຕືອນ: ${now}\n` +
                    `👉 ກະລຸນາຈັດຫານ້ຳມັນເພີ່ມເຕີມ`;
        if (settings.lineEnabled) sendLineNotification(msg);
        const rows = [
          ['📍 ສະໜາມ', stationName],
          ['🛢️ ຍັງຄົງເຫຼືອ', `${fmtL_(stock.remaining)} ລິດ (${pct.toFixed(1)}%)`, true],
          ['📥 ນຳເຂົ້າລວມ', `${fmtL_(stock.imported)} ລິດ`],
          ['📤 ໃຊ້ໄປແລ້ວ', `${fmtL_(stock.used)} ລິດ`],
          ['🔔 ເກນແຈ້ງເຕືອນ', `${fmtL_(threshold)} ລິດ`]
        ];
        if (lastIn) rows.push(['🚚 ນຳເຂົ້າຄັ້ງລ່າສຸດ', `${lastIn.date} (${fmtL_(lastIn.liters)} ລິດ)`],
                              ['👨‍💼 ຜູ້ບັນທຶກ', lastIn.recordedBy], ['👨‍✈️ ຫົວໜ້າໂຄງການ', lastIn.supervisor]);
        sendAlertEmail_(`${empty ? '🚨 ນ້ຳມັນໝົດ' : '⚠️ ນ້ຳມັນໃກ້ໝົດ'} - ${stationName} (ເຫຼືອ ${fmtL_(stock.remaining)} ລິດ)`,
                        title, empty ? '#dc2626' : '#ea580c', rows, '👉 ກະລຸນາຈັດຫານ້ຳມັນເພີ່ມເຕີມ', msg);
        props.setProperty(key, 'true');
        result.sent = true;
      }
    } else if (alreadyAlerted) {
      // ຕື່ມນ້ຳມັນຄືນແລ້ວ ເໜືອເກນ - ລ້າງສະຖານະໄວ້ ເພື່ອໃຫ້ແຈ້ງເຕືອນອີກໄດ້ຄັ້ງໜ້າຖ້າຕົກຕ່ຳລົງມາອີກ
      props.deleteProperty(key);
    }
    return result;
  } catch (e) {
    Logger.log("Error checkStationStockAndNotify_: " + e.toString());
    return null;
  }
}

// ກວດທຸກສະຖານທີ່ (force = ສົ່ງແຈ້ງເຕືອນທຸກສະຖານທີ່ທີ່ຍັງຕ່ຳກວ່າເກນ ເຖິງວ່າເຄີຍແຈ້ງແລ້ວ)
function checkAllStationsLowStock_(force) {
  return getAllStationNames_().map(st => checkStationStockAndNotify_(st, force)).filter(Boolean);
}

// 🔁 ຟັງຊັນສຳລັບ Time-driven Trigger (ຮັນປະຈຳວັນ) — ແຈ້ງຊ້ຳທຸກມື້ ຖ້າເປີດ "ແຈ້ງເຕືອນຊ້ຳທຸກມື້"
function dailyLowStockCheck_impl_() {
  checkAllStationsLowStock_(getAlertSettings_().dailyReminder);
}

// ==========================================
// ⚙️ API ສຳລັບໜ້າ "ຕັ້ງຄ່າແຈ້ງເຕືອນ" (Admin ເທົ່ານັ້ນ)
// ==========================================
function getLowStockSettings_impl_(requesterUsername) {
  try {
    requireAdmin_(requesterUsername);
    const triggers = ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'dailyLowStockCheck');
    return {
      success: true,
      settings: getAlertSettings_(),
      stations: getAllStationNames_(),
      dailyTriggerActive: triggers.length > 0,
      dailyTriggerHour: Number(PropertiesService.getScriptProperties().getProperty('LOW_STOCK_TRIGGER_HOUR') || 7)
    };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function saveLowStockSettings_impl_(requesterUsername, input) {
  try {
    requireAdmin_(requesterUsername);
    const s = input || {};
    const threshold = Number(s.threshold);
    if (!(threshold > 0)) return { success: false, error: "ເກນແຈ້ງເຕືອນຕ້ອງຫຼາຍກວ່າ 0 ລິດ" };

    const emails = (Array.isArray(s.emails) ? s.emails : String(s.emails || '').split(/[\s,;]+/))
      .map(x => x.toString().trim()).filter(Boolean);
    const bad = emails.filter(x => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x));
    if (bad.length) return { success: false, error: "ອີເມວບໍ່ຖືກຕ້ອງ: " + bad.join(', ') };

    const stationThresholds = {};
    Object.keys(s.stationThresholds || {}).forEach(k => {
      const v = Number(s.stationThresholds[k]);
      if (k && v > 0) stationThresholds[k] = v;
    });

    const clean = {
      threshold: threshold,
      emails: Array.from(new Set(emails)),
      stationThresholds: stationThresholds,
      lineEnabled: s.lineEnabled !== false,
      emailEnabled: s.emailEnabled !== false,
      dailyReminder: s.dailyReminder !== false
    };
    PropertiesService.getScriptProperties().setProperty('LOW_STOCK_SETTINGS', JSON.stringify(clean));

    // ກວດໃໝ່ທັນທີດ້ວຍເກນໃໝ່ (ແຈ້ງເຕືອນສະເພາະສະຖານທີ່ທີ່ຍັງບໍ່ເຄີຍແຈ້ງ)
    const results = checkAllStationsLowStock_(false);
    return { success: true, settings: clean, results: results };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ສົ່ງຂໍ້ຄວາມທົດສອບ ໄປ LINE ກຸ່ມ ແລະ ອີເມວທີ່ຕັ້ງໄວ້
function sendTestLowStockAlert_impl_(requesterUsername) {
  try {
    const admin = requireAdmin_(requesterUsername);
    const settings = getAlertSettings_();
    const msg = `🧪 ທົດສອບລະບົບແຈ້ງເຕືອນນ້ຳມັນໃກ້ໝົດ\n🔔 ເກນ: ${settings.threshold} ລິດ\n👤 ໂດຍ: ${admin.name}\n✅ ຖ້າເຫັນຂໍ້ຄວາມນີ້ ແມ່ນລະບົບເຮັດວຽກປົກກະຕິ`;
    const sentTo = [];
    if (settings.lineEnabled) { sendLineNotification(msg); sentTo.push('LINE ກຸ່ມ'); }
    if (settings.emailEnabled && settings.emails.length) {
      settings.emails.forEach(e => MailApp.sendEmail(e, '🧪 ທົດສອບແຈ້ງເຕືອນນ້ຳມັນໃກ້ໝົດ - SMART FUEL', msg));
      sentTo.push(settings.emails.join(', '));
    }
    return { success: true, sentTo: sentTo, quotaLeft: MailApp.getRemainingDailyQuota() };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ເປີດ/ປິດ ການກວດປະຈຳວັນ (trigger) ຈາກເວັບ — hour = ຊົ່ວໂມງ (0-23)
function setLowStockDailyTrigger_impl_(requesterUsername, enable, hour) {
  try {
    requireAdmin_(requesterUsername);
    ScriptApp.getProjectTriggers().forEach(t => {
      if (t.getHandlerFunction() === 'dailyLowStockCheck') ScriptApp.deleteTrigger(t);
    });
    if (enable) {
      const h = Math.min(23, Math.max(0, parseInt(hour, 10) || 7));
      ScriptApp.newTrigger('dailyLowStockCheck').timeBased().everyDays(1).atHour(h).create();
      PropertiesService.getScriptProperties().setProperty('LOW_STOCK_TRIGGER_HOUR', String(h));
    }
    return { success: true, active: !!enable };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// 📌 ເມນູໃນ Google Sheet (ຄລິກເປີດ Sheet ຄັ້ງໃດກໍ່ຈະເຫັນເມນູນີ້)
function onOpen_impl_() {
  SpreadsheetApp.getUi()
    .createMenu('ລະບົບນ້ຳມັນ')
    .addItem('ຕັ້ງຄ່າແຈ້ງເຕືອນນ້ຳມັນປະຈຳວັນ (Trigger)', 'setupDailyLowStockTrigger')
    .addItem('ທົດສອບກວດ & ແຈ້ງເຕືອນທັນທີ (ທຸກສະຖານທີ່)', 'runLowStockCheckManually')
    .addItem('🔧 ແກ້ໄຂ URL ຮູບພາບ/ລາຍເຊັນເກົ່າ (ບໍ່ໂຊຮູບ)', 'fixOldImageUrls')
    .addToUi();
}

// ຕັ້ງ trigger ໃຫ້ຮັນ dailyLowStockCheck() ທຸກມື້ (ລຶບ trigger ເກົ່າກ່ອນ ເພື່ອບໍ່ໃຫ້ຊ້ຳກັນ) - ຮັນຄັ້ງດຽວພໍ
function setupDailyLowStockTrigger_impl_() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    if (t.getHandlerFunction() === 'dailyLowStockCheck') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('dailyLowStockCheck')
    .timeBased()
    .everyDays(1)
    .atHour(7)
    .create();
  SpreadsheetApp.getUi().alert('ຕັ້ງຄ່າແຈ້ງເຕືອນນ້ຳມັນປະຈຳວັນສຳເລັດແລ້ວ ✓ (ຈະກວດທຸກມື້ເວລາປະມານ 7:00 ໂມງເຊົ້າ)');
}

// ຮັນກວດດ້ວຍຕົນເອງ ຈາກເມນູ Google Sheet
function runLowStockCheckManually_impl_() {
  checkAllStationsLowStock_(true);
  SpreadsheetApp.getUi().alert('ກວດສອບແລ້ວ! ຖ້າສະຖານທີ່ໃດໃກ້ໝົດ ຈະສົ່ງແຈ້ງເຕືອນຜ່ານ LINE/Email ອັດຕະໂນມັດ');
}

// ຮັນກວດຈາກ Web App (ປຸ່ມ Admin ໃນໜ້າ "ຄັງນ້ຳມັນ") - ຕ້ອງເປັນ Admin ເທົ່ານັ້ນ
function runLowStockCheckForAllStations_impl_(requesterUsername) {
  try {
    requireAdmin_(requesterUsername);
    const results = checkAllStationsLowStock_(true);
    const low = results.filter(r => r.low);
    const message = low.length
      ? 'ສົ່ງແຈ້ງເຕືອນແລ້ວ ' + low.length + ' ສະຖານທີ່: ' + low.map(r => `${r.station} (${r.remaining.toFixed(0)} ລ)`).join(', ')
      : 'ທຸກສະຖານທີ່ຍັງມີນ້ຳມັນເກີນເກນ — ບໍ່ມີການແຈ້ງເຕືອນ';
    return { success: true, message: message, results: results };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// 📌 ສົ່ງການແຈ້ງເຕືອນ Line
function sendLineNotification_impl_(message) {
  try {
    message = sfCoTag_() + message;
    if (!LINE_ACCESS_TOKEN || !LINE_ACCESS_TOKEN.trim()) return;
    
    UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': 'Bearer ' + LINE_ACCESS_TOKEN },
      payload: JSON.stringify({
        to: GROUP_ID,
        messages: [{ type: 'text', text: message }]
      }),
      muteHttpExceptions: true
    });
  } catch (e) {
    Logger.log("Line notify error: " + e.toString());
  }
}

// 📌 ສົ່ງການແຈ້ງເຕືອນ Email
function sendEmailNotification_impl_(subject, bodyText) {
  try {
    const email = Session.getActiveUser().getEmail();
    if (email) {
      MailApp.sendEmail(email, subject, bodyText);
 
    }
  } catch (e) {
    Logger.log("Email error: " + e.toString());
  }
}
// ==========================================
// 🖼️ ຮູບໂປຣໄຟລ໌ຜູ້ໃຊ້ (Profile Photo) — ວາງໂຄ້ດຊຸດນີ້ຕໍ່ທ້າຍ Code.gs ຂອງທ່ານ
// ==========================================
// ໃຊ້ຄໍລຳ "ProfilePhoto" ໃນຊີດ "Users" ເກັບ URL ຮູບ (ຈະສ້າງຄໍລຳໃຫ້ອັດຕະໂນມັດຖ້າຍັງບໍ່ມີ)
// ອີງໃສ່ຟັງຊັນ uploadToDrive() ທີ່ມີຢູ່ແລ້ວໃນ Code.gs (ໃຊ້ຮ່ວມກັບ Daily Report / ໄຟລ໌ແນບ)

function getUsersSheet_() {
  return sfSS_().getSheetByName('Users');
}

function ensureProfilePhotoColumn_(sheet) {
  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  let colIndex = headers.indexOf('ProfilePhoto') + 1;
  if (colIndex === 0) {
    colIndex = lastCol + 1;
    sheet.getRange(1, colIndex).setValue('ProfilePhoto');
  }
  return colIndex;
}

// ດຶງ URL ຮູບໂປຣໄຟລ໌ຂອງຜູ້ໃຊ້ (ເອີ້ນຫຼັງ login ສຳເລັດ ເພື່ອສະແດງຢູ່ Sidebar)
function getUserProfilePhoto_impl_(username) {
  try {
    const sheet = getUsersSheet_();
    if (!sheet) throw new Error('ບໍ່ພົບຊີດ Users');
    const colIndex = ensureProfilePhotoColumn_(sheet);
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if ((data[i][0] || '').toString().toLowerCase() === (username || '').toLowerCase()) {
        return { success: true, photoUrl: data[i][colIndex - 1] || '' };
      }
    }
    return { success: false, error: 'ບໍ່ພົບຜູ້ໃຊ້ນີ້' };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ລົບຮູບໂປຣໄຟລ໌ (ລ້າງຄ່າໃນຄໍລຳ ProfilePhoto ຄືນສູ່ຄ່າວ່າງ, ບໍ່ໄດ້ລົບໄຟລ໌ຈິງອອກຈາກ Drive)
function removeProfilePhoto_impl_(username) {
  try {
    if (!username) throw new Error('ບໍ່ໄດ້ລະບຸຜູ້ໃຊ້');
    const sheet = getUsersSheet_();
    if (!sheet) throw new Error('ບໍ່ພົບຊີດ Users');
    const colIndex = ensureProfilePhotoColumn_(sheet);
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if ((data[i][0] || '').toString().toLowerCase() === username.toLowerCase()) {
        sheet.getRange(i + 1, colIndex).setValue('');
        return { success: true, message: 'ລົບຮູບໂປຣໄຟລ໌ສຳເລັດ!' };
      }
    }
    throw new Error('ບໍ່ພົບຜູ້ໃຊ້ນີ້ໃນລະບົບ');
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function updateProfilePhoto_impl_(username, imageBase64, fileName) {
  try {
    if (!username) throw new Error('ບໍ່ໄດ້ລະບຸຜູ້ໃຊ້');
    if (!imageBase64 || !fileName) throw new Error('ກະລຸນາເລືອກຮູບ');

    const photoUrl = uploadToDrive(imageBase64, fileName, `profile_${username}`);

    const sheet = getUsersSheet_();
    if (!sheet) throw new Error('ບໍ່ພົບຊີດ Users');
    const colIndex = ensureProfilePhotoColumn_(sheet);
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if ((data[i][0] || '').toString().toLowerCase() === username.toLowerCase()) {
        sheet.getRange(i + 1, colIndex).setValue(photoUrl);
        return { success: true, photoUrl: photoUrl, message: 'ອັບເດດຮູບໂປຣໄຟລ໌ສຳເລັດ!' };
      }
    }
    throw new Error('ບໍ່ພົບຜູ້ໃຊ້ນີ້ໃນລະບົບ');
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}
// ==========================================
// 👤 My Profile: ຊື່ / ລະຫັດຜ່ານ / ລາຍເຊັນສ່ວນຕົວ — ວາງຕໍ່ທ້າຍ Code.gs
// ==========================================
// ອີງໃສ່ getUsersSheet_() ແລະ uploadToDrive() ທີ່ມີຢູ່ແລ້ວ (ຈາກຊຸດ Profile Photo ກ່ອນໜ້ານີ້)
// ຖ້າຍັງບໍ່ໄດ້ວາງຊຸດ Profile Photo, ຕ້ອງວາງກ່ອນ ຫຼື ວາງຄູ່ກັນ

function ensurePersonalSigColumn_(sheet) {
  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  let colIndex = headers.indexOf('PersonalSignature') + 1;
  if (colIndex === 0) {
    colIndex = lastCol + 1;
    sheet.getRange(1, colIndex).setValue('PersonalSignature');
  }
  return colIndex;
}

// ອັບເດດ ຊື່ ແລະ (ຖ້າມີ) ລະຫັດຜ່ານ ຂອງຕົນເອງ - ຜູ້ໃຊ້ແກ້ໄຂຂໍ້ມູນຕົນເອງເທົ່ານັ້ນ (ບໍ່ຕ້ອງເປັນ Admin)
function updateMyProfile_impl_(username, payload) {
  try {
    if (!username) throw new Error('ບໍ່ໄດ້ລະບຸຜູ້ໃຊ້');
    if (!payload || !payload.name) throw new Error('ກະລຸນາໃສ່ຊື່-ນາມສະກຸນ');

    const sheet = getUsersSheet_();
    if (!sheet) throw new Error('ບໍ່ພົບຊີດ Users');
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if ((data[i][0] || '').toString().toLowerCase() === username.toLowerCase()) {
        sheet.getRange(i + 1, 3).setValue(payload.name); // ຄໍລຳ C = Name
        if (payload.password) {
          sheet.getRange(i + 1, 2).setValue(sfHashPassword_(payload.password)); // ຄໍລຳ B = Password (hash)
          sfPwdStore_(sheet, i + 1, payload.password);
          try { sfRevokeUser_(username, SF_CURRENT_TOKEN); } catch (e) {}
        }
        return { success: true, message: 'ບັນທຶກໂປຣໄຟລ໌ສຳເລັດ!' };
      }
    }
    throw new Error('ບໍ່ພົບຜູ້ໃຊ້ນີ້ໃນລະບົບ');
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ດຶງ URL ລາຍເຊັນສ່ວນຕົວ
function getMySignature_impl_(username) {
  try {
    const sheet = getUsersSheet_();
    if (!sheet) throw new Error('ບໍ່ພົບຊີດ Users');
    const colIndex = ensurePersonalSigColumn_(sheet);
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if ((data[i][0] || '').toString().toLowerCase() === (username || '').toLowerCase()) {
        return { success: true, signatureUrl: data[i][colIndex - 1] || '' };
      }
    }
    return { success: false, error: 'ບໍ່ພົບຜູ້ໃຊ້ນີ້' };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ອັບໂຫຼດ/ປ່ຽນລາຍເຊັນສ່ວນຕົວ
function updateMySignature_impl_(username, imageBase64, fileName) {
  try {
    if (!username) throw new Error('ບໍ່ໄດ້ລະບຸຜູ້ໃຊ້');
    if (!imageBase64 || !fileName) throw new Error('ກະລຸນາເລືອກຮູບ');

    const sigUrl = uploadToDrive(imageBase64, fileName, `signature_${username}`);

    const sheet = getUsersSheet_();
    if (!sheet) throw new Error('ບໍ່ພົບຊີດ Users');
    const colIndex = ensurePersonalSigColumn_(sheet);
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if ((data[i][0] || '').toString().toLowerCase() === username.toLowerCase()) {
        sheet.getRange(i + 1, colIndex).setValue(sigUrl);
        return { success: true, signatureUrl: sigUrl, message: 'ບັນທຶກລາຍເຊັນສຳເລັດ!' };
      }
    }
    throw new Error('ບໍ່ພົບຜູ້ໃຊ້ນີ້ໃນລະບົບ');
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ລົບລາຍເຊັນສ່ວນຕົວ
function removeMySignature_impl_(username) {
  try {
    if (!username) throw new Error('ບໍ່ໄດ້ລະບຸຜູ້ໃຊ້');
    const sheet = getUsersSheet_();
    if (!sheet) throw new Error('ບໍ່ພົບຊີດ Users');
    const colIndex = ensurePersonalSigColumn_(sheet);
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if ((data[i][0] || '').toString().toLowerCase() === username.toLowerCase()) {
        sheet.getRange(i + 1, colIndex).setValue('');
        return { success: true, message: 'ລົບລາຍເຊັນສຳເລັດ!' };
      }
    }
    throw new Error('ບໍ່ພົບຜູ້ໃຊ້ນີ້ໃນລະບົບ');
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ==========================================
// 📅 ລາຍງານປະຈຳເດືອນ / ປະຈຳປີ — ວາງຕໍ່ທ້າຍ Code.gs
// ==========================================
// ອີງໃສ່ requirePermission_(), toDateKey_() ທີ່ມີຢູ່ແລ້ວ (ຈາກຊຸດ Daily Report ກ່ອນໜ້ານີ້)

// ລາຍງານປະຈຳເດືອນ: monthStr ຮູບແບບ "yyyy-MM" (endMonthStr ບໍ່ບັງຄັບ - ຖ້າມີ ຈະລວມຫຼາຍເດືອນ)
function getMonthlyReport_impl_(requesterUsername, station, monthStr, endMonthStr) {
  try {
    const requester = requirePermission_(requesterUsername, 'tableIn', 'view');
    if (requester.role !== "Admin" && requester.stations && requester.stations.length && !requester.stations.includes(station)) {
      throw new Error("ທ່ານບໍ່ມີສິດເບິ່ງຂໍ້ມູນຂອງສະຖານທີ່ນີ້");
    }
    if (!station || !monthStr) throw new Error("ກະລຸນາເລືອກສະຖານທີ່ ແລະ ເດືອນ");
    let fromMonth = monthStr, toMonth = endMonthStr || monthStr;
    if (fromMonth > toMonth) { const tmp = fromMonth; fromMonth = toMonth; toMonth = tmp; }

    const ss = sfSS_();
    const tz = Session.getScriptTimeZone();
    let importedBefore = 0, usedBefore = 0, importedInPeriod = 0, usedInPeriod = 0;
    const details = [];
    let stockInSupervisorInPeriod = '';
    let stockInSupervisorInPeriodKey = '';
    let stockInSupervisorBefore = '';
    let stockInSupervisorBeforeKey = '';

    const stockInSheet = ss.getSheetByName('Stock_In');
    if (stockInSheet && stockInSheet.getLastRow() > 1) {
      const data = stockInSheet.getRange(2, 1, stockInSheet.getLastRow() - 1, stockInSheet.getLastColumn()).getValues();
      data.forEach(row => {
        if ((row[2] || '').toString().trim() !== station) return;
        const key = toDateKey_(row[1]); // "yyyy-MM-dd"
        const liters = Number(row[3]) || 0;
        const supervisorName = (row[6] || '').toString().trim();
        if (!key) return;
        const rowMonth = key.substring(0, 7);
        if (rowMonth >= fromMonth && rowMonth <= toMonth) {
          importedInPeriod += liters;
          if (supervisorName && (!stockInSupervisorInPeriodKey || key > stockInSupervisorInPeriodKey)) {
            stockInSupervisorInPeriod = supervisorName;
            stockInSupervisorInPeriodKey = key;
          }
        } else if (rowMonth < fromMonth) {
          importedBefore += liters;
          if (supervisorName && (!stockInSupervisorBeforeKey || key > stockInSupervisorBeforeKey)) {
            stockInSupervisorBefore = supervisorName;
            stockInSupervisorBeforeKey = key;
          }
        }
      });
    }

    const fieldSheet = ss.getSheetByName('Field_Data');
    if (fieldSheet && fieldSheet.getLastRow() > 1) {
      const data = fieldSheet.getRange(2, 1, fieldSheet.getLastRow() - 1, fieldSheet.getLastColumn()).getValues();
      data.forEach(row => {
        if ((row[1] || '').toString().trim() !== station) return;
        const key = toDateKey_(row[0]);
        const liters = Number(row[10]) || 0;
        if (!key) return;
        const rowMonth = key.substring(0, 7);
        if (rowMonth >= fromMonth && rowMonth <= toMonth) {
          usedInPeriod += liters;
          let timeStr = row[0];
          timeStr = (timeStr instanceof Date) ? Utilities.formatDate(timeStr, tz, "dd/MM/yyyy HH:mm") : timeStr;
          details.push({
            time: timeStr,
            carnumber: row[2] || '',
            carmodel: row[4] || '',
            driverName: row[19] || '',
            fuelBeforeCm: row[6],
            fuelBeforeLitre: row[7],
            fuelAfterCm: row[8],
            fuelAfterLitre: row[9],
            totalLitre: liters,
            recorderName: row[20] || '',
            note: row[23] || ''
          });
        } else if (rowMonth < fromMonth) {
          usedBefore += liters;
        }
      });
    }

    details.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    const opening = importedBefore - usedBefore;
    const closing = opening + importedInPeriod - usedInPeriod;
    const period = (fromMonth === toMonth) ? fromMonth : (fromMonth + ' ~ ' + toMonth);
    const sig = lookupReportSignature_('monthly', period, station);

    return Object.assign({
      success: true, station: station, period: period,
      opening: opening, imported: importedInPeriod, used: usedInPeriod, closing: closing,
      details: details,
      stockInSupervisorName: stockInSupervisorInPeriod || stockInSupervisorBefore || ''
    }, sig);
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ລາຍງານປະຈຳປີ: yearStr ຮູບແບບ "yyyy" - ສະຫຼຸບແຍກຕາມເດືອນ (endYearStr ບໍ່ບັງຄັບ - ຖ້າມີ ຈະລວມຫຼາຍປີ)
function getYearlyReport_impl_(requesterUsername, station, yearStr, endYearStr) {
  try {
    const requester = requirePermission_(requesterUsername, 'tableIn', 'view');
    if (requester.role !== "Admin" && requester.stations && requester.stations.length && !requester.stations.includes(station)) {
      throw new Error("ທ່ານບໍ່ມີສິດເບິ່ງຂໍ້ມູນຂອງສະຖານທີ່ນີ້");
    }
    if (!station || !yearStr) throw new Error("ກະລຸນາເລືອກສະຖານທີ່ ແລະ ປີ");
    let fromYear = parseInt(yearStr, 10), toYear = parseInt(endYearStr || yearStr, 10);
    if (fromYear > toYear) { const tmp = fromYear; fromYear = toYear; toYear = tmp; }
    const fromYearStr = String(fromYear), toYearStr = String(toYear);

    const ss = sfSS_();
    let importedBefore = 0, usedBefore = 0;
    const monthImported = {}, monthUsed = {};
    const monthKeys = [];
    for (let y = fromYear; y <= toYear; y++) {
      for (let m = 1; m <= 12; m++) {
        const key = y + '-' + String(m).padStart(2, '0');
        monthImported[key] = 0;
        monthUsed[key] = 0;
        monthKeys.push(key);
      }
    }

    const stockInSheet = ss.getSheetByName('Stock_In');
    if (stockInSheet && stockInSheet.getLastRow() > 1) {
      const data = stockInSheet.getRange(2, 1, stockInSheet.getLastRow() - 1, stockInSheet.getLastColumn()).getValues();
      data.forEach(row => {
        if ((row[2] || '').toString().trim() !== station) return;
        const key = toDateKey_(row[1]);
        const liters = Number(row[3]) || 0;
        if (!key) return;
        const rowYear = key.substring(0, 4);
        const rowMonth = key.substring(0, 7);
        if (rowYear >= fromYearStr && rowYear <= toYearStr) importedMonthSafe_(monthImported, rowMonth, liters);
        else if (rowYear < fromYearStr) importedBefore += liters;
      });
    }

    const fieldSheet = ss.getSheetByName('Field_Data');
    if (fieldSheet && fieldSheet.getLastRow() > 1) {
      const data = fieldSheet.getRange(2, 1, fieldSheet.getLastRow() - 1, fieldSheet.getLastColumn()).getValues();
      data.forEach(row => {
        if ((row[1] || '').toString().trim() !== station) return;
        const key = toDateKey_(row[0]);
        const liters = Number(row[10]) || 0;
        if (!key) return;
        const rowYear = key.substring(0, 4);
        const rowMonth = key.substring(0, 7);
        if (rowYear >= fromYearStr && rowYear <= toYearStr) importedMonthSafe_(monthUsed, rowMonth, liters);
        else if (rowYear < fromYearStr) usedBefore += liters;
      });
    }

    const monthNames = ['ມັງກອນ','ກຸມພາ','ມີນາ','ເມສາ','ພຶດສະພາ','ມິຖຸນາ','ກໍລະກົດ','ສິງຫາ','ກັນຍາ','ຕຸລາ','ພະຈິກ','ທັນວາ'];
    const months = [];
    let totalImported = 0, totalUsed = 0;
    monthKeys.forEach(key => {
      const m = parseInt(key.substring(5, 7), 10);
      const y = key.substring(0, 4);
      const imp = monthImported[key] || 0;
      const used = monthUsed[key] || 0;
      totalImported += imp; totalUsed += used;
      const label = (fromYear === toYear) ? monthNames[m - 1] : (monthNames[m - 1] + ' ' + y);
      months.push({ label: label, imported: imp, used: used });
    });

    const opening = importedBefore - usedBefore;
    const closing = opening + totalImported - totalUsed;
    const period = (fromYearStr === toYearStr) ? fromYearStr : (fromYearStr + ' ~ ' + toYearStr);
    const sig = lookupReportSignature_('yearly', period, station);

    return Object.assign({
      success: true, station: station, period: period,
      opening: opening, imported: totalImported, used: totalUsed, closing: closing,
      months: months
    }, sig);
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function importedMonthSafe_(map, key, val) {
  if (map[key] === undefined) map[key] = 0;
  map[key] += val;
}


// ==========================================
// 🚚 ບັນທຶກການນຳໃຊ້ລົດ (VEHICLE USAGE) — ໃຊ້ລົດ + ແທກນ້ຳມັນ ແຕ່ບໍ່ໄດ້ຕື່ມ
// ==========================================
// ຂໍ້ມູນເກັບໃນຊີດ "Vehicle_Usage" (ສ້າງອັດຕະໂນມັດ). ບໍ່ຫັກຍອດຄັງນ້ຳມັນ (Stock) ເພາະບໍ່ໄດ້ຈ່າຍນ້ຳມັນອອກຈາກສາງ.
// ລະດັບນ້ຳມັນ "ຄັ້ງລ່າສຸດ" ຂອງລົດແຕ່ລະຄັນ ຈະຊອກຈາກທັງ Vehicle_Usage ແລະ Field_Data (ຟອມນ້ຳມັນອອກ)
// ເພື່ອໃຫ້ລະດັບນ້ຳມັນຕໍ່ເນື່ອງກັນ ແລະ ກວດຈັບນ້ຳມັນທີ່ຫາຍໄປລະຫວ່າງການບັນທຶກ.

const VEHICLE_USAGE_SHEET = 'Vehicle_Usage';
const VEHICLE_USAGE_GAP_ALERT_LITERS = 5; // ລະດັບ "ກ່ອນໃຊ້" ຕ່າງຈາກຄັ້ງກ່ອນເກີນຈຳນວນນີ້ (ລິດ) = ສະຖານະ "ກວດສອບ"

const VEHICLE_USAGE_HEADERS = [
  'ID', 'Timestamp', 'ສະຖານທີ່/ສະໜາມ', 'ທະບຽນລົດ', 'ປະເພດລົດ', 'ລຸ້ນ/ຍີ່ຫໍ້', 'ສະຖານະລົດ', 'ຈຸດປະສົງ',
  'ກ່ອນໃຊ້ (CM)', 'ກ່ອນໃຊ້ (ລິດ)', 'ຫຼັງໃຊ້ (CM)', 'ຫຼັງໃຊ້ (ລິດ)', 'ໃຊ້ໄປ (ລິດ)',
  'KM ກ່ອນ', 'KM ຫຼັງ', 'ໄລຍະທາງ (KM)', 'ເລີ່ມວຽກ (Hs)', 'ຢຸດວຽກ (Hs)', 'ລວມຊົ່ວໂມງ',
  'KM/L', 'L/Hs', 'ຕ່າງຈາກຄັ້ງກ່ອນ (ລິດ)', 'ຜົນກວດ', 'ໂຊເຟີ', 'ຜູ້ບັນທຶກ', 'ຜູ້ຮັບຜິດຊອບ',
  'ເອກະສານແນບ', 'ໝາຍເຫດ', 'ບັນທຶກໂດຍ (Email)', 'ເວລາບັນທຶກ',
  'ຫັກຈາກລາຍການນ້ຳມັນອອກ', 'ລິດທີ່ຫັກ', 'ຄົງເຫຼືອກ່ອນຫັກ (ລິດ)', 'ຄົງເຫຼືອກ່ອນຫັກ (CM)', 'ຄົງເຫຼືອຫຼັງຫັກ (ລິດ)'
];

function getOrCreateVehicleUsageSheet_() {
  const ss = sfSS_();
  let sheet = ss.getSheetByName(VEHICLE_USAGE_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(VEHICLE_USAGE_SHEET);
    sheet.appendRow(VEHICLE_USAGE_HEADERS);
    sheet.getRange(1, 1, 1, VEHICLE_USAGE_HEADERS.length)
      .setFontWeight('bold').setBackground('#1a365d').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  } else if (sheet.getLastColumn() < VEHICLE_USAGE_HEADERS.length) {
    // ຊີດເກົ່າ: ເພີ່ມ header ຄໍລຳໃໝ່ໃຫ້ຄົບ
    sheet.getRange(1, 1, 1, VEHICLE_USAGE_HEADERS.length).setValues([VEHICLE_USAGE_HEADERS])
      .setFontWeight('bold').setBackground('#1a365d').setFontColor('#ffffff');
  }
  return sheet;
}

// ສິດ: Admin, ຫຼື ມີສິດ "ບັນທຶກການນຳໃຊ້ລົດ", ຫຼື ມີສິດ "ບັນທຶກນ້ຳມັນອອກ" (ເພື່ອໃຫ້ຜູ້ໃຊ້ເກົ່າໃຊ້ໄດ້ທັນທີ)
function requireVehicleUsagePermission_(requesterUsername) {
  const user = requireActiveUser_(requesterUsername);
  if (user.role === 'Admin') return user;
  const p = user.permissions || {};
  if (p.vehicleUsage || p.recordOut) return user;
  throw new Error("ທ່ານບໍ່ມີສິດບັນທຶກການນຳໃຊ້ລົດ");
}

function vuRound_(x) { return Math.round((Number(x) || 0) * 100) / 100; }

// ລະດັບນ້ຳມັນລ່າສຸດຂອງລົດ (ພາຍໃນ) - ຊອກທັງ Vehicle_Usage ແລະ Field_Data ແລ້ວເອົາອັນທີ່ເວລາໃໝ່ສຸດ
// beforeDate: ນັບສະເພາະບັນທຶກທີ່ເກີດກ່ອນເວລານີ້ (ກໍລະນີບັນທຶກຍ້ອນຫຼັງ)
function getVehicleLastLevel_(plate, beforeDate) {
  const ss = sfSS_();
  const target = (plate || '').toString().trim();
  if (!target) return null;
  const limit = beforeDate ? beforeDate.getTime() : Infinity;
  let best = null;

  const consider = (ts, cm, liters, km, source, extra) => {
    const d = ts instanceof Date ? ts : new Date(ts);
    if (isNaN(d.getTime()) || d.getTime() > limit) return;
    if (!best || d > best.date) best = Object.assign({ date: d, cm: Number(cm) || 0, liters: Number(liters) || 0, km: Number(km) || 0, source: source }, extra || {});
  };

  // 1) Field_Data (ຟອມນ້ຳມັນອອກ): ຖ້າມີ "ຫຼັງເລີກວຽກ" ໃຊ້ຄ່ານັ້ນ, ບໍ່ດັ່ງນັ້ນ = ກ່ອນຕື່ມ + ຕື່ມປະຈຸບັນ
  const field = ss.getSheetByName('Field_Data');
  if (field && field.getLastRow() > 1) {
    const data = field.getRange(2, 1, field.getLastRow() - 1, Math.min(field.getLastColumn(), 24)).getValues();
    data.forEach(r => {
      if ((r[2] || '').toString().trim() !== target) return;
      const leaveL = Number(r[12]) || 0;
      const info = { type: r[3] || '', model: r[4] || '', status: r[5] || '' };
      if (leaveL > 0) {
        consider(r[0], r[11], leaveL, r[17], 'ຟອມນ້ຳມັນອອກ (ຫຼັງເລີກວຽກ)', info);
      } else {
        consider(r[0], r[8], (Number(r[7]) || 0) + (Number(r[9]) || 0), r[17], 'ຟອມນ້ຳມັນອອກ (ຫຼັງຕື່ມ)', info);
      }
    });
  }

  // 2) Vehicle_Usage (ໜ້ານີ້)
  const usage = ss.getSheetByName(VEHICLE_USAGE_SHEET);
  if (usage && usage.getLastRow() > 1) {
    const data = usage.getRange(2, 1, usage.getLastRow() - 1, VEHICLE_USAGE_HEADERS.length).getValues();
    data.forEach(r => {
      if ((r[3] || '').toString().trim() !== target) return;
      consider(r[1], r[10], r[11], r[14], 'ບັນທຶກການນຳໃຊ້ລົດ', { type: r[4] || '', model: r[5] || '', status: r[6] || '' });
    });
  }

  return best;
}

// 📌 ໃຫ້ client ເອີ້ນ: ດຶງລະດັບນ້ຳມັນລ່າສຸດ + ຂໍ້ມູນລົດ (ປະເພດ/ລຸ້ນ/ສະຖານະ)
function getVehicleLastLevel_impl_(requesterUsername, plate) {
  try {
    requireVehicleUsagePermission_(requesterUsername);
    const last = getVehicleLastLevel_(plate);
    if (!last) return { success: true, last: null };
    return {
      success: true,
      last: {
        date: Utilities.formatDate(last.date, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm"),
        cm: last.cm, liters: last.liters, km: last.km, source: last.source,
        type: last.type, model: last.model, status: last.status
      }
    };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// 📌 ບັນທຶກການນຳໃຊ້ລົດ
function saveVehicleUsage_impl_(requesterUsername, d) {
  const lock = LockService.getScriptLock();
  try {
    const user = requireVehicleUsagePermission_(requesterUsername);
    if (!d || !d.carnumber) return { success: false, error: "ກະລຸນາເລືອກທະບຽນລົດ" };
    if (!d.location) return { success: false, error: "ກະລຸນາເລືອກສະຖານທີ່ / ສະໜາມ" };
    const stationErr = checkVehicleStation_(d.carnumber, d.location);
    if (stationErr) return { success: false, error: stationErr, wrongStation: true };
    if (user.role !== 'Admin' && user.stations && user.stations.length && !user.stations.includes(d.location)) {
      return { success: false, error: "ທ່ານບໍ່ມີສິດບັນທຶກຂໍ້ມູນຂອງສະຖານທີ່ນີ້" };
    }

    const beforeL = Number(d.fuelBeforeLitre) || 0;
    const afterL = Number(d.fuelAfterLitre) || 0;
    const used = vuRound_(beforeL - afterL);
    if (used < 0) {
      return { success: false, error: 'ນ້ຳມັນ "ຫຼັງໃຊ້" ຫຼາຍກວ່າ "ກ່ອນໃຊ້" — ຖ້າມີການຕື່ມນ້ຳມັນ ກະລຸນາບັນທຶກທີ່ "ຟອມບັນທຶກນ້ຳມັນອອກ"' };
    }
    const kmBefore = Number(d.kmBefore) || 0;
    const kmAfter = Number(d.kmAfter) || 0;
    if (kmAfter && kmAfter < kmBefore) return { success: false, error: "ເລກ KM ຫຼັງ ນ້ອຍກວ່າ KM ກ່ອນ" };
    const totalKm = Math.max(0, kmAfter - kmBefore);
    const hsTotal = vuRound_(calculateHoursDiff(d.hsBefore || '', d.hsAfter || ''));

    lock.waitLock(20000);

    const timestamp = d.recordTimestamp ? new Date(d.recordTimestamp) : new Date();
    const last = getVehicleLastLevel_(d.carnumber, timestamp);
    const gap = last ? vuRound_(last.liters - beforeL) : '';
    const checkStatus = (gap !== '' && Math.abs(gap) > VEHICLE_USAGE_GAP_ALERT_LITERS) ? 'ກວດສອບ' : 'ປົກກະຕິ';

    let fileUrl = '';
    if (d.fileData && d.fileName) fileUrl = uploadToDrive(d.fileData, d.fileName, d.carnumber);

    const tz = Session.getScriptTimeZone();
    const id = 'VU-' + Utilities.formatDate(new Date(), tz, 'yyMMddHHmmss') + '-' + Math.floor(Math.random() * 90 + 10);
    const kml = (used > 0 && totalKm > 0) ? vuRound_(totalKm / used) : '';
    const lph = (used > 0 && hsTotal > 0) ? vuRound_(used / hsTotal) : '';

    // 🔻 ຫັກນ້ຳມັນທີ່ໃຊ້ໄປ ອອກຈາກລາຍການນ້ຳມັນອອກ (Field_Data) ລ່າສຸດຂອງລົດຄັນນີ້ — ຂຽນລົງຖັນ "ຫຼັງເລີກວຽກຄົງເຫຼືອ"
    const ded = deductFromFieldData_(d.carnumber, timestamp, used, Number(d.fuelAfterCm) || 0);

    const usageSheet = getOrCreateVehicleUsageSheet_();
    usageSheet.appendRow([
      id, timestamp, d.location, d.carnumber, d.cartype || '', d.carmodel || '', d.carstatus || '', d.purpose || '',
      Number(d.fuelBeforeCm) || 0, beforeL, Number(d.fuelAfterCm) || 0, afterL, used,
      kmBefore, kmAfter, totalKm, d.hsBefore || '', d.hsAfter || '', hsTotal,
      kml, lph, gap, checkStatus, d.driverName || '', user.name, d.supervisorName || '',
      fileUrl, d.note || '', user.username, new Date(),
      ded ? ded.key : '', ded ? used : '', ded ? ded.prevL : '', ded ? ded.prevCm : '', ded ? ded.newL : ''
    ]);
    lock.releaseLock();

    const msg = `🚚 ບັນທຶກການນຳໃຊ້ລົດ (ບໍ່ໄດ້ຕື່ມນ້ຳມັນ)\n` +
                `📍 ສະໜາມ: ${d.location}\n` +
                `🚗 ທະບຽນ: ${d.carnumber}${d.carmodel ? ' (' + d.carmodel + ')' : ''}\n` +
                `🎯 ຈຸດປະສົງ: ${d.purpose || '-'}\n` +
                `⛽ ລະດັບນ້ຳມັນ: ${beforeL} → ${afterL} ລິດ (ໃຊ້ໄປ ${used.toFixed(2)} ລິດ)\n` +
                `🛣️ ໄລຍະທາງ: ${kmBefore} → ${kmAfter} (${totalKm} KM)\n` +
                `⌚ ຊົ່ວໂມງ: ${d.hsBefore || '-'} → ${d.hsAfter || '-'} (${hsTotal} Hs)\n` +
                (kml !== '' ? `⚡ ສິ້ນເປືອງ: ${kml} KM/L\n` : '') +
                (checkStatus === 'ກວດສອບ'
                  ? `⚠️ ລະດັບກ່ອນໃຊ້ ຕ່າງຈາກຄັ້ງກ່ອນ ${gap} ລິດ (ຄັ້ງກ່ອນ ${last.liters} ລິດ, ${Utilities.formatDate(last.date, tz, "dd/MM HH:mm")}) - ກະລຸນາກວດສອບ!\n`
                  : '') +
                (ded ? `🔻 ຫັກຈາກຕາຕະລາງນ້ຳມັນອອກ (${ded.dateLabel}): ${ded.prevL} → ${ded.newL} ລິດ\n` : '') +
                `🪪 ໂຊເຟີ: ${d.driverName || '-'}\n` +
                `👨‍💼 ຜູ້ບັນທຶກ: ${user.name}\n` +
                `⏱️ ເວລາ: ${Utilities.formatDate(timestamp, tz, "yyyy-MM-dd HH:mm")}\n` +
                (fileUrl ? `📎 ເອກະສານແນບ: ${fileUrl}\n` : '') +
                (d.note ? `📝 ໝາຍເຫດ: ${d.note}` : '');

    if (String(d.notifyLine) === "true") sendLineNotification(msg);
    if (String(d.notifyEmail) === "true") sendEmailNotification(`🚚 ນຳໃຊ້ລົດ - ${d.carnumber}${checkStatus === 'ກວດສອບ' ? ' ⚠️ ກວດສອບ' : ''}`, msg);

    return { success: true, id: id, used: used, totalKm: totalKm, hsTotal: hsTotal, gap: gap, checkStatus: checkStatus,
             linkedFuel: ded ? ded.dateLabel : '', prevRemaining: ded ? ded.prevL : '', newRemaining: ded ? ded.newL : '' };
  } catch (e) {
    try { lock.releaseLock(); } catch (x) {}
    return { success: false, error: e.toString() };
  }
}

// 📌 ລາຍການນຳໃຊ້ລົດ (ກັ່ນຕອງ: station, plate, startDate, endDate ຮູບແບບ yyyy-MM-dd)
function getVehicleUsageList_impl_(requesterUsername, filter) {
  try {
    const user = requireVehicleUsagePermission_(requesterUsername);
    const f = filter || {};
    const restrict = (user.role !== 'Admin' && user.stations && user.stations.length) ? user.stations : null;
    const sheet = sfSS_().getSheetByName(VEHICLE_USAGE_SHEET);
    if (!sheet || sheet.getLastRow() <= 1) return { success: true, rows: [] };

    const tz = Session.getScriptTimeZone();
    const start = f.startDate ? new Date(f.startDate + 'T00:00:00') : null;
    const end = f.endDate ? new Date(f.endDate + 'T23:59:59') : null;
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, VEHICLE_USAGE_HEADERS.length).getValues();
    const fmtTime = v => (v instanceof Date) ? Utilities.formatDate(v, tz, "HH:mm") : (v || '').toString();

    const rows = [];
    for (let i = data.length - 1; i >= 0; i--) {
      const r = data[i];
      if (!r[0]) continue;
      const d = r[1] instanceof Date ? r[1] : new Date(r[1]);
      if (start && d < start) continue;
      if (end && d > end) continue;
      if (restrict && !restrict.includes(r[2])) continue;
      if (f.station && r[2] !== f.station) continue;
      if (f.plate && (r[3] || '').toString().trim() !== f.plate) continue;
      rows.push({
        id: r[0], date: isNaN(d.getTime()) ? '' : Utilities.formatDate(d, tz, "yyyy-MM-dd HH:mm"),
        station: r[2], carnumber: r[3], cartype: r[4], carmodel: r[5], carstatus: r[6], purpose: r[7],
        beforeCm: r[8], beforeL: r[9], afterCm: r[10], afterL: r[11], used: r[12],
        kmBefore: r[13], kmAfter: r[14], totalKm: r[15], hsBefore: fmtTime(r[16]), hsAfter: fmtTime(r[17]), hsTotal: r[18],
        kml: r[19], lph: r[20], gap: r[21], checkStatus: r[22], driver: r[23], recorder: r[24], supervisor: r[25],
        fileUrl: r[26], note: r[27],
        linkedFuel: r[30] ? String(r[30]).split('|')[0].slice(0, 16) : '',
        deducted: r[31], prevRemaining: r[32], newRemaining: r[34]
      });
      if (rows.length >= 1000) break;
    }
    return { success: true, rows: rows };
  } catch (e) {
    return { success: false, error: e.toString(), rows: [] };
  }
}

// 📌 ລົບລາຍການນຳໃຊ້ລົດ - Admin ຫຼື ມີສິດ "ຕາຕະລາງອອກ" ລະດັບແກ້ໄຂ
function deleteVehicleUsage_impl_(requesterUsername, id) {
  try {
    const vuUser = requirePermission_(requesterUsername, 'tableOut', 'edit');
    const sheet = sfSS_().getSheetByName(VEHICLE_USAGE_SHEET);
    if (!sheet || sheet.getLastRow() <= 1) return { success: false, error: "ບໍ່ພົບຂໍ້ມູນ" };
    const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, VEHICLE_USAGE_HEADERS.length).getValues();
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0] === id) {
        const r = rows[i];
        sfRequireStation_(vuUser, r[2]);
        if (r[30] && r[31] !== '') restoreFieldDataDeduction_(r[30], Number(r[31]) || 0, r[32], r[33], r[34]);
        sheet.deleteRow(i + 2);
        return { success: true };
      }
    }
    return { success: false, error: "ບໍ່ພົບລາຍການທີ່ຕ້ອງການລົບ" };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ==========================================
// 🔗 ເຊື່ອມ "ການນຳໃຊ້ລົດ" ກັບ "ຕາຕະລາງນ້ຳມັນອອກ" — ຫັກນ້ຳມັນທີ່ໃຊ້ອອກຈາກລາຍການນ້ຳມັນອອກອັດຕະໂນມັດ
// ==========================================
// ການນຳໃຊ້ລົດແຕ່ລະຄັ້ງ ຈະຖືກຫັກອອກຈາກ "ລາຍການນ້ຳມັນອອກ (Field_Data) ລ່າສຸດຂອງລົດຄັນນັ້ນ ທີ່ເກີດກ່ອນເວລາໃຊ້ລົດ".
// ນ້ຳມັນໃນຖັງຕັ້ງຕົ້ນ = "ຫຼັງເລີກວຽກ (ລິດ)" ຖ້າມີ, ບໍ່ດັ່ງນັ້ນ = "ກ່ອນຕື່ມ + ຕື່ມປະຈຸບັນ".
// ຄິດໄລ່ສົດທຸກຄັ້ງ (ບໍ່ຂຽນທັບຂໍ້ມູນເດີມ) → ຖ້າແກ້ໄຂ/ລົບລາຍການໃດ ຍອດຈະຖືກຕ້ອງເອງ. ບໍ່ກະທົບຍອດຄັງນ້ຳມັນ (Stock).

function vuFieldKeyTs_(cell, tz) {
  return (cell instanceof Date) ? Utilities.formatDate(cell, tz, "yyyy-MM-dd HH:mm:ss") : String(cell || '');
}

// ສ້າງດັດຊະນີ Field_Data ແຍກຕາມທະບຽນລົດ (ລຽງຕາມເວລາ)
function buildFieldFuelIndex_() {
  const ss = sfSS_();
  const tz = Session.getScriptTimeZone();
  const sheet = ss.getSheetByName('Field_Data');
  const byPlate = {};
  if (!sheet || sheet.getLastRow() <= 1) return byPlate;
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, Math.min(sheet.getLastColumn(), 24)).getValues();
  data.forEach(r => {
    const plate = (r[2] || '').toString().trim();
    const d = r[0] instanceof Date ? r[0] : new Date(r[0]);
    if (!plate || isNaN(d.getTime())) return;
    const leaveL = Number(r[12]) || 0;
    const base = leaveL > 0 ? leaveL : (Number(r[7]) || 0) + (Number(r[9]) || 0);
    (byPlate[plate] = byPlate[plate] || []).push({
      t: d.getTime(), station: (r[1] || '').toString(), plate: plate, base: base,
      key: vuFieldKeyTs_(r[0], tz) + '|' + (r[1] || '').toString() + '|' + plate,
      dateLabel: Utilities.formatDate(d, tz, "yyyy-MM-dd HH:mm")
    });
  });
  Object.keys(byPlate).forEach(p => byPlate[p].sort((a, b) => a.t - b.t));
  return byPlate;
}

// ຫາລາຍການນ້ຳມັນອອກທີ່ການໃຊ້ລົດຄັ້ງນີ້ຖືກຫັກ (ລາຍການລ່າສຸດຂອງລົດຄັນນັ້ນ ທີ່ເວລາ <= ເວລາໃຊ້ລົດ)
function findLinkedFuelRecord_(byPlate, plate, time) {
  const list = byPlate[(plate || '').toString().trim()];
  if (!list) return null;
  let found = null;
  for (let i = 0; i < list.length; i++) {
    if (list[i].t <= time) found = list[i]; else break;
  }
  return found;
}

// ຊອກແຖວ Field_Data ລ່າສຸດຂອງລົດຄັນນີ້ ທີ່ເວລາ <= ເວລາໃຊ້ລົດ → ຄືນ { rowNum, key, dateLabel, values }
function findFieldDataRowForPlate_(plate, time) {
  const sheet = sfSS_().getSheetByName('Field_Data');
  if (!sheet || sheet.getLastRow() <= 1) return null;
  const tz = Session.getScriptTimeZone();
  const target = (plate || '').toString().trim();
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, Math.min(sheet.getLastColumn(), 24)).getValues();
  let best = null;
  data.forEach((r, i) => {
    if ((r[2] || '').toString().trim() !== target) return;
    const d = r[0] instanceof Date ? r[0] : new Date(r[0]);
    if (isNaN(d.getTime()) || d.getTime() > time) return;
    if (!best || d.getTime() >= best.t) best = { t: d.getTime(), rowNum: i + 2, r: r, d: d };
  });
  if (!best) return null;
  return {
    sheet: sheet, rowNum: best.rowNum, values: best.r,
    key: vuFieldKeyTs_(best.r[0], tz) + '|' + (best.r[1] || '').toString() + '|' + target,
    dateLabel: Utilities.formatDate(best.d, tz, "yyyy-MM-dd HH:mm")
  };
}

// ຫັກນ້ຳມັນ: ຄົງເຫຼືອໃໝ່ = ຄົງເຫຼືອປັດຈຸບັນ − ລິດທີ່ໃຊ້ໄປ (ຂຽນລົງຖັນ L "ຫຼັງເລີກວຽກ CM" ແລະ M "ຫຼັງເລີກວຽກ ລິດ")
// ຄົງເຫຼືອປັດຈຸບັນ = ຖັນ M ຖ້າມີຄ່າ, ບໍ່ດັ່ງນັ້ນ = ກ່ອນຕື່ມ + ຕື່ມປະຈຸບັນ. ບໍ່ກະທົບຍອດຄັງ (ຄັງໃຊ້ຖັນ K).
function deductFromFieldData_(plate, timestamp, usedLiters, afterCm) {
  if (!(usedLiters > 0)) return null;
  const f = findFieldDataRowForPlate_(plate, timestamp.getTime());
  if (!f) return null;
  const r = f.values;
  const prevL = (Number(r[12]) || 0) > 0 ? Number(r[12]) : (Number(r[7]) || 0) + (Number(r[9]) || 0);
  const prevCm = Number(r[11]) || 0;
  const newL = vuRound_(prevL - usedLiters);
  const newCm = afterCm > 0 ? afterCm : prevCm;
  f.sheet.getRange(f.rowNum, 12, 1, 2).setValues([[newCm, newL]]);
  return { key: f.key, dateLabel: f.dateLabel, prevL: vuRound_(prevL), prevCm: prevCm, newL: newL };
}

// ຄືນນ້ຳມັນ ເມື່ອລົບລາຍການໃຊ້ລົດ: ຖ້າຍັງເປັນການຫັກຄັ້ງລ່າສຸດ ໃຫ້ຄືນຄ່າ CM/ລິດ ເດີມ, ບໍ່ດັ່ງນັ້ນ ບວກລິດຄືນ
function restoreFieldDataDeduction_(key, liters, prevL, prevCm, newL) {
  const sheet = sfSS_().getSheetByName('Field_Data');
  if (!sheet || sheet.getLastRow() <= 1) return;
  const tz = Session.getScriptTimeZone();
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 13).getValues();
  for (let i = 0; i < data.length; i++) {
    const r = data[i];
    const k = vuFieldKeyTs_(r[0], tz) + '|' + (r[1] || '').toString() + '|' + (r[2] || '').toString().trim();
    if (k !== key) continue;
    const cur = Number(r[12]) || 0;
    if (Math.abs(cur - (Number(newL) || 0)) < 0.005 && prevL !== '') {
      sheet.getRange(i + 2, 12, 1, 2).setValues([[Number(prevCm) || 0, Number(prevL) || 0]]);
    } else {
      sheet.getRange(i + 2, 13).setValue(vuRound_(cur + liters));
    }
    return;
  }
}

// map: "timestamp|ສະໜາມ|ທະບຽນ" → { count, used, base } — base = ຄົງເຫຼືອກ່ອນຖືກຫັກຄັ້ງທຳອິດ
function getUsageDeductionMap_(restrictStations) {
  const out = {};
  try {
    const sheet = sfSS_().getSheetByName(VEHICLE_USAGE_SHEET);
    if (!sheet || sheet.getLastRow() <= 1 || sheet.getLastColumn() < 31) return out;
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, VEHICLE_USAGE_HEADERS.length).getValues();
    data.forEach(r => {
      const key = r[30];
      if (!key || r[31] === '') return;
      const station = String(key).split('|')[1];
      if (restrictStations && !restrictStations.includes(station)) return;
      const t = (r[1] instanceof Date ? r[1] : new Date(r[1])).getTime();
      const o = out[key] = out[key] || { count: 0, used: 0, base: Number(r[32]) || 0, firstT: t };
      o.count += 1;
      o.used = vuRound_(o.used + (Number(r[31]) || 0));
      if (t < o.firstT) { o.firstT = t; o.base = Number(r[32]) || 0; }
    });
  } catch (e) {
    Logger.log("Error getUsageDeductionMap_: " + e.toString());
  }
  return out;
}

// ==========================================
// 📊 ນ້ຳມັນທີ່ໃຊ້ຕົວຈິງ (ໃຊ້ໃນດັສບອດ) — ຄິດຈາກການວັດແທກລະດັບນ້ຳມັນໃນລົດ
// ==========================================
// ລຽງທຸກເຫດການຂອງລົດແຕ່ລະຄັນຕາມເວລາ (ຕື່ມນ້ຳມັນ + ໃຊ້ລົດ) ແລ້ວນັບ "ລະດັບນ້ຳມັນທີ່ຫຼຸດລົງ" ທັງໝົດ:
//  • ຕື່ມນ້ຳມັນ: ໃຊ້ໄປ = (ກ່ອນຕື່ມ + ຕື່ມ) − ຫຼັງເລີກວຽກ (ຄ່າທີ່ວັດແທກເດີມ ກ່ອນຖືກຫັກໂດຍການໃຊ້ລົດ)
//  • ໃຊ້ລົດ:   ໃຊ້ໄປ = ກ່ອນໃຊ້ − ຫຼັງໃຊ້
//  • ລະຫວ່າງ 2 ບັນທຶກ: ຖ້າລະດັບ "ກ່ອນ" ຂອງຄັ້ງນີ້ ຕ່ຳກວ່າລະດັບ "ຫຼັງ" ຂອງຄັ້ງກ່ອນ → ສ່ວນຕ່າງນັ້ນກໍ່ຖືກນັບວ່າໃຊ້ໄປ
// ຜົນລວມ = ລະດັບທຳອິດ + ນ້ຳມັນທີ່ຕື່ມທັງໝົດ − ລະດັບລ່າສຸດ (ຈຳນວນທີ່ລົດເຜົາໄໝ້ແທ້)
function getActualConsumptionEvents_(restrictStations, deductions) {
  const out = [];
  try {
    const ss = sfSS_();
    const tz = Session.getScriptTimeZone();
    const ded = deductions || {};
    const byPlate = {};
    const push = ev => { (byPlate[ev.plate] = byPlate[ev.plate] || []).push(ev); };
    const toDate = v => (v instanceof Date ? v : new Date(v));

    const field = ss.getSheetByName('Field_Data');
    if (field && field.getLastRow() > 1) {
      field.getRange(2, 1, field.getLastRow() - 1, Math.min(field.getLastColumn(), 24)).getValues().forEach(r => {
        const plate = (r[2] || '').toString().trim();
        const d = toDate(r[0]);
        if (!plate || isNaN(d.getTime())) return;
        const st = (r[1] || '').toString().trim();
        const B = Number(r[7]) || 0, A = Number(r[9]) || 0, M = Number(r[12]) || 0;
        const key = vuFieldKeyTs_(r[0], tz) + '|' + (r[1] || '').toString() + '|' + plate;
        const origLeave = ded[key] ? Number(ded[key].base) || 0 : (M > 0 ? M : B + A);
        push({ t: d.getTime(), d: d, type: 'fill', st: st, plate: plate, before: B, added: A, after: origLeave,
               km: Number(r[18]) || 0, hs: Number(r[15]) || 0 });
      });
    }

    const usage = ss.getSheetByName(VEHICLE_USAGE_SHEET);
    if (usage && usage.getLastRow() > 1) {
      usage.getRange(2, 1, usage.getLastRow() - 1, Math.min(usage.getLastColumn(), VEHICLE_USAGE_HEADERS.length)).getValues().forEach(r => {
        const plate = (r[3] || '').toString().trim();
        const d = toDate(r[1]);
        if (!r[0] || !plate || isNaN(d.getTime())) return;
        push({ t: d.getTime(), d: d, type: 'use', st: (r[2] || '').toString().trim(), plate: plate,
               before: Number(r[9]) || 0, added: 0, after: Number(r[11]) || 0, km: Number(r[15]) || 0, hs: Number(r[18]) || 0 });
      });
    }

    Object.keys(byPlate).forEach(plate => {
      let level = null;
      byPlate[plate].sort((a, b) => a.t - b.t).forEach(ev => {
        const between = (level !== null && level > ev.before) ? level - ev.before : 0;
        const work = Math.max(0, ev.before + ev.added - ev.after);
        level = ev.after;
        if (restrictStations && !restrictStations.includes(ev.st)) return;
        out.push({
          d: Utilities.formatDate(ev.d, tz, "yyyy-MM-dd HH:mm"), st: ev.st, car: plate, type: ev.type,
          L: vuRound_(work + between), between: vuRound_(between), filled: ev.added, km: ev.km, hs: ev.hs
        });
      });
    });
  } catch (e) {
    Logger.log("Error getActualConsumptionEvents_: " + e.toString());
  }
  return out;
}

// ==========================================
// 📥 ແຈ້ງເຕືອນເມື່ອນຳນ້ຳມັນເຂົ້າຄັງ (LINE + Email) — ບອກຜູ້ບັນທຶກ, ຫົວໜ້າໂຄງການ ແລະ ຍອດຄັງຫຼັງນຳເຂົ້າ
// ==========================================
function notifyStockIn_(formObj, id, fileUrl) {
  try {
    const settings = getAlertSettings_();
    const wantLine = settings.lineEnabled && String(formObj.notifyLine) !== 'false';
    const wantEmail = String(formObj.notifyEmail) !== 'false';
    if (!wantLine && !wantEmail) return;

    const st = formObj.site;
    const stock = computeStationStock_(st);
    const threshold = thresholdForStation_(settings, st);
    const status = stock.remaining <= 0 ? '🚨 ໝົດ' : (stock.remaining <= threshold ? '⚠️ ຍັງຕ່ຳກວ່າເກນ' : '✅ ປົກກະຕິ');
    const tz = Session.getScriptTimeZone();
    const d = formObj.date ? new Date(formObj.date) : new Date();
    const dateLabel = isNaN(d.getTime()) ? String(formObj.date) : Utilities.formatDate(d, tz, "dd/MM/yyyy");
    const now = Utilities.formatDate(new Date(), tz, "dd/MM/yyyy HH:mm");
    const liters = Number(formObj.liters) || 0;
    const hasCm = formObj.cm !== undefined && formObj.cm !== '' && formObj.cm !== null;

    const msg = `📥 ນຳນ້ຳມັນເຂົ້າຄັງ: ${st}\n` +
                `━━━━━━━━━━━━━━\n` +
                `📍 ສະໜາມ: ${st}\n` +
                `📅 ວັນທີນຳເຂົ້າ: ${dateLabel}\n` +
                `⛽ ນຳເຂົ້າຄັ້ງນີ້: ${fmtL_(liters)} ລິດ${hasCm ? ` (${formObj.cm} cm)` : ''}\n` +
                `👨‍💼 ຜູ້ບັນທຶກ: ${formObj.recordedBy || '-'}\n` +
                `👨‍✈️ ຫົວໜ້າໂຄງການ: ${formObj.supervisor || '-'}\n` +
                `━━━━━━━━━━━━━━\n` +
                `📊 ຍອດຄັງຫຼັງນຳເຂົ້າ\n` +
                `📥 ນຳເຂົ້າລວມ: ${fmtL_(stock.imported)} ລິດ\n` +
                `📤 ໃຊ້ໄປແລ້ວ: ${fmtL_(stock.used)} ລິດ\n` +
                `🛢️ ຍັງຄົງເຫຼືອ: ${fmtL_(stock.remaining)} ລິດ (${status})\n` +
                (formObj.note ? `📝 ໝາຍເຫດ: ${formObj.note}\n` : '') +
                (fileUrl ? `📎 ເອກະສານ: ${fileUrl}\n` : '') +
                `🆔 ${id} • ⏱️ ${now}`;

    if (wantLine) sendLineNotification(msg);
    if (wantEmail) {
      const rows = [
        ['📍 ສະໜາມ', st],
        ['📅 ວັນທີນຳເຂົ້າ', dateLabel],
        ['⛽ ນຳເຂົ້າຄັ້ງນີ້', `${fmtL_(liters)} ລິດ${hasCm ? ` (${formObj.cm} cm)` : ''}`, true],
        ['👨‍💼 ຜູ້ບັນທຶກ', formObj.recordedBy || '-'],
        ['👨‍✈️ ຫົວໜ້າໂຄງການ', formObj.supervisor || '-'],
        ['📥 ນຳເຂົ້າລວມ (ທັງໝົດ)', `${fmtL_(stock.imported)} ລິດ`],
        ['📤 ໃຊ້ໄປແລ້ວ', `${fmtL_(stock.used)} ລິດ`],
        ['🛢️ ຍັງຄົງເຫຼືອ', `${fmtL_(stock.remaining)} ລິດ (${status})`, true]
      ];
      if (formObj.note) rows.push(['📝 ໝາຍເຫດ', formObj.note]);
      if (fileUrl) rows.push(['📎 ເອກະສານ', fileUrl]);
      sendAlertEmail_(`📥 ນຳນ້ຳມັນເຂົ້າຄັງ - ${st} (+${fmtL_(liters)} ລິດ)`, `📥 ນຳນ້ຳມັນເຂົ້າຄັງ: ${st}`, '#15803d', rows, '', msg);
    }
  } catch (e) {
    Logger.log("Error notifyStockIn_: " + e.toString());
  }
}

// ==========================================
// 👥 ລາຍຊື່ ໂຊເຟີ / ຜູ້ຮັບຜິດຊອບໂຄງການ (Dropdown ໃຊ້ຮ່ວມກັນທຸກໜ້າ)
// ==========================================
// ເກັບໃນຊີດ "Staff_List": A ຊື່ | B ປະເພດ (driver = ໂຊເຟີ, supervisor = ຜູ້ຮັບຜິດຊອບ/ຫົວໜ້າໂຄງການ) | C ເພີ່ມໂດຍ | D ເວລາ
// ຄັ້ງທຳອິດທີ່ສ້າງຊີດ ຈະດຶງຊື່ທີ່ເຄີຍບັນທຶກໄວ້ແລ້ວ (Field_Data, Vehicle_Usage, Stock_In) ມາໃສ່ໃຫ້ອັດຕະໂນມັດ
// ລົບຊື່ອອກ: ລົບແຖວໃນຊີດ Staff_List ໂດຍກົງ
const PEOPLE_SHEET = 'Staff_List';
const PEOPLE_TYPES = ['driver', 'supervisor'];

function getOrCreatePeopleSheet_() {
  const ss = sfSS_();
  let sheet = ss.getSheetByName(PEOPLE_SHEET);
  if (sheet) return sheet;

  sheet = ss.insertSheet(PEOPLE_SHEET);
  sheet.appendRow(['ຊື່', 'ປະເພດ (driver/supervisor)', 'ເພີ່ມໂດຍ', 'ເວລາ']);
  sheet.getRange(1, 1, 1, 4).setFontWeight('bold').setBackground('#1a365d').setFontColor('#ffffff');
  sheet.setFrozenRows(1);

  // ດຶງຊື່ເກົ່າຈາກປະຫວັດ
  const found = { driver: new Set(), supervisor: new Set() };
  const collect = (sheetName, col, type) => {
    const sh = ss.getSheetByName(sheetName);
    if (!sh || sh.getLastRow() <= 1 || sh.getLastColumn() < col) return;
    sh.getRange(2, col, sh.getLastRow() - 1, 1).getValues().forEach(r => {
      const n = (r[0] || '').toString().trim();
      if (n && n !== '-') found[type].add(n);
    });
  };
  collect('Field_Data', 20, 'driver');            // T: ໂຊເຟີ
  collect('Field_Data', 22, 'supervisor');        // V: ຜູ້ຮັບຜິດຊອບ
  collect(VEHICLE_USAGE_SHEET, 24, 'driver');     // X: ໂຊເຟີ
  collect(VEHICLE_USAGE_SHEET, 26, 'supervisor'); // Z: ຜູ້ຮັບຜິດຊອບ
  collect('Stock_In', 7, 'supervisor');           // G: ຫົວໜ້າໂຄງການ
  const now = new Date();
  const rows = [];
  PEOPLE_TYPES.forEach(t => Array.from(found[t]).forEach(n => rows.push([n, t, 'ດຶງຈາກປະຫວັດ', now])));
  if (rows.length) sheet.getRange(2, 1, rows.length, 4).setValues(rows);
  return sheet;
}

function getPeopleLists_() {
  const lists = { drivers: [], supervisors: [] };
  try {
    const sheet = getOrCreatePeopleSheet_();
    if (sheet.getLastRow() <= 1) return lists;
    const seen = { driver: new Set(), supervisor: new Set() };
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues().forEach(r => {
      const n = (r[0] || '').toString().trim();
      const t = (r[1] || '').toString().trim().toLowerCase();
      if (!n || !PEOPLE_TYPES.includes(t) || seen[t].has(n.toLowerCase())) return;
      seen[t].add(n.toLowerCase());
      (t === 'driver' ? lists.drivers : lists.supervisors).push(n);
    });
    lists.drivers.sort((a, b) => a.localeCompare(b, 'lo'));
    lists.supervisors.sort((a, b) => a.localeCompare(b, 'lo'));
  } catch (e) {
    Logger.log("Error getPeopleLists_: " + e.toString());
  }
  return lists;
}

// 📌 ເພີ່ມຊື່ໃໝ່ (ຜູ້ໃຊ້ທີ່ login ແລ້ວທຸກຄົນເພີ່ມໄດ້)
function addPerson_impl_(requesterUsername, type, name) {
  try {
    const user = requireActiveUser_(requesterUsername);
    if (!PEOPLE_TYPES.includes(type)) return { success: false, error: "ປະເພດບໍ່ຖືກຕ້ອງ" };
    const clean = (name || '').toString().trim().replace(/\s+/g, ' ');
    if (!clean) return { success: false, error: "ກະລຸນາປ້ອນຊື່" };
    if (clean.length > 100) return { success: false, error: "ຊື່ຍາວເກີນໄປ" };

    const lists = getPeopleLists_();
    const existing = type === 'driver' ? lists.drivers : lists.supervisors;
    if (existing.some(n => n.toLowerCase() === clean.toLowerCase())) {
      return { success: true, people: lists, name: clean, existed: true };
    }
    getOrCreatePeopleSheet_().appendRow([clean, type, user.name, new Date()]);
    return { success: true, people: getPeopleLists_(), name: clean };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ==========================================
// 🚗 ລົດປະຈຳສະໜາມ — ນ້ຳມັນຂອງລົດແຕ່ລະຄັນ ຕ້ອງຫັກຈາກສະໜາມທີ່ລົດປະຈຳຢູ່ເທົ່ານັ້ນ
// ==========================================
// ຊີດ "Vehicle_Station": A ທະບຽນລົດ | B ສະໜາມປະຈຳ | C ກຳນົດໂດຍ | D ເວລາ
// ລົດທີ່ບໍ່ໄດ້ກຳນົດ = ບັນທຶກໄດ້ທຸກສະໜາມ (ຄືເກົ່າ)
const VEHICLE_STATION_SHEET = 'Vehicle_Station';

function getVehicleStationMap_() {
  const map = {};
  try {
    const sheet = sfSS_().getSheetByName(VEHICLE_STATION_SHEET);
    if (!sheet || sheet.getLastRow() <= 1) return map;
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues().forEach(r => {
      const plate = (r[0] || '').toString().trim();
      const st = (r[1] || '').toString().trim();
      if (plate && st) map[plate] = st;
    });
  } catch (e) {
    Logger.log("Error getVehicleStationMap_: " + e.toString());
  }
  return map;
}

// ຄືນຂໍ້ຄວາມ error ຖ້າໃສ່ສະໜາມບໍ່ກົງກັບສະໜາມປະຈຳຂອງລົດ, ຖ້າຖືກຕ້ອງ ຄືນ ''
function checkVehicleStation_(plate, location) {
  const p = (plate || '').toString().trim();
  if (!p) return '';
  const home = getVehicleStationMap_()[p];
  if (!home || home === (location || '').toString().trim()) return '';
  return `⚠️ ໃສ່ສະໜາມບໍ່ຖືກຕ້ອງ! ລົດ "${p}" ເປັນລົດປະຈຳສະໜາມ "${home}" — ນ້ຳມັນຕ້ອງຫັກຈາກສະໜາມ "${home}" ເທົ່ານັ້ນ (ທ່ານເລືອກ "${location || '-'}")`;
}

// 📌 ຂໍ້ມູນສຳລັບໜ້າ "ລົດປະຈຳສະໜາມ" (Admin): ການກຳນົດປັດຈຸບັນ + ສະໜາມທີ່ລົດແຕ່ລະຄັນເຄີຍໃຊ້ (ສະຖິຕິ)
function getVehicleStationAdmin_impl_(requesterUsername) {
  try {
    requireAdmin_(requesterUsername);
    const ss = sfSS_();
    const usage = {};
    const count = (plate, st) => {
      plate = (plate || '').toString().trim(); st = (st || '').toString().trim();
      if (!plate || !st) return;
      usage[plate] = usage[plate] || {};
      usage[plate][st] = (usage[plate][st] || 0) + 1;
    };
    const fd = ss.getSheetByName('Field_Data');
    if (fd && fd.getLastRow() > 1) fd.getRange(2, 2, fd.getLastRow() - 1, 2).getValues().forEach(r => count(r[1], r[0]));
    const vu = ss.getSheetByName(VEHICLE_USAGE_SHEET);
    if (vu && vu.getLastRow() > 1) vu.getRange(2, 3, vu.getLastRow() - 1, 2).getValues().forEach(r => count(r[1], r[0]));
    return { success: true, map: getVehicleStationMap_(), usage: usage, stations: getAllStationNames_() };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// 📌 ບັນທຶກການກຳນົດລົດປະຈຳສະໜາມ (ຂຽນທັບທັງໝົດ) — map: { ທະບຽນ: ສະໜາມ } (ສະໜາມຫວ່າງ = ບໍ່ກຳນົດ)
function saveVehicleStations_impl_(requesterUsername, map) {
  try {
    const admin = requireAdmin_(requesterUsername);
    const ss = sfSS_();
    let sheet = ss.getSheetByName(VEHICLE_STATION_SHEET);
    if (!sheet) {
      sheet = ss.insertSheet(VEHICLE_STATION_SHEET);
      sheet.getRange(1, 1, 1, 4).setValues([['ທະບຽນລົດ', 'ສະໜາມປະຈຳ', 'ກຳນົດໂດຍ', 'ເວລາ']])
        .setFontWeight('bold').setBackground('#1a365d').setFontColor('#ffffff');
      sheet.setFrozenRows(1);
    }
    const old = getVehicleStationMap_();
    const now = new Date();
    const rows = [];
    Object.keys(map || {}).forEach(k => {
      const plate = (k || '').toString().trim();
      const st = (map[k] || '').toString().trim();
      if (plate && st) rows.push([plate, st, old[plate] === st ? '' : admin.name, now]);
    });
    if (sheet.getLastRow() > 1) sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).clearContent();
    if (rows.length) sheet.getRange(2, 1, rows.length, 4).setValues(rows);
    return { success: true, map: getVehicleStationMap_(), count: rows.length };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}


// ==========================================================================================
// 🚜 ລົດເຊົ່າພາກສະໜາມ (RENTAL MODULE) — ເພີ່ມເຂົ້າ SMART FUEL v5
// ສິດລາຍໜ້າ: rentalContracts, rentalLogs, rentalBilling, rentalPayments (none/view/edit) · rentalReport (none/view) · Admin ໄດ້ທຸກສິດ
// ຜູ້ໃຊ້ທີ່ຖືກຈຳກັດສະຖານທີ່ ຈະເຫັນ/ບັນທຶກໄດ້ສະເພາະສັນຍາຂອງສະໜາມທີ່ຮັບຜິດຊອບ
// ນ້ຳມັນທີ່ລົດເຊົ່າເຕີມ ດຶງອັດຕະໂນມັດຈາກ Field_Data (ຈັບຄູ່ດ້ວຍທະບຽນລົດ)
// ຕັ້ງຄ່າຄັ້ງທຳອິດ: Run rtSetup 1 ຄັ້ງ · ແຈ້ງເຕືອນສັນຍາໃກ້ໝົດ: Run rtInstallDailyTrigger 1 ຄັ້ງ
// ==========================================================================================

const RT_EXPIRY_ALERT_DAYS = 15; // ແຈ້ງເຕືອນກ່ອນສັນຍາໝົດ (ມື້)

// 🔐 ສິດລາຍໜ້າຂອງລົດເຊົ່າ (ກຳນົດໃນໜ້າຈັດການຜູ້ໃຊ້)
const RT_PAGES = { contracts: 'rentalContracts', logs: 'rentalLogs', billing: 'rentalBilling', payments: 'rentalPayments', report: 'rentalReport' };
const RT_PAGE_LABELS = { contracts: 'ຜູ້ໃຫ້ເຊົ່າ ແລະ ສັນຍາ', logs: 'ບັນທຶກລົດເຊົ່າປະຈຳວັນ', billing: 'ຄິດໄລ່ຄ່າເຊົ່າ', payments: 'ການຈ່າຍຄ່າເຊົ່າ', report: 'ລາຍງານລົດເຊົ່າ' };
const RT_KEY_PAGE = { suppliers: 'contracts', contracts: 'contracts', logs: 'logs', payments: 'payments', invoices: 'billing' };
function rtPerm_(user) {
  const o = {};
  Object.keys(RT_PAGES).forEach(pg => {
    const k = RT_PAGES[pg], lim = PERMISSION_LEVEL_LIMITS[k] || ['none', 'view', 'edit'];
    o[pg] = user.role === 'Admin' ? lim[lim.length - 1] : ((user.permissions && user.permissions[k]) || 'none');
  });
  return o;
}
function rtRequire_(username, page, level) {
  const user = requireActiveUser_(username);
  if (!hasPermission_(user, RT_PAGES[page], level))
    throw new Error('ທ່ານບໍ່ມີສິດ' + (level === 'edit' ? 'ແກ້ໄຂ' : 'ເບິ່ງ') + 'ໃນໜ້າ "' + RT_PAGE_LABELS[page] + '"');
  return user;
}
function rtRequireAny_(username) {
  const user = requireActiveUser_(username);
  if (!Object.keys(RT_PAGES).some(pg => hasPermission_(user, RT_PAGES[pg], 'view'))) throw new Error('ທ່ານບໍ່ມີສິດເຂົ້າລະບົບລົດເຊົ່າ');
  return user;
}

// [key, ຫົວຂໍ້ຖັນ, ປະເພດ] — ປະເພດ: 's' ຂໍ້ຄວາມ | 'n' ຕົວເລກ | 'd' ວັນທີ yyyy-MM-dd | 'dt' ວັນທີ+ເວລາ
const RT_SCHEMA = {
  suppliers: { sheet: 'RT_Suppliers', prefix: 'SP', cols: [
    ['id', 'ລະຫັດ', 's'], ['name', 'ຊື່ຜູ້ໃຫ້ເຊົ່າ', 's'], ['phone', 'ເບີໂທ', 's'], ['address', 'ທີ່ຢູ່', 's'],
    ['bank', 'ທະນາຄານ', 's'], ['account', 'ເລກບັນຊີ', 's'], ['note', 'ໝາຍເຫດ', 's'],
    ['createdAt', 'ວັນທີສ້າງ', 'dt'], ['createdBy', 'ຜູ້ສ້າງ', 's']] },
  contracts: { sheet: 'RT_Contracts', prefix: 'CT', cols: [
    ['id', 'ລະຫັດ', 's'], ['contractNo', 'ເລກທີສັນຍາ', 's'], ['supplierId', 'ລະຫັດຜູ້ໃຫ້ເຊົ່າ', 's'],
    ['plate', 'ທະບຽນລົດ', 's'], ['vehicle', 'ລຸ້ນ/ລາຍລະອຽດລົດ', 's'], ['vehicleType', 'ປະເພດລົດ', 's'], ['site', 'ສະໜາມ', 's'],
    ['startDate', 'ວັນເລີ່ມ', 'd'], ['endDate', 'ວັນສິ້ນສຸດ', 'd'], ['rateType', 'ຮູບແບບຄ່າເຊົ່າ', 's'], ['rate', 'ອັດຕາຄ່າເຊົ່າ', 'n'],
    ['currency', 'ສະກຸນເງິນ', 's'], ['fx', 'ອັດຕາແລກປ່ຽນ(ກີບ)', 'n'], ['minQty', 'ຂັ້ນຕ່ຳ/ເດືອນ', 'n'],
    ['withDriver', 'ມີຄົນຂັບ', 's'], ['fuelBy', 'ຜູ້ຈ່າຍນ້ຳມັນ', 's'], ['fuelPriceLAK', 'ລາຄານ້ຳມັນ(ກີບ/ລິດ)', 'n'],
    ['status', 'ສະຖານະ', 's'], ['note', 'ໝາຍເຫດ', 's'], ['createdAt', 'ວັນທີສ້າງ', 'dt'], ['createdBy', 'ຜູ້ສ້າງ', 's']] },
  logs: { sheet: 'RT_Daily_Logs', prefix: 'LG', cols: [
    ['id', 'ລະຫັດ', 's'], ['date', 'ວັນທີ', 'd'], ['contractId', 'ລະຫັດສັນຍາ', 's'], ['site', 'ສະໜາມ', 's'],
    ['meterStart', 'ໄມລ໌/ຊມ ເລີ່ມ', 'n'], ['meterEnd', 'ໄມລ໌/ຊມ ເລີກ', 'n'], ['hours', 'ຊົ່ວໂມງເຮັດວຽກ', 'n'],
    ['status', 'ສະຖານະມື້', 's'], ['supervisor', 'ຜູ້ຢືນຢັນ', 's'], ['note', 'ໝາຍເຫດ', 's'],
    ['createdAt', 'ວັນທີສ້າງ', 'dt'], ['createdBy', 'ຜູ້ສ້າງ', 's']] },
  invoices: { sheet: 'RT_Invoices', prefix: 'IV', cols: [
    ['id', 'ລະຫັດ', 's'], ['month', 'ເດືອນ', 's'], ['contractId', 'ລະຫັດສັນຍາ', 's'], ['supplierId', 'ລະຫັດຜູ້ໃຫ້ເຊົ່າ', 's'],
    ['qty', 'ຈຳນວນຄິດເງິນ', 'n'], ['unit', 'ໜ່ວຍ', 's'], ['workedHours', 'ຊມ ເຮັດວຽກຈິງ', 'n'],
    ['workDays', 'ມື້ເຮັດວຽກ', 'n'], ['breakdownDays', 'ມື້ລົດເສຍ', 'n'],
    ['gross', 'ຄ່າເຊົ່າ(ສະກຸນສັນຍາ)', 'n'], ['currency', 'ສະກຸນເງິນ', 's'], ['fx', 'ອັດຕາແລກປ່ຽນ', 'n'],
    ['grossLAK', 'ຄ່າເຊົ່າ(ກີບ)', 'n'], ['breakdownLAK', 'ຫັກມື້ເສຍ(ກີບ)', 'n'],
    ['fuelLiters', 'ນ້ຳມັນທີ່ເຕີມ(ລິດ)', 'n'], ['fuelLAK', 'ຫັກນ້ຳມັນ(ກີບ)', 'n'], ['netLAK', 'ຍອດຕ້ອງຈ່າຍ(ກີບ)', 'n'],
    ['createdAt', 'ວັນທີສ້າງ', 'dt'], ['createdBy', 'ຜູ້ສ້າງ', 's']] },
  payments: { sheet: 'RT_Payments', prefix: 'PM', cols: [
    ['id', 'ລະຫັດ', 's'], ['date', 'ວັນທີຈ່າຍ', 'd'], ['invoiceId', 'ລະຫັດໃບແຈ້ງໜີ້', 's'], ['supplierId', 'ລະຫັດຜູ້ໃຫ້ເຊົ່າ', 's'],
    ['amountLAK', 'ຈຳນວນເງິນ(ກີບ)', 'n'], ['method', 'ວິທີຈ່າຍ', 's'], ['ref', 'ເລກອ້າງອີງ', 's'], ['note', 'ໝາຍເຫດ', 's'],
    ['createdAt', 'ວັນທີສ້າງ', 'dt'], ['createdBy', 'ຜູ້ສ້າງ', 's']] }
};

/* ---------- ພື້ນຖານ ---------- */
function rtTZ_() { return Session.getScriptTimeZone(); }
function rtNow_() { return Utilities.formatDate(new Date(), rtTZ_(), 'yyyy-MM-dd HH:mm'); }
function rtToday_() { return Utilities.formatDate(new Date(), rtTZ_(), 'yyyy-MM-dd'); }
function rtPlateKey_(p) { return (p || '').toString().replace(/\s+/g, '').toLowerCase(); }
function rtRound_(n, d) { const f = Math.pow(10, d || 0); return Math.round((Number(n) || 0) * f) / f; }
function rtCheckKey_(key) { if (!RT_SCHEMA[key]) throw new Error('ບໍ່ຮູ້ຈັກຕາຕະລາງ: ' + key); }
function rtRestrict_(user) { return (user.role !== 'Admin' && user.stations && user.stations.length) ? user.stations : null; }

function rtSheet_(key) {
  rtCheckKey_(key);
  const sc = RT_SCHEMA[key];
  const ss = sfSS_();
  let sh = ss.getSheetByName(sc.sheet);
  if (!sh) {
    sh = ss.insertSheet(sc.sheet);
    sh.getRange(1, 1, 1, sc.cols.length).setValues([sc.cols.map(c => c[1])])
      .setFontWeight('bold').setBackground('#1a365d').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    sc.cols.forEach((c, i) => { if (c[2] !== 'n') sh.getRange(2, i + 1, sh.getMaxRows() - 1, 1).setNumberFormat('@'); });
  }
  return sh;
}

/** 🛠️ Run ຄັ້ງດຽວ: ສ້າງ Sheet ທັງໝົດຂອງລົດເຊົ່າ */
function rtSetup_impl_() { Object.keys(RT_SCHEMA).forEach(rtSheet_); return 'ສ້າງ Sheet ລົດເຊົ່າຮຽບຮ້ອຍ'; }

function rtRead_(key) {
  const sc = RT_SCHEMA[key], sh = rtSheet_(key), n = sh.getLastRow() - 1;
  if (n < 1) return [];
  const tz = rtTZ_();
  return sh.getRange(2, 1, n, sc.cols.length).getValues().filter(r => r[0] !== '' && r[0] !== null).map(r => {
    const o = {};
    sc.cols.forEach((c, i) => {
      let v = r[i];
      if (v instanceof Date) v = Utilities.formatDate(v, tz, c[2] === 'dt' ? 'yyyy-MM-dd HH:mm' : 'yyyy-MM-dd');
      else if (c[2] === 'n') v = (v === '' || v === null) ? '' : Number(v) || 0;
      else v = (v === null || v === undefined) ? '' : String(v);
      o[c[0]] = v;
    });
    return o;
  });
}

function rtNormalize_(key, obj) {
  const o = {};
  RT_SCHEMA[key].cols.forEach(c => {
    let v = obj ? obj[c[0]] : '';
    if (v === undefined || v === null) v = '';
    o[c[0]] = c[2] === 'n' ? (v === '' ? '' : Number(v) || 0) : String(v).trim();
  });
  return o;
}

function rtFindRow_(sh, id) {
  const n = sh.getLastRow() - 1;
  if (n < 1 || !id) return -1;
  const i = sh.getRange(2, 1, n, 1).getValues().map(r => String(r[0])).indexOf(String(id));
  return i < 0 ? -1 : i + 2;
}

/** ເດືອນທີ່ໃບແຈ້ງໜີ້ຈ່າຍເງິນແລ້ວ ຈະແກ້ໄຂ/ລຶບບັນທຶກປະຈຳວັນບໍ່ໄດ້ (ກັນຕົວເລກບໍ່ກົງກັບເງິນທີ່ຈ່າຍ) */
function rtAssertMonthOpen_(contractId, date) {
  const m = String(date || '').slice(0, 7);
  const inv = rtRead_('invoices').find(i => i.contractId === contractId && i.month === m);
  if (inv && rtRead_('payments').some(p => p.invoiceId === inv.id))
    throw new Error('ເດືອນ ' + m + ' ຂອງລົດຄັນນີ້ ມີການຈ່າຍເງິນຕາມໃບແຈ້ງໜີ້ແລ້ວ — ແກ້ໄຂ ຫຼື ລຶບບັນທຶກປະຈຳວັນບໍ່ໄດ້. ຖ້າຈຳເປັນ ໃຫ້ລຶບການຈ່າຍເງິນກ່ອນ');
}

/** ກວດ ແລະ ຂຽນ 1 ແຖວ (ເພີ່ມ ຫຼື ແກ້ໄຂ) */
function rtWrite_(key, obj, user) {
  const sc = RT_SCHEMA[key], sh = rtSheet_(key), o = rtNormalize_(key, obj);
  const restrict = rtRestrict_(user);
  const need = (f, label) => { if (o[f] === '') throw new Error('ກະລຸນາໃສ່: ' + label); };
  const allowedSite = site => { if (restrict && !restrict.includes(site)) throw new Error('ທ່ານບໍ່ມີສິດໃນສະໜາມ "' + (site || '-') + '"'); };

  if (key === 'suppliers') need('name', 'ຊື່ຜູ້ໃຫ້ເຊົ່າ');
  if (key === 'contracts') {
    need('supplierId', 'ຜູ້ໃຫ້ເຊົ່າ'); need('plate', 'ທະບຽນລົດ'); need('site', 'ສະໜາມ'); need('startDate', 'ວັນເລີ່ມ');
    need('rateType', 'ຮູບແບບຄ່າເຊົ່າ'); need('rate', 'ອັດຕາຄ່າເຊົ່າ');
    o.site = sfEnsureStation_(user, o.site); // ສະໜາມໃໝ່ / ຈາກຕາຕະລາງກຸ່ມບໍລິສັດ → ເພີ່ມໃສ່ບໍລິສັດນີ້ (Admin)
    allowedSite(o.site);
    if (!o.currency) o.currency = 'LAK';
    if (o.currency === 'LAK') o.fx = 1; else if (!(Number(o.fx) > 0)) throw new Error('ກະລຸນາໃສ່ອັດຕາແລກປ່ຽນເປັນກີບ');
    if (o.endDate && o.endDate < o.startDate) throw new Error('ວັນສິ້ນສຸດຕ້ອງຫຼັງວັນເລີ່ມ');
    if (o.fuelBy === 'supplier' && !(Number(o.fuelPriceLAK) > 0)) throw new Error('ກະລຸນາໃສ່ລາຄານ້ຳມັນ (ກີບ/ລິດ) ເພື່ອຫັກຄ່ານ້ຳມັນ');
    if (!o.status) o.status = 'active';
    if (o.status !== 'closed') {
      const end = d => d || '9999-12-31';
      const clash = rtRead_('contracts').find(x => x.id !== o.id && x.status !== 'closed' && rtPlateKey_(x.plate) === rtPlateKey_(o.plate) &&
        x.startDate <= end(o.endDate) && o.startDate <= end(x.endDate));
      if (clash) throw new Error('ລົດ ' + o.plate + ' ມີສັນຍາ ' + (clash.contractNo || clash.id) + ' ທີ່ໃຊ້ງານຊ່ວງດຽວກັນແລ້ວ (' + clash.startDate + ' – ' + (clash.endDate || 'ບໍ່ກຳນົດ') + '). ກະລຸນາປິດສັນຍາເກົ່າ ຫຼື ປັບວັນທີ ເພື່ອບໍ່ໃຫ້ຄິດເງິນຊ້ຳ');
    }
  }
  if (key === 'logs') {
    need('date', 'ວັນທີ'); need('contractId', 'ສັນຍາເຊົ່າ'); need('status', 'ສະຖານະມື້');
    const c = rtRead_('contracts').find(x => x.id === o.contractId);
    if (!c) throw new Error('ບໍ່ພົບສັນຍາເຊົ່າ');
    if (!o.site) o.site = c.site;
    allowedSite(c.site);
    if (o.meterStart !== '' && o.meterEnd !== '' && o.meterEnd < o.meterStart) throw new Error('ເລກເລີກ ຕ້ອງບໍ່ໜ້ອຍກວ່າເລກເລີ່ມ');
    const dup = rtRead_('logs').find(l => l.contractId === o.contractId && l.date === o.date && l.id !== o.id);
    if (dup) throw new Error('ລົດຄັນນີ້ມີບັນທຶກຂອງວັນທີ ' + o.date + ' ແລ້ວ. ກະລຸນາແກ້ໄຂລາຍການເດີມ');
    const oldLog = o.id ? rtRead_('logs').find(l => l.id === o.id) : null;
    rtAssertMonthOpen_(o.contractId, o.date);
    if (oldLog) rtAssertMonthOpen_(oldLog.contractId, oldLog.date);
  }
  if (key === 'payments') {
    need('date', 'ວັນທີຈ່າຍ'); need('invoiceId', 'ໃບແຈ້ງໜີ້');
    if (!(Number(o.amountLAK) > 0)) throw new Error('ຈຳນວນເງິນຕ້ອງຫຼາຍກວ່າ 0');
    const inv = rtRead_('invoices').find(i => i.id === o.invoiceId);
    if (!inv) throw new Error('ບໍ່ພົບໃບແຈ້ງໜີ້');
    const c = rtRead_('contracts').find(x => x.id === inv.contractId);
    if (c) allowedSite(c.site);
    o.supplierId = inv.supplierId;
    const paidOthers = rtRead_('payments').filter(p => p.invoiceId === inv.id && p.id !== o.id).reduce((s, p) => s + Number(p.amountLAK || 0), 0);
    const remain = Math.round(Number(inv.netLAK || 0) - paidOthers);
    if (Number(o.amountLAK) > remain + 0.5) throw new Error('ຈຳນວນເງິນ (' + Math.round(o.amountLAK).toLocaleString('en-US') + ') ເກີນຍອດຄ້າງຂອງໃບແຈ້ງໜີ້ (' + remain.toLocaleString('en-US') + ' ກີບ)');
  }

  const row = rtFindRow_(sh, o.id);
  if (row > 0) {
    const old = rtRead_(key).find(x => x.id === o.id) || {};
    o.createdAt = old.createdAt || rtNow_();
    o.createdBy = old.createdBy || user.name;
  } else {
    o.id = sc.prefix + '-' + Utilities.formatDate(new Date(), rtTZ_(), 'yyMMddHHmmss') + '-' + Math.floor(Math.random() * 9000 + 1000);
    o.createdAt = rtNow_();
    o.createdBy = user.name;
  }
  const values = [sc.cols.map(c => o[c[0]])];
  sh.getRange(row > 0 ? row : sh.getLastRow() + 1, 1, 1, values[0].length).setValues(values);
  return o;
}

/* ---------- ນ້ຳມັນຈາກ Field_Data ---------- */
// Field_Data: [0] ເວລາ, [1] ສະໜາມ, [2] ທະບຽນ, [10] ລວມລິດ, [15] ຊົ່ວໂມງເຮັດວຽກ, [18] ໄລຍະທາງ KM
function rtFieldIndex_() {
  const sh = sfSS_().getSheetByName('Field_Data');
  const idx = {};
  if (!sh || sh.getLastRow() <= 1) return idx;
  const tz = rtTZ_();
  sh.getRange(2, 1, sh.getLastRow() - 1, 19).getValues().forEach(r => {
    if (!r[0] || !r[2]) return;
    const d = r[0] instanceof Date ? r[0] : new Date(r[0]);
    if (isNaN(d.getTime())) return;
    const k = rtPlateKey_(r[2]);
    (idx[k] = idx[k] || []).push({
      date: Utilities.formatDate(d, tz, 'yyyy-MM-dd'), station: (r[1] || '').toString(),
      liters: Number(r[10]) || 0, hours: Number(r[15]) || 0, km: Number(r[18]) || 0
    });
  });
  return idx;
}
function rtFieldSum_(idx, plate, from, to) {
  return (idx[rtPlateKey_(plate)] || []).filter(e => e.date >= from && e.date <= to)
    .reduce((s, e) => { s.liters += e.liters; s.hours += e.hours; s.km += e.km; s.count++; return s; }, { liters: 0, hours: 0, km: 0, count: 0 });
}

/* ---------- ການຄິດໄລ່ຄ່າເຊົ່າ ---------- */
function rtDaysIn_(month) { const p = month.split('-').map(Number); return new Date(p[0], p[1], 0).getDate(); }
function rtDayDiff_(a, b) {
  const pa = a.split('-').map(Number), pb = b.split('-').map(Number);
  return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 86400000);
}
function rtCheckMonth_(m) { if (!/^\d{4}-\d{2}$/.test(String(m))) throw new Error('ຮູບແບບເດືອນບໍ່ຖືກ (yyyy-MM)'); }

/**
 * ຫຼັກການ:
 *  ລາຍຊົ່ວໂມງ: ຊມ ເຮັດວຽກຈິງ × ອັດຕາ (ໜ້ອຍກວ່າຂັ້ນຕ່ຳ = ຄິດຕາມຂັ້ນຕ່ຳ; ຂັ້ນຕ່ຳສະເລ່ຍຕາມມື້ສັນຍາ ແລະ ບໍ່ນັບມື້ລົດເສຍ)
 *  ລາຍວັນ: (ມື້ເຮັດວຽກ + ມື້ລໍຖ້າວຽກ) × ອັດຕາ (ມີຂັ້ນຕ່ຳຄືກັນ) · ມື້ລົດເສຍບໍ່ຄິດເງິນ
 *  ລາຍເດືອນ: ອັດຕາ × ມື້ສັນຍາມີຜົນ ÷ ມື້ໃນເດືອນ − ມື້ລົດເສຍຕາມສັດສ່ວນ
 *  ນ້ຳມັນ: ຖ້າຜູ້ໃຫ້ເຊົ່າເປັນຜູ້ຈ່າຍ → ຫັກ (ລິດທີ່ເຕີມໃນ Field_Data × ລາຄາ/ລິດ)
 */
function rtCalcOne_(c, month, logs, fieldIdx) {
  const dim = rtDaysIn_(month), ms = month + '-01', me = month + '-' + ('0' + dim).slice(-2);
  const s = c.startDate > ms ? c.startDate : ms;
  const e = (c.endDate && c.endDate < me) ? c.endDate : me;
  if (!c.startDate || s > e) return null;
  const activeDays = rtDayDiff_(s, e) + 1;
  const L = logs.filter(l => l.contractId === c.id && l.date >= s && l.date <= e);
  const daysOf = st => Object.keys(L.filter(l => l.status === st).reduce((o, l) => { o[l.date] = 1; return o; }, {})).length;
  const workDays = daysOf('work'), standbyDays = daysOf('standby'), breakdownDays = daysOf('breakdown');
  const workedHours = rtRound_(L.filter(l => l.status === 'work').reduce((t, l) => t + Number(l.hours || 0), 0), 2);
  const fuel = rtFieldSum_(fieldIdx || {}, c.plate, s, e);

  const rate = Number(c.rate) || 0;
  const fx = (!c.currency || c.currency === 'LAK') ? 1 : Number(c.fx) || 0;
  const minQty = Number(c.minQty) || 0;
  const minProrated = rtRound_(minQty * Math.max(0, activeDays - breakdownDays) / dim, 2);
  let qty, unit, gross, breakdown = 0, minApplied = false;
  if (c.rateType === 'hour') {
    unit = 'ຊມ'; qty = workedHours;
    if (minQty > 0 && qty < minProrated) { qty = minProrated; minApplied = true; }
    gross = qty * rate;
  } else if (c.rateType === 'day') {
    unit = 'ມື້'; qty = workDays + standbyDays;
    if (minQty > 0 && qty < minProrated) { qty = minProrated; minApplied = true; }
    gross = qty * rate;
  } else {
    unit = 'ມື້'; qty = activeDays;
    gross = rate * activeDays / dim; breakdown = rate * breakdownDays / dim;
  }
  const grossLAK = Math.round(gross * fx), breakdownLAK = Math.round(breakdown * fx);
  const fuelLAK = c.fuelBy === 'supplier' ? Math.round(fuel.liters * (Number(c.fuelPriceLAK) || 0)) : 0;
  return {
    contractId: c.id, contractNo: c.contractNo, supplierId: c.supplierId, plate: c.plate, vehicle: c.vehicle, site: c.site,
    rateType: c.rateType, rate: rate, currency: c.currency || 'LAK', fx: fx, periodStart: s, periodEnd: e, activeDays: activeDays,
    workDays: workDays, standbyDays: standbyDays, breakdownDays: breakdownDays, workedHours: workedHours,
    fieldHours: rtRound_(fuel.hours, 2), fieldKm: rtRound_(fuel.km, 2), fuelLiters: rtRound_(fuel.liters, 2), fuelBy: c.fuelBy,
    qty: rtRound_(qty, 2), unit: unit, minApplied: minApplied, minProrated: minProrated, gross: rtRound_(gross, 2),
    grossLAK: grossLAK, breakdownLAK: breakdownLAK, fuelLAK: fuelLAK, netLAK: Math.max(0, grossLAK - breakdownLAK - fuelLAK), logCount: L.length
  };
}

function rtCalcMonth_(month, d, fieldIdx) {
  const out = [];
  d.contracts.forEach(c => {
    if (c.status === 'closed' && !d.logs.some(l => l.contractId === c.id && String(l.date).slice(0, 7) === month)) return;
    const r = rtCalcOne_(c, month, d.logs, fieldIdx);
    if (!r) return;
    const sp = d.suppliers.find(x => x.id === c.supplierId);
    r.supplierName = sp ? sp.name : '';
    const inv = d.invoices.find(i => i.month === month && i.contractId === c.id);
    r.invoiceId = inv ? inv.id : '';
    out.push(r);
  });
  return out;
}

/** ອ່ານຂໍ້ມູນທີ່ຜູ້ໃຊ້ຄົນນີ້ມີສິດເຫັນ */
function rtScoped_(user) {
  const restrict = rtRestrict_(user);
  const contracts = rtRead_('contracts').filter(c => !restrict || restrict.includes(c.site));
  const ids = new Set(contracts.map(c => c.id));
  const invoices = rtRead_('invoices').filter(i => ids.has(i.contractId));
  const invIds = new Set(invoices.map(i => i.id));
  return {
    suppliers: rtRead_('suppliers'), contracts: contracts,
    logs: rtRead_('logs').filter(l => ids.has(l.contractId)),
    invoices: invoices, payments: rtRead_('payments').filter(p => invIds.has(p.invoiceId))
  };
}

/* ---------- ຟັງຊັນທີ່ໜ້າຈໍເອີ້ນ (ທຸກຟັງຊັນຮັບ requesterUsername ກ່ອນ) ---------- */

function rtLoadAll_impl_(requesterUsername) {
  try {
    const user = rtRequireAny_(requesterUsername);
    const restrict = rtRestrict_(user);
    const d = rtScoped_(user);
    const today = rtToday_();
    let stations = getAllStationNames_();
    if (restrict) stations = stations.filter(s => restrict.includes(s));
    const plates = Object.keys(getVehicleStationMap_());
    d.today = today;
    d.perm = rtPerm_(user);
    d.stations = stations;
    d.groupStations = user.role === 'Admin' ? sfGroupStations_() : [];
    d.isAdmin = user.role === 'Admin';
    d.plates = plates.sort();
    d.supervisors = getPeopleLists_().supervisors;
    d.billingThisMonth = rtCalcMonth_(today.slice(0, 7), d, rtFieldIndex_());
    return { success: true, data: d };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function rtSave_impl_(requesterUsername, key, obj) {
  const lock = LockService.getScriptLock();
  try {
    rtCheckKey_(key);
    if (key === 'invoices') throw new Error('ໃບແຈ້ງໜີ້ສ້າງຈາກໜ້າ "ຄິດໄລ່ຄ່າເຊົ່າ" ເທົ່ານັ້ນ');
    const user = rtRequire_(requesterUsername, RT_KEY_PAGE[key], 'edit');
    lock.waitLock(20000);
    rtWrite_(key, obj, user);
    lock.releaseLock();
    return rtLoadAll(requesterUsername);
  } catch (e) {
    try { lock.releaseLock(); } catch (x) {}
    return { success: false, error: e.toString() };
  }
}

function rtDelete_impl_(requesterUsername, key, id) {
  const lock = LockService.getScriptLock();
  try {
    rtCheckKey_(key);
    const user = rtRequire_(requesterUsername, RT_KEY_PAGE[key] || 'contracts', 'edit');
    lock.waitLock(20000);
    const scoped = rtScoped_(user);
    const visible = key === 'suppliers' ? scoped.suppliers : scoped[key];
    if (!visible.some(x => x.id === id)) throw new Error('ບໍ່ພົບລາຍການ ຫຼື ທ່ານບໍ່ມີສິດລຶບ');
    if (key === 'suppliers' && rtRead_('contracts').some(c => c.supplierId === id)) throw new Error('ລຶບບໍ່ໄດ້: ຜູ້ໃຫ້ເຊົ່ານີ້ຍັງມີສັນຍາ');
    if (key === 'contracts' && (rtRead_('logs').some(l => l.contractId === id) || rtRead_('invoices').some(i => i.contractId === id)))
      throw new Error('ລຶບບໍ່ໄດ້: ສັນຍານີ້ມີບັນທຶກ ຫຼື ໃບແຈ້ງໜີ້ແລ້ວ — ໃຫ້ປ່ຽນສະຖານະເປັນ "ປິດສັນຍາ" ແທນ');
    if (key === 'invoices' && rtRead_('payments').some(p => p.invoiceId === id)) throw new Error('ລຶບບໍ່ໄດ້: ໃບແຈ້ງໜີ້ນີ້ມີການຈ່າຍເງິນແລ້ວ');
    if (key === 'logs') { const lg = rtRead_('logs').find(l => l.id === id); if (lg) rtAssertMonthOpen_(lg.contractId, lg.date); }
    const sh = rtSheet_(key), row = rtFindRow_(sh, id);
    if (row > 0) sh.deleteRow(row);
    lock.releaseLock();
    return rtLoadAll(requesterUsername);
  } catch (e) {
    try { lock.releaseLock(); } catch (x) {}
    return { success: false, error: e.toString() };
  }
}

function rtComputeBilling_impl_(requesterUsername, month) {
  try {
    const user = rtRequire_(requesterUsername, 'billing', 'view');
    rtCheckMonth_(month);
    return { success: true, rows: rtCalcMonth_(month, rtScoped_(user), rtFieldIndex_()) };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function rtSaveInvoices_impl_(requesterUsername, month, contractIds) {
  const lock = LockService.getScriptLock();
  try {
    const user = rtRequire_(requesterUsername, 'billing', 'edit');
    rtCheckMonth_(month);
    lock.waitLock(30000);
    const ids = contractIds || [];
    const rows = rtCalcMonth_(month, rtScoped_(user), rtFieldIndex_()).filter(r => ids.indexOf(r.contractId) >= 0);
    rows.forEach(r => rtWrite_('invoices', {
      id: r.invoiceId, month: month, contractId: r.contractId, supplierId: r.supplierId, qty: r.qty, unit: r.unit,
      workedHours: r.workedHours, workDays: r.workDays, breakdownDays: r.breakdownDays, gross: r.gross, currency: r.currency,
      fx: r.fx, grossLAK: r.grossLAK, breakdownLAK: r.breakdownLAK, fuelLiters: r.fuelLiters, fuelLAK: r.fuelLAK, netLAK: r.netLAK
    }, user));
    lock.releaseLock();
    const res = rtLoadAll(requesterUsername);
    res.saved = rows.length;
    return res;
  } catch (e) {
    try { lock.releaseLock(); } catch (x) {}
    return { success: false, error: e.toString() };
  }
}

/** ດຶງ ຊມ/KM/ນ້ຳມັນ ຂອງລົດໃນວັນທີນັ້ນ ຈາກບັນທຶກນ້ຳມັນ (ໃຊ້ຕອນບັນທຶກປະຈຳວັນ) */
function rtFieldDay_impl_(requesterUsername, plate, dateStr) {
  try {
    rtRequire_(requesterUsername, 'logs', 'view');
    const s = rtFieldSum_(rtFieldIndex_(), plate, dateStr, dateStr);
    return { success: true, hours: rtRound_(s.hours, 2), km: rtRound_(s.km, 2), liters: rtRound_(s.liters, 2), count: s.count };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/* ---------- ແຈ້ງເຕືອນສັນຍາໃກ້ໝົດ (LINE ກຸ່ມ + Email) ---------- */
function rtCheckExpiringContracts_impl_() {
  const today = rtToday_();
  const sups = rtRead_('suppliers');
  const list = rtRead_('contracts').filter(c => c.status !== 'closed' && c.endDate && c.endDate >= today && rtDayDiff_(today, c.endDate) <= RT_EXPIRY_ALERT_DAYS);
  if (!list.length) return 'ບໍ່ມີສັນຍາໃກ້ໝົດ';
  const lines = list.map(c => {
    const sp = sups.find(x => x.id === c.supplierId);
    return `• ${c.plate} ${c.vehicle ? '(' + c.vehicle + ')' : ''} — ${sp ? sp.name : '-'}\n   📍 ${c.site} · ໝົດ ${c.endDate} (ອີກ ${rtDayDiff_(today, c.endDate)} ມື້)`;
  });
  const msg = `🚜 ແຈ້ງເຕືອນ: ສັນຍາລົດເຊົ່າໃກ້ໝົດອາຍຸ ${list.length} ສັນຍາ\n` + lines.join('\n');
  sendLineNotification(msg);
  if (ALERT_EMAILS && ALERT_EMAILS.length) {
    try { MailApp.sendEmail(ALERT_EMAILS.join(','), '🚜 ສັນຍາລົດເຊົ່າໃກ້ໝົດອາຍຸ', msg); } catch (e) { Logger.log('rt mail: ' + e); }
  }
  return msg;
}

/** 🛠️ Run ຄັ້ງດຽວ: ກວດສັນຍາໃກ້ໝົດທຸກມື້ ເວລາ 7 ໂມງເຊົ້າ */
function rtInstallDailyTrigger_impl_() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'rtCheckExpiringContracts').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('rtCheckExpiringContracts').timeBased().everyDays(1).atHour(7).create();
  return 'ຕັ້ງແຈ້ງເຕືອນປະຈຳວັນແລ້ວ';
}


// ==========================================================================================
// 🔧 ບັນທຶກການສ້ອມແປງລົດ-ກົນຈັກ (MAINTENANCE MODULE) — ເພີ່ມເຂົ້າ SMART FUEL v5
// ສິດລາຍໜ້າ: mtOverview (none/view) · mtForm (none/edit) · mtHistory, mtVehicles (none/view/edit) · mtReport (none/view) · Admin ໄດ້ທຸກສິດ
// ເລກໄມລ໌ປັດຈຸບັນຂອງລົດ (ກມ) ດຶງອັດຕະໂນມັດຈາກ Field_Data (ເລກ KM ຫຼັງ ຂອງການເຕີມນ້ຳມັນຄັ້ງລ່າສຸດ)
// ຕັ້ງຄ່າຄັ້ງທຳອິດ: Run mtSetup 1 ຄັ້ງ · ແຈ້ງເຕືອນກຳນົດປ່ຽນອະໄຫຼ່ທາງ LINE: Run mtInstallDailyTrigger 1 ຄັ້ງ
// ==========================================================================================

const MT_DOC_ALERT_DAYS = 30;   // ແຈ້ງເຕືອນເອກະສານລົດ (ປະກັນໄພ/ພາສີ/ກວດສະພາບ) ກ່ອນໝົດອາຍຸ (ມື້)
const MT_DUE_DATE_WARN_DAYS = 15; // ອະໄຫຼ່ທີ່ປ່ຽນຕາມເດືອນ: ແຈ້ງ "ໃກ້ຮອດ" ກ່ອນ (ມື້)
const MT_DEFAULT_RATES = { THB: 690, USD: 22700, CNY: 3400 };

// 🔐 ສິດລາຍໜ້າຂອງລະບົບສ້ອມແປງ (ກຳນົດໃນໜ້າຈັດການຜູ້ໃຊ້)
const MT_PAGES = { overview: 'mtOverview', request: 'mtRequest', approve: 'mtApprove', reqEdit: 'mtReqEdit', sigRequester: 'mtSigRequester', sigSite: 'mtSigSite', sigMech: 'mtSigMech', sigApprover: 'mtSigApprover', form: 'mtForm', history: 'mtHistory', vehicles: 'mtVehicles', report: 'mtReport' };
const MT_PAGE_LABELS = { overview: 'ພາບລວມ ແລະ ກຳນົດປ່ຽນ', request: 'ໃບສະເໜີສ້ອມແປງ', approve: 'ອະນຸມັດໃບສະເໜີ', reqEdit: 'ແກ້ໄຂ / ຍົກເລີກ ໃບສະເໜີ', sigRequester: 'ລົງນາມ: ຜູ້ສະເໜີ', sigSite: 'ລົງນາມ: ຫົວໜ້າສະໜາມ', sigMech: 'ລົງນາມ: ພະແນກກົນຈັກ', sigApprover: 'ລົງນາມ: ຜູ້ອະນຸມັດ', form: 'ບັນທຶກການສ້ອມແປງ', history: 'ປະຫວັດສ້ອມແປງ', vehicles: 'ທະບຽນລົດ-ກົນຈັກ', report: 'ລາຍງານຄ່າສ້ອມແປງ' };
function mtPerm_(user) {
  const o = {};
  Object.keys(MT_PAGES).forEach(pg => {
    const k = MT_PAGES[pg], lim = PERMISSION_LEVEL_LIMITS[k] || ['none', 'view', 'edit'];
    o[pg] = (user.role === 'Admin' && SUPER_GRANT_KEYS.indexOf(k) >= 0) ? (hasPermission_(user, k, 'edit') ? 'edit' : 'none')
      : user.role === 'Admin' ? lim[lim.length - 1] : ((user.permissions && user.permissions[k]) || 'none');
  });
  return o;
}
function mtCan_(user, page, level) { return hasPermission_(user, MT_PAGES[page], level); }
function mtRequire_(username, page, level) {
  const user = requireActiveUser_(username);
  if (!mtCan_(user, page, level)) throw new Error('ທ່ານບໍ່ມີສິດ' + (level === 'edit' ? 'ແກ້ໄຂ' : 'ເບິ່ງ') + 'ໃນໜ້າ "' + MT_PAGE_LABELS[page] + '"');
  return user;
}
function mtRequireAny_(username) {
  const user = requireActiveUser_(username);
  if (!Object.keys(MT_PAGES).some(pg => mtCan_(user, pg, 'view'))) throw new Error('ທ່ານບໍ່ມີສິດເຂົ້າລະບົບສ້ອມແປງ');
  return user;
}

const MT_SCHEMA = {
  vehicles: { sheet: 'MT_Vehicles', prefix: 'VH', cols: [
    ['id', 'ລະຫັດ', 's'], ['plate', 'ທະບຽນ', 's'], ['model', 'ຍີ່ຫໍ້/ລຸ້ນ', 's'], ['type', 'ປະເພດ', 's'], ['unit', 'ໜ່ວຍວັດ(km/hr)', 's'],
    ['station', 'ສະໜາມປະຈຳ', 's'], ['year', 'ປີຜະລິດ', 's'], ['chassisNo', 'ເລກຖັງ', 's'], ['engineNo', 'ເລກຈັກ', 's'],
    ['ownership', 'ກຳມະສິດ', 's'], ['meter', 'ເລກໄມລ໌/ຊມ (ປ້ອນເອງ)', 'n'], ['driver', 'ຄົນຂັບປະຈຳ', 's'],
    ['insuranceExp', 'ປະກັນໄພໝົດ', 'd'], ['taxExp', 'ພາສີ/ທະບຽນໝົດ', 'd'], ['inspectExp', 'ກວດສະພາບໝົດ', 'd'],
    ['status', 'ສະຖານະ', 's'], ['note', 'ໝາຍເຫດ', 's'], ['createdAt', 'ວັນທີສ້າງ', 'dt'], ['createdBy', 'ຜູ້ສ້າງ', 's']] },
  records: { sheet: 'MT_Records', prefix: 'MR', cols: [
    ['id', 'ລະຫັດ', 's'], ['docNo', 'ເລກທີໃບສ້ອມ', 's'], ['date', 'ວັນທີ', 'd'], ['plate', 'ທະບຽນ', 's'], ['station', 'ສະໜາມ', 's'],
    ['meter', 'ເລກໄມລ໌/ຊມ', 'n'], ['kind', 'ປະເພດວຽກ', 's'], ['status', 'ສະຖານະວຽກ', 's'],
    ['symptom', 'ອາການ/ບັນຫາ', 's'], ['cause', 'ສາເຫດ', 's'], ['workDone', 'ວຽກທີ່ເຮັດ', 's'],
    ['shopType', 'ສ້ອມທີ່', 's'], ['shop', 'ຊື່ອູ່/ຮ້ານ', 's'], ['mechanic', 'ຊ່າງ', 's'], ['reporter', 'ຜູ້ແຈ້ງ/ຄົນຂັບ', 's'], ['approver', 'ຜູ້ອະນຸມັດ', 's'],
    ['downStart', 'ລົດຢຸດແຕ່', 'd'], ['downEnd', 'ລົດໃຊ້ໄດ້ຄືນ', 'd'],
    ['laborAmt', 'ຄ່າແຮງ', 'n'], ['laborCur', 'ສະກຸນຄ່າແຮງ', 's'], ['otherAmt', 'ຄ່າໃຊ້ຈ່າຍອື່ນ', 'n'], ['otherCur', 'ສະກຸນອື່ນ', 's'], ['otherNote', 'ລາຍການອື່ນ', 's'],
    ['rates', 'ອັດຕາແລກປ່ຽນ(JSON)', 's'], ['partsLAK', 'ຄ່າອະໄຫຼ່(ກີບ)', 'n'], ['laborLAK', 'ຄ່າແຮງ(ກີບ)', 'n'], ['otherLAK', 'ອື່ນໆ(ກີບ)', 'n'], ['totalLAK', 'ລວມ(ກີບ)', 'n'],
    ['invoiceNo', 'ເລກໃບບິນ', 's'], ['nextMeter', 'ນັດບຳລຸງຄັ້ງຕໍ່ໄປ(ໄມລ໌/ຊມ)', 'n'], ['nextDate', 'ນັດບຳລຸງຄັ້ງຕໍ່ໄປ(ວັນທີ)', 'd'],
    ['photos', 'ຮູບ/ເອກະສານ', 's'], ['note', 'ໝາຍເຫດ', 's'], ['createdAt', 'ວັນທີສ້າງ', 'dt'], ['createdBy', 'ຜູ້ສ້າງ', 's'],
    ['requestId', 'ລະຫັດໃບສະເໜີ', 's']] },
  parts: { sheet: 'MT_Parts', prefix: 'PT', cols: [
    ['id', 'ລະຫັດ', 's'], ['recordId', 'ລະຫັດໃບສ້ອມ', 's'], ['date', 'ວັນທີ', 'd'], ['plate', 'ທະບຽນ', 's'], ['meter', 'ເລກໄມລ໌/ຊມ', 'n'],
    ['name', 'ຊື່ອະໄຫຼ່', 's'], ['partNo', 'ເລກອະໄຫຼ່', 's'], ['brand', 'ຍີ່ຫໍ້', 's'], ['qty', 'ຈຳນວນ', 'n'], ['uom', 'ໜ່ວຍ', 's'],
    ['price', 'ລາຄາ/ໜ່ວຍ', 'n'], ['cur', 'ສະກຸນ', 's'], ['amountLAK', 'ເປັນກີບ', 'n'],
    ['intervalMeter', 'ໄລຍະປ່ຽນ(ກມ/ຊມ)', 'n'], ['intervalMonths', 'ໄລຍະປ່ຽນ(ເດືອນ)', 'n'], ['warrantyMonths', 'ຮັບປະກັນ(ເດືອນ)', 'n']] },
  settings: { sheet: 'MT_Settings', prefix: 'ST', cols: [['id', 'key', 's'], ['value', 'value', 's']] },
  requests: { sheet: 'MT_Requests', prefix: 'RQ', cols: [
    ['id', 'ລະຫັດ', 's'], ['reqNo', 'ເລກທີໃບສະເໜີ', 's'], ['date', 'ວັນທີ', 'd'], ['plate', 'ທະບຽນ', 's'], ['station', 'ສະໜາມ', 's'],
    ['meter', 'ເລກໄມລ໌/ຊມ', 'n'], ['category', 'ລະບົບທີ່ເສຍ', 's'], ['urgency', 'ຄວາມດ່ວນ', 's'], ['canRun', 'ລົດຍັງໃຊ້ໄດ້', 's'],
    ['symptom', 'ອາການ/ບັນຫາ', 's'], ['requestedBy', 'ຜູ້ສະເໜີ', 's'], ['phone', 'ເບີໂທ', 's'],
    ['items', 'ລາຍການຄາດຄະເນ(JSON)', 's'], ['estLaborAmt', 'ຄ່າແຮງຄາດຄະເນ', 'n'], ['estLaborCur', 'ສະກຸນຄ່າແຮງ', 's'], ['estTotalLAK', 'ຄາດຄະເນລວມ(ກີບ)', 'n'],
    ['shopType', 'ສ້ອມທີ່', 's'], ['shop', 'ອູ່/ຮ້ານທີ່ສະເໜີ', 's'], ['photos', 'ຮູບ', 's'], ['status', 'ສະຖານະ', 's'],
    ['approver', 'ຜູ້ອະນຸມັດ', 's'], ['decidedAt', 'ວັນທີອະນຸມັດ', 'dt'], ['approvedLAK', 'ວົງເງິນອະນຸມັດ(ກີບ)', 'n'], ['decisionNote', 'ຄຳເຫັນຜູ້ອະນຸມັດ', 's'],
    ['recordId', 'ລະຫັດໃບສ້ອມ', 's'], ['createdAt', 'ວັນທີສ້າງ', 'dt'], ['createdBy', 'ຜູ້ສ້າງ', 's'], ['createdByEmail', 'Email ຜູ້ສ້າງ', 's'], ['sigs', 'ລາຍເຊັນ (JSON)', 's']] }
};

/* ---------- ພື້ນຖານ ---------- */
function mtRestrict_(user) { return (user.role !== 'Admin' && user.stations && user.stations.length) ? user.stations : null; }
function mtKey_(p) { return (p || '').toString().replace(/\s+/g, '').toLowerCase(); }
function mtR_(n, d) { const f = Math.pow(10, d || 0); return Math.round((Number(n) || 0) * f) / f; }

function mtSheet_(key) {
  const sc = MT_SCHEMA[key];
  if (!sc) throw new Error('ບໍ່ຮູ້ຈັກຕາຕະລາງ: ' + key);
  const ss = sfSS_();
  let sh = ss.getSheetByName(sc.sheet);
  if (!sh) {
    sh = ss.insertSheet(sc.sheet);
    sh.getRange(1, 1, 1, sc.cols.length).setValues([sc.cols.map(c => c[1])]).setFontWeight('bold').setBackground('#1a365d').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    sc.cols.forEach((c, i) => { if (c[2] !== 'n') sh.getRange(2, i + 1, sh.getMaxRows() - 1, 1).setNumberFormat('@'); });
  } else if (sh.getLastColumn() < sc.cols.length) {
    // ເພີ່ມຫົວຖັນໃໝ່ໃຫ້ Sheet ເກົ່າ (ເມື່ອລະບົບອັບເດດ ແລະ ມີຖັນເພີ່ມ)
    const from = sh.getLastColumn() + 1, add = sc.cols.slice(from - 1);
    if (sh.getMaxColumns() < sc.cols.length) sh.insertColumnsAfter(sh.getMaxColumns(), sc.cols.length - sh.getMaxColumns());
    sh.getRange(1, from, 1, add.length).setValues([add.map(c => c[1])]).setFontWeight('bold').setBackground('#1a365d').setFontColor('#ffffff');
    add.forEach((c, i) => { if (c[2] !== 'n') sh.getRange(2, from + i, sh.getMaxRows() - 1, 1).setNumberFormat('@'); });
  }
  return sh;
}

/** 🛠️ Run ຄັ້ງດຽວ: ສ້າງ Sheet ຂອງລະບົບສ້ອມແປງ */
function mtSetup_impl_() { Object.keys(MT_SCHEMA).forEach(mtSheet_); return 'ສ້າງ Sheet ສ້ອມແປງຮຽບຮ້ອຍ'; }

function mtRead_(key) {
  const sc = MT_SCHEMA[key], sh = mtSheet_(key), n = sh.getLastRow() - 1;
  if (n < 1) return [];
  const tz = Session.getScriptTimeZone();
  return sh.getRange(2, 1, n, sc.cols.length).getValues().filter(r => r[0] !== '' && r[0] !== null).map((r, i) => {
    const o = { _row: i + 2 };
    sc.cols.forEach((c, j) => {
      let v = r[j];
      if (v instanceof Date) v = Utilities.formatDate(v, tz, c[2] === 'dt' ? 'yyyy-MM-dd HH:mm' : 'yyyy-MM-dd');
      else if (c[2] === 'n') v = (v === '' || v === null) ? '' : Number(v) || 0;
      else v = (v === null || v === undefined) ? '' : String(v);
      o[c[0]] = v;
    });
    return o;
  });
}
function mtNorm_(key, obj) {
  const o = {};
  MT_SCHEMA[key].cols.forEach(c => {
    let v = obj ? obj[c[0]] : '';
    if (v === undefined || v === null) v = '';
    o[c[0]] = c[2] === 'n' ? (v === '' ? '' : Number(v) || 0) : String(v).trim();
  });
  return o;
}
function mtNewId_(prefix) {
  return prefix + '-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyMMddHHmmss') + '-' + Math.floor(Math.random() * 9000 + 1000);
}
function mtPut_(key, o, rowIdx) {
  const sc = MT_SCHEMA[key], sh = mtSheet_(key);
  const values = [sc.cols.map(c => o[c[0]] === undefined ? '' : o[c[0]])];
  sh.getRange(rowIdx > 0 ? rowIdx : sh.getLastRow() + 1, 1, 1, values[0].length).setValues(values);
}
function mtDeleteRows_(key, rows) {
  const sh = mtSheet_(key);
  rows.sort((a, b) => b - a).forEach(r => sh.deleteRow(r));
}
function mtNow_() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm'); }
function mtToday_() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'); }
function mtAddMonths_(iso, n) {
  const p = iso.split('-').map(Number);
  const d = new Date(Date.UTC(p[0], p[1] - 1 + Number(n), 1));
  const dim = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + Math.min(p[2], dim)).slice(-2);
}
function mtDays_(a, b) {
  const pa = a.split('-').map(Number), pb = b.split('-').map(Number);
  return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 86400000);
}

/* ---------- ອັດຕາແລກປ່ຽນ ---------- */
function mtGetRates_() {
  const row = mtRead_('settings').find(s => s.id === 'rates');
  if (!row) return Object.assign({}, MT_DEFAULT_RATES);
  try { return Object.assign({}, MT_DEFAULT_RATES, JSON.parse(row.value)); } catch (e) { return Object.assign({}, MT_DEFAULT_RATES); }
}
function mtToLAK_(amt, cur, rates) { return (Number(amt) || 0) * ((!cur || cur === 'LAK') ? 1 : (Number(rates[cur]) || 0)); }

/* ---------- ຂໍ້ມູນຈາກລະບົບນ້ຳມັນ (Field_Data) ---------- */
// [0] ເວລາ, [1] ສະໜາມ, [2] ທະບຽນ, [3] ປະເພດລົດ, [4] ລຸ້ນ, [17] KM ຫຼັງ
function mtFieldInfo_() {
  const info = {};
  const ss = sfSS_();
  const sh = ss.getSheetByName('Field_Data');
  const tz = Session.getScriptTimeZone();
  if (sh && sh.getLastRow() > 1) {
    sh.getRange(2, 1, sh.getLastRow() - 1, 18).getValues().forEach(r => {
      if (!r[0] || !r[2]) return;
      const d = r[0] instanceof Date ? r[0] : new Date(r[0]);
      if (isNaN(d.getTime())) return;
      const k = mtKey_(r[2]), date = Utilities.formatDate(d, tz, 'yyyy-MM-dd');
      const x = info[k] || (info[k] = { plate: r[2].toString().trim(), odo: 0, odoDate: '', lastDate: '', station: '', type: '', model: '', fills: 0 });
      x.fills++;
      const km = Number(r[17]) || 0;
      if (km > 0 && date >= x.odoDate) { x.odo = km; x.odoDate = date; } // ໃຊ້ເລກຂອງການເຕີມຄັ້ງລ່າສຸດ (ບໍ່ແມ່ນຄ່າສູງສຸດ) ເພື່ອບໍ່ໃຫ້ເລກພິມຜິດຄ້າງຕະຫຼອດ
      if (date >= x.lastDate) { x.lastDate = date; x.station = (r[1] || '').toString(); x.type = (r[3] || '').toString(); x.model = (r[4] || '').toString(); }
    });
  }
  const vs = getVehicleStationMap_();
  Object.keys(vs).forEach(p => {
    const k = mtKey_(p);
    const x = info[k] || (info[k] = { plate: p, odo: 0, odoDate: '', lastDate: '', station: '', type: '', model: '', fills: 0 });
    x.homeStation = vs[p];
  });
  return info;
}

/** ເລກໄມລ໌/ຊມ ປັດຈຸບັນ = ຄ່າສູງສຸດຈາກ: ປ້ອນເອງ, ໃບສ້ອມ, ບັນທຶກນ້ຳມັນ (ສະເພາະ km) */
/** ເລກໄມລ໌/ຊມ ປັດຈຸບັນ = ແຫຼ່ງທີ່ມີວັນທີລ່າສຸດ (ບັນທຶກນ້ຳມັນ ຫຼື ໃບສ້ອມ). ເລກປ້ອນເອງ ໃຊ້ເມື່ອບໍ່ມີແຫຼ່ງອື່ນ */
function mtMeterNow_(v, records, field) {
  let best = null;
  const offer = (meter, date, src) => {
    meter = Number(meter) || 0; if (meter <= 0) return;
    if (!best || date > best.date || (date === best.date && meter > best.meter)) best = { meter: meter, date: date, source: src };
  };
  records.forEach(r => { if (mtKey_(r.plate) === mtKey_(v.plate)) offer(r.meter, String(r.date || ''), 'ໃບສ້ອມ ' + r.date); });
  const f = field[mtKey_(v.plate)];
  if (v.unit !== 'hr' && f && f.odo > 0) offer(f.odo, f.odoDate, 'ບັນທຶກນ້ຳມັນ ' + f.odoDate);
  if (best) return { meter: best.meter, source: best.source };
  return { meter: Number(v.meter) || 0, source: 'ປ້ອນເອງ' };
}

/* ---------- ກຳນົດປ່ຽນອະໄຫຼ່ ແລະ ເອກະສານ ---------- */
function mtDueList_(vehicles, records, parts, field, today) {
  const out = [];
  const recById = {}; records.forEach(r => { recById[r.id] = r; });
  vehicles.forEach(v => {
    if (v.status === 'inactive') return;
    const vk = mtKey_(v.plate), now = mtMeterNow_(v, records, field).meter;
    const u = v.unit === 'hr' ? 'ຊມ' : 'ກມ';
    const warnMeter = iv => Math.max(iv * 0.1, v.unit === 'hr' ? 25 : 500);
    const latest = {};
    parts.filter(p => mtKey_(p.plate) === vk && (Number(p.intervalMeter) > 0 || Number(p.intervalMonths) > 0))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (Number(a.meter) - Number(b.meter))))
      .forEach(p => { latest[p.name.trim().toLowerCase()] = p; });
    const push = (label, lastDate, lastMeter, ivM, ivMo, recordId) => {
      let st = 'ok', dueMeter = '', left = '', dueDate = '', daysLeft = '';
      if (ivM > 0) { dueMeter = Number(lastMeter) + ivM; left = dueMeter - now; if (left <= 0) st = 'bad'; else if (left <= warnMeter(ivM)) st = 'warn'; }
      if (ivMo > 0) {
        dueDate = mtAddMonths_(lastDate, ivMo); daysLeft = mtDays_(today, dueDate);
        if (daysLeft <= 0) st = 'bad'; else if (daysLeft <= MT_DUE_DATE_WARN_DAYS && st !== 'bad') st = 'warn';
      }
      out.push({ plate: v.plate, model: v.model, station: v.station, unit: u, item: label, lastDate: lastDate, lastMeter: lastMeter,
        intervalMeter: ivM || '', intervalMonths: ivMo || '', dueMeter: dueMeter, left: left, dueDate: dueDate, daysLeft: daysLeft, meterNow: now, status: st, recordId: recordId });
    };
    Object.keys(latest).forEach(k => { const p = latest[k]; push(p.name, p.date, p.meter, Number(p.intervalMeter) || 0, Number(p.intervalMonths) || 0, p.recordId); });
    const svc = records.filter(r => mtKey_(r.plate) === vk && (Number(r.nextMeter) > 0 || r.nextDate)).sort((a, b) => a.date < b.date ? 1 : -1)[0];
    if (svc) {
      let st = 'ok', left = '', daysLeft = '';
      if (Number(svc.nextMeter) > 0) { left = Number(svc.nextMeter) - now; if (left <= 0) st = 'bad'; else if (left <= (v.unit === 'hr' ? 25 : 500)) st = 'warn'; }
      if (svc.nextDate) { daysLeft = mtDays_(today, svc.nextDate); if (daysLeft <= 0) st = 'bad'; else if (daysLeft <= MT_DUE_DATE_WARN_DAYS && st !== 'bad') st = 'warn'; }
      out.push({ plate: v.plate, model: v.model, station: v.station, unit: u, item: '🛠 ນັດບຳລຸງຮັກສາຄັ້ງຕໍ່ໄປ', lastDate: svc.date, lastMeter: svc.meter,
        intervalMeter: '', intervalMonths: '', dueMeter: svc.nextMeter || '', left: left, dueDate: svc.nextDate || '', daysLeft: daysLeft, meterNow: now, status: st, recordId: svc.id });
    }
  });
  const rank = { bad: 0, warn: 1, ok: 2 };
  return out.sort((a, b) => rank[a.status] - rank[b.status] || (Number(a.left === '' ? 1e12 : a.left) - Number(b.left === '' ? 1e12 : b.left)));
}

function mtDocAlerts_(vehicles, today) {
  const out = [];
  const L = { insuranceExp: 'ປະກັນໄພ', taxExp: 'ພາສີ/ທະບຽນ', inspectExp: 'ກວດສະພາບລົດ' };
  vehicles.forEach(v => {
    if (v.status === 'inactive') return;
    Object.keys(L).forEach(k => {
      if (!v[k]) return;
      const d = mtDays_(today, v[k]);
      if (d <= MT_DOC_ALERT_DAYS) out.push({ plate: v.plate, model: v.model, station: v.station, doc: L[k], date: v[k], daysLeft: d, status: d < 0 ? 'bad' : 'warn' });
    });
  });
  return out.sort((a, b) => a.daysLeft - b.daysLeft);
}

/* ---------- ຂອບເຂດຂໍ້ມູນຕາມສິດ ---------- */
function mtScoped_(user) {
  const restrict = mtRestrict_(user);
  const vehicles = mtRead_('vehicles').filter(v => !restrict || restrict.includes(v.station));
  const keys = new Set(vehicles.map(v => mtKey_(v.plate)));
  const records = mtRead_('records').filter(r => keys.has(mtKey_(r.plate)));
  const ids = new Set(records.map(r => r.id));
  const parts = mtRead_('parts').filter(p => ids.has(p.recordId));
  const requests = mtRead_('requests').filter(q => keys.has(mtKey_(q.plate)));
  return { vehicles: vehicles, records: records, parts: parts, requests: requests, restrict: restrict };
}
function mtClean_(arr) { return arr.map(o => { const x = Object.assign({}, o); delete x._row; return x; }); }

/* ==================== ຟັງຊັນທີ່ໜ້າຈໍເອີ້ນ ==================== */

function mtLoadAll_impl_(requesterUsername) {
  try {
    const user = mtRequireAny_(requesterUsername);
    const d = mtScoped_(user), today = mtToday_(), field = mtFieldInfo_();
    let stations = getAllStationNames_();
    if (d.restrict) stations = stations.filter(s => d.restrict.includes(s));
    const known = new Set(mtRead_('vehicles').map(v => mtKey_(v.plate)));
    const candidates = Object.keys(field).filter(k => !known.has(k)).map(k => field[k])
      .map(f => ({ plate: f.plate, model: f.model, type: f.type, station: f.homeStation || f.station, odo: f.odo, lastDate: f.lastDate, fills: f.fills }))
      .filter(c => !d.restrict || d.restrict.includes(c.station))
      .sort((a, b) => a.plate.localeCompare(b.plate));
    const vehicles = d.vehicles.map(v => { const m = mtMeterNow_(v, d.records, field); const x = Object.assign({}, v); x.meterNow = m.meter; x.meterSource = m.source; delete x._row; return x; });
    const people = getPeopleLists_();
    return { success: true, data: {
      today: today, perm: mtPerm_(user), userName: user.name,
      stations: stations, vehicles: vehicles, records: mtClean_(d.records), parts: mtClean_(d.parts), rates: mtGetRates_(),
      due: mtDueList_(d.vehicles, d.records, d.parts, field, today), docs: mtDocAlerts_(d.vehicles, today),
      candidates: candidates, drivers: people.drivers, supervisors: people.supervisors,
      requests: mtClean_(d.requests), userEmail: user.username, hasMySig: !!mtMySigUrl_(user.username),
      groupStations: user.role === 'Admin' ? sfGroupStations_() : [], isAdmin: user.role === 'Admin'
    } };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/** ບັນທຶກ / ແກ້ໄຂ ລົດ-ກົນຈັກ */
function mtSaveVehicle_impl_(requesterUsername, obj) {
  const lock = LockService.getScriptLock();
  try {
    const user = mtRequire_(requesterUsername, 'vehicles', 'edit');
    lock.waitLock(20000);
    const o = mtNorm_('vehicles', obj), restrict = mtRestrict_(user);
    if (!o.plate) throw new Error('ກະລຸນາໃສ່ທະບຽນລົດ');
    if (!o.station) throw new Error('ກະລຸນາເລືອກສະໜາມປະຈຳ');
    o.station = sfEnsureStation_(user, o.station);
    if (restrict && !restrict.includes(o.station)) throw new Error('ທ່ານບໍ່ມີສິດໃນສະໜາມ "' + o.station + '"');
    if (!o.unit) o.unit = 'km';
    if (!o.status) o.status = 'active';
    const all = mtRead_('vehicles');
    if (all.some(v => mtKey_(v.plate) === mtKey_(o.plate) && v.id !== o.id)) throw new Error('ທະບຽນ ' + o.plate + ' ມີໃນລະບົບແລ້ວ');
    const old = o.id ? all.find(v => v.id === o.id) : null;
    if (old) {
      if (restrict && !restrict.includes(old.station)) throw new Error('ທ່ານບໍ່ມີສິດແກ້ໄຂລົດຄັນນີ້');
      if (mtKey_(old.plate) !== mtKey_(o.plate) && mtRead_('records').some(r => mtKey_(r.plate) === mtKey_(old.plate)))
        throw new Error('ປ່ຽນທະບຽນບໍ່ໄດ້ ເພາະລົດຄັນນີ້ມີປະຫວັດສ້ອມແປງແລ້ວ');
      o.createdAt = old.createdAt; o.createdBy = old.createdBy;
      mtPut_('vehicles', o, old._row);
    } else {
      o.id = mtNewId_('VH'); o.createdAt = mtNow_(); o.createdBy = user.name;
      mtPut_('vehicles', o, -1);
    }
    lock.releaseLock();
    return mtLoadAll(requesterUsername);
  } catch (e) {
    try { lock.releaseLock(); } catch (x) {}
    return { success: false, error: e.toString() };
  }
}

/** ➕ ເພີ່ມລົດໃໝ່ດ່ວນ ຈາກຟອມໃບສະເໜີ / ໃບສ້ອມ (ເພີ່ມໄດ້ຢ່າງດຽວ, ແກ້ລົດເກົ່າບໍ່ໄດ້) */
function mtQuickAddVehicle_impl_(requesterUsername, obj) {
  const lock = LockService.getScriptLock();
  try {
    const user = requireActiveUser_(requesterUsername);
    if (!['vehicles', 'request', 'form', 'history'].some(pg => mtCan_(user, pg, 'edit'))) throw new Error('ທ່ານບໍ່ມີສິດເພີ່ມລົດ');
    obj = obj || {};
    const o = mtNorm_('vehicles', { plate: obj.plate, model: obj.model, type: obj.type, unit: obj.unit === 'hr' ? 'hr' : 'km', station: obj.station, meter: obj.meter, driver: obj.driver, ownership: obj.ownership || 'ບໍລິສັດ', status: 'active' });
    const restrict = mtRestrict_(user);
    if (!o.plate) throw new Error('ກະລຸນາໃສ່ທະບຽນ / ລະຫັດລົດ');
    if (!o.station) throw new Error('ກະລຸນາເລືອກສະໜາມປະຈຳ');
    if (restrict && !restrict.includes(o.station)) throw new Error('ທ່ານບໍ່ມີສິດໃນສະໜາມ "' + o.station + '"');
    if (o.meter !== '' && Number(o.meter) < 0) throw new Error('ເລກໄມລ໌ຕ້ອງບໍ່ຕິດລົບ');
    lock.waitLock(20000);
    o.station = sfEnsureStation_(user, o.station); // ສະໜາມໃໝ່ / ຈາກຕາຕະລາງກຸ່ມບໍລິສັດ → ເພີ່ມໃສ່ບໍລິສັດນີ້ (Admin)
    if (mtRead_('vehicles').some(v => mtKey_(v.plate) === mtKey_(o.plate))) throw new Error('ທະບຽນ ' + o.plate + ' ມີໃນລະບົບແລ້ວ');
    o.id = mtNewId_('VH'); o.createdAt = mtNow_(); o.createdBy = user.name;
    o.note = 'ເພີ່ມດ່ວນຈາກຟອມ';
    mtPut_('vehicles', o, -1);
    lock.releaseLock();
    const res = mtLoadAll(requesterUsername); res.savedPlate = o.plate;
    return res;
  } catch (e) {
    try { lock.releaseLock(); } catch (x) {}
    return { success: false, error: e.toString() };
  }
}

/** ນຳເຂົ້າລົດຈາກບັນທຶກນ້ຳມັນ / ລົດປະຈຳສະໜາມ */
/** ສ້າງແຖວທະບຽນລົດ ຈາກຂໍ້ມູນລົດໃນຖານຂໍ້ມູນນ້ຳມັນ / ລົດປະຈຳສະໜາມ */
function mtVehicleFromField_(f, user) {
  const isHr = /ຂຸດ|ຕັກ|ເກຣດ|ບົດ|ເຄນ|ປັ່ນໄຟ|excavator|loader|generator/i.test(f.type + ' ' + f.model);
  return mtNorm_('vehicles', { id: mtNewId_('VH'), plate: f.plate, model: f.model, type: f.type, unit: isHr ? 'hr' : 'km',
    station: f.homeStation || f.station, ownership: 'ບໍລິສັດ', status: 'active', createdAt: mtNow_(), createdBy: user.name, note: 'ລົງທະບຽນອັດຕະໂນມັດ ຈາກຖານຂໍ້ມູນລົດ' });
}

/** ຫາລົດໃນທະບຽນ; ຖ້າບໍ່ມີ ແຕ່ມີໃນຖານຂໍ້ມູນລົດຂອງລະບົບນ້ຳມັນ → ລົງທະບຽນໃຫ້ອັດຕະໂນມັດ */
function mtEnsureVehicle_(user, plate) {
  const k = mtKey_(plate);
  const found = mtRead_('vehicles').find(v => mtKey_(v.plate) === k);
  if (found) return found;
  const f = mtFieldInfo_()[k];
  if (!f) return null;
  const st = f.homeStation || f.station, restrict = mtRestrict_(user);
  if (restrict && !restrict.includes(st)) throw new Error('ທ່ານບໍ່ມີສິດໃນລົດຄັນນີ້');
  const v = mtVehicleFromField_(f, user);
  mtPut_('vehicles', v, -1);
  return v;
}

function mtImportVehicles_impl_(requesterUsername, plates) {
  const lock = LockService.getScriptLock();
  try {
    const user = mtRequire_(requesterUsername, 'vehicles', 'edit');
    lock.waitLock(20000);
    const restrict = mtRestrict_(user), field = mtFieldInfo_();
    const known = new Set(mtRead_('vehicles').map(v => mtKey_(v.plate)));
    let n = 0;
    (plates || []).forEach(p => {
      const k = mtKey_(p), f = field[k];
      if (!f || known.has(k)) return;
      const st = f.homeStation || f.station;
      if (restrict && !restrict.includes(st)) return;
      const nv = mtVehicleFromField_(f, user); nv.note = ''; mtPut_('vehicles', nv, -1);
      known.add(k); n++;
    });
    lock.releaseLock();
    const res = mtLoadAll(requesterUsername); res.imported = n;
    return res;
  } catch (e) {
    try { lock.releaseLock(); } catch (x) {}
    return { success: false, error: e.toString() };
  }
}

/** ບັນທຶກ / ແກ້ໄຂ ໃບສ້ອມແປງ ພ້ອມລາຍການອະໄຫຼ່ ແລະ ຮູບ */
function mtSaveRecord_impl_(requesterUsername, rec, parts, files, notify) {
  const lock = LockService.getScriptLock();
  try {
    const user = mtRequire_(requesterUsername, (rec && rec.id) ? 'history' : 'form', 'edit'); // ໃບໃໝ່ = ສິດບັນທຶກ, ແກ້ໄຂໃບເກົ່າ = ສິດແກ້ໄຂປະຫວັດ
    const restrict = mtRestrict_(user);
    const o = mtNorm_('records', rec);
    if (!o.date) throw new Error('ກະລຸນາໃສ່ວັນທີ');
    if (!o.plate) throw new Error('ກະລຸນາເລືອກລົດ');
    if (!o.kind) throw new Error('ກະລຸນາເລືອກປະເພດວຽກ');
    if (!o.symptom && !o.workDone) throw new Error('ກະລຸນາໃສ່ອາການ ຫຼື ວຽກທີ່ເຮັດ');
    if (o.downStart && o.downEnd && o.downEnd < o.downStart) throw new Error('ວັນທີລົດໃຊ້ໄດ້ຄືນ ຕ້ອງຫຼັງວັນທີລົດຢຸດ');
    const veh = mtEnsureVehicle_(user, o.plate);
    if (!veh) throw new Error('ບໍ່ພົບລົດ ' + o.plate + ' ໃນຖານຂໍ້ມູນລົດ. ກະລຸນາເພີ່ມລົດກ່ອນ');
    if (restrict && !restrict.includes(veh.station)) throw new Error('ທ່ານບໍ່ມີສິດໃນລົດຄັນນີ້');
    o.plate = veh.plate;
    if (!o.station) o.station = veh.station;
    if (!o.status) o.status = 'done';
    let linkReq = null;
    if (o.requestId) {
      linkReq = mtRead_('requests').find(q => q.id === o.requestId);
      if (!linkReq) throw new Error('ບໍ່ພົບໃບສະເໜີທີ່ອ້າງອີງ');
      if (['approved', 'inprogress', 'done'].indexOf(linkReq.status) < 0) throw new Error('ໃບສະເໜີ ' + linkReq.reqNo + ' ຍັງບໍ່ໄດ້ຮັບອະນຸມັດ — ສ້າງໃບສ້ອມບໍ່ໄດ້');
      if (linkReq.recordId && linkReq.recordId !== o.id) throw new Error('ໃບສະເໜີ ' + linkReq.reqNo + ' ມີໃບສ້ອມແລ້ວ');
      if (mtKey_(linkReq.plate) !== mtKey_(o.plate)) throw new Error('ທະບຽນລົດບໍ່ກົງກັບໃບສະເໜີ ' + linkReq.reqNo);
    }

    // ອັດຕາແລກປ່ຽນ: ໃຊ້ຄ່າທີ່ສົ່ງມາກັບໃບສ້ອມ (ເກັບໄວ້ຕາມມື້ບັນທຶກ)
    let rates;
    try { rates = Object.assign({}, mtGetRates_(), JSON.parse(o.rates || '{}')); } catch (e) { rates = mtGetRates_(); }
    ['THB', 'USD', 'CNY'].forEach(k => { rates[k] = Number(rates[k]) || 0; });
    o.rates = JSON.stringify({ THB: rates.THB, USD: rates.USD, CNY: rates.CNY });

    const cleanParts = (parts || []).map(p => mtNorm_('parts', p)).filter(p => p.name);
    cleanParts.forEach(p => {
      if (!p.cur) p.cur = 'LAK';
      if (p.cur !== 'LAK' && !(rates[p.cur] > 0)) throw new Error('ກະລຸນາໃສ່ອັດຕາແລກປ່ຽນ ' + p.cur);
      p.amountLAK = Math.round(mtToLAK_((Number(p.qty) || 0) * (Number(p.price) || 0), p.cur, rates));
    });
    o.partsLAK = cleanParts.reduce((s, p) => s + p.amountLAK, 0);
    o.laborLAK = Math.round(mtToLAK_(o.laborAmt, o.laborCur, rates));
    o.otherLAK = Math.round(mtToLAK_(o.otherAmt, o.otherCur, rates));
    o.totalLAK = o.partsLAK + o.laborLAK + o.otherLAK;

    // ອັບໂຫຼດຮູບ/ໃບບິນ (ໃຊ້ uploadToDrive ເດີມຂອງລະບົບ)
    const newUrls = [], uploadErrors = [];
    (files || []).filter(f => f && f.fileData && f.fileName).forEach(f => {
      try { newUrls.push(uploadToDrive(f.fileData, 'MT_' + f.fileName, o.plate)); }
      catch (upErr) { uploadErrors.push(f.fileName); Logger.log('mt upload: ' + upErr); }
    });

    lock.waitLock(30000);
    const all = mtRead_('records');
    const old = o.id ? all.find(r => r.id === o.id) : null;
    if (old) {
      const oldVeh = mtRead_('vehicles').find(v => mtKey_(v.plate) === mtKey_(old.plate));
      if (restrict && oldVeh && !restrict.includes(oldVeh.station)) throw new Error('ທ່ານບໍ່ມີສິດແກ້ໄຂໃບສ້ອມນີ້');
      o.docNo = old.docNo; o.createdAt = old.createdAt; o.createdBy = old.createdBy;
    } else {
      o.id = mtNewId_('MR');
      const ym = o.date.slice(2, 4) + o.date.slice(5, 7);
      const seq = all.filter(r => String(r.docNo).indexOf('MT' + ym + '-') === 0).length + 1;
      o.docNo = 'MT' + ym + '-' + ('00' + seq).slice(-3);
      o.createdAt = mtNow_(); o.createdBy = user.name;
    }
    const keepUrls = String(o.photos || '').split(',').map(s => s.trim()).filter(u => /^https:\/\/[^\s"'<>]+$/.test(u));
    o.photos = keepUrls.concat(newUrls).join(', ');
    mtPut_('records', o, old ? old._row : -1);

    // ລາຍການອະໄຫຼ່: ລຶບຂອງເກົ່າ ແລ້ວຂຽນໃໝ່
    mtDeleteRows_('parts', mtRead_('parts').filter(p => p.recordId === o.id).map(p => p._row));
    cleanParts.forEach(p => {
      p.id = mtNewId_('PT'); p.recordId = o.id; p.date = o.date; p.plate = o.plate; p.meter = o.meter;
      mtPut_('parts', p, -1);
    });

    // ອັບເດດສະຖານະລົດ ແລະ ເລກໄມລ໌ (ສຳລັບລົດນັບຊົ່ວໂມງ)
    const vrow = mtRead_('vehicles').find(v => v.id === veh.id);
    const openJobs = mtRead_('records').some(r => mtKey_(r.plate) === mtKey_(veh.plate) && r.status !== 'done');
    const newStatus = vrow.status === 'inactive' ? 'inactive' : (openJobs ? 'repair' : 'active');
    if (newStatus !== vrow.status) {
      vrow.status = newStatus;
      mtPut_('vehicles', vrow, vrow._row);
    }
    if (linkReq) {
      const q = mtRead_('requests').find(x => x.id === linkReq.id);
      q.recordId = o.id; q.status = o.status === 'done' ? 'done' : 'inprogress';
      mtPut_('requests', q, q._row);
    }
    lock.releaseLock();

    if (notify && notify.line) {
      const K = { service: 'ບຳລຸງຮັກສາ', part: 'ປ່ຽນອະໄຫຼ່', repair: 'ສ້ອມແປງ', tire: 'ຢາງລົດ', accident: 'ອຸບັດຕິເຫດ', inspect: 'ກວດເຊັກ' };
      const S = { done: 'ສຳເລັດ', inprogress: 'ກຳລັງສ້ອມ', waiting: 'ລໍຖ້າອະໄຫຼ່' };
      const msg = `🔧 ${old ? 'ແກ້ໄຂ' : 'ບັນທຶກ'}ການສ້ອມແປງ ${o.docNo}\n` +
        `🚗 ທະບຽນ: ${o.plate} ${veh.model ? '(' + veh.model + ')' : ''}\n📍 ສະໜາມ: ${o.station}\n` +
        `🗂 ປະເພດ: ${K[o.kind] || o.kind} · ສະຖານະ: ${S[o.status] || o.status}\n` +
        `🛣 ເລກໄມລ໌/ຊມ: ${o.meter || '-'}\n` +
        (o.symptom ? `⚠️ ອາການ: ${o.symptom}\n` : '') + (o.workDone ? `✅ ວຽກທີ່ເຮັດ: ${o.workDone}\n` : '') +
        (cleanParts.length ? `🔩 ອະໄຫຼ່: ${cleanParts.map(p => p.name + ' ×' + p.qty).join(', ')}\n` : '') +
        `💰 ລວມ: ${Math.round(o.totalLAK).toLocaleString('en-US')} ກີບ\n👨‍🔧 ຊ່າງ: ${o.mechanic || '-'} · ${o.shop || '-'}\n✍️ ຜູ້ບັນທຶກ: ${user.name}`;
      sendLineNotification(msg);
    }
    const res = mtLoadAll(requesterUsername); res.savedId = o.id; res.docNo = o.docNo; res.uploadErrors = uploadErrors;
    return res;
  } catch (e) {
    try { lock.releaseLock(); } catch (x) {}
    return { success: false, error: e.toString() };
  }
}

function mtDelete_impl_(requesterUsername, key, id) {
  const lock = LockService.getScriptLock();
  try {
    const user = mtRequire_(requesterUsername, key === 'vehicles' ? 'vehicles' : 'history', 'edit');
    lock.waitLock(20000);
    const d = mtScoped_(user);
    if (key === 'vehicles') {
      const v = d.vehicles.find(x => x.id === id);
      if (!v) throw new Error('ບໍ່ພົບລົດ ຫຼື ທ່ານບໍ່ມີສິດ');
      if (mtRead_('records').some(r => mtKey_(r.plate) === mtKey_(v.plate))) throw new Error('ລຶບບໍ່ໄດ້: ລົດຄັນນີ້ມີປະຫວັດສ້ອມແປງ — ໃຫ້ປ່ຽນສະຖານະເປັນ "ເຊົາໃຊ້ງານ" ແທນ');
      mtDeleteRows_('vehicles', [v._row]);
    } else if (key === 'records') {
      const r = d.records.find(x => x.id === id);
      if (!r) throw new Error('ບໍ່ພົບໃບສ້ອມ ຫຼື ທ່ານບໍ່ມີສິດ');
      mtDeleteRows_('parts', mtRead_('parts').filter(p => p.recordId === id).map(p => p._row));
      mtDeleteRows_('records', [mtRead_('records').find(x => x.id === id)._row]);
      const lq = mtRead_('requests').find(q => q.recordId === id);
      if (lq) { lq.recordId = ''; lq.status = 'approved'; mtPut_('requests', lq, lq._row); } // ໃບສະເໜີກັບຄືນເປັນ "ອະນຸມັດແລ້ວ"
    } else throw new Error('ລຶບບໍ່ໄດ້');
    lock.releaseLock();
    return mtLoadAll(requesterUsername);
  } catch (e) {
    try { lock.releaseLock(); } catch (x) {}
    return { success: false, error: e.toString() };
  }
}

/* ==================== 📝 ໃບສະເໜີສ້ອມແປງ ==================== */
const MT_REQ_STATUS = { pending: 'ລໍຖ້າອະນຸມັດ', approved: 'ອະນຸມັດແລ້ວ', rejected: 'ບໍ່ອະນຸມັດ', inprogress: 'ກຳລັງສ້ອມ', done: 'ສ້ອມສຳເລັດ', cancelled: 'ຍົກເລີກ' };
const MT_REQ_URGENCY = { normal: 'ປົກກະຕິ', urgent: 'ດ່ວນ', critical: 'ດ່ວນທີ່ສຸດ (ລົດຢຸດວຽກ)' };

/** ສົ່ງ / ແກ້ໄຂ ໃບສະເໜີ (ແກ້ໄດ້ສະເພາະຕອນ "ລໍຖ້າອະນຸມັດ" ແລະ ເປັນຜູ້ສົ່ງ ຫຼື ຜູ້ອະນຸມັດ) */
function mtSaveRequest_impl_(requesterUsername, req, files, notify) {
  const lock = LockService.getScriptLock();
  try {
    const user = mtRequire_(requesterUsername, (req && req.id) ? 'reqEdit' : 'request', 'edit');
    const restrict = mtRestrict_(user);
    const o = mtNorm_('requests', req);
    if (!o.date) throw new Error('ກະລຸນາໃສ່ວັນທີ');
    if (!o.plate) throw new Error('ກະລຸນາເລືອກລົດ');
    if (!o.symptom) throw new Error('ກະລຸນາອະທິບາຍອາການ / ບັນຫາ');
    const veh = mtEnsureVehicle_(user, o.plate);
    if (!veh) throw new Error('ບໍ່ພົບລົດ ' + o.plate + ' ໃນຖານຂໍ້ມູນລົດ');
    if (restrict && !restrict.includes(veh.station)) throw new Error('ທ່ານບໍ່ມີສິດໃນລົດຄັນນີ້');
    o.plate = veh.plate; o.station = veh.station;
    if (!MT_REQ_URGENCY[o.urgency]) o.urgency = 'normal';
    if (!o.requestedBy) o.requestedBy = user.name;

    // ລາຍການຄາດຄະເນ → ກີບ
    const rates = mtGetRates_();
    let items = [];
    try { items = JSON.parse(o.items || '[]'); } catch (e) { items = []; }
    items = (Array.isArray(items) ? items : []).map(it => ({ name: String(it.name || '').trim().slice(0, 120), qty: Number(it.qty) || 0, price: Number(it.price) || 0, cur: ['LAK', 'THB', 'USD', 'CNY'].includes(it.cur) ? it.cur : 'LAK' }))
      .filter(it => it.name).slice(0, 30);
    items.forEach(it => { if (it.qty < 0 || it.price < 0) throw new Error('ຈຳນວນ ແລະ ລາຄາ ຕ້ອງບໍ່ຕິດລົບ'); });
    o.items = JSON.stringify(items);
    o.estTotalLAK = Math.round(items.reduce((t, it) => t + mtToLAK_(it.qty * it.price, it.cur, rates), 0) + mtToLAK_(o.estLaborAmt, o.estLaborCur, rates));

    const newUrls = [];
    (files || []).filter(f => f && f.fileData && f.fileName).forEach(f => { try { newUrls.push(uploadToDrive(f.fileData, 'RQ_' + f.fileName, o.plate)); } catch (e) { Logger.log('rq upload: ' + e); } });

    lock.waitLock(20000);
    const all = mtRead_('requests');
    const old = o.id ? all.find(q => q.id === o.id) : null;
    if (old) {
      if (old.status !== 'pending') throw new Error('ໃບສະເໜີນີ້ຖືກພິຈາລະນາແລ້ວ — ແກ້ໄຂບໍ່ໄດ້');
      if (!mtCan_(user, 'reqEdit', 'edit')) throw new Error('ທ່ານບໍ່ມີສິດແກ້ໄຂໃບສະເໜີ (SuperAdmin ເປັນຜູ້ກຳນົດສິດ)');
      ['id', 'reqNo', 'status', 'approver', 'decidedAt', 'approvedLAK', 'decisionNote', 'recordId', 'createdAt', 'createdBy', 'createdByEmail', 'sigs'].forEach(k => { o[k] = old[k]; });
    } else {
      o.id = mtNewId_('RQ');
      const ym = o.date.slice(2, 4) + o.date.slice(5, 7);
      const seq = all.filter(q => String(q.reqNo).indexOf('RQ' + ym + '-') === 0).length + 1;
      o.reqNo = 'RQ' + ym + '-' + ('00' + seq).slice(-3);
      o.status = 'pending'; o.approver = ''; o.decidedAt = ''; o.approvedLAK = ''; o.decisionNote = ''; o.recordId = ''; o.sigs = '';
      o.createdAt = mtNow_(); o.createdBy = user.name; o.createdByEmail = user.username;
    }
    const keep = String(o.photos || '').split(',').map(s => s.trim()).filter(u => /^https:\/\/[^\s"'<>]+$/.test(u));
    o.photos = keep.concat(newUrls).join(', ');
    mtPut_('requests', o, old ? old._row : -1);
    lock.releaseLock();

    if (notify && notify.line && !old) {
      sendLineNotification(`📝 ໃບສະເໜີສ້ອມແປງໃໝ່ ${o.reqNo}\n🚗 ${o.plate} ${veh.model ? '(' + veh.model + ')' : ''}\n📍 ${o.station}\n` +
        `${o.urgency === 'normal' ? '🟢' : o.urgency === 'urgent' ? '🟠' : '🔴'} ຄວາມດ່ວນ: ${MT_REQ_URGENCY[o.urgency]}${o.canRun === 'no' ? ' · ລົດໃຊ້ງານບໍ່ໄດ້' : ''}\n` +
        `⚠️ ອາການ: ${o.symptom}\n💰 ຄາດຄະເນ: ${Number(o.estTotalLAK || 0).toLocaleString('en-US')} ກີບ\n✍️ ຜູ້ສະເໜີ: ${o.requestedBy}\n⏳ ລໍຖ້າອະນຸມັດ`);
    }
    const res = mtLoadAll(requesterUsername); res.savedId = o.id; res.reqNo = o.reqNo;
    return res;
  } catch (e) {
    try { lock.releaseLock(); } catch (x) {}
    return { success: false, error: e.toString() };
  }
}

/** ອະນຸມັດ / ບໍ່ອະນຸມັດ ໃບສະເໜີ */
function mtDecideRequest_impl_(requesterUsername, id, decision, payload, notify) {
  const lock = LockService.getScriptLock();
  try {
    const user = mtRequire_(requesterUsername, 'approve', 'edit');
    if (['approved', 'rejected'].indexOf(decision) < 0) throw new Error('ການຕັດສິນບໍ່ຖືກຕ້ອງ');
    payload = payload || {};
    lock.waitLock(20000);
    const q = mtScoped_(user).requests.find(x => x.id === id);
    if (!q) throw new Error('ບໍ່ພົບໃບສະເໜີ ຫຼື ທ່ານບໍ່ມີສິດ');
    const row = mtRead_('requests').find(x => x.id === id);
    if (row.status !== 'pending') throw new Error('ໃບສະເໜີນີ້ຖືກພິຈາລະນາແລ້ວ (' + (MT_REQ_STATUS[row.status] || row.status) + ')');
    const note = String(payload.note || '').trim().slice(0, 500);
    if (decision === 'rejected' && !note) throw new Error('ກະລຸນາໃສ່ເຫດຜົນທີ່ບໍ່ອະນຸມັດ');
    const amt = payload.approvedLAK === '' || payload.approvedLAK === undefined ? Number(row.estTotalLAK) || 0 : Number(payload.approvedLAK);
    if (decision === 'approved' && (isNaN(amt) || amt < 0)) throw new Error('ວົງເງິນອະນຸມັດບໍ່ຖືກຕ້ອງ');
    row.status = decision; row.approver = user.name; row.decidedAt = mtNow_(); row.decisionNote = note;
    // ✍️ ລົງນາມຜູ້ອະນຸມັດໃຫ້ອັດຕະໂນມັດ (ຊື່ + ລາຍເຊັນສ່ວນຕົວໃນໂປຣໄຟລ໌ ຖ້າມີ)
    try { const sg = mtSigsOf_(row); sg.approver = { name: user.name, url: mtMySigUrl_(user.username), by: user.name, email: user.username, at: row.decidedAt }; row.sigs = JSON.stringify(sg); } catch (e) {}
    row.approvedLAK = decision === 'approved' ? Math.round(amt) : '';
    mtPut_('requests', row, row._row);
    lock.releaseLock();
    if (notify && notify.line) {
      sendLineNotification(`${decision === 'approved' ? '✅ ອະນຸມັດ' : '❌ ບໍ່ອະນຸມັດ'} ໃບສະເໜີສ້ອມແປງ ${row.reqNo}\n🚗 ${row.plate} · 📍 ${row.station}\n⚠️ ${row.symptom}\n` +
        (decision === 'approved' ? `💰 ວົງເງິນອະນຸມັດ: ${Math.round(amt).toLocaleString('en-US')} ກີບ\n` : '') + (note ? `💬 ${note}\n` : '') + `👤 ໂດຍ: ${user.name}`);
    }
    return mtLoadAll(requesterUsername);
  } catch (e) {
    try { lock.releaseLock(); } catch (x) {}
    return { success: false, error: e.toString() };
  }
}

/** ຍົກເລີກໃບສະເໜີ (ສະເພາະ "ລໍຖ້າອະນຸມັດ", ໂດຍຜູ້ສົ່ງ ຫຼື ຜູ້ອະນຸມັດ) */
function mtCancelRequest_impl_(requesterUsername, id) {
  const lock = LockService.getScriptLock();
  try {
    const user = requireActiveUser_(requesterUsername);
    if (!mtCan_(user, 'reqEdit', 'edit')) throw new Error('ທ່ານບໍ່ມີສິດຍົກເລີກໃບສະເໜີ (SuperAdmin ເປັນຜູ້ກຳນົດສິດ)');
    lock.waitLock(20000);
    if (!mtScoped_(user).requests.some(x => x.id === id)) throw new Error('ບໍ່ພົບໃບສະເໜີ ຫຼື ທ່ານບໍ່ມີສິດ');
    const row = mtRead_('requests').find(x => x.id === id);
    if (row.status !== 'pending') throw new Error('ຍົກເລີກໄດ້ສະເພາະໃບສະເໜີທີ່ຍັງລໍຖ້າອະນຸມັດ');

    row.status = 'cancelled'; row.decidedAt = mtNow_(); row.decisionNote = 'ຍົກເລີກໂດຍ ' + user.name;
    mtPut_('requests', row, row._row);
    lock.releaseLock();
    return mtLoadAll(requesterUsername);
  } catch (e) {
    try { lock.releaseLock(); } catch (x) {}
    return { success: false, error: e.toString() };
  }
}

function mtSaveRates_impl_(requesterUsername, rates) {
  try {
    const user = requireActiveUser_(requesterUsername);
    if (!mtCan_(user, 'form', 'edit') && !mtCan_(user, 'history', 'edit')) throw new Error('ທ່ານບໍ່ມີສິດປ່ຽນອັດຕາແລກປ່ຽນ');
    const r = { THB: Number(rates.THB) || 0, USD: Number(rates.USD) || 0, CNY: Number(rates.CNY) || 0, updatedAt: mtNow_() };
    if (!(r.THB > 0 && r.USD > 0 && r.CNY > 0)) throw new Error('ກະລຸນາໃສ່ອັດຕາແລກປ່ຽນໃຫ້ຄົບທັງ 3 ສະກຸນ');
    const row = mtRead_('settings').find(s => s.id === 'rates');
    mtPut_('settings', { id: 'rates', value: JSON.stringify(r) }, row ? row._row : -1);
    return mtLoadAll(requesterUsername);
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/* ---------- ແຈ້ງເຕືອນປະຈຳວັນ (LINE ກຸ່ມ) ---------- */
function mtCheckDueAndNotify_impl_() {
  const today = mtToday_(), field = mtFieldInfo_();
  const vehicles = mtRead_('vehicles'), records = mtRead_('records'), parts = mtRead_('parts');
  const due = mtDueList_(vehicles, records, parts, field, today).filter(x => x.status !== 'ok');
  const docs = mtDocAlerts_(vehicles, today);
  if (!due.length && !docs.length) return 'ບໍ່ມີລາຍການແຈ້ງເຕືອນ';
  const fmtN = n => Math.round(Number(n) || 0).toLocaleString('en-US');
  let msg = `🔧 ແຈ້ງເຕືອນການບຳລຸງຮັກສາລົດ (${today})\n`;
  if (due.length) {
    msg += `\n🔴 ອະໄຫຼ່ເກີນ/ໃກ້ກຳນົດປ່ຽນ ${due.length} ລາຍການ\n` + due.slice(0, 25).map(x =>
      `${x.status === 'bad' ? '🔴' : '🟠'} ${x.plate} · ${x.item}` +
      (x.left !== '' ? ` · ${x.left <= 0 ? 'ເກີນ ' + fmtN(-x.left) : 'ເຫຼືອ ' + fmtN(x.left)} ${x.unit}` : '') +
      (x.daysLeft !== '' ? ` · ${x.daysLeft <= 0 ? 'ກາຍ ' + (-x.daysLeft) : 'ອີກ ' + x.daysLeft} ມື້` : '')).join('\n');
    if (due.length > 25) msg += `\n… ແລະ ອີກ ${due.length - 25} ລາຍການ`;
  }
  if (docs.length) msg += `\n\n📄 ເອກະສານລົດໃກ້ໝົດອາຍຸ ${docs.length} ລາຍການ\n` + docs.map(x => `• ${x.plate} · ${x.doc} ${x.daysLeft < 0 ? 'ໝົດແລ້ວ ' + (-x.daysLeft) + ' ມື້' : 'ອີກ ' + x.daysLeft + ' ມື້'} (${x.date})`).join('\n');
  sendLineNotification(msg);
  return msg;
}

/** 🛠️ Run ຄັ້ງດຽວ: ສົ່ງແຈ້ງເຕືອນກຳນົດປ່ຽນອະໄຫຼ່ທຸກມື້ 7 ໂມງເຊົ້າ */
function mtInstallDailyTrigger_impl_() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'mtCheckDueAndNotify').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('mtCheckDueAndNotify').timeBased().everyDays(1).atHour(7).create();
  return 'ຕັ້ງແຈ້ງເຕືອນປະຈຳວັນແລ້ວ';
}


/* ==================== ✍️ ລົງນາມໃບສະເໜີສ້ອມແປງ ==================== */
const MT_SIG_SLOTS = { requester: 'ຜູ້ສະເໜີ', site: 'ຫົວໜ້າສະໜາມ', mech: 'ພະແນກກົນຈັກ', approver: 'ຜູ້ອະນຸມັດ' };
function mtSigsOf_(q) { try { const o = JSON.parse(q.sigs || '{}'); return (o && typeof o === 'object') ? o : {}; } catch (e) { return {}; } }
/** ລາຍເຊັນສ່ວນຕົວ (ໂປຣໄຟລ໌) ຂອງຜູ້ໃຊ້ */
function mtMySigUrl_(email) {
  try {
    const sheet = getUsersSheet_(); if (!sheet) return '';
    const data = sheet.getDataRange().getValues();
    const ci = data[0].map(h => String(h).trim()).indexOf('PersonalSignature');
    if (ci < 0) return '';
    const row = data.find((r, i) => i > 0 && String(r[0] || '').toLowerCase() === String(email || '').toLowerCase());
    const u = row ? String(row[ci] || '') : '';
    return /^https:\/\//.test(u) ? u : '';
  } catch (e) { return ''; }
}
/** ລົງນາມ / ລຶບລາຍເຊັນ ໃນຊ່ອງໃດໜຶ່ງ — payload: { name, mode: 'mine' | 'draw' | 'name', imageBase64, clear } */
function mtSignRequest_impl_(requesterUsername, id, slot, payload) {
  const lock = LockService.getScriptLock();
  try {
    const user = requireActiveUser_(requesterUsername);
    if (!MT_SIG_SLOTS[slot]) throw new Error('ຊ່ອງລົງນາມບໍ່ຖືກຕ້ອງ');
    // ✍️ ສິດລົງນາມແຕ່ລະຊ່ອງ — SuperAdmin ເປັນຜູ້ກຳນົດ
    const pg = 'sig' + slot.charAt(0).toUpperCase() + slot.slice(1);
    if (!mtCan_(user, pg, 'edit')) throw new Error('ທ່ານບໍ່ມີສິດລົງນາມຊ່ອງ "' + MT_SIG_SLOTS[slot] + '" (SuperAdmin ເປັນຜູ້ກຳນົດສິດ)');
    if (!mtScoped_(user).requests.some(x => x.id === id)) throw new Error('ບໍ່ພົບໃບສະເໜີ ຫຼື ທ່ານບໍ່ມີສິດ');
    payload = payload || {};
    let url = '';
    if (!payload.clear) {
      if (payload.mode === 'mine') { url = mtMySigUrl_(user.username); if (!url) throw new Error('ທ່ານຍັງບໍ່ມີລາຍເຊັນໃນໂປຣໄຟລ໌ — ກະລຸນາແຕ້ມລາຍເຊັນ ຫຼື ອັບໂຫຼດໃນໂປຣໄຟລ໌ກ່ອນ'); }
      else if (payload.mode === 'draw') {
        const b64 = String(payload.imageBase64 || '');
        if (!/^data:image\/png;base64,/.test(b64) || b64.length > 400000) throw new Error('ຮູບລາຍເຊັນບໍ່ຖືກຕ້ອງ');
        url = uploadToDrive(b64, 'sig_' + slot + '_' + Date.now() + '.png', 'signature_requests');
      }
    }
    lock.waitLock(20000);
    const row = mtRead_('requests').find(x => x.id === id);
    if (!row) throw new Error('ບໍ່ພົບໃບສະເໜີ');
    if (row.status === 'cancelled') throw new Error('ໃບສະເໜີຖືກຍົກເລີກແລ້ວ');
    const sg = mtSigsOf_(row), old = sg[slot];
    if (payload.clear) {
      if (old && String(old.email || '').toLowerCase() !== String(user.username).toLowerCase() && !user.isSuper) throw new Error('ລຶບໄດ້ສະເພາະຜູ້ລົງນາມ ຫຼື SuperAdmin');
      delete sg[slot];
    } else {
      if (old && old.url && String(old.email || '').toLowerCase() !== String(user.username).toLowerCase() && !user.isSuper) throw new Error('ຊ່ອງນີ້ມີຄົນລົງນາມແລ້ວ (' + old.name + ')');
      const name = String(payload.name || user.name).trim().slice(0, 80);
      if (!name) throw new Error('ກະລຸນາໃສ່ຊື່');
      sg[slot] = { name: name, url: url, by: user.name, email: user.username, at: mtNow_() };
    }
    row.sigs = JSON.stringify(sg);
    mtPut_('requests', row, row._row);
    lock.releaseLock();
    return mtLoadAll(requesterUsername);
  } catch (e) {
    try { lock.releaseLock(); } catch (x) {}
    return { success: false, error: e.toString() };
  }
}

/* ==================== 🏢 ຫຼາຍບໍລິສັດ (ແຕ່ລະບໍລິສັດມີ Google Sheet ຂອງຕົນເອງ) ==================== */
// ຜູ້ໃຊ້ (Users), ປະຫວັດ Login ແລະ Audit_Log ຢູ່ Sheet ຫຼັກ (ລາວໃຕ້) ທີ່ດຽວ.
// ຂໍ້ມູນອື່ນທັງໝົດ (ນ້ຳມັນ, ຄັງ, ລາຍງານ, ລົດເຊົ່າ, ສ້ອມແປງ…) ແຍກຕາມ Sheet ຂອງບໍລິສັດທີ່ເລືອກ.
const SF_COMPANIES = [
  { id: 'laotai', master: true, short: 'ລາວໃຕ້', en: 'LaoTai Group', name: 'ກຸ່ມບໍລິສັດ ລາວໃຕ້ ການຄ້າ ແລະ ການລົງທຶນ ຈຳກັດຜູ້ດຽວ' },
  { id: 'bounmixay', short: 'ບຸນມີໄຊ', en: 'BOUNMIXAY Trading-Investment Sole Co.,Ltd', name: 'ບໍລິສັດ ບຸນມີໄຊ ການຄ້າ ແລະ ການລົງທຶນ ຈຳກັດຜູ້ດຽວ' },
  { id: 'phetmany', short: 'ເພັດມະນີ', en: 'PHETMANY Trading-Investment Sole Co.,Ltd', name: 'ບໍລິສັດ ເພັດມະນີ ການຄ້າ ແລະ ການລົງທຶນ ຈຳກັດຜູ້ດຽວ' }
];
const SF_CO_DEFAULT = 'laotai';
// Settings = ລາຍຊື່ສະໜາມ: ໃຊ້ຮ່ວມກັນທຸກບໍລິສັດ (ເຫັນທຸກສະໜາມຄືລາວໃຕ້)
const SF_MASTER_SHEETS = ['Users', 'Login_History', 'Audit_Log', 'Settings'];
// ຟັງຊັນ trigger ທີ່ຕ້ອງເຮັດວຽກແຍກທຸກບໍລິສັດ
const SF_PER_COMPANY = ['dailyLowStockCheck', 'rtCheckExpiringContracts', 'mtCheckDueAndNotify', 'sfWeeklyBackup'];
var SF_COMPANY = null, SF_SKIP_CO_CHECK = false;
var SF_CO_CACHE_ = {};

function sfCoMeta_(id) { return SF_COMPANIES.find(c => c.id === id) || null; }
function sfCoIds_() { return SF_COMPANIES.map(c => c.id); }
function sfCompanyId_() { return (SF_COMPANY && sfCoMeta_(SF_COMPANY)) ? SF_COMPANY : SF_CO_DEFAULT; }
function sfCoSheetId_(id) {
  const m = sfCoMeta_(id);
  if (!m) return '';
  if (m.master) return 'master';
  return PropertiesService.getScriptProperties().getProperty('CO_SS_' + id) || '';
}
function sfCoReady_(id) { return !!sfCoSheetId_(id); }
function sfCoTag_() { const m = sfCoMeta_(sfCompanyId_()); return '🏢 ' + m.short + '\n'; }

/** Spreadsheet ຂອງບໍລິສັດທີ່ກຳລັງໃຊ້ (ແທນ sfSS_() ທຸກບ່ອນ) */
function sfSS_() {
  const id = sfCompanyId_(), m = sfCoMeta_(id);
  if (m.master) return SpreadsheetApp.getActive();
  if (SF_CO_CACHE_[id]) return SF_CO_CACHE_[id];
  const sid = sfCoSheetId_(id);
  if (!sid) throw new Error('ບໍລິສັດ "' + m.short + '" ຍັງບໍ່ໄດ້ຕັ້ງຄ່າ Google Sheet — ໃຫ້ຜູ້ດູແລ Run "sfSetupCompanies" ກ່ອນ');
  let comp;
  try { comp = SpreadsheetApp.openById(sid); } catch (e) { throw new Error('ເປີດ Google Sheet ຂອງ "' + m.short + '" ບໍ່ໄດ້: ' + e.message); }
  const master = SpreadsheetApp.getActive();
  const route = n => SF_MASTER_SHEETS.indexOf(String(n)) >= 0 ? master : comp;
  SF_CO_CACHE_[id] = {
    getSheetByName: n => route(n).getSheetByName(n),
    insertSheet: function (n) { const t = route(n); return t.insertSheet.apply(t, arguments); },
    getSheets: () => comp.getSheets(),
    getId: () => comp.getId(), getName: () => comp.getName(), getUrl: () => comp.getUrl(),
    getEditors: () => master.getEditors(), getSpreadsheetTimeZone: () => comp.getSpreadsheetTimeZone()
  };
  return SF_CO_CACHE_[id];
}

/* ---------- ສິດບໍລິສັດຂອງຜູ້ໃຊ້ (ຖັນ "Companies" ໃນຊີດ Users) ---------- */
function sfCoColIdx_(header) { return (header || []).map(h => String(h).trim()).indexOf('Companies'); }
function sfEnsureCoCol_(sheet) {
  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  let col = sfCoColIdx_(headers) + 1;
  if (col === 0) { col = lastCol + 1; sheet.getRange(1, col).setValue('Companies'); }
  return col;
}
/** SuperAdmin = ທຸກບໍລິສັດ · ຄ່າຫວ່າງ = ບໍລິສັດຫຼັກ (ຜູ້ໃຊ້ເກົ່າກ່ອນມີລະບົບນີ້) */
function sfParseCompanies_(raw, rawRole) {
  if (isSuperRole_(rawRole)) return sfCoIds_();
  let a = [];
  try { a = JSON.parse(raw || '[]'); } catch (e) { a = String(raw || '').split(','); }
  a = (Array.isArray(a) ? a : []).map(s => String(s).trim()).filter((id, i, arr) => sfCoMeta_(id) && arr.indexOf(id) === i);
  return a.length ? a : [SF_CO_DEFAULT];
}
function sfSanitizeCompanies_(arr) {
  return (Array.isArray(arr) ? arr : []).map(s => String(s).trim()).filter((id, i, a) => sfCoMeta_(id) && a.indexOf(id) === i);
}
/** ກວດວ່າຜູ້ໃຊ້ທີ່ login ຢູ່ ຍັງມີສິດໃນບໍລິສັດທີ່ເລືອກ */
function sfCoCheck_(rec) {
  if (SF_SKIP_CO_CHECK || !SF_AUTH_EMAIL) return;
  if (String(rec.username).toLowerCase() !== String(SF_AUTH_EMAIL).toLowerCase()) return;
  if (rec.companies.indexOf(sfCompanyId_()) < 0) throw new Error('ທ່ານບໍ່ມີສິດໃນບໍລິສັດນີ້ແລ້ວ — ກະລຸນາເລືອກບໍລິສັດໃໝ່ (SF_CO_DENIED)');
}

/* ---------- session ---------- */
function sfSetSessionCompany_(token, id) {
  const s = sfReadSession_(token);
  if (!s) throw sfSessionError_();
  s.c = id;
  const k = sfSessKey_(token), raw = JSON.stringify(s);
  PropertiesService.getScriptProperties().setProperty(k, raw);
  try { CacheService.getScriptCache().put(k, raw, 21600); } catch (e) {}
}

/** 🏢 ເລືອກ / ປ່ຽນບໍລິສັດ (ຫຼັງ login) */
function sfSelectCompany_impl_(requesterUsername, companyId) {
  try {
    SF_SKIP_CO_CHECK = true;
    const user = requireActiveUser_(requesterUsername);
    if (!sfCoMeta_(companyId) || user.companies.indexOf(companyId) < 0) throw new Error('ທ່ານບໍ່ມີສິດໃນບໍລິສັດນີ້');
    if (!sfCoReady_(companyId)) throw new Error('ບໍລິສັດ "' + sfCoMeta_(companyId).short + '" ຍັງບໍ່ໄດ້ຕັ້ງຄ່າ Google Sheet — ກະລຸນາຕິດຕໍ່ຜູ້ດູແລລະບົບ');
    sfSetSessionCompany_(SF_CURRENT_TOKEN, companyId);
    SF_COMPANY = companyId;
    return { success: true, company: companyId, companies: user.companies };
  } catch (e) {
    return { success: false, error: e.toString() };
  } finally {
    SF_SKIP_CO_CHECK = false;
  }
}

/** ເອີ້ນ trigger ແຍກທຸກບໍລິສັດທີ່ຕັ້ງຄ່າແລ້ວ */
function sfForEachCompany_(impl, args) {
  const out = [];
  SF_COMPANIES.forEach(c => {
    if (!sfCoReady_(c.id)) return;
    SF_COMPANY = c.id;
    try { const r = impl.apply(null, args); out.push(c.short + ': ' + (r === undefined ? 'OK' : (typeof r === 'string' ? r : JSON.stringify(r)))); }
    catch (e) { out.push(c.short + ' ✗ ' + e.message); Logger.log(c.id + ': ' + e); }
  });
  SF_COMPANY = null;
  return out.join('\n');
}

/** ສ້າງ Google Sheet ໃຫ້ 1 ບໍລິສັດ (ໂຄງສ້າງຄືກັບ Sheet ຫຼັກ ແຕ່ບໍ່ມີຂໍ້ມູນ) */
function sfCreateCompanySheet_(c) {
  const master = SpreadsheetApp.getActive(), props = PropertiesService.getScriptProperties();
  const old = props.getProperty('CO_SS_' + c.id);
  if (old) { try { return { url: SpreadsheetApp.openById(old).getUrl(), existed: true }; } catch (e) {} }
  const NAME = 'SMART FUEL - ບໍລິສັດ';
  const it = DriveApp.getFoldersByName(NAME);
  const folder = it.hasNext() ? it.next() : DriveApp.createFolder(NAME);
  const ns = SpreadsheetApp.create('SMART FUEL - ' + c.en);
  const def = ns.getSheets()[0], copies = [];
  master.getSheets().forEach(sh => {
    const name = sh.getName();
    if (SF_MASTER_SHEETS.indexOf(name) >= 0) return;
    const cp = sh.copyTo(ns);
    const lr = cp.getLastRow(), lc = Math.max(1, cp.getLastColumn());
    if (lr > 1) cp.getRange(2, 1, lr - 1, lc).clearContent();
    copies.push([cp, name]);
  });
  if (copies.length) ns.deleteSheet(def);
  copies.forEach(([cp, name]) => cp.setName(name));
  try { DriveApp.getFileById(ns.getId()).moveTo(folder); } catch (e) {}
  props.setProperty('CO_SS_' + c.id, ns.getId());
  return { url: ns.getUrl(), existed: false };
}

/** 👑 SuperAdmin ກົດສ້າງ Google Sheet ໃຫ້ບໍລິສັດ ຈາກໜ້າເລືອກບໍລິສັດ (ບໍ່ຕ້ອງເຂົ້າ editor) */
function sfSetupCompany_impl_(requesterUsername, companyId) {
  const lock = LockService.getScriptLock();
  try {
    SF_SKIP_CO_CHECK = true;
    const user = requireActiveUser_(requesterUsername);
    if (!user.isSuper) throw new Error('ສະເພາະ SuperAdmin ເທົ່ານັ້ນ ທີ່ຕັ້ງຄ່າບໍລິສັດໄດ້');
    const c = sfCoMeta_(companyId);
    if (!c) throw new Error('ບໍ່ພົບບໍລິສັດ');
    if (c.master) return { success: true, existed: true };
    lock.waitLock(30000);
    const r = sfCreateCompanySheet_(c);
    lock.releaseLock();
    return { success: true, url: r.url, existed: r.existed, companiesReady: sfCoIds_().filter(sfCoReady_) };
  } catch (e) {
    try { lock.releaseLock(); } catch (x) {}
    return { success: false, error: e.toString() };
  } finally {
    SF_SKIP_CO_CHECK = false;
  }
}

/** 🛠️ Run 1 ຄັ້ງໃນ editor: ສ້າງ Google Sheet ໃຫ້ທຸກບໍລິສັດທີ່ຍັງບໍ່ມີ */
function sfSetupCompanies_impl_() {
  const log = [];
  SF_COMPANIES.filter(c => !c.master).forEach(c => {
    const r = sfCreateCompanySheet_(c);
    log.push((r.existed ? '✔ ' : '🆕 ') + c.short + ': ' + r.url);
  });
  const msg = log.join('\n');
  Logger.log(msg);
  return msg;
}

/* ---------- 📍 ສະໜາມ: ດຶງຈາກຕາຕະລາງ (ກຸ່ມບໍລິສັດ) ---------- */
/** ສະໜາມໃນຕາຕະລາງ Settings ຂອງບໍລິສັດຫຼັກ (ລາວໃຕ້) — ໃຊ້ເປັນລາຍການແນະນຳໃນບໍລິສັດອື່ນ */
function sfGroupStations_() {
  if (sfCoMeta_(sfCompanyId_()).master) return [];
  const st = SpreadsheetApp.getActive().getSheetByName('Settings');
  if (!st || st.getLastRow() < 2) return [];
  const own = new Set(getAllStationNames_());
  const out = [];
  st.getRange(2, 1, st.getLastRow() - 1, 1).getValues().forEach(r => {
    const n = String(r[0] || '').trim();
    if (n && !own.has(n) && out.indexOf(n) < 0) out.push(n);
  });
  return out.sort((a, b) => a.localeCompare(b, 'lo'));
}
/** ຖ້າສະໜາມຍັງບໍ່ມີໃນບໍລິສັດນີ້ → ເພີ່ມໃສ່ຕາຕະລາງ Settings (ສະເພາະ Admin) */
function sfEnsureStation_(user, name) {
  name = String(name || '').trim();
  if (!name) return name;
  const exists = getAllStationNames_().some(s => s.toLowerCase() === name.toLowerCase());
  if (exists) return getAllStationNames_().find(s => s.toLowerCase() === name.toLowerCase());
  if (!user || user.role !== 'Admin') throw new Error('ສະໜາມ "' + name + '" ຍັງບໍ່ມີໃນບໍລິສັດນີ້ — ໃຫ້ Admin ເພີ່ມສະໜາມກ່ອນ');
  if (name.length > 80) throw new Error('ຊື່ສະໜາມຍາວເກີນໄປ');
  const ss = sfSS_();
  let sheet = ss.getSheetByName('Settings');
  if (!sheet) { sheet = ss.insertSheet('Settings'); sheet.appendRow(['Station_Name']); }
  sheet.appendRow([name]);
  return name;
}


// ==========================================================================================
// 🛡️ SECURITY LAYER — ຊັ້ນຄວາມປອດໄພຂອງ SMART FUEL v5 (ເພີ່ມ 06/11/2026)
//  1) Session token: ຫຼັງເຂົ້າລະບົບ server ອອກ token ລັບ (ໝົດອາຍຸ 12 ຊມ). ທຸກຟັງຊັນກວດ token ແທນການເຊື່ອ Email ຈາກ browser
//  2) ທຸກຟັງຊັນທີ່ browser ເອີ້ນໄດ້ ຖືກຫໍ່ດ້ວຍ sfCall_: ກວດ token, ກອງຂໍ້ມູນເຂົ້າ/ອອກ, ບັນທຶກ Audit_Log
//  3) ຟັງຊັນພາຍໃນ (ສົ່ງ LINE, Email, ອັບໂຫຼດ, setup, trigger) ເອີ້ນຈາກ browser ໂດຍກົງບໍ່ໄດ້ອີກ
//  4) ລະຫັດຜ່ານເກັບແບບ hash (SHA-256 + salt) — ລະຫັດເກົ່າຖືກແປງເອງຕອນເຂົ້າລະບົບຄັ້ງຕໍ່ໄປ
//  5) ຈຳກັດການລອງລະຫັດຜິດ: 5 ຄັ້ງ → ລັອກ 15 ນາທີ
// ==========================================================================================

const SF_SESSION_HOURS = 12;
const SF_LOGIN_MAX_FAILS = 5;
const SF_LOGIN_LOCK_MIN = 15;
const SF_PASSWORD_MIN = 6;
const SF_MAX_UPLOAD_MB = 15;
const SF_AUDIT_SHEET = 'Audit_Log';

// ສະຖານະຂອງການເອີ້ນແຕ່ລະຄັ້ງ (Apps Script ເລີ່ມຄ່າໃໝ່ທຸກການເອີ້ນຈາກ browser)
var SF_DEPTH = 0, SF_AUTH_EMAIL = null, SF_CURRENT_TOKEN = null;

/* ---------- ຂໍ້ມູນລັບ: ອ່ານຈາກ Script Properties ກ່ອນ ---------- */
function sfSecret_(key, fallback) {
  try { const v = PropertiesService.getScriptProperties().getProperty(key); if (v) return v; } catch (e) {}
  return fallback;
}

/* ---------- hash ---------- */
function sfHex_(bytes) { return bytes.map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join(''); }
function sfSha256_(s) { return sfHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)); }
function sfIsHashed_(stored) { return /^sha256\$\d+\$[0-9a-f]+\$[0-9a-f]{64}$/.test(String(stored || '')); }
function sfHashPassword_(plain, skipPolicy) {
  plain = String(plain || '');
  if (!skipPolicy && plain.length < SF_PASSWORD_MIN) throw new Error('ລະຫັດຜ່ານຕ້ອງມີຢ່າງໜ້ອຍ ' + SF_PASSWORD_MIN + ' ຕົວອັກສອນ');
  const salt = Utilities.getUuid().replace(/-/g, '').slice(0, 16), iter = 150;
  let h = salt + ':' + plain;
  for (let i = 0; i < iter; i++) h = sfSha256_(h + ':' + plain);
  return 'sha256$' + iter + '$' + salt + '$' + h;
}
function sfVerifyPassword_(plain, stored) {
  stored = String(stored || '').trim(); plain = String(plain || '');
  if (!stored) return false;
  if (!sfIsHashed_(stored)) return stored === plain.trim(); // ລະຫັດແບບເກົ່າ (ຍັງບໍ່ hash)
  const p = stored.split('$'), iter = Number(p[1]), salt = p[2];
  let h = salt + ':' + plain;
  for (let i = 0; i < iter; i++) h = sfSha256_(h + ':' + plain);
  return h === p[3];
}

/* ---------- session ---------- */
function sfSessKey_(token) { return 'SFS_' + sfSha256_(String(token)).slice(0, 40); }
function sfCreateSession_(email, company) {
  const token = 'sf1.' + (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  const rec = JSON.stringify({ u: String(email).trim(), c: company || '', exp: Date.now() + SF_SESSION_HOURS * 3600000 });
  PropertiesService.getScriptProperties().setProperty(sfSessKey_(token), rec);
  try { CacheService.getScriptCache().put(sfSessKey_(token), rec, 21600); } catch (e) {}
  if (Math.random() < 0.15) sfPurgeSessions_();
  return token;
}
function sfReadSession_(token) {
  const k = sfSessKey_(token);
  let raw = null;
  try { raw = CacheService.getScriptCache().get(k); } catch (e) {}
  if (!raw) raw = PropertiesService.getScriptProperties().getProperty(k);
  if (!raw) return null;
  try { const s = JSON.parse(raw); return (s && s.exp > Date.now()) ? s : null; } catch (e) { return null; }
}
function sfDestroySession_(token) {
  if (!token) return;
  const k = sfSessKey_(token);
  try { PropertiesService.getScriptProperties().deleteProperty(k); } catch (e) {}
  try { CacheService.getScriptCache().remove(k); } catch (e) {}
}
/** ລຶບ session ທັງໝົດຂອງຜູ້ໃຊ້ (ເຊັ່ນ ເມື່ອປ່ຽນລະຫັດຜ່ານ) ຍົກເວັ້ນ token ປັດຈຸບັນ */
function sfRevokeUser_(email, keepToken) {
  const props = PropertiesService.getScriptProperties(), all = props.getProperties();
  const keep = keepToken ? sfSessKey_(keepToken) : '', target = String(email || '').trim().toLowerCase();
  Object.keys(all).forEach(k => {
    if (k.indexOf('SFS_') !== 0 || k === keep) return;
    try { if (JSON.parse(all[k]).u.toLowerCase() === target) { props.deleteProperty(k); try { CacheService.getScriptCache().remove(k); } catch (e) {} } } catch (e) {}
  });
}
function sfPurgeSessions_() {
  const props = PropertiesService.getScriptProperties(), all = props.getProperties(), now = Date.now();
  Object.keys(all).forEach(k => { if (k.indexOf('SFS_') === 0) { try { if (JSON.parse(all[k]).exp < now) props.deleteProperty(k); } catch (e) { props.deleteProperty(k); } } });
}
function sfSessionError_() { return new Error('SESSION_EXPIRED: ໝົດເວລາການເຂົ້າລະບົບ ຫຼື ລະບົບຄວາມປອດໄພຖືກອັບເດດ — ກະລຸນາເຂົ້າສູ່ລະບົບໃໝ່'); }

/** ແປງ token → Email (throw ຖ້າບໍ່ຖືກຕ້ອງ). ການເອີ້ນພາຍໃນທີ່ສົ່ງ Email ທີ່ຢືນຢັນແລ້ວ ຜ່ານໄດ້ */
function sfAuthUser_(tokenOrEmail) {
  const v = String(tokenOrEmail || '').trim();
  if (SF_AUTH_EMAIL && v.toLowerCase() === SF_AUTH_EMAIL.toLowerCase()) return SF_AUTH_EMAIL;
  if (!/^sf1\.[0-9a-f]{64}$/.test(v)) throw sfSessionError_();
  const s = sfReadSession_(v);
  if (!s) throw sfSessionError_();
  SF_AUTH_EMAIL = s.u; SF_CURRENT_TOKEN = v; SF_COMPANY = s.c || null;
  return s.u;
}

/** ຟັງຊັນພາຍໃນ / setup / trigger: ອະນຸຍາດສະເພາະ trigger ຂອງໂປຣເຈັກ ຫຼື ຄົນທີ່ແກ້ໄຂ Google Sheet ໄດ້ (ເຊັ່ນ ກົດ Run ໃນ editor) */
function sfRequireOwnerOrTrigger_(e) {
  try {
    if (e && e.triggerUid && ScriptApp.getProjectTriggers().some(t => t.getUniqueId() === String(e.triggerUid))) return;
  } catch (x) {}
  let active = '';
  try { active = (Session.getActiveUser().getEmail() || '').toLowerCase(); } catch (x) {}
  if (active) {
    let owner = '';
    try { owner = (Session.getEffectiveUser().getEmail() || '').toLowerCase(); } catch (x) {}
    if (active === owner) return;
    try { if (sfSS_().getEditors().some(u => (u.getEmail() || '').toLowerCase() === active)) return; } catch (x) {}
  }
  throw new Error('ຟັງຊັນນີ້ໃຊ້ໄດ້ສະເພາະຜູ້ດູແລລະບົບໃນ Apps Script ເທົ່ານັ້ນ');
}

/** ຜູ້ໃຊ້ທີ່ຖືກຈຳກັດສະໜາມ ບັນທຶກ/ແກ້ໄຂໄດ້ສະເພາະສະໜາມຂອງຕົນ */
function sfRequireStation_(user, station) {
  if (!user || user.role === 'Admin' || !user.stations || !user.stations.length) return;
  const st = String(station || '').trim();
  if (!user.stations.includes(st)) throw new Error('ທ່ານບໍ່ມີສິດບັນທຶກ ຫຼື ແກ້ໄຂຂໍ້ມູນຂອງສະໜາມ "' + (st || '-') + '"');
}

/** ກວດຕົວເລກໃນຟອມນ້ຳມັນອອກ (ກັນພິມຜິດ) */
function sfValidateFuel_(f) {
  const num = k => (f && f[k] !== undefined && f[k] !== '') ? Number(f[k]) : null;
  const keys = { fuelBeforeLitre: 'ກ່ອນຕື່ມ (ລິດ)', fuelAfterLitre: 'ຕື່ມປະຈຸບັນ (ລິດ)', fuelLeaveLitre: 'ຫຼັງເລີກວຽກ (ລິດ)', fuelBeforeCm: 'ກ່ອນຕື່ມ (CM)', fuelAfterCm: 'ຕື່ມປະຈຸບັນ (CM)', fuelLeaveCm: 'ຫຼັງເລີກວຽກ (CM)', kmBefore: 'KM ກ່ອນ', kmAfter: 'KM ຫຼັງ' };
  for (const k in keys) { const v = num(k); if (v !== null && (isNaN(v) || v < 0)) return 'ຄ່າ "' + keys[k] + '" ຕ້ອງເປັນຕົວເລກ ແລະ ບໍ່ຕິດລົບ'; }
  const kb = num('kmBefore'), ka = num('kmAfter');
  if (kb > 0 && ka > 0 && ka < kb) return 'ເລກ KM ຫຼັງ (' + ka + ') ໜ້ອຍກວ່າ KM ກ່ອນ (' + kb + ') — ກະລຸນາກວດເລກກົງເຕີ';
  if (kb > 0 && ka > 0 && ka - kb > 3000) return 'ໄລຍະທາງ ' + (ka - kb) + ' ກມ ເກີນ 3,000 ກມ ຕໍ່ຄັ້ງ — ກະລຸນາກວດເລກກົງເຕີ (ອາດພິມເກີນ 1 ຫຼັກ)';
  return '';
}

/* ---------- ກອງຂໍ້ມູນ ---------- */
// ຂໍ້ມູນເຂົ້າ: ຕັດ < > (ກັນຝັງ script) ແລະ ກັນສູດ Google Sheets (ຂຶ້ນຕົ້ນດ້ວຍ =)
function sfCleanIn_(v, key) {
  if (typeof v === 'string') {
    if (/pass/i.test(key || '') || /^data:[\w.+-]+\/[\w.+-]+;base64,/.test(v)) return v;
    let s = v.replace(/</g, '‹').replace(/>/g, '›');
    if (/^\s*=/.test(s)) s = "'" + s;
    return s;
  }
  if (Array.isArray(v)) return v.map(x => sfCleanIn_(x, key));
  if (v && Object.prototype.toString.call(v) === '[object Object]') { const o = {}; Object.keys(v).forEach(k => { o[k] = sfCleanIn_(v[k], k); }); return o; }
  return v;
}
// ຂໍ້ມູນອອກ: ຂໍ້ຄວາມທຸກອັນທີ່ອາດມີ HTML ຫຼື ເຄື່ອງໝາຍວົງຢືມ ຖືກແປງເປັນຕົວອັກສອນທີ່ປອດໄພ (ກັນ XSS ຈາກຂໍ້ມູນເກົ່າໃນ Sheet)
function sfCleanOut_(v, key) {
  if (typeof v === 'string') {
    if (/pass|token/i.test(key || '')) return v;
    const t = v.trim();
    if (/^javascript:/i.test(t) || /^vbscript:/i.test(t)) return '';
    if (/^(https?:\/\/|data:image\/)/i.test(t) && !/[<>"'`\s]/.test(t)) return v;
    if (/^[\[{]/.test(t) && /[\]}]$/.test(t)) { try { JSON.parse(t); return v.replace(/</g, '\\u003c').replace(/>/g, '\\u003e'); } catch (e) {} }
    return v.replace(/</g, '‹').replace(/>/g, '›').replace(/"/g, '″').replace(/'/g, '’').replace(/`/g, 'ˋ');
  }
  if (Array.isArray(v)) return v.map(x => sfCleanOut_(x, key));
  if (v && Object.prototype.toString.call(v) === '[object Object]') { const o = {}; Object.keys(v).forEach(k => { o[k] = sfCleanOut_(v[k], k); }); return o; }
  return v;
}

/* ---------- Audit_Log: ບັນທຶກທຸກການແກ້ໄຂ ---------- */
function sfAuditSummary_(v, depth) {
  depth = depth || 0;
  if (typeof v === 'string') return v.length > 120 ? v.slice(0, 117) + '…' : v;
  if (Array.isArray(v)) return depth > 2 ? '[' + v.length + ']' : v.slice(0, 8).map(x => sfAuditSummary_(x, depth + 1));
  if (v && typeof v === 'object') {
    if (depth > 2) return '{…}';
    const o = {};
    Object.keys(v).forEach(k => { if (/pass|fileData|base64|image|files|photos$/i.test(k)) o[k] = '[ຊ່ອນ]'; else o[k] = sfAuditSummary_(v[k], depth + 1); });
    return o;
  }
  return v;
}
function sfAudit_(action, user, args, ok, msg) {
  try {
    const ss = sfSS_();
    let sh = ss.getSheetByName(SF_AUDIT_SHEET);
    if (!sh) {
      sh = ss.insertSheet(SF_AUDIT_SHEET);
      sh.getRange(1, 1, 1, 6).setValues([['ເວລາ', 'ຜູ້ໃຊ້', 'ການກະທຳ', 'ລາຍລະອຽດ', 'ຜົນ', 'ຂໍ້ຄວາມ']]).setFontWeight('bold').setBackground('#1a365d').setFontColor('#ffffff');
      sh.setFrozenRows(1);
      sh.getRange('A:F').setNumberFormat('@');
    }
    let detail = '';
    try { detail = JSON.stringify(sfAuditSummary_(args.slice(1))); } catch (e) {}
    if (detail.length > 1500) detail = detail.slice(0, 1497) + '…';
    sh.appendRow([Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'), String(user || ''), action, detail, ok ? 'ສຳເລັດ' : 'ບໍ່ສຳເລັດ', String(msg || '').slice(0, 300)]);
  } catch (e) { Logger.log('audit: ' + e); }
}

/* ---------- ຕົວຫໍ່ທຸກຟັງຊັນທີ່ browser ເອີ້ນໄດ້ ---------- */
function sfCall_(name, impl, argsObj) {
  let args = Array.prototype.slice.call(argsObj);
  const top = SF_DEPTH === 0;
  const spec = SF_FN_SPEC[name] || 'owner';
  SF_DEPTH++;
  try {
    if (spec === 'auth') args[0] = sfAuthUser_(args[0]);
    else if (spec === 'owner' && top) sfRequireOwnerOrTrigger_(args[0]);

    if (name === 'checkLogin') return sfLogin_(impl, args);

    if (top && spec === 'auth') args = [args[0]].concat(sfCleanIn_(args.slice(1)));
    let res, ok = true, msg = '';
    try {
      res = (top && spec === 'owner' && SF_PER_COMPANY.indexOf(name) >= 0) ? sfForEachCompany_(impl, args) : impl.apply(null, args);
      if (res && res.success === false) { ok = false; msg = res.error; }
    } catch (e) { ok = false; msg = e && e.message; if (top && SF_AUDIT[name]) sfAudit_(name, SF_AUTH_EMAIL, args, false, msg); throw e; }
    if (top && SF_AUDIT[name]) sfAudit_(name, SF_AUTH_EMAIL, args, ok, msg);
    return top && spec !== 'owner' ? sfCleanOut_(res) : res;
  } finally {
    SF_DEPTH--;
  }
}

/** ເຂົ້າລະບົບ: ຈຳກັດການລອງຜິດ, ຂໍ້ຄວາມຜິດພາດແບບດຽວ, ອອກ session token */
function sfLogin_(impl, args) {
  const email = String(args[0] || '').trim().toLowerCase();
  const cache = CacheService.getScriptCache(), key = 'SFLF_' + sfSha256_(email).slice(0, 32);
  const fails = Number(cache.get(key) || 0);
  if (fails >= SF_LOGIN_MAX_FAILS) {
    sfAudit_('checkLogin', email, [], false, 'ຖືກລັອກຊົ່ວຄາວ');
    return { success: false, error: 'ລອງເຂົ້າລະບົບຜິດ ' + SF_LOGIN_MAX_FAILS + ' ຄັ້ງ — ກະລຸນາລໍຖ້າ ' + SF_LOGIN_LOCK_MIN + ' ນາທີ ແລ້ວລອງໃໝ່' };
  }
  const res = impl.apply(null, args);
  if (!res || !res.success) {
    cache.put(key, String(fails + 1), SF_LOGIN_LOCK_MIN * 60);
    const generic = /Password|ບໍ່ພົບ Email/.test(String(res && res.error));
    sfAudit_('checkLogin', email, [], false, res && res.error);
    return { success: false, error: generic ? 'Email ຫຼື Password ບໍ່ຖືກຕ້ອງ' + (fails + 1 >= 3 ? ' (ລອງໄດ້ອີກ ' + (SF_LOGIN_MAX_FAILS - fails - 1) + ' ຄັ້ງ)' : '') : (res && res.error) };
  }
  cache.remove(key);
  res.user.token = sfCreateSession_(res.user.username, res.user.company);
  return sfCleanOut_(res);
}

/* ---------- ສຳຮອງຂໍ້ມູນອັດຕະໂນມັດທຸກອາທິດ ---------- */
function sfWeeklyBackup_impl_(e) {
  const ss = sfSS_();
  const NAME = 'SMART FUEL - ສຳຮອງຂໍ້ມູນ';
  const it = DriveApp.getFoldersByName(NAME);
  const folder = it.hasNext() ? it.next() : DriveApp.createFolder(NAME);
  const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  DriveApp.getFileById(ss.getId()).makeCopy('ສຳຮອງ ' + ss.getName() + ' ' + stamp, folder);
  const files = [], fit = folder.getFiles();
  while (fit.hasNext()) files.push(fit.next());
  files.sort((a, b) => b.getDateCreated() - a.getDateCreated()).slice(8).forEach(f => f.setTrashed(true)); // ເກັບ 8 ສະບັບລ່າສຸດ
  return 'ສຳຮອງແລ້ວ: ' + folder.getUrl();
}
/** 🛠️ Run ຄັ້ງດຽວ: ສຳຮອງ Google Sheet ທຸກວັນອາທິດ ເວລາ 22:00 (ເກັບ 8 ອາທິດ) */
function sfInstallBackupTrigger_impl_() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'sfWeeklyBackup').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('sfWeeklyBackup').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(22).create();
  return 'ຕັ້ງການສຳຮອງທຸກອາທິດແລ້ວ';
}
/** 🛠️ Run ເພື່ອລຶບ session ທັງໝົດ (ທຸກຄົນຕ້ອງເຂົ້າລະບົບໃໝ່) — ໃຊ້ເມື່ອສົງໃສວ່າມີຄົນເຂົ້າລະບົບແທນ */
function sfLogoutEveryone_impl_() {
  const props = PropertiesService.getScriptProperties(), all = props.getProperties();
  let n = 0;
  Object.keys(all).forEach(k => { if (k.indexOf('SFS_') === 0) { props.deleteProperty(k); n++; } });
  return 'ລຶບ session ' + n + ' ລາຍການ';
}

// ==== 🛡️ ຕົວຫໍ່ອັດຕະໂນມັດ: ທຸກຟັງຊັນທີ່ browser ເອີ້ນໄດ້ ຜ່ານ sfCall_ (ກວດ token, ກອງຂໍ້ມູນ, Audit) ====
function setAdminUserAccess() { return sfCall_('setAdminUserAccess', setAdminUserAccess_impl_, arguments); }
function sfSetUserPassword() { return sfCall_('sfSetUserPassword', sfSetUserPassword_impl_, arguments); }
function sfSetupSuperAdmin() { return sfCall_('sfSetupSuperAdmin', sfSetupSuperAdmin_impl_, arguments); }
function refreshMyPermissions() { return sfCall_('refreshMyPermissions', refreshMyPermissions_impl_, arguments); }
function revealUserPassword() { return sfCall_('revealUserPassword', revealUserPassword_impl_, arguments); }
function calculateHoursDiff() { return sfCall_('calculateHoursDiff', calculateHoursDiff_impl_, arguments); }
function autoClearLoginHistory() { return sfCall_('autoClearLoginHistory', autoClearLoginHistory_impl_, arguments); }
function checkLogin() { return sfCall_('checkLogin', checkLogin_impl_, arguments); }
function recordLoginTime() { return sfCall_('recordLoginTime', recordLoginTime_impl_, arguments); }
function recordLogout() { return sfCall_('recordLogout', recordLogout_impl_, arguments); }
function getInitialData() { return sfCall_('getInitialData', getInitialData_impl_, arguments); }
function getFilteredDataByDate() { return sfCall_('getFilteredDataByDate', getFilteredDataByDate_impl_, arguments); }
function addNewStation() { return sfCall_('addNewStation', addNewStation_impl_, arguments); }
function createNewUser() { return sfCall_('createNewUser', createNewUser_impl_, arguments); }
function updateUserRole() { return sfCall_('updateUserRole', updateUserRole_impl_, arguments); }
function deleteUser() { return sfCall_('deleteUser', deleteUser_impl_, arguments); }
function exportToPDF() { return sfCall_('exportToPDF', exportToPDF_impl_, arguments); }
function exportStockInPDF() { return sfCall_('exportStockInPDF', exportStockInPDF_impl_, arguments); }
function processForm() { return sfCall_('processForm', processForm_impl_, arguments); }
function updateFormRecord() { return sfCall_('updateFormRecord', updateFormRecord_impl_, arguments); }
function checkUploadFolder() { return sfCall_('checkUploadFolder', checkUploadFolder_impl_, arguments); }
function uploadToDrive() { return sfCall_('uploadToDrive', uploadToDrive_impl_, arguments); }
function fixOldImageUrls() { return sfCall_('fixOldImageUrls', fixOldImageUrls_impl_, arguments); }
function deleteRecord() { return sfCall_('deleteRecord', deleteRecord_impl_, arguments); }
function saveStockIn() { return sfCall_('saveStockIn', saveStockIn_impl_, arguments); }
function getStockInHistory() { return sfCall_('getStockInHistory', getStockInHistory_impl_, arguments); }
function deleteStockInRow() { return sfCall_('deleteStockInRow', deleteStockInRow_impl_, arguments); }
function deleteImportFuelRow() { return sfCall_('deleteImportFuelRow', deleteImportFuelRow_impl_, arguments); }
function updateStockInRow() { return sfCall_('updateStockInRow', updateStockInRow_impl_, arguments); }
function getStockSummaryByStation() { return sfCall_('getStockSummaryByStation', getStockSummaryByStation_impl_, arguments); }
function getDailyReportRange() { return sfCall_('getDailyReportRange', getDailyReportRange_impl_, arguments); }
function saveReportSignature() { return sfCall_('saveReportSignature', saveReportSignature_impl_, arguments); }
function getDailyReport() { return sfCall_('getDailyReport', getDailyReport_impl_, arguments); }
function saveDailyReportSignature() { return sfCall_('saveDailyReportSignature', saveDailyReportSignature_impl_, arguments); }
function addDailyReportPhotos() { return sfCall_('addDailyReportPhotos', addDailyReportPhotos_impl_, arguments); }
function deleteDailyReportPhoto() { return sfCall_('deleteDailyReportPhoto', deleteDailyReportPhoto_impl_, arguments); }
function dailyLowStockCheck() { return sfCall_('dailyLowStockCheck', dailyLowStockCheck_impl_, arguments); }
function getLowStockSettings() { return sfCall_('getLowStockSettings', getLowStockSettings_impl_, arguments); }
function saveLowStockSettings() { return sfCall_('saveLowStockSettings', saveLowStockSettings_impl_, arguments); }
function sendTestLowStockAlert() { return sfCall_('sendTestLowStockAlert', sendTestLowStockAlert_impl_, arguments); }
function setLowStockDailyTrigger() { return sfCall_('setLowStockDailyTrigger', setLowStockDailyTrigger_impl_, arguments); }
function onOpen() { return sfCall_('onOpen', onOpen_impl_, arguments); }
function setupDailyLowStockTrigger() { return sfCall_('setupDailyLowStockTrigger', setupDailyLowStockTrigger_impl_, arguments); }
function runLowStockCheckManually() { return sfCall_('runLowStockCheckManually', runLowStockCheckManually_impl_, arguments); }
function runLowStockCheckForAllStations() { return sfCall_('runLowStockCheckForAllStations', runLowStockCheckForAllStations_impl_, arguments); }
function sendLineNotification() { return sfCall_('sendLineNotification', sendLineNotification_impl_, arguments); }
function sendEmailNotification() { return sfCall_('sendEmailNotification', sendEmailNotification_impl_, arguments); }
function getUserProfilePhoto() { return sfCall_('getUserProfilePhoto', getUserProfilePhoto_impl_, arguments); }
function removeProfilePhoto() { return sfCall_('removeProfilePhoto', removeProfilePhoto_impl_, arguments); }
function updateProfilePhoto() { return sfCall_('updateProfilePhoto', updateProfilePhoto_impl_, arguments); }
function updateMyProfile() { return sfCall_('updateMyProfile', updateMyProfile_impl_, arguments); }
function getMySignature() { return sfCall_('getMySignature', getMySignature_impl_, arguments); }
function updateMySignature() { return sfCall_('updateMySignature', updateMySignature_impl_, arguments); }
function removeMySignature() { return sfCall_('removeMySignature', removeMySignature_impl_, arguments); }
function getMonthlyReport() { return sfCall_('getMonthlyReport', getMonthlyReport_impl_, arguments); }
function getYearlyReport() { return sfCall_('getYearlyReport', getYearlyReport_impl_, arguments); }
function getVehicleLastLevel() { return sfCall_('getVehicleLastLevel', getVehicleLastLevel_impl_, arguments); }
function saveVehicleUsage() { return sfCall_('saveVehicleUsage', saveVehicleUsage_impl_, arguments); }
function getVehicleUsageList() { return sfCall_('getVehicleUsageList', getVehicleUsageList_impl_, arguments); }
function deleteVehicleUsage() { return sfCall_('deleteVehicleUsage', deleteVehicleUsage_impl_, arguments); }
function addPerson() { return sfCall_('addPerson', addPerson_impl_, arguments); }
function getVehicleStationAdmin() { return sfCall_('getVehicleStationAdmin', getVehicleStationAdmin_impl_, arguments); }
function saveVehicleStations() { return sfCall_('saveVehicleStations', saveVehicleStations_impl_, arguments); }
function rtSetup() { return sfCall_('rtSetup', rtSetup_impl_, arguments); }
function rtLoadAll() { return sfCall_('rtLoadAll', rtLoadAll_impl_, arguments); }
function rtSave() { return sfCall_('rtSave', rtSave_impl_, arguments); }
function rtDelete() { return sfCall_('rtDelete', rtDelete_impl_, arguments); }
function rtComputeBilling() { return sfCall_('rtComputeBilling', rtComputeBilling_impl_, arguments); }
function rtSaveInvoices() { return sfCall_('rtSaveInvoices', rtSaveInvoices_impl_, arguments); }
function rtFieldDay() { return sfCall_('rtFieldDay', rtFieldDay_impl_, arguments); }
function rtCheckExpiringContracts() { return sfCall_('rtCheckExpiringContracts', rtCheckExpiringContracts_impl_, arguments); }
function rtInstallDailyTrigger() { return sfCall_('rtInstallDailyTrigger', rtInstallDailyTrigger_impl_, arguments); }
function mtSetup() { return sfCall_('mtSetup', mtSetup_impl_, arguments); }
function mtLoadAll() { return sfCall_('mtLoadAll', mtLoadAll_impl_, arguments); }
function mtSaveVehicle() { return sfCall_('mtSaveVehicle', mtSaveVehicle_impl_, arguments); }
function mtQuickAddVehicle() { return sfCall_('mtQuickAddVehicle', mtQuickAddVehicle_impl_, arguments); }
function mtImportVehicles() { return sfCall_('mtImportVehicles', mtImportVehicles_impl_, arguments); }
function mtSaveRecord() { return sfCall_('mtSaveRecord', mtSaveRecord_impl_, arguments); }
function mtDelete() { return sfCall_('mtDelete', mtDelete_impl_, arguments); }
function mtSaveRequest() { return sfCall_('mtSaveRequest', mtSaveRequest_impl_, arguments); }
function mtDecideRequest() { return sfCall_('mtDecideRequest', mtDecideRequest_impl_, arguments); }
function mtCancelRequest() { return sfCall_('mtCancelRequest', mtCancelRequest_impl_, arguments); }
function mtSaveRates() { return sfCall_('mtSaveRates', mtSaveRates_impl_, arguments); }
function mtCheckDueAndNotify() { return sfCall_('mtCheckDueAndNotify', mtCheckDueAndNotify_impl_, arguments); }
function mtInstallDailyTrigger() { return sfCall_('mtInstallDailyTrigger', mtInstallDailyTrigger_impl_, arguments); }
function mtSignRequest() { return sfCall_('mtSignRequest', mtSignRequest_impl_, arguments); }
function sfSelectCompany() { return sfCall_('sfSelectCompany', sfSelectCompany_impl_, arguments); }
function sfSetupCompany() { return sfCall_('sfSetupCompany', sfSetupCompany_impl_, arguments); }
function sfSetupCompanies() { return sfCall_('sfSetupCompanies', sfSetupCompanies_impl_, arguments); }
function sfWeeklyBackup() { return sfCall_('sfWeeklyBackup', sfWeeklyBackup_impl_, arguments); }
function sfInstallBackupTrigger() { return sfCall_('sfInstallBackupTrigger', sfInstallBackupTrigger_impl_, arguments); }
function sfLogoutEveryone() { return sfCall_('sfLogoutEveryone', sfLogoutEveryone_impl_, arguments); }
var SF_FN_SPEC = {"setAdminUserAccess": "auth", "sfSetUserPassword": "auth", "sfSetupSuperAdmin": "owner", "refreshMyPermissions": "auth", "revealUserPassword": "auth", "calculateHoursDiff": "open", "autoClearLoginHistory": "owner", "checkLogin": "open", "recordLoginTime": "owner", "recordLogout": "auth", "getInitialData": "auth", "getFilteredDataByDate": "auth", "addNewStation": "auth", "createNewUser": "auth", "updateUserRole": "auth", "deleteUser": "auth", "exportToPDF": "auth", "exportStockInPDF": "auth", "processForm": "auth", "updateFormRecord": "auth", "checkUploadFolder": "owner", "uploadToDrive": "owner", "fixOldImageUrls": "owner", "deleteRecord": "auth", "saveStockIn": "auth", "getStockInHistory": "auth", "deleteStockInRow": "auth", "deleteImportFuelRow": "auth", "updateStockInRow": "auth", "getStockSummaryByStation": "auth", "getDailyReportRange": "auth", "saveReportSignature": "auth", "getDailyReport": "auth", "saveDailyReportSignature": "auth", "addDailyReportPhotos": "auth", "deleteDailyReportPhoto": "auth", "dailyLowStockCheck": "owner", "getLowStockSettings": "auth", "saveLowStockSettings": "auth", "sendTestLowStockAlert": "auth", "setLowStockDailyTrigger": "auth", "onOpen": "open", "setupDailyLowStockTrigger": "owner", "runLowStockCheckManually": "owner", "runLowStockCheckForAllStations": "auth", "sendLineNotification": "owner", "sendEmailNotification": "owner", "getUserProfilePhoto": "auth", "removeProfilePhoto": "auth", "updateProfilePhoto": "auth", "updateMyProfile": "auth", "getMySignature": "auth", "updateMySignature": "auth", "removeMySignature": "auth", "getMonthlyReport": "auth", "getYearlyReport": "auth", "getVehicleLastLevel": "auth", "saveVehicleUsage": "auth", "getVehicleUsageList": "auth", "deleteVehicleUsage": "auth", "addPerson": "auth", "getVehicleStationAdmin": "auth", "saveVehicleStations": "auth", "rtSetup": "owner", "rtLoadAll": "auth", "rtSave": "auth", "rtDelete": "auth", "rtComputeBilling": "auth", "rtSaveInvoices": "auth", "rtFieldDay": "auth", "rtCheckExpiringContracts": "owner", "rtInstallDailyTrigger": "owner", "mtSetup": "owner", "mtLoadAll": "auth", "mtSaveVehicle": "auth", "mtQuickAddVehicle": "auth", "mtImportVehicles": "auth", "mtSaveRecord": "auth", "mtDelete": "auth", "mtSaveRequest": "auth", "mtDecideRequest": "auth", "mtCancelRequest": "auth", "mtSaveRates": "auth", "mtCheckDueAndNotify": "owner", "mtInstallDailyTrigger": "owner", "mtSignRequest": "auth", "sfSelectCompany": "auth", "sfSetupCompany": "auth", "sfSetupCompanies": "owner", "sfWeeklyBackup": "owner", "sfInstallBackupTrigger": "owner", "sfLogoutEveryone": "owner"};
var SF_AUDIT = {"processForm": 1, "updateFormRecord": 1, "deleteRecord": 1, "saveStockIn": 1, "updateStockInRow": 1, "deleteStockInRow": 1, "deleteImportFuelRow": 1, "addNewStation": 1, "createNewUser": 1, "updateUserRole": 1, "deleteUser": 1, "revealUserPassword": 1, "saveVehicleUsage": 1, "deleteVehicleUsage": 1, "saveVehicleStations": 1, "addPerson": 1, "saveLowStockSettings": 1, "setLowStockDailyTrigger": 1, "saveReportSignature": 1, "saveDailyReportSignature": 1, "addDailyReportPhotos": 1, "deleteDailyReportPhoto": 1, "updateMyProfile": 1, "rtSave": 1, "rtDelete": 1, "rtSaveInvoices": 1, "mtSaveVehicle": 1, "mtQuickAddVehicle": 1, "setAdminUserAccess": 1, "sfSelectCompany": 1, "sfSetUserPassword": 1, "sfSetupCompany": 1, "mtImportVehicles": 1, "mtSaveRecord": 1, "mtSaveRequest": 1, "mtDecideRequest": 1, "mtCancelRequest": 1, "mtSignRequest": 1, "mtDelete": 1, "mtSaveRates": 1, "recordLogout": 1};