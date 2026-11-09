/* ===================================================================
   dataService.demo.js — طبقة بيانات للعرض التجريبي (GitHub Pages)

   GitHub Pages تستضيف ملفات ثابتة فقط: لا PHP ولا MySQL. هذا الملف
   يوفّر الواجهة نفسها التي يوفّرها js/dataService.js، لكنه يحفظ في
   LocalStorage داخل متصفح الزائر بدل الخادم.

   ui.js و app.js لا يتغيّران بحرف واحد — وهذا هو المقصود من فصل
   الطبقات: مصدر البيانات قابل للاستبدال.

   البيانات هنا تجريبية بالكامل ولا تمثّل أشخاصاً حقيقيين.
   =================================================================== */

var DataService = (function () {
  "use strict";

  var STORE_KEY = "tbm_demo_db";

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

  var STATUS_TO_DOM = {
    approved:       "approved",
    under_review:   "under_review",
    needs_revision: "needs_revision"
  };

  var STATUS_FROM_LEGACY = {
    approved: "approved", review: "under_review", rework: "needs_revision",
    under_review: "under_review", needs_revision: "needs_revision"
  };

  var TRACKS = { UI_UX: "UI_UX", FULLSTACK: "FullStack", FRONTEND: "FrontEnd" };

  var TRACK_LABELS = {
    UI_UX: "تصميم تجربة المستخدم",
    FullStack: "تطوير متكامل",
    FrontEnd: "واجهات أمامية"
  };

  /* ------------------------- البيانات الأوّلية ------------------------- */

  /* البيانات الأوّلية من demo-seed.js المُولَّد من قاعدة البيانات */
  function seed() {
    return JSON.parse(JSON.stringify(DEMO_SEED));
  }

  function mkTrainee(id, name, track, trackLabel, cohortId, platformId, skills, certified, certifiedAt) {
    return {
      id: id, name: name, track: track, trackLabel: trackLabel,
      bootcamp: "", cohortId: cohortId, cohortName: "", platformId: platformId,
      platformName: "", platformShort: "", platformColor: "",
      avatar: "https://ui-avatars.com/api/?background=4f46e5&color=fff&bold=true&name=" +
              encodeURIComponent(name.slice(0, 12)),
      joinedAt: "2026-01-15",
      certified: !!certified, certifiedAt: certifiedAt,
      certificateSerial: certified ? "TBM-2026-" + id.toUpperCase() : null,
      skills: skills, badges: []
    };
  }

  function mkProject(id, projectName, traineeId, status, track, progress, dueDate,
                     description, score, feedback, platformId) {
    return {
      id: id, projectName: projectName, title: projectName,
      traineeId: traineeId, traineeName: "",
      status: status, track: track, trackLabel: "",
      progress: progress, dueDate: dueDate, description: description,
      feedback: feedback || "", score: score,
      createdAt: "2026-02-01", updatedAt: "2026-02-01",
      platformId: platformId, platformName: "", platformShort: "", platformColor: ""
    };
  }

  /* تواريخ نسبية حتى يبقى العرض ذا معنى مهما مرّ الوقت على النسخة */
  function shiftDate(days) {
    var d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function today() { return shiftDate(0); }

  /* ------------------------- التخزين ------------------------- */

  var db = null;

  function load() {
    if (db) return db;

    try {
      var raw = window.localStorage.getItem(STORE_KEY);
      if (raw) db = JSON.parse(raw);
    } catch (e) { /* تخزين معطّل أو بيانات تالفة */ }

    if (!db || !db.projects) db = seed();

    return db;
  }

  function save() {
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(db));
    } catch (e) { /* التخزين ممتلئ أو محجوب — الجلسة تكمل في الذاكرة */ }
  }

  /* كل العمليات تُرجع وعداً حتى تطابق سلوك الخادم تماماً */
  function ok(value) {
    return Promise.resolve(clone(value));
  }

  function err(message) {
    return Promise.reject(new Error(message));
  }

  function clone(v) {
    return v === undefined ? v : JSON.parse(JSON.stringify(v));
  }

  function byId(list, id) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  function nextId(kind, prefix) {
    load();
    db.seq[kind] = (db.seq[kind] || 0) + 1;
    return prefix + db.seq[kind];
  }

  /* ------------------------- الإثراء ------------------------- */

  /* الخادم يُرجع حقولاً مشتقّة (اسم الجهة، تسمية المسار...) فنبنيها هنا */
  function platformOf(id) { return byId(load().platforms, id); }

  function enrichTrainee(t) {
    var pf = platformOf(t.platformId);
    var co = byId(load().cohorts, t.cohortId);
    var tr = byId(load().tracks, t.track);

    t.platformName  = pf ? pf.name : "";
    t.platformShort = pf ? pf.shortName : "";
    t.platformColor = pf ? pf.color : "";
    t.cohortName    = co ? co.name : "";
    t.bootcamp      = co ? co.name : t.bootcamp;
    t.trackLabel    = t.trackLabel || (tr ? tr.label : t.track);

    return t;
  }

  function enrichProject(p) {
    var pf = platformOf(p.platformId);
    var tr = byId(load().tracks, p.track);
    var owner = byId(load().trainees, p.traineeId);

    p.title         = p.projectName;
    p.traineeName   = owner ? owner.name : "";
    p.trackLabel    = tr ? tr.label : p.track;
    p.platformName  = pf ? pf.name : "";
    p.platformShort = pf ? pf.shortName : "";
    p.platformColor = pf ? pf.color : "";

    return p;
  }

  function normalizeStatus(status) {
    return STATUS_FROM_LEGACY[String(status || "").trim()] || null;
  }

  function normalizeTrack(track) {
    var key = String(track || "").trim();
    return byId(load().tracks, key) ? key : key;
  }

  function clampPercent(v, fallback) {
    var n = Number(v);
    if (isNaN(n)) return fallback;
    return Math.max(0, Math.min(100, Math.round(n)));
  }

  /* ------------------------- المشاريع ------------------------- */

  function getProjects(filters) {
    var list = load().projects.map(function (p) { return enrichProject(clone(p)); });
    var f = filters || {};

    if (f.status && f.status !== "all") {
      var status = normalizeStatus(f.status);
      list = list.filter(function (p) { return p.status === status; });
    }

    if (f.track && f.track !== "all") {
      list = list.filter(function (p) { return p.track === f.track; });
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

    return Promise.resolve(list);
  }

  function addProject(data) {
    load();

    var d = data || {};
    var title = String(d.title || d.projectName || "").trim();

    if (!title) return err("اسم المشروع مطلوب");

    var owner = byId(db.trainees, d.traineeId);
    var status = normalizeStatus(d.status) || STATUSES.UNDER_REVIEW;

    var p = mkProject(
      nextId("project", "p_"), title, d.traineeId, status,
      d.track || (owner ? owner.track : "FrontEnd"),
      clampPercent(d.progress, status === STATUSES.APPROVED ? 100 : 0),
      d.dueDate || null,
      String(d.description || "").trim() || "مشروع جديد بانتظار التقييم.",
      d.score === undefined || d.score === null ? null : clampPercent(d.score, null),
      String(d.feedback || ""),
      d.platformId || (owner ? owner.platformId : null)
    );

    p.createdAt = today();
    p.updatedAt = today();

    db.projects.push(p);
    save();

    return ok(enrichProject(clone(p)));
  }

  function updateProjectStatus(projectId, newStatus) {
    return updateProject(projectId, { status: newStatus });
  }

  function updateProject(projectId, changes) {
    load();

    var p = byId(db.projects, projectId);
    if (!p) return err("المشروع غير موجود: " + projectId);

    var c = changes || {};

    if (c.title !== undefined || c.projectName !== undefined) {
      p.projectName = String(c.title || c.projectName).trim() || p.projectName;
    }

    if (c.status !== undefined) {
      var s = normalizeStatus(c.status);
      if (!s) return err("حالة غير صالحة: " + c.status);
      p.status = s;
      if (s === STATUSES.APPROVED && p.progress < 100) p.progress = 100;
    }

    if (c.traineeId !== undefined)   p.traineeId = c.traineeId;
    if (c.track !== undefined)       p.track = c.track;
    if (c.progress !== undefined)    p.progress = clampPercent(c.progress, p.progress);
    if (c.description !== undefined) p.description = String(c.description);
    if (c.feedback !== undefined)    p.feedback = String(c.feedback);
    if (c.platformId !== undefined)  p.platformId = c.platformId || null;
    if (c.dueDate !== undefined)     p.dueDate = c.dueDate || null;

    if (c.score !== undefined) {
      p.score = (c.score === null || c.score === "") ? null : clampPercent(c.score, null);
    }

    p.updatedAt = today();
    save();

    return ok(enrichProject(clone(p)));
  }

  function deleteProject(projectId) {
    load();

    var p = byId(db.projects, projectId);
    if (!p) return err("المشروع غير موجود: " + projectId);

    db.projects = db.projects.filter(function (x) { return x.id !== projectId; });
    save();

    return ok(enrichProject(clone(p)));
  }

  /* ------------------------- الإحصاءات ------------------------- */

  function getStats() {
    load();

    var total = db.projects.length;
    var count = function (s) {
      return db.projects.filter(function (p) { return p.status === s; }).length;
    };

    var sum = db.projects.reduce(function (a, p) { return a + (p.progress || 0); }, 0);

    return ok({
      total: total,
      approved: count(STATUSES.APPROVED),
      underReview: count(STATUSES.UNDER_REVIEW),
      needsRevision: count(STATUSES.NEEDS_REVISION),
      avgProgress: total ? Math.round(sum / total) : 0,
      trainees: db.trainees.length,
      certified: db.trainees.filter(function (t) { return t.certified; }).length
    });
  }

  /* ------------------------- المتدربون ------------------------- */

  function getTrainees() {
    return ok(load().trainees.map(function (t) { return enrichTrainee(clone(t)); }));
  }

  function getTraineeById(traineeId) {
    var t = byId(load().trainees, traineeId);
    return t ? ok(enrichTrainee(clone(t))) : ok(null);
  }

  function defaultSkillsFor(trackId) {
    var tr = byId(load().tracks, trackId);
    var names = (tr && tr.skills && tr.skills.length)
      ? tr.skills
      : ["أساسيات البرمجة", "حل المشكلات", "جودة الكود", "العمل ضمن فريق", "إدارة المشروع"];

    var out = {};
    names.forEach(function (n) { out[n] = 50; });
    return out;
  }

  function addTrainee(data) {
    load();

    var d = data || {};
    var name = String(d.name || "").trim();

    if (!name) return err("اسم المتدرب مطلوب");

    var dup = db.trainees.filter(function (t) { return t.name === name; });
    if (dup.length) return err("يوجد متدرب بهذا الاسم مسبقاً");

    var track = d.track || "FrontEnd";
    var tr = byId(db.tracks, track);

    var skills = (d.skills && Object.keys(d.skills).length)
      ? d.skills
      : defaultSkillsFor(track);

    var t = mkTrainee(
      nextId("trainee", "t_"), name, track,
      String(d.trackLabel || "").trim() || (tr ? tr.label : track),
      d.cohortId || null,
      d.platformId || (db.platforms[0] ? db.platforms[0].id : null),
      skills, false, null
    );

    t.joinedAt = today();
    if (d.avatar) t.avatar = d.avatar;

    db.trainees.push(t);
    save();

    return ok(enrichTrainee(clone(t)));
  }

  function updateTrainee(traineeId, changes) {
    load();

    var t = byId(db.trainees, traineeId);
    if (!t) return err("المتدرب غير موجود: " + traineeId);

    var c = changes || {};

    if (c.name !== undefined) {
      var name = String(c.name).trim();
      if (!name) return err("اسم المتدرب مطلوب");

      var dup = db.trainees.filter(function (x) {
        return x.name === name && x.id !== traineeId;
      });
      if (dup.length) return err("يوجد متدرب بهذا الاسم مسبقاً");

      t.name = name;
    }

    if (c.track !== undefined) {
      t.track = c.track;
      var tr = byId(db.tracks, c.track);
      if (tr && c.trackLabel === undefined) t.trackLabel = tr.label;
    }

    if (c.trackLabel !== undefined) t.trackLabel = String(c.trackLabel);
    if (c.skills !== undefined)     t.skills = c.skills;
    if (c.bootcamp !== undefined)   t.bootcamp = String(c.bootcamp);
    if (c.platformId !== undefined) t.platformId = c.platformId || null;
    if (c.avatar !== undefined)     t.avatar = c.avatar;

    if (c.cohortId !== undefined) {
      t.cohortId = c.cohortId || null;
      var co = byId(db.cohorts, t.cohortId);
      if (co) t.bootcamp = co.name;
    }

    save();
    return ok(enrichTrainee(clone(t)));
  }

  function deleteTrainee(traineeId) {
    load();

    var t = byId(db.trainees, traineeId);
    if (!t) return err("المتدرب غير موجود: " + traineeId);

    db.trainees = db.trainees.filter(function (x) { return x.id !== traineeId; });
    db.projects = db.projects.filter(function (p) { return p.traineeId !== traineeId; });
    save();

    return ok(enrichTrainee(clone(t)));
  }

  function certifyTrainee(traineeId) {
    load();

    var t = byId(db.trainees, traineeId);
    if (!t) return err("المتدرب غير موجود: " + traineeId);

    t.certified = true;
    t.certifiedAt = today();
    t.certificateSerial = t.certificateSerial || ("TBM-2026-" + t.id.toUpperCase());
    save();

    return ok(enrichTrainee(clone(t)));
  }

  function updateTraineeBadges(traineeId, badges) {
    load();

    var t = byId(db.trainees, traineeId);
    if (!t) return err("المتدرب غير موجود: " + traineeId);

    t.badges = badges || [];
    save();

    return ok(enrichTrainee(clone(t)));
  }

  function addTraineeBadge(traineeId, badge) {
    load();

    var t = byId(db.trainees, traineeId);
    if (!t) return err("المتدرب غير موجود: " + traineeId);

    var has = (t.badges || []).filter(function (b) { return b.id === badge.id; });
    if (!has.length) {
      t.badges = (t.badges || []).concat([badge]);
      save();
    }

    return ok(enrichTrainee(clone(t)));
  }

  /* ------------------------- المسارات ------------------------- */

  function getTracks() {
    return ok(load().tracks);
  }

  function addTrack(track) {
    load();

    var d = track || {};
    var label = String(d.label || "").trim();

    if (!label) return err("اسم المسار مطلوب");

    var id = String(d.id || "").trim() || ("track_" + nextId("track", ""));

    if (!/^[A-Za-z0-9_]+$/.test(id)) {
      return err("معرّف المسار يقبل الحروف الإنجليزية والأرقام والشرطة السفلية فقط");
    }

    var dup = db.tracks.filter(function (t) { return t.id === id || t.label === label; });
    if (dup.length) return err("يوجد مسار بهذا الاسم أو المعرّف مسبقاً");

    var t = {
      id: id, label: label,
      color: String(d.color || "").trim() || "#4f46e5",
      sort: db.tracks.length + 1, active: true,
      skills: cleanSkills(d.skills)
    };

    db.tracks.push(t);
    save();

    return ok(t);
  }

  function cleanSkills(list) {
    var out = [];

    (list || []).forEach(function (s) {
      var n = String(s).trim();
      if (n && n.length <= 40 && out.indexOf(n) === -1) out.push(n);
    });

    if (!out.length) {
      out = ["أساسيات البرمجة", "حل المشكلات", "جودة الكود", "العمل ضمن فريق", "إدارة المشروع"];
    }

    return out;
  }

  function setTrackSkills(trackId, skills) {
    load();

    var t = byId(db.tracks, trackId);
    if (!t) return err("المسار غير موجود: " + trackId);

    t.skills = cleanSkills(skills);
    save();

    return ok(t);
  }

  function deleteTrack(trackId) {
    load();

    var t = byId(db.tracks, trackId);
    if (!t) return err("المسار غير موجود: " + trackId);

    var used = db.trainees.filter(function (x) { return x.track === trackId; }).length +
               db.projects.filter(function (x) { return x.track === trackId; }).length;

    if (used) return err("لا يمكن حذف المسار: يتبعه " + used + " سجل");

    db.tracks = db.tracks.filter(function (x) { return x.id !== trackId; });
    save();

    return ok(t);
  }

  /* ------------------------- الجهات ------------------------- */

  function getPlatforms() {
    return ok(load().platforms);
  }

  function addPlatform(platform) {
    load();

    var d = platform || {};
    var name = String(d.name || "").trim();

    if (!name) return err("اسم الجهة مطلوب");

    var dup = db.platforms.filter(function (p) { return p.name === name; });
    if (dup.length) return err("توجد جهة بهذا الاسم مسبقاً");

    var p = {
      id: nextId("platform", "pf_"), name: name,
      shortName: String(d.shortName || "").trim() || name,
      color: String(d.color || "").trim() || "#4f46e5",
      active: true
    };

    db.platforms.push(p);
    save();

    return ok(p);
  }

  function deletePlatform(platformId) {
    load();

    var p = byId(db.platforms, platformId);
    if (!p) return err("الجهة غير موجودة: " + platformId);

    var used = db.trainees.filter(function (t) { return t.platformId === platformId; }).length;
    if (used) return err("لا يمكن حذف الجهة: يتبعها " + used + " متدرب");

    db.platforms = db.platforms.filter(function (x) { return x.id !== platformId; });
    save();

    return ok(p);
  }

  /* ------------------------- الإعدادات ------------------------- */

  function getSettings() {
    return ok(load().settings);
  }

  function updateSettings(settings) {
    load();

    Object.keys(settings || {}).forEach(function (k) {
      db.settings[k] = settings[k];
    });

    save();
    return ok(db.settings);
  }

  function resetData() {
    db = seed();
    save();

    return ok({
      projects: db.projects.length,
      trainees: db.trainees.length
    });
  }

  function ping() {
    return ok({ status: "ok", mode: "demo", time: new Date().toISOString() });
  }

  /* ===================================================================
     التصدير — الواجهة نفسها التي يصدّرها dataService.js
     =================================================================== */

  return {
    STATUSES: STATUSES,
    STATUS_LABELS: STATUS_LABELS,
    STATUS_TO_DOM: STATUS_TO_DOM,
    TRACKS: TRACKS,
    TRACK_LABELS: TRACK_LABELS,

    getProjects: getProjects,
    addProject: addProject,
    updateProjectStatus: updateProjectStatus,
    updateProject: updateProject,
    deleteProject: deleteProject,
    getStats: getStats,

    getTrainees: getTrainees,
    getTraineeById: getTraineeById,
    addTrainee: addTrainee,
    updateTrainee: updateTrainee,
    deleteTrainee: deleteTrainee,
    certifyTrainee: certifyTrainee,
    updateTraineeBadges: updateTraineeBadges,
    addTraineeBadge: addTraineeBadge,

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
