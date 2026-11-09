<?php
/**
 * api.php — واجهة برمجية للمنصة
 *
 * كل الطلبات تصل إلى هذا الملف مع معامل action، ويعود الرد JSON دائماً:
 *   نجاح : { "ok": true,  "data": ... }
 *   فشل  : { "ok": false, "error": "رسالة عربية" }
 *
 * أمثلة:
 *   GET  api.php?action=getProjects
 *   POST api.php?action=addProject        (JSON في جسم الطلب)
 */

declare(strict_types=1);

require_once __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

/* ===================================================================
   أدوات الرد
   =================================================================== */

function respond(bool $ok, $payload, int $status = 200): void
{
    http_response_code($status);

    echo json_encode(
        $ok ? ['ok' => true, 'data' => $payload]
            : ['ok' => false, 'error' => $payload],
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
    );

    exit;
}

function fail(string $message, int $status = 400): void
{
    respond(false, $message, $status);
}

/** قراءة جسم الطلب كـ JSON */
function body(): array
{
    $raw = file_get_contents('php://input');

    if ($raw === false || $raw === '') {
        return [];
    }

    $data = json_decode($raw, true);

    return is_array($data) ? $data : [];
}

function today(): string
{
    return (new DateTime('now'))->format('Y-m-d');
}

/* ===================================================================
   الثوابت والتحقق
   =================================================================== */

const STATUSES = ['approved', 'under_review', 'needs_revision'];

/*
   المسارات تأتي من جدول tracks لا من قائمة ثابتة،
   فإضافة مسار جديد لا تحتاج تعديل أي كود.
*/
function trackIndex(PDO $pdo): array
{
    static $index = null;

    if ($index !== null) {
        return $index;
    }

    $rows = $pdo->query('SELECT * FROM tracks ORDER BY sort, id')->fetchAll();
    $index = [];

    foreach ($rows as $row) {
        $index[$row['id']] = $row;
    }

    return $index;
}

function mapTrack(array $row, array $skills = []): array
{
    return [
        'id'     => $row['id'],
        'label'  => $row['label'],
        'color'  => $row['color'],
        'sort'   => (int) $row['sort'],
        'active' => (bool) $row['active'],
        'skills' => $skills[$row['id']] ?? [],
    ];
}

/**
 * مهارات كل مسار مفهرسة بمعرّفه.
 * مسار الأمن السيبراني لا يُقاس بـ CSS، ولا علم البيانات بـ PHP —
 * فلكل مسار مجموعته الخاصة.
 *
 * @return array مثال: ['AI' => ['Python', 'تعلّم الآلة', ...]]
 */
function trackSkillsIndex(PDO $pdo): array
{
    static $index = null;

    if ($index !== null) {
        return $index;
    }

    $rows = $pdo->query(
        'SELECT track_id, skill FROM track_skills ORDER BY track_id, sort'
    )->fetchAll();

    $index = [];

    foreach ($rows as $row) {
        $index[$row['track_id']][] = $row['skill'];
    }

    return $index;
}

/** المهارات الافتراضية لمسار بعينه، ككائن مهارة ← قيمة مبدئية */
function defaultSkillsFor(PDO $pdo, ?string $trackId): array
{
    $names = trackSkillsIndex($pdo)[$trackId] ?? [];

    /* مسار بلا مهارات مسجّلة يعود إلى المجموعة العامة.
       كانت هنا مهارات الواجهات الأمامية، وهي لا تناسب مساراً كتطوير
       الألعاب أو الأمن السيبراني، فاستُبدلت بمهارات محايدة. */
    if (!$names) {
        $names = genericTrackSkills();
    }

    $out = [];

    foreach ($names as $name) {
        $out[$name] = 50;
    }

    return $out;
}

function trackLabelOf(PDO $pdo, ?string $id): string
{
    $index = trackIndex($pdo);
    return $index[$id]['label'] ?? (string) $id;
}

/* المفردات القديمة تبقى مقبولة حتى لا تنكسر أي واجهة */
const STATUS_ALIASES = [
    'review'         => 'under_review',
    'rework'         => 'needs_revision',
    'approved'       => 'approved',
    'under_review'   => 'under_review',
    'needs_revision' => 'needs_revision',
];

const STATUS_TO_DOM = [
    'approved'       => 'approved',
    'under_review'   => 'review',
    'needs_revision' => 'rework',
];

function normalizeStatus(?string $status): ?string
{
    $key = trim((string) $status);
    return STATUS_ALIASES[$key] ?? null;
}

function normalizeTrack(?string $track): ?string
{
    $key = trim((string) $track);
    return isset(trackIndex(db())[$key]) ? $key : null;
}

function clampPercent($value, ?int $fallback = null): ?int
{
    if ($value === null || $value === '' || !is_numeric($value)) {
        return $fallback;
    }

    return max(0, min(100, (int) round((float) $value)));
}

/** معرّف تسلسلي جديد: p_6 ، t_4 ... */
function nextId(PDO $pdo, string $table, string $prefix): string
{
    $rows = $pdo->query("SELECT id FROM {$table}")->fetchAll();
    $max = 0;

    foreach ($rows as $row) {
        $n = (int) str_replace($prefix, '', $row['id']);
        if ($n > $max) {
            $max = $n;
        }
    }

    return $prefix . ($max + 1);
}

/* ===================================================================
   التحويل بين صيغة الجدول وصيغة الواجهة
   =================================================================== */

function mapTrainee(array $row, array $platforms = []): array
{
    $pf = $platforms[$row['platform_id'] ?? ''] ?? null;

    return [
        'id'                => $row['id'],
        'name'              => $row['name'],
        'track'             => $row['track'],
        'trackLabel'        => $row['track_label'],
        'bootcamp'          => $row['bootcamp'] ?? '',
        'cohortId'          => $row['cohort_id'] ?? null,
        'cohortName'        => $row['cohort_name'] ?? ($row['bootcamp'] ?? ''),
        'platformId'        => $row['platform_id'] ?? null,
        'platformName'      => $pf['name'] ?? '',
        'platformShort'     => $pf['short_name'] ?? '',
        'platformColor'     => $pf['color'] ?? '',
        'avatar'            => $row['avatar'],
        'joinedAt'          => $row['joined_at'],
        'certified'         => (bool) $row['certified'],
        'certifiedAt'       => $row['certified_at'],
        'certificateSerial' => $row['certificate_serial'],
        'skills'            => json_decode($row['skills'] ?? '{}', true) ?: [],
        'badges'            => json_decode($row['badges'] ?? '[]', true) ?: [],
    ];
}

function mapProject(array $row, array $platforms = [], array $trackLabels = []): array
{
    $status = $row['status'];
    $pf = $platforms[$row['platform_id'] ?? ''] ?? null;

    return [
        'id'          => $row['id'],
        'projectName' => $row['project_name'],
        'traineeId'   => $row['trainee_id'],
        'traineeName' => $row['trainee_name'] ?? '',
        'status'      => $status,
        'track'       => $row['track'],
        'progress'    => (int) $row['progress'],
        'dueDate'     => $row['due_date'],
        'description' => $row['description'],
        'feedback'    => $row['feedback'] ?? '',
        /* حقول التسليم: رابط المستودع وصورة المشروع (data URL) */
        'repoUrl'     => $row['repo_url'] ?? '',
        'image'       => $row['image'] ?? '',
        'score'       => $row['score'] === null ? null : (int) $row['score'],
        'createdAt'   => $row['created_at'],
        'updatedAt'   => $row['updated_at'],

        /* حقول مشتقّة تعتمد عليها الواجهة */
        'title'       => $row['project_name'],
        /* لم يعد هناك حقل domStatus: الواجهة تستخدم المفردات نفسها */
        'trackLabel'  => $trackLabels[$row['track']] ?? $row['track'],
        'platformId'    => $row['platform_id'] ?? null,
        'platformName'  => $pf['name'] ?? '',
        'platformShort' => $pf['short_name'] ?? '',
        'platformColor' => $pf['color'] ?? '',
    ];
}

/** الجهات التدريبية مفهرسة بالمعرّف — لتسمية كل متدرب ومشروع */
function platformIndex(PDO $pdo): array
{
    static $index = null;

    if ($index !== null) {
        return $index;
    }

    $rows = $pdo->query('SELECT * FROM platforms')->fetchAll();
    $index = [];

    foreach ($rows as $row) {
        $index[$row['id']] = $row;
    }

    return $index;
}

/** أول جهة مسجّلة — تُستخدم حين لا تُحدَّد جهة للمتدرب */
function defaultPlatformId(PDO $pdo): ?string
{
    $index = platformIndex($pdo);

    foreach ($index as $id => $row) {
        return $id;
    }

    return null;
}

/**
 * مهارات عامة تصلح لأي مسار.
 * تُستخدم حين يُضاف مسار دون تحديد مهاراته، حتى لا يولد مسار بلا مهارات
 * فتظهر بطاقة المتدرب برادار فارغ.
 */
function genericTrackSkills(): array
{
    return ['أساسيات البرمجة', 'حل المشكلات', 'جودة الكود', 'العمل ضمن فريق', 'إدارة المشروع'];
}

/**
 * ضبط مهارات مسار: تُستبدل القائمة بالكامل.
 * @param array $skills أسماء المهارات بالترتيب المطلوب
 * @return array الأسماء بعد التنظيف
 */
function setTrackSkills(PDO $pdo, string $trackId, array $skills): array
{
    $clean = [];

    foreach ($skills as $skill) {
        $name = trim((string) $skill);
        /* تجاهل الفارغ والمكرر، والاسم أطول من عمود الجدول */
        if ($name === '' || mb_strlen($name) > 40) continue;
        if (in_array($name, $clean, true)) continue;
        $clean[] = $name;
    }

    if ($clean === []) {
        $clean = genericTrackSkills();
    }

    $pdo->prepare('DELETE FROM track_skills WHERE track_id = ?')->execute([$trackId]);

    $stmt = $pdo->prepare('INSERT INTO track_skills (track_id, skill, sort) VALUES (?,?,?)');

    foreach ($clean as $i => $name) {
        $stmt->execute([$trackId, $name, $i + 1]);
    }

    return $clean;
}

/**
 * تنظيف رابط المشروع.
 * يُقبل http/https فقط: javascript: و data: في خانة رابط تُنفَّذ
 * عند النقر، فتصبح ثغرة.
 */
function cleanRepoUrl($value): string
{
    $url = trim((string) $value);

    if ($url === '') return '';

    $scheme = strtolower((string) parse_url($url, PHP_URL_SCHEME));

    if (!in_array($scheme, ['http', 'https'], true)) {
        fail('رابط المشروع يجب أن يبدأ بـ http أو https');
    }

    if (mb_strlen($url) > 500) {
        fail('رابط المشروع طويل جداً');
    }

    return $url;
}

/**
 * تنظيف صورة المشروع.
 * تُقبل data URL لصورة فقط، بحد أقصى ~2MB بعد الترميز — الواجهة
 * تضغط الصورة قبل الإرسال، وهذا الحد خط الدفاع الأخير.
 */
function cleanImage($value): string
{
    $img = trim((string) $value);

    if ($img === '') return '';

    if (!preg_match('#^data:image/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$#', $img)) {
        fail('صيغة الصورة غير مدعومة');
    }

    if (strlen($img) > 2 * 1024 * 1024) {
        fail('حجم الصورة كبير جداً بعد الضغط');
    }

    return $img;
}

/*
   كان هنا منع صارم للإجازة بلا رابط. أُزيل عمداً: المنع دفع إلى
   البحث عن روابط وهمية، والرابط الكاذب يبدو توثيقاً وليس كذلك —
   وهو أسوأ من غيابه. صار التنبيه في الواجهة قابلاً للتجاوز، ومع
   علامة ظاهرة على كل مشروع مُجاز بلا رابط حتى لا تختفي المسألة.
*/

/** اسم الدفعة من معرّفها، أو سلسلة فارغة إن لم توجد */
function cohortNameOf(PDO $pdo, ?string $cohortId): string
{
    if (!$cohortId) return '';

    $stmt = $pdo->prepare('SELECT name FROM cohorts WHERE id = ?');
    $stmt->execute([$cohortId]);

    return (string) ($stmt->fetchColumn() ?: '');
}

/** دفعة تدريبية: مجموعة متدربين تبدأ وتنتهي معاً تحت جهة واحدة */
function mapCohort(array $row): array
{
    return [
        'id'           => $row['id'],
        'name'         => $row['name'],
        'platformId'   => $row['platform_id'] ?? null,
        'platformName' => $row['platform_name'] ?? '',
        'startsAt'     => $row['starts_at'] ?? null,
        'endsAt'       => $row['ends_at'] ?? null,
        'active'       => (bool) ($row['active'] ?? 1),
        'traineeCount' => isset($row['trainee_count']) ? (int) $row['trainee_count'] : 0,
    ];
}

function mapPlatform(array $row): array
{
    return [
        'id'        => $row['id'],
        'name'      => $row['name'],
        'shortName' => $row['short_name'],
        'color'     => $row['color'],
        'active'    => (bool) $row['active'],
    ];
}

/** كل الإعدادات ككائن مفتاح ← قيمة */
function allSettings(PDO $pdo): array
{
    $rows = $pdo->query('SELECT `key`, `value` FROM settings')->fetchAll();
    $out = [];

    foreach ($rows as $row) {
        $out[$row['key']] = $row['value'];
    }

    return $out;
}

/** استعلام المشاريع مضموماً باسم صاحبها */
function selectProjects(PDO $pdo, string $where = '', array $params = []): array
{
    $sql = 'SELECT p.*, t.name AS trainee_name
            FROM projects p
            JOIN trainees t ON t.id = p.trainee_id';

    if ($where !== '') {
        $sql .= ' WHERE ' . $where;
    }

    $sql .= ' ORDER BY p.id';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    $platforms = platformIndex($pdo);

    $trackLabels = [];

    foreach (trackIndex($pdo) as $id => $row) {
        $trackLabels[$id] = $row['label'];
    }

    return array_map(function ($row) use ($platforms, $trackLabels) {
        return mapProject($row, $platforms, $trackLabels);
    }, $stmt->fetchAll());
}

function findProject(PDO $pdo, string $id): ?array
{
    $rows = selectProjects($pdo, 'p.id = ?', [$id]);
    return $rows[0] ?? null;
}

function findTrainee(PDO $pdo, string $id): ?array
{
    $stmt = $pdo->prepare(
        'SELECT t.*, c.name AS cohort_name
         FROM trainees t
         LEFT JOIN cohorts c ON c.id = t.cohort_id
         WHERE t.id = ?'
    );
    $stmt->execute([$id]);
    $row = $stmt->fetch();

    return $row ? mapTrainee($row, platformIndex($pdo)) : null;
}

/* ===================================================================
   المعالِجات
   =================================================================== */

$pdo = db();
$action = $_GET['action'] ?? '';
$input = body();

try {
    switch ($action) {

        /* ---------------- المشاريع ---------------- */

        case 'getProjects':
            respond(true, selectProjects($pdo));

        case 'addProject': {
            $name = trim((string) ($input['projectName'] ?? $input['title'] ?? ''));
            if ($name === '') {
                fail('اسم المشروع مطلوب');
            }

            /* صاحب المشروع: بالمعرّف أو بالاسم */
            $traineeId = $input['traineeId'] ?? null;

            if (!$traineeId && !empty($input['traineeName'])) {
                $stmt = $pdo->prepare('SELECT id FROM trainees WHERE name = ?');
                $stmt->execute([$input['traineeName']]);
                $traineeId = $stmt->fetchColumn() ?: null;
            }

            if (!$traineeId) {
                fail('المتدرب مطلوب');
            }

            $owner = findTrainee($pdo, (string) $traineeId);
            if (!$owner) {
                fail('المتدرب غير موجود: ' . $traineeId);
            }

            $status = isset($input['status'])
                ? normalizeStatus((string) $input['status'])
                : 'under_review';

            if ($status === null) {
                fail('حالة غير صالحة: ' . ($input['status'] ?? ''));
            }

            $track = isset($input['track'])
                ? normalizeTrack((string) $input['track'])
                : $owner['track'];

            if ($track === null) {
                fail('مسار غير صالح: ' . ($input['track'] ?? ''));
            }

            $defaultProgress = $status === 'approved' ? 100
                             : ($status === 'needs_revision' ? 40 : 60);

            $id = nextId($pdo, 'projects', 'p_');

            $stmt = $pdo->prepare(
                'INSERT INTO projects
                 (id, project_name, trainee_id, status, track, platform_id, progress,
                  due_date, description, repo_url, image, feedback, score, created_at, updated_at)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
            );

            $stmt->execute([
                $id,
                $name,
                $traineeId,
                $status,
                $track,
                /* الجهة: المُدخلة، وإلا جهة صاحب المشروع */
                ($input['platformId'] ?? null) ?: ($owner['platformId'] ?? null),
                clampPercent($input['progress'] ?? null, $defaultProgress),
                /* فراغ يُخزَّن NULL لا سلسلة فارغة (عمود DATE) */
                ($input['dueDate'] ?? null) ?: null,
                trim((string) ($input["description"] ?? "")) ?: "مشروع جديد بانتظار التقييم.",
                cleanRepoUrl($input["repoUrl"] ?? ""),
                cleanImage($input["image"] ?? ""),
                trim((string) ($input["feedback"] ?? "")),
                clampPercent($input['score'] ?? null, null),
                today(),
                today(),
            ]);

            respond(true, findProject($pdo, $id));
        }

        case 'updateProjectStatus': {
            $id = (string) ($input['projectId'] ?? '');
            $status = normalizeStatus((string) ($input['status'] ?? ''));

            if ($status === null) {
                fail('حالة غير صالحة: ' . ($input['status'] ?? ''));
            }

            $existing = findProject($pdo, $id);

            if (!$existing) {
                fail('المشروع غير موجود: ' . $id);
            }

            /* المشروع المُجاز مكتمل بالضرورة */
            if ($status === 'approved') {
                $stmt = $pdo->prepare(
                    'UPDATE projects SET status = ?, progress = 100, updated_at = ? WHERE id = ?'
                );
                $stmt->execute([$status, today(), $id]);
            } else {
                $stmt = $pdo->prepare(
                    'UPDATE projects SET status = ?, updated_at = ? WHERE id = ?'
                );
                $stmt->execute([$status, today(), $id]);
            }

            respond(true, findProject($pdo, $id));
        }

        case 'updateProject': {
            $id = (string) ($input['projectId'] ?? '');
            $current = findProject($pdo, $id);

            if (!$current) {
                fail('المشروع غير موجود: ' . $id);
            }

            $changes = $input['changes'] ?? [];
            $sets = [];
            $params = [];

            if (isset($changes['projectName']) || isset($changes['title'])) {
                $name = trim((string) ($changes['projectName'] ?? $changes['title']));
                if ($name === '') {
                    fail('اسم المشروع مطلوب');
                }
                $sets[] = 'project_name = ?';
                $params[] = $name;
            }

            if (array_key_exists('description', $changes)) {
                $sets[] = 'description = ?';
                $params[] = trim((string) $changes['description']);
            }

            if (array_key_exists('feedback', $changes)) {
                $sets[] = 'feedback = ?';
                $params[] = trim((string) $changes['feedback']);
            }

            if (array_key_exists('repoUrl', $changes)) {
                $sets[] = 'repo_url = ?';
                $params[] = cleanRepoUrl($changes['repoUrl']);
            }

            if (array_key_exists('image', $changes)) {
                $sets[] = 'image = ?';
                $params[] = cleanImage($changes['image']);
            }

            if (isset($changes['status'])) {
                $status = normalizeStatus((string) $changes['status']);
                if ($status === null) {
                    fail('حالة غير صالحة: ' . $changes['status']);
                }
                $sets[] = 'status = ?';
                $params[] = $status;

                if ($status === 'approved') {
                    $sets[] = 'progress = 100';
                }
            }

            if (isset($changes['track'])) {
                $track = normalizeTrack((string) $changes['track']);
                if ($track === null) {
                    fail('مسار غير صالح: ' . $changes['track']);
                }
                $sets[] = 'track = ?';
                $params[] = $track;
            }

            if (array_key_exists('progress', $changes)) {
                $sets[] = 'progress = ?';
                $params[] = clampPercent($changes['progress'], $current['progress']);
            }

            if (array_key_exists('platformId', $changes)) {
                $sets[] = 'platform_id = ?';
                $params[] = $changes['platformId'] ?: null;
            }

            if (array_key_exists('dueDate', $changes)) {
                $sets[] = 'due_date = ?';
                $params[] = $changes['dueDate'] ?: null;
            }

            if (array_key_exists('score', $changes)) {
                $sets[] = 'score = ?';
                $params[] = ($changes['score'] === null || $changes['score'] === '')
                    ? null
                    : clampPercent($changes['score'], null);
            }

            /* نقل المشروع إلى متدرب آخر */
            $newOwner = $changes['traineeId'] ?? null;

            if (!$newOwner && !empty($changes['traineeName'])) {
                $stmt = $pdo->prepare('SELECT id FROM trainees WHERE name = ?');
                $stmt->execute([$changes['traineeName']]);
                $newOwner = $stmt->fetchColumn() ?: null;
            }

            if ($newOwner) {
                if (!findTrainee($pdo, (string) $newOwner)) {
                    fail('المتدرب غير موجود: ' . $newOwner);
                }
                $sets[] = 'trainee_id = ?';
                $params[] = $newOwner;
            }

            $sets[] = 'updated_at = ?';
            $params[] = today();
            $params[] = $id;

            $pdo->prepare('UPDATE projects SET ' . implode(', ', $sets) . ' WHERE id = ?')
                ->execute($params);

            respond(true, findProject($pdo, $id));
        }

        case 'deleteProject': {
            $id = (string) ($input['projectId'] ?? '');
            $project = findProject($pdo, $id);

            if (!$project) {
                fail('المشروع غير موجود: ' . $id);
            }

            $pdo->prepare('DELETE FROM projects WHERE id = ?')->execute([$id]);
            respond(true, $project);
        }

        /* ---------------- الإحصائيات ---------------- */

        case 'getStats': {
            $counts = $pdo->query(
                "SELECT
                   COUNT(*) AS total,
                   SUM(status = 'approved')       AS approved,
                   SUM(status = 'under_review')   AS under_review,
                   SUM(status = 'needs_revision') AS needs_revision,
                   COALESCE(ROUND(AVG(progress)), 0) AS avg_progress
                 FROM projects"
            )->fetch();

            $trainees = $pdo->query(
                'SELECT COUNT(*) AS total, SUM(certified) AS certified FROM trainees'
            )->fetch();

            respond(true, [
                'total'         => (int) $counts['total'],
                'approved'      => (int) $counts['approved'],
                'underReview'   => (int) $counts['under_review'],
                'needsRevision' => (int) $counts['needs_revision'],

                /* مرادفات تستخدمها الواجهة الحالية */
                'projects'      => (int) $counts['total'],
                'review'        => (int) $counts['under_review'],
                'rework'        => (int) $counts['needs_revision'],

                'trainees'      => (int) $trainees['total'],
                'certified'     => (int) $trainees['certified'],
                'avgProgress'   => (int) $counts['avg_progress'],
            ]);
        }

        /* ---------------- المتدربون ---------------- */

        case 'getTrainees': {
            /* ترتيب رقمي لا نصّي، وإلا سبق t_10 المتدربَ t_2 */
            $rows = $pdo->query(
                'SELECT t.*, c.name AS cohort_name
                 FROM trainees t
                 LEFT JOIN cohorts c ON c.id = t.cohort_id
                 ORDER BY CAST(SUBSTRING(t.id, 3) AS UNSIGNED)'
            )->fetchAll();
            $platforms = platformIndex($pdo);

            respond(true, array_map(function ($row) use ($platforms) {
                return mapTrainee($row, $platforms);
            }, $rows));
        }

        case 'getTraineeById':
            respond(true, findTrainee($pdo, (string) ($_GET['id'] ?? '')));

        case 'addTrainee': {
            $name = trim((string) ($input['name'] ?? ''));
            if ($name === '') {
                fail('اسم المتدرب مطلوب');
            }

            $stmt = $pdo->prepare('SELECT COUNT(*) FROM trainees WHERE name = ?');
            $stmt->execute([$name]);
            if ((int) $stmt->fetchColumn() > 0) {
                fail('يوجد متدرب بهذا الاسم مسبقاً');
            }

            $track = isset($input['track'])
                ? normalizeTrack((string) $input['track'])
                : 'FrontEnd';

            if ($track === null) {
                fail('مسار غير صالح: ' . ($input['track'] ?? ''));
            }

            $skills = $input['skills'] ?? null;

            if (!is_array($skills) || $skills === []) {
                /* مهارات المسار المختار لا مجموعة ثابتة للجميع */
                $skills = defaultSkillsFor($pdo, $track);
            } else {
                foreach ($skills as $key => $value) {
                    $skills[$key] = clampPercent($value, 0);
                }
            }

            $id = nextId($pdo, 'trainees', 't_');

            /* الدفعة هي مصدر اسم المعسكر حين تُختار، لأنها الكيان الأصل */
            $cohortId   = ($input['cohortId'] ?? null) ?: null;
            $cohortName = cohortNameOf($pdo, $cohortId);

            if ($cohortId && $cohortName === '') {
                fail('دفعة غير موجودة: ' . $cohortId);
            }

            $stmt = $pdo->prepare(
                'INSERT INTO trainees
                 (id, name, track, track_label, bootcamp, cohort_id, platform_id, avatar, joined_at, certified, skills, badges)
                 VALUES (?,?,?,?,?,?,?,?,?,0,?,?)'
            );

            $stmt->execute([
                $id,
                $name,
                $track,
                trim((string) ($input['trackLabel'] ?? '')) ?: trackLabelOf($pdo, $track),
                /* المعسكر: اسم الدفعة، وإلا المُدخل، وإلا الافتراضي من الإعدادات */
                $cohortName ?: (trim((string) ($input['bootcamp'] ?? '')) ?: (allSettings($pdo)['default_bootcamp'] ?? '')),
                $cohortId,
                /*
                   الجهة: المُدخلة، وإلا أول جهة مسجّلة.
                   تركها فارغة يُنتج متدرباً لا يظهر في أي فلتر جهة
                   وتعود شهادته إلى اسم المنصة العام.
                */
                ($input['platformId'] ?? null) ?: defaultPlatformId($pdo),
                $input['avatar'] ?? ('https://ui-avatars.com/api/?background=4f46e5&color=fff&bold=true&name=' . rawurlencode($name)),
                today(),
                json_encode($skills, JSON_UNESCAPED_UNICODE),
                '[]',
            ]);

            respond(true, findTrainee($pdo, $id));
        }

        case 'updateTrainee': {
            $id = (string) ($input['traineeId'] ?? '');
            $current = findTrainee($pdo, $id);

            if (!$current) {
                fail('المتدرب غير موجود: ' . $id);
            }

            $changes = $input['changes'] ?? [];
            $sets = [];
            $params = [];

            if (isset($changes['name'])) {
                $name = trim((string) $changes['name']);
                if ($name === '') {
                    fail('اسم المتدرب مطلوب');
                }

                $stmt = $pdo->prepare('SELECT COUNT(*) FROM trainees WHERE name = ? AND id <> ?');
                $stmt->execute([$name, $id]);
                if ((int) $stmt->fetchColumn() > 0) {
                    fail('يوجد متدرب بهذا الاسم مسبقاً');
                }

                $sets[] = 'name = ?';
                $params[] = $name;
            }

            $track = $current['track'];

            if (isset($changes['track'])) {
                $track = normalizeTrack((string) $changes['track']);
                if ($track === null) {
                    fail('مسار غير صالح: ' . $changes['track']);
                }
                $sets[] = 'track = ?';
                $params[] = $track;
            }

            if (array_key_exists('trackLabel', $changes)) {
                $sets[] = 'track_label = ?';
                $params[] = trim((string) $changes['trackLabel']) ?: trackLabelOf($pdo, $track);
            }

            if (isset($changes['skills']) && is_array($changes['skills'])) {
                $skills = [];
                foreach ($changes['skills'] as $key => $value) {
                    $skills[$key] = clampPercent($value, 0);
                }
                $sets[] = 'skills = ?';
                $params[] = json_encode($skills, JSON_UNESCAPED_UNICODE);
            }

            if (array_key_exists('bootcamp', $changes)) {
                $sets[] = 'bootcamp = ?';
                $params[] = trim((string) $changes['bootcamp']);
            }

            if (array_key_exists('platformId', $changes)) {
                $sets[] = 'platform_id = ?';
                $params[] = $changes['platformId'] ?: null;
            }

            if (array_key_exists('cohortId', $changes)) {
                $cohortId = $changes['cohortId'] ?: null;
                $cohortName = cohortNameOf($pdo, $cohortId);

                if ($cohortId && $cohortName === '') {
                    fail('دفعة غير موجودة: ' . $cohortId);
                }

                $sets[] = 'cohort_id = ?';
                $params[] = $cohortId;

                /* اسم المعسكر يتبع الدفعة، ما لم يُرسَل صراحةً في الطلب نفسه */
                if ($cohortName !== '' && !array_key_exists('bootcamp', $changes)) {
                    $sets[] = 'bootcamp = ?';
                    $params[] = $cohortName;
                }
            }

            if (isset($changes['avatar'])) {
                $sets[] = 'avatar = ?';
                $params[] = $changes['avatar'];
            }

            if ($sets === []) {
                respond(true, $current);
            }

            $params[] = $id;

            $pdo->prepare('UPDATE trainees SET ' . implode(', ', $sets) . ' WHERE id = ?')
                ->execute($params);

            respond(true, findTrainee($pdo, $id));
        }

        case 'deleteTrainee': {
            $id = (string) ($input['traineeId'] ?? '');
            $trainee = findTrainee($pdo, $id);

            if (!$trainee) {
                fail('المتدرب غير موجود: ' . $id);
            }

            /* المشاريع تُقرأ قبل الحذف لأن ON DELETE CASCADE سيزيلها */
            $removed = selectProjects($pdo, 'p.trainee_id = ?', [$id]);

            $pdo->prepare('DELETE FROM trainees WHERE id = ?')->execute([$id]);

            respond(true, ['trainee' => $trainee, 'removedProjects' => $removed]);
        }

        case 'certifyTrainee': {
            $id = (string) ($input['traineeId'] ?? '');

            if (!findTrainee($pdo, $id)) {
                fail('المتدرب غير موجود: ' . $id);
            }

            $serial = 'TBM-' . date('Y') . '-' . strtoupper($id);

            $stmt = $pdo->prepare(
                'UPDATE trainees SET certified = 1, certified_at = ?, certificate_serial = ? WHERE id = ?'
            );
            $stmt->execute([today(), $serial, $id]);

            respond(true, findTrainee($pdo, $id));
        }

        /* ---------------- الشارات ---------------- */

        case 'updateTraineeBadges': {
            $id = (string) ($input['traineeId'] ?? '');

            if (!findTrainee($pdo, $id)) {
                fail('المتدرب غير موجود: ' . $id);
            }

            $list = $input['badges'] ?? [];
            $clean = [];
            $seen = [];

            foreach ((array) $list as $badge) {
                if (!is_array($badge) || empty($badge['id']) || isset($seen[$badge['id']])) {
                    continue;
                }

                $seen[$badge['id']] = true;

                $clean[] = [
                    'id'       => $badge['id'],
                    'title'    => $badge['title'] ?? '',
                    'icon'     => $badge['icon'] ?? 'fa-medal',
                    'earnedAt' => $badge['earnedAt'] ?? today(),
                ];
            }

            $stmt = $pdo->prepare('UPDATE trainees SET badges = ? WHERE id = ?');
            $stmt->execute([json_encode($clean, JSON_UNESCAPED_UNICODE), $id]);

            respond(true, findTrainee($pdo, $id));
        }

        /* ---------------- أدوات ---------------- */

        case 'resetData': {
            $sql = file_get_contents(__DIR__ . '/../sql/schema.sql');

            if ($sql === false) {
                fail('تعذّر قراءة ملف المخطط', 500);
            }

            $pdo->exec($sql);
            respond(true, true);
        }

        /* ---------------- المسارات التدريبية ---------------- */

        case 'getTracks':
            $skills = trackSkillsIndex($pdo);

            respond(true, array_values(array_map(function ($row) use ($skills) {
                return mapTrack($row, $skills);
            }, trackIndex($pdo))));

        case 'addTrack': {
            $label = trim((string) ($input['label'] ?? ''));
            if ($label === '') {
                fail('اسم المسار مطلوب');
            }

            /* المعرّف: مُدخل أو مُشتق من الاسم */
            $id = trim((string) ($input['id'] ?? ''));

            if ($id === '') {
                $id = 'track_' . (count(trackIndex($pdo)) + 1);
            }

            /* حروف وأرقام وشرطة سفلية فقط — المعرّف يدخل في الكود والروابط */
            if (!preg_match('/^[A-Za-z0-9_]+$/', $id)) {
                fail('معرّف المسار يقبل الحروف الإنجليزية والأرقام والشرطة السفلية فقط');
            }

            $stmt = $pdo->prepare('SELECT COUNT(*) FROM tracks WHERE id = ? OR label = ?');
            $stmt->execute([$id, $label]);
            if ((int) $stmt->fetchColumn() > 0) {
                fail('يوجد مسار بهذا الاسم أو المعرّف مسبقاً');
            }

            $nextSort = (int) $pdo->query('SELECT COALESCE(MAX(sort), 0) + 1 FROM tracks')
                                  ->fetchColumn();

            $stmt = $pdo->prepare(
                'INSERT INTO tracks (id, label, color, sort, active) VALUES (?,?,?,?,1)'
            );

            $stmt->execute([
                $id,
                $label,
                trim((string) ($input['color'] ?? '')) ?: '#4f46e5',
                $nextSort,
            ]);

            /* مهارات المسار: المُرسلة، وإلا مجموعة عامة — لا مسار بلا مهارات */
            $skills = setTrackSkills(
                $pdo,
                $id,
                is_array($input['skills'] ?? null) ? $input['skills'] : []
            );

            $stmt = $pdo->prepare('SELECT * FROM tracks WHERE id = ?');
            $stmt->execute([$id]);

            /* mapTrack يتوقع فهرساً مفتاحه معرّف المسار لا قائمة مسطّحة */
            respond(true, mapTrack($stmt->fetch(), [$id => $skills]));
        }

        case 'setTrackSkills': {
            $trackId = (string) ($input['trackId'] ?? '');

            $stmt = $pdo->prepare('SELECT * FROM tracks WHERE id = ?');
            $stmt->execute([$trackId]);
            $row = $stmt->fetch();

            if (!$row) {
                fail('المسار غير موجود: ' . $trackId);
            }

            $skills = setTrackSkills(
                $pdo,
                $trackId,
                is_array($input['skills'] ?? null) ? $input['skills'] : []
            );

            respond(true, mapTrack($row, [$trackId => $skills]));
        }

        case 'deleteTrack': {
            $id = (string) ($input['trackId'] ?? '');

            $stmt = $pdo->prepare('SELECT * FROM tracks WHERE id = ?');
            $stmt->execute([$id]);
            $row = $stmt->fetch();

            if (!$row) {
                fail('المسار غير موجود: ' . $id);
            }

            /* لا يُحذف مسار يتبعه متدربون أو مشاريع */
            $stmt = $pdo->prepare(
                'SELECT
                   (SELECT COUNT(*) FROM trainees WHERE track = ?) AS t,
                   (SELECT COUNT(*) FROM projects WHERE track = ?) AS p'
            );
            $stmt->execute([$id, $id]);
            $used = $stmt->fetch();

            if ((int) $used['t'] > 0 || (int) $used['p'] > 0) {
                fail(
                    'لا يمكن حذف المسار: يتبعه ' . (int) $used['t'] .
                    ' متدرب و' . (int) $used['p'] . ' مشروع'
                );
            }

            $pdo->prepare('DELETE FROM tracks WHERE id = ?')->execute([$id]);
            respond(true, mapTrack($row));
        }

        /* ---------------- الجهات التدريبية ---------------- */

        case 'getPlatforms': {
            /* ترتيب رقمي: الترتيب النصّي يجعل pf_10 يسبق pf_2 */
            $rows = $pdo->query(
                'SELECT * FROM platforms ORDER BY CAST(SUBSTRING(id, 4) AS UNSIGNED)'
            )->fetchAll();

            respond(true, array_map('mapPlatform', $rows));
        }

        case 'addPlatform': {
            $name = trim((string) ($input['name'] ?? ''));
            if ($name === '') {
                fail('اسم الجهة مطلوب');
            }

            $stmt = $pdo->prepare('SELECT COUNT(*) FROM platforms WHERE name = ?');
            $stmt->execute([$name]);
            if ((int) $stmt->fetchColumn() > 0) {
                fail('توجد جهة بهذا الاسم مسبقاً');
            }

            $id = nextId($pdo, 'platforms', 'pf_');

            $stmt = $pdo->prepare(
                'INSERT INTO platforms (id, name, short_name, color, active)
                 VALUES (?,?,?,?,1)'
            );

            $stmt->execute([
                $id,
                $name,
                trim((string) ($input['shortName'] ?? '')) ?: $name,
                trim((string) ($input['color'] ?? '')) ?: '#4f46e5',
            ]);

            $stmt = $pdo->prepare('SELECT * FROM platforms WHERE id = ?');
            $stmt->execute([$id]);

            respond(true, mapPlatform($stmt->fetch()));
        }

        case 'deletePlatform': {
            $id = (string) ($input['platformId'] ?? '');

            $stmt = $pdo->prepare('SELECT * FROM platforms WHERE id = ?');
            $stmt->execute([$id]);
            $row = $stmt->fetch();

            if (!$row) {
                fail('الجهة غير موجودة: ' . $id);
            }

            /* لا تُحذف جهة مرتبط بها متدربون — وإلا تيتّمت سجلاتهم */
            $stmt = $pdo->prepare('SELECT COUNT(*) FROM trainees WHERE platform_id = ?');
            $stmt->execute([$id]);
            $count = (int) $stmt->fetchColumn();

            if ($count > 0) {
                fail('لا يمكن حذف الجهة: يتبعها ' . $count . ' متدرب');
            }

            $pdo->prepare('DELETE FROM platforms WHERE id = ?')->execute([$id]);
            respond(true, mapPlatform($row));
        }

        case 'getCohorts': {
            $rows = $pdo->query(
                'SELECT c.*, p.name AS platform_name,
                        (SELECT COUNT(*) FROM trainees t WHERE t.cohort_id = c.id) AS trainee_count
                 FROM cohorts c
                 LEFT JOIN platforms p ON p.id = c.platform_id
                 ORDER BY CAST(SUBSTRING(c.id, 3) AS UNSIGNED)'
            )->fetchAll();

            respond(true, array_map('mapCohort', $rows));
        }

        case 'addCohort': {
            $name = trim((string) ($input['name'] ?? ''));
            if ($name === '') {
                fail('اسم الدفعة مطلوب');
            }

            $stmt = $pdo->prepare('SELECT COUNT(*) FROM cohorts WHERE name = ?');
            $stmt->execute([$name]);
            if ((int) $stmt->fetchColumn() > 0) {
                fail('توجد دفعة بهذا الاسم مسبقاً');
            }

            $starts = ($input['startsAt'] ?? null) ?: null;
            $ends   = ($input['endsAt'] ?? null) ?: null;

            if ($starts && $ends && $ends < $starts) {
                fail('تاريخ النهاية يسبق تاريخ البداية');
            }

            $id = nextId($pdo, 'cohorts', 'c_');

            $stmt = $pdo->prepare(
                'INSERT INTO cohorts (id, name, platform_id, starts_at, ends_at, active)
                 VALUES (?,?,?,?,?,1)'
            );

            $stmt->execute([
                $id,
                $name,
                ($input['platformId'] ?? null) ?: null,
                $starts,
                $ends,
            ]);

            $stmt = $pdo->prepare(
                'SELECT c.*, p.name AS platform_name, 0 AS trainee_count
                 FROM cohorts c LEFT JOIN platforms p ON p.id = c.platform_id
                 WHERE c.id = ?'
            );
            $stmt->execute([$id]);

            respond(true, mapCohort($stmt->fetch()));
        }

        case 'deleteCohort': {
            $id = (string) ($input['cohortId'] ?? '');

            $stmt = $pdo->prepare('SELECT * FROM cohorts WHERE id = ?');
            $stmt->execute([$id]);
            $row = $stmt->fetch();

            if (!$row) {
                fail('الدفعة غير موجودة: ' . $id);
            }

            /* كما في الجهات: لا تُحذف دفعة يتبعها متدربون */
            $stmt = $pdo->prepare('SELECT COUNT(*) FROM trainees WHERE cohort_id = ?');
            $stmt->execute([$id]);
            $count = (int) $stmt->fetchColumn();

            if ($count > 0) {
                fail('لا يمكن حذف الدفعة: يتبعها ' . $count . ' متدرب');
            }

            $pdo->prepare('DELETE FROM cohorts WHERE id = ?')->execute([$id]);
            respond(true, mapCohort($row));
        }

        case 'getSettings':
            respond(true, allSettings($pdo));

        case 'updateSettings': {
            $changes = $input['settings'] ?? [];

            if (!is_array($changes) || $changes === []) {
                fail('لا توجد إعدادات للحفظ');
            }

            /* الإدراج أو التحديث في عملية واحدة */
            $stmt = $pdo->prepare(
                'INSERT INTO settings (`key`, `value`) VALUES (?, ?)
                 ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)'
            );

            foreach ($changes as $key => $value) {
                $stmt->execute([(string) $key, trim((string) $value)]);
            }

            respond(true, allSettings($pdo));
        }

        case 'ping':
            respond(true, ['status' => 'ok', 'time' => date('c')]);

        default:
            fail('إجراء غير معروف: ' . $action, 404);
    }
} catch (Throwable $e) {
    respond(false, $e->getMessage(), 500);
}
