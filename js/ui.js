/* ===================================================================
   ui.js — طبقة العرض (View)
   مسؤولة حصرياً عن التعامل مع الـ DOM. لا تقرأ من التخزين
   ولا تستدعي DataService — تستقبل البيانات جاهزة وتعرضها.
   =================================================================== */

var UI = (function () {
  "use strict";

  /*
     ثابت محلي عمداً: هذه الطبقة لا تستورد DataService حتى يبقى
     العرض مستقلاً عن مصدر البيانات. القيمة نفسها في المفردتين.
  */
  var APPROVED = "approved";
  var UNDER_REVIEW = "under_review";
  var NEEDS_REVISION = "needs_revision";

  /* ------------------------- 1. مراجع الـ DOM ------------------------- */

  var el = {
    traineeList:    document.getElementById("traineeList"),
    traineeEmpty:   document.getElementById("traineeEmptyState"),
    traineesCount:  document.getElementById("traineesCount"),

    statProjects:   document.getElementById("statProjects"),
    statApproved:   document.getElementById("statApproved"),
    statReview:     document.getElementById("statReview"),
    statRework:     document.getElementById("statRework"),
    statLate:       document.getElementById("statLate"),
    statCertified:  document.getElementById("statCertified"),

    columns: {
      under_review:   document.getElementById("col-review"),
      approved: document.getElementById("col-approved"),
      needs_revision:   document.getElementById("col-rework")
    },

    counts: {
      under_review:   document.getElementById("countReview"),
      approved: document.getElementById("countApproved"),
      needs_revision:   document.getElementById("countRework")
    },

    skillsModal:    document.getElementById("skillsModal"),
    skillsAvatar:   document.getElementById("skillsAvatar"),
    skillsName:     document.getElementById("skillsTraineeName"),
    skillsTrack:    document.getElementById("skillsTraineeTrack"),
    skillsLegend:   document.getElementById("skillsLegend"),
    skillsCanvas:   document.getElementById("skillsRadar"),

    certModal:      document.getElementById("certificateModal"),
    certName:       document.getElementById("certTraineeName"),
    certTrack:      document.getElementById("certTrack"),
    certScore:      document.getElementById("certScore"),
    certDate:       document.getElementById("certDate"),
    certSerial:     document.getElementById("certSerial"),
    certPlatform:   document.getElementById("certPlatform"),
    certBootcamp:   document.getElementById("certBootcamp"),

    /* --- قائمة الصدارة --- */
    podium:           document.getElementById("podium"),
    rankList:         document.getElementById("rankList"),
    leaderboardEmpty: document.getElementById("leaderboardEmpty"),

    /* --- المُقيّم الذكي --- */
    aiProjectTitle: document.getElementById("aiProjectTitle"),
    aiProjectOwner: document.getElementById("aiProjectOwner"),
    aiThinking:     document.getElementById("aiThinking"),
    aiThinkingText: document.getElementById("aiThinkingText"),
    aiProgressBar:  document.getElementById("aiProgressBar"),
    aiResult:       document.getElementById("aiResult"),
    aiScoreRing:    document.getElementById("aiScoreRing"),
    aiScoreValue:   document.getElementById("aiScoreValue"),
    aiVerdict:      document.getElementById("aiVerdict"),
    aiCriteria:     document.getElementById("aiCriteria"),
    aiNotes:        document.getElementById("aiNotes"),

    /* --- خريطة المسار --- */
    journeyAvatar:        document.getElementById("journeyAvatar"),
    journeyName:          document.getElementById("journeyTraineeName"),
    journeyTrack:         document.getElementById("journeyTraineeTrack"),
    journeyMap:           document.getElementById("journeyMap"),
    journeyProgressBar:   document.getElementById("journeyProgressBar"),
    journeyProgressLabel: document.getElementById("journeyProgressLabel"),

    /* --- نماذج الإضافة --- */
    addTraineeForm: document.getElementById("addTraineeForm"),
    addProjectForm: document.getElementById("addProjectForm"),
    projectTraineeSelect: document.getElementById("projectTrainee"),
    settingsForm:   document.getElementById("settingsForm"),
    projectPlatformSelect: document.getElementById("projectPlatform"),
    traineePlatformSelect: document.getElementById("traineePlatform"),
    platformFilter: document.getElementById("filterPlatform"),

    themeIcon:      document.getElementById("themeIcon"),
    toastContainer: document.getElementById("toastContainer"),
    badgeContainer: document.getElementById("badgeToastContainer")
  };

  /* نظام النقاط — مرجع واحد لحساب الترتيب */
  var POINTS = {
    approved:       50,  /* مشروع مُجاز */
    under_review:   10,  /* مشروع قيد التقييم */
    needs_revision: 5,   /* مشروع يحتاج تعديل */
    scoreBonus: 0.5,/* نصف نقطة لكل درجة تقييم */
    certified: 25   /* مكافأة الحصول على الشهادة */
  };

  var STATUS_LABELS = {
    under_review:   "تحت التقييم",
    approved: "مُجاز",
    needs_revision:   "يحتاج تعديل"
  };

  var STATUS_ICONS = {
    under_review:   "fa-hourglass-half",
    approved: "fa-circle-check",
    needs_revision:   "fa-pen-ruler"
  };

  var TRACK_LABELS = {
    UI_UX:     "تصميم تجربة المستخدم",
    FullStack: "تطوير متكامل",
    FrontEnd:  "واجهات أمامية",
    /* مرادفات قديمة تبقى مفهومة */
    web:       "تطوير الويب",
    mobile:    "تطبيقات الجوال",
    data:      "علم البيانات"
  };

  /* مرجع المخطط الحالي — يُدمَّر قبل أي رسم جديد */
  var radarChart = null;

  /*
     ذاكرة داخلية لآخر ما جرى عرضه.
     تتيح استدعاء renderProjects(projects) و renderTrainees(trainees)
     بوسيط واحد: المتدربون يُجلبون من الذاكرة لربط الصور والأسماء،
     والمشاريع تُجلب منها لحساب شريط تقدّم كل متدرب.
  */
  var cache = { trainees: [], projects: [], tracks: [] };

  /* عتبات لون شريط التقدّم — تُترجم إلى فئات CSS جاهزة */
  var PROGRESS_LEVELS = [
    { max: 40,       cls: "is-low"  },   /* أقل من 40٪  → أحمر */
    { max: 80,       cls: "is-mid"  },   /* أقل من 80٪  → أصفر */
    { max: Infinity, cls: "is-high" }    /* 80٪ فأعلى   → أخضر */
  ];

  /**
   * فئة لون شريط التقدّم حسب النسبة.
   * @param {number} pct
   * @returns {string} is-low | is-mid | is-high
   */
  function progressLevel(pct) {
    var value = Number(pct) || 0;

    for (var i = 0; i < PROGRESS_LEVELS.length; i++) {
      if (value < PROGRESS_LEVELS[i].max) return PROGRESS_LEVELS[i].cls;
    }

    return "is-high";
  }

  /**
   * بناء شريط تقدّم ملوّن حسب النسبة.
   * @param {number} pct
   * @param {string} [label] - وصف للقارئات الشاشية
   * @returns {string} HTML
   */
  function progressBar(pct, label) {
    var value = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));

    return '<div class="progress" role="progressbar" aria-valuenow="' + value +
             '" aria-valuemin="0" aria-valuemax="100" aria-label="' +
             esc(label || "نسبة الإنجاز") + '">' +
             '<div class="progress-bar ' + progressLevel(value) +
               '" style="--pct:' + value + '"></div>' +
           '</div>';
  }

  /**
   * تأجيل التنفيذ إلى ما بعد ظهور العنصر في الصفحة.
   *
   * requestAnimationFrame وحدها لا تكفي: المتصفح يوقفها تماماً
   * حين تكون الصفحة مخفية أو في تبويب خلفي، فيبقى المخطط بلا رسم
   * والتركيز بلا تطبيق. لذا نضيف مؤقّتاً احتياطياً يضمن التنفيذ
   * مرة واحدة أياً كانت حالة الصفحة.
   *
   * @param {Function} fn
   */
  function afterPaint(fn) {
    var done = false;

    function run() {
      if (done) return;
      done = true;
      fn();
    }

    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(run);
    }

    /* شبكة أمان: تعمل حين تكون الصفحة مخفية فلا تُستدعى rAF */
    setTimeout(run, 50);
  }

  /* صورة افتراضية حين لا يتوفّر سجل المتدرب */
  function avatarFor(name) {
    return "https://ui-avatars.com/api/?background=4f46e5&color=fff&bold=true&name=" +
           encodeURIComponent(name || "?");
  }

  /* البحث عن متدرب بالاسم أو بالمعرّف داخل الذاكرة */
  function findTraineeFor(project) {
    var list = cache.trainees;

    for (var i = 0; i < list.length; i++) {
      if (project.traineeId && list[i].id === project.traineeId) return list[i];
      if (project.traineeName && list[i].name === project.traineeName) return list[i];
    }

    return null;
  }

  /* ------------------------- 2. أدوات مساعدة ------------------------- */

  /* تهريب النص قبل إدراجه في innerHTML */
  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /* أقرب ختم تاريخ متاح للمشروع — الحقول تختلف بين البذرة والمُضاف حديثاً */
  function stampOf(p) {
    return p.updatedAt || p.createdAt || p.submittedAt || p.dueDate || "";
  }

  /*
     لم تعد هناك مفردتان: الواجهة وقاعدة البيانات تستخدمان الآن
     approved / under_review / needs_revision نفسها، فحُذفت الدالة
     التي كانت تترجم بينهما (domStatus) — وكانت مصدر خطأ أفشل
     حفظ تعديل المشاريع بصمت.
  */

  function trackLabel(trainee) {
    return trainee.trackLabel || TRACK_LABELS[trainee.track] || "—";
  }

  /* مشاريع متدرب — الربط بالمعرّف أو بالاسم */
  function projectsOfTrainee(trainee, projects) {
    return (projects || []).filter(function (p) {
      return p.traineeId === trainee.id || p.traineeName === trainee.name;
    });
  }

  /*
     نسبة إنجاز المتدرب: متوسط تقدّم مشاريعه إن توفّر حقل progress،
     وإلا فنسبة المشاريع المُجازة من مجموعها.
  */
  function progressOf(trainee, projects) {
    var own = projectsOfTrainee(trainee, projects);
    if (!own.length) return 0;

    var hasProgress = own.some(function (p) {
      return typeof p.progress === "number";
    });

    if (hasProgress) {
      var sum = own.reduce(function (acc, p) {
        return acc + (Number(p.progress) || 0);
      }, 0);
      return Math.round(sum / own.length);
    }

    var done = own.filter(function (p) {
      return p.status === APPROVED;
    }).length;

    return Math.round((done / own.length) * 100);
  }

  /**
   * حالة الموعد النهائي للمشروع.
   * المشروع المُجاز لا يتأخر مهما مضى موعده.
   *
   * @returns {Object} { state: ok|soon|late, days }
   */
  function dueState(p) {
    if (!p.dueDate || p.status === APPROVED) {
      return { state: "ok", days: 0 };
    }

    var due = new Date(p.dueDate + "T00:00:00");
    if (isNaN(due.getTime())) return { state: "ok", days: 0 };

    var today = new Date();
    today.setHours(0, 0, 0, 0);

    var days = Math.round((due - today) / 86400000);

    if (days < 0) return { state: "late", days: Math.abs(days) };
    if (days <= 3) return { state: "soon", days: days };

    return { state: "ok", days: days };
  }

  /** نص عربي سليم لعدد الأيام */
  function daysLabel(n) {
    if (n === 0) return "اليوم";
    if (n === 1) return "يوم واحد";
    if (n === 2) return "يومين";
    if (n <= 10) return n + " أيام";
    return n + " يوماً";
  }

  /* صف شريط التقدّم داخل بطاقة المشروع، مع الموعد النهائي إن وُجد */
  function progressRow(p) {
    var pct = (typeof p.progress === "number")
      ? p.progress
      : (p.status === APPROVED ? 100 : 0);

    var d = dueState(p);

    var dueClass = d.state === "late" ? " is-late"
                 : d.state === "soon" ? " is-soon" : "";

    var dueNote = d.state === "late"
      ? '<b>متأخر ' + daysLabel(d.days) + '</b>'
      : d.state === "soon"
        ? '<b>يتبقّى ' + daysLabel(d.days) + '</b>'
        : '';

    var due = p.dueDate
      ? '<span class="task-due' + dueClass + '">' +
          '<i class="fa-regular fa-calendar" aria-hidden="true"></i>' +
          '<bdi>' + esc(p.dueDate) + '</bdi>' + dueNote +
        '</span>'
      : "";

    return '<div class="task-progress">' +
             '<div class="task-progress-head">' +
               '<span>الإنجاز <b>' + Math.round(pct) + '٪</b></span>' + due +
             '</div>' +
             progressBar(pct, "نسبة إنجاز المشروع") +
           '</div>';
  }

  /* ألوان المخطط تُقرأ من متغيرات CSS ليتبع الوضع الداكن تلقائياً */
  function themeColors() {
    var css = getComputedStyle(document.documentElement);
    var isDark = document.documentElement.getAttribute("data-theme") === "dark";

    function read(name, fallback) {
      var v = css.getPropertyValue(name).trim();
      return v || fallback;
    }

    return {
      isDark: isDark,
      brand:  read("--brand", "#4f46e5"),
      text:   read("--text-base", "#334155"),
      strong: read("--text-strong", "#0f172a"),
      grid:   isDark ? "rgba(148,163,184,.22)" : "rgba(100,116,139,.20)",
      angle:  isDark ? "rgba(148,163,184,.35)" : "rgba(100,116,139,.30)",
      fill:   isDark ? "rgba(129,140,248,.28)" : "rgba(79,70,229,.20)",
      surface:read("--bg-surface", "#ffffff"),
      border: read("--border", "#e2e8f0")
    };
  }

  /* ------------------------- 3. بطاقات المتدربين ------------------------- */

  /**
   * بناء قائمة بطاقات المتدربين في القائمة الجانبية.
   * @param {Array} trainees
   * @param {Array} [projects] - لحساب شريط التقدّم
   */
  function renderTrainees(trainees, projects) {
    if (!el.traineeList) return;

    var list = trainees || [];

    /* الوسيط الثاني اختياري — المشاريع تُستكمل من الذاكرة */
    var allProjects = projects || cache.projects || [];

    cache.trainees = list;

    el.traineeList.innerHTML = "";

    if (el.traineesCount) el.traineesCount.textContent = list.length;

    if (!list.length) {
      if (el.traineeEmpty) el.traineeEmpty.hidden = false;
      return;
    }

    if (el.traineeEmpty) el.traineeEmpty.hidden = true;

    var frag = document.createDocumentFragment();

    list.forEach(function (t) {
      var pct = progressOf(t, allProjects);

      var li = document.createElement("li");
      li.className = "trainee-card";
      li.dataset.traineeId = t.id;

      li.innerHTML =
        '<img class="trainee-avatar" src="' + esc(t.avatar) + '" alt="صورة ' + esc(t.name) + '" />' +
        '<div class="trainee-info">' +
          '<h3 class="trainee-name">' + esc(t.name) + '</h3>' +
          '<p class="trainee-track">' + esc(trackLabel(t)) + '</p>' +
          progressBar(pct, 'نسبة إنجاز مشاريع ' + t.name) +
        '</div>' +
        '<div class="trainee-actions">' +
          '<button type="button" class="btn btn-icon" data-action="skills" ' +
            'data-trainee-id="' + esc(t.id) + '" title="تحليل المهارات" aria-label="تحليل مهارات ' + esc(t.name) + '">' +
            '<i class="fa-solid fa-chart-simple" aria-hidden="true"></i>' +
          '</button>' +
          '<button type="button" class="btn btn-icon" data-action="certificate" ' +
            'data-trainee-id="' + esc(t.id) + '" title="إصدار شهادة" aria-label="إصدار شهادة لـ ' + esc(t.name) + '">' +
            '<i class="fa-solid fa-award" aria-hidden="true"></i>' +
          '</button>' +
          '<button type="button" class="btn btn-icon" data-action="edit-trainee" ' +
            'data-trainee-id="' + esc(t.id) + '" title="تعديل البيانات" aria-label="تعديل بيانات ' + esc(t.name) + '">' +
            '<i class="fa-solid fa-pen" aria-hidden="true"></i>' +
          '</button>' +
          '<button type="button" class="btn btn-icon btn-danger-ghost" data-action="delete-trainee" ' +
            'data-trainee-id="' + esc(t.id) + '" title="حذف المتدرب" aria-label="حذف ' + esc(t.name) + '">' +
            '<i class="fa-solid fa-trash-can" aria-hidden="true"></i>' +
          '</button>' +
        '</div>';

      frag.appendChild(li);
    });

    el.traineeList.appendChild(frag);
  }

  /* ------------------------- 4. بطاقات المشاريع ------------------------- */

  /**
   * توزيع بطاقات المشاريع على أعمدة الكانبان حسب حالتها،
   * مع شريط تقدّم يتلوّن حسب النسبة.
   * @param {Array} projects
   * @param {Array} [trainees] - اختياري؛ يُستكمل من الذاكرة الداخلية
   */
  function renderProjects(projects, trainees) {
    var list = projects || [];

    /* الوسيط الثاني اختياري — يُحدّث الذاكرة إن مُرّر */
    if (trainees) cache.trainees = trainees;

    cache.projects = list;

    /* تفريغ الأعمدة */
    Object.keys(el.columns).forEach(function (key) {
      if (el.columns[key]) el.columns[key].innerHTML = "";
    });

    var buckets = { under_review: 0, approved: 0, needs_revision: 0 };

    list.forEach(function (p) {
      var key = p.status;
      var column = el.columns[key];
      if (!column) return;

      buckets[key]++;
      column.appendChild(buildProjectCard(p, findTraineeFor(p)));
    });

    /* العدّادات وحالة العمود الفارغ */
    Object.keys(buckets).forEach(function (key) {
      if (el.counts[key]) el.counts[key].textContent = buckets[key];

      if (!buckets[key] && el.columns[key]) {
        var empty = document.createElement("p");
        empty.className = "empty-state";
        empty.innerHTML =
          '<i class="fa-regular fa-folder-open" aria-hidden="true"></i>' +
          'لا توجد مشاريع في هذا العمود.';
        el.columns[key].appendChild(empty);
      }
    });
  }

  function buildProjectCard(p, trainee) {
    var card = document.createElement("article");
    card.className = "task-card";
    card.dataset.projectId = p.id;
    card.dataset.status = p.status;
    card.dataset.traineeId = p.traineeId;
    card.dataset.track = p.track || "";
    card.dataset.due = dueState(p).state;
    card.setAttribute("tabindex", "0");

    var name = (trainee && trainee.name) || p.traineeName || "غير محدّد";
    var avatar = (trainee && trainee.avatar) || (p.traineeName ? avatarFor(p.traineeName) : "");
    var statusLabel = STATUS_LABELS[p.status] || p.status;
    var statusIcon = STATUS_ICONS[p.status] || "fa-circle";

    var tagClass = p.status === APPROVED ? "tag-success"
                 : p.status === NEEDS_REVISION ? "tag-danger"
                 : "tag-web";

    var scoreHtml = (typeof p.score === "number")
      ? '<span class="task-score"><i class="fa-solid fa-star" aria-hidden="true"></i>' + p.score + '</span>'
      : '<span class="task-score"><i class="fa-regular fa-clock" aria-hidden="true"></i>بانتظار التقييم</span>';

    card.innerHTML =
      /*
         العنوان في سطره وحده، والوسوم في صف تحته.
         وضعهما في سطر واحد كان يضغط العنوان ويكسر نص كل وسم.
      */
      '<div class="task-head">' +
        '<h4 class="task-title">' + esc(p.projectName || p.title) + '</h4>' +
      '</div>' +
      '<div class="task-tags">' +
        '<span class="tag ' + tagClass + '">' +
          '<i class="fa-solid ' + statusIcon + '" aria-hidden="true"></i>' + esc(statusLabel) +
        '</span>' +
        (p.platformShort
          ? '<span class="tag tag-platform" style="--pf:' + esc(p.platformColor || '#4f46e5') + '"' +
              ' title="' + esc(p.platformName || p.platformShort) + '">' +
              '<span class="pf-dot" aria-hidden="true"></span>' + esc(p.platformShort) +
            '</span>'
          : '') +
      '</div>' +
      '<p class="task-desc">' + esc(p.description) + '</p>' +
      (p.feedback
        ? '<p class="task-feedback" title="' + esc(p.feedback) + '">' +
            '<i class="fa-solid fa-comment-dots" aria-hidden="true"></i>' +
            esc(p.feedback) +
          '</p>'
        : '') +
      progressRow(p) +
      '<div class="task-meta">' +
        '<span class="task-owner">' +
          (avatar ? '<img src="' + esc(avatar) + '" alt="" />' : '<i class="fa-solid fa-user" aria-hidden="true"></i>') +
          esc(name) +
        '</span>' +
        scoreHtml +
        /* الأزرار داخل صف البيانات لا فوق البطاقة، تفادياً لتغطية العنوان */
        '<span class="task-actions">' +
          '<button type="button" class="btn btn-icon" data-action="edit-project" ' +
            'data-project-id="' + esc(p.id) + '" title="تعديل المشروع" aria-label="تعديل ' + esc(p.title) + '">' +
            '<i class="fa-solid fa-pen" aria-hidden="true"></i>' +
          '</button>' +
          '<button type="button" class="btn btn-icon btn-danger-ghost" data-action="delete-project" ' +
            'data-project-id="' + esc(p.id) + '" title="حذف المشروع" aria-label="حذف ' + esc(p.title) + '">' +
            '<i class="fa-solid fa-trash-can" aria-hidden="true"></i>' +
          '</button>' +
        '</span>' +
      '</div>';

    return card;
  }

  /* ------------------------- 5. المخطط الراداري ------------------------- */

  /**
   * رسم المخطط الراداري لمهارات متدرب داخل canvas#skillsRadar.
   * يدمّر أي مخطط سابق قبل الرسم لتفادي تداخل الرسوم.
   * @param {Object} trainee - يحتوي على skills كـ { "HTML": 95, ... }
   */
  /**
   * رسم المخطط الراداري داخل canvas#skillsRadar باستخدام Chart.js.
   * يدمّر أي مخطط سابق قبل الرسم لتفادي تداخل الرسوم.
   * خماسي الأضلاع حين تكون المهارات خمساً.
   *
   * @param {Object} skillsObj - { "HTML": 95, "CSS": 90, ... }
   * @returns {Chart|null}
   */
  function drawRadarChart(skillsObj) {
    if (!el.skillsCanvas || typeof window.Chart === "undefined") return null;

    /* تدمير المخطط القديم — الخطوة الأهم */
    if (radarChart) {
      radarChart.destroy();
      radarChart = null;
    }

    var skills = skillsObj || {};
    var labels = Object.keys(skills);
    var values = labels.map(function (k) { return Number(skills[k]) || 0; });
    var c = themeColors();

    if (!labels.length) {
      renderSkillsLegend({});
      return null;
    }

    radarChart = new window.Chart(el.skillsCanvas.getContext("2d"), {
      type: "radar",
      data: {
        labels: labels,
        datasets: [{
          label: "مستوى المهارة",
          data: values,
          fill: true,
          backgroundColor: c.fill,
          borderColor: c.brand,
          borderWidth: 2,
          pointBackgroundColor: c.brand,
          pointBorderColor: c.surface,
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 7,
          pointHoverBackgroundColor: c.brand,
          pointHoverBorderColor: c.surface,
          tension: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        animation: { duration: 700, easing: "easeOutQuart" },
        interaction: { mode: "nearest", intersect: false },
        /* اتجاه عربي: نبدأ من الأعلى وندور عكس عقارب الساعة */
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: c.isDark ? "#0b1120" : "#0f172a",
            titleColor: "#fff",
            bodyColor: "#fff",
            borderColor: c.brand,
            borderWidth: 1,
            padding: 10,
            cornerRadius: 8,
            displayColors: false,
            titleFont: { family: "Tajawal", size: 13, weight: "700" },
            bodyFont:  { family: "Tajawal", size: 13 },
            rtl: true,
            textDirection: "rtl",
            callbacks: {
              label: function (ctx) {
                return "المستوى: " + ctx.parsed.r + "٪";
              }
            }
          }
        },
        scales: {
          r: {
            min: 0,
            max: 100,
            beginAtZero: true,
            angleLines: { color: c.angle },
            grid: { color: c.grid, circular: true },
            pointLabels: {
              color: c.strong,
              font: { family: "Tajawal", size: 13, weight: "700" }
            },
            ticks: {
              stepSize: 20,
              color: c.text,
              backdropColor: "transparent",
              font: { family: "Tajawal", size: 11 },
              showLabelBackdrop: false
            }
          }
        }
      }
    });

    renderSkillsLegend(skills);
    return radarChart;
  }

  /**
   * غلاف يأخذ كائن المتدرب: يملأ ترويسة النافذة ثم يرسم مهاراته.
   * @param {Object} trainee
   * @returns {Chart|null}
   */
  function drawSpiderChart(trainee) {
    if (!trainee) return null;

    fillSkillsHeader(trainee);
    return drawRadarChart(trainee.skills);
  }

  function renderSkillsLegend(skills) {
    if (!el.skillsLegend) return;

    el.skillsLegend.innerHTML = "";

    Object.keys(skills).forEach(function (key) {
      var li = document.createElement("li");
      li.innerHTML = esc(key) + ' <b>' + skills[key] + '٪</b>';
      el.skillsLegend.appendChild(li);
    });
  }

  /** إعادة رسم المخطط بألوان الثيم الحالي (يُستدعى عند تبديل الوضع الداكن) */
  function refreshChartTheme(trainee) {
    if (radarChart && trainee) drawSpiderChart(trainee);
  }

  /** تدمير المخطط وتحرير الـ canvas */
  function destroyChart() {
    if (radarChart) {
      radarChart.destroy();
      radarChart = null;
    }
  }

  /* ------------------------- 6. النوافذ المنبثقة ------------------------- */

  function openModal(id) {
    var modal = document.getElementById(id);
    if (!modal) return;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeModal(id) {
    var modal = document.getElementById(id);
    if (!modal) return;
    modal.hidden = true;
    document.body.style.overflow = "";
  }

  /** تعبئة ترويسة نافذة المهارات ببيانات المتدرب */
  function fillSkillsHeader(trainee) {
    if (el.skillsAvatar) {
      el.skillsAvatar.src = trainee.avatar || "";
      el.skillsAvatar.alt = "صورة " + trainee.name;
    }
    if (el.skillsName)  el.skillsName.textContent = trainee.name;
    if (el.skillsTrack) el.skillsTrack.textContent = trackLabel(trainee);
  }

  /** تعبئة بيانات الشهادة */
  /**
   * تعبئة بيانات الشهادة.
   * @param {Object} trainee
   * @param {number|null} avgScore
   * @param {Object} [settings] - { platform_name, default_bootcamp }
   */
  function fillCertificate(trainee, avgScore, settings) {
    var config = settings || {};

    /*
       أعلى الشهادة: الجهة التدريبية التي يتبعها المتدرب (طويق، سطر...).
       فإن لم تُحدَّد له جهة، يُستخدم اسم المنصة من الإعدادات.
    */
    if (el.certPlatform) {
      var org = (trainee.platformName || "").trim() ||
                config.platform_name || "";
      if (org) el.certPlatform.textContent = org;
    }

    /* اسم المعسكر: خاص بالمتدرب، وإلا الافتراضي من الإعدادات */
    if (el.certBootcamp) {
      var bootcamp = (trainee.bootcamp || "").trim() ||
                     config.default_bootcamp || "";
      if (bootcamp) el.certBootcamp.textContent = bootcamp;
    }

    if (el.certName)  el.certName.textContent = trainee.name;
    if (el.certTrack) el.certTrack.textContent = trackLabel(trainee);
    if (el.certScore) {
      el.certScore.textContent = (typeof avgScore === "number")
        ? avgScore + "٪" : "—";
    }
    if (el.certDate) {
      el.certDate.textContent = new Date().toLocaleDateString("ar-SA-u-nu-latn");
    }
    if (el.certSerial) {
      el.certSerial.textContent = trainee.certificateSerial ||
        ("TBM-" + new Date().getFullYear() + "-" + String(trainee.id).toUpperCase());
    }
  }

  /* ------------------------- 7. قائمة الصدارة ------------------------- */

  /**
   * حساب نقاط متدرب واحد من مشاريعه.
   * @param {Object} trainee
   * @param {Array} projects
   * @returns {Object} { points, approved, review, rework, badges }
   */
  function scoreOf(trainee, projects) {
    var own = projects.filter(function (p) { return p.traineeId === trainee.id; });

    var tally = { approved: 0, under_review: 0, needs_revision: 0 };
    var points = 0;

    own.forEach(function (p) {
      var key = p.status;
      if (tally[key] === undefined) return;

      tally[key]++;
      points += POINTS[key];

      if (p.status === APPROVED && typeof p.score === "number") {
        points += p.score * POINTS.scoreBonus;
      }
    });

    if (trainee.certified) points += POINTS.certified;

    return {
      points: Math.round(points),
      approved: tally.approved,
      review: tally.under_review,
      rework: tally.needs_revision,
      total: own.length
    };
  }

  /**
   * بناء قائمة الصدارة: يحسب النقاط، يرتّب تنازلياً، ثم يعرض
   * المراكز الثلاثة الأولى على منصّة التتويج وبقيتهم كصفوف.
   * @param {Array} trainees
   * @param {Array} projects
   * @returns {Array} الترتيب المحسوب (مفيد للمتحكّم)
   */
  function renderLeaderboard(trainees, projects) {
    if (!el.rankList || !el.podium) return [];

    var list = trainees || [];
    var allProjects = projects || [];

    /* 1. حساب النقاط */
    var ranked = list.map(function (t) {
      var s = scoreOf(t, allProjects);

      return {
        trainee: t,
        points: s.points,
        approved: s.approved,
        review: s.review,
        badges: (t.badges || [])
      };
    });

    /* 2. الترتيب تنازلياً — وعند التعادل الأكثر مشاريع مُجازة أولاً */
    ranked.sort(function (a, b) {
      if (b.points !== a.points) return b.points - a.points;
      if (b.approved !== a.approved) return b.approved - a.approved;
      return a.trainee.name.localeCompare(b.trainee.name, "ar");
    });

    /*
       3. ترقيم المراكز تسلسلياً: 1، 2، 3، 4...
       التعادل لا يمنح الرقم نفسه لأكثر من واحد، فتكرار
       الرقم (4 و4 و4) يبدو كخلل. والفرز أعلاه يحسم التعادل
       بعدد المشاريع المُجازة ثم بالاسم، فالترتيب ثابت لا عشوائي.
    */
    ranked.forEach(function (row, i) {
      row.place = i + 1;
    });

    el.podium.innerHTML = "";
    el.rankList.innerHTML = "";

    var scoring = ranked.filter(function (r) { return r.points > 0; });

    if (!scoring.length) {
      if (el.leaderboardEmpty) el.leaderboardEmpty.hidden = false;
      return ranked;
    }

    if (el.leaderboardEmpty) el.leaderboardEmpty.hidden = true;

    /*
       4. منصّة التتويج: أصحاب النقاط فقط، وبحد أقصى ثلاثة.
       تتويج متدرب بصفر نقطة يفرّغ المنصّة من معناها.
    */
    scoring.slice(0, 3).forEach(function (row) {
      el.podium.appendChild(buildPodiumSlot(row));
    });

    /*
       المنصّة ثلاثة مراكز دائماً: حين يقلّ أصحاب النقاط عن ثلاثة
       يظهر الباقي مكاناً شاغراً لا متوّجاً بصفر — فتبقى المنصّة
       متوازنة بصرياً ويفهم المدرّب أن المركز لم يُحسم بعد.
    */
    for (var place = scoring.length + 1; place <= 3; place++) {
      el.podium.appendChild(buildEmptyPodiumSlot(place));
    }

    /* 5. بقية الترتيب: من بعد المتوّجين، ومعهم من لا نقاط له */
    var rest = document.createDocumentFragment();

    ranked.slice(Math.min(scoring.length, 3)).forEach(function (row) {
      rest.appendChild(buildRankRow(row));
    });

    el.rankList.appendChild(rest);

    return ranked;
  }

  /**
   * مكان شاغر على المنصّة — مركز لم يبلغه أحد بعد.
   * @param {number} place - رقم المركز
   */
  function buildEmptyPodiumSlot(place) {
    var slot = document.createElement("div");
    slot.className = "podium-slot is-empty";
    slot.dataset.place = place;

    var icon = place === 1 ? "fa-crown" : "fa-medal";

    slot.innerHTML =
      '<span class="podium-crown"><i class="fa-solid ' + icon + '" aria-hidden="true"></i></span>' +
      '<span class="podium-avatar-empty" aria-hidden="true">' + place + '</span>' +
      '<span class="podium-name">المركز ' + placeLabel(place) + '</span>' +
      '<span class="podium-points">بانتظار أول مشروع مُجاز</span>';

    return slot;
  }

  function placeLabel(place) {
    return place === 1 ? "الأول" : place === 2 ? "الثاني" : "الثالث";
  }

  function buildPodiumSlot(row) {
    var t = row.trainee;

    var slot = document.createElement("div");
    slot.className = "podium-slot";
    slot.dataset.place = row.place;
    slot.dataset.traineeId = t.id;

    var crown = row.place === 1 ? "fa-crown" : "fa-medal";

    slot.innerHTML =
      '<span class="podium-crown"><i class="fa-solid ' + crown + '" aria-hidden="true"></i></span>' +
      '<img class="trainee-avatar" src="' + esc(t.avatar) + '" alt="صورة ' + esc(t.name) + '" />' +
      '<span class="podium-name">' + esc(t.name) + '</span>' +
      '<span class="podium-points">' + row.points + ' نقطة</span>';

    return slot;
  }

  function buildRankRow(row) {
    var t = row.trainee;

    /*
       من لم يحصل على أي نقطة لم يدخل المنافسة بعد.
       إعطاؤه رقم مركز يجعل عدة متدربين يظهرون بالرقم نفسه
       (4 و4 و4) فيبدو كخلل، والصحيح أن يُعرض بشَرطة.
    */
    var unranked = row.points <= 0;

    var li = document.createElement("li");
    li.className = "rank-row" + (unranked ? " is-unranked" : "");
    li.dataset.place = row.place;
    li.dataset.traineeId = t.id;

    var meta = unranked
      ? "لم يبدأ أي مشروع بعد"
      : row.approved + " مشروع مُجاز";

    if (!unranked && row.badges.length) {
      meta += " · " + row.badges.length + " شارة";
    }

    var badgesHtml = row.badges.slice(0, 3).map(function (b) {
      return '<i class="fa-solid ' + esc(b.icon || "fa-medal") +
             '" title="' + esc(b.title || "") + '" aria-hidden="true"></i>';
    }).join("");

    li.innerHTML =
      '<span class="rank-position">' + row.place + '</span>' +
      '<img class="trainee-avatar" src="' + esc(t.avatar) + '" alt="صورة ' + esc(t.name) + '" />' +
      '<div class="rank-info">' +
        '<h3 class="rank-name">' + esc(t.name) + '</h3>' +
        '<p class="rank-meta">' + esc(meta) + '</p>' +
      '</div>' +
      '<div class="rank-badges">' + badgesHtml + '</div>' +
      '<span class="rank-points">' + row.points + ' <small>نقطة</small></span>';

    return li;
  }

  /** إبراز صف متدرب صعد في الترتيب */
  function highlightRankChange(traineeId) {
    var row = document.querySelector('.rank-row[data-trainee-id="' + traineeId + '"]');
    if (!row) return;

    row.classList.remove("is-promoted");
    void row.offsetWidth;            /* إعادة تشغيل الحركة */
    row.classList.add("is-promoted");

    setTimeout(function () { row.classList.remove("is-promoted"); }, 900);
  }

  /* ------------------------- 8. تأثير الكتابة (المُقيّم الذكي) ------------------------- */

  /* مؤقّتات الكتابة النشطة — مفتاحها معرّف العنصر */
  var typingTimers = {};

  /**
   * كتابة نص حرفاً بحرف داخل عنصر لمحاكاة تقييم الذكاء الاصطناعي.
   * يوقف أي كتابة سابقة على نفس العنصر قبل البدء.
   * @param {string} elementId
   * @param {string} text
   * @param {Object|Function} [options] - { speed, onDone } أو دالة onDone مباشرة
   * @returns {Promise<void>} يكتمل عند انتهاء الكتابة
   */
  function simulateAITyping(elementId, text, options) {
    var node = document.getElementById(elementId);
    if (!node) return Promise.resolve();

    var opts = typeof options === "function" ? { onDone: options } : (options || {});
    var speed = typeof opts.speed === "number" ? opts.speed : 22;
    var content = String(text == null ? "" : text);

    /* إيقاف كتابة سابقة على نفس العنصر */
    stopTyping(elementId);

    node.textContent = "";
    node.classList.add("is-typing");

    return new Promise(function (resolve) {
      var i = 0;

      var timer = setInterval(function () {
        /* نضيف حرفاً في كل نبضة — ونسرّع قليلاً عند المسافات */
        node.textContent += content.charAt(i);
        i++;

        if (i >= content.length) {
          clearInterval(timer);
          delete typingTimers[elementId];
          node.classList.remove("is-typing");

          if (typeof opts.onDone === "function") opts.onDone();
          resolve();
        }
      }, speed);

      typingTimers[elementId] = timer;
    });
  }

  /** إيقاف تأثير الكتابة على عنصر معيّن (أو على كل العناصر) */
  function stopTyping(elementId) {
    if (elementId) {
      if (typingTimers[elementId]) {
        clearInterval(typingTimers[elementId]);
        delete typingTimers[elementId];
      }
      return;
    }

    Object.keys(typingTimers).forEach(function (key) {
      clearInterval(typingTimers[key]);
      delete typingTimers[key];
    });
  }

  /* ------------------------- 9. خريطة مسار التعلم ------------------------- */

  /* حالة المشروع → فئة العقدة وأيقونتها */
  var NODE_STATES = {
    approved: { cls: "is-done",   icon: "fa-check",          label: "مكتمل" },
    under_review:   { cls: "is-review", icon: "fa-hourglass-half", label: "تحت التقييم" },
    needs_revision: { cls: "is-rework", icon: "fa-pen-ruler",      label: "يحتاج تعديل" }
  };

  /**
   * رسم مسار تعلم المتدرب كعقد متصلة.
   * المُجاز يضيء أخضر، وتحت التقييم أصفر، ويحتاج تعديل أحمر.
   * @param {Object} trainee
   * @param {Array} projects
   */
  function renderJourneyMap(trainee, projects) {
    if (!el.journeyMap || !trainee) return;

    /* ترويسة النافذة */
    if (el.journeyAvatar) {
      el.journeyAvatar.src = trainee.avatar || "";
      el.journeyAvatar.alt = "صورة " + trainee.name;
    }
    if (el.journeyName)  el.journeyName.textContent = trainee.name;
    if (el.journeyTrack) el.journeyTrack.textContent = trackLabel(trainee);

    /* مشاريع المتدرب مرتّبة زمنياً */
    var own = (projects || [])
      .filter(function (p) { return p.traineeId === trainee.id; })
      .sort(function (a, b) {
        return String(stampOf(a)).localeCompare(String(stampOf(b)));
      });

    el.journeyMap.innerHTML = "";

    if (!own.length) {
      var empty = document.createElement("p");
      empty.className = "empty-state";
      empty.innerHTML =
        '<i class="fa-solid fa-route" aria-hidden="true"></i>' +
        'لم يبدأ هذا المتدرب أي مشروع بعد.';
      el.journeyMap.appendChild(empty);
      updateJourneyProgress(0, 0);
      return;
    }

    var frag = document.createDocumentFragment();
    var doneCount = 0;

    own.forEach(function (p, index) {
      var meta = NODE_STATES[p.status] || NODE_STATES.under_review;
      if (p.status === APPROVED) doneCount++;

      var li = document.createElement("li");
      li.className = "journey-node " + meta.cls;
      li.dataset.projectId = p.id;
      li.dataset.status = p.status;

      var scoreHtml = (typeof p.score === "number")
        ? ' · <strong>' + p.score + '٪</strong>'
        : "";

      li.innerHTML =
        '<span class="node-dot" aria-hidden="true">' +
          '<i class="fa-solid ' + meta.icon + '"></i>' +
        '</span>' +
        '<div class="node-body">' +
          '<h4 class="node-title">' + (index + 1) + '. ' + esc(p.title) + '</h4>' +
          '<p class="node-desc">' + esc(p.description) + '</p>' +
          '<span class="node-date"><bdi>' + esc(stampOf(p)) + '</bdi>' +
            ' · ' + esc(meta.label) + scoreHtml +
          '</span>' +
        '</div>';

      frag.appendChild(li);
    });

    el.journeyMap.appendChild(frag);
    updateJourneyProgress(doneCount, own.length);
  }

  function updateJourneyProgress(done, total) {
    var pct = total ? Math.round((done / total) * 100) : 0;

    if (el.journeyProgressBar) el.journeyProgressBar.style.width = pct + "%";

    if (el.journeyProgressLabel) {
      el.journeyProgressLabel.textContent =
        done + " من " + total + " مرحلة مكتملة (" + pct + "٪)";
    }
  }

  /* ------------------------- 10. شارات المكافآت ------------------------- */

  /**
   * إظهار شارة منبثقة مع رسالة تهنئة، تختفي تلقائياً بعد 3 ثوانٍ.
   * @param {string} badgeTitle - اسم الشارة
   * @param {string} [icon] - صنف أيقونة FontAwesome (افتراضي fa-medal)
   * @param {string} [description] - رسالة التهنئة
   * @returns {HTMLElement|null}
   */
  function showBadgeToast(badgeTitle, icon, description) {
    if (!el.badgeContainer) return null;

    var toast = document.createElement("div");
    toast.className = "badge-toast";
    toast.setAttribute("role", "alert");

    /* يقبل "fa-medal" أو "fas fa-medal" أو "fa-solid fa-medal" دون تكرار النمط */
    var iconClass = String(icon || "fa-medal").trim();
    if (!/\b(fa-solid|fa-regular|fa-brands|fas|far|fab)\b/.test(iconClass)) {
      iconClass = "fa-solid " + iconClass;
    }

    toast.innerHTML =
      '<span class="badge-medal" aria-hidden="true">' +
        '<i class="' + esc(iconClass) + '"></i>' +
      '</span>' +
      '<div class="badge-body">' +
        '<span class="badge-eyebrow">مبروك! شارة جديدة</span>' +
        '<h4 class="badge-name">' + esc(badgeTitle) + '</h4>' +
        '<p class="badge-desc">' +
          esc(description || "أحرزت إنجازاً جديداً في المعسكر، واصل التقدّم!") +
        '</p>' +
      '</div>' +
      '<button type="button" class="btn btn-icon badge-dismiss" aria-label="إخفاء الشارة">' +
        '<i class="fa-solid fa-xmark" aria-hidden="true"></i>' +
      '</button>';

    el.badgeContainer.appendChild(toast);

    var hideTimer = setTimeout(dismiss, 3000);

    /* الإغلاق اليدوي يلغي المؤقّت حتى لا يعمل مرتين */
    toast.querySelector(".badge-dismiss").addEventListener("click", function () {
      clearTimeout(hideTimer);
      dismiss();
    });

    function dismiss() {
      if (!toast.isConnected) return;

      toast.classList.add("is-leaving");
      setTimeout(function () { toast.remove(); }, 350);
    }

    return toast;
  }

  /* ------------------------- 11. نماذج الإضافة ------------------------- */

  /**
   * تفريغ نموذج وإعادته إلى قيمه الافتراضية مع مسح رسائل الخطأ.
   * @param {string} formId
   */
  function resetForm(formId) {
    var form = document.getElementById(formId);
    if (!form) return;

    form.reset();
    clearFieldErrors(formId);
    syncRangeOutputs(form);
  }

  /** مزامنة قيمة كل شريط تمرير مع مخرَجه — بعد reset أو عند التحريك */
  function syncRangeOutputs(form) {
    if (!form) return;

    form.querySelectorAll('input[type="range"]').forEach(function (range) {
      var out = form.querySelector('output[for="' + range.id + '"]');
      if (out) out.textContent = range.value;
    });
  }

  /**
   * ربط أشرطة التمرير بمخرجاتها داخل نموذج.
   * يُستدعى مرة واحدة عند التهيئة.
   * @param {string} formId
   */
  function bindRangeOutputs(formId) {
    var form = document.getElementById(formId);
    if (!form) return;

    form.addEventListener("input", function (e) {
      if (e.target.type !== "range") return;

      var out = form.querySelector('output[for="' + e.target.id + '"]');
      if (out) out.textContent = e.target.value;
    });

    syncRangeOutputs(form);
  }

  /**
   * إظهار رسالة خطأ تحت حقل معيّن.
   * @param {string} inputId
   * @param {boolean} show
   */
  function setFieldError(inputId, show) {
    var input = document.getElementById(inputId);
    var error = document.getElementById(inputId + "Error");

    if (input) input.classList.toggle("is-invalid", !!show);
    if (error) error.hidden = !show;
  }

  /** مسح كل رسائل الخطأ داخل نموذج */
  function clearFieldErrors(formId) {
    var form = document.getElementById(formId);
    if (!form) return;

    form.querySelectorAll(".is-invalid").forEach(function (node) {
      node.classList.remove("is-invalid");
    });

    form.querySelectorAll(".field-error").forEach(function (node) {
      node.hidden = true;
    });
  }

  /**
   * تعبئة قائمة اختيار المتدرب في نموذج المشروع.
   * @param {Array} trainees
   * @param {string} [selectedId] - المتدرب المحدّد مسبقاً
   */
  function fillTraineeSelect(trainees, selectedId) {
    var select = el.projectTraineeSelect;
    if (!select) return;

    var list = trainees || [];
    select.innerHTML = "";

    if (!list.length) {
      var placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = "لا يوجد متدربون — أضف متدرباً أولاً";
      placeholder.disabled = true;
      placeholder.selected = true;
      select.appendChild(placeholder);
      return;
    }

    list.forEach(function (t) {
      var option = document.createElement("option");
      option.value = t.id;
      option.textContent = t.name + " — " + trackLabel(t);
      select.appendChild(option);
    });

    if (selectedId) select.value = selectedId;
  }

  /**
   * فتح نافذة إضافة مع تفريغ نموذجها وتركيز أول حقل.
   * @param {string} modalId
   * @param {string} formId
   * @param {string} [focusId] - الحقل الذي يُركَّز عليه
   */
  function openFormModal(modalId, formId, focusId) {
    resetForm(formId);
    openModal(modalId);

    if (!focusId) return;

    /* التركيز بعد ظهور النافذة حتى لا يُلغى أثناء حركة الدخول */
    afterPaint(function () {
      var field = document.getElementById(focusId);
      if (field) field.focus();
    });
  }

  /**
   * إغلاق نافذة إضافة مع تفريغ نموذجها.
   * @param {string} modalId
   * @param {string} formId
   */
  function closeFormModal(modalId, formId) {
    closeModal(modalId);
    resetForm(formId);
  }

  /** قراءة قيم نموذج المتدرب كما هي في الواجهة */
  function readTraineeForm() {
    var form = el.addTraineeForm;
    if (!form) return null;

    var skills = {};

    form.querySelectorAll('input[data-skill]').forEach(function (range) {
      skills[range.name] = Number(range.value);
    });

    return {
      name: form.elements.name.value.trim(),
      track: form.elements.track.value,
      trackLabel: form.elements.trackLabel.value.trim(),
      bootcamp: form.elements.bootcamp ? form.elements.bootcamp.value.trim() : "",
      platformId: form.elements.platformId ? form.elements.platformId.value : "",
      skills: skills
    };
  }

  /** قراءة قيم نموذج المشروع كما هي في الواجهة */
  function readProjectForm() {
    var form = el.addProjectForm;
    if (!form) return null;

    return {
      title: form.elements.title.value.trim(),
      traineeId: form.elements.traineeId.value,
      description: form.elements.description.value.trim(),
      feedback: form.elements.feedback ? form.elements.feedback.value.trim() : "",
      status: form.elements.status.value,
      platformId: form.elements.platformId ? form.elements.platformId.value : "",
      dueDate: form.elements.dueDate ? form.elements.dueDate.value : "",
      score: form.elements.score.value === '' ? null : Number(form.elements.score.value)
    };
  }

  /**
   * تبديل النموذج بين وضعي الإضافة والتعديل (العنوان ونص زر الحفظ).
   * @param {string} which - "trainee" أو "project"
   * @param {string} mode - "add" أو "edit"
   */
  function setFormMode(which, mode) {
    var isEdit = mode === "edit";

    var titles = {
      trainee: { add: "إضافة متدرب جديد", edit: "تعديل بيانات المتدرب" },
      project: { add: "إضافة مشروع جديد", edit: "تعديل بيانات المشروع" }
    };

    var labels = {
      trainee: { add: "حفظ المتدرب", edit: "حفظ التعديلات" },
      project: { add: "حفظ المشروع", edit: "حفظ التعديلات" }
    };

    var titleNode = document.getElementById(which + "FormTitle");
    var labelNode = document.getElementById(which + "SubmitLabel");

    if (titleNode) titleNode.textContent = titles[which][isEdit ? "edit" : "add"];
    if (labelNode) labelNode.textContent = labels[which][isEdit ? "edit" : "add"];
  }

  /**
   * تعبئة نموذج المتدرب ببيانات موجودة للتعديل.
   * @param {Object} trainee
   */
  function fillTraineeForm(trainee) {
    var form = el.addTraineeForm;
    if (!form || !trainee) return;

    form.elements.name.value = trainee.name || "";
    form.elements.track.value = trainee.track || "web";
    form.elements.trackLabel.value = trainee.trackLabel || "";
    if (form.elements.bootcamp) form.elements.bootcamp.value = trainee.bootcamp || "";
    if (form.elements.platformId) form.elements.platformId.value = trainee.platformId || "";

    /* المهارات تُبنى حسب مسار المتدرب وتُملأ بقيمه الحالية */
    renderSkillFields(trainee.track, trainee.skills);

    var skills = trainee.skills || {};

    form.querySelectorAll('input[type="range"]').forEach(function (range) {
      if (skills[range.name] !== undefined) range.value = skills[range.name];
    });

    syncRangeOutputs(form);
  }

  /**
   * تعبئة نموذج المشروع ببيانات موجودة للتعديل.
   * @param {Object} project
   * @param {Array} trainees - لإعادة بناء القائمة المنسدلة
   */
  function fillProjectForm(project, trainees) {
    var form = el.addProjectForm;
    if (!form || !project) return;

    fillTraineeSelect(trainees, project.traineeId);

    form.elements.title.value = project.title || "";
    form.elements.description.value = project.description || "";
    if (form.elements.feedback) form.elements.feedback.value = project.feedback || "";
    /* القائمة وقاعدة البيانات تستخدمان المفردات نفسها الآن */
    form.elements.status.value = project.status || UNDER_REVIEW;
    if (form.elements.platformId) form.elements.platformId.value = project.platformId || "";
    if (form.elements.dueDate) form.elements.dueDate.value = project.dueDate || "";
    form.elements.score.value =
      (typeof project.score === "number") ? project.score : "";
  }

  /* ------------------------- المسارات التدريبية ------------------------- */

  /**
   * تعبئة قوائم المسارات: نموذج المتدرب وفلتر شريط الأدوات.
   * وتحديث جدول التسميات حتى تعرض البطاقات الاسم العربي الصحيح.
   * @param {Array} tracks - [{ id, label, color }]
   */
  function fillTrackSelects(tracks) {
    var list = tracks || [];
    cacheTracks(list);

    /* جدول التسميات يُبنى من قاعدة البيانات لا من ثابت في الكود */
    list.forEach(function (t) {
      TRACK_LABELS[t.id] = t.label;
    });

    var form = document.getElementById("traineeTrack");

    if (form) {
      var current = form.value;
      form.innerHTML = "";

      if (!list.length) {
        form.appendChild(new Option("لا توجد مسارات مسجّلة", ""));
      } else {
        list.forEach(function (t) {
          form.appendChild(new Option(t.label, t.id));
        });

        if (current) form.value = current;
      }
    }

    var filter = document.getElementById("filterTrack");

    if (filter) {
      var selected = filter.value;
      filter.innerHTML = "";
      filter.appendChild(new Option("كل المسارات", "all"));

      list.forEach(function (t) {
        filter.appendChild(new Option(t.label, t.id));
      });

      if (selected) filter.value = selected;
    }
  }

  /**
   * بناء أشرطة المهارات في نموذج المتدرب حسب المسار المختار.
   *
   * كانت المهارات خمساً ثابتة للجميع، فيُقاس متدرب الأمن السيبراني
   * بـ CSS ومتدرب علم البيانات بـ PHP. الآن لكل مسار مهاراته.
   *
   * @param {string} trackId
   * @param {Object} [values] - قيم حالية عند التحرير
   */
  function renderSkillFields(trackId, values) {
    var host = document.getElementById("skillsFields");
    if (!host) return;

    var track = null;

    for (var i = 0; i < cache.tracks.length; i++) {
      if (cache.tracks[i].id === trackId) { track = cache.tracks[i]; break; }
    }

    var names = (track && track.skills && track.skills.length)
      ? track.skills
      : ["HTML", "CSS", "JavaScript", "UI/UX", "PHP"];

    var current = values || {};
    host.innerHTML = "";

    names.forEach(function (name, index) {
      /* معرّف آمن للعنصر: الأسماء عربية وفيها مسافات و/ */
      var id = "skill_" + index;
      var value = (typeof current[name] === "number") ? current[name] : 50;

      var row = document.createElement("div");
      row.className = "skill-row";

      row.innerHTML =
        '<label for="' + id + '">' + esc(name) + '</label>' +
        '<input type="range" id="' + id + '" name="' + esc(name) +
          '" min="0" max="100" step="5" value="' + value + '" data-skill="1" />' +
        '<output for="' + id + '">' + value + '</output>';

      host.appendChild(row);
    });
  }

  /** حفظ المسارات في الذاكرة الداخلية ليستعملها بناء المهارات */
  function cacheTracks(tracks) {
    cache.tracks = tracks || [];
  }

  /* ------------------------- الجهات التدريبية ------------------------- */

  /**
   * تعبئة كل قوائم الجهات: النموذجان وفلتر شريط الأدوات.
   * @param {Array} platforms
   */
  function fillPlatformSelects(platforms) {
    var list = platforms || [];

    /* النموذجان: قائمة مباشرة */
    [el.projectPlatformSelect, el.traineePlatformSelect].forEach(function (select) {
      if (!select) return;

      var current = select.value;
      select.innerHTML = "";

      if (!list.length) {
        select.appendChild(new Option("لا توجد جهات مسجّلة", ""));
        return;
      }

      list.forEach(function (p) {
        select.appendChild(new Option(p.name, p.id));
      });

      if (current) select.value = current;
    });

    /* الفلتر: يبدأ بخيار "كل الجهات" */
    if (el.platformFilter) {
      var selected = el.platformFilter.value;
      el.platformFilter.innerHTML = "";
      el.platformFilter.appendChild(new Option("كل الجهات", "all"));

      list.forEach(function (p) {
        el.platformFilter.appendChild(new Option(p.shortName || p.name, p.id));
      });

      if (selected) el.platformFilter.value = selected;
    }
  }

  /** ضبط الجهة المختارة في نموذج المشروع */
  function setProjectPlatform(platformId) {
    if (el.projectPlatformSelect && platformId) {
      el.projectPlatformSelect.value = platformId;
    }
  }

  /* ------------------------- إدارة الجهات والمسارات ------------------------- */

  /**
   * تبديل تبويب نافذة الإعدادات.
   * @param {string} name - platforms | tracks | general
   */
  function setSettingsTab(name) {
    document.querySelectorAll(".settings-tab").forEach(function (btn) {
      var active = btn.dataset.tab === name;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });

    document.querySelectorAll(".settings-panel").forEach(function (panel) {
      panel.hidden = panel.dataset.panel !== name;
    });
  }

  /**
   * بناء صف واحد في قائمة الإدارة.
   * @param {Object} o - { id, title, subtitle, color, count, action }
   */
  function managerRow(o) {
    var li = document.createElement("li");
    li.className = "manager-row";
    li.dataset.id = o.id;

    /* يتعذّر الحذف حين يتبع العنصرَ متدربون أو مشاريع */
    var locked = o.count > 0;

    li.innerHTML =
      '<span class="manager-dot" style="--c:' + esc(o.color || "#4f46e5") + '"></span>' +
      '<div class="manager-info">' +
        '<span class="manager-title">' + esc(o.title) + '</span>' +
        (o.subtitle ? '<span class="manager-sub">' + esc(o.subtitle) + '</span>' : '') +
      '</div>' +
      (locked
        ? '<span class="manager-count" title="لا يمكن الحذف لارتباطه ببيانات">' +
            o.count + '</span>'
        : '') +
      (o.extraAction
        ? '<button type="button" class="btn btn-icon btn-sm" ' +
            'data-action="' + esc(o.extraAction.action) + '" data-id="' + esc(o.id) + '" ' +
            'title="' + esc(o.extraAction.title) + '">' +
            '<i class="fa-solid ' + esc(o.extraAction.icon) + '" aria-hidden="true"></i>' +
          '</button>'
        : '') +
      '<button type="button" class="btn btn-icon btn-sm btn-danger-ghost" ' +
        'data-action="' + esc(o.action) + '" data-id="' + esc(o.id) + '" ' +
        (locked ? 'disabled title="لا يمكن الحذف: مرتبط ببيانات"' : 'title="حذف"') + '>' +
        '<i class="fa-solid fa-trash-can" aria-hidden="true"></i>' +
      '</button>';

    return li;
  }

  /**
   * عرض قائمة الجهات التدريبية مع عدد متدربي كل جهة.
   * @param {Array} platforms
   * @param {Array} trainees - لحساب الارتباطات
   */
  function renderPlatformsManager(platforms, trainees) {
    var list = document.getElementById("platformsList");
    if (!list) return;

    var all = platforms || [];
    var people = trainees || [];

    list.innerHTML = "";

    if (!all.length) {
      list.innerHTML = '<li class="manager-empty">لا توجد جهات مسجّلة.</li>';
      return;
    }

    all.forEach(function (p) {
      var count = people.filter(function (t) { return t.platformId === p.id; }).length;

      list.appendChild(managerRow({
        id: p.id,
        title: p.name,
        subtitle: p.shortName && p.shortName !== p.name ? p.shortName : "",
        color: p.color,
        count: count,
        action: "delete-platform"
      }));
    });
  }

  /**
   * عرض قائمة المسارات مع عدد المرتبطين بكل مسار.
   * @param {Array} tracks
   * @param {Array} trainees
   * @param {Array} projects
   */
  function renderTracksManager(tracks, trainees, projects) {
    var list = document.getElementById("tracksList");
    if (!list) return;

    var all = tracks || [];
    var people = trainees || [];
    var work = projects || [];

    list.innerHTML = "";

    if (!all.length) {
      list.innerHTML = '<li class="manager-empty">لا توجد مسارات مسجّلة.</li>';
      return;
    }

    all.forEach(function (t) {
      var count = people.filter(function (p) { return p.track === t.id; }).length +
                  work.filter(function (p) { return p.track === t.id; }).length;

      var skills = t.skills || [];

      list.appendChild(managerRow({
        id: t.id,
        title: t.label,
        /* المهارات أهم للمدرّب من المعرّف التقني، فتظهر مكانه حين توجد */
        subtitle: skills.length
          ? skills.join("، ")
          : t.id + " — لا مهارات",
        color: t.color,
        count: count,
        action: "delete-track",
        extraAction: {
          action: "edit-track-skills",
          icon: "fa-sliders",
          title: "تعديل المهارات"
        }
      }));
    });
  }

  /** تفريغ نموذج الإضافة بعد الحفظ */
  function resetManagerForm(formId) {
    var form = document.getElementById(formId);
    if (!form) return;

    form.reset();
    clearFieldErrors(formId);
  }

  /**
   * تعبئة نموذج الإعدادات بالقيم الحالية.
   * @param {Object} settings - { platform_name, default_bootcamp }
   */
  function fillSettingsForm(settings) {
    var form = el.settingsForm;
    if (!form) return;

    var config = settings || {};

    form.elements.platform_name.value = config.platform_name || "";
    form.elements.default_bootcamp.value = config.default_bootcamp || "";
  }

  /** قراءة قيم نموذج الإعدادات. */
  function readSettingsForm() {
    var form = el.settingsForm;
    if (!form) return null;

    return {
      platform_name: form.elements.platform_name.value.trim(),
      default_bootcamp: form.elements.default_bootcamp.value.trim()
    };
  }

  /* ------------------------- نافذة التأكيد ------------------------- */

  /* دالة التنفيذ المعلّقة بانتظار موافقة المستخدم */
  var pendingConfirm = null;

  /**
   * طلب تأكيد قبل إجراء لا رجعة فيه.
   * @param {Object} options - { message, detail, label, icon }
   * @returns {Promise<boolean>} true عند الموافقة
   */
  function confirmAction(options) {
    var opts = options || {};

    var message = document.getElementById("confirmMessage");
    var detail = document.getElementById("confirmDetail");
    var label = document.getElementById("confirmAcceptLabel");
    var acceptBtn = document.getElementById("confirmAcceptBtn");

    if (message) message.textContent = opts.message || "هل أنت متأكد؟";

    if (detail) {
      detail.textContent = opts.detail || "";
      detail.hidden = !opts.detail;
    }

    if (label) label.textContent = opts.label || "تأكيد الحذف";

    if (acceptBtn) {
      var icon = acceptBtn.querySelector("i");
      if (icon) icon.className = "fa-solid " + (opts.icon || "fa-trash-can");
    }

    openModal("confirmModal");

    if (acceptBtn) {
      afterPaint(function () { acceptBtn.focus(); });
    }

    return new Promise(function (resolve) {
      /* أي نداء سابق معلّق يُرفض حتى لا يبقى وعد بلا حسم */
      if (pendingConfirm) pendingConfirm(false);
      pendingConfirm = resolve;
    });
  }

  var pendingSkillsEdit = null;

  /**
   * نافذة تعديل مهارات مسار — بديل prompt الافتراضي.
   * @param {Object} options - { trackLabel, skills }
   * @returns {Promise<string|null>} النص المُدخل، أو null عند الإلغاء
   */
  function editSkillsPrompt(options) {
    var opts = options || {};

    var label = document.getElementById("skillsEditTrack");
    var input = document.getElementById("skillsEditInput");

    if (label) label.textContent = opts.trackLabel || "";

    /* سطر لكل مهارة أوضح للقراءة والتحرير من سطر واحد طويل */
    if (input) input.value = (opts.skills || []).join("\n");

    openModal("skillsEditModal");

    if (input) {
      afterPaint(function () {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      });
    }

    return new Promise(function (resolve) {
      if (pendingSkillsEdit) pendingSkillsEdit(null);
      pendingSkillsEdit = resolve;
    });
  }

  /** حسم نافذة المهارات — النص عند الحفظ، أو null عند الإلغاء */
  function resolveSkillsEdit(save) {
    closeModal("skillsEditModal");

    if (!pendingSkillsEdit) return;

    var input = document.getElementById("skillsEditInput");
    var resolve = pendingSkillsEdit;

    pendingSkillsEdit = null;
    resolve(save ? (input ? input.value : "") : null);
  }

  /** حسم التأكيد المعلّق — يستدعيها المتحكّم عند الموافقة أو الإلغاء */
  function resolveConfirm(accepted) {
    closeModal("confirmModal");

    if (!pendingConfirm) return;

    var resolve = pendingConfirm;
    pendingConfirm = null;
    resolve(!!accepted);
  }

  /** تعطيل/تفعيل زر الإرسال أثناء الحفظ */
  function setFormBusy(formId, busy) {
    var form = document.getElementById(formId);
    if (!form) return;

    var submit = form.querySelector('button[type="submit"]');
    if (!submit) return;

    submit.disabled = !!busy;

    var icon = submit.querySelector("i");
    if (!icon) return;

    if (busy) {
      icon.dataset.prev = icon.className;
      icon.className = "fa-solid fa-spinner fa-spin";
    } else if (icon.dataset.prev) {
      icon.className = icon.dataset.prev;
      delete icon.dataset.prev;
    }
  }

  /* ------------------------- 12. الإحصاءات والتنبيهات ------------------------- */

  function updateStats(stats) {
    if (!stats) return;

    /* يقبل مفردتَي الإحصاءات: total/underReview/needsRevision أو projects/review/rework */
    function pick() {
      for (var i = 0; i < arguments.length; i++) {
        if (typeof stats[arguments[i]] === "number") return stats[arguments[i]];
      }
      return 0;
    }

    set(el.statProjects,  pick("total", "projects"));
    set(el.statApproved,  pick(APPROVED));
    set(el.statReview,    pick("underReview", "review"));
    set(el.statRework,    pick("needsRevision", "rework"));
    set(el.statCertified, pick("certified"));
    set(el.statLate,      pick("late"));

    function set(node, value) {
      if (node) node.textContent = value;
    }
  }

  function updateColumnCounts() {
    Object.keys(el.columns).forEach(function (key) {
      if (!el.columns[key] || !el.counts[key]) return;
      el.counts[key].textContent =
        el.columns[key].querySelectorAll(".task-card").length;
    });
  }

  /**
   * عرض تنبيه مؤقت.
   * @param {string} message
   * @param {string} [type] - success | warning | danger | info
   */
  function showToast(message, type) {
    if (!el.toastContainer) return;

    var kind = type || "info";
    var icons = {
      success: "fa-circle-check",
      warning: "fa-triangle-exclamation",
      danger:  "fa-circle-xmark",
      info:    "fa-circle-info"
    };

    var toast = document.createElement("div");
    toast.className = "toast toast-" + kind;
    toast.innerHTML =
      '<i class="fa-solid ' + (icons[kind] || icons.info) + '" aria-hidden="true"></i>' +
      '<span>' + esc(message) + '</span>';

    el.toastContainer.appendChild(toast);

    setTimeout(function () {
      toast.style.opacity = "0";
      setTimeout(function () { toast.remove(); }, 250);
    }, 3000);
  }

  /** تحديث أيقونة زر الوضع الداكن */
  function setThemeIcon(theme) {
    if (!el.themeIcon) return;
    el.themeIcon.className = theme === "dark"
      ? "fa-solid fa-sun"
      : "fa-solid fa-moon";
  }

  /** إبراز البطاقة المحدّدة في القائمة الجانبية */
  function setActiveTrainee(traineeId) {
    var cards = el.traineeList
      ? el.traineeList.querySelectorAll(".trainee-card") : [];

    Array.prototype.forEach.call(cards, function (card) {
      card.classList.toggle("is-active", card.dataset.traineeId === traineeId);
    });
  }

  /* ------------------------- الواجهة العامة ------------------------- */

  return {
    el: el,
    afterPaint: afterPaint,
    POINTS: POINTS,
    renderTrainees: renderTrainees,
    renderProjects: renderProjects,
    updateStats: updateStats,
    renderStats: updateStats,            /* اسم قديم — نفس الدالة */
    drawRadarChart: drawRadarChart,
    progressLevel: progressLevel,
    renderLeaderboard: renderLeaderboard,
    simulateAITyping: simulateAITyping,
    stopTyping: stopTyping,
    renderJourneyMap: renderJourneyMap,
    showBadgeToast: showBadgeToast,
    highlightRankChange: highlightRankChange,
    scoreOf: scoreOf,
    drawSpiderChart: drawSpiderChart,
    refreshChartTheme: refreshChartTheme,
    destroyChart: destroyChart,
    openModal: openModal,
    closeModal: closeModal,
    openFormModal: openFormModal,
    closeFormModal: closeFormModal,
    resetForm: resetForm,
    bindRangeOutputs: bindRangeOutputs,
    setFieldError: setFieldError,
    clearFieldErrors: clearFieldErrors,
    fillTraineeSelect: fillTraineeSelect,
    readTraineeForm: readTraineeForm,
    readProjectForm: readProjectForm,
    setFormBusy: setFormBusy,
    setFormMode: setFormMode,
    fillTrackSelects: fillTrackSelects,
    renderSkillFields: renderSkillFields,
    dueState: dueState,
    fillPlatformSelects: fillPlatformSelects,
    setProjectPlatform: setProjectPlatform,
    setSettingsTab: setSettingsTab,
    renderPlatformsManager: renderPlatformsManager,
    renderTracksManager: renderTracksManager,
    resetManagerForm: resetManagerForm,
    fillSettingsForm: fillSettingsForm,
    readSettingsForm: readSettingsForm,
    fillTraineeForm: fillTraineeForm,
    fillProjectForm: fillProjectForm,
    confirmAction: confirmAction,
    resolveConfirm: resolveConfirm,
    editSkillsPrompt: editSkillsPrompt,
    resolveSkillsEdit: resolveSkillsEdit,
    fillSkillsHeader: fillSkillsHeader,
    fillCertificate: fillCertificate,
    updateColumnCounts: updateColumnCounts,
    showToast: showToast,
    setThemeIcon: setThemeIcon,
    setActiveTrainee: setActiveTrainee
  };
})();
