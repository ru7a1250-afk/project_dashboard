/* ===================================================================
   app.js — المتحكّم (Controller)
   يربط DataService (البيانات) بـ UI (العرض)، ويدير الأحداث،
   السحب والإفلات، الوضع الداكن، والميزات الأربع الجديدة:
   المُقيّم الذكي · قائمة الصدارة · خريطة المسار · نظام الشارات.
   =================================================================== */

(function () {
  "use strict";

  /*
     حالة الإجازة كُتبت نصّاً حرفياً في تسعة مواضع، وخطأ إملائي واحد
     فيها يُنتج خللاً صامتاً لا يرصده المترجم. المصدر الآن واحد.
     القيمة نفسها في مفردات قاعدة البيانات ومفردات الواجهة.
  */
  var APPROVED = DataService.STATUSES.APPROVED;
  var UNDER_REVIEW = DataService.STATUSES.UNDER_REVIEW;
  var NEEDS_REVISION = DataService.STATUSES.NEEDS_REVISION;

  /* ------------------------- 1. حالة التطبيق ------------------------- */

  var state = {
    trainees: [],
    projects: [],
    activeTraineeId: null,   /* المتدرب المفتوح في النوافذ */
    /* الفلترة المتقاطعة */
    searchTerm: "",          /* بحث المشاريع */
    statusFilter: "all",
    trackFilter: "all",
    traineeSearch: "",       /* بحث المتدربين في القائمة الجانبية */
    view: "kanban",
    sortables: [],

    /* المُقيّم الذكي */
    aiProjectId: null,
    aiResult: null,
    aiBusy: false,

    /* السجل الجاري تحريره — null يعني وضع الإضافة */
    editingTraineeId: null,
    editingProjectId: null,

    /* نطاق قائمة الصدارة: all | month | week */
    leaderboardRange: "all",

    /* ترتيب الصدارة السابق — لاكتشاف من صعد */
    lastRanking: {},

    /* إعدادات المنصة: اسمها والمعسكر الافتراضي */
    settings: {},

    /* المسارات التدريبية */
    tracks: [],

    /* الجهات التدريبية وفلترها */
    platforms: [],
    platformFilter: "all"
  };

  var THEME_KEY = "tbm_theme";

  /* ------------------------- 2. أدوات مساعدة ------------------------- */

  function findTrainee(id) {
    for (var i = 0; i < state.trainees.length; i++) {
      if (state.trainees[i].id === id) return state.trainees[i];
    }
    return null;
  }

  /*
     نسخ السجل العائد من طبقة البيانات كاملاً فوق النسخة المحلية.
     النسخ الجزئي يترك حقولاً مشتقّة قديمة مثل domStatus
     فتتناقض اللوحة مع الإحصائيات.
  */
  function syncRecord(local, fresh) {
    if (!local || !fresh) return local;

    Object.keys(fresh).forEach(function (key) {
      local[key] = fresh[key];
    });

    return local;
  }

  function findProject(id) {
    for (var i = 0; i < state.projects.length; i++) {
      if (state.projects[i].id === id) return state.projects[i];
    }
    return null;
  }

  /* متوسط درجات المشاريع المُجازة لمتدرب — يُستخدم في الشهادة */
  function averageScore(traineeId) {
    var scored = state.projects.filter(function (p) {
      return p.traineeId === traineeId &&
             p.status === APPROVED &&
             typeof p.score === "number";
    });

    if (!scored.length) return null;

    var sum = scored.reduce(function (acc, p) { return acc + p.score; }, 0);
    return Math.round(sum / scored.length);
  }

  function projectsOf(traineeId) {
    return state.projects.filter(function (p) { return p.traineeId === traineeId; });
  }

  /* المشاريع بعد تطبيق فلتر المسار */
  /* ------------------------- الفلترة المتقاطعة الحية ------------------------- */

  /*
     المعايير الثلاثة تُطبَّق معاً (AND) على نفس القائمة:
     نص البحث × حالة المشروع × المسار التدريبي.
  */
  function visibleProjects() {
    var term = state.searchTerm.trim();

    /* الحالة تُطبَّع لأن خيارات الـ HTML بالمفردات القديمة */
    var status = state.statusFilter !== "all"
      ? DataService.normalizeStatus(state.statusFilter)
      : "all";

    var track = state.trackFilter !== "all"
      ? DataService.normalizeTrack(state.trackFilter)
      : "all";

    var lateOnly = state.statusFilter === "late";

    return state.projects.filter(function (p) {
      if (lateOnly) {
        if (UI.dueState(p).state !== "late") return false;
      } else if (status !== "all" && p.status !== status) {
        return false;
      }
      if (state.platformFilter !== "all" && p.platformId !== state.platformFilter) return false;
      if (track !== "all" && p.track !== track) return false;

      if (term) {
        var haystack = [
          p.projectName || p.title || "",
          p.description || "",
          p.traineeName || ""
        ].join(" ");

        if (haystack.indexOf(term) === -1) return false;
      }

      return true;
    });
  }

  /** هل يوجد فلتر نشط الآن؟ */
  function hasActiveFilters() {
    return state.searchTerm.trim() !== "" ||
           state.statusFilter !== "all" ||
           state.platformFilter !== "all" ||
           state.trackFilter !== "all";
  }

  /** إحصائيات محسوبة من قائمة مشاريع بعينها — لا من التخزين */
  function statsOf(projects) {
    function countBy(status) {
      return projects.filter(function (p) {
        return DataService.normalizeStatus(p.status) === status;
      }).length;
    }

    return {
      total: projects.length,
      approved: countBy(APPROVED),
      underReview: countBy("under_review"),
      needsRevision: countBy("needs_revision"),
      late: projects.filter(function (p) { return UI.dueState(p).state === "late"; }).length,
      certified: state.trainees.filter(function (t) { return t.certified; }).length
    };
  }

  /** سطر ملخّص نتائج التصفية أسفل شريط الأدوات */
  function renderFilterSummary(shown) {
    var node = document.getElementById("filterSummary");
    if (!node) return;

    if (!hasActiveFilters()) {
      node.hidden = true;
      node.textContent = "";
      return;
    }

    node.hidden = false;
    node.innerHTML = "عرض <b>" + shown + "</b> من أصل <b>" +
                     state.projects.length + "</b> مشروع.";
  }

  /** إبراز القوائم المنسدلة النشطة */
  function markActiveFilters() {
    var status = document.getElementById("filterStatus");
    var track = document.getElementById("filterTrack");

    if (status) status.classList.toggle("is-filtering", state.statusFilter !== "all");
    if (track) track.classList.toggle("is-filtering", state.trackFilter !== "all");

    var platform = document.getElementById("filterPlatform");
    if (platform) platform.classList.toggle("is-filtering", state.platformFilter !== "all");
  }

  /**
   * إعادة تطبيق الفلاتر وتحديث اللوحة والإحصائيات فوراً.
   * تُستدعى عند كل ضغطة مفتاح أو تغيير في أي فلتر.
   */
  function applyFilters() {
    var shown = visibleProjects();

    renderBoard(shown);
    UI.updateStats(statsOf(shown));

    markActiveFilters();
    renderFilterSummary(shown.length);
  }

  /** إعادة كل الفلاتر إلى وضعها الافتراضي */
  function resetFilters() {
    state.searchTerm = "";
    state.statusFilter = "all";
    state.trackFilter = "all";
    state.platformFilter = "all";

    var platform = document.getElementById("filterPlatform");
    if (platform) platform.value = "all";

    var search = document.getElementById("searchProject");
    var status = document.getElementById("filterStatus");
    var track = document.getElementById("filterTrack");

    if (search) search.value = "";
    if (status) status.value = "all";
    if (track) track.value = "all";

    applyFilters();
    UI.showToast("تمت إعادة ضبط الفلاتر", "info");
  }

  /* ------------------------- تبديل العرض: كانبان / شبكة ------------------------- */

  /**
   * رسم المشاريع في العرض النشط.
   * @param {Array} projects
   */
  function renderBoard(projects) {
    var board = document.getElementById("kanbanBoard");
    var grid = document.getElementById("projectGrid");

    if (state.view === "grid") {
      if (board) board.hidden = true;
      if (grid) grid.hidden = false;
      renderGrid(projects);
      return;
    }

    /*
       الشبكة تُفرَّغ عند مغادرتها: renderGrid ينقل البطاقات إليها نقلاً،
       فتركها مخفية يُبقي نسخاً قديمة لا تتحدث، وتتكرر معها معرّفات
       المشاريع في الصفحة.
    */
    if (grid) {
      grid.innerHTML = "";
      grid.hidden = true;
    }

    if (board) board.hidden = false;

    UI.renderProjects(projects, state.trainees);
    initSortable();
  }

  /* العرض الشبكي يعيد استخدام بطاقات الكانبان نفسها */
  function renderGrid(projects) {
    var grid = document.getElementById("projectGrid");
    if (!grid) return;

    /* التصيير عبر عمود مؤقّت ثم نقل البطاقات — مصدر واحد لبناء البطاقة */
    UI.renderProjects(projects, state.trainees);

    grid.innerHTML = "";

    var cards = document.querySelectorAll("#kanbanBoard .task-card");

    Array.prototype.forEach.call(cards, function (card) {
      grid.appendChild(card);
    });

    if (!grid.children.length) {
      grid.innerHTML = '<p class="empty-state">' +
        '<i class="fa-regular fa-folder-open" aria-hidden="true"></i>' +
        'لا توجد مشاريع مطابقة.</p>';
    }
  }

  function setView(view) {
    state.view = view === "grid" ? "grid" : "kanban";

    document.querySelectorAll(".view-btn").forEach(function (btn) {
      var active = btn.dataset.view === state.view;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });

    applyFilters();
  }

  /* المتدربون بعد تطبيق البحث */
  function visibleTrainees() {
    var term = state.traineeSearch.trim();
    if (!term) return state.trainees;

    return state.trainees.filter(function (t) {
      return t.name.indexOf(term) !== -1 ||
             String(t.trackLabel || "").indexOf(term) !== -1;
    });
  }

  /**
   * إعادة رسم كل شيء من الحالة الحالية.
   * البحث وفلتر المسار يؤثران في العرض فقط؛ قائمة الصدارة
   * تتبع نطاقها الزمني وحده لا هذين الفلترين.
   */
  function renderAll() {
    UI.renderTrainees(visibleTrainees(), state.projects);
    applyFilters();
    UI.setActiveTrainee(state.activeTraineeId);
    refreshLeaderboard();
  }

  /*
     الإحصائيات تتبع القائمة المعروضة لا التخزين كاملاً،
     حتى تنسجم أرقام البطاقات مع الفلترة الجارية.
  */
  function refreshStats() {
    UI.updateStats(statsOf(visibleProjects()));
    return Promise.resolve();
  }

  /* ------------------------- 3. قائمة الصدارة ------------------------- */

  /**
   * المشاريع ضمن النطاق الزمني المختار لقائمة الصدارة.
   * المعيار هو updatedAt أي آخر تغيّر في حالة المشروع.
   */
  function projectsInRange() {
    if (state.leaderboardRange === "all") return state.projects;

    var days = state.leaderboardRange === "week" ? 7 : 30;
    var limit = new Date();
    limit.setDate(limit.getDate() - days);
    limit.setHours(0, 0, 0, 0);

    return state.projects.filter(function (p) {
      var stamp = p.updatedAt || p.createdAt || p.submittedAt;
      if (!stamp) return false;

      var date = new Date(stamp + "T00:00:00");
      return !isNaN(date.getTime()) && date >= limit;
    });
  }

  /**
   * إعادة بناء الترتيب ومقارنته بالسابق لإبراز من صعد.
   * تُستدعى عند التحميل وبعد كل تغيّر في حالة أي مشروع.
   */
  function refreshLeaderboard() {
    var ranked = UI.renderLeaderboard(state.trainees, projectsInRange()) || [];
    var previous = state.lastRanking;
    var current = {};

    ranked.forEach(function (row) {
      var id = row.trainee.id;
      current[id] = row.place;

      /* صعد في الترتيب مقارنةً بالمرة السابقة */
      if (previous[id] && row.place < previous[id]) {
        UI.highlightRankChange(id);
      }
    });

    state.lastRanking = current;
    return ranked;
  }

  /* ------------------------- 4. نظام الشارات ------------------------- */

  /* تعريف الشارات: شرط + عنوان + أيقونة */
  var BADGES = [
    {
      id: "first-approval",
      title: "أول إنجاز 🎯",
      icon: "fa-seedling",
      description: "أجزت أول مشروع لك في المعسكر!",
      earned: function (t, own) {
        return own.filter(isApproved).length >= 1;
      }
    },
    {
      id: "code-hero",
      title: "بطل الكود! 🏆",
      icon: "fa-medal",
      description: "أجزت مشروعاً بدرجة 90 فأعلى — أداء استثنائي.",
      earned: function (t, own) {
        return own.some(function (p) {
          return isApproved(p) && typeof p.score === "number" && p.score >= 90;
        });
      }
    },
    {
      id: "triple-threat",
      title: "ثلاثية الإتقان ⚡",
      icon: "fa-bolt",
      description: "ثلاثة مشاريع مُجازة في سجلّك.",
      earned: function (t, own) {
        return own.filter(isApproved).length >= 3;
      }
    },
    {
      id: "graduate",
      title: "خرّيج المعسكر 🎓",
      icon: "fa-graduation-cap",
      description: "حصلت على شهادة اجتياز المعسكر.",
      earned: function (t) { return !!t.certified; }
    }
  ];

  function isApproved(p) { return p.status === APPROVED; }

  /**
   * فحص شارات متدرب ومنح الجديد منها.
   * @param {string} traineeId
   * @param {boolean} [silent] - true لمنحها دون إظهار Toast (عند التحميل)
   * @returns {Array} الشارات الممنوحة حديثاً
   */
  function awardBadges(traineeId, silent) {
    var trainee = findTrainee(traineeId);
    if (!trainee) return [];

    if (!Array.isArray(trainee.badges)) trainee.badges = [];

    var own = projectsOf(traineeId);
    var owned = trainee.badges.map(function (b) { return b.id; });
    var fresh = [];

    BADGES.forEach(function (badge) {
      if (owned.indexOf(badge.id) !== -1) return;
      if (!badge.earned(trainee, own)) return;

      trainee.badges.push({
        id: badge.id,
        title: badge.title,
        icon: badge.icon
      });

      fresh.push(badge);
    });

    if (!fresh.length) return [];

    /* الحفظ الفوري في LocalStorage حتى لا تضيع الشارة عند تحديث الصفحة */
    persistBadges(trainee);

    /* عرض الشارات الجديدة تباعاً حتى لا تتكدّس دفعة واحدة */
    if (!silent) {
      fresh.forEach(function (badge, i) {
        setTimeout(function () {
          UI.showBadgeToast(badge.title, badge.icon, badge.description);
        }, i * 700);
      });
    }

    return fresh;
  }

  /**
   * حفظ شارات متدرب في طبقة البيانات.
   * @param {Object} trainee
   * @returns {Promise}
   */
  function persistBadges(trainee) {
    return DataService.updateTraineeBadges(trainee.id, trainee.badges)
      .then(function (saved) {
        /* مزامنة الحقول المحسوبة في طبقة البيانات مثل earnedAt */
        trainee.badges = saved.badges;
      })
      .catch(function (err) {
        UI.showToast("تعذّر حفظ الشارات: " + err.message, "danger");
        console.error("[TBM] persistBadges failed:", err);
      });
  }

  /**
   * منح الشارات المستحقة لكل المتدربين بصمت — عند التحميل الأول.
   * تُحفظ دفعةً واحدة، ولا يُعاد الحفظ لمن لا جديد لديه.
   */
  function syncAllBadges() {
    var pending = [];

    state.trainees.forEach(function (t) {
      if (awardBadges(t.id, true).length) pending.push(t.id);
    });

    return pending;
  }

  /* ------------------------- 5. السحب والإفلات (SortableJS) ------------------------- */

  function initSortable() {
    if (typeof window.Sortable === "undefined") return;

    /* تنظيف النسخ السابقة قبل ربط الأعمدة من جديد */
    state.sortables.forEach(function (s) {
      try { s.destroy(); } catch (err) { /* تم تدميره مسبقاً */ }
    });
    state.sortables = [];

    Object.keys(UI.el.columns).forEach(function (key) {
      var column = UI.el.columns[key];
      if (!column) return;

      var instance = window.Sortable.create(column, {
        group: "kanban",
        animation: 180,
        easing: "cubic-bezier(.2,.8,.3,1)",
        ghostClass: "sortable-ghost",
        chosenClass: "sortable-chosen",
        dragClass: "sortable-drag",
        draggable: ".task-card",
        /* الأزرار داخل البطاقة لا تبدأ سحباً، وإلا ابتلع السحبُ نقرتها */
        filter: ".empty-state, .task-actions, .task-actions *",
        preventOnFilter: false,
        forceFallback: false,
        fallbackOnBody: true,
        swapThreshold: 0.65,

        onStart: function (evt) {
          evt.to.classList.add("is-drop-target");
        },

        onMove: function (evt) {
          /* إبراز العمود الذي يمرّ فوقه المؤشر */
          Object.keys(UI.el.columns).forEach(function (k) {
            if (UI.el.columns[k]) {
              UI.el.columns[k].classList.toggle("is-drop-target",
                UI.el.columns[k] === evt.to);
            }
          });
          return true;
        },

        onEnd: handleDrop
      });

      state.sortables.push(instance);
    });
  }

  function handleDrop(evt) {
    /* إزالة إبراز الأعمدة */
    Object.keys(UI.el.columns).forEach(function (k) {
      if (UI.el.columns[k]) UI.el.columns[k].classList.remove("is-drop-target");
    });

    var card = evt.item;
    var projectId = card.dataset.projectId;
    var newStatus = evt.to.dataset.status;
    var oldStatus = evt.from.dataset.status;
    var newOrder = evt.newDraggableIndex;

    if (!projectId || !newStatus) return;

    var sameColumn = newStatus === oldStatus;
    var becameApproved = !sameColumn && newStatus === APPROVED;

    /* تحديث فوري للواجهة (تفاؤلي) قبل وصول رد "الـ API" */
    card.dataset.status = newStatus;
    UI.updateColumnCounts();

    DataService.updateProjectStatus(projectId, newStatus, newOrder)
      .then(function (updated) {
        /* مزامنة الحالة المحلية */
        syncRecord(findProject(projectId), updated);

        if (!sameColumn) {
          UI.showToast(
            '"' + (updated.projectName || updated.title) + '" → ' +
            DataService.STATUS_LABELS[DataService.normalizeStatus(newStatus)],
            newStatus === APPROVED ? "success"
              : newStatus === NEEDS_REVISION ? "warning" : "info"
          );
        }

        /* --- الإفلات في عمود "مُجاز": احتفال + شارات --- */
        if (becameApproved) {
          fireConfetti(1);
          celebrateApproval(updated);
        }

        /* إعادة الرسم — تشمل تحديث الترتيب ديناميكياً */
        renderAll();
        return refreshStats();
      })
      .catch(function (err) {
        UI.showToast("تعذّر تحديث حالة المشروع: " + err.message, "danger");
        renderAll();
      });
  }

  /**
   * الاحتفال بإجازة مشروع: شارة "بطل الكود" ثم أي شارات أخرى مستحقة.
   * @param {Object} project
   */
  function celebrateApproval(project) {
    UI.showBadgeToast(
      "بطل الكود! 🏆",
      "fa-medal",
      'تمت إجازة مشروع "' + project.title + '" — عمل يستحق التقدير!'
    );

    /* الشارات الأخرى تظهر بعد شارة الاحتفال مباشرةً */
    setTimeout(function () {
      awardBadges(project.traineeId);
      refreshLeaderboard();
    }, 800);
  }

  /* ------------------------- 6. الاحتفال (Canvas Confetti) ------------------------- */

  function fireConfetti(intensity) {
    if (typeof window.confetti !== "function") return;

    var scale = intensity || 1;

    window.confetti({
      particleCount: Math.round(110 * scale),
      spread: 75,
      origin: { y: 0.6 },
      colors: ["#4f46e5", "#22d3ee", "#b7892f", "#e3c77a", "#16a34a"]
    });

    if (scale >= 1) {
      /* دفعتان جانبيتان لإحساس أغنى */
      setTimeout(function () {
        window.confetti({
          particleCount: 70, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }
        });
        window.confetti({
          particleCount: 70, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }
        });
      }, 220);
    }
  }

  /* ------------------------- 7. المُقيّم الذكي ------------------------- */

  /* عبارات مرحلة "التفكير" */
  var AI_STEPS = [
    "جارٍ قراءة بنية المشروع وملفاته...",
    "تحليل جودة الكود ونمط التسمية...",
    "فحص التجاوب مع الشاشات الصغيرة...",
    "مراجعة معايير الوصولية (a11y)...",
    "صياغة التقرير النهائي..."
  ];

  /* بنك الملاحظات — يُختار منه حسب الدرجة */
  var AI_NOTES = {
    good: [
      "تقسيم المكوّنات واضح وقابل لإعادة الاستخدام.",
      "أسماء المتغيرات معبّرة وتسهّل قراءة الكود.",
      "التنسيقات منظّمة والاعتماد على متغيرات CSS ممتاز."
    ],
    warn: [
      "بعض الأزرار تفتقر إلى aria-label وصفي.",
      "تكرار في بعض قواعد CSS يمكن دمجه.",
      "غياب معالجة الأخطاء في بعض نداءات البيانات."
    ],
    tip: [
      "يُفضّل تأجيل تحميل الصور الكبيرة (lazy loading).",
      "أضف اختبارات بسيطة للدوال الحسابية.",
      "وثّق الدوال العامة بتعليقات JSDoc."
    ]
  };

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function verdictFor(score) {
    if (score >= 90) {
      return "تحليل ممتاز! الكود منظّم والأداء في الـ CSS لافت، والمشروع جاهز للإجازة دون تحفّظات.";
    }
    if (score >= 75) {
      return "مشروع جيد جداً مع بنية سليمة، وتبقّت ملاحظات بسيطة في الوصولية تستحق المعالجة.";
    }
    if (score >= 60) {
      return "المشروع يؤدي الغرض لكنه يحتاج تحسيناً في تنظيم الكود ومعالجة الحالات الاستثنائية.";
    }
    return "المشروع يحتاج إعادة نظر في البنية الأساسية قبل الإجازة.";
  }

  /**
   * فتح نافذة المُقيّم الذكي وتشغيل محاكاة التحليل.
   * @param {string} projectId
   */
  function openAIReview(projectId) {
    var project = findProject(projectId);
    if (!project) return;

    var owner = findTrainee(project.traineeId);

    state.aiProjectId = projectId;
    state.aiResult = null;

    if (UI.el.aiProjectTitle) UI.el.aiProjectTitle.textContent = project.title;
    if (UI.el.aiProjectOwner) {
      UI.el.aiProjectOwner.textContent =
        (owner ? owner.name : "متدرب غير محدّد") + " · " +
        (DataService.STATUS_LABELS[project.status] || project.status);
    }

    UI.openModal("aiReviewModal");
    runAIAnalysis(project);
  }

  function closeAIReview() {
    UI.stopTyping();
    UI.closeModal("aiReviewModal");
    state.aiBusy = false;
  }

  /** تشغيل مراحل التحليل ثم عرض النتيجة */
  function runAIAnalysis(project) {
    if (state.aiBusy) return;
    state.aiBusy = true;

    var e = UI.el;

    /* تهيئة الواجهة: إظهار مرحلة التفكير وإخفاء النتيجة */
    if (e.aiThinking) e.aiThinking.hidden = false;
    if (e.aiResult) e.aiResult.hidden = true;
    if (e.aiProgressBar) e.aiProgressBar.style.width = "0%";

    var applyBtn = document.getElementById("aiApplyBtn");
    var rerunBtn = document.getElementById("aiRerunBtn");
    if (applyBtn) applyBtn.disabled = true;
    if (rerunBtn) rerunBtn.hidden = true;

    var step = 0;

    /* كل مرحلة: يُكتب نصّها حرفاً بحرف ثم يتقدّم الشريط */
    function nextStep() {
      if (step >= AI_STEPS.length) {
        finishAnalysis(project);
        return;
      }

      var pct = Math.round(((step + 1) / AI_STEPS.length) * 100);

      UI.simulateAITyping("aiThinkingText", AI_STEPS[step], { speed: 18 })
        .then(function () {
          if (e.aiProgressBar) e.aiProgressBar.style.width = pct + "%";
          step++;
          setTimeout(nextStep, 260);
        });
    }

    nextStep();
  }

  function finishAnalysis(project) {
    var e = UI.el;

    /* درجة محاكاة: تُبنى حول درجة المشروع إن وُجدت */
    var base = typeof project.score === "number" ? project.score : 78;
    var score = Math.max(55, Math.min(99, Math.round(base + (Math.random() * 12 - 6))));

    var criteria = [
      { name: "جودة الكود",  value: clamp(score + rand(-4, 5)) },
      { name: "التجاوب",     value: clamp(score + rand(-8, 6)) },
      { name: "الوصولية",    value: clamp(score + rand(-18, 2)) },
      { name: "الأداء",      value: clamp(score + rand(-6, 8)) }
    ];

    var notes = [
      { kind: "good", icon: "fa-circle-check",        text: pick(AI_NOTES.good) },
      { kind: "warn", icon: "fa-triangle-exclamation", text: pick(AI_NOTES.warn) },
      { kind: "tip",  icon: "fa-lightbulb",            text: pick(AI_NOTES.tip) }
    ];

    /* الملاحظات تُحفظ نصاً مع المشروع لا تُرمى بعد العرض */
    var feedbackText = [
      verdictFor(score),
      "",
      notes.map(function (n) { return "• " + n.text; }).join("\n"),
      "",
      criteria.map(function (c) { return c.name + ": " + c.value + "٪"; }).join(" · ")
    ].join("\n");

    state.aiResult = { score: score, criteria: criteria, feedback: feedbackText };

    /* إخفاء مرحلة التفكير وإظهار النتيجة */
    if (e.aiThinking) e.aiThinking.hidden = true;
    if (e.aiResult) e.aiResult.hidden = false;

    /* حلقة الدرجة — تتحرك عبر المتغيّر --score */
    if (e.aiScoreRing) e.aiScoreRing.style.setProperty("--score", score);
    if (e.aiScoreValue) e.aiScoreValue.textContent = score;

    /* المعايير */
    if (e.aiCriteria) {
      e.aiCriteria.innerHTML = criteria.map(function (c) {
        var cls = c.value >= 85 ? "is-high" : c.value >= 65 ? "is-mid" : "is-low";

        return '<li class="ai-criterion">' +
          '<div class="ai-criterion-head"><span>' + c.name + '</span><b>' + c.value + '٪</b></div>' +
          '<div class="progress"><div class="progress-bar ' + cls +
            '" style="--pct:' + c.value + '"></div></div>' +
        '</li>';
      }).join("");
    }

    /* الملاحظات */
    if (e.aiNotes) {
      e.aiNotes.innerHTML = notes.map(function (n) {
        return '<li data-kind="' + n.kind + '">' +
          '<i class="fa-solid ' + n.icon + '" aria-hidden="true"></i>' +
          '<span>' + n.text + '</span>' +
        '</li>';
      }).join("");
    }

    /* الحكم النهائي يُكتب حرفاً بحرف */
    UI.simulateAITyping("aiVerdict", verdictFor(score), { speed: 16 })
      .then(function () {
        state.aiBusy = false;

        var applyBtn = document.getElementById("aiApplyBtn");
        var rerunBtn = document.getElementById("aiRerunBtn");
        if (applyBtn) applyBtn.disabled = false;
        if (rerunBtn) rerunBtn.hidden = false;
      });
  }

  function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function clamp(v) {
    return Math.max(0, Math.min(100, v));
  }

  /** اعتماد نتيجة المُقيّم: ينقل المشروع إلى "مُجاز" بالدرجة المقترحة */
  function applyAIResult() {
    if (!state.aiProjectId || !state.aiResult) return;

    var projectId = state.aiProjectId;
    var score = state.aiResult.score;
    var project = findProject(projectId);
    if (!project) return;

    /* الحالة والدرجة تُحفظان معاً في التخزين */
    DataService.updateProject(projectId, {
      status: APPROVED,
      score: score,
      feedback: state.aiResult.feedback || ""
    })
      .then(function (updated) {
        syncRecord(findProject(projectId), updated);

        closeAIReview();
        UI.showToast('تم اعتماد تقييم "' + updated.title + '" بدرجة ' + score + '٪', "success");

        fireConfetti(1);
        celebrateApproval(updated);

        renderAll();
        return refreshStats();
      })
      .catch(function (err) {
        UI.showToast("تعذّر اعتماد التقييم: " + err.message, "danger");
      });
  }

  /* ------------------------- 8. خريطة المسار ------------------------- */

  function openJourney(traineeId) {
    var trainee = findTrainee(traineeId);
    if (!trainee) return;

    state.activeTraineeId = traineeId;
    UI.setActiveTrainee(traineeId);
    UI.renderJourneyMap(trainee, state.projects);
    UI.openModal("journeyModal");
  }

  /* ------------------------- 9. النوافذ الأخرى ------------------------- */

  function openSkills(traineeId) {
    var trainee = findTrainee(traineeId);
    if (!trainee) return;

    state.activeTraineeId = traineeId;
    UI.setActiveTrainee(traineeId);
    UI.fillSkillsHeader(trainee);
    UI.openModal("skillsModal");

    /* الرسم بعد ظهور النافذة حتى يقيس Chart.js أبعاد الـ canvas بشكل صحيح */
    UI.afterPaint(function () {
      UI.drawSpiderChart(trainee);
    });
  }

  function closeSkills() {
    UI.closeModal("skillsModal");
    UI.destroyChart();
  }

  function openCertificate(traineeId) {
    var trainee = findTrainee(traineeId);
    if (!trainee) return;

    var approved = state.projects.filter(function (p) {
      return p.traineeId === traineeId && p.status === APPROVED;
    });

    if (!approved.length) {
      UI.showToast("لا يمكن إصدار الشهادة: لا يوجد مشروع مُجاز لهذا المتدرب.", "warning");
      return;
    }

    state.activeTraineeId = traineeId;

    DataService.certifyTrainee(traineeId)
      .then(function (updated) {
        var local = findTrainee(traineeId);
        if (local) {
          local.certified = true;
          local.certifiedAt = updated.certifiedAt;
          local.certificateSerial = updated.certificateSerial;
        }

        UI.fillCertificate(updated, averageScore(traineeId), state.settings);
        UI.openModal("certificateModal");
        fireConfetti(1);
        UI.showToast("تم إصدار شهادة " + updated.name + " بنجاح 🎉", "success");

        /* شهادة جديدة = شارة الخرّيج + تغيّر في النقاط */
        awardBadges(traineeId);
        refreshLeaderboard();

        return refreshStats();
      })
      .catch(function (err) {
        UI.showToast("تعذّر إصدار الشهادة: " + err.message, "danger");
      });
  }

  /* ------------------------- 10. الوضع الداكن ------------------------- */

  /**
   * @param {string} theme - light | dark
   * @param {boolean} [persist] - يُحفظ فقط عند اختيار المستخدم صراحةً،
   *        حتى تبقى المنصة تابعة لتفضيل النظام ما لم يتدخّل المستخدم.
   */
  function applyTheme(theme, persist) {
    document.documentElement.setAttribute("data-theme", theme);
    UI.setThemeIcon(theme);

    if (persist) {
      try {
        window.localStorage.setItem(THEME_KEY, theme);
      } catch (err) {
        /* التخزين غير متاح — الثيم يبقى لهذه الجلسة فقط */
      }
    }

    /* إعادة رسم المخطط بألوان الثيم الجديد إن كان مفتوحاً */
    var trainee = findTrainee(state.activeTraineeId);
    if (trainee) UI.refreshChartTheme(trainee);
  }

  function initTheme() {
    var saved = null;

    try {
      saved = window.localStorage.getItem(THEME_KEY);
    } catch (err) { /* تجاهل */ }

    if (!saved) {
      saved = window.matchMedia &&
              window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark" : "light";
    }

    applyTheme(saved, false);
  }

  function toggleTheme() {
    var current = document.documentElement.getAttribute("data-theme");
    applyTheme(current === "dark" ? "light" : "dark", true);
  }

  /* ------------------------- 11. ربط الأحداث ------------------------- */

  function bindEvents() {
    /* --- بطاقات المتدربين --- */
    if (UI.el.traineeList) {
      UI.el.traineeList.addEventListener("click", function (e) {
        /* أزرار الإجراءات لها الأولوية */
        var btn = e.target.closest("[data-action]");

        if (btn) {
          var id = btn.dataset.traineeId;
          if (btn.dataset.action === "skills") openSkills(id);
          else if (btn.dataset.action === "certificate") openCertificate(id);
          else if (btn.dataset.action === "edit-trainee") openEditTrainee(id);
          else if (btn.dataset.action === "delete-trainee") requestDeleteTrainee(id);
          return;
        }

        var card = e.target.closest(".trainee-card");
        if (!card) return;

        /* النقر على الصورة أو الاسم → خريطة المسار */
        var isAvatar = e.target.closest(".trainee-avatar");
        var isName = e.target.closest(".trainee-name");

        if (isAvatar || isName) {
          openJourney(card.dataset.traineeId);
          return;
        }

        /* أي نقرة أخرى على البطاقة تحدّدها فقط */
        state.activeTraineeId = card.dataset.traineeId;
        UI.setActiveTrainee(state.activeTraineeId);
      });
    }

    /* --- النقر على متدرب في قائمة الصدارة → خريطة المسار --- */
    var leaderboard = document.getElementById("leaderboard");
    if (leaderboard) {
      leaderboard.addEventListener("click", function (e) {
        var row = e.target.closest("[data-trainee-id]");
        if (row) openJourney(row.dataset.traineeId);
      });
    }

    /* --- النقر المزدوج على بطاقة مشروع "تحت التقييم" → المُقيّم الذكي --- */
    /*
       التفويض على المستند لا على #kanbanBoard، لأن بطاقات
       العرض الشبكي تعيش خارج اللوحة فلا تصلها أحداثها.
    */
    document.addEventListener("click", function (e) {
      var btn = e.target.closest(".task-card [data-action]");
      if (!btn) return;

      var pid = btn.dataset.projectId;
      if (btn.dataset.action === "edit-project") openEditProject(pid);
      else if (btn.dataset.action === "delete-project") requestDeleteProject(pid);
    });

    document.addEventListener("dblclick", function (e) {
      /* أزرار البطاقة لا تفتح المُقيّم */
      if (e.target.closest("[data-action]")) return;

      var card = e.target.closest(".task-card");
      if (!card) return;

      if (card.dataset.status !== UNDER_REVIEW) {
        UI.showToast("المُقيّم الذكي يعمل على المشاريع تحت التقييم فقط.", "info");
        return;
      }

      openAIReview(card.dataset.projectId);
    });

    /* --- أزرار المُقيّم الذكي --- */
    var rerunBtn = document.getElementById("aiRerunBtn");
    if (rerunBtn) {
      rerunBtn.addEventListener("click", function () {
        var project = findProject(state.aiProjectId);
        if (project) runAIAnalysis(project);
      });
    }

    var applyBtn = document.getElementById("aiApplyBtn");
    if (applyBtn) applyBtn.addEventListener("click", applyAIResult);

    /* --- إغلاق النوافذ --- */
    document.addEventListener("click", function (e) {
      var closer = e.target.closest("[data-close]");
      if (!closer) return;

      closeModalById(closer.dataset.close);
    });

    /* النقر على الخلفية الضبابية يغلق النافذة */
    document.querySelectorAll(".modal-overlay").forEach(function (overlay) {
      overlay.addEventListener("click", function (e) {
        if (e.target === overlay) closeModalById(overlay.id);
      });
    });

    /* Escape يغلق النافذة المفتوحة */
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;

      document.querySelectorAll(".modal-overlay").forEach(function (overlay) {
        if (!overlay.hidden) closeModalById(overlay.id);
      });
    });

    /* --- الانتقال من نافذة المهارات إلى الشهادة --- */
    var toCertBtn = document.getElementById("openCertificateFromSkills");
    if (toCertBtn) {
      toCertBtn.addEventListener("click", function () {
        var id = state.activeTraineeId;
        closeSkills();
        if (id) openCertificate(id);
      });
    }

    /* --- طباعة الشهادة --- */
    var printBtn = document.getElementById("printCertificateBtn");
    if (printBtn) {
      printBtn.addEventListener("click", function () { window.print(); });
    }

    /* --- الوضع الداكن --- */
    var themeBtn = document.getElementById("themeToggle");
    if (themeBtn) themeBtn.addEventListener("click", toggleTheme);

    /* --- البحث عن متدرب (القائمة الجانبية) --- */
    var traineeSearch = document.getElementById("searchTrainee");
    if (traineeSearch) {
      traineeSearch.addEventListener("input", function (e) {
        state.traineeSearch = e.target.value;
        UI.renderTrainees(visibleTrainees(), state.projects);
        UI.setActiveTrainee(state.activeTraineeId);
      });
    }

    /* --- الفلترة المتقاطعة الحية: بحث + حالة + مسار --- */
    var projectSearch = document.getElementById("searchProject");
    if (projectSearch) {
      projectSearch.addEventListener("input", function (e) {
        state.searchTerm = e.target.value;
        applyFilters();
      });
    }

    var statusFilter = document.getElementById("filterStatus");
    if (statusFilter) {
      statusFilter.addEventListener("change", function (e) {
        state.statusFilter = e.target.value;
        applyFilters();
      });
    }

    var platformFilter = document.getElementById("filterPlatform");
    if (platformFilter) {
      platformFilter.addEventListener("change", function (e) {
        state.platformFilter = e.target.value;
        applyFilters();
      });
    }

    var resetBtn = document.getElementById("resetFiltersBtn");
    if (resetBtn) resetBtn.addEventListener("click", resetFilters);

    /* --- مبدّل العرض: كانبان / شبكة --- */
    document.querySelectorAll(".view-btn").forEach(function (btn) {
      btn.addEventListener("click", function () { setView(btn.dataset.view); });
    });

    /* --- فلتر المسار --- */
    var trackFilter = document.getElementById("filterTrack");
    if (trackFilter) {
      trackFilter.addEventListener("change", function (e) {
        state.trackFilter = e.target.value;
        applyFilters();
      });
    }

    /* --- إضافة متدرب / مشروع --- */
    var addTraineeBtn = document.getElementById("addTraineeBtn");
    if (addTraineeBtn) addTraineeBtn.addEventListener("click", openAddTrainee);

    var addProjectBtn = document.getElementById("addProjectBtn");
    if (addProjectBtn) addProjectBtn.addEventListener("click", openAddProject);

    /* --- نافذة التأكيد --- */
    var confirmBtn = document.getElementById("confirmAcceptBtn");
    if (confirmBtn) {
      confirmBtn.addEventListener("click", function () { UI.resolveConfirm(true); });
    }

    /* --- نافذة تعديل المهارات --- */
    var skillsSaveBtn = document.getElementById("skillsEditSaveBtn");
    if (skillsSaveBtn) {
      skillsSaveBtn.addEventListener("click", function () { UI.resolveSkillsEdit(true); });
    }

    /* --- إعادة البيانات الافتراضية --- */
    /* --- إعدادات المنصة --- */
    var settingsBtn = document.getElementById("settingsBtn");
    if (settingsBtn) settingsBtn.addEventListener("click", openSettings);

    /* --- تغيير مسار المتدرب يعيد بناء أشرطة مهاراته --- */
    var traineeTrackSelect = document.getElementById("traineeTrack");
    if (traineeTrackSelect) {
      traineeTrackSelect.addEventListener("change", function (e) {
        UI.renderSkillFields(e.target.value);
      });
    }

    var projectTraineeSelect = document.getElementById("projectTrainee");
    if (projectTraineeSelect) {
      projectTraineeSelect.addEventListener("change", function (e) {
        var owner = findTrainee(e.target.value);
        if (owner) UI.setProjectPlatform(owner.platformId);
      });
    }

    /* --- تبويبات الإعدادات --- */
    document.querySelectorAll(".settings-tab").forEach(function (btn) {
      btn.addEventListener("click", function () { UI.setSettingsTab(btn.dataset.tab); });
    });

    /* --- إضافة جهة ومسار --- */
    var platformForm = document.getElementById("addPlatformForm");
    if (platformForm) platformForm.addEventListener("submit", submitAddPlatform);

    var trackForm = document.getElementById("addTrackForm");
    if (trackForm) trackForm.addEventListener("submit", submitAddTrack);

    /* --- حذف جهة أو مسار (تفويض على النافذة) --- */
    var settingsModal = document.getElementById("settingsModal");
    if (settingsModal) {
      settingsModal.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-action]");
        if (!btn || btn.disabled) return;

        if (btn.dataset.action === "delete-platform") requestDeletePlatform(btn.dataset.id);
        else if (btn.dataset.action === "delete-track") requestDeleteTrack(btn.dataset.id);
        else if (btn.dataset.action === "edit-track-skills") editTrackSkills(btn.dataset.id);
      });
    }

    if (UI.el.settingsForm) {
      UI.el.settingsForm.addEventListener("submit", submitSettings);
    }

    var resetBtn = document.getElementById("resetDataBtn");
    if (resetBtn) resetBtn.addEventListener("click", requestResetData);

    /* --- نطاق قائمة الصدارة --- */
    var range = document.getElementById("leaderboardRange");
    if (range) {
      range.addEventListener("change", function (e) {
        state.leaderboardRange = e.target.value;
        state.lastRanking = {};
        refreshLeaderboard();
      });
    }

    /* --- إرسال نماذج الإضافة --- */
    if (UI.el.addTraineeForm) UI.el.addTraineeForm.addEventListener("submit", submitAddTrainee);
    if (UI.el.addProjectForm) UI.el.addProjectForm.addEventListener("submit", submitAddProject);

    /* مزامنة قيم أشرطة المهارات مع مخرجاتها */
    UI.bindRangeOutputs("addTraineeForm");

    /* إخفاء رسالة الخطأ بمجرد أن يبدأ المستخدم بالكتابة */
    document.addEventListener("input", function (e) {
      if (e.target.classList && e.target.classList.contains("is-invalid")) {
        UI.setFieldError(e.target.id, false);
      }
    });

    /* --- تتبّع تفضيل النظام إن لم يختر المستخدم يدوياً --- */
    if (window.matchMedia) {
      window.matchMedia("(prefers-color-scheme: dark)")
        .addEventListener("change", function (e) {
          var saved;
          try { saved = window.localStorage.getItem(THEME_KEY); } catch (err) { saved = null; }
          if (!saved) applyTheme(e.matches ? "dark" : "light", false);
        });
    }
  }

  /* إغلاق نافذة مع التنظيف الخاص بكل نوع */
  /* ------------------------- إعدادات المنصة ------------------------- */

  /** إعادة رسم قائمتَي الجهات والمسارات داخل نافذة الإعدادات */
  function refreshManagers() {
    UI.renderPlatformsManager(state.platforms, state.trainees);
    UI.renderTracksManager(state.tracks, state.trainees, state.projects);
  }

  /* --- إضافة جهة تدريبية --- */

  function submitAddPlatform(e) {
    e.preventDefault();

    var form = e.target;
    var name = form.elements.name.value.trim();

    UI.clearFieldErrors("addPlatformForm");

    if (!name) {
      UI.setFieldError("platformNameField", true);
      form.elements.name.focus();
      return;
    }

    UI.setFormBusy("addPlatformForm", true);

    DataService.addPlatform({
      name: name,
      shortName: form.elements.shortName.value.trim(),
      color: form.elements.color.value
    })
      .then(function (platform) {
        state.platforms.push(platform);

        UI.resetManagerForm("addPlatformForm");
        UI.fillPlatformSelects(state.platforms);
        refreshManagers();
        UI.showToast('تمت إضافة "' + platform.name + '"', "success");
      })
      .catch(function (err) {
        UI.showToast("تعذّرت الإضافة: " + err.message, "danger");
      })
      .then(function () {
        UI.setFormBusy("addPlatformForm", false);
      });
  }

  /* --- إضافة مسار تدريبي --- */

  /**
   * تحويل نص المهارات إلى قائمة.
   * يقبل الفاصلة العربية والإنجليزية والسطر الجديد، ويتجاهل الفارغ والمكرر.
   * @param {string} text
   * @returns {string[]}
   */
  function parseSkillList(text) {
    var out = [];

    String(text || "")
      .split(/[,،\n]/)
      .forEach(function (part) {
        var name = part.trim();
        if (name && out.indexOf(name) === -1) out.push(name);
      });

    return out;
  }

  /**
   * تعديل مهارات مسار قائم.
   * تغيير المهارات لا يمسّ من سُجّلت مهاراتهم سابقاً — بياناتهم محفوظة
   * باسم المهارة، فيُنبَّه المستخدم قبل التغيير حين يتبع المسارَ متدربون.
   * @param {string} trackId
   */
  function editTrackSkills(trackId) {
    var track = state.tracks.filter(function (t) {
      return t.id === trackId;
    })[0];

    if (!track) return;

    UI.editSkillsPrompt({ trackLabel: track.label, skills: track.skills || [] })
      .then(function (answer) {
        /* الإلغاء يعيد null — لا تغيير */
        if (answer === null) return null;

        var skills = parseSkillList(answer);

        if (skills.length) return skills;

        /* الحفظ بلا مهارات يضع المجموعة العامة — يستحق تأكيداً */
        return UI.confirmAction({
          message: "لم تُدخل أي مهارة.",
          detail: "سيضع النظام مهارات عامة لهذا المسار. أتريد المتابعة؟",
          label: "نعم، ضع مهارات عامة",
          icon: "fa-sliders"
        }).then(function (ok) {
          return ok ? [] : null;
        });
      })
      .then(function (skills) {
        if (skills === null) return null;
        return saveTrackSkills(track, skills);
      })
      .catch(function (err) {
        UI.showToast("تعذّر تحديث المهارات: " + err.message, "danger");
      });
  }

  /**
   * حفظ مهارات المسار وتحديث كل ما يعتمد عليها.
   * @param {Object} track - سجل المسار في الحالة
   * @param {string[]} skills
   */
  function saveTrackSkills(track, skills) {
    return DataService.setTrackSkills(track.id, skills)
      .then(function (updated) {
        track.skills = updated.skills || [];

        /* يحدّث مخزن المهارات حتى تُبنى المزالج من القائمة الجديدة فوراً */
        UI.fillTrackSelects(state.tracks);
        refreshManagers();

        UI.showToast(
          'حُدّثت مهارات "' + track.label + '" إلى ' + track.skills.length + ' مهارات',
          "success"
        );
      })
      .catch(function (err) {
        UI.showToast("تعذّر تحديث المهارات: " + err.message, "danger");
      });
  }

  function submitAddTrack(e) {
    e.preventDefault();

    var form = e.target;
    var label = form.elements.label.value.trim();

    UI.clearFieldErrors("addTrackForm");

    if (!label) {
      UI.setFieldError("trackLabelField", true);
      form.elements.label.focus();
      return;
    }

    UI.setFormBusy("addTrackForm", true);

    DataService.addTrack({
      label: label,
      id: form.elements.id.value.trim(),
      color: form.elements.color.value,
      skills: parseSkillList(form.elements.skills ? form.elements.skills.value : "")
    })
      .then(function (track) {
        state.tracks.push(track);

        UI.resetManagerForm("addTrackForm");
        /* fillTrackSelects يحدّث التسميات ومخزن المهارات معاً */
        UI.fillTrackSelects(state.tracks);
        refreshManagers();
        renderAll();

        UI.showToast(
          'تمت إضافة مسار "' + track.label + '" بـ ' +
          (track.skills || []).length + ' مهارات',
          "success"
        );
      })
      .catch(function (err) {
        UI.showToast("تعذّرت الإضافة: " + err.message, "danger");
      })
      .then(function () {
        UI.setFormBusy("addTrackForm", false);
      });
  }

  /* --- حذف جهة أو مسار --- */

  function requestDeletePlatform(id) {
    var platform = state.platforms.filter(function (p) { return p.id === id; })[0];
    if (!platform) return;

    UI.confirmAction({
      message: 'حذف الجهة "' + platform.name + '"؟',
      detail: "لا يمكن التراجع عن هذا الإجراء.",
      label: "نعم، احذف"
    }).then(function (ok) {
      if (!ok) return;

      return DataService.deletePlatform(id)
        .then(function () {
          state.platforms = state.platforms.filter(function (p) { return p.id !== id; });

          UI.fillPlatformSelects(state.platforms);
          refreshManagers();
          UI.showToast("تم حذف الجهة", "warning");
        })
        .catch(function (err) {
          UI.showToast(err.message, "danger");
        });
    });
  }

  function requestDeleteTrack(id) {
    var track = state.tracks.filter(function (t) { return t.id === id; })[0];
    if (!track) return;

    UI.confirmAction({
      message: 'حذف المسار "' + track.label + '"؟',
      detail: "لا يمكن التراجع عن هذا الإجراء.",
      label: "نعم، احذف"
    }).then(function (ok) {
      if (!ok) return;

      return DataService.deleteTrack(id)
        .then(function () {
          state.tracks = state.tracks.filter(function (t) { return t.id !== id; });

          UI.fillTrackSelects(state.tracks);
          refreshManagers();
          UI.showToast("تم حذف المسار", "warning");
        })
        .catch(function (err) {
          UI.showToast(err.message, "danger");
        });
    });
  }

  function openSettings() {
    UI.fillSettingsForm(state.settings);
    refreshManagers();
    UI.setSettingsTab("platforms");
    UI.openModal("settingsModal");

    UI.afterPaint(function () {
      var field = document.querySelector("#addPlatformForm input[name=name]");
      if (field) field.focus();
    });
  }

  function submitSettings(e) {
    e.preventDefault();

    var data = UI.readSettingsForm();
    if (!data) return;

    UI.clearFieldErrors("settingsForm");

    if (!data.platform_name) {
      UI.setFieldError("platformName", true);
      document.getElementById("platformName").focus();
      return;
    }

    UI.setFormBusy("settingsForm", true);

    DataService.updateSettings(data)
      .then(function (saved) {
        state.settings = saved;
        UI.closeModal("settingsModal");
        UI.showToast("تم حفظ إعدادات المنصة", "success");
      })
      .catch(function (err) {
        UI.showToast("تعذّر حفظ الإعدادات: " + err.message, "danger");
      })
      .then(function () {
        UI.setFormBusy("settingsForm", false);
      });
  }

  function closeModalById(id) {
    if (id === "skillsModal") closeSkills();
    else if (id === "aiReviewModal") closeAIReview();
    else if (id === "confirmModal") UI.resolveConfirm(false);
    else if (id === "skillsEditModal") UI.resolveSkillsEdit(false);
    else if (id === "addTraineeModal") {
      state.editingTraineeId = null;
      UI.closeFormModal(id, "addTraineeForm");
    } else if (id === "addProjectModal") {
      state.editingProjectId = null;
      UI.closeFormModal(id, "addProjectForm");
    } else UI.closeModal(id);
  }

  /* ------------------------- 12. نماذج الإضافة ------------------------- */

  /* --- إضافة / تعديل متدرب --- */

  function openAddTrainee() {
    state.editingTraineeId = null;
    UI.setFormMode("trainee", "add");
    UI.openFormModal("addTraineeModal", "addTraineeForm", "traineeName");

    /* المهارات تتبع المسار المختار */
    var trackSelect = document.getElementById("traineeTrack");
    UI.renderSkillFields(trackSelect ? trackSelect.value : "");
  }

  function openEditTrainee(traineeId) {
    var trainee = findTrainee(traineeId);
    if (!trainee) return;

    state.editingTraineeId = traineeId;
    UI.setFormMode("trainee", "edit");
    UI.openFormModal("addTraineeModal", "addTraineeForm", "traineeName");

    /* التعبئة بعد openFormModal لأنها تبدأ بتفريغ النموذج */
    UI.fillTraineeForm(trainee);
  }

  function submitAddTrainee(e) {
    e.preventDefault();

    var data = UI.readTraineeForm();
    if (!data) return;

    /* تحقّق من الحقول المطلوبة قبل نداء طبقة البيانات */
    UI.clearFieldErrors("addTraineeForm");

    if (!data.name) {
      UI.setFieldError("traineeName", true);
      document.getElementById("traineeName").focus();
      return;
    }

    var editingId = state.editingTraineeId;
    UI.setFormBusy("addTraineeForm", true);

    var request = editingId
      ? DataService.updateTrainee(editingId, data)
      : DataService.addTrainee(data);

    request
      .then(function (trainee) {
        if (editingId) {
          /* استبدال السجل المحلي مع الحفاظ على الشارات المحسوبة */
          var local = findTrainee(editingId);
          if (local) {
            Object.keys(trainee).forEach(function (key) {
              local[key] = trainee[key];
            });
          }
          UI.showToast("تم تحديث بيانات " + trainee.name, "success");
        } else {
          state.trainees.push(trainee);
          UI.showToast("تمت إضافة " + trainee.name + " بنجاح", "success");
        }

        UI.closeFormModal("addTraineeModal", "addTraineeForm");
        state.editingTraineeId = null;

        /* القائمة المنسدلة في نموذج المشروع تعكس التغيير فوراً */
        UI.fillTraineeSelect(state.trainees, trainee.id);

        renderAll();
        return refreshStats();
      })
      .catch(function (err) {
        UI.showToast("تعذّر حفظ بيانات المتدرب: " + err.message, "danger");
      })
      .then(function () {
        UI.setFormBusy("addTraineeForm", false);
      });
  }

  /* --- حذف متدرب --- */

  function requestDeleteTrainee(traineeId) {
    var trainee = findTrainee(traineeId);
    if (!trainee) return;

    var count = projectsOf(traineeId).length;

    var detail = count
      ? "سيُحذف معه " + count + " مشروع حذفاً نهائياً."
      : "لا توجد مشاريع مرتبطة به.";

    UI.confirmAction({
      message: 'حذف المتدرب "' + trainee.name + '"؟',
      detail: detail + " لا يمكن التراجع عن هذا الإجراء.",
      label: "نعم، احذف"
    }).then(function (accepted) {
      if (!accepted) return;

      return DataService.deleteTrainee(traineeId)
        .then(function (result) {
          /* تنظيف الحالة المحلية */
          state.trainees = state.trainees.filter(function (t) {
            return t.id !== traineeId;
          });
          state.projects = state.projects.filter(function (p) {
            return p.traineeId !== traineeId;
          });

          if (state.activeTraineeId === traineeId) state.activeTraineeId = null;
          delete state.lastRanking[traineeId];

          UI.fillTraineeSelect(state.trainees);
          UI.showToast(
            "تم حذف " + result.trainee.name +
            (result.removedProjects.length
              ? " و" + result.removedProjects.length + " من مشاريعه" : ""),
            "warning"
          );

          renderAll();
          return refreshStats();
        })
        .catch(function (err) {
          UI.showToast("تعذّر الحذف: " + err.message, "danger");
        });
    });
  }

  /* --- إضافة / تعديل مشروع --- */

  function openAddProject() {
    if (!state.trainees.length) {
      UI.showToast("أضف متدرباً أولاً قبل إنشاء مشروع.", "warning");
      openAddTrainee();
      return;
    }

    state.editingProjectId = null;
    UI.setFormMode("project", "add");
    UI.openFormModal("addProjectModal", "addProjectForm", "projectTitle");

    /* reset يمسح الاختيار، فنعيد بناء القائمة بعده */
    UI.fillTraineeSelect(state.trainees, state.activeTraineeId);
  }

  function openEditProject(projectId) {
    var project = findProject(projectId);
    if (!project) return;

    state.editingProjectId = projectId;
    UI.setFormMode("project", "edit");
    UI.openFormModal("addProjectModal", "addProjectForm", "projectTitle");
    UI.fillProjectForm(project, state.trainees);
  }

  function submitAddProject(e) {
    e.preventDefault();

    var data = UI.readProjectForm();
    if (!data) return;

    UI.clearFieldErrors("addProjectForm");

    var invalid = false;

    if (!data.title) {
      UI.setFieldError("projectTitle", true);
      invalid = true;
    }

    if (!data.traineeId) {
      UI.setFieldError("projectTrainee", true);
      invalid = true;
    }

    if (invalid) {
      var firstInvalid = document.querySelector("#addProjectForm .is-invalid");
      if (firstInvalid) firstInvalid.focus();
      return;
    }

    var owner = findTrainee(data.traineeId);
    data.track = owner ? owner.track : "web";

    var editingId = state.editingProjectId;
    UI.setFormBusy("addProjectForm", true);

    var request = editingId
      ? DataService.updateProject(editingId, data)
      : DataService.addProject(data);

    request
      .then(function (project) {
        var wasApproved = false;

        if (editingId) {
          var local = findProject(editingId);
          wasApproved = local && local.status === APPROVED;

          if (local) {
            Object.keys(project).forEach(function (key) {
              local[key] = project[key];
            });
          }

          UI.showToast('تم تحديث "' + project.title + '"', "success");
        } else {
          state.projects.push(project);
          UI.showToast(
            'تمت إضافة "' + project.title + '" إلى عمود ' +
            DataService.STATUS_LABELS[project.status],
            "success"
          );
        }

        UI.closeFormModal("addProjectModal", "addProjectForm");
        state.editingProjectId = null;

        /* أصبح مُجازاً الآن ولم يكن كذلك → احتفال وشارات */
        if (project.status === APPROVED && !wasApproved) {
          fireConfetti(0.7);
          awardBadges(project.traineeId);
        }

        renderAll();
        return refreshStats();
      })
      .catch(function (err) {
        UI.showToast("تعذّر حفظ المشروع: " + err.message, "danger");
      })
      .then(function () {
        UI.setFormBusy("addProjectForm", false);
      });
  }

  /* --- حذف مشروع --- */

  function requestDeleteProject(projectId) {
    var project = findProject(projectId);
    if (!project) return;

    UI.confirmAction({
      message: 'حذف المشروع "' + project.title + '"؟',
      detail: "سيُحذف نهائياً ولا يمكن التراجع عن هذا الإجراء.",
      label: "نعم، احذف"
    }).then(function (accepted) {
      if (!accepted) return;

      return DataService.deleteProject(projectId)
        .then(function (removed) {
          state.projects = state.projects.filter(function (p) {
            return p.id !== projectId;
          });

          UI.showToast('تم حذف "' + removed.title + '"', "warning");

          renderAll();
          return refreshStats();
        })
        .catch(function (err) {
          UI.showToast("تعذّر الحذف: " + err.message, "danger");
        });
    });
  }

  /* --- إعادة البيانات الافتراضية --- */

  function requestResetData() {
    UI.confirmAction({
      message: "إعادة البيانات الافتراضية؟",
      detail: "سيُمسح كل ما أضفته من متدربين ومشاريع وشارات، وتعود المنصة إلى بياناتها الأصلية.",
      label: "نعم، أعد الضبط",
      icon: "fa-rotate-left"
    }).then(function (accepted) {
      if (!accepted) return;

      return DataService.resetData()
        .then(function () {
          return Promise.all([
            DataService.getTrainees(),
            DataService.getProjects()
          ]);
        })
        .then(function (results) {
          state.trainees = results[0];
          state.projects = results[1];
          state.activeTraineeId = null;
          state.lastRanking = {};

          syncAllBadges();
          UI.fillTraineeSelect(state.trainees);
          UI.showToast("تمت إعادة البيانات الافتراضية", "info");

          renderAll();
          return refreshStats();
        })
        .catch(function (err) {
          UI.showToast("تعذّرت إعادة الضبط: " + err.message, "danger");
        });
    });
  }

  /* ------------------------- 13. التهيئة ------------------------- */

  function init() {
    initTheme();
    bindEvents();

    Promise.all([
      DataService.getTrainees(),
      DataService.getProjects(),
      /* الإعدادات ليست حرجة: فشلها لا يمنع تحميل اللوحة */
      DataService.getSettings().catch(function () { return {}; }),
      DataService.getPlatforms().catch(function () { return []; }),
      DataService.getTracks().catch(function () { return []; })
    ])
      .then(function (results) {
        state.trainees = results[0];
        state.projects = results[1];
        state.settings = results[2] || {};
        state.platforms = results[3] || [];
        state.tracks = results[4] || [];

        UI.fillPlatformSelects(state.platforms);
        UI.fillTrackSelects(state.tracks);

        /* الشارات المستحقة تُمنح بصمت عند التحميل حتى لا تنهمر التنبيهات */
        syncAllBadges();

        UI.fillTraineeSelect(state.trainees);

        renderAll();
        return refreshStats();
      })
      .then(function () {
        UI.showToast("تم تحميل بيانات المعسكر بنجاح", "success");
      })
      .catch(function (err) {
        UI.showToast("تعذّر تحميل البيانات: " + err.message, "danger");
        console.error("[TBM] init failed:", err);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
