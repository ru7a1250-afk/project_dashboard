# منصة إدارة معسكرات البرمجة

> Tech Bootcamp Manager — لوحة تحكّم عربية (RTL) لمتابعة المتدربين، تقييم المشاريع، رصد المهارات، وإصدار الشهادات.

مبنية بـ **HTML5 + CSS3 + Vanilla JavaScript** في الواجهة، و**PHP + MySQL** في الخلفية، بلا أي إطار عمل.

---

## المتطلبات

| الأداة | ملاحظة |
|---|---|
| XAMPP | Apache + MySQL (MariaDB 10.4 فأحدث) |
| PHP 7.4 فأحدث | مع امتداد PDO MySQL (مفعّل افتراضياً في XAMPP) |
| متصفح حديث | Chrome أو Edge أو Firefox |

---

## التشغيل

### ١. ضع المشروع في مجلد الخادم

```
C:\xampp\htdocs\project_dashboard
```

### ٢. شغّل Apache و MySQL

من **XAMPP Control Panel** اضغط **Start** أمام كلٍّ منهما.

### ٣. اضبط بيانات الاتصال

ملف `api/db.php` **غير مرفوع إلى المستودع** عمداً (فيه بيانات الاتصال)، فأنشئه من القالب:

```bash
cd C:\xampp\htdocs\project_dashboard
copy api\db.example.php api\db.php
```

ثم افتح `api/db.php` واضبط `DB_USER` و`DB_PASS` إن لزم. في XAMPP الافتراضي: المستخدم `root` وكلمة المرور فارغة.

### ٤. أنشئ قاعدة البيانات

من سطر الأوامر:

```bash
cd C:\xampp\htdocs\project_dashboard
C:\xampp\mysql\bin\mysql.exe -u root --default-character-set=utf8mb4 < sql/schema.sql
```

أو من **phpMyAdmin**: تبويب `Import` ← اختر `sql/schema.sql` ← `Go`.

> الملف ينشئ قاعدة `bootcamp_manager` وجدوليها ويملؤها ببيانات تجريبية: 3 متدربين و5 مشاريع.

### ٥. افتح المنصة

```
http://localhost/project_dashboard/index.php
```

### ٦. تأكّد أن الاتصال حيّ

```
http://localhost/project_dashboard/api/api.php?action=ping
```

الرد المتوقّع:

```json
{ "ok": true, "data": { "status": "ok", "time": "..." } }
```

---

## بنية المشروع

```
project_dashboard/
├── api/
│   ├── db.php              ★ الاتصال الوحيد بقاعدة البيانات
│   └── api.php               نقاط النهاية (14 إجراءً)
├── css/
│   ├── styles.css            المتغيرات، التخطيط، التجاوب
│   └── components.css        المكوّنات والنوافذ والشهادة
├── js/
│   ├── dataService.js        طبقة البيانات — تستدعي api.php
│   ├── dataService.local.js  نسخة بديلة تعمل بـ LocalStorage بلا خادم
│   ├── ui.js                 طبقة العرض — DOM فقط
│   └── app.js                المتحكّم — الأحداث والمنطق
├── sql/
│   └── schema.sql            الجداول والبيانات الافتراضية
├── index.php                 الصفحة الوحيدة
└── README.md
```

### فصل الطبقات

```
index.php  →  app.js  →  ui.js        (العرض والأحداث)
                  ↓
           dataService.js               (طبقة البيانات)
                  ↓  fetch()
           api/api.php                  (نقاط النهاية)
                  ↓  require
           api/db.php                   ★ PDO
                  ↓
              MySQL
```

**`ui.js` و`app.js` لا يعرفان مصدر البيانات إطلاقاً.** لهذا أمكن استبدال LocalStorage بـ MySQL دون تعديل حرف فيهما.

---

## الاتصال بقاعدة البيانات

كل الإعدادات في **مكان واحد**: أول أسطر `api/db.php`.

```php
const DB_HOST    = 'localhost';
const DB_NAME    = 'bootcamp_manager';
const DB_USER    = 'root';
const DB_PASS    = '';          // فارغة في XAMPP
const DB_CHARSET = 'utf8mb4';   // ضروري للعربية
```

يُستخدم **PDO** مع `EMULATE_PREPARES => false`، وكل الاستعلامات مُعدّة (Prepared Statements) — حماية من حقن SQL.

---

## الواجهة البرمجية

كل الطلبات إلى `api/api.php?action=<الإجراء>`، والرد JSON دائماً:

```json
نجاح : { "ok": true,  "data": ... }
فشل  : { "ok": false, "error": "رسالة عربية" }
```

| الإجراء | الطريقة | الوصف |
|---|---|---|
| `getProjects` | GET | كل المشاريع |
| `addProject` | POST | إضافة مشروع |
| `updateProjectStatus` | POST | تغيير الحالة (السحب والإفلات) |
| `updateProject` | POST | تعديل بيانات مشروع |
| `deleteProject` | POST | حذف مشروع |
| `getStats` | GET | الإحصائيات |
| `getTrainees` | GET | كل المتدربين |
| `getTraineeById` | GET | متدرب واحد |
| `addTrainee` | POST | إضافة متدرب |
| `updateTrainee` | POST | تعديل متدرب |
| `deleteTrainee` | POST | حذف متدرب ومشاريعه |
| `certifyTrainee` | POST | إصدار شهادة |
| `updateTraineeBadges` | POST | حفظ الشارات |
| `resetData` | POST | إعادة البيانات الافتراضية |
| `ping` | GET | فحص الاتصال |

---

## قاعدة البيانات

### `trainees`

| العمود | النوع | ملاحظة |
|---|---|---|
| `id` | VARCHAR(20) | `t_1`، `t_2` … |
| `name` | VARCHAR(60) | فريد |
| `track` | VARCHAR(20) | `UI_UX` / `FullStack` / `FrontEnd` |
| `certified` | TINYINT(1) | حصل على شهادة؟ |
| `skills` | JSON | `{"HTML":90,"CSS":95,...}` |
| `badges` | JSON | الشارات المكتسبة |

### `projects`

| العمود | النوع | ملاحظة |
|---|---|---|
| `id` | VARCHAR(20) | `p_1`، `p_2` … |
| `trainee_id` | VARCHAR(20) | مفتاح أجنبي — `ON DELETE CASCADE` |
| `status` | ENUM | `approved` / `under_review` / `needs_revision` |
| `progress` | TINYINT | 0–100 |
| `score` | TINYINT | يقبل NULL |

> حذف المتدرب يحذف مشاريعه تلقائياً على مستوى قاعدة البيانات.

---

## المكتبات الخارجية (CDN)

| المكتبة | الاستخدام |
|---|---|
| Google Fonts — Tajawal | الخط العربي |
| FontAwesome 6.5 | الأيقونات |
| Chart.js 4.4 | المخطط الراداري للمهارات |
| SortableJS 1.15 | السحب والإفلات في الكانبان |
| Canvas Confetti 1.9 | احتفالات إنجاز المشاريع |

---

## الميزات

- **لوحة كانبان** بثلاثة أعمدة مع سحب وإفلات
- **فلترة متقاطعة حية**: بحث نصي × حالة × مسار
- **بطاقات إحصائية** تتحدّث فوراً مع الفلترة
- **مخطط راداري** خماسي لمهارات كل متدرب
- **خريطة مسار التعلم** بعقد ملوّنة حسب الحالة
- **قائمة صدارة** بنظام نقاط ونطاقات زمنية
- **نظام شارات** يُمنح تلقائياً ويُحفظ في القاعدة
- **مُقيّم ذكي** (محاكاة محلية) يقترح درجة وملاحظات
- **شهادة اجتياز** قابلة للطباعة بإطار ذهبي
- **وضع داكن** يُحفظ تفضيله
- **تصميم متجاوب** من 375px فأعلى

---

## التشغيل بلا قاعدة بيانات

لتشغيل المنصة بلا XAMPP (على GitHub Pages مثلاً):

```bash
cp js/dataService.local.js js/dataService.js
```

تعمل حينها بالكامل من LocalStorage في المتصفح.

> للعودة إلى MySQL، أعد ملف `dataService.js` الأصلي من سجلّ Git.

---

## حلّ المشكلات

| العرض | السبب والحل |
|---|---|
| الصفحة لا تفتح إطلاقاً | Apache متوقف — شغّله من XAMPP |
| `تعذّر الوصول إلى الخادم` | Apache متوقف أو المسار خاطئ |
| `تعذّر الاتصال بقاعدة البيانات` | MySQL متوقف، أو `DB_NAME` خاطئ في `api/db.php` |
| القاعدة غير موجودة | نفّذ `sql/schema.sql` (الخطوة ٣) |
| تعديل لا يظهر أثره | تخزين مؤقت — لكن `index.php` يرقّم الملفات تلقائياً، فجرّب `Ctrl+Shift+R` |
| رموز غريبة بدل العربية | تأكّد أن ترميز القاعدة `utf8mb4` |

### أداة التشخيص الأولى

```
http://localhost/project_dashboard/api/api.php?action=ping
```

- رد JSON سليم ← الخادم والقاعدة بخير، والمشكلة في الواجهة
- `ok: false` ← الرسالة تذكر السبب بدقة
- لا رد إطلاقاً ← Apache متوقف

---

## ملاحظات أمنية

هذه نسخة تطويرية على جهاز محلي. **قبل أي استضافة حقيقية:**

1. غيّر كلمة مرور `root` وحدّث `DB_PASS`
2. أنشئ مستخدم قاعدة بيانات بصلاحيات محدودة بدل `root`
3. استبعد `api/db.php` من Git (`.gitignore`)
4. أضف نظام تسجيل دخول وصلاحيات — **المنصة حالياً بلا مصادقة**، فكل من يفتح الرابط يرى كل شيء ويستطيع تعديله وحذفه
