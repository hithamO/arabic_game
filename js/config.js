// =====================================================================
//  ملف الإعدادات — يمكنك تعديل هذا الملف بدون لمس منطق اللعبة
// =====================================================================

export const CONFIG = {
  // اسم اللعبة كما يظهر للطلاب والمعلم
  gameTitle: 'مملكة الجُمل',
  gameSubtitle: 'مغامرة الجملة الاسمية والجملة الفعلية',

  // رابط اللعبة الذي يوضع في QR Code
  // اتركه فارغاً ليتم اكتشافه تلقائياً (مناسب لـ GitHub Pages)
  // أو اكتبه يدوياً مثل: 'https://USERNAME.github.io/arabic-game/'
  baseUrl: '',

  // المراحل الخمس — pick تعني: كم سؤالاً يُختار من كل مستوى صعوبة
  // level 1 = سهل ، level 2 = متوسط ، level 3 = يحتاج تفكيراً
  // مجموع الأسئلة في كل لعبة = مجموع count في كل المراحل (حالياً 25)
  stages: [
    {
      key: 'type', icon: '🌴', place: 'واحة البداية',
      title: 'اختر نوع الجملة',
      hint: 'اقرأ الجملة، ثم اختر: اسمية أم فعلية؟',
      pick: [{ level: 1, count: 3 }, { level: 2, count: 2 }]
    },
    {
      key: 'gate', icon: '🏛️', place: 'بوابتا المملكة',
      title: 'بوابة الجمل',
      hint: 'ادخل من البوابة الصحيحة لتعبر!',
      pick: [{ level: 1, count: 3 }, { level: 2, count: 2 }]
    },
    {
      key: 'first', icon: '🔍', place: 'بئر الكلمات',
      title: 'ما الكلمة الأولى؟',
      hint: 'انظر إلى أول كلمة: اسم أم فعل أم حرف؟',
      pick: [{ level: 1, count: 3 }, { level: 2, count: 2 }]
    },
    {
      key: 'speed', icon: '⚡', place: 'سباق الكثبان',
      title: 'تحدي السرعة',
      hint: 'أجب بسرعة ودقة — الجمل تتوالى!',
      pick: [{ level: 1, count: 3 }, { level: 2, count: 2 }]
    },
    {
      key: 'final', icon: '🏰', place: 'قلعة الأبطال',
      title: 'التحدي النهائي',
      hint: 'أسئلة تحتاج تفكيراً… أنت قادر عليها!',
      pick: [{ level: 2, count: 3 }, { level: 3, count: 2 }]
    }
  ],

  // العد التنازلي قبل بدء اللعبة (بالثواني)
  countdownSeconds: 3,

  // مدة قصوى للعبة بالدقائق (0 = بدون حد أقصى)
  maxGameMinutes: 0,

  // هل يُسمح للطالب بالدخول بعد بدء اللعبة؟ (يُحسب وقته من لحظة دخوله)
  allowLateJoin: true,

  // الحد الأقصى لطول الاسم
  maxNameLength: 16,

  // النقاط (للمتعة فقط — الترتيب يعتمد على عدد الإجابات الصحيحة ثم الوقت)
  // تنبيه: إذا غيّرت correct + speedBonusMax ليتجاوز 150 فعدّل القاعدة points في database.rules.json
  scoring: {
    correct: 100,          // نقاط الإجابة الصحيحة
    speedBonusMax: 50,     // أقصى مكافأة سرعة للسؤال
    speedWindowSec: 10,    // تقل المكافأة تدريجياً حتى تصبح صفراً بعد هذه المدة
    speedWindowSecFast: 5  // نفس الفكرة في مرحلة تحدي السرعة
  },

  // مدة عرض التغذية الراجعة قبل الانتقال (بالمللي ثانية)
  feedbackMs: {
    correct: 950,
    wrong: 2000,
    speedCorrect: 450,
    speedWrong: 1300
  },

  // إعدادات Firebase — انسخها من Firebase Console (راجع README.md)
  firebase: {
    apiKey: 'AIzaSyBEA-GcVnkN58MYFPKdjTTO4AQ56G2v1dY',
    authDomain: 'arabic-game-12611.firebaseapp.com',
    databaseURL: 'https://arabic-game-12611-default-rtdb.firebaseio.com',
    projectId: 'arabic-game-12611',
    appId: '1:425177312561:web:c9b9dcc9343b0b32215410'
  }
};
