<?php
/**
 * db.example.php — قالب الاتصال بقاعدة البيانات
 *
 * انسخ هذا الملف إلى api/db.php ثم اضبط القيم أدناه.
 * الملف api/db.php مستثنى من Git عمداً حتى لا تُنشر بيانات الاتصال.
 *
 * db.php — الاتصال بقاعدة البيانات
 *
 * هذا هو الملف الوحيد في المشروع الذي يفتح اتصالاً بـ MySQL.
 * لا يطبع شيئاً ولا يُرجع HTML — يوفّر دالة db() فقط.
 *
 * يُستخدم PDO لا mysqli لأنه يدعم الاستعلامات المُعدّة بصيغة أوضح،
 * وهي خط الدفاع الأول ضد حقن SQL.
 */

declare(strict_types=1);

const DB_HOST    = 'localhost';
const DB_NAME    = 'bootcamp_manager';
const DB_USER    = 'root';
const DB_PASS    = '';          // ضع كلمة المرور هنا (فارغة في XAMPP افتراضياً)
const DB_CHARSET = 'utf8mb4';   // ضروري لحفظ العربية سليمة

/**
 * يُرجع اتصالاً واحداً مشتركاً بقاعدة البيانات.
 *
 * @return PDO
 * @throws RuntimeException عند تعذّر الاتصال
 */
function db(): PDO
{
    static $pdo = null;

    /* الاتصال يُفتح مرة واحدة ويُعاد استخدامه */
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $dsn = sprintf(
        'mysql:host=%s;dbname=%s;charset=%s',
        DB_HOST,
        DB_NAME,
        DB_CHARSET
    );

    try {
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            /* الأخطاء تُرمى كاستثناءات بدل أن تمرّ صامتة */
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            /* استعلامات مُعدّة حقيقية على الخادم لا محاكاة */
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    } catch (PDOException $e) {
        throw new RuntimeException(
            'تعذّر الاتصال بقاعدة البيانات: ' . $e->getMessage(),
            500
        );
    }

    return $pdo;
}
