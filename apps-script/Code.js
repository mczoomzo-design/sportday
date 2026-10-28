/**
 * Code.js — ส่วนที่ทำงานเฉพาะบน Google Apps Script
 *  - doGet / doPost : ช่องทางให้หน้าเว็บ (GitHub Pages) เรียกใช้
 *  - Db             : อ่าน/เขียน Google Sheet (1 แท็บ = 1 ตาราง, แถวแรกเป็นหัวคอลัมน์)
 *  - setup()        : สร้างแท็บและค่าเริ่มต้นทั้งหมด
 *  - makePdfs       : สร้าง PDF เกียรติบัตรจาก Google Slides แม่แบบ
 */

// ---------- Web API ----------

var READ_ONLY_ = ['bootstrap', 'students', 'teamStudents', 'publicTeam', 'openTeam', 'captainData', 'adminData', 'sportAthletes'];

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (!p.action) return ContentService.createTextOutput('ระบบกีฬาสีทำงานอยู่ ✓');
  return respond_(p.action, p.payload ? JSON.parse(p.payload) : {});
}

// หน้าเว็บส่งแบบ text/plain เพื่อไม่ให้เบราว์เซอร์ติด CORS preflight
function doPost(e) {
  var body = {};
  try { body = JSON.parse(e.postData.contents); } catch (err) { /* ส่งคำขอผิดรูปแบบ */ }
  return respond_(body.action, body.payload || {});
}

function respond_(action, payload) {
  var lock = null, out;
  try {
    // คำสั่งที่เขียนข้อมูลต้องเข้าคิว กันนักเรียนส่งพร้อมกันแล้วข้อมูลชนกัน
    if (READ_ONLY_.indexOf(action) < 0) {
      lock = LockService.getScriptLock();
      lock.waitLock(30000);
    }
    out = { ok: true, data: Api.handle(action, payload) };
  } catch (err) {
    if (!err.userFacing) console.error(err && err.stack || err);
    out = { ok: false, error: err.userFacing ? err.message : 'ระบบขัดข้อง: ' + err.message };
  } finally {
    if (lock) lock.releaseLock();
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

// ---------- Db บน Google Sheet ----------

var Db = (function () {
  var cache = {};

  function sheet(t) {
    var sh = SpreadsheetApp.getActive().getSheetByName(t);
    if (!sh) throw new Error('ไม่พบแท็บ ' + t + ' — เปิดเมนู กีฬาสี > ติดตั้งชีต ก่อน');
    return sh;
  }

  function cell(v) {
    if (v === null || v === undefined) return '';
    var s = String(v);
    // กันข้อความที่ขึ้นต้นด้วย = + @ ถูกตีความเป็นสูตร
    return /^[=+@]/.test(s) ? "'" + s : s;
  }

  function load(t) {
    if (cache[t]) return cache[t];
    var sh = sheet(t), cols = Api.TABLES[t], n = sh.getLastRow() - 1, list = [];
    if (n > 0) {
      sh.getRange(2, 1, n, cols.length).getValues().forEach(function (r, i) {
        if (r.join('') === '') return;
        var o = {};
        cols.forEach(function (k, j) { o[k] = r[j] instanceof Date ? r[j].toISOString() : String(r[j]); });
        list.push({ row: i + 2, data: o });
      });
    }
    cache[t] = list;
    return list;
  }

  function writeRow(t, entry) {
    var cols = Api.TABLES[t];
    sheet(t).getRange(entry.row, 1, 1, cols.length).setValues([cols.map(function (k) { return cell(entry.data[k]); })]);
  }

  return {
    all: function (t) {
      return load(t).map(function (e) { return Object.assign({}, e.data); });
    },
    insert: function (t, row) { this.insertMany(t, [row]); },
    insertMany: function (t, rows) {
      if (!rows.length) return;
      var list = load(t), sh = sheet(t), cols = Api.TABLES[t], start = sh.getLastRow() + 1;
      sh.getRange(start, 1, rows.length, cols.length).setNumberFormat('@')
        .setValues(rows.map(function (r) { return cols.map(function (k) { return cell(r[k]); }); }));
      rows.forEach(function (r, i) {
        var o = {};
        cols.forEach(function (k) { o[k] = r[k] === undefined || r[k] === null ? '' : String(r[k]); });
        list.push({ row: start + i, data: o });
      });
    },
    update: function (t, id, patch) {
      var e = load(t).filter(function (x) { return x.data.id === id; })[0];
      if (!e) throw new Error('ไม่พบ ' + t + ' ' + id);
      Object.keys(patch).forEach(function (k) { e.data[k] = patch[k] === null || patch[k] === undefined ? '' : String(patch[k]); });
      writeRow(t, e);
    },
    updateMany: function (t, rows) {
      var self = this;
      rows.forEach(function (r) { self.update(t, r.id, r); });
    },
    removeWhere: function (t, fn) {
      var list = load(t), keep = list.filter(function (e) { return !fn(Object.assign({}, e.data)); });
      if (keep.length === list.length) return;
      var sh = sheet(t), cols = Api.TABLES[t], last = sh.getLastRow();
      if (last > 1) sh.getRange(2, 1, last - 1, cols.length).clearContent();
      delete cache[t];
      if (keep.length) {
        sh.getRange(2, 1, keep.length, cols.length).setNumberFormat('@')
          .setValues(keep.map(function (e) { return cols.map(function (k) { return cell(e.data[k]); }); }));
      }
    }
  };
})();

// ---------- ติดตั้ง ----------

function onOpen() {
  SpreadsheetApp.getUi().createMenu('กีฬาสี')
    .addItem('1) ติดตั้งชีต (สร้างแท็บ + ค่าเริ่มต้น)', 'setup')
    .addItem('2) ใส่ข้อมูลตัวอย่าง (ห้อง/นักเรียน/การสมัคร)', 'setupDemoData')
    .addItem('ดูลิงก์ทั้งหมด (แอดมิน/หัวหน้าสี/กรรมการ)', 'showLinks')
    .addToUi();
}

function setup() {
  var ss = SpreadsheetApp.getActive();
  Object.keys(Api.TABLES).forEach(function (t) {
    var sh = ss.getSheetByName(t) || ss.insertSheet(t), cols = Api.TABLES[t];
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold').setBackground('#E8ECFC');
    sh.setFrozenRows(1);
    sh.getRange(2, 1, Math.max(sh.getMaxRows() - 1, 1), cols.length).setNumberFormat('@');
  });
  var have = {};
  Db.all('Settings').forEach(function (r) { have[r.id] = 1; });
  var missing = Seed.settings().filter(function (r) { return !have[r.id]; });
  if (missing.length) Db.insertMany('Settings', missing);
  if (!Db.all('Teams').length) Db.insertMany('Teams', Seed.teams());
  if (!Db.all('Sports').length) Db.insertMany('Sports', Seed.sports());
  // ลบแท็บว่างที่ Google สร้างให้ตอนเริ่ม
  ss.getSheets().forEach(function (sh) {
    if (!Api.TABLES[sh.getName()] && sh.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(sh);
  });
  SpreadsheetApp.getUi().alert('ติดตั้งเสร็จแล้ว ✓\n\nขั้นต่อไป: ใส่รายชื่อห้องในแท็บ Classes และนักเรียนในแท็บ Students\n(หรือเลือกเมนู "ใส่ข้อมูลตัวอย่าง" เพื่อทดลอง)');
}

function setupDemoData() {
  if (Db.all('Students').length) {
    SpreadsheetApp.getUi().alert('แท็บ Students มีข้อมูลอยู่แล้ว ไม่ใส่ข้อมูลตัวอย่างซ้ำ');
    return;
  }
  var cs = Seed.classesAndStudents();
  Db.insertMany('Classes', cs.classes);
  Db.insertMany('Students', cs.students);
  var codes = Seed.demoActivity(Api.settings().adminKey);
  SpreadsheetApp.getUi().alert('ใส่ข้อมูลตัวอย่างแล้ว ✓\n\nรหัสทีมไว้ทดลอง:\n' +
    Object.keys(codes).map(function (k) { return k + ': ' + codes[k]; }).join('\n'));
}

function showLinks() {
  var s = Api.settings();
  var site = 'https://<ชื่อผู้ใช้>.github.io/<ชื่อ repo>/';
  var lines = ['ลิงก์นักเรียน (ทำ QR): ' + site, '', 'แอดมิน: ' + site + '?admin=' + s.adminKey,
    'กรรมการบันทึกผล: ' + site + '?ref=' + s.refereeKey, ''];
  Db.all('Teams').forEach(function (t) { lines.push('หัวหน้าสี' + t.name + ': ' + site + '?captain=' + t.captainKey); });
  lines.push('', 'URL ของ Web App (ใส่ใน config.js): ' + (ScriptApp.getService().getUrl() || 'ยังไม่ได้ Deploy'));
  SpreadsheetApp.getUi().alert(lines.join('\n'));
}

// ---------- เกียรติบัตร PDF ----------

// ประกาศเป็นตัวแปร (ไม่เรียก Api ตอนโหลดไฟล์) เพราะ Apps Script โหลดไฟล์ตามลำดับในหน้า editor
var EXTRA_ACTIONS = {};

EXTRA_ACTIONS.makePdfs = function (p, a) {
  Api.need(a, ['admin']);
  var s = Api.settings();
  if (!s.certTemplateId) Api.fail('ยังไม่ได้ใส่ไอดีไฟล์ Google Slides แม่แบบ (certTemplateId) ในหน้าตั้งค่า');
  var folder;
  if (s.certFolderId) folder = DriveApp.getFolderById(s.certFolderId);
  else {
    folder = DriveApp.createFolder('เกียรติบัตร ' + s.eventName + ' ' + s.academicYear);
    Db.update('Settings', 'certFolderId', { value: folder.getId() });
  }
  var template = DriveApp.getFileById(s.certTemplateId);
  var todo = Db.all('Certificates').filter(function (c) { return !c.pdfUrl; });
  var started = Date.now(), done = 0;
  for (var i = 0; i < todo.length; i++) {
    if (Date.now() - started > 240000) break; // Apps Script จำกัดเวลา 6 นาที ทำต่อในรอบถัดไป
    var c = todo[i];
    var copy = template.makeCopy('tmp-' + c.id, folder);
    var pres = SlidesApp.openById(copy.getId());
    var map = {
      '{{ชื่อ-นามสกุล}}': c.studentName, '{{รางวัล}}': c.award, '{{รายการ}}': c.sportName, '{{สี}}': c.teamName,
      '{{ชั้น}}': c.classRoom, '{{ปีการศึกษา}}': s.academicYear, '{{โรงเรียน}}': s.schoolName, '{{งาน}}': s.eventName
    };
    Object.keys(map).forEach(function (k) { pres.replaceAllText(k, map[k] || ''); });
    pres.saveAndClose();
    var pdf = folder.createFile(copy.getAs('application/pdf')).setName(c.award + ' - ' + c.studentName + ' - ' + c.sportName + '.pdf');
    copy.setTrashed(true);
    Db.update('Certificates', c.id, { pdfUrl: pdf.getUrl(), status: 'สร้างแล้ว' });
    done++;
  }
  return { done: done, remaining: todo.length - done, folderUrl: folder.getUrl() };
};
