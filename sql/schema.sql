-- ===================================================================
--  منصة إدارة معسكرات البرمجة — مخطط قاعدة البيانات
--  التشغيل:  mysql -u root < sql/schema.sql
--  أو استيراده من phpMyAdmin
-- ===================================================================

CREATE DATABASE IF NOT EXISTS bootcamp_manager
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE bootcamp_manager;

-- ملاحظة مهمة:
-- هذا الملف آمن للتشغيل على قاعدة فيها بيانات — لا يحذف شيئاً.
-- كان يبدأ بأوامر DROP TABLE، فكان تشغيله بالخطأ يمحو المتدربين والمشاريع
-- ويستبدلهم بالبيانات الافتراضية. أُزيلت الأوامر لهذا السبب.
-- لتفريغ البيانات عمداً، استخدم زر "إعادة تعيين البيانات" داخل المنصة.
--
-- تنبيه: الملف يحتوي USE bootcamp_manager، فهو يتجاهل أي قاعدة تختارها
-- من سطر الأوامر ويعمل دائماً على bootcamp_manager.

-- ------------------------------------------------------------------
--  المتدربون
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trainees (
  id                  VARCHAR(20)  NOT NULL PRIMARY KEY,
  name                VARCHAR(60)  NOT NULL,
  track               VARCHAR(20)  NOT NULL DEFAULT 'FrontEnd',
  track_label         VARCHAR(80)  NOT NULL DEFAULT '',
  bootcamp            VARCHAR(80)  NOT NULL DEFAULT '',   -- اسم المعسكر، يظهر في الشهادة
  cohort_id           VARCHAR(20)  NULL,                   -- الدفعة (القيد يُضاف بعد جدول الدفعات)
  platform_id         VARCHAR(20)  NULL,                   -- الجهة التدريبية
  avatar              TEXT         NULL,
  joined_at           DATE         NULL,
  certified           TINYINT(1)   NOT NULL DEFAULT 0,
  certified_at        DATE         NULL,
  certificate_serial  VARCHAR(50)  NULL,

  -- المهارات والشارات تُخزَّن كـ JSON: بنيتهما مرنة ولا تُستعلم بالحقول
  skills              LONGTEXT     NULL CHECK (JSON_VALID(skills)),
  badges              LONGTEXT     NULL CHECK (JSON_VALID(badges)),

  -- الاسم مفتاح عرض لا مفتاح ربط، لكنه يبقى فريداً لوضوح الواجهة
  UNIQUE KEY uq_trainee_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------
--  المشاريع
--  الربط بالمعرّف لا بالاسم — أمتن عند تغيير اسم المتدرب
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
  id            VARCHAR(20)  NOT NULL PRIMARY KEY,
  project_name  VARCHAR(120) NOT NULL,
  trainee_id    VARCHAR(20)  NOT NULL,
  status        ENUM('approved', 'under_review', 'needs_revision')
                             NOT NULL DEFAULT 'under_review',
  track         VARCHAR(20)  NOT NULL DEFAULT 'FrontEnd',
  platform_id   VARCHAR(20)  NULL,
  progress      TINYINT UNSIGNED NOT NULL DEFAULT 0,
  due_date      DATE         NULL,
  description   TEXT         NULL,
  score         TINYINT UNSIGNED NULL,
  created_at    DATE         NULL,
  updated_at    DATE         NULL,

  CONSTRAINT fk_project_trainee
    FOREIGN KEY (trainee_id) REFERENCES trainees(id)
    ON DELETE CASCADE          -- حذف المتدرب يحذف مشاريعه
    ON UPDATE CASCADE,

  INDEX idx_status (status),
  INDEX idx_track (track),
  INDEX idx_trainee (trainee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------
--  المسارات التدريبية
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tracks (
  id     VARCHAR(30)  NOT NULL PRIMARY KEY,
  label  VARCHAR(80)  NOT NULL,
  color  VARCHAR(20)  NOT NULL DEFAULT '#4f46e5',
  sort   INT          NOT NULL DEFAULT 0,
  active TINYINT(1)   NOT NULL DEFAULT 1,
  UNIQUE KEY uq_track_label (label)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO tracks (id, label, color, sort) VALUES
  ('FrontEnd',      'واجهات أمامية',         '#0ea5e9', 1),
  ('Backend',       'تطوير الواجهات الخلفية', '#16a34a', 2),
  ('FullStack',     'تطوير متكامل',           '#4f46e5', 3),
  ('UI_UX',         'تصميم تجربة المستخدم',   '#8b5cf6', 4),
  ('Mobile',        'تطبيقات الجوال',         '#f59e0b', 5),
  ('DataScience',   'علم البيانات',           '#0891b2', 6),
  ('AI',            'الذكاء الاصطناعي',       '#e11d48', 7),
  ('Cybersecurity', 'الأمن السيبراني',        '#334155', 8);

-- ------------------------------------------------------------------
--  الجهات التدريبية (طويق، سدايا، كاوست...)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS platforms (
  id         VARCHAR(20)  NOT NULL PRIMARY KEY,
  name       VARCHAR(80)  NOT NULL,
  short_name VARCHAR(40)  NOT NULL DEFAULT '',
  color      VARCHAR(20)  NOT NULL DEFAULT '#4f46e5',
  active     TINYINT(1)   NOT NULL DEFAULT 1,
  UNIQUE KEY uq_platform_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO platforms (id, name, short_name, color) VALUES
  ('pf_1',  'منصة هاش بلس',              'هاش بلس',          '#4f46e5'),
  ('pf_2',  'أكاديمية طويق',             'طويق',             '#0ea5e9'),
  ('pf_5',  'مسك للمهارات',              'مسك',              '#16a34a'),
  ('pf_6',  'الأكاديمية السعودية الرقمية', 'السعودية الرقمية', '#0891b2'),
  ('pf_8',  'منصة نمكن',                 'نمكن',             '#8b5cf6'),
  ('pf_9',  'أكاديمية سدايا',            'سدايا',            '#7c3aed'),
  ('pf_10', 'أكاديمية كاوست',            'كاوست',            '#e11d48'),
  ('pf_11', 'منصة كراديس',               'كراديس',           '#f59e0b');

-- ------------------------------------------------------------------
--  الدفعات التدريبية (تُنشأ بعد الجهات لأنها تشير إليها)
-- ------------------------------------------------------------------
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO cohorts (id, name, platform_id) VALUES
  ('c_1', 'معسكر التقنية المتقدمة',              'pf_1'),
  ('c_2', 'معسكر تحليل البيانات',                'pf_1'),
  ('c_3', 'معسكر تصميم الواجهات — الدفعة الثالثة', 'pf_1');

-- جدول المتدربين يسبق جدول الدفعات، فيُضاف قيد المفتاح الأجنبي هنا
-- IF NOT EXISTS ليبقى الملف قابلاً لإعادة التشغيل دون خطأ
ALTER TABLE trainees
  ADD FOREIGN KEY IF NOT EXISTS fk_trainee_cohort (cohort_id)
  REFERENCES cohorts(id) ON DELETE SET NULL;

-- ------------------------------------------------------------------
--  الإعدادات العامة (اسم المنصة وغيره)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
  `key`   VARCHAR(50) NOT NULL PRIMARY KEY,
  `value` TEXT        NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO settings (`key`, `value`) VALUES
  ('platform_name',    'منصة إدارة معسكرات البرمجة'),
  ('default_bootcamp', 'معسكر التقنية المتقدمة');

-- ------------------------------------------------------------------
--  البيانات الافتراضية
-- ------------------------------------------------------------------
INSERT IGNORE INTO trainees
  (id, name, track, track_label, bootcamp, cohort_id, platform_id, avatar, joined_at, certified, skills, badges)
VALUES
  ('t_1', 'سارة أحمد', 'UI_UX', 'تصميم تجربة المستخدم', 'معسكر التقنية المتقدمة', 'c_1', 'pf_1',
   'https://ui-avatars.com/api/?background=4f46e5&color=fff&bold=true&name=%D8%B3%D8%A7%D8%B1%D8%A9',
   '2026-01-15', 0,
   '{"HTML":90,"CSS":95,"JavaScript":75,"UI/UX":98,"PHP":60}', '[]'),

  ('t_2', 'ربى الغامدي', 'FrontEnd', 'واجهات أمامية', 'معسكر التقنية المتقدمة', 'c_1', 'pf_2',
   'https://ui-avatars.com/api/?background=4f46e5&color=fff&bold=true&name=%D8%B1%D8%A8%D9%89',
   '2026-01-15', 0,
   '{"HTML":95,"CSS":90,"JavaScript":85,"UI/UX":95,"PHP":80}', '[]'),

  ('t_3', 'فهد الدوسري', 'FullStack', 'تطوير متكامل', 'معسكر التقنية المتقدمة', 'c_1', 'pf_1',
   'https://ui-avatars.com/api/?background=4f46e5&color=fff&bold=true&name=%D9%81%D9%87%D8%AF',
   '2026-02-01', 0,
   '{"HTML":80,"CSS":75,"JavaScript":90,"UI/UX":65,"PHP":92}', '[]');

INSERT IGNORE INTO projects
  (id, project_name, trainee_id, status, track, platform_id, progress, due_date, description, score, created_at, updated_at)
VALUES
  ('p_1', 'منصة هاش بلس', 't_1', 'approved', 'UI_UX', 'pf_1', 100, '2026-10-15',
   'تطوير واجهات المستخدم', 96, '2026-07-02', '2026-09-20'),

  ('p_2', 'تطبيق سند', 't_2', 'under_review', 'FrontEnd', 'pf_2', 65, '2026-11-02',
   'تطبيق لربط المستفيدين بالجهات الخيرية وتنظيم الطلبات.', NULL, '2026-08-18', '2026-09-10'),

  ('p_3', 'مساعد نبراس الذكي', 't_2', 'approved', 'FrontEnd', 'pf_2', 100, '2026-09-30',
   'مساعد يقدّم توصيات تعليمية مخصّصة لكل متدرب.', 93, '2026-06-05', '2026-08-15'),

  ('p_4', 'بوابة الدفع الموحّدة', 't_3', 'needs_revision', 'FullStack', 'pf_1', 40, '2026-11-20',
   'واجهة برمجية موحّدة لمعالجة المدفوعات وتقاريرها.', NULL, '2026-08-20', '2026-09-22'),

  ('p_5', 'لوحة تحليلات المعسكر', 't_3', 'under_review', 'FullStack', 'pf_1', 80, '2026-12-01',
   'لوحة مؤشرات لمتابعة أداء المتدربين والمشاريع.', NULL, '2026-09-01', '2026-09-05');
