# NAWAT Desktop — طبقة سطح المكتب (Electron)

الواجهة نفسها تعمل في المتصفح وفي تطبيق سطح المكتب. الفرق أن Electron يحقن
`window.nawat` الذي يوفّر القدرات التي لا يستطيع المتصفح تنفيذها.

## الملفات

| ملف                       | الدور                                                               |
| ------------------------- | ------------------------------------------------------------------- |
| `electron/main.cjs`       | العملية الرئيسية: النافذة + معالجات IPC (ملفات، PowerShell، Ollama) |
| `electron/preload.cjs`    | جسر آمن يعرض `window.nawat` للواجهة مع `contextIsolation`           |
| `src/lib/nawat/bridge.ts` | طبقة الواجهة: تستخدم `window.nawat` إن وُجد، وإلا وضع المتصفح       |

## التشغيل محليًا

```bash
npm install --save-dev electron @electron/packager
npm run dev                # الواجهة على http://localhost:8080
npx electron electron/main.cjs
```

## بناء نسخة Windows

1. أضف في `vite.config.ts` القيمة `base: './'` (مطلوبة لتحميل الملفات عبر `file://`).
2. `npx vite build`
3. ```bash
   npx @electron/packager . "NAWAT Desktop" --platform=win32 --arch=x64 \
     --out=release --overwrite --ignore='node_modules' --ignore='^/src'
   ```

## توسعة الطبقة المحلية

أضف معالج IPC في `main.cjs` ثم اعرضه في `preload.cjs`:

- `node-pty` + `xterm.js` لطرفية تفاعلية حقيقية بدل `exec`.
- `ssh2` لاتصال SSH.
- `chokidar` لمراقبة تغيّر الملفات وتحديث المستكشف تلقائيًا.
- `better-sqlite3` لحفظ المحادثات والمهام في قاعدة بيانات محلية.
- `keytar` لتخزين المفاتيح والأسرار بأمان.
- `electron-log` للسجلات، و`electron-builder` لإنشاء المثبّت.
