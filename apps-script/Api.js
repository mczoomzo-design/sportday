/**
 * Api.js — คำสั่งทั้งหมดของระบบ (ใช้ร่วมกันทั้ง Apps Script และโหมดทดลองบนเว็บ)
 * อ่าน/เขียนข้อมูลผ่านตัวแปร Db ที่แต่ละฝั่งเตรียมไว้:
 *   Db.all(table) / Db.insert(table,row) / Db.insertMany(table,rows)
 *   Db.update(table,id,patch) / Db.updateMany(table,rows) / Db.removeWhere(table,fn)
 *
 * สิทธิ์ไม่ใช้การล็อกอิน แต่ดูจาก "รหัส/ลิงก์" ที่แนบมากับคำขอ:
 *   code        = รหัสแก้ไขทีม (ตัวแทนทีม)
 *   captainKey  = ลิงก์หัวหน้าสี
 *   refKey      = ลิงก์กรรมการ (บันทึกผล)
 *   adminKey    = ลิงก์แอดมิน
 */
var Api = (function () {
  var TABLES = {
    Settings: ['id', 'value', 'description'],
    Teams: ['id', 'name', 'color', 'captainKey', 'captainName'],
    Classes: ['id', 'teamId'],
    Students: ['id', 'prefix', 'firstName', 'lastName', 'classRoom', 'number', 'gender'],
    Sports: ['id', 'name', 'type', 'format', 'gender', 'level', 'minPlayers', 'maxPlayers', 'venue', 'status', 'order'],
    Registrations: ['id', 'sportId', 'teamId', 'repStudentId', 'repName', 'codeHash', 'status', 'createdAt', 'updatedAt'],
    Athletes: ['id', 'registrationId', 'sportId', 'teamId', 'studentId', 'fullName', 'classRoom', 'role', 'active', 'addedAt', 'removedAt'],
    Matches: ['id', 'sportId', 'kind', 'round', 'slot', 'teamA', 'teamB', 'scoreA', 'scoreB', 'winner', 'loser', 'status',
      'nextMatchId', 'nextSlot', 'loserNextMatchId', 'loserNextSlot', 'time', 'venue', 'note', 'updatedAt'],
    Results: ['id', 'sportId', 'place', 'teamId', 'athleteId'],
    SubRequests: ['id', 'registrationId', 'teamId', 'sportId', 'outAthleteId', 'outName', 'inStudentId', 'inName',
      'effective', 'reason', 'requestedBy', 'status', 'createdAt', 'decidedBy', 'decidedAt'],
    ChangeLog: ['id', 'time', 'teamId', 'registrationId', 'actor', 'via', 'action', 'detail'],
    Certificates: ['id', 'sportId', 'sportName', 'place', 'award', 'studentName', 'classRoom', 'teamName', 'status', 'pdfUrl']
  };

  var SETTING_KEYS = ['eventName', 'schoolName', 'academicYear', 'regDeadline', 'pointsGold', 'pointsSilver',
    'pointsBronze', 'pointsHonor', 'certTemplateId', 'certFolderId'];

  var ST = { pending: 'รออนุมัติ', approved: 'อนุมัติ', rejected: 'ไม่อนุมัติ' };

  // ---------- ตัวช่วย ----------

  function fail(msg) {
    var e = new Error(msg);
    e.userFacing = true;
    throw e;
  }

  function nowIso() { return new Date().toISOString(); }

  function newId(prefix) {
    return prefix + Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 6);
  }

  function settings() {
    var o = {};
    Db.all('Settings').forEach(function (r) { o[r.id] = r.value; });
    return o;
  }

  function isClosed(s) {
    return !!s.regDeadline && Date.now() > new Date(s.regDeadline).getTime();
  }

  function byId(table) {
    var o = {};
    Db.all(table).forEach(function (r) { o[r.id] = r; });
    return o;
  }

  function find(table, id) {
    var r = Db.all(table).filter(function (x) { return x.id === id; })[0];
    if (!r) fail('ไม่พบข้อมูล (' + table + ' ' + id + ')');
    return r;
  }

  function classTeam() {
    var o = {};
    Db.all('Classes').forEach(function (c) { o[c.id] = c.teamId; });
    return o;
  }

  function publicTeam(t) { return { id: t.id, name: t.name, color: t.color }; }

  function publicReg(r) {
    return { id: r.id, sportId: r.sportId, teamId: r.teamId, repName: r.repName, status: r.status, createdAt: r.createdAt, updatedAt: r.updatedAt };
  }

  function hashCode(code) {
    return Core.sha256(Core.normalizeCode(code) + '|' + settings().codeSalt);
  }

  function log(entry) {
    Db.insert('ChangeLog', {
      id: newId('L'), time: nowIso(), teamId: entry.teamId || '', registrationId: entry.registrationId || '',
      actor: entry.actor || '', via: entry.via || '', action: entry.action, detail: entry.detail || ''
    });
  }

  function activeAthletes(regId) {
    return Db.all('Athletes').filter(function (a) { return a.registrationId === regId && a.active === 'Y'; });
  }

  function points(s) {
    return { gold: s.pointsGold || 5, silver: s.pointsSilver || 3, bronze: s.pointsBronze || 2, honor: s.pointsHonor || 1 };
  }

  // ---------- สิทธิ์ ----------

  function auth(p) {
    var s = settings();
    if (p.adminKey) {
      if (String(p.adminKey) === String(s.adminKey)) return { role: 'admin', actor: 'แอดมิน', via: 'ลิงก์แอดมิน' };
      fail('ลิงก์แอดมินไม่ถูกต้อง');
    }
    if (p.captainKey) {
      var t = Db.all('Teams').filter(function (x) { return x.captainKey && String(x.captainKey) === String(p.captainKey); })[0];
      if (!t) fail('ลิงก์หัวหน้าสีไม่ถูกต้อง');
      return { role: 'captain', teamId: t.id, actor: t.captainName || ('หัวหน้าสี' + t.name), via: 'ลิงก์หัวหน้าสี' };
    }
    if (p.refKey) {
      if (String(p.refKey) === String(s.refereeKey)) return { role: 'referee', actor: 'กรรมการ', via: 'ลิงก์กรรมการ' };
      fail('ลิงก์กรรมการไม่ถูกต้อง');
    }
    return { role: 'public' };
  }

  function need(a, roles) {
    if (roles.indexOf(a.role) < 0) fail('ไม่มีสิทธิ์ทำรายการนี้');
  }

  // หาทีมจากรหัส/ลิงก์ แล้วบอกว่าแก้รายชื่อได้ทันทีหรือไม่
  function regAccess(p, a) {
    var reg;
    if (p.code) {
      var h = hashCode(p.code);
      reg = Db.all('Registrations').filter(function (r) { return r.codeHash === h; })[0];
      if (!reg) fail('รหัสแก้ไขทีมไม่ถูกต้อง');
      var name = String(p.actorName || '').trim() || reg.repName;
      return { reg: reg, actor: name, via: 'รหัสทีม ' + Core.normalizeCode(p.code).slice(0, 3), canEditNow: !isClosed(settings()), isCode: true };
    }
    if (a.role === 'captain' || a.role === 'admin') {
      reg = find('Registrations', p.registrationId);
      if (a.role === 'captain' && reg.teamId !== a.teamId) fail('ทีมนี้ไม่ใช่สีของคุณ');
      return { reg: reg, actor: a.actor, via: a.via, canEditNow: true, isCode: false };
    }
    fail('ต้องใช้รหัสแก้ไขทีม');
  }

  // ---------- รายชื่อ ----------

  function rosterContext(sport, teamId) {
    return { sport: sport, teamId: teamId, students: byId('Students'), classTeam: classTeam() };
  }

  function checkRoster(members, ctx) {
    var v = Core.validateRoster(members, ctx);
    if (v.errors.length) fail(v.errors.join('\n'));
    return v.warnings;
  }

  function cleanMembers(members) {
    return (members || []).map(function (m) {
      return { studentId: String(m.studentId), role: m.role === 'สำรอง' ? 'สำรอง' : 'ตัวจริง' };
    });
  }

  function athleteRow(reg, student, role) {
    return {
      id: newId('A'), registrationId: reg.id, sportId: reg.sportId, teamId: reg.teamId, studentId: student.id,
      fullName: Core.fullName(student), classRoom: student.classRoom, role: role, active: 'Y', addedAt: nowIso(), removedAt: ''
    };
  }

  // เทียบรายชื่อเดิมกับใหม่ แล้วบันทึกเฉพาะส่วนที่เปลี่ยน
  function applyRoster(reg, members) {
    var students = byId('Students'), current = activeAthletes(reg.id), now = nowIso();
    var wanted = {}, changes = [];
    members.forEach(function (m) { wanted[m.studentId] = m.role; });
    var have = {};
    current.forEach(function (a) {
      have[a.studentId] = a;
      if (!(a.studentId in wanted)) {
        Db.update('Athletes', a.id, { active: '', removedAt: now });
        changes.push('ลบ ' + a.fullName);
      } else if (wanted[a.studentId] !== a.role) {
        Db.update('Athletes', a.id, { role: wanted[a.studentId] });
        changes.push(a.fullName + ' → ' + wanted[a.studentId]);
      }
    });
    var added = members.filter(function (m) { return !have[m.studentId]; }).map(function (m) {
      return athleteRow(reg, students[m.studentId], m.role);
    });
    if (added.length) Db.insertMany('Athletes', added);
    added.forEach(function (a) { changes.unshift('เพิ่ม ' + a.fullName); });
    return changes;
  }

  function teamDetail(reg, extra) {
    var s = settings(), sport = find('Sports', reg.sportId), team = find('Teams', reg.teamId);
    var all = Db.all('Athletes').filter(function (a) { return a.registrationId === reg.id; });
    var out = {
      registration: publicReg(reg),
      sport: sport,
      team: publicTeam(team),
      athletes: all.filter(function (a) { return a.active === 'Y'; }),
      removed: all.filter(function (a) { return a.active !== 'Y'; }),
      requests: Db.all('SubRequests').filter(function (r) { return r.registrationId === reg.id; }).reverse(),
      log: Db.all('ChangeLog').filter(function (l) { return l.registrationId === reg.id; }).reverse().slice(0, 30),
      closed: isClosed(s),
      deadline: s.regDeadline
    };
    for (var k in extra) out[k] = extra[k];
    return out;
  }

  function createReg(sport, teamId, repStudent) {
    var code = Core.newCode();
    var reg = {
      id: newId('R'), sportId: sport.id, teamId: teamId, repStudentId: repStudent.id, repName: Core.fullName(repStudent),
      codeHash: hashCode(code), status: ST.pending, createdAt: nowIso(), updatedAt: nowIso()
    };
    Db.insert('Registrations', reg);
    return { reg: reg, code: code };
  }

  function openSportFor(sportId, a) {
    var sport = find('Sports', sportId);
    if (a.role !== 'admin' && a.role !== 'captain') {
      if (sport.status === 'ปิดรับ') fail('กีฬานี้ปิดรับสมัครแล้ว');
      if (isClosed(settings())) fail('เลยกำหนดปิดรับสมัครแล้ว ติดต่อหัวหน้าสี');
    }
    return sport;
  }

  // ---------- ผลการแข่งขัน ----------

  function sportMatches(sportId) {
    return Db.all('Matches').filter(function (m) { return m.sportId === sportId; });
  }

  function saveResults(sportId, rows) {
    Db.removeWhere('Results', function (r) { return r.sportId === sportId; });
    if (rows.length) Db.insertMany('Results', rows.map(function (r) {
      return { id: newId('X'), sportId: sportId, place: r.place, teamId: r.teamId, athleteId: r.athleteId || '' };
    }));
  }

  // นักกีฬาที่ได้เกียรติบัตร: คนที่ยังอยู่ในทีม + คนที่ถูกเปลี่ยนตัวออกหลังจากได้ลงแข่งแล้ว
  function certAthletes(sportId, teamId) {
    var played = sportMatches(sportId).filter(function (m) {
      return m.status === 'done' && (m.teamA === teamId || m.teamB === teamId);
    }).map(function (m) { return m.updatedAt; }).sort();
    var firstPlayed = played[0];
    return Db.all('Athletes').filter(function (a) {
      if (a.sportId !== sportId || a.teamId !== teamId) return false;
      if (a.active === 'Y') return true;
      return !!firstPlayed && a.removedAt > firstPlayed;
    });
  }

  // ---------- คำสั่ง ----------

  var H = {};

  H.bootstrap = function (p, a) {
    var s = settings(), counts = {};
    Db.all('Athletes').forEach(function (x) { if (x.active === 'Y') counts[x.registrationId] = (counts[x.registrationId] || 0) + 1; });
    var teams = Db.all('Teams'), results = Db.all('Results');
    var me = null;
    if (a.role === 'captain') me = publicTeam(find('Teams', a.teamId));
    return {
      event: {
        name: s.eventName, school: s.schoolName, year: s.academicYear, deadline: s.regDeadline,
        closed: isClosed(s), points: points(s)
      },
      role: a.role, myTeam: me,
      teams: teams.map(publicTeam),
      classes: Db.all('Classes'),
      sports: Db.all('Sports').sort(function (x, y) { return Number(x.order || 0) - Number(y.order || 0); }),
      registrations: Db.all('Registrations').map(function (r) {
        var o = publicReg(r); o.count = counts[r.id] || 0; return o;
      }),
      matches: Db.all('Matches'),
      results: results,
      athletesById: (function () {
        // ชื่อเฉพาะนักกีฬาที่ได้อันดับ (กีฬาประเภทจัดอันดับ)
        var ids = {}, o = {};
        results.forEach(function (r) { if (r.athleteId) ids[r.athleteId] = 1; });
        Db.all('Athletes').forEach(function (x) { if (ids[x.id]) o[x.id] = { fullName: x.fullName, classRoom: x.classRoom }; });
        return o;
      })(),
      medals: Core.medalTable(teams, results, points(s))
    };
  };

  H.students = function (p) {
    return Db.all('Students').filter(function (s) { return s.classRoom === p.classRoom; })
      .sort(function (x, y) { return Number(x.number) - Number(y.number); })
      .map(function (s) { return { id: s.id, name: Core.fullName(s), number: s.number, gender: s.gender, classRoom: s.classRoom }; });
  };

  // รายชื่อนักเรียนทั้งสี สำหรับค้นหาตอนกรอกสมาชิก พร้อมเหตุผลถ้าลงกีฬานี้ไม่ได้
  H.teamStudents = function (p) {
    var sport = find('Sports', p.sportId), ct = classTeam(), entries = {};
    Db.all('Athletes').forEach(function (a) { if (a.active === 'Y') (entries[a.studentId] = entries[a.studentId] || []).push(a.sportId); });
    var sports = byId('Sports');
    return Db.all('Students').filter(function (s) { return ct[s.classRoom] === p.teamId; }).map(function (s) {
      var mine = entries[s.id] || [];
      return {
        id: s.id, name: Core.fullName(s), classRoom: s.classRoom, gender: s.gender,
        reason: Core.ineligibleReason(s, sport),
        otherSports: mine.filter(function (x) { return x !== sport.id; }).map(function (x) { return sports[x] ? sports[x].name : x; })
      };
    });
  };

  H.publicTeam = function (p) {
    var reg = find('Registrations', p.registrationId);
    return {
      registration: publicReg(reg),
      athletes: activeAthletes(reg.id).map(function (x) { return { fullName: x.fullName, classRoom: x.classRoom, role: x.role }; })
    };
  };

  // รายชื่อนักกีฬาทั้งรายการ (ใช้ตอนบันทึกอันดับกีฬาประเภทจัดอันดับ)
  H.sportAthletes = function (p, a) {
    need(a, ['admin', 'referee']);
    return Db.all('Athletes').filter(function (x) { return x.sportId === p.sportId && x.active === 'Y'; })
      .map(function (x) { return { id: x.id, fullName: x.fullName, classRoom: x.classRoom, teamId: x.teamId }; });
  };

  H.createRegistration = function (p, a) {
    var sport = openSportFor(p.sportId, a);
    var rep = find('Students', String(p.repStudentId));
    var teamId = classTeam()[rep.classRoom];
    if (!teamId) fail('ห้อง ' + rep.classRoom + ' ยังไม่ได้กำหนดสี');
    var exist = Db.all('Registrations').filter(function (r) { return r.sportId === sport.id && r.teamId === teamId; })[0];
    if (exist) fail('สีนี้ส่งรายชื่อ' + sport.name + 'แล้ว (ตัวแทน: ' + exist.repName + ') ใช้รหัสแก้ไขทีมเพื่อแก้รายชื่อ');
    var members = cleanMembers(p.members);
    var warnings = checkRoster(members, rosterContext(sport, teamId));
    var made = createReg(sport, teamId, rep);
    applyRoster(made.reg, members);
    log({ teamId: teamId, registrationId: made.reg.id, actor: made.reg.repName, via: 'สแกน QR', action: 'ส่งรายชื่อ',
      detail: sport.name + ' ' + members.length + ' คน' });
    return teamDetail(made.reg, { code: Core.formatCode(made.code), warnings: warnings });
  };

  // กีฬาบุคคล: สมัครตัวเอง (คนแรกของสีจะได้รหัสทีม)
  H.selfRegister = function (p, a) {
    var sport = openSportFor(p.sportId, a);
    var st = find('Students', String(p.studentId));
    var teamId = classTeam()[st.classRoom];
    var reg = Db.all('Registrations').filter(function (r) { return r.sportId === sport.id && r.teamId === teamId; })[0];
    var code = '';
    var current = reg ? activeAthletes(reg.id) : [];
    if (current.some(function (x) { return x.studentId === st.id; })) fail('คุณสมัครกีฬานี้แล้ว');
    var members = current.map(function (x) { return { studentId: x.studentId, role: x.role }; });
    members.push({ studentId: st.id, role: 'ตัวจริง' });
    var warnings = checkRoster(members, rosterContext(sport, teamId));
    if (!reg) {
      var made = createReg(sport, teamId, st);
      reg = made.reg; code = Core.formatCode(made.code);
    }
    applyRoster(reg, members);
    Db.update('Registrations', reg.id, { updatedAt: nowIso() });
    log({ teamId: teamId, registrationId: reg.id, actor: Core.fullName(st), via: 'สแกน QR', action: 'สมัครตัวเอง', detail: sport.name });
    return teamDetail(reg, { code: code, warnings: warnings });
  };

  H.openTeam = function (p, a) {
    var acc = regAccess(p, a);
    return teamDetail(acc.reg, { canEdit: acc.canEditNow, via: acc.via });
  };

  H.updateTeam = function (p, a) {
    var acc = regAccess(p, a), reg = acc.reg;
    if (!acc.canEditNow) fail('เลยกำหนดปิดรับสมัครแล้ว ใช้ "ขอเปลี่ยนตัว" แทน');
    var sport = find('Sports', reg.sportId), members = cleanMembers(p.members);
    var warnings = checkRoster(members, rosterContext(sport, reg.teamId));
    var changes = applyRoster(reg, members);
    if (!changes.length) return teamDetail(reg, { canEdit: true, warnings: warnings });
    var patch = { updatedAt: nowIso() };
    // ตัวแทนทีมแก้หลังอนุมัติแล้ว → ให้หัวหน้าสีตรวจใหม่
    if (acc.isCode && reg.status === ST.approved) patch.status = ST.pending;
    Db.update('Registrations', reg.id, patch);
    log({ teamId: reg.teamId, registrationId: reg.id, actor: acc.actor, via: acc.via, action: 'แก้รายชื่อ', detail: changes.join(' • ') });
    return teamDetail(find('Registrations', reg.id), { canEdit: true, warnings: warnings });
  };

  H.requestSub = function (p, a) {
    var acc = regAccess(p, a), reg = acc.reg;
    var out = activeAthletes(reg.id).filter(function (x) { return x.id === p.outAthleteId; })[0];
    if (!out) fail('ไม่พบผู้เล่นที่จะเปลี่ยนออก');
    var inSt = find('Students', String(p.inStudentId));
    var sport = find('Sports', reg.sportId);
    var members = activeAthletes(reg.id).filter(function (x) { return x.id !== out.id; })
      .map(function (x) { return { studentId: x.studentId, role: x.role }; });
    members.push({ studentId: inSt.id, role: out.role });
    checkRoster(members, rosterContext(sport, reg.teamId));
    if (!String(p.reason || '').trim()) fail('กรุณาระบุเหตุผล');
    var req = {
      id: newId('Q'), registrationId: reg.id, teamId: reg.teamId, sportId: reg.sportId, outAthleteId: out.id, outName: out.fullName,
      inStudentId: inSt.id, inName: Core.fullName(inSt), effective: p.effective || 'นัดถัดไปเป็นต้นไป', reason: p.reason,
      requestedBy: acc.actor + ' (' + acc.via + ')', status: ST.pending, createdAt: nowIso(), decidedBy: '', decidedAt: ''
    };
    Db.insert('SubRequests', req);
    log({ teamId: reg.teamId, registrationId: reg.id, actor: acc.actor, via: acc.via, action: 'ขอเปลี่ยนตัว',
      detail: out.fullName + ' → ' + req.inName + ' (' + req.reason + ')' });
    // หัวหน้าสี/แอดมินขอเองถือว่าอนุมัติทันที
    if (!acc.isCode) H.decideSub({ requestId: req.id, approve: true }, a);
    return teamDetail(reg, { canEdit: acc.canEditNow });
  };

  H.captainData = function (p, a) {
    need(a, ['captain', 'admin']);
    var teamId = a.role === 'captain' ? a.teamId : p.teamId;
    var counts = {};
    Db.all('Athletes').forEach(function (x) { if (x.active === 'Y') counts[x.registrationId] = (counts[x.registrationId] || 0) + 1; });
    return {
      team: publicTeam(find('Teams', teamId)),
      actor: a.actor,
      registrations: Db.all('Registrations').filter(function (r) { return r.teamId === teamId; })
        .map(function (r) { var o = publicReg(r); o.count = counts[r.id] || 0; return o; }),
      requests: Db.all('SubRequests').filter(function (r) { return r.teamId === teamId; }).reverse(),
      log: Db.all('ChangeLog').filter(function (l) { return l.teamId === teamId; }).reverse().slice(0, 100)
    };
  };

  H.decideSub = function (p, a) {
    need(a, ['captain', 'admin']);
    var req = find('SubRequests', p.requestId);
    if (a.role === 'captain' && req.teamId !== a.teamId) fail('คำขอนี้ไม่ใช่สีของคุณ');
    if (req.status !== ST.pending) fail('คำขอนี้ถูกตัดสินไปแล้ว');
    var reg = find('Registrations', req.registrationId);
    if (p.approve) {
      var members = activeAthletes(reg.id).filter(function (x) { return x.id !== req.outAthleteId; })
        .map(function (x) { return { studentId: x.studentId, role: x.role }; });
      var out = find('Athletes', req.outAthleteId);
      members.push({ studentId: req.inStudentId, role: out.role });
      checkRoster(members, rosterContext(find('Sports', reg.sportId), reg.teamId));
      applyRoster(reg, members);
      Db.update('Registrations', reg.id, { updatedAt: nowIso() });
    }
    Db.update('SubRequests', req.id, { status: p.approve ? ST.approved : ST.rejected, decidedBy: a.actor, decidedAt: nowIso() });
    log({ teamId: req.teamId, registrationId: req.registrationId, actor: a.actor, via: a.via,
      action: p.approve ? 'อนุมัติเปลี่ยนตัว' : 'ไม่อนุมัติเปลี่ยนตัว', detail: req.outName + ' → ' + req.inName });
    return { ok: true };
  };

  H.setRegStatus = function (p, a) {
    need(a, ['captain', 'admin']);
    var reg = find('Registrations', p.registrationId);
    if (a.role === 'captain' && reg.teamId !== a.teamId) fail('ทีมนี้ไม่ใช่สีของคุณ');
    var status = p.approve ? ST.approved : ST.rejected;
    Db.update('Registrations', reg.id, { status: status, updatedAt: nowIso() });
    log({ teamId: reg.teamId, registrationId: reg.id, actor: a.actor, via: a.via, action: status + 'รายชื่อ',
      detail: find('Sports', reg.sportId).name + ' ' + activeAthletes(reg.id).length + ' คน' });
    return { ok: true };
  };

  // รหัสหาย/รั่ว: ออกรหัสใหม่ รหัสเดิมใช้ไม่ได้ทันที
  H.resetCode = function (p, a) {
    need(a, ['captain', 'admin']);
    var reg = find('Registrations', p.registrationId);
    if (a.role === 'captain' && reg.teamId !== a.teamId) fail('ทีมนี้ไม่ใช่สีของคุณ');
    var code = Core.newCode();
    Db.update('Registrations', reg.id, { codeHash: hashCode(code), updatedAt: nowIso() });
    log({ teamId: reg.teamId, registrationId: reg.id, actor: a.actor, via: a.via, action: 'ออกรหัสทีมใหม่', detail: find('Sports', reg.sportId).name });
    return { code: Core.formatCode(code) };
  };

  H.adminData = function (p, a) {
    need(a, ['admin']);
    return {
      settings: Db.all('Settings'),
      teams: Db.all('Teams'),
      requests: Db.all('SubRequests').filter(function (r) { return r.status === ST.pending; }),
      log: Db.all('ChangeLog').reverse().slice(0, 200),
      certificates: Db.all('Certificates'),
      studentCount: Db.all('Students').length,
      athleteCount: Db.all('Athletes').filter(function (x) { return x.active === 'Y'; }).length
    };
  };

  H.saveSettings = function (p, a) {
    need(a, ['admin']);
    var rows = byId('Settings');
    SETTING_KEYS.forEach(function (k) {
      if (!(k in (p.values || {}))) return;
      var v = String(p.values[k]);
      if (rows[k]) Db.update('Settings', k, { value: v });
      else Db.insert('Settings', { id: k, value: v, description: '' });
    });
    log({ actor: a.actor, via: a.via, action: 'แก้ตั้งค่างาน', detail: Object.keys(p.values || {}).join(', ') });
    return { ok: true };
  };

  H.saveSport = function (p, a) {
    need(a, ['admin']);
    var s = p.sport || {};
    if (!String(s.name || '').trim()) fail('กรุณาใส่ชื่อกีฬา');
    var row = {
      name: String(s.name).trim(), type: s.type === 'บุคคล' ? 'บุคคล' : 'ทีม', format: s.format === 'จัดอันดับ' ? 'จัดอันดับ' : 'แพ้คัดออก',
      gender: s.gender || 'ผสม', level: s.level || 'ทั้งหมด', minPlayers: String(s.minPlayers || 1), maxPlayers: String(s.maxPlayers || 1),
      venue: s.venue || '', status: s.status === 'ปิดรับ' ? 'ปิดรับ' : 'เปิดรับ', order: String(s.order || 0)
    };
    if (Number(row.minPlayers) > Number(row.maxPlayers)) fail('จำนวนขั้นต่ำมากกว่าสูงสุด');
    if (s.id) Db.update('Sports', s.id, row);
    else { row.id = newId('SP'); Db.insert('Sports', row); }
    log({ actor: a.actor, via: a.via, action: s.id ? 'แก้กีฬา' : 'เพิ่มกีฬา', detail: row.name });
    return { ok: true };
  };

  H.deleteSport = function (p, a) {
    need(a, ['admin']);
    var sport = find('Sports', p.sportId);
    if (Db.all('Registrations').some(function (r) { return r.sportId === sport.id; })) fail('มีสีส่งรายชื่อแล้ว ลบไม่ได้ (เปลี่ยนเป็น "ปิดรับ" แทน)');
    Db.removeWhere('Sports', function (x) { return x.id === sport.id; });
    log({ actor: a.actor, via: a.via, action: 'ลบกีฬา', detail: sport.name });
    return { ok: true };
  };

  H.drawBracket = function (p, a) {
    need(a, ['admin']);
    var sport = find('Sports', p.sportId);
    if (sport.format === 'จัดอันดับ') fail('กีฬาแบบจัดอันดับไม่ต้องจัดสาย ให้บันทึกอันดับได้เลย');
    var existing = sportMatches(sport.id);
    if (existing.some(function (m) { return m.status === 'done'; }) && !p.force) fail('มีผลการแข่งขันแล้ว ถ้าจัดสายใหม่ผลเดิมจะหายทั้งหมด');
    var regs = Db.all('Registrations').filter(function (r) {
      return r.sportId === sport.id && (r.status === ST.approved || (p.includePending && r.status === ST.pending));
    });
    if (regs.length < 2) fail('มีทีมที่อนุมัติแล้วไม่ถึง 2 ทีม (' + regs.length + ' ทีม)');
    var order = Core.shuffle(regs.map(function (r) { return r.teamId; }));
    var matches = Core.buildBracket(sport.id, order, function () { return newId('M'); });
    Db.removeWhere('Matches', function (m) { return m.sportId === sport.id; });
    Db.insertMany('Matches', matches);
    saveResults(sport.id, []);
    var teams = byId('Teams');
    log({ actor: a.actor, via: a.via, action: 'จับสลากจัดสาย', detail: sport.name + ': ' + order.map(function (t) { return 'สี' + teams[t].name; }).join(', ') });
    return { matches: matches };
  };

  H.setMatchInfo = function (p, a) {
    need(a, ['admin']);
    find('Matches', p.matchId);
    Db.update('Matches', p.matchId, { time: p.time || '', venue: p.venue || '' });
    return { ok: true };
  };

  H.recordResult = function (p, a) {
    need(a, ['admin', 'referee']);
    var m = find('Matches', p.matchId), matches = sportMatches(m.sportId);
    var changed;
    try {
      changed = Core.recordResult(matches, m.id, p.scoreA, p.scoreB, p.winnerSlot);
    } catch (e) { fail(e.message); }
    var now = nowIso();
    changed.forEach(function (x) { if (x.id === m.id) { x.updatedAt = now; x.note = p.note || ''; } });
    Db.updateMany('Matches', changed);
    var places = Core.computePlaces(matches);
    saveResults(m.sportId, places || []);
    var teams = byId('Teams'), done = matches.filter(function (x) { return x.id === m.id; })[0];
    log({ teamId: '', actor: a.actor, via: a.via, action: 'บันทึกผล',
      detail: find('Sports', m.sportId).name + ': สี' + teams[done.teamA].name + ' ' + done.scoreA + '–' + done.scoreB + ' สี' + teams[done.teamB].name });
    return { changed: changed, places: places };
  };

  // กีฬาแบบจัดอันดับ (เช่น วิ่ง) entries = [{place:'1', athleteId}] สีที่ไม่ได้อันดับได้ชมเชย
  H.setRankingResults = function (p, a) {
    need(a, ['admin', 'referee']);
    var sport = find('Sports', p.sportId), athletes = byId('Athletes'), rows = [], placedTeams = {}, seen = {};
    (p.entries || []).forEach(function (e) {
      if (!e.athleteId) return;
      var ath = athletes[e.athleteId];
      if (!ath || ath.sportId !== sport.id) fail('นักกีฬาไม่ได้อยู่ในรายการนี้');
      if (seen[e.place]) fail('อันดับ ' + e.place + ' ซ้ำ');
      seen[e.place] = 1;
      rows.push({ place: String(e.place), teamId: ath.teamId, athleteId: ath.id });
      placedTeams[ath.teamId] = 1;
    });
    Db.all('Registrations').forEach(function (r) {
      if (r.sportId === sport.id && r.status !== ST.rejected && !placedTeams[r.teamId]) rows.push({ place: 'H', teamId: r.teamId });
    });
    saveResults(sport.id, rows);
    log({ actor: a.actor, via: a.via, action: 'บันทึกอันดับ', detail: sport.name });
    return { ok: true };
  };

  H.buildCertificates = function (p, a) {
    need(a, ['admin']);
    var sports = byId('Sports'), teams = byId('Teams'), athletes = byId('Athletes'), rows = [];
    var results = Db.all('Results').filter(function (r) { return !p.sportId || r.sportId === p.sportId; });
    results.forEach(function (r) {
      var list = r.athleteId ? [athletes[r.athleteId]] : certAthletes(r.sportId, r.teamId);
      list.forEach(function (ath) {
        rows.push({
          id: newId('C'), sportId: r.sportId, sportName: sports[r.sportId].name, place: r.place, award: Core.PLACE_LABEL[r.place],
          studentName: ath.fullName, classRoom: ath.classRoom, teamName: 'สี' + teams[r.teamId].name, status: 'พร้อมพิมพ์', pdfUrl: ''
        });
      });
    });
    // เก็บลิงก์ PDF เดิมไว้ถ้าเป็นคนเดิม รางวัลเดิม
    var old = {};
    Db.all('Certificates').forEach(function (c) { old[c.sportId + '|' + c.studentName + '|' + c.place] = c; });
    rows.forEach(function (r) {
      var o = old[r.sportId + '|' + r.studentName + '|' + r.place];
      if (o && o.pdfUrl) { r.pdfUrl = o.pdfUrl; r.status = 'สร้างแล้ว'; }
    });
    Db.removeWhere('Certificates', function (c) { return p.sportId ? c.sportId === p.sportId : true; });
    if (rows.length) Db.insertMany('Certificates', rows);
    log({ actor: a.actor, via: a.via, action: 'สร้างรายชื่อเกียรติบัตร', detail: rows.length + ' ใบ' });
    return { count: rows.length };
  };

  function handle(action, payload) {
    payload = payload || {};
    // EXTRA_ACTIONS = คำสั่งที่ใช้ได้เฉพาะบน Google (เช่น สร้าง PDF) ประกาศไว้ใน Code.js
    var fn = H[action] || (typeof EXTRA_ACTIONS !== 'undefined' && EXTRA_ACTIONS[action]);
    if (!fn) fail(action === 'makePdfs' ? 'สร้าง PDF ได้เมื่อเชื่อมกับ Google Sheet จริงเท่านั้น' : 'ไม่รู้จักคำสั่ง ' + action);
    return fn(payload, auth(payload));
  }

  return { TABLES: TABLES, ST: ST, handle: handle, need: need, fail: fail, settings: settings, newId: newId };
})();

if (typeof module !== 'undefined') module.exports = Api;
