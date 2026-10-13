# Roadmap

## مفتوحة
- [x] دليل AR/FR مصوّر: 120 صفحة، غلاف أبيض وشعار وفهرس 3 صفحات وترقيم وتوقيع؛ 20 صفحة للمجموعة ورابط بشريط NAWAT Code.
- [x] تصحيح ترجمة الواجهة والتبديل FR/AR/EN؛ فحص 31 صفحة بالفرنسية بلا أحرف عربية خارج الكود والطرفية، والتبديل في مساحة العمل بلا أخطاء.
- [x] الطرفية: رسائل إنجليزية أولًا، ومنع تكرار أخطاء فحص الاتصال حتى تتغير الحالة.
- [ ] نشر تصحيح الطرفية إلى hn-ai.site — يتطلب وصول نشر آمن إلى السيرفر.
- [x] الربط السريع (/connect): hncode.hnchat.net وstudio.hnchat.net ونواة + موصلات مخصصة مثل tvcc.
- [x] المصنع عملي: زر خط الإنتاج الكامل + سجل مباشر.
- [x] صفحة ComfyUI (/comfyui) لتنظيم سير العمل وتوليد الصور.
- [x] النموذج المنسق: توزيع الأدوار وتنفيذ المهام (/projects).
- [x] مشاريع السيرفر: كل مشروع جديد في مجلد مستقل على السيرفر، وكتابة الملفات فيه.
- [x] مزامنة هذه النسخة مع النسخ الأخرى + محرك دمج الإضافات (/sync).
- [x] إصلاح حالة الاتصال المباشر على الموقع الآمن باستخدام تحديثات الموقع بدل اتصال WebSocket المحلي المحظور.
- [ ] تطبيق الهاتف nawat-mobile (Expo): المستخدم رفع مشروعًا مبتدئًا (App.tsx قالب فارغ) — المطلوب غير محدد بعد، بانتظار توضيح: بناء واجهة تطبيق موصولة بالجسر 8787 والخدمات (8788، ComfyUI، البوابة) وتسليم الكود كحزمة جاهزة.
- [ ] تغيير عنوان بوابة البحث ntapi.hn-dbpro.com — رسالة المستخدم كانت ناقصة («سأغيّرها إلى…») — بانتظار العنوان الجديد.
- [ ] تعارض منفذ 8792 بين editor-pack وsearch-pack — قرار المستخدم معلق.
- [ ] إكمال منافذ 56 — بانتظار نتيجة `sudo ss -tlnp`.
- [x] تطبيق الهاتف: أُضيف NAWAT-V01092006.apk كأحدث نسخة للتحميل في قسم الربط الهاتفي بصفحة المنافذ.
- [x] الاحتفاظ بإصدارات تطبيق الهاتف السابقة وإظهارها كخيارات تحميل منفصلة.

- [x] ربط الدردشة بالجسر العام bridge.hnchat.net (إرسال ثم متابعة النتيجة، مهلة 120 ثانية، إلغاء).
- [x] مصنع NAWAT (/factory) مع زر في أعلى الإعدادات: الهوية والبصمة، لوحة القيادة، النماذج، المهام، المقارنة، النشر؛ سكربتات السيرفر في deploy/factory.
- [x] MCP + CLI: cli/nawat.mjs (أمر nawat)، cli/mcp-server.mjs (Claude/Cursor/OpenCode)، صفحة /mcp.
- [x] Speed Build page (/speed-build): voice in/out, 3D glass code, preview
- [x] Day 1: 20 features (ledger #001-#020)

- [ ] Connect Google Search Console (new workspace) — blocked: user skipped connect card
- [x] Speed Build: mouse-resizable panels
- [x] نماذج المزوّدين تظهر تلقائيًا في workspace/speed-build/chat/tasks + تصنيف «مزوّد خارجي»
- [x] اكتشاف تلقائي للنماذج المحلية (الحاسوب + السيرفرات)
- [x] Day 2: 20 أداة (#021-#040) في /tools
- [ ] تعديل ملفات الحاسوب/السيرفر من الطرفية مع اختيار السيرفر — الجولة القادمة
- [x] Groupe-HN v1.1.0: CLI groupe-hn + MCP 29 أداة + دليل /groupe-hn (#041-#060)
- [x] تبويب SOUK-HN، حفظ الإعدادات على السيرفر، مختبر /tasks، المنسق، Watchdog (#061-#080)

- [x] تشغيل نسخة hn-ai.site على السيرفر 213.156.133.94 (متوقف: القرص ممتلئ)
- [ ] مزامنة nawat.groupe-hn.com و hn-ai.site وباقي النسخ (الروابط أُضيفت؛ المزامنة الآلية تنتظر تحديث الموقع الرسمي بالنشر)
- [x] تشغيل الجسر والمصنع والطرفية على السيرفر
- [x] ربط نسخة السيرفر بقاعدة البيانات الموجودة على السيرفر وبـ ComfyUI
- [x] إضافة ComfyUI http://213.156.132.166/comfy/ui/1/ لنسخة السيرفر
- [x] ربط نسخة السيرفر بـ Supabase المستضاف ذاتيًا (بدل نسخة CLI)
- [x] ربط كلمة سر ComfyUI السيرفر بأمان (محفوظة على السيرفر فقط، عبر hn-ai.site/comfy-hn)
- [ ] ComfyUI على 213.156.132.166 لا يجيب بعد تسجيل الدخول — يحتاج تشغيله على ذلك الجهاز
- [x] تجربة مستخدم /workspace: طي اللوحات (Ctrl+B / Ctrl+J / Ctrl+`)، وضع التركيز، حفظ المقاسات، لوحة الاختصارات، أوامر طرفية إنجليزية (#081-#090)
- [ ] رفع نسخة /workspace المحدّثة إلى hn-ai.site عند طلب المستخدم
- [x] Car platform UX test on 213.156.133.94 — result: 0.27 tok/s, queue full; server too busy for code generation
- [x] صفحة المزوّدين: قوالب مزوّدين سحابيين + مفتاح + تفعيل النماذج واحدًا واحدًا (المفعّل فقط يظهر في مساحة العمل)؛ Ollama/نواة المحلية تبقى الأساس
- [ ] NAWAT Code أوفلاين: تضمين ملفات الواجهة داخل حزمة exe — الجولة القادمة
- [x] المشاريع: فريق متخصص (منسّق + بناة HTML/CSS/JS بالتوازي + مصحّح + مراجع) يكتب مباشرة في ملفات المشروع

- [x] Deploy site copy to 213.156.132.166 (PM2 nawat-studio-web, port 3130, internal only)
- [ ] Public access + sync for 213.156.132.166 — blocked: needs a domain (IP host is blocked by its nginx catch-all)
- [ ] .166: finish import, run platform on local DB + local model bridge (blocked: SSH drops / no public domain)
- [ ] Platform calls nawat.groupe-hn.com/api/public/sync (separate project)
- [ ] relay_agent table in cloud DB (no Lovable Cloud on this project; exists on self-hosted .94)
- [x] Workspace chat via Groupe-HN instead of Ollama

- [x] التحقق من ظهور التطورات بعد الرفع: المعاينة تعرض 60 نموذجًا وتوقيع Groupe-HN، والمحادثة ترد عبر Groupe-HN، وhn-ai.site يعمل. المطلوب غير المحدد: أي تطوّر يقصده المستخدم.
- [ ] إصلاح منفذ الجسر الافتراضي: الطرفية تبحث في 8787 والجسر يشتغل على 8788 — اجعل 8788 أولًا مع إبقاء 8787 احتياطًا.
- [ ] تجهيز نسخة جديدة من برنامج NAWAT Code على حاسوبك تحمل كل التطورات (الفرنسية أساسًا، 60 نموذجًا، محادثة Groupe-HN).
- [x] إصلاح منفذ الجسر: 8788 أولًا و8787 احتياطًا مع فحص تلقائي للمنافذ.
- [x] إصلاح برنامج الحاسوب: يفتح hn-ai.site (الأحدث) بدل نسخة الشبكة المحلية القديمة، مع إمكانية الاختيار عبر NAWAT_URL.
- [x] إزالة علامات الاتجاه المخفية U+200F من الملفات المولّدة (المحرر يظلّلها بالأحمر).
- [x] إزالة علامات الاتجاه المخفية U+200F من الملفات المولّدة (تنظيف عند الحفظ) + 3 اختبارات.
- [x] التحقق: الطرفية في المعاينة وعلى hn-ai.site تستخدم 8788 فعلًا.
- [x] تجهيز مثبت NAWAT Code جديد يحمل ترتيب العناوين الجديد (hn-ai.site أولًا) — النسخة الحالية عندك ما زالت تفتح نسخة الشبكة القديمة.
- [x] تجهيز مثبت/نسخة محمولة جديدة من NAWAT Code: hn-ai.site أولًا، الفرنسية أساسًا، وإمكانية الاختيار عبر NAWAT_URL.
- [x] START-STUDIO-ALWAYS: open bridge on a free alternate port when 8788 busy
- [ ] (blocked: LAN-only, needs .env on LAN copy) /database: connect self-hosted DB 192.168.100.66:8000 (keys given by user; LAN-only address)
- [ ] Upload new build to hn-ai.site (blocked: server password not stored)
- [ ] Link hn-ai.site to self-hosted DB on 213.156.133.94
