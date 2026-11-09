/* ===================================================================
   demo-seed.js — بيانات العرض التجريبي

   مُولَّد آلياً من قاعدة البيانات، فهو يطابق محتوى المنصة الحقيقي.
   لا يُحرَّر يدوياً: أعد توليده بعد أي تغيير في البيانات.

   يُستخدم في index.html (نسخة GitHub Pages) فقط، ولا علاقة له
   بـ index.php التي تقرأ من MySQL.
   =================================================================== */

var DEMO_SEED = {
    "platforms": [
        {
            "id": "pf_1",
            "name": "منصة هاش بلس",
            "shortName": "هاش بلس",
            "color": "#4f46e5",
            "active": true
        },
        {
            "id": "pf_2",
            "name": "أكاديمية طويق",
            "shortName": "طويق",
            "color": "#0ea5e9",
            "active": true
        },
        {
            "id": "pf_5",
            "name": "مسك للمهارات",
            "shortName": "مسك",
            "color": "#16a34a",
            "active": true
        },
        {
            "id": "pf_6",
            "name": "الأكاديمية السعودية الرقمية",
            "shortName": "السعودية الرقمية",
            "color": "#0891b2",
            "active": true
        },
        {
            "id": "pf_8",
            "name": "منصة نمكن",
            "shortName": "نمكن",
            "color": "#8b5cf6",
            "active": true
        },
        {
            "id": "pf_9",
            "name": "أكاديمية سدايا",
            "shortName": "سدايا",
            "color": "#7c3aed",
            "active": true
        },
        {
            "id": "pf_10",
            "name": "أكاديمية كاوست",
            "shortName": "كاوست",
            "color": "#e11d48",
            "active": true
        },
        {
            "id": "pf_11",
            "name": "منصة كراديس",
            "shortName": "كراديس",
            "color": "#f59e0b",
            "active": true
        }
    ],
    "cohorts": [
        {
            "id": "c_1",
            "name": "معسكر التقنية المتقدمة",
            "platformId": "pf_1",
            "startsAt": null,
            "endsAt": null,
            "active": true
        },
        {
            "id": "c_2",
            "name": "معسكر تحليل البيانات",
            "platformId": "pf_1",
            "startsAt": null,
            "endsAt": null,
            "active": true
        },
        {
            "id": "c_3",
            "name": "معسكر تصميم الواجهات — الدفعة الثالثة",
            "platformId": "pf_1",
            "startsAt": null,
            "endsAt": null,
            "active": true
        }
    ],
    "tracks": [
        {
            "id": "FrontEnd",
            "label": "واجهات أمامية",
            "color": "#0ea5e9",
            "sort": 1,
            "active": true,
            "skills": [
                "HTML",
                "CSS",
                "JavaScript",
                "React",
                "UI/UX"
            ]
        },
        {
            "id": "Backend",
            "label": "تطوير الواجهات الخلفية",
            "color": "#16a34a",
            "sort": 2,
            "active": true,
            "skills": [
                "PHP",
                "SQL",
                "APIs",
                "الأمان",
                "الأداء"
            ]
        },
        {
            "id": "FullStack",
            "label": "تطوير متكامل",
            "color": "#4f46e5",
            "sort": 3,
            "active": true,
            "skills": [
                "HTML",
                "CSS",
                "JavaScript",
                "PHP",
                "SQL"
            ]
        },
        {
            "id": "UI_UX",
            "label": "تصميم تجربة المستخدم",
            "color": "#8b5cf6",
            "sort": 4,
            "active": true,
            "skills": [
                "البحث",
                "النماذج الأولية",
                "التصميم البصري",
                "الوصولية",
                "Figma"
            ]
        },
        {
            "id": "Mobile",
            "label": "تطبيقات الجوال",
            "color": "#f59e0b",
            "sort": 5,
            "active": true,
            "skills": [
                "Flutter",
                "Kotlin",
                "Swift",
                "واجهات الجوال",
                "النشر"
            ]
        },
        {
            "id": "DataScience",
            "label": "علم البيانات",
            "color": "#0891b2",
            "sort": 6,
            "active": true,
            "skills": [
                "Python",
                "SQL",
                "الإحصاء",
                "تصور البيانات",
                "تعلّم الآلة"
            ]
        },
        {
            "id": "AI",
            "label": "الذكاء الاصطناعي",
            "color": "#e11d48",
            "sort": 7,
            "active": true,
            "skills": [
                "Python",
                "تعلّم الآلة",
                "التعلّم العميق",
                "معالجة اللغة",
                "الرؤية الحاسوبية"
            ]
        },
        {
            "id": "Cybersecurity",
            "label": "الأمن السيبراني",
            "color": "#334155",
            "sort": 8,
            "active": true,
            "skills": [
                "الشبكات",
                "التشفير",
                "اختبار الاختراق",
                "تحليل الثغرات",
                "أمن التطبيقات"
            ]
        },
        {
            "id": "track_9",
            "label": "تطوير الألعاب",
            "color": "#f3c316",
            "sort": 9,
            "active": true,
            "skills": [
                "Unity",
                "C#",
                "الرسوميات والتحريك",
                "فيزياء الألعاب",
                "تصميم المراحل"
            ]
        }
    ],
    "trainees": [
        {
            "id": "t_1",
            "name": "سارة أحمد",
            "track": "UI_UX",
            "trackLabel": "تصميم تجربة المستخدم",
            "bootcamp": "معسكر تصميم الواجهات — الدفعة الثالثة",
            "cohortId": "c_3",
            "cohortName": "معسكر تصميم الواجهات — الدفعة الثالثة",
            "platformId": "pf_1",
            "platformName": "",
            "platformShort": "",
            "platformColor": "",
            "avatar": "https://ui-avatars.com/api/?background=4f46e5&color=fff&bold=true&name=%D8%B3%D8%A7%D8%B1%D8%A9",
            "joinedAt": "2026-01-15",
            "certified": true,
            "certifiedAt": "2026-09-27",
            "certificateSerial": "TBM-2026-T_1",
            "skills": {
                "HTML": 90,
                "CSS": 95,
                "JavaScript": 75,
                "UI/UX": 98,
                "PHP": 60
            },
            "badges": [
                {
                    "id": "first-approval",
                    "title": "أول إنجاز 🎯",
                    "icon": "fa-seedling",
                    "earnedAt": "2026-09-24"
                },
                {
                    "id": "code-hero",
                    "title": "بطل الكود! 🏆",
                    "icon": "fa-medal",
                    "earnedAt": "2026-09-24"
                },
                {
                    "id": "graduate",
                    "title": "خرّيج المعسكر 🎓",
                    "icon": "fa-graduation-cap",
                    "earnedAt": "2026-09-25"
                }
            ]
        },
        {
            "id": "t_2",
            "name": "ربى الغامدي",
            "track": "FrontEnd",
            "trackLabel": "واجهات أمامية",
            "bootcamp": "معسكر التقنية المتقدمة",
            "cohortId": "c_1",
            "cohortName": "معسكر التقنية المتقدمة",
            "platformId": "pf_2",
            "platformName": "",
            "platformShort": "",
            "platformColor": "",
            "avatar": "https://ui-avatars.com/api/?background=4f46e5&color=fff&bold=true&name=%D8%B1%D8%A8%D9%89",
            "joinedAt": "2026-01-15",
            "certified": true,
            "certifiedAt": "2026-11-09",
            "certificateSerial": "TBM-2026-T_2",
            "skills": {
                "HTML": 95,
                "CSS": 90,
                "JavaScript": 85,
                "UI/UX": 95,
                "PHP": 80
            },
            "badges": [
                {
                    "id": "first-approval",
                    "title": "أول إنجاز 🎯",
                    "icon": "fa-seedling",
                    "earnedAt": "2026-09-24"
                },
                {
                    "id": "code-hero",
                    "title": "بطل الكود! 🏆",
                    "icon": "fa-medal",
                    "earnedAt": "2026-09-24"
                },
                {
                    "id": "graduate",
                    "title": "خرّيج المعسكر 🎓",
                    "icon": "fa-graduation-cap",
                    "earnedAt": "2026-09-25"
                },
                {
                    "id": "triple-threat",
                    "title": "ثلاثية الإتقان ⚡",
                    "icon": "fa-bolt",
                    "earnedAt": "2026-11-09"
                }
            ]
        },
        {
            "id": "t_3",
            "name": "فهد الدوسري",
            "track": "FullStack",
            "trackLabel": "تطوير متكامل",
            "bootcamp": "معسكر التقنية المتقدمة",
            "cohortId": "c_1",
            "cohortName": "معسكر التقنية المتقدمة",
            "platformId": "pf_1",
            "platformName": "",
            "platformShort": "",
            "platformColor": "",
            "avatar": "https://ui-avatars.com/api/?background=4f46e5&color=fff&bold=true&name=%D9%81%D9%87%D8%AF",
            "joinedAt": "2026-02-01",
            "certified": false,
            "certifiedAt": null,
            "certificateSerial": null,
            "skills": {
                "HTML": 80,
                "CSS": 75,
                "JavaScript": 90,
                "UI/UX": 65,
                "PHP": 92
            },
            "badges": [
                {
                    "id": "first-approval",
                    "title": "أول إنجاز 🎯",
                    "icon": "fa-seedling",
                    "earnedAt": "2026-11-09"
                },
                {
                    "id": "code-hero",
                    "title": "بطل الكود! 🏆",
                    "icon": "fa-medal",
                    "earnedAt": "2026-11-09"
                }
            ]
        },
        {
            "id": "t_4",
            "name": "نورة العتيبي",
            "track": "UI_UX",
            "trackLabel": "هندسة البيانات والواجهات",
            "bootcamp": "معسكر التقنية المتقدمة",
            "cohortId": "c_1",
            "cohortName": "معسكر التقنية المتقدمة",
            "platformId": "pf_1",
            "platformName": "",
            "platformShort": "",
            "platformColor": "",
            "avatar": "https://ui-avatars.com/api/?background=4f46e5&color=fff&bold=true&name=%D9%86%D9%88%D8%B1%D8%A9%20%D8%A7%D9%84%D8%B9%D8%AA%D9%8A%D8%A8%D9%8A",
            "joinedAt": "2026-09-25",
            "certified": false,
            "certifiedAt": null,
            "certificateSerial": null,
            "skills": {
                "HTML": 90,
                "CSS": 60,
                "JavaScript": 25,
                "UI/UX": 55,
                "PHP": 50
            },
            "badges": []
        },
        {
            "id": "t_5",
            "name": "نورة الحربي",
            "track": "UI_UX",
            "trackLabel": "هندسة برمجيات وواجهات",
            "bootcamp": "معسكر تحليل البيانات",
            "cohortId": "c_2",
            "cohortName": "معسكر تحليل البيانات",
            "platformId": "pf_1",
            "platformName": "",
            "platformShort": "",
            "platformColor": "",
            "avatar": "https://ui-avatars.com/api/?background=4f46e5&color=fff&bold=true&name=%D9%86%D9%88%D8%B1%D8%A9%20%D8%A7%D9%84%D8%AD%D8%B1%D8%A8%D9%8A",
            "joinedAt": "2026-09-25",
            "certified": false,
            "certifiedAt": null,
            "certificateSerial": null,
            "skills": {
                "HTML": 70,
                "CSS": 65,
                "JavaScript": 60,
                "UI/UX": 55,
                "PHP": 50
            },
            "badges": []
        },
        {
            "id": "t_6",
            "name": "هند العتيبي",
            "track": "DataScience",
            "trackLabel": "هندسة البرمجيات والواجهات",
            "bootcamp": "معسكر التقنية المتقدمة",
            "cohortId": "c_1",
            "cohortName": "معسكر التقنية المتقدمة",
            "platformId": "pf_1",
            "platformName": "",
            "platformShort": "",
            "platformColor": "",
            "avatar": "https://ui-avatars.com/api/?background=4f46e5&color=fff&bold=true&name=%D9%87%D9%86%D8%AF%20%D8%A7%D9%84%D8%B9%D8%AA%D9%8A%D8%A8%D9%8A",
            "joinedAt": "2026-09-26",
            "certified": false,
            "certifiedAt": null,
            "certificateSerial": null,
            "skills": {
                "HTML": 0,
                "CSS": 0,
                "JavaScript": 0,
                "UI/UX": 0,
                "PHP": 0
            },
            "badges": []
        },
        {
            "id": "t_7",
            "name": "ريم القحطاني",
            "track": "Cybersecurity",
            "trackLabel": "الأمن السيبراني",
            "bootcamp": "معسكر التقنية المتقدمة",
            "cohortId": "c_1",
            "cohortName": "معسكر التقنية المتقدمة",
            "platformId": "pf_1",
            "platformName": "",
            "platformShort": "",
            "platformColor": "",
            "avatar": "https://ui-avatars.com/api/?background=4f46e5&color=fff&bold=true&name=%D8%B1%D9%8A%D9%85%20%D8%A7%D9%84%D9%82%D8%AD%D8%B7%D8%A7%D9%86%D9%8A",
            "joinedAt": "2026-09-26",
            "certified": false,
            "certifiedAt": null,
            "certificateSerial": null,
            "skills": {
                "الشبكات": 85,
                "التشفير": 70,
                "اختبار الاختراق": 90,
                "تحليل الثغرات": 65,
                "أمن التطبيقات": 75
            },
            "badges": []
        }
    ],
    "projects": [
        {
            "id": "p_1",
            "projectName": "منصة حجوزات ذكية",
            "title": "منصة حجوزات ذكية",
            "traineeId": "t_1",
            "traineeName": "",
            "status": "approved",
            "track": "UI_UX",
            "trackLabel": "",
            "progress": 100,
            "dueDate": "2026-10-15",
            "description": "تطوير واجهات المستخدم",
            "feedback": "",
            "score": 96,
            "createdAt": "2026-07-02",
            "updatedAt": "2026-09-25",
            "platformId": "pf_1",
            "platformName": "",
            "platformShort": "",
            "platformColor": ""
        },
        {
            "id": "p_2",
            "projectName": "تطبيق سند",
            "title": "تطبيق سند",
            "traineeId": "t_2",
            "traineeName": "",
            "status": "approved",
            "track": "FrontEnd",
            "trackLabel": "",
            "progress": 100,
            "dueDate": "2026-11-02",
            "description": "تطبيق لربط المستفيدين بالجهات الخيرية وتنظيم الطلبات.",
            "feedback": "",
            "score": null,
            "createdAt": "2026-08-18",
            "updatedAt": "2026-11-09",
            "platformId": "pf_1",
            "platformName": "",
            "platformShort": "",
            "platformColor": ""
        },
        {
            "id": "p_3",
            "projectName": "مساعد نبراس الذكي",
            "title": "مساعد نبراس الذكي",
            "traineeId": "t_2",
            "traineeName": "",
            "status": "approved",
            "track": "FrontEnd",
            "trackLabel": "",
            "progress": 100,
            "dueDate": "2026-09-30",
            "description": "مساعد يقدّم توصيات تعليمية مخصّصة لكل متدرب.",
            "feedback": "",
            "score": 93,
            "createdAt": "2026-06-05",
            "updatedAt": "2026-08-15",
            "platformId": "pf_1",
            "platformName": "",
            "platformShort": "",
            "platformColor": ""
        },
        {
            "id": "p_4",
            "projectName": "بوابة الدفع الموحّدة",
            "title": "بوابة الدفع الموحّدة",
            "traineeId": "t_3",
            "traineeName": "",
            "status": "needs_revision",
            "track": "FullStack",
            "trackLabel": "",
            "progress": 40,
            "dueDate": "2026-11-20",
            "description": "واجهة برمجية موحّدة لمعالجة المدفوعات وتقاريرها.",
            "feedback": "",
            "score": null,
            "createdAt": "2026-08-20",
            "updatedAt": "2026-09-22",
            "platformId": "pf_1",
            "platformName": "",
            "platformShort": "",
            "platformColor": ""
        },
        {
            "id": "p_5",
            "projectName": "لوحة تحليلات المعسكر",
            "title": "لوحة تحليلات المعسكر",
            "traineeId": "t_3",
            "traineeName": "",
            "status": "approved",
            "track": "FullStack",
            "trackLabel": "",
            "progress": 100,
            "dueDate": "2026-12-01",
            "description": "لوحة مؤشرات لمتابعة أداء المتدربين والمشاريع.",
            "feedback": "",
            "score": 99,
            "createdAt": "2026-09-01",
            "updatedAt": "2026-11-09",
            "platformId": "pf_1",
            "platformName": "",
            "platformShort": "",
            "platformColor": ""
        },
        {
            "id": "p_6",
            "projectName": "تطبيق مواعيد",
            "title": "تطبيق مواعيد",
            "traineeId": "t_2",
            "traineeName": "",
            "status": "under_review",
            "track": "FrontEnd",
            "trackLabel": "",
            "progress": 100,
            "dueDate": null,
            "description": "مشروع جديد بانتظار التقييم.",
            "feedback": "",
            "score": null,
            "createdAt": "2026-09-25",
            "updatedAt": "2026-11-09",
            "platformId": "pf_2",
            "platformName": "",
            "platformShort": "",
            "platformColor": ""
        }
    ],
    "settings": {
        "default_bootcamp": "معسكر التقنية المتقدمة",
        "platform_name": "أكاديمية يوستدي"
    },
    "seq": {
        "trainee": 7,
        "project": 6,
        "track": 9,
        "platform": 11,
        "cohort": 3
    },
    "version": "d9fdbab6cbfd"
};
