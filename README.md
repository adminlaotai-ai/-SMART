# ⛽ SMART Fuel System v5

ລະບົບບັນທຶກນ້ຳມັນ — ໜ້າເວັບ host ຢູ່ **Vercel**, ຂໍ້ມູນ ແລະ ເຊີບເວີຢູ່ **Google Apps Script + Google Sheets**.

```
Browser ──► Vercel (public/index.html) ──POST {fn,args}──► Apps Script Web App (doPost) ──► Google Sheets / Drive / LINE
```

## ໂຄງສ້າງ

| ໄຟລ໌ | ໜ້າທີ່ |
|---|---|
| `apps-script/Code.gs` | ໂຄດເຊີບເວີ (ວາງໃສ່ Apps Script) — ມີ `doPost` ສຳລັບ Vercel |
| `apps-script/Index.html` | ໜ້າເວັບ (ໃຊ້ໄດ້ທັງໃນ Apps Script ແລະ Vercel) |
| `web/gas-bridge.js` | ແທນ `google.script.run` ດ້ວຍ `fetch` ເມື່ອແລ່ນຢູ່ Vercel |
| `scripts/build.mjs` | ສ້າງ `public/` ສຳລັບ Vercel |

## 1) ຕັ້ງຄ່າ Google Apps Script

1. ເປີດ Google Sheet → Extensions → Apps Script.
2. ວາງ `apps-script/Code.gs` ແທນ Code.gs ເກົ່າ, ແລະ `apps-script/Index.html` ແທນ Index.html.
3. **Project Settings → Script Properties** ເພີ່ມ (ຄ່າລັບບໍ່ເກັບໃນ GitHub):
   - `LINE_ACCESS_TOKEN`
   - `GROUP_ID`
   - `DRIVE_FOLDER_ID`
4. **Deploy → Manage deployments → Edit (ຫຼື New deployment) → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Copy **Web app URL** (ລົງທ້າຍດ້ວຍ `/exec`).

> ທຸກຄັ້ງທີ່ແກ້ Code.gs ຕ້ອງ Deploy ເປັນ version ໃໝ່ (Edit → Version: New) ຈຶ່ງມີຜົນ.

## 2) ເຊື່ອມ Vercel ກັບ GitHub

1. ເຂົ້າ <https://vercel.com/new> → Import Git Repository → ເລືອກ repo ນີ້.
2. Framework Preset: **Other** (ຄ່າ build ອ່ານຈາກ `vercel.json` ອັດຕະໂນມັດ).
3. **Environment Variables**: `GAS_WEB_APP_URL` = URL `/exec` ຈາກຂັ້ນຕອນ 1.
4. ກົດ **Deploy**.

ຫຼັງຈາກນີ້ ທຸກຄັ້ງທີ່ push ຂຶ້ນ `main` Vercel ຈະ deploy ໃໝ່ເອງ. ຖ້າປ່ຽນ `GAS_WEB_APP_URL` ຕ້ອງ Redeploy.

## ທົດສອບໃນເຄື່ອງ

```bash
GAS_WEB_APP_URL="https://script.google.com/macros/s/XXXX/exec" npm run build
npx serve public
```

## ຄວາມປອດໄພ

- `doPost` ເອີ້ນໄດ້ສະເພາະ function ທີ່ຢູ່ໃນ `SF_FN_SPEC` ແລະ ບໍ່ແມ່ນ `owner` (setup / trigger / backup ຕ້ອງ Run ຈາກ Apps Script editor ເທົ່ານັ້ນ).
- ທຸກ function `auth` ຍັງກວດ session token ຄືເກົ່າ.
