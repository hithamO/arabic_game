// =====================================================================
//  طبقة البيانات
//  - في الوضع العادي: Firebase Realtime Database + Firebase Auth
//  - في وضع التجربة (?demo=1): قاعدة بيانات محلية داخل المتصفح
//    (تعمل على جهاز واحد فقط، مفيدة للتجربة قبل إعداد Firebase)
// =====================================================================
import { CONFIG } from './config.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
export const TS = { '.sv': 'timestamp' }; // وقت الخادم

export const isDemo = new URLSearchParams(location.search).has('demo');
export const isConfigured = !!(CONFIG.firebase && CONFIG.firebase.apiKey && CONFIG.firebase.databaseURL);

export async function connect(role) {
  return isDemo ? localAdapter(role) : firebaseAdapter();
}

// ---------------------------------------------------------------------
//  Firebase
// ---------------------------------------------------------------------
async function firebaseAdapter() {
  const [appMod, authMod, db] = await Promise.all([
    import(SDK + 'firebase-app.js'),
    import(SDK + 'firebase-auth.js'),
    import(SDK + 'firebase-database.js')
  ]);
  const app = appMod.initializeApp(CONFIG.firebase);
  const auth = authMod.getAuth(app);
  const database = db.getDatabase(app);
  let offset = 0;
  db.onValue(db.ref(database, '.info/serverTimeOffset'), s => { offset = s.val() || 0; });

  const firstAuth = new Promise(res => {
    const off = authMod.onAuthStateChanged(auth, u => { off(); res(u); });
  });

  return {
    kind: 'firebase',
    get uid() { return auth.currentUser ? auth.currentUser.uid : null; },
    get email() { return auth.currentUser ? auth.currentUser.email : ''; },
    get isAnonymous() { return auth.currentUser ? auth.currentUser.isAnonymous : true; },
    waitAuth: () => firstAuth,
    signInAnon: () => authMod.signInAnonymously(auth),
    signInTeacher: (email, pw) => authMod.signInWithEmailAndPassword(auth, email, pw),
    signOut: () => authMod.signOut(auth),
    now: () => Date.now() + offset,
    on(path, cb, onErr) {
      return db.onValue(db.ref(database, path), s => cb(s.val()), e => onErr && onErr(e));
    },
    get: async path => (await db.get(db.ref(database, path))).val(),
    set: (p, v) => db.set(db.ref(database, p), v),
    update: (p, v) => db.update(db.ref(database, p), v),
    remove: p => db.remove(db.ref(database, p)),
    onDisconnectSet: (p, v) => db.onDisconnect(db.ref(database, p)).set(v),
    onDisconnectCancel: p => db.onDisconnect(db.ref(database, p)).cancel(),
    onConnected: cb => db.onValue(db.ref(database, '.info/connected'), s => cb(!!s.val()))
  };
}

// ---------------------------------------------------------------------
//  وضع التجربة: قاعدة بيانات داخل localStorage تتزامن بين نوافذ نفس الجهاز
// ---------------------------------------------------------------------
function localAdapter(role) {
  const KEY = 'mj-demo-db';
  const listeners = new Set();
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  let tree = load();
  const parts = p => p.split('/').filter(Boolean);
  const getAt = p => parts(p).reduce((n, k) => (n && typeof n === 'object' ? n[k] : undefined), tree) ?? null;
  const resolve = v => {
    if (v && typeof v === 'object') {
      if (v['.sv'] === 'timestamp') return Date.now();
      const o = {};
      for (const [k, x] of Object.entries(v)) { const r = resolve(x); if (r !== null && r !== undefined) o[k] = r; }
      return Object.keys(o).length ? o : null;
    }
    return v === undefined ? null : v;
  };
  const setAt = (p, v) => {
    const ks = parts(p);
    const val = resolve(v);
    const stack = [];
    let n = tree;
    for (let i = 0; i < ks.length - 1; i++) {
      if (!n[ks[i]] || typeof n[ks[i]] !== 'object') {
        if (val === null) return;
        n[ks[i]] = {};
      }
      stack.push([n, ks[i]]);
      n = n[ks[i]];
    }
    const last = ks[ks.length - 1];
    if (val === null) delete n[last]; else n[last] = val;
    for (let i = stack.length - 1; i >= 0; i--) { // حذف الفروع الفارغة
      const [parent, k] = stack[i];
      if (parent[k] && typeof parent[k] === 'object' && !Object.keys(parent[k]).length) delete parent[k];
    }
  };
  const notify = () => {
    for (const l of listeners) {
      const v = getAt(l.path);
      const s = JSON.stringify(v);
      if (s !== l.last) { l.last = s; try { l.cb(v === null ? null : JSON.parse(s)); } catch (e) { console.error(e); } }
    }
  };
  const commit = fn => { tree = load(); fn(); localStorage.setItem(KEY, JSON.stringify(tree)); setTimeout(notify, 0); return Promise.resolve(); };
  window.addEventListener('storage', e => { if (e.key === KEY) { tree = load(); notify(); } });

  let uid = role === 'teacher' ? 'demo-teacher' : sessionStorage.getItem('mj-demo-uid');
  if (!uid) { uid = 'demo-' + Math.random().toString(36).slice(2, 10); sessionStorage.setItem('mj-demo-uid', uid); }

  return {
    kind: 'demo',
    uid,
    email: 'وضع التجربة',
    isAnonymous: role !== 'teacher',
    waitAuth: async () => ({ uid }),
    signInAnon: async () => ({ user: { uid } }),
    signInTeacher: async () => ({ user: { uid } }),
    signOut: async () => {},
    now: () => Date.now(),
    on(path, cb) {
      const l = { path, cb, last: undefined };
      listeners.add(l);
      setTimeout(() => { const v = getAt(path); l.last = JSON.stringify(v); cb(v); }, 0);
      return () => listeners.delete(l);
    },
    get: async p => { tree = load(); return JSON.parse(JSON.stringify(getAt(p))); },
    set: (p, v) => commit(() => setAt(p, v)),
    update: (p, obj) => commit(() => { for (const [k, v] of Object.entries(obj)) setAt(p + '/' + k, v); }),
    remove: p => commit(() => setAt(p, null)),
    onDisconnectSet: async () => {},
    onDisconnectCancel: async () => {},
    onConnected: cb => { setTimeout(() => cb(true), 0); return () => {}; }
  };
}

// ---------------------------------------------------------------------
//  واجهة اللعبة (نفسها في الوضعين)
// ---------------------------------------------------------------------
export const P = {
  meta: c => `sessions/${c}/meta`,
  students: c => `sessions/${c}/students`,
  student: (c, u) => `sessions/${c}/students/${u}`,
  session: c => `sessions/${c}`,
  teacher: u => `teachers/${u}`
};

export function makeApi(b) {
  return {
    // ---------------- الطالب ----------------
    join(code, { name, avatar }, meta) {
      const late = meta.status === 'playing';
      return b.set(P.student(code, b.uid), {
        name, avatar,
        joinedAt: TS,
        online: true,
        round: meta.round,
        startAt: late ? TS : 0,
        po: late ? (meta.pausedMs || 0) : 0,
        correct: 0, answered: 0, points: 0, stage: 0,
        finished: false, lastAt: 0, pz: 0
      });
    },
    updateProfile(code, { name, avatar }) {
      return b.update(P.student(code, b.uid), { name, avatar });
    },
    answer(code, index, ok, totals, pausedMs) {
      const u = b.uid;
      return b.update(P.session(code), {
        [`answers/${u}/${index}`]: ok ? 1 : 0,
        [`students/${u}/answered`]: totals.answered,
        [`students/${u}/correct`]: totals.correct,
        [`students/${u}/points`]: totals.points,
        [`students/${u}/stage`]: totals.stage,
        [`students/${u}/finished`]: totals.finished,
        [`students/${u}/lastAt`]: TS,
        [`students/${u}/pz`]: pausedMs || 0
      });
    },
    presence(code) {
      const p = P.student(code, b.uid) + '/online';
      return b.onDisconnectSet(p, false).then(() => b.set(p, true));
    },
    // عند إخراج الطالب: إلغاء «غير متصل» المؤجّل حتى لا يُنشئ سجلاً فارغاً
    cancelPresence(code) {
      return b.onDisconnectCancel(P.student(code, b.uid) + '/online');
    },

    // ---------------- المعلم ----------------
    async isTeacher() {
      if (b.kind === 'demo') return true;
      try { return !!(await b.get(P.teacher(b.uid))); } catch { return false; }
    },
    async createRoom(title, total, fixedCode) {
      for (let i = 0; i < 25; i++) {
        const code = fixedCode || String(1000 + Math.floor(Math.random() * 9000));
        let exists = null;
        try { exists = await b.get(P.meta(code)); } catch { exists = true; }
        if (exists && !fixedCode) continue;
        await b.set(P.session(code), {
          meta: {
            owner: b.uid, title, status: 'waiting', round: 1, total,
            createdAt: TS, startedAt: 0, countdownMs: CONFIG.countdownSeconds * 1000,
            pausedAt: 0, pausedMs: 0, endedAt: 0,
            timeLimitMs: (CONFIG.maxGameMinutes || 0) * 60000
          }
        });
        return code;
      }
      throw new Error('no-code');
    },
    start: code => b.update(P.meta(code), {
      status: 'playing', startedAt: TS, pausedAt: 0, pausedMs: 0, endedAt: 0,
      countdownMs: CONFIG.countdownSeconds * 1000
    }),
    pause: code => b.update(P.meta(code), { status: 'paused', pausedAt: TS }),
    resume: (code, meta) => b.update(P.meta(code), {
      status: 'playing',
      pausedMs: (meta.pausedMs || 0) + Math.max(0, b.now() - (meta.pausedAt || b.now())),
      pausedAt: 0
    }),
    finish: code => b.update(P.meta(code), { status: 'finished', endedAt: TS }),
    async newRound(code, meta, students) {
      const up = {
        'meta/status': 'waiting', 'meta/round': (meta.round || 1) + 1,
        'meta/startedAt': 0, 'meta/pausedAt': 0, 'meta/pausedMs': 0, 'meta/endedAt': 0,
        answers: null
      };
      for (const id of Object.keys(students || {})) {
        Object.assign(up, {
          [`students/${id}/round`]: (meta.round || 1) + 1,
          [`students/${id}/correct`]: 0, [`students/${id}/answered`]: 0,
          [`students/${id}/points`]: 0, [`students/${id}/stage`]: 0,
          [`students/${id}/finished`]: false, [`students/${id}/lastAt`]: 0,
          [`students/${id}/pz`]: 0, [`students/${id}/startAt`]: 0, [`students/${id}/po`]: 0
        });
      }
      return b.update(P.session(code), up);
    },
    resetRoom: (code, meta) => b.update(P.session(code), {
      'meta/status': 'waiting', 'meta/round': (meta.round || 1) + 1,
      'meta/startedAt': 0, 'meta/pausedAt': 0, 'meta/pausedMs': 0, 'meta/endedAt': 0,
      students: null, answers: null
    }),
    removeStudent: (code, id) => b.update(P.session(code), { [`students/${id}`]: null, [`answers/${id}`]: null }),
    deleteRoom: code => b.remove(P.session(code))
  };
}
