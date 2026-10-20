<?php
/**
 * ترحيل الدفعات: تحويل العمود النصي trainees.bootcamp إلى كيان مستقل.
 *
 * آمن للتكرار (idempotent): يمكن تشغيله أكثر من مرة دون أثر جانبي،
 * ولا يحذف أي بيانات قائمة — العمود bootcamp يبقى كما هو نسخةً احتياطية.
 *
 * التشغيل: http://localhost/project_dashboard/sql/migrate_cohorts.php
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../api/db.php';

$steps = [];

try {
    $pdo = db();

    /* لا معاملة هنا: أوامر DDL في MySQL تُنهي المعاملة ضمنياً،
       والخطوات مصممة لتكون آمنة للتكرار بدلاً من ذلك. */

    /* 1) جدول الدفعات */
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS cohorts (
          id          VARCHAR(20)  NOT NULL PRIMARY KEY,
          name        VARCHAR(80)  NOT NULL,
          platform_id VARCHAR(20)  NULL,
          starts_at   DATE         NULL,
          ends_at     DATE         NULL,
          active      TINYINT(1)   NOT NULL DEFAULT 1,
          UNIQUE KEY uq_cohort_name (name),
          KEY ix_cohort_platform (platform_id),
          CONSTRAINT fk_cohort_platform FOREIGN KEY (platform_id)
            REFERENCES platforms(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    $steps[] = 'cohorts table ready';

    /* 2) عمود الربط في جدول المتدربين */
    $hasCol = $pdo->query("SHOW COLUMNS FROM trainees LIKE 'cohort_id'")->fetch();
    if (!$hasCol) {
        $pdo->exec("ALTER TABLE trainees ADD COLUMN cohort_id VARCHAR(20) NULL AFTER bootcamp");
        $pdo->exec("ALTER TABLE trainees ADD KEY ix_trainee_cohort (cohort_id)");
        $pdo->exec("
            ALTER TABLE trainees ADD CONSTRAINT fk_trainee_cohort
            FOREIGN KEY (cohort_id) REFERENCES cohorts(id) ON DELETE SET NULL
        ");
        $steps[] = 'trainees.cohort_id added';
    } else {
        $steps[] = 'trainees.cohort_id already present';
    }

    /* 3) إنشاء دفعة لكل قيمة نصية مميزة في bootcamp */
    $rows = $pdo->query("
        SELECT bootcamp, MIN(platform_id) AS platform_id, COUNT(*) AS n
        FROM trainees
        WHERE bootcamp IS NOT NULL AND TRIM(bootcamp) <> ''
        GROUP BY bootcamp
    ")->fetchAll(PDO::FETCH_ASSOC);

    $created = 0;
    $findStmt = $pdo->prepare("SELECT id FROM cohorts WHERE name = ? LIMIT 1");
    $insStmt  = $pdo->prepare("INSERT INTO cohorts (id, name, platform_id, active) VALUES (?, ?, ?, 1)");
    $linkStmt = $pdo->prepare("UPDATE trainees SET cohort_id = ? WHERE bootcamp = ? AND cohort_id IS NULL");

    $seq = (int) $pdo->query("SELECT COUNT(*) FROM cohorts")->fetchColumn();

    foreach ($rows as $row) {
        $findStmt->execute([$row['bootcamp']]);
        $id = $findStmt->fetchColumn();

        if (!$id) {
            $seq++;
            $id = 'c_' . $seq;
            $insStmt->execute([$id, $row['bootcamp'], $row['platform_id'] ?: null]);
            $created++;
        }

        $linkStmt->execute([$id, $row['bootcamp']]);
    }

    $steps[] = "cohorts created: {$created}";

    $summary = $pdo->query("
        SELECT c.id, c.name, c.platform_id, COUNT(t.id) AS trainees
        FROM cohorts c LEFT JOIN trainees t ON t.cohort_id = c.id
        GROUP BY c.id, c.name, c.platform_id ORDER BY c.id
    ")->fetchAll(PDO::FETCH_ASSOC);

    $unlinked = (int) $pdo->query("SELECT COUNT(*) FROM trainees WHERE cohort_id IS NULL")->fetchColumn();

    echo json_encode([
        'ok'       => true,
        'steps'    => $steps,
        'cohorts'  => $summary,
        'unlinked' => $unlinked,
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'ok'    => false,
        'steps' => $steps,
        'error' => $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
}
