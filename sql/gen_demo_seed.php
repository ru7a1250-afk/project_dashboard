<?php
/**
 * يولّد js/demo-seed.js من قاعدة البيانات الحيّة،
 * حتى تطابق بيانات العرض التجريبي الأصل تماماً.
 */

declare(strict_types=1);

$base = 'http://localhost/project_dashboard/api/api.php?action=';

function fetchData(string $url): array
{
    $raw = file_get_contents($url);
    if ($raw === false) {
        throw new RuntimeException("تعذّر الجلب: $url");
    }

    $d = json_decode($raw, true);
    if (!is_array($d) || empty($d['ok'])) {
        throw new RuntimeException("استجابة غير صالحة: $url");
    }

    return $d['data'];
}

$trainees  = fetchData($base . 'getTrainees');
$projects  = fetchData($base . 'getProjects');
$tracks    = fetchData($base . 'getTracks');
$platforms = fetchData($base . 'getPlatforms');
$cohorts   = fetchData($base . 'getCohorts');
$settings  = fetchData($base . 'getSettings');

/* أعلى رقم تسلسلي لكل نوع، حتى لا تتصادم المعرّفات الجديدة */
function maxSeq(array $rows, string $prefix): int
{
    $max = 0;

    foreach ($rows as $r) {
        $n = (int) str_replace($prefix, '', $r['id']);
        if ($n > $max) $max = $n;
    }

    return $max;
}

$seed = [
    'platforms' => array_map(static fn($p) => [
        'id'        => $p['id'],
        'name'      => $p['name'],
        'shortName' => $p['shortName'],
        'color'     => $p['color'],
        'active'    => (bool) $p['active'],
    ], $platforms),

    'cohorts' => array_map(static fn($c) => [
        'id'         => $c['id'],
        'name'       => $c['name'],
        'platformId' => $c['platformId'],
        'startsAt'   => $c['startsAt'],
        'endsAt'     => $c['endsAt'],
        'active'     => (bool) $c['active'],
    ], $cohorts),

    'tracks' => array_map(static fn($t) => [
        'id'     => $t['id'],
        'label'  => $t['label'],
        'color'  => $t['color'],
        'sort'   => (int) $t['sort'],
        'active' => (bool) $t['active'],
        'skills' => $t['skills'] ?? [],
    ], $tracks),

    'trainees' => array_map(static fn($t) => [
        'id'                => $t['id'],
        'name'              => $t['name'],
        'track'             => $t['track'],
        'trackLabel'        => $t['trackLabel'],
        'bootcamp'          => $t['bootcamp'],
        'cohortId'          => $t['cohortId'],
        'cohortName'        => $t['cohortName'],
        'platformId'        => $t['platformId'],
        'platformName'      => '',
        'platformShort'     => '',
        'platformColor'     => '',
        'avatar'            => $t['avatar'],
        'joinedAt'          => $t['joinedAt'],
        'certified'         => (bool) $t['certified'],
        'certifiedAt'       => $t['certifiedAt'],
        'certificateSerial' => $t['certificateSerial'],
        'skills'            => (object) ($t['skills'] ?: []),
        'badges'            => $t['badges'] ?: [],
    ], $trainees),

    'projects' => array_map(static fn($p) => [
        'id'            => $p['id'],
        'projectName'   => $p['projectName'],
        'title'         => $p['projectName'],
        'traineeId'     => $p['traineeId'],
        'traineeName'   => '',
        'status'        => $p['status'],
        'track'         => $p['track'],
        'trackLabel'    => '',
        'progress'      => (int) $p['progress'],
        'dueDate'       => $p['dueDate'],
        'description'   => $p['description'],
        'feedback'      => $p['feedback'] ?? '',
        'score'         => $p['score'],
        'createdAt'     => $p['createdAt'],
        'updatedAt'     => $p['updatedAt'],
        'platformId'    => $p['platformId'],
        'platformName'  => '',
        'platformShort' => '',
        'platformColor' => '',
    ], $projects),

    'settings' => (object) $settings,

    'seq' => [
        'trainee'  => maxSeq($trainees, 't_'),
        'project'  => maxSeq($projects, 'p_'),
        'track'    => count($tracks),
        'platform' => maxSeq($platforms, 'pf_'),
        'cohort'   => maxSeq($cohorts, 'c_'),
    ],
];

/*
   بصمة المحتوى: المتصفح يحفظ نسخته في LocalStorage، فلولا هذه البصمة
   لبقي الزائر السابق يرى بيانات قديمة بعد كل نشر جديد.
*/
$seed['version'] = substr(sha1(json_encode($seed, JSON_UNESCAPED_UNICODE)), 0, 12);

$json = json_encode($seed, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);

$header = <<<JS
/* ===================================================================
   demo-seed.js — بيانات العرض التجريبي

   مُولَّد آلياً من قاعدة البيانات، فهو يطابق محتوى المنصة الحقيقي.
   لا يُحرَّر يدوياً: أعد توليده بعد أي تغيير في البيانات.

   يُستخدم في index.html (نسخة GitHub Pages) فقط، ولا علاقة له
   بـ index.php التي تقرأ من MySQL.
   =================================================================== */

var DEMO_SEED =
JS;

$out = $header . ' ' . $json . ";\n";

file_put_contents('C:/xampp/htdocs/project_dashboard/js/demo-seed.js', $out);

/*
   ختم روابط الملفات المحلية في index.html.

   الختم بصمة محتوى كل ملف على حدة لا بصمة البيانات: تعديل ui.js
   دون تغيير البيانات يجب أن يغيّر رابط ui.js وحده، وإلا بقي
   المتصفح على النسخة القديمة من الكود.

   index.php تفعل المثل عبر asset() وfilemtime، أما الصفحة الثابتة
   فلا تشغّل PHP، فيُحسب الختم هنا عند التوليد.
*/
$root = 'C:/xampp/htdocs/project_dashboard/';
$page = $root . 'index.html';
$html = file_get_contents($page);

$stamped = preg_replace_callback(
    '/(?:src|href)="((?:css|js)\/[^"?]+)(?:\?v=[^"]*)?"/',
    static function (array $m) use ($root) {
        $attr = str_starts_with($m[0], 'src') ? 'src' : 'href';
        $file = $root . $m[1];

        $stamp = is_file($file)
            ? substr(sha1_file($file), 0, 12)
            : 'missing';

        return $attr . '="' . $m[1] . '?v=' . $stamp . '"';
    },
    $html
);

if ($stamped !== null && $stamped !== $html) {
    file_put_contents($page, $stamped);
    echo "index.html: أُعيد ختم الروابط\n";
} else {
    echo "index.html: لا تغيير في الروابط\n";
}

echo "trainees=", count($trainees),
     " projects=", count($projects),
     " tracks=", count($tracks),
     " platforms=", count($platforms),
     " cohorts=", count($cohorts), "\n";
echo "bytes=", strlen($out), "\n";
