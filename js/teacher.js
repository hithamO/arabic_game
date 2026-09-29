// =====================================================================
//  لوحة المعلم
// =====================================================================
import { CONFIG } from './config.js';
import {
  rankStudents, formatTime, esc, studentsLabel, duplicateNames, totalQuestions
} from './game.js';
import { connect, makeApi, P, isDemo, isConfigured } from './firebase.js';
import { AVATARS, avatarSVG } from './avatars.js';

const $ = id => document.getElementById(id);
const TOTAL = totalQuestions(CONFIG.stages);
const STATUS_TXT = { waiting: 'بانتظار البدء', playing: 'اللعبة جارية', paused: 'متوقفة مؤقتاً', finished: 'انتهت الجولة' };
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const medal = ['🥇', '🥈', '🥉'];

const T = {
  b: null, api: null, code: '', meta: null, students: null,
  unsub: [], clock: null, busy: false, boardOpen: false, autoFinishing: false
};

// ---------------------------------------------------------------- أدوات
const SECTIONS = ['t-boot', 't-msg', 't-login', 't-denied', 't-home', 't-room'];
function view(id) { SECTIONS.forEach(s => { $(s).hidden = s !== id; }); window.scrollTo(0, 0); }

function toast(msg, ms = 2600) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), ms);
}

function message(icon, title, text, actions = []) {
  $('t-msg-icon').textContent = icon;
  $('t-msg-title').textContent = title;
  $('t-msg-text').innerHTML = text;
  const box = $('t-msg-actions');
  box.innerHTML = '';
  for (const a of actions) {
    const el = document.createElement(a.href ? 'a' : 'button');
    el.className = 'btn ' + (a.cls || 'btn-ink');
    el.textContent = a.text;
    if (a.href) el.href = a.href; else { el.type = 'button'; el.onclick = a.fn; }
    box.appendChild(el);
  }
  view('t-msg');
}

const roomKey = () => 'mj-teacher-room:' + (T.b ? T.b.uid : '');

function studentLink(code) {
  let base = (CONFIG.baseUrl || '').trim();
  if (!base) base = new URL('./', location.href).href;
  const u = new URL(base, location.href);
  u.search = '';
  u.hash = '';
  u.pathname = u.pathname.replace(/(teacher|index)(\.html)?$/, '');
  u.searchParams.set('session', code);
  if (isDemo) u.searchParams.set('demo', '1');
  return u.href;
}

// يمنع الضغط المزدوج على أزرار التحكم أثناء تنفيذ الأمر
async function run(btn, fn, okMsg) {
  if (T.busy) return;
  T.busy = true;
  if (btn) btn.disabled = true;
  try {
    await fn();
    if (okMsg) toast(okMsg);
  } catch (e) {
    console.error(e);
    toast(e && /PERMISSION_DENIED|permission/i.test(String(e.code || e.message))
      ? 'لا تملك صلاحية على هذه الغرفة.'
      : 'تعذّر تنفيذ الأمر. تحقق من الاتصال وحاول مرة أخرى.', 3500);
  } finally {
    T.busy = false;
    if (btn) btn.disabled = false;
    renderControls();
  }
}

// ---------------------------------------------------------------- البداية
async function boot() {
  if (!isConfigured && !isDemo) {
    return message('🛠️', 'لم يتم إعداد Firebase بعد',
      'أضف إعدادات Firebase في الملف <b>js/config.js</b> كما هو موضح في README.<br>يمكنك تجربة اللعبة الآن في وضع التجربة على هذا الجهاز.',
      [{ text: 'فتح وضع التجربة', href: 'teacher.html?demo=1', cls: 'btn-gold' }]);
  }
  try {
    T.b = await connect('teacher');
    T.api = makeApi(T.b);
  } catch (e) {
    console.error(e);
    return message('📡', 'تعذّر الاتصال', 'تأكد من اتصال الجهاز بالإنترنت ثم أعد تحميل الصفحة.',
      [{ text: 'إعادة المحاولة', fn: () => location.reload() }]);
  }
  document.querySelectorAll('[data-signout]').forEach(b => b.addEventListener('click', signOut));
  bindUi();

  if (isDemo) return afterLogin();
  const user = await T.b.waitAuth();
  if (user && !user.isAnonymous) return afterLogin();
  if (user && user.isAnonymous) await T.b.signOut(); // جلسة طالب قديمة على نفس الجهاز
  view('t-login');
  $('login-email').focus();
}

async function afterLogin() {
  view('t-boot');
  const ok = await T.api.isTeacher();
  if (!ok) {
    $('denied-uid').textContent = T.b.uid;
    return view('t-denied');
  }
  $('home-email').textContent = T.b.email || '';
  $('room-game').textContent = CONFIG.gameTitle;
  if (!$('create-title').value) $('create-title').value = 'الجملة الاسمية والجملة الفعلية';

  const saved = localStorage.getItem(roomKey());
  if (saved) {
    try {
      const meta = await T.b.get(P.meta(saved));
      if (meta && meta.owner === T.b.uid) return openRoom(saved);
    } catch (e) { console.warn(e); }
    localStorage.removeItem(roomKey());
  }
  view('t-home');
}

async function signOut() {
  stopRoom();
  try { await T.b.signOut(); } catch {}
  if (isDemo) return toast('وضع التجربة لا يحتاج تسجيل خروج.');
  location.reload();
}

// ---------------------------------------------------------------- تسجيل الدخول
const AUTH_ERR = {
  'auth/invalid-email': 'صيغة البريد الإلكتروني غير صحيحة.',
  'auth/invalid-credential': 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
  'auth/invalid-login-credentials': 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
  'auth/wrong-password': 'كلمة المرور غير صحيحة.',
  'auth/user-not-found': 'لا يوجد حساب بهذا البريد الإلكتروني.',
  'auth/too-many-requests': 'محاولات كثيرة. انتظر قليلاً ثم حاول مرة أخرى.',
  'auth/network-request-failed': 'لا يوجد اتصال بالإنترنت.',
  'auth/operation-not-allowed': 'تسجيل الدخول بالبريد وكلمة المرور غير مفعّل في Firebase (راجع README).',
  'auth/unauthorized-domain': 'هذا النطاق غير مضاف في Firebase ← Authentication ← Settings ← Authorized domains.'
};

async function onLogin(e) {
  e.preventDefault();
  const email = $('login-email').value.trim();
  const pass = $('login-pass').value;
  const err = $('login-error');
  err.hidden = true;
  if (!email || !pass) { err.textContent = 'اكتب البريد الإلكتروني وكلمة المرور.'; err.hidden = false; return; }
  const btn = $('login-btn');
  btn.disabled = true; btn.textContent = 'جارٍ الدخول…';
  try {
    await T.b.signInTeacher(email, pass);
    await afterLogin();
  } catch (ex) {
    console.warn(ex);
    err.textContent = AUTH_ERR[ex.code] || 'تعذّر تسجيل الدخول. حاول مرة أخرى.';
    err.hidden = false;
  } finally {
    btn.disabled = false; btn.textContent = 'دخول';
  }
}

// ---------------------------------------------------------------- الغرفة
async function onCreate(e) {
  e.preventDefault();
  const title = $('create-title').value.replace(/[<>]/g, '').trim().slice(0, 40) || CONFIG.gameTitle;
  const btn = $('create-btn');
  const err = $('create-error');
  err.hidden = true;
  btn.disabled = true; btn.textContent = 'جارٍ الإنشاء…';
  try {
    const code = await T.api.createRoom(title, TOTAL);
    await openRoom(code);
    toast('تم إنشاء الغرفة ' + code);
  } catch (ex) {
    console.error(ex);
    err.textContent = 'تعذّر إنشاء الغرفة. تأكد من الاتصال ومن إعداد قواعد قاعدة البيانات.';
    err.hidden = false;
  } finally {
    btn.disabled = false; btn.textContent = 'إنشاء الغرفة';
  }
}

async function openRoom(code) {
  stopRoom();
  T.code = code;
  T.meta = null;
  T.students = null;
  localStorage.setItem(roomKey(), code);
  $('room-code').textContent = code;
  $('qr-code').textContent = code;
  $('demo-note').hidden = !isDemo;
  if (isDemo) $('demo-open').href = studentLink(code);
  view('t-room');
  renderAll();

  T.unsub.push(T.b.on(P.meta(code), m => {
    const prev = T.meta && T.meta.status;
    T.meta = m;
    if (!m) {
      localStorage.removeItem(roomKey());
      stopRoom();
      toast('تم حذف الغرفة.');
      return view('t-home');
    }
    if (prev && prev !== 'finished' && m.status === 'finished') celebrate();
    renderAll();
  }, e => { console.warn(e); toast('انقطع الاتصال بالغرفة.'); }));

  T.unsub.push(T.b.on(P.students(code), s => { T.students = s || {}; renderAll(); }));
  T.clock = setInterval(tick, 500);
}

function stopRoom() {
  T.unsub.forEach(u => { try { u(); } catch {} });
  T.unsub = [];
  clearInterval(T.clock);
  T.clock = null;
}

// ---------------------------------------------------------------- الرسم
function renderAll() {
  if (!T.code) return;
  renderHeader();
  renderControls();
  renderStats();
  renderStudents();
  if (!$('ov-qr').hidden) renderQrCount();
  if (T.boardOpen) renderBoard();
}

function renderHeader() {
  const m = T.meta;
  $('room-title').textContent = (m && m.title) || CONFIG.gameTitle;
  const chip = $('room-status');
  const st = m ? m.status : '';
  chip.className = 'chip ' + st;
  chip.textContent = STATUS_TXT[st] || 'جارٍ التحميل…';
}

function renderControls() {
  const st = T.meta ? T.meta.status : '';
  const vis = {
    'c-start': st === 'waiting',
    'c-pause': st === 'playing',
    'c-resume': st === 'paused',
    'c-finish': st === 'playing' || st === 'paused',
    'c-results': true,
    'c-round': st === 'finished'
  };
  for (const [id, v] of Object.entries(vis)) $(id).hidden = !v;
  $('c-results').textContent = st === 'finished' ? '🏆 إظهار النتائج' : '📊 لوحة الترتيب المباشرة';
  const busy = T.busy || !st;
  for (const id of Object.keys(vis)) $(id).disabled = busy;
}

function studentList() {
  return rankStudents(T.students || {}, T.meta || {});
}

function renderStats() {
  const list = studentList();
  const st = T.meta ? T.meta.status : 'waiting';
  const finished = list.filter(s => s.finished);
  const started = list.filter(s => s.answered > 0);
  const playing = st === 'waiting' ? 0 : list.filter(s => !s.finished && s.online && (st !== 'finished')).length;
  $('st-joined').textContent = list.length;
  $('st-playing').textContent = playing;
  $('st-finished').textContent = finished.length;
  $('st-avg').textContent = started.length
    ? `${(started.reduce((a, s) => a + s.correct, 0) / started.length).toFixed(1)}/${TOTAL}`
    : '—';
  $('st-avgtime').textContent = finished.length
    ? formatTime(finished.reduce((a, s) => a + s.timeMs, 0) / finished.length)
    : '—';
  $('all-done').hidden = !(st === 'playing' || st === 'paused') || !list.length || finished.length !== list.length;

  const dups = duplicateNames(T.students);
  const warn = $('dup-warn');
  warn.hidden = !dups.length;
  if (dups.length) {
    warn.innerHTML = '⚠️ <b>أسماء مكررة:</b> ' +
      dups.map(d => `«${esc(d.name)}» (${d.count})`).join('، ') +
      ' — كل طالب له رقم خاص داخلياً، لكن اطلب منهم إضافة حرف أو اسم العائلة ليسهل التمييز.';
  }
  tick();
}

function renderStudents() {
  const list = studentList();
  const st = T.meta ? T.meta.status : 'waiting';
  const dupSet = new Set(duplicateNames(T.students).map(d => d.name));
  $('empty').hidden = list.length > 0;
  $('list-title').textContent = st === 'waiting' ? 'الطلاب في الغرفة' : 'الترتيب المباشر';
  $('list-sub').textContent = list.length ? `جاهزون: ${studentsLabel(list.length)}` : '';

  const lobby = $('lobby');
  const wrap = $('table-wrap');
  if (st === 'waiting') {
    wrap.hidden = true;
    // ترتيب الدخول
    const byJoin = list.slice().sort((a, b) => a.joinedAt - b.joinedAt);
    lobby.innerHTML = byJoin.map(s => `
      <div class="l-chip${dupSet.has(s.name) ? ' dup' : ''}${s.online ? '' : ' off'}" title="${esc(AVATARS[s.avatar] ? AVATARS[s.avatar].name : '')}">
        ${avatarSVG(s.avatar)}
        <span class="nm">${esc(s.name)}</span>
        <button class="x" type="button" data-remove="${esc(s.id)}" aria-label="إخراج ${esc(s.name)}">✕</button>
      </div>`).join('');
    return;
  }
  lobby.innerHTML = '';
  wrap.hidden = !list.length;
  $('t-body').innerHTML = list.map(s => {
    const pct = Math.round((s.answered / TOTAL) * 100);
    const acc = s.answered ? Math.round((s.correct / s.answered) * 100) : 0;
    const stageTxt = s.finished ? '<span class="badge ok">أنهى ✓</span>'
      : s.answered ? `<small>م${Math.min(5, (s.stage | 0) + 1)}</small>` : '';
    return `
      <tr class="${s.finished ? 'done' : ''}${dupSet.has(s.name) ? ' dup' : ''}">
        <td>${s.rank <= 3 && s.answered ? medal[s.rank - 1] : s.rank}</td>
        <td><div class="who-cell"><span class="dot${s.online ? '' : ' off'}" title="${s.online ? 'متصل' : 'غير متصل'}"></span>${avatarSVG(s.avatar)}<span class="nm">${esc(s.name)}</span></div></td>
        <td><div class="prog"><div class="bar"><i style="width:${pct}%"></i></div><small>${s.answered}/${TOTAL}</small>${stageTxt}</div></td>
        <td class="num">${s.correct}/${TOTAL} <small class="muted">(${acc}%)</small></td>
        <td class="num">${s.answered ? formatTime(s.timeMs) : '—'}</td>
        <td class="num">${s.points}</td>
        <td><button class="x" type="button" data-remove="${esc(s.id)}" aria-label="إخراج ${esc(s.name)}">✕</button></td>
      </tr>`;
  }).join('');
}

// ساعة الجولة + الإنهاء التلقائي عند انتهاء المدة القصوى
function tick() {
  const m = T.meta;
  const el = $('st-clock');
  const lbl = $('st-clock-l');
  if (!m || !m.startedAt || m.status === 'waiting') { el.textContent = '0:00'; lbl.textContent = 'زمن الجولة'; return; }
  let now = T.b.now();
  if (m.status === 'paused' && m.pausedAt) now = m.pausedAt;
  if (m.status === 'finished' && m.endedAt) now = m.endedAt;
  const beginAt = m.startedAt + (m.countdownMs || 0);
  if (now < beginAt) { el.textContent = String(Math.ceil((beginAt - now) / 1000)); lbl.textContent = 'العد التنازلي'; return; }
  const elapsed = Math.max(0, now - beginAt - (m.pausedMs || 0));
  if (m.timeLimitMs > 0) {
    const left = Math.max(0, m.timeLimitMs - elapsed);
    el.textContent = formatTime(left);
    lbl.textContent = 'الوقت المتبقي';
    if (left <= 0 && m.status === 'playing' && !T.autoFinishing) {
      T.autoFinishing = true;
      T.api.finish(T.code).then(() => toast('انتهت المدة المحددة للجولة.')).catch(console.error)
        .finally(() => { T.autoFinishing = false; });
    }
  } else {
    el.textContent = formatTime(elapsed);
    lbl.textContent = 'زمن الجولة';
  }
}

// ---------------------------------------------------------------- QR
function openQr() {
  const link = studentLink(T.code);
  $('qr-link').textContent = link;
  const box = $('qr-img');
  if (typeof qrcode === 'function') {
    const q = qrcode(0, 'M');
    q.addData(link);
    q.make();
    box.innerHTML = q.createSvgTag({ cellSize: 8, margin: 2, scalable: true, alt: 'QR' });
  } else {
    box.innerHTML = '<p>تعذّر تحميل مولّد QR. استخدم الرابط أدناه.</p>';
  }
  renderQrCount();
  $('ov-qr').hidden = false;
}
function renderQrCount() { $('qr-count').textContent = studentList().length; }

async function copyLink() {
  const link = studentLink(T.code);
  try {
    await navigator.clipboard.writeText(link);
    toast('تم نسخ رابط الطلاب ✓');
  } catch {
    // بديل للمتصفحات القديمة
    const ta = document.createElement('textarea');
    ta.value = link; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('تم نسخ رابط الطلاب ✓'); } catch { prompt('انسخ الرابط:', link); }
    ta.remove();
  }
}

// ---------------------------------------------------------------- لوحة النتائج
function openBoard() {
  T.boardOpen = true;
  $('ov-board').hidden = false;
  renderBoard();
  if (T.meta && T.meta.status === 'finished') celebrate(true);
}
function closeBoard() { T.boardOpen = false; $('ov-board').hidden = true; }

function renderBoard() {
  const list = studentList();
  const done = T.meta && T.meta.status === 'finished';
  $('board-title').innerHTML = done ? '🏆 النتائج النهائية' : '📊 الترتيب المباشر <span class="live-tag">مباشر</span>';
  $('board-sub').textContent = list.length
    ? `${(T.meta && T.meta.title) || CONFIG.gameTitle} · ${studentsLabel(list.length)}`
    : 'لا يوجد طلاب بعد';

  const podium = $('board-podium');
  if (done && list.length) {
    const top = list.slice(0, 3);
    const order = [top[1], top[0], top[2]].filter(Boolean);
    podium.innerHTML = order.map(s => {
      const n = list.indexOf(s) + 1;
      return `<div class="pod pod-${n}">${avatarSVG(s.avatar)}
        <div class="pod-name">${esc(s.name)}</div>
        <div class="pod-block"><span class="pod-medal">${medal[n - 1]}</span>
        <span class="pod-score">${s.correct}/${TOTAL}</span><span class="pod-time">${formatTime(s.timeMs)}</span></div></div>`;
    }).join('');
  } else podium.innerHTML = '';

  const rest = done ? list.slice(3) : list;
  $('board-list').innerHTML = rest.map(s => `
    <li>
      <span class="r">${s.rank <= 3 && s.answered ? medal[s.rank - 1] : s.rank}</span>${avatarSVG(s.avatar)}
      <span class="n">${esc(s.name)}${s.finished ? '' : ` <span class="part">(أجاب عن ${s.answered})</span>`}</span>
      <span class="sc">${s.correct}/${TOTAL}</span><span class="tm">${s.answered ? formatTime(s.timeMs) : '—'}</span></li>`).join('')
    || (done && list.length ? '' : '<li><span></span><span></span><span class="n">بانتظار الطلاب…</span></li>');
  $('ov-board').querySelector('.t-board-list').hidden = !rest.length && done;
}

function celebrate(small) {
  if (reduceMotion) return;
  const box = $('confetti');
  const colors = ['#FFC53D', '#1F7FC0', '#E0600F', '#138A5E', '#7B4FD0', '#E5484D'];
  const n = small ? 40 : 70;
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

// ---------------------------------------------------------------- CSV
function exportCsv() {
  const list = studentList();
  if (!list.length) return toast('لا توجد نتائج بعد.');
  const q = v => `"${String(v).replace(/"/g, '""')}"`;
  const rows = [['الترتيب', 'الاسم', 'الشخصية', 'الصحيحة', 'المُجاب عنها', 'عدد الأسئلة', 'الدقة %', 'الوقت', 'النقاط', 'أنهى']];
  for (const s of list) {
    rows.push([s.rank, s.name, AVATARS[s.avatar] ? AVATARS[s.avatar].name : '', s.correct, s.answered, TOTAL,
      s.answered ? Math.round((s.correct / s.answered) * 100) : 0, s.answered ? formatTime(s.timeMs) : '',
      s.points, s.finished ? 'نعم' : 'لا']);
  }
  const csv = '\uFEFF' + rows.map(r => r.map(q).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  const d = new Date();
  a.href = URL.createObjectURL(blob);
  a.download = `نتائج-${T.code}-${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}.csv`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}

// ---------------------------------------------------------------- الأوامر
function bindUi() {
  $('login-form').addEventListener('submit', onLogin);
  $('create-form').addEventListener('submit', onCreate);
  $('copy-uid').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(T.b.uid); toast('تم النسخ ✓'); } catch { prompt('انسخ الرمز:', T.b.uid); }
  });
  $('denied-retry').addEventListener('click', afterLogin);
  $('denied-out').addEventListener('click', signOut);

  $('btn-qr').addEventListener('click', openQr);
  $('btn-copy').addEventListener('click', copyLink);

  const menu = $('menu');
  const menuBtn = $('btn-menu');
  const closeMenu = () => { menu.hidden = true; menuBtn.setAttribute('aria-expanded', 'false'); };
  menuBtn.addEventListener('click', e => {
    e.stopPropagation();
    menu.hidden = !menu.hidden;
    menuBtn.setAttribute('aria-expanded', String(!menu.hidden));
  });
  document.addEventListener('click', e => { if (!menu.contains(e.target)) closeMenu(); });
  menu.addEventListener('click', e => {
    const act = e.target.closest('[data-act]');
    if (!act) return;
    closeMenu();
    ({ csv: exportCsv, reset: onReset, newroom: onNewRoom })[act.dataset.act]();
  });

  $('c-start').addEventListener('click', e => {
    const n = studentList().length;
    if (!n && !confirm('لا يوجد طلاب في الغرفة بعد. هل تريد البدء على أي حال؟')) return;
    run(e.currentTarget, () => T.api.start(T.code), 'بدأت اللعبة! 🚀');
  });
  $('c-pause').addEventListener('click', e => run(e.currentTarget, () => T.api.pause(T.code), 'تم الإيقاف المؤقت — توقف الوقت عند الجميع.'));
  $('c-resume').addEventListener('click', e => run(e.currentTarget, () => T.api.resume(T.code, T.meta), 'تم الاستئناف ▶'));
  $('c-finish').addEventListener('click', e => {
    const list = studentList();
    const left = list.filter(s => !s.finished).length;
    const q = left
      ? `ما زال ${studentsLabel(left)} لم يُكمل. هل تريد إنهاء اللعبة الآن وإظهار النتائج؟`
      : 'هل تريد إنهاء اللعبة وإظهار النتائج؟';
    if (!confirm(q)) return;
    run(e.currentTarget, async () => { await T.api.finish(T.code); openBoard(); }, 'انتهت الجولة 🏁');
  });
  $('c-results').addEventListener('click', openBoard);
  $('c-round').addEventListener('click', e => {
    if (!confirm('بدء جولة جديدة بنفس الطلاب؟ سيتم تصفير نتائج الجولة الحالية (يمكنك تنزيلها أولاً من «المزيد»).')) return;
    run(e.currentTarget, () => T.api.newRound(T.code, T.meta, T.students), 'جولة جديدة جاهزة — الطلاب في غرفة الانتظار.');
  });

  // إخراج طالب
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-remove]');
    if (!b) return;
    const id = b.dataset.remove;
    const s = T.students && T.students[id];
    if (!s || !confirm(`إخراج «${s.name}» من الغرفة؟`)) return;
    run(null, () => T.api.removeStudent(T.code, id), 'تم إخراج الطالب.');
  });

  // الإغلاق
  document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => {
    $('ov-qr').hidden = true;
    closeBoard();
  }));
  $('ov-qr').addEventListener('click', e => { if (e.target.id === 'ov-qr') $('ov-qr').hidden = true; });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { $('ov-qr').hidden = true; closeBoard(); closeMenu(); }
  });
}

function onReset() {
  if (!confirm('إفراغ الغرفة؟ سيخرج جميع الطلاب وتُحذف نتائجهم، ويبقى رمز الغرفة نفسه.')) return;
  run(null, () => T.api.resetRoom(T.code, T.meta), 'تم إفراغ الغرفة.');
}

function onNewRoom() {
  if (!confirm('إنشاء غرفة جديدة برمز جديد؟ سيتم حذف الغرفة الحالية ونتائجها.')) return;
  const old = T.code;
  run(null, async () => {
    const code = await T.api.createRoom((T.meta && T.meta.title) || CONFIG.gameTitle, TOTAL);
    await openRoom(code);
    try { await T.api.deleteRoom(old); } catch (e) { console.warn(e); }
  }, 'تم إنشاء غرفة جديدة.');
}

boot();
