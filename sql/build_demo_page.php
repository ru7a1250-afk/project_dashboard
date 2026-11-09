<?php
/**
 * يبني index.html (نسخة GitHub Pages) من مخرجات index.php الحقيقية.
 *
 * لماذا من المخرجات لا بنسخة يدوية: الصفحتان تبقيان متطابقتين، فأي
 * حقل يُضاف إلى index.php يظهر في العرض التجريبي بلا عمل إضافي.
 *
 * الفرق الوحيد: استبدال طبقة البيانات بنسخة LocalStorage.
 *
 * التشغيل:
 *   php sql/build_demo_page.php      ثم      php sql/gen_demo_seed.php
 */

declare(strict_types=1);

$src  = 'http://localhost/project_dashboard/index.php';
$dest = 'C:/xampp/htdocs/project_dashboard/index.html';

$html = @file_get_contents($src);

if ($html === false || trim($html) === '') {
    fwrite(STDERR, "تعذّر جلب index.php — تأكّد أن Apache يعمل\n");
    exit(1);
}

if (!mb_check_encoding($html, 'UTF-8')) {
    fwrite(STDERR, "المخرجات ليست UTF-8 سليمة — أُوقف البناء\n");
    exit(1);
}

/* أختام الإصدار تُعاد لاحقاً بـ gen_demo_seed.php حسب محتوى كل ملف */
$html = preg_replace('/\?v=\d+/', '', $html);

/* طبقة البيانات: الخادم ← التخزين المحلي */
$needle  = '<script src="js/dataService.js"></script>';
$replace = "<!-- GitHub Pages: طبقة بيانات محلية بدل الخادم -->\n"
         . "  <script src=\"js/demo-seed.js\"></script>\n"
         . "  <script src=\"js/dataService.demo.js\"></script>";

if (strpos($html, $needle) === false) {
    fwrite(STDERR, "لم يُعثر على وسم dataService.js — تغيّرت بنية الصفحة\n");
    exit(1);
}

$html = str_replace($needle, $replace, $html);

file_put_contents($dest, $html);

/* تحقّق بعدي: الملف مكتوب وسليم ويحوي ما يجب */
$check = file_get_contents($dest);

$checks = [
    'UTF-8 سليم'          => mb_check_encoding($check, 'UTF-8'),
    'العربية غير مشوَّهة'  => strpos($check, 'منصة إدارة معسكرات البرمجة') !== false,
    'طبقة العرض مربوطة'   => strpos($check, 'dataService.demo.js') !== false,
    'الخادم غير مستدعى'   => strpos($check, 'src="js/dataService.js"') === false,
];

foreach ($checks as $label => $pass) {
    echo ($pass ? '  ok   ' : '  FAIL '), $label, "\n";
}

echo in_array(false, $checks, true) ? "فشل البناء\n" : "index.html جاهز (" . strlen($check) . " بايت)\n";

exit(in_array(false, $checks, true) ? 1 : 0);
