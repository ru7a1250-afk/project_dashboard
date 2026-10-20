/* ===================================================================
   dataService.js — طبقة البيانات (Model) عبر MySQL

   تستبدل هذه النسخة تخزين LocalStorage باستدعاءات HTTP إلى
   api/api.php الذي يقرأ ويكتب في قاعدة بيانات MySQL.

   واجهة الوحدة لم تتغيّر: نفس أسماء الدوال ونفس الوعود (Promises)،
   فلا يحتاج ui.js ولا app.js أي تعديل.

   النسخة السابقة محفوظة في js/dataService.local.js
   =================================================================== */

var DataService = (function () {
  "use strict";

  /* ===================================================================
     1. الإعدادات والثوابت
     =================================================================== */

  /* المسار نسبي، فيعمل أياً كان اسم مجلد المشروع */
  var API = "api/api.php";

  /* مهلة الطلب — يمنع تعليق الواجهة إن توقّف الخادم */
  var TIMEOUT_MS = 10000;

  var STATUSES = {
    APPROVED:       "approved",
    UNDER_REVIEW:   "under_review",
    NEEDS_REVISION: "needs_revision"
  };

  var STATUS_LABELS = {
    approved:       "مُجاز",
    under_review:   "تحت التقييم",
    needs_revision: "يحتاج تعديل"
  };

  var TRACKS = {
    UI_UX:     "UI_UX",
    FULLSTACK: "FullStack",
    FRONTEND:  "FrontEnd"
  };

  var TRACK_LABELS = {
    UI_UX:     "تصميم تجربة المستخدم",
    FullStack: "تطوير متكامل",
    FrontEnd:  "واجهات أمامية"
  };

  var STATUS_TO_DOM = {
    approved:       "approved",
    under_review:   "review",
    needs_revision: "rework"
  };

  /* المفردات القديمة تبقى مقبولة في أي مدخل */
  var STATUS_FROM_LEGACY = {
    approved:       "approved",
    review:         "under_review",
    rework:         "needs_revision",
    under_review:   "under_review",
    needs_revision: "needs_revision"
  };

  var TRACK_FROM_LEGACY = {
    web:       "FrontEnd",
    mobile:    "FullStack",
    data:      "FullStack",
    UI_UX:     "UI_UX",
    FullStack: "FullStack",
    FrontEnd:  "FrontEnd"
  };

  /* ===================================================================
     2. طبقة الاتصال
     =================================================================== */

  /**
   * نداء الـ API وإرجاع الحمولة، أو رمي خطأ برسالة عربية.
   *
   * @param {string} action - اسم الإجراء
   * @param {Object} [payload] - جسم الطلب (يُرسل POST حين يوجد)
   * @param {Object} [query] - معاملات إضافية في الرابط
   * @returns {Promise<*>}
   */
  function call(action, payload, query) {
    var url = API + "?action=" + encodeURIComponent(action);

    if (query) {
      Object.keys(query).forEach(function (key) {
        url += "&" + encodeURIComponent(key) + "=" + encodeURIComponent(query[key]);
      });
    }

    var options = { method: payload ? "POST" : "GET" };

    if (payload) {
      options.headers = { "Content-Type": "application/json; charset=utf-8" };
      options.body = JSON.stringify(payload);
    }

    /* إلغاء الطلب عند تجاوز المهلة */
    var controller = null;
    var timer = null;

    if (typeof AbortController !== "undefined") {
      controller = new AbortController();
      options.signal = controller.signal;
      timer = setTimeout(function () { controller.abort(); }, TIMEOUT_MS);
    }

    return fetch(url, options)
      .then(function (response) {
        if (timer) clearTimeout(timer);

        return response.text().then(function (text) {
          var json;

          try {
            json = JSON.parse(text);
          } catch (err) {
            /* خطأ PHP يصل نصاً لا JSON — نعرض أوله ليسهل التشخيص */
            throw new Error(
              "رد غير متوقّع من الخادم: " + text.slice(0, 160)
            );
          }

          if (!json || json.ok !== true) {
            throw new Error((json && json.error) || "فشل الطلب");
          }

          return json.data;
        });
      })
      .catch(function (err) {
        if (timer) clearTimeout(timer);

        if (err.name === "AbortError") {
          throw new Error("انتهت مهلة الاتصال بالخادم");
        }

        /* فشل الشبكة نفسه: الخادم متوقف أو المسار خاطئ */
        if (err instanceof TypeError) {
          throw new Error(
            "تعذّر الوصول إلى الخادم — تأكد من تشغيل Apache في XAMPP"
          );
        }

        throw err;
      });
  }

  /* ===================================================================
     3. أدوات
     =================================================================== */

  function normalizeStatus(status) {
    var key = String(status || "").trim();
    return STATUS_FROM_LEGACY[key] || null;
  }

  function normalizeTrack(track) {
    var key = String(track || "").trim();
    return TRACK_FROM_LEGACY[key] || null;
  }

  /* ===================================================================
     4. المشاريع
     =================================================================== */

  /**
   * جلب المشاريع مع تصفية اختيارية.
   * التصفية تجري هنا لا في الخادم: البيانات صغيرة والفلترة الحية
   * في الواجهة تحتاجها فورية بلا انتظار الشبكة.
   *
   * @param {Object} [filters] - { status, track, traineeId, traineeName, search }
   * @returns {Promise<Array>}
   */
  function getProjects(filters) {
    return call("getProjects").then(function (list) {
      var f = filters || {};

      if (f.status && f.status !== "all") {
        var status = normalizeStatus(f.status);
        list = list.filter(function (p) { return p.status === status; });
      }

      if (f.track && f.track !== "all") {
        var track = normalizeTrack(f.track);
        list = list.filter(function (p) { return p.track === track; });
      }

      if (f.platformId && f.platformId !== "all") {
        list = list.filter(function (p) { return p.platformId === f.platformId; });
      }

      if (f.traineeId) {
        list = list.filter(function (p) { return p.traineeId === f.traineeId; });
      }

      if (f.traineeName) {
        list = list.filter(function (p) { return p.traineeName === f.traineeName; });
      }

      if (f.search) {
        var term = String(f.search).trim();

        if (term) {
          list = list.filter(function (p) {
            return p.projectName.indexOf(term) !== -1 ||
                   String(p.description).indexOf(term) !== -1 ||
                   String(p.traineeName).indexOf(term) !== -1;
          });
        }
      }

      return list;
    });
  }

  /** إضافة مشروع جديد. */
  function addProject(projectData) {
    return call("addProject", projectData || {});
  }

  /** تحديث حالة مشروع — تُستدعى بعد السحب والإفلات. */
  function updateProjectStatus(projectId, newStatus) {
    return call("updateProjectStatus", {
      projectId: projectId,
      status: newStatus
    });
  }

  /** تعديل بيانات مشروع. */
  function updateProject(projectId, changes) {
    return call("updateProject", {
      projectId: projectId,
      changes: changes || {}
    });
  }

  /** حذف مشروع نهائياً. */
  function deleteProject(projectId) {
    return call("deleteProject", { projectId: projectId });
  }

  /* ===================================================================
     5. الإحصائيات
     =================================================================== */

  function getStats() {
    return call("getStats");
  }

  /* ===================================================================
     6. المتدربون
     =================================================================== */

  function getTrainees() {
    return call("getTrainees");
  }

  function getTraineeById(traineeId) {
    return call("getTraineeById", null, { id: traineeId });
  }

  function addTrainee(traineeData) {
    return call("addTrainee", traineeData || {});
  }

  function updateTrainee(traineeId, changes) {
    return call("updateTrainee", {
      traineeId: traineeId,
      changes: changes || {}
    });
  }

  /** حذف متدرب مع كل مشاريعه (حذف متسلسل في قاعدة البيانات). */
  function deleteTrainee(traineeId) {
    return call("deleteTrainee", { traineeId: traineeId });
  }

  function certifyTrainee(traineeId) {
    return call("certifyTrainee", { traineeId: traineeId });
  }

  /* ===================================================================
     7. الشارات
     =================================================================== */

  function updateTraineeBadges(traineeId, badgesArray) {
    return call("updateTraineeBadges", {
      traineeId: traineeId,
      badges: Array.isArray(badgesArray) ? badgesArray : []
    });
  }

  /** إضافة شارة واحدة — تُقرأ القائمة ثم تُحفظ بعد الإضافة. */
  function addTraineeBadge(traineeId, badge) {
    if (!badge || !badge.id) {
      return Promise.reject(new Error("بيانات الشارة غير صالحة"));
    }

    return getTraineeById(traineeId).then(function (trainee) {
      if (!trainee) {
        throw new Error("المتدرب غير موجود: " + traineeId);
      }

      var current = Array.isArray(trainee.badges) ? trainee.badges : [];
      var exists = current.some(function (b) { return b.id === badge.id; });

      if (exists) return trainee;

      return updateTraineeBadges(traineeId, current.concat([badge]));
    });
  }

  /* ===================================================================
     8. أدوات عامة
     =================================================================== */

  /** إعادة بناء الجداول وبياناتها الافتراضية. */
  function resetData() {
    return call("resetData", {});
  }

  /* ===================================================================
     المسارات التدريبية
     =================================================================== */

  /** جلب كل المسارات التدريبية. */
  function getTracks() {
    return call("getTracks");
  }

  /** إضافة مسار جديد. */
  function addTrack(track) {
    return call("addTrack", track || {});
  }

  /** حذف مسار — يفشل إن كان يتبعه متدربون أو مشاريع. */
  function deleteTrack(trackId) {
    return call("deleteTrack", { trackId: trackId });
  }

  /**
   * ضبط مهارات مسار قائم — تُستبدل القائمة بالكامل.
   * @param {string} trackId
   * @param {string[]} skills أسماء المهارات بالترتيب المطلوب
   */
  function setTrackSkills(trackId, skills) {
    return call("setTrackSkills", { trackId: trackId, skills: skills || [] });
  }

  /* ===================================================================
     الجهات التدريبية
     =================================================================== */

  /** جلب كل الجهات التدريبية. */
  function getPlatforms() {
    return call("getPlatforms");
  }

  /** إضافة جهة تدريبية جديدة. */
  function addPlatform(platform) {
    return call("addPlatform", platform || {});
  }

  /** حذف جهة — تفشل إن كان يتبعها متدربون. */
  function deletePlatform(platformId) {
    return call("deletePlatform", { platformId: platformId });
  }

  /** جلب إعدادات المنصة. */
  function getSettings() {
    return call("getSettings");
  }

  /** حفظ إعدادات المنصة. */
  function updateSettings(settings) {
    return call("updateSettings", { settings: settings || {} });
  }

  /** فحص الاتصال بالخادم وقاعدة البيانات. */
  function ping() {
    return call("ping");
  }

  /* ===================================================================
     9. التصدير
     =================================================================== */

  return {
    /* الثوابت */
    STATUSES: STATUSES,
    STATUS_LABELS: STATUS_LABELS,
    STATUS_TO_DOM: STATUS_TO_DOM,
    TRACKS: TRACKS,
    TRACK_LABELS: TRACK_LABELS,

    /* المشاريع */
    getProjects: getProjects,
    addProject: addProject,
    updateProjectStatus: updateProjectStatus,
    updateProject: updateProject,
    deleteProject: deleteProject,

    /* الإحصائيات */
    getStats: getStats,

    /* المتدربون */
    getTrainees: getTrainees,
    getTraineeById: getTraineeById,
    addTrainee: addTrainee,
    updateTrainee: updateTrainee,
    deleteTrainee: deleteTrainee,
    certifyTrainee: certifyTrainee,

    /* الشارات */
    updateTraineeBadges: updateTraineeBadges,
    addTraineeBadge: addTraineeBadge,

    /* أدوات */
    getTracks: getTracks,
    addTrack: addTrack,
    deleteTrack: deleteTrack,
    setTrackSkills: setTrackSkills,
    getPlatforms: getPlatforms,
    addPlatform: addPlatform,
    deletePlatform: deletePlatform,
    getSettings: getSettings,
    updateSettings: updateSettings,
    resetData: resetData,
    ping: ping,
    normalizeStatus: normalizeStatus,
    normalizeTrack: normalizeTrack
  };
})();
