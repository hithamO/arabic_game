// =====================================================================
//  منطق اللعبة (بدون واجهة) — مشترك بين صفحة الطالب وصفحة المعلم
// =====================================================================

export const TYPE_OPTIONS = ['اسمية', 'فعلية'];
export const WORD_OPTIONS = ['اسم', 'فعل', 'حرف'];

// ---------- أرقام عشوائية بذرة ثابتة (حتى يستأنف الطالب نفس الأسئلة بعد Refresh) ----------
export function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function rng(seedStr) {
  let a = hashString(String(seedStr)) || 1;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(arr, rand) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// اختيار متوازن: يأخذ من كل مجموعة إجابة بالتناوب حتى لا تكون كل الإجابات «اسمية» مثلاً
function pickBalanced(pool, count, rand, groupKey) {
  const groups = new Map();
  for (const q of shuffle(pool, rand)) {
    const k = groupKey ? groupKey(q) : 'all';
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(q);
  }
  const lists = shuffle([...groups.values()], rand);
  const out = [];
  let guard = 0;
  while (out.length < count && guard++ < 500) {
    let added = false;
    for (const l of lists) {
      if (out.length >= count) break;
      if (l.length) { out.push(l.shift()); added = true; }
    }
    if (!added) break;
  }
  return shuffle(out, rand);
}

export function firstWord(text) {
  return (text || '').trim().split(/\s+/)[0].replace(/[.،؟!:«»]/g, '');
}

function makeExplain(stageKey, q, lesson) {
  if (q.explain) return q.explain;
  if (lesson && lesson.explain) {
    const words = (q.text || '').trim().split(/\s+/).map(w => w.replace(/[.،؟!:«»]/g, ''));
    const at = q.at | 0;
    const fill = t => (t || '').replace(/\{text\}/g, (q.text || '').replace(/[.؟!]$/, ''))
      .replace(/\{1\}/g, words[at] || '').replace(/\{2\}/g, words[at + 1] || '');
    let out = fill(lesson.explain[q.answer]);
    if (q.of && q.of !== q.answer && lesson.explain[q.of]) out += ' ' + fill(lesson.explain[q.of]);
    return out.trim();
  }
  const w = firstWord(q.text);
  if (stageKey === 'first') {
    if (q.answer === 'حرف') return `الكلمة الأولى «${w}» حرف.`;
    return `الكلمة الأولى «${w}» ${q.answer}.`;
  }
  return q.answer === 'فعلية'
    ? `بدأت الجملة بالفعل «${w}»، فهي جملة فعلية.`
    : `بدأت الجملة بالاسم «${w}»، فهي جملة اسمية.`;
}

// يدمج نصوص الدرس (العنوان والتلميح والخيارات) مع إعدادات المراحل في config.js
export function mergeStages(configStages, lesson) {
  return configStages.map((st, i) => Object.assign({}, st, (lesson && lesson.stages && lesson.stages[i]) || {}, { key: st.key, pick: st.pick }));
}

/**
 * يبني قائمة أسئلة الطالب: نفس عدد الأسئلة ونفس توزيع الصعوبة لكل الطلاب،
 * لكن باختيار وترتيب مختلفين. البذرة = رمز الغرفة + معرّف الطالب + رقم الجولة.
 */
export function buildGame(seed, bank, stages, lesson) {
  const rand = rng(seed);
  const items = [];
  stages.forEach((stage, sIdx) => {
    const pool = bank['stage' + (sIdx + 1)] || [];
    const used = new Set();
    let chosen = [];
    for (const p of stage.pick) {
      const levelPool = pool.filter(q => q.level === p.level && !used.has(q));
      const groupKey = stage.key === 'final' ? null : (q => q.answer);
      const got = pickBalanced(levelPool, p.count, rand, groupKey);
      got.forEach(q => used.add(q));
      // إن لم تكفِ أسئلة المستوى، نكمل من أي مستوى آخر
      if (got.length < p.count) {
        const rest = shuffle(pool.filter(q => !used.has(q)), rand).slice(0, p.count - got.length);
        rest.forEach(q => used.add(q));
        got.push(...rest);
      }
      chosen = chosen.concat(got); // الأسهل أولاً لأن pick مرتبة حسب المستوى
    }
    for (const q of chosen) {
      let options;
      if (q.options) options = shuffle(q.options, rand);
      else if (stage.options) options = stage.shuffle ? shuffle(stage.options, rand) : stage.options.slice();
      else if (stage.key === 'first') options = shuffle(WORD_OPTIONS, rand);
      else if (stage.key === 'final') options = shuffle(q.options, rand);
      else options = TYPE_OPTIONS.slice(); // اسمية يميناً وفعلية يساراً دائماً — ثبات يساعد الطالب
      items.push({
        stage: sIdx,
        kind: stage.key,
        text: q.text || '',
        of: q.of || null,
        at: q.at | 0,
        question: q.question || stage.question || (stage.key === 'first' ? 'ما نوع الكلمة التي بدأت بها الجملة؟' : 'ما نوع الجملة؟'),
        options,
        answer: q.answer,
        level: q.level,
        explain: makeExplain(stage.key, q, lesson)
      });
    }
  });
  return items;
}

export function totalQuestions(stages) {
  return stages.reduce((s, st) => s + st.pick.reduce((a, p) => a + p.count, 0), 0);
}

export function stageBounds(stages) {
  const out = [];
  let start = 0;
  for (const st of stages) {
    const n = st.pick.reduce((a, p) => a + p.count, 0);
    out.push({ start, end: start + n });
    start += n;
  }
  return out;
}

// ---------- النقاط (للمتعة فقط) ----------
export function pointsFor(msTaken, fast, scoring) {
  const win = (fast ? scoring.speedWindowSecFast : scoring.speedWindowSec) * 1000;
  const frac = Math.max(0, 1 - msTaken / win);
  return scoring.correct + Math.round(scoring.speedBonusMax * frac);
}

// ---------- الزمن ----------
// بداية لعب الطالب = بداية اللعبة للجميع، أو لحظة دخوله إن دخل متأخراً (+ العد التنازلي)
export function gameBase(meta, st) {
  const cd = meta.countdownMs || 0;
  const common = (meta.startedAt || 0) + cd;
  const own = st && st.startAt ? st.startAt + cd : 0;
  return Math.max(common, own);
}

// وقت الطالب الرسمي = لحظة آخر إجابة (بتوقيت الخادم) − البداية − فترات الإيقاف المؤقت
export function studentTimeMs(meta, st) {
  if (!meta || !st || !st.answered || !st.lastAt) return 0;
  const paused = (st.pz || 0) - (st.po || 0);
  return Math.max(0, st.lastAt - gameBase(meta, st) - paused);
}

// الوقت الجاري أثناء اللعب (للعداد فقط)
export function liveElapsed(meta, st, serverNow) {
  if (!meta || !meta.startedAt) return 0;
  let now = serverNow;
  if (meta.status === 'paused' && meta.pausedAt) now = meta.pausedAt;
  if (meta.status === 'finished' && meta.endedAt) now = Math.min(now, meta.endedAt);
  const paused = (meta.pausedMs || 0) - ((st && st.po) || 0);
  return Math.max(0, now - gameBase(meta, st) - paused);
}

export function formatTime(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

// ---------- الترتيب العادل ----------
// 1) عدد الإجابات الصحيحة  2) نسبة الإنجاز (عدد الأسئلة المُجابة)  3) الوقت الأقل
// من لم يُكمل لا يتفوّق على من أكمل بنفس عدد الإجابات الصحيحة، لأن الإنجاز يأتي قبل الوقت.
export function rankStudents(studentsObj, meta) {
  const list = Object.entries(studentsObj || {})
    .filter(([, s]) => s && typeof s.name === 'string')
    .map(([id, s]) => ({
      id,
      name: s.name,
      avatar: s.avatar | 0,
      correct: s.correct | 0,
      answered: s.answered | 0,
      points: s.points | 0,
      finished: !!s.finished,
      online: s.online !== false,
      joinedAt: s.joinedAt || 0,
      stage: s.stage | 0,
      timeMs: studentTimeMs(meta, s)
    }));
  list.sort((a, b) =>
    (b.correct - a.correct) ||
    (b.answered - a.answered) ||
    ((a.answered ? a.timeMs : Infinity) - (b.answered ? b.timeMs : Infinity)) ||
    (a.joinedAt - b.joinedAt) ||
    a.name.localeCompare(b.name, 'ar'));
  let rank = 0, prev = null;
  list.forEach((s, i) => {
    const same = prev && prev.correct === s.correct && prev.answered === s.answered && prev.timeMs === s.timeMs;
    rank = same ? rank : i + 1;
    s.rank = rank;
    prev = s;
  });
  return list;
}

// ---------- أدوات نصية ----------
export function sanitizeName(raw, maxLen) {
  return String(raw || '')
    .replace(/[\u0000-\u001f\u007f<>"'`\\{}[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen)
    .trim();
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// صيغة العدد العربية: طالب، طالبان، 3 طلاب، 11 طالباً
export function studentsLabel(n) {
  if (n === 0) return 'لا يوجد طلاب بعد';
  if (n === 1) return 'طالب واحد';
  if (n === 2) return 'طالبان';
  if (n >= 3 && n <= 10) return `${n} طلاب`;
  return `${n} طالباً`;
}

export function duplicateNames(studentsObj) {
  const counts = {};
  for (const s of Object.values(studentsObj || {})) {
    if (!s || !s.name) continue;
    const k = s.name.replace(/\s+/g, ' ').trim();
    counts[k] = (counts[k] || 0) + 1;
  }
  return Object.entries(counts).filter(([, c]) => c > 1).map(([name, c]) => ({ name, count: c }));
}
