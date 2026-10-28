/**
 * Core.js — ตรรกะกลางของระบบกีฬาสี (ไม่มีการอ่าน/เขียนข้อมูลในไฟล์นี้)
 * ใช้ร่วมกันทั้งใน Google Apps Script และโหมดทดลองบนเว็บ
 */
var Core = (function () {
  var BYE = 'BYE';
  var PLACE_LABEL = { '1': 'ชนะเลิศ', '2': 'รองชนะเลิศอันดับ 1', '3': 'รองชนะเลิศอันดับ 2', 'H': 'ชมเชย' };

  // ---------- สายการแข่งขันแบบแพ้คัดออก ----------

  function nextPow2(n) {
    var s = 2;
    while (s < n) s *= 2;
    return s;
  }

  // ลำดับวางสายมาตรฐาน เช่น 8 ช่อง → [1,8,4,5,2,7,3,6] ทำให้ BYE ไม่เจอกันเอง
  function seedOrder(size) {
    var order = [1];
    while (order.length < size) {
      var sum = order.length * 2 + 1, next = [];
      order.forEach(function (s) { next.push(s, sum - s); });
      order = next;
    }
    return order;
  }

  function totalRounds(size) {
    return Math.round(Math.log(size) / Math.log(2));
  }

  function roundName(match, rounds) {
    if (match.kind === 'third') return 'ชิงอันดับ 3';
    var r = Number(match.round);
    if (r === rounds) return 'ชิงชนะเลิศ';
    if (r === rounds - 1) return 'รอบรองชนะเลิศ';
    if (r === rounds - 2) return 'รอบก่อนรองฯ';
    return 'รอบ ' + Math.pow(2, rounds - r + 1) + ' ทีม';
  }

  function shuffle(list, rnd) {
    rnd = rnd || Math.random;
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function blankMatch(id, sportId, kind, round, slot) {
    return {
      id: id, sportId: sportId, kind: kind, round: round, slot: slot,
      teamA: '', teamB: '', scoreA: '', scoreB: '', winner: '', loser: '',
      status: 'pending', nextMatchId: '', nextSlot: '', loserNextMatchId: '', loserNextSlot: '',
      time: '', venue: '', note: '', updatedAt: ''
    };
  }

  /**
   * สร้างสายจากรายชื่อทีม (เรียงตามลำดับที่จับสลากได้ = seed 1, 2, 3 ...)
   * คืนค่าเป็นรายการนัดทั้งหมด รวมนัดชิงที่ 3 (ถ้ามีรอบรองฯ)
   */
  function buildBracket(sportId, teamIds, newId) {
    if (teamIds.length < 2) throw new Error('ต้องมีอย่างน้อย 2 ทีมจึงจะจัดสายได้');
    var size = nextPow2(teamIds.length);
    var rounds = totalRounds(size);
    var byRound = [];
    for (var r = 1; r <= rounds; r++) {
      var count = size / Math.pow(2, r), list = [];
      for (var i = 0; i < count; i++) list.push(blankMatch(newId(), sportId, 'main', r, i + 1));
      byRound.push(list);
    }
    for (r = 0; r < rounds - 1; r++) {
      byRound[r].forEach(function (m, i) {
        m.nextMatchId = byRound[r + 1][Math.floor(i / 2)].id;
        m.nextSlot = i % 2 ? 'B' : 'A';
      });
    }
    var all = [].concat.apply([], byRound);
    if (rounds >= 2) {
      var third = blankMatch(newId(), sportId, 'third', rounds, 1);
      var semis = byRound[rounds - 2];
      semis[0].loserNextMatchId = third.id; semis[0].loserNextSlot = 'A';
      semis[1].loserNextMatchId = third.id; semis[1].loserNextSlot = 'B';
      all.push(third);
    }
    var order = seedOrder(size);
    byRound[0].forEach(function (m, i) {
      var a = order[i * 2], b = order[i * 2 + 1];
      m.teamA = a <= teamIds.length ? teamIds[a - 1] : BYE;
      m.teamB = b <= teamIds.length ? teamIds[b - 1] : BYE;
    });
    resolveAuto(all);
    return all;
  }

  function indexById(matches) {
    var idx = {};
    matches.forEach(function (m) { idx[m.id] = m; });
    return idx;
  }

  // ใส่ทีมลงช่องของนัดถัดไป ถ้านัดนั้นแข่งจบแล้วจะไม่ยอมให้เปลี่ยน
  function setSlot(idx, matchId, slot, team) {
    var t = idx[matchId];
    if (!t) return;
    var key = slot === 'A' ? 'teamA' : 'teamB';
    if (t[key] === team) return;
    if (t.status === 'done') throw new Error('นัดถัดไป (' + t.id + ') แข่งจบแล้ว ต้องแก้ผลนัดนั้นก่อน');
    t[key] = team;
    t.winner = ''; t.loser = ''; t.scoreA = ''; t.scoreB = '';
    t.status = 'pending';
    // ล้างผลที่นัดนี้เคยส่งต่อไป (กรณีเป็นนัด BYE ที่จบอัตโนมัติไปแล้ว)
    if (t.nextMatchId) setSlot(idx, t.nextMatchId, t.nextSlot, '');
    if (t.loserNextMatchId) setSlot(idx, t.loserNextMatchId, t.loserNextSlot, '');
  }

  function propagate(idx, m) {
    if (m.nextMatchId) setSlot(idx, m.nextMatchId, m.nextSlot, m.winner);
    if (m.loserNextMatchId) setSlot(idx, m.loserNextMatchId, m.loserNextSlot, m.loser);
  }

  // นัดที่มี BYE จบอัตโนมัติ / นัดที่ครบ 2 ทีมเปลี่ยนเป็น "พร้อมแข่ง"
  function resolveAuto(matches) {
    var idx = indexById(matches), changed = true;
    while (changed) {
      changed = false;
      matches.forEach(function (m) {
        if (m.status !== 'pending' || !m.teamA || !m.teamB) return;
        if (m.teamA === BYE || m.teamB === BYE) {
          m.winner = m.teamA === BYE ? m.teamB : m.teamA;
          m.loser = m.teamA === BYE ? m.teamA : m.teamB;
          m.status = 'bye';
          propagate(idx, m);
        } else {
          m.status = 'ready';
        }
        changed = true;
      });
    }
    return matches;
  }

  /**
   * บันทึกผล: ผู้ชนะเลื่อนเข้าคู่ถัดไป ผู้แพ้รอบรองฯ ไปชิงที่ 3
   * winnerSlot ('A'/'B') ใช้เมื่อเสมอแล้วตัดสินด้วยจุดโทษ
   * คืนค่ารายการนัดที่ถูกแก้ไข
   */
  function recordResult(matches, matchId, scoreA, scoreB, winnerSlot) {
    var idx = indexById(matches), m = idx[matchId];
    if (!m) throw new Error('ไม่พบนัดแข่งนี้');
    if (!m.teamA || !m.teamB || m.teamA === BYE || m.teamB === BYE) throw new Error('นัดนี้ยังไม่พร้อมบันทึกผล');
    var a = Number(scoreA), b = Number(scoreB);
    if (scoreA === '' || scoreB === '' || isNaN(a) || isNaN(b) || a < 0 || b < 0) throw new Error('กรอกสกอร์ให้ครบ');
    var slot = a > b ? 'A' : b > a ? 'B' : winnerSlot;
    if (slot !== 'A' && slot !== 'B') throw new Error('สกอร์เสมอ ต้องเลือกผู้ชนะ (เช่น จากการยิงจุดโทษ)');
    var before = JSON.stringify(matches);
    m.scoreA = String(a); m.scoreB = String(b);
    m.winner = slot === 'A' ? m.teamA : m.teamB;
    m.loser = slot === 'A' ? m.teamB : m.teamA;
    m.status = 'done';
    propagate(idx, m);
    resolveAuto(matches);
    var old = indexById(JSON.parse(before));
    return matches.filter(function (x) { return JSON.stringify(x) !== JSON.stringify(old[x.id]); });
  }

  function isFinished(m) { return m.status === 'done' || m.status === 'bye'; }

  // อันดับ 1/2/3 จากสาย ทีมที่เหลือได้ชมเชย คืน null ถ้านัดชิงยังไม่จบ
  function computePlaces(matches) {
    var main = matches.filter(function (m) { return m.kind === 'main'; });
    if (!main.length) return null;
    var rounds = Math.max.apply(null, main.map(function (m) { return Number(m.round); }));
    var final = main.filter(function (m) { return Number(m.round) === rounds; })[0];
    var third = matches.filter(function (m) { return m.kind === 'third'; })[0];
    if (!final || !isFinished(final)) return null;
    if (third && !isFinished(third)) return null;
    var places = [], used = {};
    function put(place, team) {
      if (!team || team === BYE || used[team]) return;
      used[team] = 1; places.push({ place: place, teamId: team });
    }
    put('1', final.winner);
    put('2', final.loser);
    if (third) put('3', third.winner);
    var teams = {};
    matches.forEach(function (m) {
      [m.teamA, m.teamB].forEach(function (t) { if (t && t !== BYE) teams[t] = 1; });
    });
    Object.keys(teams).forEach(function (t) { put('H', t); });
    return places;
  }

  // ---------- ตารางเหรียญ ----------

  function medalTable(teams, results, points) {
    var rows = {};
    teams.forEach(function (t) { rows[t.id] = { teamId: t.id, gold: 0, silver: 0, bronze: 0, honor: 0, points: 0 }; });
    var counted = {};
    results.forEach(function (r) {
      // นับครั้งเดียวต่อ (กีฬา, อันดับ, สี) แม้ผลแบบบุคคลจะมีหลายคน
      var k = r.sportId + '|' + r.place + '|' + r.teamId;
      if (counted[k] || !rows[r.teamId]) return;
      counted[k] = 1;
      var row = rows[r.teamId];
      if (r.place === '1') { row.gold++; row.points += Number(points.gold); }
      else if (r.place === '2') { row.silver++; row.points += Number(points.silver); }
      else if (r.place === '3') { row.bronze++; row.points += Number(points.bronze); }
      else { row.honor++; row.points += Number(points.honor); }
    });
    return Object.keys(rows).map(function (k) { return rows[k]; }).sort(function (a, b) {
      return b.points - a.points || b.gold - a.gold || b.silver - a.silver || b.bronze - a.bronze;
    });
  }

  // ---------- ตรวจรายชื่อ ----------

  // ม.1–3 = ม.ต้น, ม.4–6 = ม.ปลาย, ป.x = ประถม
  function levelOf(classRoom) {
    var m = /^(ม|ป)\.?\s*(\d)/.exec(String(classRoom || ''));
    if (!m) return '';
    if (m[1] === 'ป') return 'ประถม';
    return Number(m[2]) <= 3 ? 'ม.ต้น' : 'ม.ปลาย';
  }

  // คืนข้อความเหตุผลถ้าไม่มีสิทธิ์ลง คืน '' ถ้าลงได้
  function ineligibleReason(student, sport) {
    if (sport.gender === 'ชาย' && student.gender !== 'ช') return 'กีฬานี้สำหรับนักเรียนชาย';
    if (sport.gender === 'หญิง' && student.gender !== 'ญ') return 'กีฬานี้สำหรับนักเรียนหญิง';
    if (sport.level && sport.level !== 'ทั้งหมด' && levelOf(student.classRoom) !== sport.level) {
      return 'ชั้น ' + student.classRoom + ' ไม่ตรงรุ่น ' + sport.level;
    }
    return '';
  }

  /**
   * members: [{studentId, role}]  ctx: {sport, teamId, students (map id→student), classTeam (map ห้อง→สี)}
   */
  function validateRoster(members, ctx) {
    var errors = [], warnings = [], seen = {};
    members.forEach(function (m) {
      var s = ctx.students[m.studentId];
      if (!s) { errors.push('ไม่พบนักเรียนรหัส ' + m.studentId); return; }
      var name = fullName(s);
      if (seen[m.studentId]) errors.push(name + ' ซ้ำในรายชื่อ');
      seen[m.studentId] = 1;
      if (ctx.classTeam[s.classRoom] !== ctx.teamId) errors.push(name + ' อยู่คนละสี');
      var why = ineligibleReason(s, ctx.sport);
      if (why) errors.push(name + ': ' + why);
    });
    var max = Number(ctx.sport.maxPlayers) || 0, min = Number(ctx.sport.minPlayers) || 0;
    if (!members.length) errors.push('ยังไม่มีรายชื่อนักกีฬา');
    if (max && members.length > max) errors.push('เกินจำนวนสูงสุด ' + max + ' คน');
    if (min && members.length < min) warnings.push('ยังไม่ครบขั้นต่ำ ' + min + ' คน (ส่งไว้ก่อนได้ แล้วค่อยเพิ่ม)');
    return { errors: errors, warnings: warnings };
  }

  function fullName(s) {
    return (s.prefix || '') + s.firstName + ' ' + s.lastName;
  }

  // ---------- รหัสแก้ไขทีม ----------

  var CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

  function newCode(rnd) {
    rnd = rnd || Math.random;
    var c = '';
    for (var i = 0; i < 6; i++) c += CODE_CHARS[Math.floor(rnd() * CODE_CHARS.length)];
    return c;
  }

  function normalizeCode(code) {
    return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  function formatCode(code) {
    code = normalizeCode(code);
    return code.slice(0, 3) + '-' + code.slice(3);
  }

  // SHA-256 สำหรับข้อความ ASCII (ใช้เก็บรหัสทีมแบบไม่ต้องเก็บรหัสจริง)
  function sha256(ascii) {
    function rr(v, n) { return (v >>> n) | (v << (32 - n)); }
    var maxWord = Math.pow(2, 32), i, j, result = '';
    var words = [], bitLength = ascii.length * 8;
    var hash = [], k = [], primeCounter = 0, isComposite = {};
    for (var candidate = 2; primeCounter < 64; candidate++) {
      if (!isComposite[candidate]) {
        for (i = 0; i < 313; i += candidate) isComposite[i] = candidate;
        hash[primeCounter] = (Math.pow(candidate, 0.5) * maxWord) | 0;
        k[primeCounter++] = (Math.pow(candidate, 1 / 3) * maxWord) | 0;
      }
    }
    hash = hash.slice(0, 8);
    ascii += '\x80';
    while (ascii.length % 64 - 56) ascii += '\x00';
    for (i = 0; i < ascii.length; i++) {
      j = ascii.charCodeAt(i);
      if (j >> 8) throw new Error('sha256 รองรับเฉพาะ ASCII');
      words[i >> 2] |= j << ((3 - i) % 4) * 8;
    }
    words[words.length] = (bitLength / maxWord) | 0;
    words[words.length] = bitLength;
    for (j = 0; j < words.length;) {
      var w = words.slice(j, j += 16), oldHash = hash;
      hash = hash.slice(0, 8);
      for (i = 0; i < 64; i++) {
        var w15 = w[i - 15], w2 = w[i - 2], a = hash[0], e = hash[4];
        var t1 = hash[7] + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & hash[5]) ^ ((~e) & hash[6])) + k[i] +
          (w[i] = (i < 16) ? w[i] : (w[i - 16] + (rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3)) + w[i - 7] +
            (rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10))) | 0);
        var t2 = (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        hash = [(t1 + t2) | 0].concat(hash);
        hash[4] = (hash[4] + t1) | 0;
      }
      for (i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
    }
    for (i = 0; i < 8; i++) {
      for (j = 3; j + 1; j--) {
        var b = (hash[i] >> (j * 8)) & 255;
        result += (b < 16 ? '0' : '') + b.toString(16);
      }
    }
    return result;
  }

  return {
    BYE: BYE, PLACE_LABEL: PLACE_LABEL,
    nextPow2: nextPow2, seedOrder: seedOrder, totalRounds: totalRounds, roundName: roundName, shuffle: shuffle,
    buildBracket: buildBracket, resolveAuto: resolveAuto, recordResult: recordResult, computePlaces: computePlaces,
    medalTable: medalTable, levelOf: levelOf, ineligibleReason: ineligibleReason, validateRoster: validateRoster,
    fullName: fullName, newCode: newCode, normalizeCode: normalizeCode, formatCode: formatCode, sha256: sha256
  };
})();

if (typeof module !== 'undefined') module.exports = Core;
