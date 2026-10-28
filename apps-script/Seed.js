/**
 * Seed.js — ค่าเริ่มต้นและข้อมูลตัวอย่าง (ใช้ทั้งตอน setup ใน Google Sheet และโหมดทดลองบนเว็บ)
 */
var Seed = (function () {
  var TEAMS = [
    ['T1', 'แดง', '#E5484D', ''],
    ['T2', 'เหลือง', '#F5B800', ''],
    ['T3', 'เขียว', '#30A46C', ''],
    ['T4', 'ฟ้า', '#0090FF', ''],
    ['T5', 'ชมพู', '#E93D82', '']
  ];

  // [ชื่อ, ประเภท, รูปแบบ, เพศ, รุ่น, ขั้นต่ำ, สูงสุด, สนาม]
  var SPORTS = [
    ['ฟุตซอล ชาย ม.ต้น', 'ทีม', 'แพ้คัดออก', 'ชาย', 'ม.ต้น', 5, 10, 'สนาม A'],
    ['ฟุตซอล ชาย ม.ปลาย', 'ทีม', 'แพ้คัดออก', 'ชาย', 'ม.ปลาย', 5, 10, 'สนาม A'],
    ['วอลเลย์บอล หญิง ม.ต้น', 'ทีม', 'แพ้คัดออก', 'หญิง', 'ม.ต้น', 6, 10, 'โรงยิม'],
    ['วอลเลย์บอล หญิง ม.ปลาย', 'ทีม', 'แพ้คัดออก', 'หญิง', 'ม.ปลาย', 6, 10, 'โรงยิม'],
    ['บาสเกตบอล ชาย ม.ปลาย', 'ทีม', 'แพ้คัดออก', 'ชาย', 'ม.ปลาย', 5, 10, 'สนามบาส'],
    ['ชักเย่อ ผสม', 'ทีม', 'แพ้คัดออก', 'ผสม', 'ทั้งหมด', 10, 12, 'สนามหญ้า'],
    ['วิ่ง 100 ม. ชาย ม.ต้น', 'บุคคล', 'จัดอันดับ', 'ชาย', 'ม.ต้น', 1, 2, 'ลู่วิ่ง'],
    ['วิ่ง 100 ม. หญิง ม.ต้น', 'บุคคล', 'จัดอันดับ', 'หญิง', 'ม.ต้น', 1, 2, 'ลู่วิ่ง'],
    ['วิ่งผลัด 4×100 ม. ชาย ม.ปลาย', 'ทีม', 'จัดอันดับ', 'ชาย', 'ม.ปลาย', 4, 5, 'ลู่วิ่ง']
  ];

  var BOYS = ['ธนกฤต', 'ภูมิพัฒน์', 'ณัฐวุฒิ', 'กิตติพัศ', 'ปัณณวิชญ์', 'อชิระ', 'วรเมธ', 'ศุภกร', 'ธีรภัทร', 'พีรพัฒน์', 'ภูริ', 'กันตภณ', 'ชยพล', 'ปุณณวิช', 'ณภัทร', 'ภาคิน', 'ธนพล', 'รัชชานนท์'];
  var GIRLS = ['กมลชนก', 'ศิริพร', 'ณิชาภัทร', 'พิมพ์ชนก', 'ชนัญชิดา', 'ปุณยาพร', 'อริสรา', 'ภัทรา', 'กัญญาณัฐ', 'ธัญชนก', 'สุภาวดี', 'ณัฐธิดา', 'พรรษชล', 'วริศรา', 'ปภาวรินทร์', 'ญาดา', 'ชญานิศ', 'เบญญาภา'];
  var LAST = ['ใจดี', 'สุขสันต์', 'แก้วมณี', 'วงศ์ทอง', 'ศรีสุข', 'พรหมมา', 'ทองคำ', 'มีสุข', 'ดวงดี', 'ใจงาม', 'รักเรียน', 'แสงทอง', 'มีชัย', 'สายใจ', 'บุญมา', 'ศรีวงศ์', 'เพชรรัตน์', 'อินทร์แก้ว', 'จันทร์หอม', 'ปัญญาดี'];

  function randomKey(len) {
    var c = 'abcdefghjkmnpqrstuvwxyz23456789', s = '';
    for (var i = 0; i < len; i++) s += c[Math.floor(Math.random() * c.length)];
    return s;
  }

  // เวลาไทย (+07:00) เช่น 2026-11-05T16:30:00+07:00
  function bangkokIso(d) {
    var t = new Date(d.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 16);
    return t + ':00+07:00';
  }

  function settings(opts) {
    opts = opts || {};
    var deadline = new Date(Date.now() + 14 * 24 * 3600 * 1000);
    deadline.setUTCHours(9, 30, 0, 0); // 16:30 น.
    return [
      ['eventName', 'กีฬาสีภายใน', 'ชื่องาน'],
      ['schoolName', 'โรงเรียนตัวอย่างวิทยา', 'ชื่อโรงเรียน (ใช้ในเกียรติบัตร)'],
      ['academicYear', '2569', 'ปีการศึกษา'],
      ['regDeadline', bangkokIso(deadline), 'วัน-เวลาปิดรับสมัคร หลังจากนี้ตัวแทนทีมต้อง "ขอเปลี่ยนตัว"'],
      ['pointsGold', '5', 'คะแนนอันดับ 1'],
      ['pointsSilver', '3', 'คะแนนอันดับ 2'],
      ['pointsBronze', '2', 'คะแนนอันดับ 3'],
      ['pointsHonor', '1', 'คะแนนชมเชย'],
      ['adminKey', opts.adminKey || randomKey(16), 'รหัสลิงก์แอดมิน (?admin=...) ห้ามเผยแพร่'],
      ['refereeKey', opts.refereeKey || randomKey(10), 'รหัสลิงก์กรรมการบันทึกผล (?ref=...)'],
      ['codeSalt', randomKey(12), 'ใช้เข้ารหัสรหัสทีม ห้ามแก้หลังเปิดรับสมัคร'],
      ['siteUrl', '', 'ลิงก์หน้าเว็บ (ใส่ให้อัตโนมัติเมื่อแอดมินเปิดหน้าตั้งค่าครั้งแรก)'],
      ['certTemplateId', '', 'ไอดีไฟล์ Google Slides แม่แบบเกียรติบัตร'],
      ['certFolderId', '', 'ไอดีโฟลเดอร์ Drive เก็บ PDF (เว้นว่าง = สร้างให้อัตโนมัติ)']
    ].map(function (r) { return { id: r[0], value: r[1], description: r[2] }; });
  }

  function teams(opts) {
    opts = opts || {};
    return TEAMS.map(function (t, i) {
      return {
        id: t[0], name: t[1], color: t[2], captainKey: opts.captainKeys ? opts.captainKeys[i] : randomKey(10), captainName: t[3],
        joinKey: opts.joinKeys ? opts.joinKeys[i] : randomKey(10)
      };
    });
  }

  function sports() {
    return SPORTS.map(function (s, i) {
      return {
        id: 'SP' + (i + 1), name: s[0], type: s[1], format: s[2], gender: s[3], level: s[4],
        minPlayers: String(s[5]), maxPlayers: String(s[6]), venue: s[7], status: 'เปิดรับ', order: String(i + 1)
      };
    });
  }

  // ม.1/1 – ม.6/3 แบ่งห้องให้ 5 สี และนักเรียนห้องละ 14 คน (ชาย 7 หญิง 7)
  function classesAndStudents() {
    var classes = [], students = [], n = 0, seq = 1;
    for (var g = 1; g <= 6; g++) {
      for (var r = 1; r <= 3; r++) {
        var room = 'ม.' + g + '/' + r;
        classes.push({ id: room, teamId: TEAMS[(g * 3 + r) % 5][0] });
        for (var k = 1; k <= 14; k++) {
          var boy = k <= 7;
          var first = (boy ? BOYS : GIRLS)[(n * 7 + k * 3) % 18];
          var last = LAST[(n * 11 + k * 5) % LAST.length];
          students.push({
            id: String(10000 + seq++), prefix: g <= 3 ? (boy ? 'ด.ช.' : 'ด.ญ.') : (boy ? 'นาย' : 'นางสาว'),
            firstName: first, lastName: last, classRoom: room, number: String(k), gender: boy ? 'ช' : 'ญ'
          });
        }
        n++;
      }
    }
    return { classes: classes, students: students };
  }

  /**
   * ใส่ข้อมูลการสมัครตัวอย่างผ่าน Api (ต้องมีข้อมูลพื้นฐานแล้ว) คืนรหัสทีมที่สร้างไว้ให้ลองใช้
   */
  function demoActivity(adminKey) {
    var A = function (action, p) { p = p || {}; p.adminKey = adminKey; return Api.handle(action, p); };
    var cs = classesAndStudents(), ct = {};
    cs.classes.forEach(function (c) { ct[c.id] = c.teamId; });
    var pick = function (teamId, gender, level, count) {
      return cs.students.filter(function (s) {
        return ct[s.classRoom] === teamId && s.gender === gender && Core.levelOf(s.classRoom) === level;
      }).slice(0, count);
    };
    var codes = {};
    // ฟุตซอล ชาย ม.ต้น: ส่งครบ 5 สี อนุมัติ จับสลาก และบันทึกผล 1 นัด
    TEAMS.forEach(function (t, i) {
      var boys = pick(t[0], 'ช', 'ม.ต้น', 7);
      var res = A('createRegistration', {
        sportId: 'SP1', repStudentId: boys[0].id,
        members: boys.map(function (b, j) { return { studentId: b.id, role: j < 5 ? 'ตัวจริง' : 'สำรอง' }; })
      });
      codes[t[1] + ' ฟุตซอล'] = res.code;
      A('setRegStatus', { registrationId: res.registration.id, approve: true });
    });
    var draw = A('drawBracket', { sportId: 'SP1' });
    var first = draw.matches.filter(function (m) { return m.status === 'ready'; })[0];
    if (first) A('recordResult', { matchId: first.id, scoreA: 3, scoreB: 1 });
    // วอลเลย์บอล หญิง ม.ต้น: 4 สี (อนุมัติแล้ว 3)
    TEAMS.slice(0, 4).forEach(function (t, i) {
      var girls = pick(t[0], 'ญ', 'ม.ต้น', 7);
      var res = A('createRegistration', {
        sportId: 'SP3', repStudentId: girls[0].id,
        members: girls.map(function (b) { return { studentId: b.id, role: 'ตัวจริง' }; })
      });
      codes[t[1] + ' วอลเลย์บอล'] = res.code;
      if (i < 3) A('setRegStatus', { registrationId: res.registration.id, approve: true });
    });
    // วิ่ง 100 ม. ชาย ม.ต้น: สมัครตัวเองสีละ 1 คน
    TEAMS.forEach(function (t) {
      var boy = pick(t[0], 'ช', 'ม.ต้น', 9)[8];
      if (boy) A('selfRegister', { sportId: 'SP7', studentId: boy.id });
    });
    return codes;
  }

  return {
    settings: settings, teams: teams, sports: sports, classesAndStudents: classesAndStudents,
    demoActivity: demoActivity, bangkokIso: bangkokIso, randomKey: randomKey
  };
})();

if (typeof module !== 'undefined') module.exports = Seed;
