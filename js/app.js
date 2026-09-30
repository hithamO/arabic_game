// =====================================================================
//  صفحة الطالب
// =====================================================================
import { CONFIG } from './config.js';
import * as Q from './questions.js?v=2';
import {
  buildGame, pointsFor, rankStudents, formatTime, sanitizeName, esc, studentsLabel,
  liveElapsed, studentTimeMs, gameBase, totalQuestions, stageBounds, mergeStages
} from './game.js?v=2';
import { connect, makeApi, P, isDemo, isConfigured } from './firebase.js';
import { AVATARS, avatarSVG } from './avatars.js';
import * as sound from './sound.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const QUESTIONS = Q.QUESTIONS;
const LESSON = Q.LESSON || null; // نصوص الدرس الحالي (من questions.js)
const STAGES = mergeStages(CONFIG.stages, LESSON);
const BOUNDS = stageBounds(STAGES);
const TOTAL = totalQuestions(STAGES);
const SCENES = ['oasis', 'gates', 'well', 'race', 'castle'];
const PRAISE = ['أحسنت!', 'إجابة رائعة!', 'ممتاز!', 'رائع!', 'أنت بطل!', 'عمل رائع!'];
const ENCOURAGE = ['حاول في السؤال التالي!', 'لا بأس، تابع!', 'ستنجح في التالي!'];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

const S = {
  b: null, api: null,
  code: (params.get('session') || '').replace(/\D/g, '').slice(0, 4),
  codeFromUrl: !!params.get('session'),
  solo: isDemo && !params.get('session'),
  avatar: -1, name: '',
  meta: null, me: null, students: null,
  joined: false, wantJoin: false, joining: false,
  game: null, round: null,
  idx: 0, correct: 0, points: 0, streak: 0,
  locked: false, qStart: 0, stageShown: -1,
  phase: 'boot', timeUp: false, endShown: false, soloTimer: null,
  unsub: {}, timer: null, introClose: null, resyncing: false
};

// ---------------------------------------------------------------- رسومات المشاهد
const LANDMARKS = {
  dusk: `<svg viewBox="0 0 260 230"><g fill="#3A2A78" opacity=".85"><rect x="60" y="120" width="140" height="110"/><rect x="40" y="90" width="36" height="140"/><rect x="184" y="90" width="36" height="140"/><path d="M40 90 l18 -26 l18 26z M184 90 l18 -26 l18 26z"/><rect x="112" y="70" width="36" height="60"/><path d="M112 70 l18 -34 l18 34z"/></g><path d="M130 36 v-18" stroke="#3A2A78" stroke-width="3"/><path d="M130 18 l16 5 l-16 5z" fill="#FFC53D"/></svg>`,
  oasis: `<svg viewBox="0 0 260 230"><ellipse cx="130" cy="212" rx="110" ry="16" fill="#3FA7C9"/><g fill="#7A4A1E"><path d="M70 212 q-8 -70 10 -130 l6 2 q-14 60 -6 128z"/><path d="M180 212 q10 -60 -8 -110 l6 -2 q20 52 10 112z"/></g><g fill="#2F9E5B"><path d="M82 84 q-40 -10 -62 16 q34 -12 60 -6z"/><path d="M84 82 q30 -34 66 -22 q-36 2 -62 28z"/><path d="M82 84 q-14 -40 -48 -44 q30 14 42 46z"/><path d="M84 84 q40 -6 58 22 q-30 -20 -58 -16z"/><path d="M174 104 q-36 -14 -58 8 q30 -8 56 -2z"/><path d="M176 102 q28 -30 60 -16 q-32 0 -56 22z"/><path d="M176 104 q34 0 48 28 q-24 -22 -48 -22z"/></g></svg>`,
  gates: `<svg viewBox="0 0 260 230"><g fill="#6E3E86" opacity=".6"><path d="M30 230 V110 Q30 50 90 50 Q150 50 150 110 V230 H120 V120 Q120 84 90 84 Q60 84 60 120 V230Z"/><path d="M150 230 V130 Q150 90 195 90 Q240 90 240 130 V230 H218 V140 Q218 112 195 112 Q172 112 172 140 V230Z"/></g></svg>`,
  well: `<svg viewBox="0 0 260 230"><rect x="70" y="150" width="120" height="70" rx="10" fill="#8C6A4A"/><path d="M70 170 h120 M70 195 h120 M100 150 v70 M140 150 v70" stroke="#6B4E33" stroke-width="4"/><path d="M78 150 V80 M182 150 V80" stroke="#6B3E1F" stroke-width="8"/><path d="M60 84 L130 50 L200 84Z" fill="#B0533B"/><path d="M130 84 v36" stroke="#3A2A1A" stroke-width="3"/><rect x="118" y="118" width="24" height="20" rx="4" fill="#C98B4A"/></svg>`,
  race: `<svg viewBox="0 0 260 230"><path d="M200 220 V60" stroke="#6B3E1F" stroke-width="6"/><g><rect x="140" y="60" width="60" height="40" fill="#fff"/><g fill="#1E1640"><rect x="140" y="60" width="15" height="10"/><rect x="170" y="60" width="15" height="10"/><rect x="155" y="70" width="15" height="10"/><rect x="185" y="70" width="15" height="10"/><rect x="140" y="80" width="15" height="10"/><rect x="170" y="80" width="15" height="10"/><rect x="155" y="90" width="15" height="10"/><rect x="185" y="90" width="15" height="10"/></g></g></svg>`,
  castle: `<svg viewBox="0 0 260 230"><g fill="#F7CD84"><rect x="50" y="110" width="160" height="120"/><rect x="30" y="80" width="40" height="150"/><rect x="190" y="80" width="40" height="150"/><rect x="105" y="50" width="50" height="80"/></g><g fill="#C98434"><path d="M30 80 l20 -30 l20 30z M190 80 l20 -30 l20 30z M105 50 l25 -36 l25 36z"/><path d="M108 230 V180 Q108 158 130 158 Q152 158 152 180 V230Z"/></g><g fill="#FFE9A8"><rect x="44" y="110" width="12" height="18" rx="6"/><rect x="204" y="110" width="12" height="18" rx="6"/><rect x="124" y="80" width="12" height="18" rx="6"/></g><path d="M130 14 v-12" stroke="#6B3E1F" stroke-width="3"/><path d="M130 2 l18 6 l-18 6z" fill="#E5484D"/></svg>`
};

function setScene(name) {
  $('sky').dataset.scene = name;
  $('landmark').innerHTML = LANDMARKS[name] || '';
}

// ---------------------------------------------------------------- أدوات الواجهة
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
  window.scrollTo(0, 0);
}
function toast(msg, ms = 2600) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), ms);
}
function showMsg(icon, title, text, opts = {}) {
  S.phase = 'msg';
  $('msg-icon').textContent = icon;
  $('msg-title').textContent = title;
  $('msg-text').textContent = text;
  const btn = $('msg-btn'), link = $('msg-link');
  btn.hidden = !opts.btn; link.hidden = !opts.link;
  if (opts.btn) { btn.textContent = opts.btn.text; btn.onclick = opts.btn.fn; }
  if (opts.link) { link.textContent = opts.link.text; link.href = opts.link.href; }
  if ($('sky').dataset.scene !== 'dusk') setScene('dusk');
  show('s-msg');
}
function hideOverlays() {
  ['ov-countdown', 'ov-stage', 'ov-pause'].forEach(id => { $(id).hidden = true; });
  if (S.introClose) S.introClose();
  clearInterval(S.cdTimer);
}
function withTimeout(p, ms) {
  return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
}
async function safeGet(path) {
  try { return await withTimeout(S.b.get(path), 9000); } catch (e) { console.warn(e); return undefined; }
}
function saveProfile() {
  try { localStorage.setItem('mj-profile', JSON.stringify({ name: S.name, avatar: S.avatar })); } catch { }
}
function loadProfile() {
  try { return JSON.parse(localStorage.getItem('mj-profile')); } catch { return null; }
}

// ---------------------------------------------------------------- البداية
async function boot() {
  renderAvatarGrid();
  bindUI();
  updateSoundBtn();
  setScene('dusk');
  applyLessonTexts();
  const prof = loadProfile();
  if (prof) { S.name = prof.name || ''; if (prof.avatar >= 0 && prof.avatar < AVATARS.length) S.avatar = prof.avatar; }

  if (!isDemo && !isConfigured) {
    return showMsg('🛠️', 'اللعبة غير مُعدّة بعد',
      'لم يتم ربط اللعبة بقاعدة بيانات Firebase. أكمل الإعداد في ملف js/config.js (راجع README).',
      { link: { href: '?demo=1', text: 'جرّب وضع التجربة على هذا الجهاز' } });
  }
  try {
    S.b = await withTimeout(connect('student'), 15000);
    S.api = makeApi(S.b);
    await S.b.waitAuth();
    if (!S.b.uid) await withTimeout(S.b.signInAnon(), 12000);
  } catch (e) {
    console.error(e);
    return showMsg('📡', 'تعذّر الاتصال', 'تأكد من اتصال الجهاز بالإنترنت ثم حاول مرة أخرى.',
      { btn: { text: 'إعادة المحاولة', fn: () => location.reload() } });
  }
  watchConnection();

  if (S.solo) S.code = '0000';
  if (S.code) {
    const existing = await safeGet(P.student(S.code, S.b.uid));
    if (existing && existing.name) {
      // عودة بعد Refresh أو إغلاق Safari
      S.name = existing.name; S.avatar = existing.avatar | 0; S.joined = true;
      return enterRoom();
    }
    if (!S.solo) { $('welcome-room').textContent = `رمز الغرفة: ${S.code}`; $('welcome-room').hidden = false; }
  }
  S.phase = 'welcome';
  show('s-welcome');
}

// نصوص شاشة الترحيب حسب الدرس الحالي
function applyLessonTexts() {
  if (!LESSON) return;
  if (LESSON.subtitle) $('tagline').textContent = LESSON.subtitle;
  if (LESSON.title) document.title = `${CONFIG.gameTitle} — ${LESSON.title}`;
  const g = LESSON.heroGates || [];
  [['hero-g1', g[0]], ['hero-g2', g[1]]].forEach(([id, t]) => {
    if (!t) return;
    $(id).textContent = t;
    if (t.length > 3) $(id).setAttribute('font-size', t.length > 4 ? '16' : '19');
  });
}

function bindUI() {
  $('btn-start').onclick = () => {
    sound.unlock(); sound.sfx.tap();
    S.phase = 'avatar';
    show('s-avatar');
  };
  $('btn-avatar-next').onclick = () => {
    sound.sfx.tap();
    openNameScreen();
  };
  $('btn-change-avatar').onclick = () => { S.phase = 'avatar'; show('s-avatar'); };
  $('name-form').addEventListener('submit', onJoinSubmit);
  $('inp-code').addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4); });
  $('btn-sound').onclick = () => { sound.toggle(); updateSoundBtn(); };
  $('stage').addEventListener('click', e => {
    const btn = e.target.closest('[data-i]');
    if (btn && !btn.disabled) onPick(btn);
  });
}

function updateSoundBtn() {
  const on = sound.isOn();
  $('btn-sound').textContent = on ? '🔊' : '🔇';
  $('btn-sound').setAttribute('aria-pressed', String(!on));
}

function renderAvatarGrid() {
  $('avatar-grid').innerHTML = AVATARS.map((a, i) =>
    `<button type="button" class="av-opt" role="radio" aria-checked="false" data-av="${i}" aria-label="${esc(a.name)}">
      ${avatarSVG(i)}<span>${esc(a.name)}</span></button>`).join('');
  $('avatar-grid').addEventListener('click', e => {
    const b = e.target.closest('[data-av]');
    if (!b) return;
    sound.unlock(); sound.sfx.tap();
    selectAvatar(+b.dataset.av);
  });
  if (S.avatar >= 0) selectAvatar(S.avatar);
}
function selectAvatar(i) {
  S.avatar = i;
  document.querySelectorAll('.av-opt').forEach(b => b.setAttribute('aria-checked', String(+b.dataset.av === i)));
  $('btn-avatar-next').disabled = false;
}

function openNameScreen() {
  S.phase = 'name';
  $('name-avatar').innerHTML = avatarSVG(S.avatar, 'bob');
  $('inp-name').value = S.name || '';
  $('code-field').hidden = !!S.code;
  $('name-error').textContent = '';
  $('btn-join').disabled = false;
  $('btn-join').textContent = 'ادخل الغرفة';
  show('s-name');
  if (!S.name) setTimeout(() => $('inp-name').focus(), 300);
}

async function onJoinSubmit(e) {
  e.preventDefault();
  sound.unlock();
  const err = m => { $('name-error').textContent = m; $('btn-join').disabled = false; $('btn-join').textContent = 'ادخل الغرفة'; };
  const name = sanitizeName($('inp-name').value, CONFIG.maxNameLength);
  if (!name) return err('اكتب اسمك أولاً ✏️');
  if (S.avatar < 0) return err('اختر شخصية أولاً');
  if (!S.code) {
    const c = $('inp-code').value.replace(/\D/g, '');
    if (c.length !== 4) return err('رمز الغرفة مكوَّن من 4 أرقام');
    S.code = c;
  }
  $('btn-join').disabled = true;
  $('btn-join').textContent = 'جارٍ الدخول…';
  $('name-error').textContent = '';

  if (S.solo) await ensureSoloRoom();
  const meta = await safeGet(P.meta(S.code));
  if (meta === undefined) return err('تعذّر الاتصال. تحقق من الإنترنت وحاول مرة أخرى.');
  if (!meta) {
    S.code = ''; S.codeFromUrl = false; $('code-field').hidden = false;
    return err('لم نجد غرفة بهذا الرمز. اكتب الرمز الصحيح من المعلم.');
  }
  S.name = name;
  S.meta = meta;
  S.wantJoin = true;
  saveProfile();
  enterRoom();
}

// ---------------------------------------------------------------- الاشتراك في الغرفة
function unsubAll() {
  Object.values(S.unsub).forEach(fn => { try { fn && fn(); } catch { } });
  S.unsub = {};
}
function urlWithSession() {
  const u = new URL(location.href);
  if (!S.solo) u.searchParams.set('session', S.code);
  return u.toString();
}

function enterRoom() {
  try { history.replaceState(null, '', urlWithSession()); } catch { }
  unsubAll();
  S.unsub.meta = S.b.on(P.meta(S.code), m => { S.meta = m; route(); },
    e => { console.warn(e); showMsg('🔒', 'تعذّر فتح الغرفة', 'حاول مرة أخرى بعد قليل.', { btn: { text: 'إعادة المحاولة', fn: () => location.reload() } }); });
  S.unsub.me = S.b.on(P.student(S.code, S.b.uid), me => {
    if (me && typeof me.name !== 'string') me = null; // سجل ناقص = غير موجود
    const had = S.me;
    S.me = me;
    if (!me && S.joined && had) return onRemoved();
    route();
  });
  if (S.joined) S.api.presence(S.code).catch(() => { });
}

function watchStudents(on) {
  if (on && !S.unsub.students) {
    S.unsub.students = S.b.on(P.students(S.code), v => { S.students = v || {}; onStudents(); });
  } else if (!on && S.unsub.students) {
    S.unsub.students(); delete S.unsub.students; S.students = null;
  }
}

function onRemoved() {
  if (S.api) S.api.cancelPresence(S.code).catch(() => { });
  S.joined = false; S.wantJoin = false;
  resetLocal();
  unsubAll();
  openNameScreen();
  $('name-error').textContent = 'تمت إزالتك من الغرفة. يمكنك الدخول مرة أخرى باسمك الأول.';
}

function watchConnection() {
  let first = true, t = null;
  S.b.onConnected(c => {
    clearTimeout(t);
    if (c) {
      $('net-banner').hidden = true;
      if (S.joined) S.api.presence(S.code).catch(() => { });
    } else {
      t = setTimeout(() => { $('net-banner').hidden = false; }, first ? 5000 : 1500);
    }
    first = false;
  });
}

// ---------------------------------------------------------------- الموجِّه الرئيسي
function route() {
  const m = S.meta;
  if (!S.joined) return routeNotJoined();
  if (!m) {
    hideOverlays(); stopTimer();
    return showMsg('🚪', 'الغرفة غير متاحة', 'أغلق المعلم هذه الغرفة أو حذفها.');
  }
  const me = S.me;
  if (!me) return; // بانتظار وصول بيانات الطالب
  if (S.round !== me.round) { resetLocal(); S.round = me.round; }

  if (m.status === 'waiting') {
    hideOverlays(); stopTimer();
    if (S.solo) { clearTimeout(S.soloTimer); S.soloTimer = setTimeout(() => S.api.start(S.code), 1200); }
    return showWait();
  }
  if (m.status === 'playing' || m.status === 'paused') return onPlaying();
  if (m.status === 'finished') return onFinished();
}

function routeNotJoined() {
  const m = S.meta;
  if (!S.wantJoin) return;
  if (!m) return showMsg('🔍', 'الغرفة غير موجودة', 'تأكد من الرمز مع المعلم.', { btn: { text: 'إدخال رمز آخر', fn: () => { S.code = ''; S.codeFromUrl = false; unsubAll(); openNameScreen(); } } });
  const st = m.status;
  const canJoin = st === 'waiting' || (st === 'playing' && CONFIG.allowLateJoin);
  if (canJoin) {
    if (S.joining) return;
    S.joining = true;
    S.api.join(S.code, { name: S.name, avatar: S.avatar }, m).then(() => {
      S.joining = false; S.joined = true;
      if (st === 'playing') toast('بدأت اللعبة قبل دخولك — سيُحسب وقتك من الآن ⏱');
      S.api.presence(S.code).catch(() => { });
      route();
    }).catch(err => {
      console.warn(err);
      S.joining = false;
      setTimeout(route, 1500); // قد تكون حالة الغرفة تغيّرت للتو — نعيد المحاولة
    });
    return;
  }
  if (st === 'paused') return showMsg('⏸️', 'اللعبة متوقفة مؤقتاً', 'ستدخل تلقائياً عندما يستأنف المعلم اللعبة.');
  if (st === 'finished') return showMsg('🏁', 'انتهت هذه الجولة', 'ستدخل تلقائياً عندما يبدأ المعلم جولة جديدة.');
  return showMsg('⏳', 'بدأت اللعبة', 'انتظر حتى يبدأ المعلم جولة جديدة، وستدخل تلقائياً.');
}

function resetLocal() {
  S.game = null; S.idx = 0; S.correct = 0; S.points = 0; S.streak = 0;
  S.stageShown = -1; S.timeUp = false; S.endShown = false; S.locked = false;
  stopTimer(); hideOverlays();
  $('stage').innerHTML = ''; $('fx').innerHTML = '';
  const w = $('walker'); w.style.transform = ''; w.className = 'walker';
}

// ---------------------------------------------------------------- الانتظار
function showWait() {
  watchStudents(true);
  S.phase = 'wait';
  setScene('dusk');
  $('wait-avatar').innerHTML = avatarSVG(S.me.avatar | 0);
  $('wait-hello').textContent = `أهلاً ${S.me.name} 👋`;
  $('wait-note').textContent = S.solo ? 'وضع التجربة: ستبدأ اللعبة تلقائياً.' : '';
  onStudents();
  show('s-wait');
}

function onStudents() {
  if (!S.students) return;
  if (S.phase === 'wait') {
    const list = Object.values(S.students).filter(s => s && s.name);
    $('wait-count').textContent = studentsLabel(list.length);
    const crowd = $('wait-crowd');
    const shown = list.slice(0, 40);
    if (crowd.childElementCount !== shown.length) crowd.innerHTML = shown.map(s => avatarSVG(s.avatar | 0)).join('');
  } else if (S.phase === 'done') {
    updateDoneRank();
  } else if (S.phase === 'final') {
    renderFinal();
  }
}

// ---------------------------------------------------------------- اللعب
function ensureGame() {
  if (S.game) return;
  S.game = buildGame(`${S.code}|${S.b.uid}|${S.me.round}`, QUESTIONS, STAGES, LESSON);
  S.idx = Math.min(S.me.answered | 0, S.game.length);
  S.correct = S.me.correct | 0;
  S.points = S.me.points | 0;
  S.stageShown = -1;
}

function onPlaying() {
  ensureGame();
  if (S.me.finished || S.idx >= S.game.length || S.timeUp) {
    hideOverlays();
    return showDone();
  }
  if (S.phase !== 'play' && S.phase !== 'countdown') startPlay();
  $('ov-pause').hidden = S.meta.status !== 'paused';
}

function startPlay() {
  watchStudents(false);
  S.phase = 'play';
  show('s-play');
  $('walker').querySelector('.walker-inner').innerHTML = avatarSVG(S.me.avatar | 0);
  $('map').innerHTML = mapHTML();
  updateHud();
  startTimer();
  const base = gameBase(S.meta, S.me);
  if (base - S.b.now() > 400) {
    S.phase = 'countdown';
    runCountdown(base).then(() => { if (S.phase === 'countdown') { S.phase = 'play'; nextQuestion(); } });
  } else {
    nextQuestion();
  }
}

function runCountdown(base) {
  return new Promise(res => {
    const ov = $('ov-countdown'), num = $('cd-num');
    ov.hidden = false;
    setScene('dusk');
    let last = null;
    clearInterval(S.cdTimer);
    S.cdTimer = setInterval(() => {
      if (!S.meta || S.meta.status === 'finished') { clearInterval(S.cdTimer); ov.hidden = true; return res(); }
      const rem = Math.ceil((base - S.b.now()) / 1000);
      if (rem > 0 && rem !== last) {
        last = rem;
        num.textContent = String(rem);
        num.className = 'cd-num';
        void num.offsetWidth;
        num.classList.add('pulse');
        sound.sfx.tick();
      } else if (rem <= 0) {
        clearInterval(S.cdTimer);
        num.textContent = 'انطلق!';
        num.className = 'cd-num go pulse';
        sound.sfx.go();
        setTimeout(() => { ov.hidden = true; res(); }, 650);
      }
    }, 80);
  });
}

function mapHTML() {
  return STAGES.map((s, i) =>
    `<li class="st" data-s="${i}" aria-label="المرحلة ${i + 1}: ${esc(s.place)}"><span aria-hidden="true">${s.icon}</span><span class="st-name">${esc(s.place)}</span></li>`
  ).join('') + `<li class="me" aria-hidden="true"><div class="walker-inner">${avatarSVG(S.avatar < 0 ? 0 : S.avatar)}</div></li>`;
}

function mapProgress() {
  if (!S.game) return 0;
  const i = Math.min(S.idx, S.game.length - 1);
  const s = S.game[i].stage;
  const b = BOUNDS[s];
  const frac = S.idx >= S.game.length ? 1 : (S.idx - b.start) / (b.end - b.start);
  return Math.min(1, (s + frac) / (STAGES.length - 1));
}

function paintMap(el, stageIdx, p) {
  el.style.setProperty('--p', p);
  el.querySelectorAll('.st').forEach(li => {
    const i = +li.dataset.s;
    li.classList.toggle('done', i < stageIdx);
    li.classList.toggle('now', i === stageIdx);
    if (i === stageIdx) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
  });
}

function updateHud() {
  $('hud-points').textContent = S.points;
  if (S.game) {
    const s = S.game[Math.min(S.idx, S.game.length - 1)].stage;
    paintMap($('map'), S.idx >= S.game.length ? STAGES.length : s, mapProgress());
  }
}

function startTimer() {
  stopTimer();
  const tick = () => {
    if (!S.meta || !S.me) return;
    const ms = liveElapsed(S.meta, S.me, S.b.now());
    $('hud-time').textContent = formatTime(ms);
    const limit = S.meta.timeLimitMs || 0;
    if (limit && ms >= limit && !S.timeUp && S.meta.status === 'playing' && (S.phase === 'play')) {
      S.timeUp = true; S.locked = true;
      toast('انتهى الوقت ⏰');
      setTimeout(showDone, 900);
    }
  };
  tick();
  S.timer = setInterval(tick, 250);
}
function stopTimer() { clearInterval(S.timer); S.timer = null; }

function showStageIntro(s) {
  return new Promise(res => {
    setScene(SCENES[s] || 'dusk');
    const ov = $('ov-stage'), map = $('intro-map');
    map.innerHTML = mapHTML();
    const n = STAGES.length - 1;
    paintMap(map, s, Math.max(0, s - 1) / n);
    $('intro-kicker').textContent = `المرحلة ${s + 1} من ${STAGES.length}`;
    $('intro-title').textContent = `${STAGES[s].icon} ${STAGES[s].title}`;
    $('intro-hint').textContent = STAGES[s].hint;
    ov.hidden = false;
    sound.sfx.stage();
    requestAnimationFrame(() => requestAnimationFrame(() => map.style.setProperty('--p', s / n)));
    let done = false;
    const finish = () => {
      if (done) return;
      done = true; clearTimeout(t); ov.hidden = true; S.introClose = null; res();
    };
    const t = setTimeout(finish, reduceMotion ? 1800 : 2800);
    $('intro-go').onclick = () => { sound.sfx.tap(); finish(); };
    S.introClose = finish;
  });
}

function nextQuestion() {
  if (!S.meta || S.meta.status === 'finished' || S.phase !== 'play') return;
  if (S.idx >= S.game.length) return showDone();
  const item = S.game[S.idx];
  if (item.stage !== S.stageShown) {
    S.stageShown = item.stage;
    return showStageIntro(item.stage).then(renderQuestion);
  }
  renderQuestion();
}

// ---------------------------------------------------------------- رسم السؤال
function sentenceHTML(text, small) {
  if (!text) return '';
  const words = text.trim().split(/\s+/);
  const inner = words.map((w, i) => w === '___'
    ? '<span class="blank" aria-label="فراغ"></span>'
    : `<span class="w" data-w="${i}">${esc(w)}</span>`).join(' ');
  return `<p class="sentence${small ? ' small' : ''}">${inner}</p>`;
}

const CHIP = { noun: '◆', verb: '⚡', harf: '✦' };
function optClass(o) {
  if (LESSON && LESSON.styles) return LESSON.styles[o] ? LESSON.styles[o][0] : 'plain';
  if (o === 'اسمية' || o === 'اسم') return 'noun';
  if (o === 'فعلية' || o === 'فعل') return 'verb';
  if (o === 'حرف') return 'harf';
  return 'plain';
}
function optChip(o) {
  if (LESSON && LESSON.styles) return LESSON.styles[o] ? LESSON.styles[o][1] : '';
  return CHIP[optClass(o)] || '';
}

function optionsHTML(item) {
  const long = item.options.some(o => o.length > 22) || (item.options.length !== 3 && item.options.some(o => o.length > 14));
  const cols = long ? 'opts-col' : item.options.length === 3 ? 'opts-3' : item.options.length === 2 ? 'opts-2' : 'opts-col';
  return `<div class="options ${cols}">` + item.options.map((o, i) => {
    const c = optClass(o);
    const isSentence = c === 'plain' && /\s/.test(o) && /[.؟]$/.test(o);
    return `<button type="button" class="opt ${c}${isSentence ? ' sentence-opt' : ''}" data-i="${i}">
      ${c !== 'plain' ? `<span class="chip" aria-hidden="true">${optChip(o)}</span>` : ''}<span>${esc(o)}</span><span class="mark" aria-hidden="true"></span></button>`;
  }).join('') + '</div>';
}

function renderQuestion() {
  if (!S.meta || S.meta.status === 'finished' || S.phase !== 'play') return;
  const item = S.game[S.idx];
  const b = BOUNDS[item.stage];
  const count = `<div class="q-count">السؤال ${S.idx - b.start + 1} من ${b.end - b.start}</div>`;
  const walker = $('walker');
  walker.style.transform = '';
  walker.className = 'walker' + (item.kind === 'gate' ? ' center' : '') + (item.kind === 'speed' ? ' run' : '');
  let html = '';

  if (item.kind === 'gate') {
    html = `<div class="q-wrap kind-gate enter">${count}
      <div class="banner"><div class="board">${sentenceHTML(item.text)}</div></div>
      <div class="gates">${item.options.map((o, i) => {
        const c = optClass(o);
        const label = LESSON ? esc(o) : `الجملة ${esc(o)}`;
        return `<button type="button" class="gate ${c}" data-i="${i}" aria-label="${label}">
          <div class="arch"><div class="arch-in"><span class="door a"></span><span class="door b"></span></div></div>
          <span class="gate-label">${optChip(o)} ${label}</span><span class="mark" aria-hidden="true"></span></button>`;
      }).join('')}</div>
      <p class="explain" aria-live="polite"></p></div>`;
  } else if (item.kind === 'speed') {
    html = `<div class="q-wrap kind-speed enter">
      <div class="speed-top">${count}<span class="streak${S.streak >= 2 ? ' on' : ''}">🔥 ×${S.streak}</span></div>
      <div class="board">${sentenceHTML(item.text)}</div>
      ${optionsHTML(item)}
      <p class="explain" aria-live="polite"></p></div>`;
  } else {
    const hasText = !!item.text;
    const smallText = item.kind === 'final' && item.text.length > 26;
    html = `<div class="q-wrap kind-${item.kind} enter">${count}
      ${hasText ? `<div class="board">${sentenceHTML(item.text, smallText)}</div>` : ''}
      <p class="prompt">${esc(item.question)}</p>
      ${optionsHTML(item)}
      <p class="explain" aria-live="polite"></p></div>`;
  }
  const stage = $('stage');
  stage.innerHTML = html;
  stage.scrollTop = 0;
  S.locked = false;
  S.qStart = performance.now();
}

// ---------------------------------------------------------------- الإجابة
function onPick(btn) {
  if (S.locked || !S.meta || S.meta.status !== 'playing' || S.timeUp || S.phase !== 'play') return;
  S.locked = true;
  const item = S.game[S.idx];
  const i = +btn.dataset.i;
  const ok = item.options[i] === item.answer;
  const ms = performance.now() - S.qStart;
  const pts = ok ? pointsFor(ms, item.kind === 'speed', CONFIG.scoring) : 0;
  const index = S.idx;

  S.idx++;
  if (ok) { S.correct++; S.points += pts; S.streak++; } else { S.streak = 0; }
  const finished = S.idx >= S.game.length;

  S.api.answer(S.code, index, ok, {
    answered: S.idx, correct: S.correct, points: S.points, stage: item.stage, finished
  }, S.meta.pausedMs || 0).catch(onWriteError);

  $('stage').querySelectorAll('[data-i]').forEach(b => { b.disabled = true; });
  if (item.kind === 'gate') {
    walkTo(btn);
    setTimeout(() => feedback(item, btn, ok, pts), reduceMotion ? 0 : 380);
  } else {
    feedback(item, btn, ok, pts);
  }

  const F = CONFIG.feedbackMs;
  let delay = item.kind === 'speed' ? (ok ? F.speedCorrect : F.speedWrong) : (ok ? F.correct : F.wrong);
  if (item.kind === 'gate') delay += 450;
  setTimeout(() => {
    if (!S.meta || S.meta.status === 'finished' || S.phase !== 'play') return;
    if (finished) showDone(); else nextQuestion();
  }, delay);
}

function walkTo(btn) {
  if (reduceMotion) return;
  const w = $('walker');
  const wr = w.getBoundingClientRect();
  const gr = btn.querySelector('.arch').getBoundingClientRect();
  const dx = (gr.left + gr.width / 2) - (wr.left + wr.width / 2);
  const dy = (gr.bottom - wr.height * 0.4) - wr.bottom;
  w.style.transform = `translate(${dx}px, ${dy}px) scale(.62)`;
}

function feedback(item, btn, ok, pts) {
  const all = [...$('stage').querySelectorAll('[data-i]')];
  const right = all.find(b => item.options[+b.dataset.i] === item.answer);
  const w = $('walker');
  if (ok) {
    btn.classList.add('is-correct');
    if (item.kind === 'gate') btn.classList.add('open');
    sound.sfx.correct();
    burst(btn);
    floatPoints(btn, pts);
    say(pick(PRAISE), 'good');
    if (item.kind !== 'gate') { w.classList.remove('jump'); void w.offsetWidth; w.classList.add('jump'); }
  } else {
    btn.classList.add('is-wrong');
    if (right) { right.classList.add('is-correct'); if (item.kind === 'gate') right.classList.add('open'); }
    sound.sfx.wrong();
    say(pick(ENCOURAGE), 'bad');
    w.classList.remove('oops'); void w.offsetWidth; w.classList.add('oops');
    if (item.kind === 'gate') setTimeout(() => { w.style.transform = ''; }, 500);
    const ex = $('stage').querySelector('.explain');
    if (ex) { ex.textContent = `الإجابة الصحيحة: ${item.answer} — ${item.explain}`; ex.classList.add('show'); }
  }
  all.forEach(b => { if (b !== btn && b !== right) b.classList.add('is-dim'); });
  highlightKey(item);
  const st = $('stage').querySelector('.streak');
  if (st) { st.textContent = `🔥 ×${S.streak}`; st.classList.toggle('on', S.streak >= 2); }
  updateHud();
}

// تلوين الكلمة الأولى (أو الكلمة المفتاحية) لتثبيت القاعدة
function highlightKey(item) {
  const sentence = $('stage').querySelector('.sentence');
  if (!sentence) return;
  if (LESSON) return highlightLesson(item, sentence);
  let span = null, cls = null, tag = null;
  const isType = item.options.length === 2 && item.options.includes('اسمية') && item.options.includes('فعلية');
  if (item.kind === 'first') {
    span = sentence.querySelector('.w[data-w="0"]');
    cls = optClass(item.answer); tag = item.answer;
  } else if (isType) {
    span = sentence.querySelector('.w[data-w="0"]');
    cls = item.answer === 'فعلية' ? 'verb' : 'noun';
    tag = cls === 'verb' ? 'فعل' : 'اسم';
  } else if (item.kind === 'final') {
    span = [...sentence.querySelectorAll('.w')].find(s => s.textContent === item.answer);
    if (span) { cls = /فعلية/.test(item.question) ? 'verb' : 'noun'; tag = cls === 'verb' ? 'فعل' : 'اسم'; }
  }
  if (!span || !cls) return;
  span.classList.add('key', cls);
  span.insertAdjacentHTML('beforeend', `<span class="tag">${tag}</span>`);
}

// وضع الدرس: وسم أجزاء التركيب (ظرف + مضاف إليه، جار + مجرور، موصوف + صفة)
function highlightLesson(item, sentence) {
  const words = [...sentence.querySelectorAll('.w')];
  if (!words.length) return;
  const mark = (span, cls, tag) => {
    if (!span || span.classList.contains('key')) return;
    span.classList.add('key', cls);
    span.insertAdjacentHTML('beforeend', `<span class="tag">${esc(tag)}</span>`);
  };
  const parts = LESSON.parts || {};
  const type = parts[item.answer] ? item.answer : (item.of && parts[item.of] ? item.of : null);
  if (type) {
    const cls = optClass(type);
    parts[type].forEach((tag, k) => mark(words[item.at + k], cls === 'plain' ? 'noun' : cls, tag));
    return;
  }
  const whole = LESSON.wholeTags && LESSON.wholeTags[item.answer];
  if (whole && item.kind !== 'final') mark(words[words.length - 1], optClass(item.answer) === 'plain' ? 'noun' : optClass(item.answer), whole);
}

function say(text, cls) {
  const b = $('bubble');
  b.textContent = text;
  b.className = 'bubble show ' + cls;
  clearTimeout(say._t);
  say._t = setTimeout(() => { b.className = 'bubble'; }, 1100);
}

function burst(el) {
  if (reduceMotion) return;
  const fx = $('fx'), fr = fx.getBoundingClientRect(), r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2 - fr.left, cy = r.top + r.height / 2 - fr.top;
  for (let i = 0; i < 8; i++) {
    const s = document.createElement('span');
    s.className = 'star'; s.textContent = '★';
    const ang = (Math.PI * 2 * i) / 8 + Math.random() * 0.5;
    const d = 70 + Math.random() * 50;
    s.style.left = cx + 'px'; s.style.top = cy + 'px';
    s.style.setProperty('--dx', Math.cos(ang) * d + 'px');
    s.style.setProperty('--dy', Math.sin(ang) * d + 'px');
    fx.appendChild(s);
    setTimeout(() => s.remove(), 800);
  }
}

function floatPoints(el, pts) {
  const fx = $('fx'), fr = fx.getBoundingClientRect(), r = el.getBoundingClientRect();
  const p = document.createElement('span');
  p.className = 'plus'; p.textContent = `+${pts}`;
  p.style.left = (r.left + r.width / 2 - fr.left) + 'px';
  p.style.top = (r.top - fr.top) + 'px';
  fx.appendChild(p);
  setTimeout(() => p.remove(), 950);
}

function onWriteError(err) {
  console.warn('write failed', err);
  if (!S.meta || S.meta.status === 'finished') return;
  // رُفضت الإجابة (مثلاً أوقف المعلم اللعبة في نفس اللحظة): نعيد المزامنة مع الخادم ونعيد السؤال
  if (S.resyncing) return;
  S.resyncing = true;
  setTimeout(async () => {
    const me = await safeGet(P.student(S.code, S.b.uid));
    S.resyncing = false;
    if (!me || !S.game) return;
    if ((me.answered | 0) < S.idx) {
      S.idx = me.answered | 0; S.correct = me.correct | 0; S.points = me.points | 0;
      toast('لم تُحفظ إجابتك الأخيرة — أجب عنها مرة أخرى');
      if (S.phase === 'done') { S.phase = 'play'; show('s-play'); startTimer(); }
      if (S.phase === 'play') { S.stageShown = S.game[S.idx].stage; renderQuestion(); updateHud(); }
    }
  }, 800);
}

// ---------------------------------------------------------------- نهاية الطالب
function showDone() {
  if (S.phase === 'done') return updateDoneStats();
  S.phase = 'done';
  stopTimer();
  hideOverlays();
  setScene('castle');
  $('done-avatar').innerHTML = avatarSVG(S.me ? S.me.avatar | 0 : S.avatar);
  $('done-title').textContent = S.timeUp ? `انتهى الوقت يا ${S.name}!` : `🎉 أحسنت يا ${S.name}!`;
  updateDoneStats();
  show('s-done');
  sound.sfx.win();
  confetti(26);
  watchStudents(true);
  if (S.solo) { clearTimeout(S.soloTimer); S.soloTimer = setTimeout(() => S.api.finish(S.code), 2500); }
}

function updateDoneStats() {
  const answered = Math.max(S.idx, S.me ? S.me.answered | 0 : 0);
  $('done-score').textContent = `${S.correct} / ${TOTAL}`;
  $('done-acc').textContent = `${answered ? Math.round((S.correct / answered) * 100) : 0}%`;
  const t = S.me && S.me.lastAt && (S.me.answered | 0) === answered ? studentTimeMs(S.meta, S.me) : liveElapsed(S.meta, S.me, S.b.now());
  $('done-time').textContent = formatTime(t);
  $('done-points').textContent = `★ ${S.points} نقطة`;
  updateDoneRank();
}

function updateDoneRank() {
  if (!S.students || !S.meta) return;
  const list = rankStudents(S.students, S.meta);
  const me = list.find(s => s.id === S.b.uid);
  if (me) $('done-rank').textContent = `#${me.rank}`;
}

// ---------------------------------------------------------------- نهاية الجولة
function onFinished() {
  stopTimer();
  S.locked = true;
  hideOverlays();
  if (!S.game) ensureGame();
  const midGame = S.phase === 'play' || S.phase === 'countdown';
  if (midGame && !S.endShown) {
    S.endShown = true;
    S.phase = 'ending';
    $('ov-end').hidden = false;
    sound.sfx.end();
    setTimeout(() => { $('ov-end').hidden = true; showFinal(); }, 2200);
    return;
  }
  if (S.phase !== 'ending') showFinal();
}

function showFinal() {
  if (!S.meta || S.meta.status !== 'finished') return;
  const first = S.phase !== 'final';
  S.phase = 'final';
  setScene('castle');
  watchStudents(true);
  renderFinal();
  if (first) { show('s-final'); confetti(60); sound.sfx.win(); }
}

function renderFinal() {
  if (!S.students) { $('podium').innerHTML = '<div class="loader"></div>'; return; }
  const list = rankStudents(S.students, S.meta);
  const medal = ['🥇', '🥈', '🥉'];
  const top = list.slice(0, 3);
  const order = [top[1], top[0], top[2]].filter(Boolean); // الثاني يمين، الأول في الوسط، الثالث يسار
  $('podium').innerHTML = order.map(s => {
    const n = list.indexOf(s) + 1;
    return `<div class="pod pod-${n}">
      ${avatarSVG(s.avatar)}
      <div class="pod-name">${esc(s.name)}</div>
      <div class="pod-block"><span class="pod-medal">${medal[n - 1]}</span>
      <span class="pod-score">${s.correct}/${TOTAL}</span><span class="pod-time">${formatTime(s.timeMs)}</span></div></div>`;
  }).join('');
  const me = list.find(s => s.id === S.b.uid);
  $('my-final').innerHTML = me ? `ترتيبك: <strong>#${me.rank}</strong> من ${list.length} — ${me.correct}/${TOTAL} في ${formatTime(me.timeMs)}` : '';
  $('final-list').innerHTML = list.map(s => `
    <li class="${s.id === S.b.uid ? 'me' : ''}">
      <span class="r">${s.rank <= 3 ? medal[s.rank - 1] : s.rank}</span>${avatarSVG(s.avatar)}
      <span class="n">${esc(s.name)}${s.finished ? '' : ` <span class="part">(أجاب عن ${s.answered})</span>`}</span>
      <span class="sc">${s.correct}/${TOTAL}</span><span class="tm">${formatTime(s.timeMs)}</span></li>`).join('');
}

// ---------------------------------------------------------------- احتفال
function confetti(n) {
  if (reduceMotion) return;
  const box = $('confetti');
  const colors = ['#FFC53D', '#1F7FC0', '#E0600F', '#138A5E', '#7B4FD0', '#E5484D'];
  for (let i = 0; i < n; i++) {
    const c = document.createElement('i');
    c.style.left = Math.random() * 100 + 'vw';
    c.style.background = colors[i % colors.length];
    c.style.setProperty('--x', (Math.random() * 160 - 80) + 'px');
    c.style.animationDuration = (2.4 + Math.random() * 1.8) + 's';
    c.style.animationDelay = (Math.random() * 0.6) + 's';
    box.appendChild(c);
    setTimeout(() => c.remove(), 5200);
  }
}

// ---------------------------------------------------------------- وضع التجربة الفردي
async function ensureSoloRoom() {
  const meta = await S.b.get(P.meta('0000'));
  if (!meta) await S.api.createRoom((LESSON && LESSON.title) || CONFIG.gameTitle, TOTAL, '0000');
  else if (meta.status !== 'waiting') await S.api.resetRoom('0000', meta);
}

boot();
