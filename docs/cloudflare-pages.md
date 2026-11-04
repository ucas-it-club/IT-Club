# نشر الموقع على Cloudflare Pages

من Workers & Pages اختاري Create application > Pages > Import an existing Git repository، ثم hala-dalloul/IT-Club.

- Production branch: master
- Framework preset: None
- Build command: npm run build:cloudflare
- Build output directory: dist/client
- Root directory: جذر المستودع (اتركيه فارغًا)
- Environment variable NODE_VERSION: 22.16.0
- VITE_SUPABASE_URL: https://jxweaxenswbjpxxjmihb.supabase.co
- VITE_SUPABASE_PUBLISHABLE_KEY: المفتاح العام السابق من إعدادات Supabase. لا تستخدمي service_role.

أضيفي المتغيرات قبل Save and Deploy. بعد النجاح يظهر عنوان pages.dev. افتحي / للنادي (و/en للنسخة الإنجليزية) و/admin للإدارة. الربط بـGitHub ينشر التعديلات التالية تلقائيًا على فرع master.

البناء ينسخ غلاف التطبيق إلى index.html ويضيف قواعد توجيه صفحات النادي والإدارة. ارفعي dist/client فقط؛ لا ترفعي dist/server أو ملفات البيئة.

بعد النشر تحققي من فتح /news و/join و/admin مباشرة وتحديث الصفحة، ثم تسجيل دخول المدير وعرض الصور. اختبري نموذجَي Google Sheets من العنوان المنشور؛ نجاح localhost لا يغني عن اختبار النطاق الجديد. لا تعيدي تشغيل migrations ولا تغيري صلاحيات الشيتين بسبب تغيير استضافة الواجهة.

لا يتطلب هذا المسار Workers أو أمر wrangler deploy. إذا طلبت شاشة Cloudflare أمر Deploy command فارجعي إلى اختيار Pages واستيراد مستودع Git.

حالة التنفيذ: إعداد البناء جاهز؛ النشر في حساب Cloudflare يحتاج ربط الحساب والمستودع من لوحة Cloudflare. إعدادات الموقع والنموذجين لا تُغيَّر بعملية النشر.

التوثيق الرسمي: https://developers.cloudflare.com/pages/framework-guides/deploy-anything/
