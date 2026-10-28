/**
 * demo-db.js — Db จำลองในเบราว์เซอร์ (localStorage) สำหรับโหมดทดลอง
 * มีเมธอดเหมือน Db ใน apps-script/Code.js ทุกตัว Api.js จึงใช้ร่วมกันได้
 */
var Db = (function () {
  var KEY = 'sportday-demo-v2';
  var DEMO_KEYS = {
    adminKey: 'demo-admin', refereeKey: 'demo-ref',
    captainKeys: ['demo-red', 'demo-yellow', 'demo-green', 'demo-blue', 'demo-pink'],
    joinKeys: ['join-red', 'join-yellow', 'join-green', 'join-blue', 'join-pink']
  };
  var state = null;

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* โหมดส่วนตัว: เก็บในหน่วยความจำอย่างเดียว */ }
  }

  function norm(t, r) {
    var o = {};
    Api.TABLES[t].forEach(function (k) { o[k] = r[k] === undefined || r[k] === null ? '' : String(r[k]); });
    return o;
  }

  function tbl(t) {
    ensure();
    if (!state.tables[t]) state.tables[t] = [];
    return state.tables[t];
  }

  function ensure() {
    if (state) return;
    try { state = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { state = null; }
    if (!state || !state.tables) reset();
  }

  function reset() {
    state = { tables: {}, meta: {} };
    var cs = Seed.classesAndStudents();
    state.tables.Settings = Seed.settings(DEMO_KEYS).map(function (r) { return norm('Settings', r); });
    state.tables.Teams = Seed.teams(DEMO_KEYS).map(function (r) { return norm('Teams', r); });
    state.tables.Sports = Seed.sports().map(function (r) { return norm('Sports', r); });
    state.tables.Classes = cs.classes.map(function (r) { return norm('Classes', r); });
    state.tables.Students = cs.students.map(function (r) { return norm('Students', r); });
    state.meta.codes = Seed.demoActivity(DEMO_KEYS.adminKey);
    save();
  }

  return {
    keys: DEMO_KEYS,
    ensure: ensure,
    reset: reset,
    meta: function () { ensure(); return state.meta; },
    all: function (t) { return tbl(t).map(function (r) { return Object.assign({}, r); }); },
    insert: function (t, row) { this.insertMany(t, [row]); },
    insertMany: function (t, rows) {
      var list = tbl(t);
      rows.forEach(function (r) { list.push(norm(t, r)); });
      save();
    },
    update: function (t, id, patch) {
      var r = tbl(t).filter(function (x) { return x.id === id; })[0];
      if (!r) throw new Error('ไม่พบ ' + t + ' ' + id);
      Object.keys(patch).forEach(function (k) {
        if (Api.TABLES[t].indexOf(k) >= 0) r[k] = patch[k] === null || patch[k] === undefined ? '' : String(patch[k]);
      });
      save();
    },
    updateMany: function (t, rows) {
      var self = this;
      rows.forEach(function (r) { self.update(t, r.id, r); });
    },
    removeWhere: function (t, fn) {
      ensure();
      state.tables[t] = tbl(t).filter(function (r) { return !fn(Object.assign({}, r)); });
      save();
    }
  };
})();
