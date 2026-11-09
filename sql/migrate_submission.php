<?php
/**
 * ترحيل حقول التسليم: رابط المشروع وصورته.
 *
 * آمن للتكرار ولا يحذف شيئاً.
 * التشغيل: http://localhost/project_dashboard/sql/migrate_submission.php
 *
 * الصورة تُخزَّن كـ data URL داخل العمود لا كملف على القرص:
 * يبقى المشروع قابلاً للنقل بنسخة واحدة من قاعدة البيانات، ويعمل
 * العرض التجريبي على GitHub Pages بالمنطق نفسه بلا خادم ملفات.
 * الواجهة تضغط الصورة قبل الإرسال فلا يتضخّم العمود.
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../api/db.php';

$steps = [];

try {
    $pdo = db();

    $cols = [
        'repo_url' => "ALTER TABLE projects ADD COLUMN repo_url VARCHAR(500) NULL AFTER description",
        'image'    => "ALTER TABLE projects ADD COLUMN image LONGTEXT NULL AFTER repo_url",
    ];

    foreach ($cols as $name => $sql) {
        /* SHOW COLUMNS لا يقبل متغيّراً مُعدّاً، فيُسأل information_schema */
        $stmt = $pdo->prepare(
            'SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME   = "projects"
               AND COLUMN_NAME  = ?'
        );
        $stmt->execute([$name]);

        if ((int) $stmt->fetchColumn() > 0) {
            $steps[] = "projects.{$name}: موجود مسبقاً";
            continue;
        }

        $pdo->exec($sql);
        $steps[] = "projects.{$name}: أُضيف";
    }

    $row = $pdo->query(
        'SELECT COUNT(*) AS total,
                SUM(repo_url IS NOT NULL AND repo_url <> "") AS with_link,
                SUM(image IS NOT NULL AND image <> "")       AS with_image
         FROM projects'
    )->fetch();

    echo json_encode([
        'ok'      => true,
        'steps'   => $steps,
        'summary' => [
            'projects'   => (int) $row['total'],
            'withLink'   => (int) $row['with_link'],
            'withImage'  => (int) $row['with_image'],
        ],
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'ok'    => false,
        'steps' => $steps,
        'error' => $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
}
