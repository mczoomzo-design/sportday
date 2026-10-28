/**
 * app.js — หน้าเว็บระบบกีฬาสี (ไฟล์เดียว ไม่มี build step)
 *
 * บทบาทดูจากลิงก์ที่เปิด ไม่มีการล็อกอิน:
 *   index.html              นักเรียน (สแกน QR)
 *   index.html?captain=...  ประธานสี
 *   index.html?ref=...      กรรมการบันทึกผล
 *   index.html?admin=...    แอดมิน
 * หน้าย่อยใช้ hash เช่น #/register, #/t/R7K2Q9, #/bracket/SP1
 */
(function () {
  'use strict';

  // ---------- บทบาทจากลิงก์ ----------

  const Q = new URLSearchParams(location.search);
  const KEYS = {};
  if (Q.get('admin')) KEYS.adminKey = Q.get('admin');
  else if (Q.get('captain')) KEYS.captainKey = Q.get('captain');
  else if (Q.get('ref')) KEYS.refKey = Q.get('ref');
  const ROLE = KEYS.adminKey ? 'admin' : KEYS.captainKey ? 'captain' : KEYS.refKey ? 'referee' : 'public';
  const BASE = location.origin + location.pathname;
  const HOME = { admin: 'admin', captain: 'captain', referee: 'ref', public: '' }[ROLE];

  const app = document.getElementById('app');
  const S = { boot: null, page: null, parts: [], reg: null, team: null, ed: null, cap: null, admin: null, view: {} };
  const ACT = {}, INPUT = {}, CHANGE = {};

  // ---------- ตัวช่วย ----------

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const call = (action, p) => Client.call(action, Object.assign({}, KEYS, p || {}));
  const $ = (sel) => document.querySelector(sel);

  const ICONS = {
    back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    users: '<circle cx="9" cy="8" r="4"/><path d="M2 21v-1a6 6 0 0 1 12 0v1M16 4.5a4 4 0 0 1 0 7M22 21v-1a6 6 0 0 0-4-5.6"/>',
    bracket: '<path d="M3 5h6v4H3M3 15h6v4H3M9 7h4v10H9M13 12h8"/>',
    clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3h6v3H9zM9 11h6M9 15h4"/>',
    award: '<circle cx="12" cy="9" r="6"/><path d="M8.5 14 7 22l5-3 5 3-1.5-8"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
    trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.5"/>',
    alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16v.5"/>',
    check: '<path d="m5 12 5 5 9-10"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.9-3M4 4v4h4M4 13a8 8 0 0 0 14.9 3M20 20v-4h-4"/>',
    copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
    swap: '<path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4"/>',
    print: '<path d="M6 9V3h12v6M6 18H4v-7h16v7h-2M8 14h8v7H8z"/>'
  };
  const ic = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;

  function fmt(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return esc(iso);
    return d.toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + ' น.';
  }
  const teamOf = (id) => S.boot.teams.find((t) => t.id === id);
  const sportOf = (id) => S.boot.sports.find((s) => s.id === id);
  const classTeam = (room) => (S.boot.classes.find((c) => c.id === room) || {}).teamId;
  const pill = (t, k = 'muted') => `<span class="pill ${k}">${esc(t)}</span>`;
  const stPill = (st) => pill(st, st === 'อนุมัติ' || st === 'มีผลแล้ว' ? 'success' : st === 'ไม่อนุมัติ' ? 'danger' : st === 'ย้อนกลับแล้ว' ? 'muted' : 'warning');
  const note = (kind, icon, html) => `<div class="note ${kind}">${ic(icon)}<div>${html}</div></div>`;

  function chip(id) {
    if (id === Core.BYE) return '<span class="chip bye">BYE</span>';
    const t = id && teamOf(id);
    if (!t) return '<span class="chip muted">รอผล</span>';
    return `<span class="chip"><i style="background:${esc(t.color)}"></i>สี${esc(t.name)}</span>`;
  }

  function roundsOf(sportId) {
    const main = S.boot.matches.filter((m) => m.sportId === sportId && m.kind === 'main');
    return main.length ? Math.max(...main.map((m) => +m.round)) : 0;
  }
  const roundLabel = (m) => Core.roundName(m, roundsOf(m.sportId));

  function toast(msg, kind = 'success') {
    const el = document.createElement('div');
    el.className = 'toast ' + kind;
    el.innerHTML = esc(msg).replace(/\n/g, '<br>');
    $('#toasts').appendChild(el);
    const life = kind === 'danger' ? 6000 : 3000;
    setTimeout(() => el.classList.add('out'), life);
    setTimeout(() => el.remove(), life + 500);
  }

  async function busy(el, fn) {
    if (el && el.disabled) return;
    if (el) { el.disabled = true; el.classList.add('loading'); }
    try { return await fn(); }
    catch (e) { toast(e.message || String(e), 'danger'); }
    finally { if (el && el.isConnected) { el.disabled = false; el.classList.remove('loading'); } }
  }

  function modal(html) {
    const m = $('#modal');
    m.innerHTML = `<div class="modal-back" data-act="modal-close"></div><div class="modal-card" role="dialog" aria-modal="true">${html}</div>`;
    m.hidden = false;
  }
  function closeModal() { const m = $('#modal'); m.hidden = true; m.innerHTML = ''; }
  ACT['modal-close'] = closeModal;

  function confirmBox(title, html, okLabel, onOk, danger) {
    S.view.confirm = onOk;
    modal(`<h2>${esc(title)}</h2><div>${html}</div><div class="row" style="justify-content:flex-end"><button class="btn" data-act="modal-close">ยกเลิก</button><button class="btn ${danger ? 'danger' : 'primary'}" data-act="confirm-ok">${esc(okLabel)}</button></div>`);
  }
  ACT['confirm-ok'] = (el) => busy(el, async () => { await S.view.confirm(); });

  function copy(text) {
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => toast('คัดลอกแล้ว'), () => window.prompt('คัดลอกข้อความนี้', text));
    else window.prompt('คัดลอกข้อความนี้', text);
  }
  ACT.copy = (el) => copy(el.dataset.v);

  function downloadCsv(name, rows) {
    const csv = '﻿' + rows.map((r) => r.map((v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  function qrSvg(text, cell) {
    if (typeof qrcode !== 'function') return `<p style="color:#0F172A">${esc(text)}</p>`;
    const q = qrcode(0, 'M');
    q.addData(text);
    q.make();
    return q.createSvgTag(cell || 6, 2);
  }

  // ---------- router ----------

  const PAGES = {};

  async function route() {
    const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
    let name = parts[0] || HOME;
    if (!PAGES[name] || (PAGES[name].roles && PAGES[name].roles.indexOf(ROLE) < 0)) name = HOME;
    S.page = PAGES[name];
    S.parts = parts;
    closeModal();
    app.innerHTML = '<div class="center-load"><span class="spinner"></span> กำลังโหลด…</div>';
    try {
      // หน้าที่ load เองโหลด bootstrap อยู่แล้ว (boots) ไม่ต้องเรียกซ้ำ — Apps Script ตอบช้าครั้งละหลายวินาที
      if (!S.boot && !S.page.boots) await refreshBoot();
      if (S.page.load) await S.page.load(parts);
      paint();
      window.scrollTo(0, 0);
    } catch (e) {
      // เบราว์เซอร์ยังจำ config.js เก่า (โหมดทดลอง) ไว้ รหัสจริงจึงใช้ไม่ได้
      const stale = Client.demo && ROLE !== 'public' && !/^demo-/.test(Object.values(KEYS)[0] || '');
      const hint = stale ? note('warning', 'info', 'หน้าเว็บนี้ยังเป็นโหมดทดลองอยู่ (เบราว์เซอร์จำไฟล์เก่าไว้) กด <b>Ctrl+F5</b> หรือ <b>Ctrl+Shift+R</b> เพื่อโหลดใหม่') : '';
      app.innerHTML = mobileShell('เกิดข้อผิดพลาด', `${note('danger', 'alert', esc(e.message))}${hint}<a class="btn" href="${esc(BASE)}">กลับหน้าแรก</a>`, { back: false });
    }
  }

  function paint() { app.innerHTML = S.page.view(S.parts); }
  async function refreshBoot() { S.boot = await call('bootstrap'); }
  async function reload() {
    await refreshBoot();
    if (S.page.load) await S.page.load(S.parts);
    paint();
  }
  ACT.reload = (el) => busy(el, async () => { await reload(); toast('อัปเดตข้อมูลแล้ว'); });

  // ---------- โครงหน้า ----------

  function demoTag() {
    return Client.demo ? '<a class="demo-tag no-print" href="#/demo">โหมดทดลอง • สลับบทบาท</a>' : '';
  }

  function mobileShell(title, body, opt = {}) {
    let back = '';
    if (opt.backAct) back = `<button class="icon-btn" data-act="${opt.backAct}" aria-label="ย้อนกลับ">${ic('back')}</button>`;
    else if (opt.back !== false) back = `<a class="icon-btn" href="#/${esc(opt.back || '')}" aria-label="ย้อนกลับ">${ic('back')}</a>`;
    const bar = opt.noBar ? '' : `<header class="appbar">${back}<h1>${esc(title)}</h1>${opt.right || ''}</header>`;
    return `<div class="mobile ${opt.wide ? 'wide' : ''}">${bar}${body}</div>${demoTag()}`;
  }

  const ADMIN_NAV = [
    ['admin', 'home', 'ภาพรวม'], ['regs', 'users', 'ลงทะเบียน & เปลี่ยนตัว'], ['bracket', 'bracket', 'สายการแข่งขัน'],
    ['scores', 'clipboard', 'บันทึกผล'], ['certs', 'award', 'สรุปผล & เกียรติบัตร'], ['settings', 'settings', 'ตั้งค่า & ลิงก์']
  ];

  function adminShell(active, title, sub, actions, body) {
    const ev = S.boot.event;
    return `<div class="admin"><aside class="side no-print">
      <div class="brand"><div class="logo">${ic('trophy')}</div><div><b>${esc(ev.name)} ${esc(ev.year)}</b><div class="xs muted">ระบบจัดการการแข่งขัน</div></div></div>
      <nav>${ADMIN_NAV.map(([k, i, l]) => `<a href="#/${k}" class="${k === active ? 'on' : ''}">${ic(i)}${l}</a>`).join('')}
        <a href="#/">${ic('users')}หน้าของนักเรียน</a>
        <a href="#/help" class="${active === 'help' ? 'on' : ''}">${ic('info')}วิธีใช้งาน</a></nav>
      <div class="side-foot">${Client.demo ? '<b>โหมดทดลอง</b><br>ข้อมูลเก็บในเบราว์เซอร์นี้เท่านั้น' : '<b>เชื่อม Google Sheet แล้ว</b><br>ข้อมูลทั้งหมดอยู่ในชีต'}</div>
    </aside><main class="main">
      <div class="page-head"><div><h1>${esc(title)}</h1><p class="muted">${sub}</p></div><div class="actions">${actions || ''}<button class="icon-btn" data-act="reload" title="โหลดข้อมูลใหม่">${ic('refresh')}</button></div></div>
      ${body}</main></div>${demoTag()}`;
  }

  // ---------- ชิ้นส่วนที่ใช้ซ้ำ ----------

  function medalTableHtml() {
    const rows = S.boot.medals;
    const p = S.boot.event.points;
    return `<div class="card flush"><div class="card-head"><h2>ตารางเหรียญรายสี</h2>${pill('อัปเดตสด', 'success')}</div><div class="tbl-wrap"><table class="tbl">
      <tr><th>อันดับ</th><th>สี</th><th class="num">ทอง</th><th class="num">เงิน</th><th class="num">ทองแดง</th><th class="num">ชมเชย</th><th class="num">คะแนน</th></tr>
      ${rows.map((r, i) => `<tr><td><span class="rank ${i < 3 && r.points ? 'r' + (i + 1) : ''}">${i + 1}</span></td><td>${chip(r.teamId)}</td>
        <td class="num">${r.gold}</td><td class="num">${r.silver}</td><td class="num">${r.bronze}</td><td class="num">${r.honor}</td><td class="num"><b>${r.points}</b></td></tr>`).join('')}
    </table></div><p class="xs muted" style="padding:12px 20px">เกณฑ์คะแนน: ทอง ${p.gold} • เงิน ${p.silver} • ทองแดง ${p.bronze} • ชมเชย ${p.honor}</p></div>`;
  }

  function placesOf(sportId) {
    const res = S.boot.results.filter((r) => r.sportId === sportId);
    const by = { 1: [], 2: [], 3: [], H: [] };
    res.forEach((r) => by[r.place] && by[r.place].push(r));
    return { any: res.length > 0, by };
  }

  function placeEntry(r) {
    const a = r.athleteId && S.boot.athletesById[r.athleteId];
    return chip(r.teamId) + (a ? ` <span class="small">${esc(a.fullName)}</span>` : '');
  }

  function sportResultsHtml(sp) {
    const { any, by } = placesOf(sp.id);
    if (!any) return '';
    const line = (k, label, cls) => by[k].length ? `<div class="li"><span class="rank ${cls}">${k === 'H' ? '★' : k}</span><div class="who"><div class="xs muted">${label}</div><div class="row wrap" style="gap:6px">${by[k].map(placeEntry).join('')}</div></div></div>` : '';
    return `<div class="card flush"><div class="card-head"><h2>${esc(sp.name)}</h2></div><div class="list" style="border:0;border-top:1px solid var(--border);border-radius:0">
      ${line('1', 'ชนะเลิศ', 'r1')}${line('2', 'รองชนะเลิศอันดับ 1', 'r2')}${line('3', 'รองชนะเลิศอันดับ 2', 'r3')}${line('H', 'ชมเชย', '')}</div></div>`;
  }

  // กล่องค้นหา + รายชื่อสมาชิก (ใช้ตอนสมัคร แก้ทีม และเลือกคนเข้าแทน)
  function sugsHtml(ed) {
    const q = ed.search.trim();
    if (!q) return '';
    const inTeam = new Set(ed.members.map((m) => m.studentId));
    const hits = ed.pool.filter((s) => (s.name + ' ' + s.classRoom).indexOf(q) >= 0).slice(0, 8);
    if (!hits.length) return `<div class="sug-empty">ไม่พบชื่อ “${esc(q)}” ในสี${esc(teamOf(ed.teamId).name)}</div>`;
    return `<div class="sugs">${hits.map((s) => {
      const added = inTeam.has(s.id);
      let right;
      if (added) right = pill('อยู่ในทีมแล้ว');
      else if (s.reason) right = pill('ลงไม่ได้');
      else if (ed.mode === 'pick') right = `<button class="btn sm primary" data-act="sub-pick" data-id="${s.id}">เลือก</button>`;
      else right = `<button class="btn sm primary" data-act="mem-add" data-id="${s.id}">+ เพิ่ม</button>`;
      const meta = [s.classRoom, s.reason, s.otherSports.length ? 'ลงแล้ว ' + s.otherSports.length + ' รายการ' : ''].filter(Boolean).join(' • ');
      return `<div class="sug ${added || s.reason ? 'dis' : ''}"><div class="grow"><b>${esc(s.name)}</b><div class="xs ${s.otherSports.length && !s.reason ? 'warn' : 'muted'}">${esc(meta)}</div></div>${right}</div>`;
    }).join('')}</div>`;
  }

  function searchBox(ed, placeholder) {
    return `<div class="search">${ic('search')}<input id="mem-search" data-input="mem-search" placeholder="${esc(placeholder)}" value="${esc(ed.search)}" autocomplete="off"></div><div id="sugs">${sugsHtml(ed)}</div>`;
  }

  function editorHtml(ed) {
    const sp = ed.sport, max = +sp.maxPlayers, min = +sp.minPlayers;
    const starters = ed.members.filter((m) => m.role === 'ตัวจริง').length;
    const name = (id) => (ed.pool.find((s) => s.id === id) || {});
    const rows = ed.members.map((m) => {
      const s = name(m.studentId);
      return `<div class="li"><div class="who"><b>${esc(s.name || m.studentId)}</b><div class="xs muted">${esc(s.classRoom || '')}</div></div>
        ${sp.type === 'ทีม' ? `<div class="seg"><button class="${m.role === 'ตัวจริง' ? 'on' : ''}" data-act="mem-role" data-id="${m.studentId}" data-role="ตัวจริง">จริง</button><button class="${m.role === 'สำรอง' ? 'on' : ''}" data-act="mem-role" data-id="${m.studentId}" data-role="สำรอง">สำรอง</button></div>` : ''}
        <button class="icon-btn" data-act="mem-remove" data-id="${m.studentId}" aria-label="ลบ">${ic('x', 'sm')}</button></div>`;
    }).join('');
    const countKind = ed.members.length > max ? 'danger' : ed.members.length < min ? 'warning' : 'success';
    return `${searchBox(ed, 'พิมพ์ชื่อหรือห้อง เพื่อเพิ่มสมาชิก')}
      <div class="row between"><b>สมาชิก ${ed.members.length}/${max} คน</b>${pill(sp.type === 'ทีม' ? `ตัวจริง ${starters} • สำรอง ${ed.members.length - starters}` : `ขั้นต่ำ ${min} คน`, countKind)}</div>
      <div class="list">${rows || '<div class="empty">ยังไม่มีสมาชิก — ค้นชื่อด้านบนเพื่อเพิ่ม</div>'}</div>
      ${ed.members.length < min ? note('warning', 'alert', `ต้องการอย่างน้อย ${min} คน (ส่งไว้ก่อนได้ แล้วค่อยเพิ่มภายหลัง)`) : ''}`;
  }

  INPUT['mem-search'] = (el) => { S.ed.search = el.value; $('#sugs').innerHTML = sugsHtml(S.ed); };
  ACT['mem-add'] = (el) => {
    const ed = S.ed;
    if (ed.members.length >= +ed.sport.maxPlayers) return toast('ครบจำนวนสูงสุด ' + ed.sport.maxPlayers + ' คนแล้ว', 'danger');
    const starters = ed.members.filter((m) => m.role === 'ตัวจริง').length;
    ed.members.push({ studentId: el.dataset.id, role: starters >= +ed.sport.minPlayers ? 'สำรอง' : 'ตัวจริง' });
    ed.search = '';
    paint();
    const s = $('#mem-search');
    if (s) s.focus();
  };
  ACT['mem-role'] = (el) => { S.ed.members.find((m) => m.studentId === el.dataset.id).role = el.dataset.role; paint(); };
  ACT['mem-remove'] = (el) => { S.ed.members = S.ed.members.filter((m) => m.studentId !== el.dataset.id); paint(); };

  async function makeEditor(sport, teamId, members, mode) {
    const pool = await call('teamStudents', { teamId, sportId: sport.id });
    S.ed = { sport, teamId, pool, members, search: '', mode: mode || 'multi' };
  }

  // ---------- สายการแข่งขัน ----------

  function bracketHtml(ms, clickable) {
    const main = ms.filter((m) => m.kind === 'main');
    if (!main.length) return '<div class="empty">ยังไม่ได้จับสลากจัดสาย</div>';
    const R = Math.max(...main.map((m) => +m.round));
    const CW = 214, CH = 92, GX = 60, GY = 16, TOP = 30;
    const pos = {};
    const byRound = (r) => main.filter((m) => +m.round === r).sort((a, b) => a.slot - b.slot);
    byRound(1).forEach((m, i) => { pos[m.id] = { x: 0, y: TOP + i * (CH + GY) }; });
    for (let r = 2; r <= R; r++) {
      byRound(r).forEach((m) => {
        const kids = main.filter((k) => k.nextMatchId === m.id).map((k) => pos[k.id].y);
        pos[m.id] = { x: (r - 1) * (CW + GX), y: kids.reduce((a, b) => a + b, 0) / kids.length };
      });
    }
    const final = byRound(R)[0];
    const third = ms.find((m) => m.kind === 'third');
    if (third) pos[third.id] = { x: (R - 1) * (CW + GX), y: pos[final.id].y + CH + 64 };
    const width = R * (CW + GX) + 180;
    const height = Math.max(...Object.values(pos).map((p) => p.y)) + CH + 10;
    let lines = '';
    main.forEach((m) => {
      if (!m.nextMatchId || !pos[m.nextMatchId]) return;
      const a = pos[m.id], b = pos[m.nextMatchId];
      const x1 = a.x + CW, y1 = a.y + CH / 2, x2 = b.x, y2 = b.y + CH / 2, mid = x1 + GX / 2;
      const on = (m.status === 'done' || m.status === 'bye') && m.winner !== Core.BYE;
      lines += `<path d="M${x1} ${y1}H${mid}V${y2}H${x2}" fill="none" stroke="${on ? 'var(--primary)' : 'var(--border)'}" stroke-width="2"/>`;
    });
    const fp = pos[final.id];
    lines += `<path d="M${fp.x + CW} ${fp.y + CH / 2}H${fp.x + CW + GX}" stroke="var(--border)" stroke-width="2"/>`;
    const heads = [];
    for (let r = 1; r <= R; r++) heads.push(`<div class="col-h" style="left:${(r - 1) * (CW + GX)}px">${esc(Core.roundName({ kind: 'main', round: r }, R))}</div>`);
    heads.push(`<div class="col-h" style="left:${R * (CW + GX)}px">แชมป์</div>`);
    const champ = final.status === 'done' || final.status === 'bye' ? chip(final.winner) : '<span class="xs muted">รอผลนัดชิง</span>';
    const cards = ms.filter((m) => pos[m.id]).map((m) => matchCard(m, pos[m.id], CW, CH, clickable, R)).join('');
    const thirdLabel = third ? `<div class="col-h" style="left:${pos[third.id].x}px;top:${pos[third.id].y - 22}px;color:var(--warning)">ผู้แพ้รอบรองฯ → ชิงอันดับ 3</div>` : '';
    return `<div class="bracket-scroll"><div class="bracket" style="width:${width}px;height:${height}px">
      <svg width="${width}" height="${height}">${lines}</svg>${heads.join('')}${thirdLabel}${cards}
      <div class="champ" style="left:${R * (CW + GX)}px;top:${fp.y + CH / 2 - 52}px;width:170px">${ic('trophy')}<b>แชมป์</b>${champ}</div>
    </div></div>`;
  }

  function matchCard(m, p, w, h, clickable, R) {
    const row = (slot) => {
      const t = slot === 'A' ? m.teamA : m.teamB, sc = slot === 'A' ? m.scoreA : m.scoreB;
      const tm = t && t !== Core.BYE ? teamOf(t) : null;
      const won = (m.status === 'done' || m.status === 'bye') && m.winner === t && t !== Core.BYE;
      const lost = m.status === 'done' && m.loser === t;
      const label = t === Core.BYE ? 'BYE' : tm ? 'สี' + tm.name : (m.kind === 'third' ? 'รอผู้แพ้รอบรองฯ' : 'รอผู้ชนะ');
      const score = m.status === 'bye' ? (won ? 'ผ่าน' : '–') : (sc === '' ? '' : sc);
      return `<div class="mr ${won ? 'win' : ''} ${!tm || lost ? 'dim' : ''}"><i style="${tm ? 'background:' + esc(tm.color) : ''}"></i><span>${esc(label)}</span><b>${esc(score)}</b></div>`;
    };
    const meta = [Core.roundName(m, R), m.time, m.venue].filter(Boolean).join(' • ');
    const can = clickable && m.status !== 'bye';
    return `<div class="mcard ${m.status} ${can ? 'click' : ''}" style="left:${p.x}px;top:${p.y}px;width:${w}px;height:${h}px" ${can ? `data-act="match-open" data-id="${m.id}"` : ''}>
      <div class="mh">${esc(meta)}</div>${row('A')}${row('B')}</div>`;
  }

  function sportSelect(list, current, act) {
    return `<select data-change="${act}" style="max-width:280px">${list.map((s) => `<option value="${s.id}" ${s.id === current ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>`;
  }

  // ========== หน้านักเรียน ==========

  PAGES[''] = {
    view() {
      const ev = S.boot.event;
      const item = (href, i, t, d, dis) => `<a href="${href}" class="${dis ? 'dis' : ''}"><span class="mi">${ic(i)}</span><span class="grow"><b>${t}</b><span class="small muted">${d}</span></span></a>`;
      const roleLink = ROLE === 'captain' ? item('#/captain', 'users', 'หน้าประธานสี', 'อนุมัติรายชื่อ / ดูการเปลี่ยนตัว')
        : ROLE === 'referee' ? item('#/ref', 'clipboard', 'บันทึกผลการแข่งขัน', 'สำหรับกรรมการ')
          : ROLE === 'admin' ? item('#/admin', 'settings', 'หน้าแอดมิน', 'จัดการทั้งระบบ') : '';
      return mobileShell('', `
        <section class="hero"><div class="logo">${ic('trophy', 'lg')}</div><p class="muted">${esc(ev.school)}</p>
          <h1>${esc(ev.name)} ${esc(ev.year)}</h1>
          ${ev.closed ? pill('ปิดรับสมัครแล้ว', 'danger') : pill('ปิดรับสมัคร ' + fmt(ev.deadline), 'warning')}</section>
        <div class="menu">${roleLink}
          ${item('#/register', 'plus', 'สมัครแข่งกีฬา', 'เลือกห้องและชื่อ แล้วเลือกกีฬา', ev.closed)}
          ${item('#/team', 'key', 'มีรหัสแก้ไขทีม', 'แก้รายชื่อ / เปลี่ยนตัวนักกีฬา')}
          ${item('#/help', 'info', 'วิธีใช้งาน', 'คู่มือสั้น ๆ แยกตามบทบาท')}
          ${item('#/brackets', 'bracket', 'สายการแข่งขัน', 'สีไหนเจอสีไหน ใครเข้ารอบ')}
          ${item('#/results', 'trophy', 'ผลการแข่งขัน', 'ตารางเหรียญและอันดับแต่ละกีฬา')}
        </div>`, { noBar: true });
    }
  };

  // ---------- สมัคร: เลือกห้อง+ชื่อ → เลือกกีฬา → กรอกสมาชิก → รับรหัส ----------

  function stepsBar(cur) {
    return `<div class="steps">${['ระบุผู้กรอก', 'เลือกกีฬา', 'กรอกสมาชิก', 'เสร็จสิ้น'].map((l, i) =>
      `<div class="${i < cur ? 'on' : ''} ${i === cur - 1 ? 'cur' : ''}"><i></i><span>${i + 1} ${l}</span></div>`).join('')}</div>`;
  }

  const me = () => S.reg.students.find((s) => s.id === S.reg.studentId);

  PAGES.register = {
    load() { if (!S.reg || S.reg.step === 4) S.reg = { step: 1, classRoom: '', students: [], studentId: '', filter: 'all' }; },
    view() {
      const r = S.reg;
      if (r.step === 1) return regStep1(r);
      if (r.step === 2) return regStep2(r);
      if (r.step === 3) return regStep3(r);
      return regDone(r.result);
    }
  };

  function regStep1(r) {
    const tid = r.classRoom && classTeam(r.classRoom);
    const rooms = S.boot.classes.map((c) => c.id).sort((a, b) => a.localeCompare(b, 'th', { numeric: true }));
    return mobileShell('สมัครแข่งกีฬา', `${stepsBar(1)}
      <div class="card stack">
        <p class="small muted">ไม่ต้องล็อกอิน — เลือกห้องและชื่อของคุณ</p>
        <label class="field"><span>ชั้น / ห้อง</span><select data-change="reg-class"><option value="">เลือกห้อง…</option>
          ${rooms.map((c) => `<option ${c === r.classRoom ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
        ${r.classRoom ? `${tid ? note('primary', 'info', `ห้องนี้อยู่ ${chip(tid)} (ระบบเลือกสีให้อัตโนมัติ)`) : note('danger', 'alert', 'ห้องนี้ยังไม่ได้กำหนดสี แจ้งครู')}
        <label class="field"><span>ชื่อของคุณ</span><select data-change="reg-student"><option value="">เลือกชื่อ…</option>
          ${r.students.map((s) => `<option value="${s.id}" ${s.id === r.studentId ? 'selected' : ''}>เลขที่ ${esc(s.number)}  ${esc(s.name)}</option>`).join('')}</select>
          <small>รายชื่อดึงจากชีต Students ไม่ต้องพิมพ์เอง</small></label>` : ''}
        <button class="btn primary block" data-act="reg-next" ${r.studentId && tid ? '' : 'disabled'}>ถัดไป: เลือกกีฬา</button>
      </div>
      ${codeBox()}
      <p class="xs muted row">${ic('info', 'sm')} ระบบบันทึกชื่อที่เลือกและเวลา ทุกครั้งที่ส่งหรือแก้ไข</p>`, { back: '' });
  }

  function codeBox() {
    return `<div class="card stack"><b class="row">${ic('key')} มีรหัสแก้ไขทีมแล้ว? (แก้รายชื่อ / เปลี่ยนตัว)</b>
      <div class="row"><input id="code-in" placeholder="รหัส 6 ตัว เช่น R7K-2Q9" autocomplete="off" style="text-transform:uppercase"><button class="btn" data-act="open-code">เปิดทีม</button></div></div>`;
  }

  CHANGE['reg-class'] = (el) => busy(el, async () => {
    S.reg.classRoom = el.value;
    S.reg.studentId = '';
    S.reg.students = el.value ? await call('students', { classRoom: el.value }) : [];
    paint();
  });
  CHANGE['reg-student'] = (el) => { S.reg.studentId = el.value; paint(); };
  ACT['reg-next'] = () => { S.reg.step = 2; paint(); };
  ACT['reg-back'] = () => { if (S.reg.step <= 1) location.hash = '#/'; else { S.reg.step--; paint(); } };
  ACT['reg-filter'] = (el) => { S.reg.filter = el.dataset.v; paint(); };
  ACT['open-code'] = () => {
    const v = Core.normalizeCode($('#code-in').value);
    if (v.length !== 6) return toast('รหัสต้องมี 6 ตัว', 'danger');
    location.hash = '#/t/' + v;
  };

  function regStep2(r) {
    const st = me(), tid = classTeam(st.classRoom), t = teamOf(tid);
    const list = S.boot.sports.filter((sp) => r.filter === 'all' || sp.type === r.filter);
    const firstChar = st.name.replace(/^(ด\.ช\.|ด\.ญ\.|นาย|นางสาว|นาง)/, '').trim().charAt(0);
    return mobileShell('เลือกกีฬาที่จะลงแข่ง', `${stepsBar(2)}
      <div class="card row"><div class="avatar" style="background:${esc(t.color)}">${esc(firstChar)}</div>
        <div class="grow"><b>${esc(st.name)}</b><div class="xs muted">${esc(st.classRoom)} • เลขที่ ${esc(st.number)} • ${st.gender === 'ช' ? 'ชาย' : 'หญิง'}</div></div>${chip(tid)}</div>
      <div class="tabs">${[['all', 'ทั้งหมด'], ['ทีม', 'ประเภททีม'], ['บุคคล', 'บุคคล']].map(([k, l]) => `<button class="${r.filter === k ? 'on' : ''}" data-act="reg-filter" data-v="${k}">${l}</button>`).join('')}</div>
      ${list.map((sp) => sportItem(sp, st, tid)).join('')}
      ${S.boot.event.closed ? note('danger', 'clock', 'เลยกำหนดปิดรับสมัครแล้ว') : note('warning', 'clock', 'ปิดรับสมัคร ' + fmt(S.boot.event.deadline))}`, { backAct: 'reg-back' });
  }

  function sportItem(sp, st, tid) {
    const why = Core.ineligibleReason({ gender: st.gender, classRoom: st.classRoom }, sp);
    const reg = S.boot.registrations.find((x) => x.sportId === sp.id && x.teamId === tid);
    const closed = S.boot.event.closed || sp.status === 'ปิดรับ';
    const max = +sp.maxPlayers, tname = teamOf(tid).name;
    let status, action = '';
    if (why) status = pill(why);
    else if (reg) {
      status = pill(`สี${tname} ${reg.count}/${max}`, reg.count >= max ? 'muted' : 'success') + ` <span class="xs muted">ตัวแทน: ${esc(reg.repName)}</span>`;
      if (sp.type === 'ทีม') action = `<button class="btn sm" data-act="view-team" data-id="${reg.id}">ดูทีม</button>`;
      else if (!closed && reg.count < max) action = `<button class="btn sm primary" data-act="self-reg" data-id="${sp.id}">สมัครตัวเอง</button>`;
    } else if (closed) status = pill('ปิดรับสมัคร', 'danger');
    else if (sp.type === 'ทีม') {
      status = pill(`สี${tname}ยังไม่มีผู้ส่ง`, 'warning') + ' <span class="xs muted">คุณจะเป็นตัวแทนทีม</span>';
      action = `<button class="btn sm primary" data-act="start-team" data-id="${sp.id}">สร้างทีม</button>`;
    } else {
      status = pill(`ว่าง ${max} ที่`, 'primary');
      action = `<button class="btn sm primary" data-act="self-reg" data-id="${sp.id}">สมัครตัวเอง</button>`;
    }
    const size = sp.type === 'ทีม' ? `${sp.minPlayers}–${sp.maxPlayers} คน` : `สีละ ${sp.maxPlayers} คน`;
    return `<div class="card sport ${why ? 'dis' : ''}"><div class="row"><div class="grow"><b>${esc(sp.name)}</b>
      <div class="xs muted">${esc(sp.type)} • ${size}${sp.venue ? ' • ' + esc(sp.venue) : ''}</div></div>${action}</div><div class="row gap">${status}</div></div>`;
  }

  ACT['view-team'] = (el) => busy(el, async () => {
    const t = await call('publicTeam', { registrationId: el.dataset.id });
    const reg = t.registration;
    modal(`<h2>${esc(sportOf(reg.sportId).name)}</h2><div class="row">${chip(reg.teamId)} ${stPill(reg.status)}</div>
      <p class="small muted">ตัวแทนทีม: ${esc(reg.repName)} — ถ้าอยากเข้าทีม ให้ติดต่อตัวแทนทีมหรือประธานสี</p>
      <div class="list">${t.athletes.map((a) => `<div class="li"><div class="who">${esc(a.fullName)}<div class="xs muted">${esc(a.classRoom)}</div></div>${pill(a.role)}</div>`).join('')}</div>
      <button class="btn" data-act="modal-close">ปิด</button>`);
  });

  ACT['start-team'] = (el) => busy(el, async () => {
    const sp = sportOf(el.dataset.id), st = me(), tid = classTeam(st.classRoom);
    await makeEditor(sp, tid, [{ studentId: st.id, role: 'ตัวจริง' }]);
    S.reg.sportId = sp.id;
    S.reg.step = 3;
    paint();
  });

  ACT['self-reg'] = (el) => {
    const sp = sportOf(el.dataset.id), st = me();
    confirmBox('สมัคร' + sp.name, `ยืนยันสมัครในชื่อ <b>${esc(st.name)}</b> (${esc(st.classRoom)})`, 'ยืนยันสมัคร', async () => {
      S.reg.result = await call('selfRegister', { sportId: sp.id, studentId: st.id });
      S.reg.step = 4;
      await refreshBoot();
      closeModal();
      paint();
    });
  };

  function regStep3() {
    const ed = S.ed;
    return mobileShell(ed.sport.name, `${stepsBar(3)}
      ${note('primary', 'info', `คุณจะเป็น <b>ตัวแทนทีม</b> สี${esc(teamOf(ed.teamId).name)} — ส่งแล้วจะได้ <b>รหัสแก้ไขทีม</b> ไว้แก้รายชื่อได้ถึง ${fmt(S.boot.event.deadline)}`)}
      ${editorHtml(ed)}
      <button class="btn primary block" data-act="reg-submit" ${ed.members.length ? '' : 'disabled'}>ส่งรายชื่อ (${ed.members.length} คน)</button>`,
    { backAct: 'reg-back', right: chip(ed.teamId) });
  }

  ACT['reg-submit'] = (el) => busy(el, async () => {
    S.reg.result = await call('createRegistration', { sportId: S.reg.sportId, repStudentId: S.reg.studentId, members: S.ed.members });
    S.reg.step = 4;
    await refreshBoot();
    paint();
  });

  function regDone(res) {
    const raw = Core.normalizeCode(res.code);
    const link = BASE + '#/t/' + raw;
    const codeCard = res.code ? `<div class="card code-card stack">
        <b class="row" style="color:var(--primary)">${ic('key')} รหัสแก้ไขทีม (เก็บไว้ ห้ามแชร์ในกลุ่มรวม)</b>
        <div class="code-big">${esc(res.code)}</div>
        <div class="xs muted" style="word-break:break-all">ลิงก์แก้ไข: ${esc(link)}</div>
        <div class="row"><button class="btn grow" data-act="copy" data-v="${esc(res.code)}">${ic('copy', 'sm')} คัดลอกรหัส</button><button class="btn grow" data-act="copy" data-v="${esc(link)}">${ic('copy', 'sm')} คัดลอกลิงก์</button></div>
        <p class="xs muted">แนะนำให้แคปหน้าจอนี้เก็บไว้ ถ้ารหัสหาย ให้ประธานสีออกรหัสใหม่</p></div>` : '';
    return mobileShell('ส่งเรียบร้อย', `${stepsBar(4)}
      <div class="note success" style="font-size:15px">${ic('check')}<div><b>${res.code ? 'ส่งรายชื่อแล้ว' : 'สมัครสำเร็จ'}</b><br>${esc(res.sport.name)} • สี${esc(res.team.name)} • ${res.athletes.length} คน — รอประธานสีตรวจ</div></div>
      ${codeCard}
      ${(res.warnings || []).map((w) => note('warning', 'alert', esc(w))).join('')}
      <div class="list">${res.athletes.map((a) => `<div class="li"><div class="who">${esc(a.fullName)}<div class="xs muted">${esc(a.classRoom)}</div></div>${pill(a.role)}</div>`).join('')}</div>
      <div class="row">${res.code ? `<a class="btn primary grow" href="#/t/${raw}">ไปหน้าทีม</a>` : ''}<a class="btn grow" href="#/">กลับหน้าแรก</a></div>`, { back: '' });
  }

  // ---------- หน้าทีม (เปิดด้วยรหัส / ประธานสี / แอดมิน) ----------

  PAGES.team = {
    view() {
      return mobileShell('เปิดทีมด้วยรหัส', `${codeBox()}<p class="small muted">รหัสแก้ไขทีมได้ตอนส่งรายชื่อครั้งแรก ใครมีรหัสนี้แก้รายชื่อทีมได้ ถ้าหาย ให้ประธานสีออกรหัสใหม่</p>`, { back: '' });
    }
  };

  PAGES.t = {
    async load(parts) {
      const code = Core.normalizeCode(parts[1]);
      S.team = Object.assign(await call('openTeam', { code }), { code });
      S.view.teamMode = 'view';
    },
    view: teamView
  };

  PAGES.manage = {
    roles: ['captain', 'admin'],
    async load(parts) {
      S.team = Object.assign(await call('openTeam', { registrationId: parts[1] }), { code: '' });
      S.view.teamMode = 'view';
    },
    view: teamView
  };

  const teamAuth = () => (S.team.code ? { code: S.team.code } : { registrationId: S.team.registration.id });

  function teamView() {
    const T = S.team, sp = T.sport, mode = S.view.teamMode, reg = T.registration;
    const back = T.code ? '' : ROLE === 'admin' ? 'regs' : 'captain';
    const head = `<div class="card"><div class="row"><div class="grow"><b class="lg">${esc(sp.name)}</b>
        <div class="xs muted">ตัวแทน: ${esc(reg.repName)} • ส่งเมื่อ ${fmt(reg.createdAt)}</div></div>${chip(T.team.id)}</div>
      <div class="row gap">${stPill(reg.status)} ${pill(T.athletes.length + '/' + sp.maxPlayers + ' คน')} ${T.via ? pill('เปิดด้วย ' + T.via, 'primary') : ''}</div></div>`;
    let banner;
    if (!T.code) banner = note('primary', 'info', `คุณแก้ไขในฐานะ${ROLE === 'admin' ? 'แอดมิน' : 'ประธานสี'} — แก้รายชื่อและเปลี่ยนตัวได้ทันที`);
    else if (T.canEdit) banner = note('primary', 'info', `แก้รายชื่อได้ถึง ${fmt(T.deadline)} • เปลี่ยนตัวได้ทุกเวลา มีผลทันที (ประธานสีเห็นประวัติทุกครั้ง)`);
    else banner = note('warning', 'alert', 'เลยกำหนดปิดรับสมัครแล้ว เพิ่ม/ลบรายชื่อไม่ได้ แต่ยังกด "เปลี่ยนตัว" ได้ทันที');
    let body;
    if (mode === 'edit') body = teamEditHtml();
    else if (mode === 'sub') body = subFormHtml();
    else body = teamInfoHtml();
    return mobileShell('ทีมของฉัน', head + banner + body, { back });
  }

  function teamInfoHtml() {
    const T = S.team;
    const staff = !T.code;
    const pending = T.registration.status === 'รออนุมัติ';
    const actions = `<div class="row">${T.canEdit ? `<button class="btn grow" data-act="team-mode" data-v="edit">แก้ไขรายชื่อ</button>` : ''}
      <button class="btn primary grow" data-act="team-mode" data-v="sub">${ic('swap', 'sm')} เปลี่ยนตัว</button></div>
      ${staff ? `<div class="row">${pending ? `<button class="btn success grow" data-act="reg-status" data-id="${T.registration.id}" data-v="1">อนุมัติรายชื่อ</button><button class="btn danger" data-act="reg-status" data-id="${T.registration.id}" data-v="0">ไม่อนุมัติ</button>` : ''}
        <button class="btn" data-act="reset-code" data-id="${T.registration.id}">${ic('key', 'sm')} ออกรหัสใหม่</button></div>` : ''}`;
    const members = T.athletes.slice().sort((a, b) => (a.role === b.role ? 0 : a.role === 'ตัวจริง' ? -1 : 1));
    const reqs = T.requests.length ? `<b>ประวัติการเปลี่ยนตัว</b><div class="list">${T.requests.map((q) => `<div class="li"><div class="who">
        <div class="small"><b>${esc(q.outName)}</b> → <b>${esc(q.inName)}</b></div><div class="xs muted">${esc(q.effective)} • ${esc(q.reason)} • ${fmt(q.createdAt)}</div></div>${stPill(q.status)}</div>`).join('')}</div>` : '';
    const removed = T.removed.length ? `<details><summary class="small muted">เปลี่ยนตัวออก/ลบแล้ว ${T.removed.length} คน</summary><div class="list" style="margin-top:8px">${T.removed.map((a) => `<div class="li"><div class="who small">${esc(a.fullName)} <span class="xs muted">${esc(a.classRoom)}</span></div><span class="xs muted">${fmt(a.removedAt)}</span></div>`).join('')}</div></details>` : '';
    const log = T.log.length ? `<b>ประวัติการแก้ไข</b><div class="list">${T.log.map((l) => `<div class="li log-item"><div class="who"><b>${esc(l.action)}</b> — ${esc(l.detail)}<div class="xs muted">${fmt(l.time)} • ${esc(l.actor)} (${esc(l.via)})</div></div></div>`).join('')}</div>` : '';
    return `${actions}<b>รายชื่อ (${T.athletes.length})</b>
      <div class="list">${members.map((a) => `<div class="li"><div class="who">${esc(a.fullName)}<div class="xs muted">${esc(a.classRoom)}</div></div>${pill(a.role, a.role === 'ตัวจริง' ? 'primary' : 'muted')}</div>`).join('') || '<div class="empty">ยังไม่มีรายชื่อ</div>'}</div>
      ${removed}${reqs}${log}`;
  }

  ACT['team-mode'] = (el) => busy(el, async () => {
    const T = S.team, m = el.dataset.v;
    if (m === 'edit' || m === 'sub') {
      await makeEditor(T.sport, T.team.id, T.athletes.map((a) => ({ studentId: a.studentId, role: a.role })), m === 'sub' ? 'pick' : 'multi');
    }
    if (m === 'sub') S.view.sub = { outId: (T.athletes[0] || {}).id || '', inId: '', eff: 'นัดถัดไปเป็นต้นไป', reason: '', detail: '', actor: T.code ? T.registration.repName : '' };
    if (m === 'edit') S.view.actor = T.code ? T.registration.repName : '';
    S.view.teamMode = m;
    paint();
  });

  function teamEditHtml() {
    return `${editorHtml(S.ed)}
      ${S.team.code ? `<label class="field"><span>ชื่อผู้แก้ไข</span><input data-input="team-actor" value="${esc(S.view.actor)}"><small>บันทึกลงประวัติการแก้ไข</small></label>` : ''}
      <div class="row"><button class="btn" data-act="team-mode" data-v="view">ยกเลิก</button><button class="btn primary grow" data-act="team-save">บันทึกรายชื่อ</button></div>`;
  }
  INPUT['team-actor'] = (el) => { S.view.actor = el.value; };

  ACT['team-save'] = (el) => busy(el, async () => {
    const res = await call('updateTeam', Object.assign(teamAuth(), { members: S.ed.members, actorName: S.view.actor }));
    S.team = Object.assign(res, { code: S.team.code, via: S.team.via });
    S.view.teamMode = 'view';
    toast((res.warnings || []).length ? 'บันทึกแล้ว — ' + res.warnings.join(' ') : 'บันทึกรายชื่อแล้ว');
    await refreshBoot();
    paint();
  });

  function subFormHtml() {
    const T = S.team, v = S.view.sub, ed = S.ed;
    const upcoming = S.boot.matches.filter((m) => m.sportId === T.sport.id && (m.teamA === T.team.id || m.teamB === T.team.id) && m.status !== 'done' && m.status !== 'bye');
    const effs = ['นัดถัดไปเป็นต้นไป'].concat(upcoming.map((m) => roundLabel(m) + (m.time ? ' ' + m.time : '') + ' เป็นต้นไป'));
    const inSt = v.inId && ed.pool.find((s) => s.id === v.inId);
    const inBox = inSt
      ? `<div class="note success">${ic('plus')}<div class="grow"><b>${esc(inSt.name)}</b><br><span class="xs">${esc(inSt.classRoom)}</span></div><button class="btn sm" data-act="sub-unpick">เปลี่ยน</button></div>`
      : searchBox(ed, 'ค้นชื่อผู้เล่นที่จะเข้าแทน');
    return `<div class="card stack">
      <label class="field"><span>ผู้เล่นที่ออก</span><select data-change="sub-out">${T.athletes.map((a) => `<option value="${a.id}" ${a.id === v.outId ? 'selected' : ''}>${esc(a.fullName)} (${esc(a.classRoom)} • ${esc(a.role)})</option>`).join('')}</select></label>
      <div class="field"><span>ผู้เล่นที่เข้า</span>${inBox}<small>ค้นได้เฉพาะนักเรียนสี${esc(T.team.name)}ที่ยังไม่อยู่ในทีม</small></div>
      <label class="field"><span>มีผลตั้งแต่</span><select data-change="sub-eff">${effs.map((e) => `<option ${e === v.eff ? 'selected' : ''}>${esc(e)}</option>`).join('')}</select><small>นัดที่แข่งไปแล้วยังเก็บชื่อเดิมไว้ (ใช้ออกเกียรติบัตร)</small></label>
      <div class="field"><span>เหตุผล</span><div class="chips">${['บาดเจ็บ', 'ป่วย/ลา', 'ติดภารกิจ', 'อื่น ๆ'].map((x) => `<button class="chipbtn ${v.reason === x ? 'on' : ''}" data-act="sub-reason" data-v="${x}">${x}</button>`).join('')}</div>
        <input data-input="sub-detail" value="${esc(v.detail)}" placeholder="รายละเอียด (ถ้ามี) เช่น ข้อเท้าพลิกระหว่างซ้อม"></div>
      ${T.code ? `<label class="field"><span>ชื่อผู้ขอ</span><input data-input="sub-actor" value="${esc(v.actor)}"></label>` : ''}
      </div>
      <div class="row"><button class="btn" data-act="team-mode" data-v="view">ยกเลิก</button><button class="btn primary grow" data-act="sub-submit">เปลี่ยนตัว (มีผลทันที)</button></div>`;
  }

  CHANGE['sub-out'] = (el) => { S.view.sub.outId = el.value; };
  CHANGE['sub-eff'] = (el) => { S.view.sub.eff = el.value; };
  INPUT['sub-detail'] = (el) => { S.view.sub.detail = el.value; };
  INPUT['sub-actor'] = (el) => { S.view.sub.actor = el.value; };
  ACT['sub-reason'] = (el) => { S.view.sub.reason = el.dataset.v; paint(); };
  ACT['sub-pick'] = (el) => { S.view.sub.inId = el.dataset.id; S.ed.search = ''; paint(); };
  ACT['sub-unpick'] = () => { S.view.sub.inId = ''; paint(); };
  ACT['sub-submit'] = (el) => busy(el, async () => {
    const v = S.view.sub;
    if (!v.inId) throw new Error('เลือกผู้เล่นที่จะเข้าแทน');
    if (!v.reason) throw new Error('เลือกเหตุผล');
    const res = await call('requestSub', Object.assign(teamAuth(), {
      outAthleteId: v.outId, inStudentId: v.inId, effective: v.eff,
      reason: v.reason + (v.detail.trim() ? ' — ' + v.detail.trim() : ''), actorName: v.actor
    }));
    S.team = Object.assign(res, { code: S.team.code, via: S.team.via });
    S.view.teamMode = 'view';
    toast('เปลี่ยนตัวเรียบร้อย มีผลทันที');
    paint();
  });

  // ---------- สายแข่ง / ผล (ทุกคนดูได้) ----------

  PAGES.brackets = {
    view(parts) {
      const list = S.boot.sports.filter((s) => s.format !== 'จัดอันดับ');
      const id = parts[1] || (list.find((s) => S.boot.matches.some((m) => m.sportId === s.id)) || list[0] || {}).id;
      const sp = id && sportOf(id);
      if (!sp) return mobileShell('สายการแข่งขัน', '<div class="empty">ยังไม่มีรายการกีฬา</div>');
      const ms = S.boot.matches.filter((m) => m.sportId === sp.id);
      return mobileShell('สายการแข่งขัน', `${sportSelect(list, sp.id, 'pub-sport')}
        <div class="card">${bracketHtml(ms, false)}</div>${sportResultsHtml(sp)}`, { wide: true, right: `<button class="icon-btn" data-act="reload">${ic('refresh')}</button>` });
    }
  };
  CHANGE['pub-sport'] = (el) => { location.hash = '#/brackets/' + el.value; };

  PAGES.results = {
    view() {
      const done = S.boot.sports.filter((s) => placesOf(s.id).any);
      return mobileShell('ผลการแข่งขัน', `${medalTableHtml()}${done.map(sportResultsHtml).join('') || '<div class="empty">ยังไม่มีกีฬาที่แข่งจบ</div>'}`,
        { wide: true, right: `<button class="icon-btn" data-act="reload">${ic('refresh')}</button>` });
    }
  };

  // ========== ประธานสี ==========

  PAGES.captain = {
    roles: ['captain'],
    async load() { S.cap = await call('captainData'); S.view.capTab = S.view.capTab || 'req'; },
    view() {
      const C = S.cap, tab = S.view.capTab;
      const pendRegs = C.registrations.filter((r) => r.status === 'รออนุมัติ');
      const missing = S.boot.sports.filter((sp) => !C.registrations.some((r) => r.sportId === sp.id));
      const tabs = [['req', `การเปลี่ยนตัว (${C.requests.length})`], ['teams', `ทีมทั้งหมด (${C.registrations.length}) ${pendRegs.length ? '• รอ ' + pendRegs.length : ''}`], ['missing', `ยังไม่ส่ง (${missing.length})`], ['log', 'ประวัติ']];
      let body = '';
      if (tab === 'req') body = note('primary', 'info', 'ตัวแทนทีมเปลี่ยนตัวได้เองและมีผลทันที ถ้าไม่เหมาะสมให้กด "ย้อนกลับ"') + subCards(C.requests);
      if (tab === 'teams') body = regList(C.registrations);
      if (tab === 'missing') body = `<div class="list">${missing.map((sp) => `<div class="li"><div class="who"><b>${esc(sp.name)}</b><div class="xs muted">${esc(sp.type)} • ${sp.minPlayers}–${sp.maxPlayers} คน</div></div>${pill('ยังไม่มีผู้ส่ง', 'warning')}</div>`).join('') || '<div class="empty">ส่งครบทุกกีฬาแล้ว</div>'}</div>
        ${note('primary', 'info', 'แจ้งนักเรียนสแกน QR แล้วกด "สร้างทีม" ในกีฬานั้น')}`;
      if (tab === 'log') body = logList(C.log);
      return mobileShell('ประธานสี' + C.team.name, `
        <div class="card row">${chip(C.team.id)}<div class="grow small muted">เปิดจากลิงก์ประธานสี (ลิงก์ลับ ไม่ต้องล็อกอิน) • ${esc(C.actor)}</div></div>
        <div class="tabs">${tabs.map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-act="cap-tab" data-v="${k}">${l}</button>`).join('')}</div>${body}`,
      { back: '', wide: true, right: `<a class="icon-btn" href="#/help" title="วิธีใช้งาน">${ic('info')}</a><button class="icon-btn" data-act="reload">${ic('refresh')}</button>` });
    }
  };
  ACT['cap-tab'] = (el) => { S.view.capTab = el.dataset.v; paint(); };

  // การเปลี่ยนตัว: มีผลทันที ประธานสี/แอดมินกด "ย้อนกลับ" ได้ (คำขอแบบเก่าที่ค้าง ยังอนุมัติได้)
  function subCards(list) {
    const card = (q) => {
      let foot;
      if (q.status === 'มีผลแล้ว') foot = `<div class="row"><span class="xs muted grow">${q.decidedBy ? 'อนุมัติโดย ' + esc(q.decidedBy) : 'มีผลทันทีที่ตัวแทนทีมกด'}</span><button class="btn sm danger" data-act="undo-sub" data-id="${q.id}">ย้อนกลับ</button></div>`;
      else if (q.status === 'รออนุมัติ') foot = `<div class="row" style="justify-content:flex-end"><button class="btn danger" data-act="decide" data-id="${q.id}" data-v="0">ไม่อนุมัติ</button><button class="btn primary" data-act="decide" data-id="${q.id}" data-v="1">อนุมัติ</button></div>`;
      else foot = `<div class="xs muted">${esc(q.status)}โดย ${esc(q.decidedBy)} • ${fmt(q.decidedAt)}</div>`;
      return `<div class="card stack"><div class="row"><div class="grow"><b>${esc(sportOf(q.sportId).name)}</b> ${chip(q.teamId)}
        <div class="xs muted">โดย ${esc(q.requestedBy)} • ${fmt(q.createdAt)}</div></div>${stPill(q.status)}</div>
      <div class="note" style="background:var(--bg)">${ic('swap')}<div>${pill('ออก', 'danger')} <b>${esc(q.outName)}</b> → ${pill('เข้า', 'success')} <b>${esc(q.inName)}</b></div></div>
      <div class="small muted">มีผล: ${esc(q.effective)} • เหตุผล: ${esc(q.reason)}</div>${foot}</div>`;
    };
    return list.map(card).join('') || '<div class="empty">ยังไม่มีการเปลี่ยนตัว</div>';
  }

  ACT['undo-sub'] = (el) => {
    const id = el.dataset.id;
    confirmBox('ย้อนการเปลี่ยนตัว?', 'ผู้เล่นเดิมจะกลับเข้าทีม และคนที่เข้ามาแทนจะออก ระบบบันทึกลงประวัติ', 'ย้อนกลับ', async () => {
      await call('undoSub', { requestId: id });
      toast('ย้อนการเปลี่ยนตัวแล้ว');
      closeModal();
      await reload();
    }, true);
  };

  function regList(regs) {
    const sorted = regs.slice().sort((a, b) => +sportOf(a.sportId).order - +sportOf(b.sportId).order);
    return `<div class="list">${sorted.map((r) => {
      const sp = sportOf(r.sportId), low = r.count < +sp.minPlayers;
      return `<div class="li"><div class="who"><b>${esc(sp.name)}</b><div class="xs muted">ตัวแทน ${esc(r.repName)} • ${fmt(r.updatedAt)}</div></div>
        ${pill(r.count + '/' + sp.maxPlayers + ' คน', low ? 'warning' : 'muted')} ${stPill(r.status)}
        <a class="btn sm" href="#/manage/${r.id}">เปิด</a></div>`;
    }).join('') || '<div class="empty">ยังไม่มีทีมที่ส่งรายชื่อ</div>'}</div>`;
  }

  function logList(log) {
    return `<div class="list">${log.map((l) => `<div class="li log-item"><div class="who"><b>${esc(l.action)}</b> — ${esc(l.detail)}
      <div class="xs muted">${fmt(l.time)} • ${esc(l.actor)} (${esc(l.via)})${l.teamId ? ' • สี' + esc(teamOf(l.teamId).name) : ''}</div></div></div>`).join('') || '<div class="empty">ยังไม่มีประวัติ</div>'}</div>`;
  }

  ACT.decide = (el) => busy(el, async () => {
    await call('decideSub', { requestId: el.dataset.id, approve: el.dataset.v === '1' });
    toast(el.dataset.v === '1' ? 'อนุมัติแล้ว — รายชื่อทีมอัปเดตแล้ว' : 'ไม่อนุมัติคำขอ');
    await reload();
  });

  ACT['reg-status'] = (el) => busy(el, async () => {
    await call('setRegStatus', { registrationId: el.dataset.id, approve: el.dataset.v === '1' });
    toast(el.dataset.v === '1' ? 'อนุมัติรายชื่อแล้ว' : 'ไม่อนุมัติรายชื่อ');
    closeModal();
    await reload();
  });

  ACT['reset-code'] = (el) => {
    const id = el.dataset.id;
    confirmBox('ออกรหัสแก้ไขทีมใหม่?', 'รหัสเดิมจะใช้ไม่ได้ทันที ส่งรหัสใหม่ให้ตัวแทนทีมทางช่องทางส่วนตัว', 'ออกรหัสใหม่', async () => {
      const r = await call('resetCode', { registrationId: id });
      const link = BASE + '#/t/' + Core.normalizeCode(r.code);
      modal(`<h2>รหัสใหม่</h2><div class="code-big center">${esc(r.code)}</div><p class="xs muted" style="word-break:break-all">${esc(link)}</p>
        <div class="row"><button class="btn grow" data-act="copy" data-v="${esc(r.code)}">คัดลอกรหัส</button><button class="btn grow" data-act="copy" data-v="${esc(link)}">คัดลอกลิงก์</button></div>
        <button class="btn primary" data-act="modal-close">เสร็จ</button>`);
    });
  };

  // ========== กรรมการ: บันทึกผล ==========

  function readyMatches() {
    return S.boot.matches.filter((m) => m.status === 'ready').sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
  }

  function refListHtml() {
    const ready = readyMatches();
    const done = S.boot.matches.filter((m) => m.status === 'done');
    const ranking = S.boot.sports.filter((s) => s.format === 'จัดอันดับ');
    const item = (m) => `<a class="li" href="#/score/${m.id}" style="color:inherit"><div class="who"><div class="xs muted">${esc(sportOf(m.sportId).name)} • ${esc(roundLabel(m))}${m.time ? ' • ' + esc(m.time) : ''}${m.venue ? ' • ' + esc(m.venue) : ''}</div>
      <div class="row" style="gap:6px;margin-top:4px">${chip(m.teamA)}<span class="xs muted">${m.status === 'done' ? esc(m.scoreA + '–' + m.scoreB) : 'vs'}</span>${chip(m.teamB)}</div></div>${m.status === 'done' ? pill('แก้ผล') : pill('บันทึกผล', 'primary')}</a>`;
    return `<b>นัดที่พร้อมแข่ง (${ready.length})</b><div class="list">${ready.map(item).join('') || '<div class="empty">ไม่มีนัดที่รอบันทึกผล</div>'}</div>
      ${ranking.length ? `<b>กีฬาแบบจัดอันดับ</b><div class="list">${ranking.map((s) => `<a class="li" href="#/rank/${s.id}" style="color:inherit"><div class="who"><b>${esc(s.name)}</b></div>${placesOf(s.id).any ? pill('บันทึกแล้ว', 'success') : pill('บันทึกอันดับ', 'primary')}</a>`).join('')}</div>` : ''}
      ${done.length ? `<details><summary class="small muted">แข่งจบแล้ว ${done.length} นัด (แตะเพื่อแก้ผล)</summary><div class="list" style="margin-top:8px">${done.map(item).join('')}</div></details>` : ''}`;
  }

  PAGES.ref = {
    roles: ['referee'],
    load: refreshBoot,
    view() { return mobileShell('บันทึกผลการแข่งขัน', refListHtml(), { back: '', right: `<a class="icon-btn" href="#/help" title="วิธีใช้งาน">${ic('info')}</a><button class="icon-btn" data-act="reload">${ic('refresh')}</button>` }); }
  };

  PAGES.score = {
    roles: ['referee', 'admin'],
    async load(parts) {
      await refreshBoot();
      const m = S.boot.matches.find((x) => x.id === parts[1]);
      if (!m) throw new Error('ไม่พบนัดแข่งนี้');
      S.view.score = { id: m.id, a: m.scoreA === '' ? 0 : +m.scoreA, b: m.scoreB === '' ? 0 : +m.scoreB, win: m.status === 'done' && m.scoreA === m.scoreB ? (m.winner === m.teamA ? 'A' : 'B') : '', note: m.note || '' };
    },
    view() {
      const v = S.view.score, m = S.boot.matches.find((x) => x.id === v.id), sp = sportOf(m.sportId);
      const winSlot = v.a > v.b ? 'A' : v.b > v.a ? 'B' : v.win;
      const side = (slot) => {
        const t = teamOf(slot === 'A' ? m.teamA : m.teamB), val = slot === 'A' ? v.a : v.b, k = slot === 'A' ? 'a' : 'b';
        return `<div class="score-side ${winSlot === slot ? 'win' : ''}"><div class="dot" style="background:${esc(t.color)}"></div><b>สี${esc(t.name)}</b>
          <div class="score-num">${val}</div><div class="row"><button class="step-btn" data-act="score-step" data-k="${k}" data-d="-1" aria-label="ลด">−</button><button class="step-btn" data-act="score-step" data-k="${k}" data-d="1" aria-label="เพิ่ม">+</button></div></div>`;
      };
      let outcome = '';
      if (winSlot) {
        const w = winSlot === 'A' ? m.teamA : m.teamB, l = winSlot === 'A' ? m.teamB : m.teamA;
        const next = S.boot.matches.find((x) => x.id === m.nextMatchId), lnext = S.boot.matches.find((x) => x.id === m.loserNextMatchId);
        const opp = (n, slot) => { const o = slot === 'A' ? n.teamB : n.teamA; return o && o !== Core.BYE ? 'กับสี' + teamOf(o).name : ''; };
        outcome = note('success', 'check', `<b>ผู้ชนะ: สี${esc(teamOf(w).name)}</b> → ${next ? esc(roundLabel(next) + ' ' + opp(next, m.nextSlot)) : 'แชมป์รายการนี้'}<br>
          สี${esc(teamOf(l).name)} → ${lnext ? esc('ชิงอันดับ 3 ' + opp(lnext, m.loserNextSlot)) : (next ? 'ตกรอบ' : 'รองชนะเลิศ')}`);
      }
      const tie = v.a === v.b;
      return mobileShell('บันทึกผล', `
        <div class="card"><div class="xs muted">${esc(sp.name)}</div><b class="lg">${esc(roundLabel(m))}</b><div class="small muted">${esc([m.time, m.venue].filter(Boolean).join(' • ') || 'ยังไม่ได้กำหนดเวลา/สนาม')}</div></div>
        <div class="card score-grid">${side('A')}<b class="muted" style="font-size:28px">:</b>${side('B')}</div>
        ${tie ? `<div class="card stack"><b>เสมอ — ตัดสินผู้ชนะด้วยจุดโทษ/ต่อเวลา</b><div class="row">${['A', 'B'].map((s) => `<button class="btn grow ${v.win === s ? 'primary' : ''}" data-act="score-win" data-v="${s}">สี${esc(teamOf(s === 'A' ? m.teamA : m.teamB).name)} ชนะ</button>`).join('')}</div></div>` : ''}
        ${outcome}
        <label class="field"><span>หมายเหตุ</span><input data-input="score-note" value="${esc(v.note)}" placeholder="เช่น ชนะจุดโทษ 4–3, ใบแดง"></label>
        <button class="btn primary block" data-act="score-save" ${winSlot ? '' : 'disabled'}>${m.status === 'done' ? 'แก้ผลการแข่งขัน' : 'ยืนยันผลการแข่งขัน'}</button>
        <p class="xs muted center">ผลจะบันทึกลงชีต Matches และอัปเดตสายทันที</p>`, { back: ROLE === 'admin' ? 'scores' : 'ref' });
    }
  };
  ACT['score-step'] = (el) => { const v = S.view.score; v[el.dataset.k] = Math.max(0, v[el.dataset.k] + +el.dataset.d); if (v.a !== v.b) v.win = ''; paint(); };
  ACT['score-win'] = (el) => { S.view.score.win = el.dataset.v; paint(); };
  INPUT['score-note'] = (el) => { S.view.score.note = el.value; };
  ACT['score-save'] = (el) => busy(el, async () => {
    const v = S.view.score;
    const res = await call('recordResult', { matchId: v.id, scoreA: v.a, scoreB: v.b, winnerSlot: v.a === v.b ? v.win : '', note: v.note });
    toast(res.places ? 'บันทึกผลแล้ว — รายการนี้แข่งจบ สรุปอันดับให้แล้ว' : 'บันทึกผลแล้ว — อัปเดตสายแล้ว');
    location.hash = ROLE === 'admin' ? '#/scores' : '#/ref';
  });

  PAGES.rank = {
    roles: ['referee', 'admin'],
    async load(parts) {
      const athletes = await call('sportAthletes', { sportId: parts[1] });
      const picks = {};
      S.boot.results.filter((r) => r.sportId === parts[1] && r.athleteId).forEach((r) => { picks[r.place] = r.athleteId; });
      S.view.rank = { sportId: parts[1], athletes, picks };
    },
    view() {
      const R = S.view.rank, sp = sportOf(R.sportId);
      const sel = (place, label) => `<label class="field"><span>${label}</span><select data-change="rank-pick" data-place="${place}"><option value="">— ไม่มี —</option>
        ${R.athletes.map((a) => `<option value="${a.id}" ${R.picks[place] === a.id ? 'selected' : ''}>${esc(a.fullName)} (สี${esc(teamOf(a.teamId).name)})</option>`).join('')}</select></label>`;
      return mobileShell(sp.name, `<div class="card stack">${sel('1', 'ชนะเลิศ')}${sel('2', 'รองชนะเลิศอันดับ 1')}${sel('3', 'รองชนะเลิศอันดับ 2')}</div>
        ${note('primary', 'info', 'สีที่ส่งนักกีฬาแต่ไม่ได้อันดับ 1–3 จะได้ชมเชยอัตโนมัติ')}
        <button class="btn primary block" data-act="rank-save">บันทึกอันดับ</button>`, { back: ROLE === 'admin' ? 'certs' : 'ref' });
    }
  };
  CHANGE['rank-pick'] = (el) => { S.view.rank.picks[el.dataset.place] = el.value; };
  ACT['rank-save'] = (el) => busy(el, async () => {
    const R = S.view.rank;
    await call('setRankingResults', { sportId: R.sportId, entries: ['1', '2', '3'].map((p) => ({ place: p, athleteId: R.picks[p] || '' })) });
    toast('บันทึกอันดับแล้ว');
    await refreshBoot();
    location.hash = ROLE === 'admin' ? '#/certs' : '#/ref';
  });

  // ========== แอดมิน ==========

  async function loadAdmin() {
    const [boot, admin] = await Promise.all([call('bootstrap'), call('adminData')]);
    S.boot = boot;
    S.admin = admin;
  }
  const setting = (k) => (S.admin.settings.find((s) => s.id === k) || {}).value || '';

  PAGES.admin = {
    roles: ['admin'],
    load: loadAdmin,
    view() {
      const B = S.boot, A = S.admin;
      const real = B.matches.filter((m) => m.status !== 'bye');
      const pendRegs = B.registrations.filter((r) => r.status === 'รออนุมัติ').length;
      const stat = (label, val, hint, kind) => `<div class="stat"><span class="small muted">${label}</span><b>${val}</b><span class="xs" style="color:var(--${kind || 'success'})">${hint}</span></div>`;
      const ready = readyMatches().slice(0, 6);
      return adminShell('admin', 'ภาพรวมการแข่งขัน', `${esc(B.event.school)} • ${B.teams.length} สี • ${B.sports.length} รายการ`, `<a class="btn" href="#/settings">ลิงก์ & QR</a>`, `
        <div class="stats">${stat('นักกีฬาที่ลงทะเบียน', A.athleteCount, `จากนักเรียน ${A.studentCount} คน`)}
          ${stat('ทีมที่ส่งรายชื่อ', B.registrations.length, pendRegs ? `รออนุมัติ ${pendRegs} ทีม` : 'อนุมัติครบแล้ว', pendRegs ? 'warning' : 'success')}
          ${stat('เปลี่ยนตัวแล้ว', A.requests.filter((q) => q.status === 'มีผลแล้ว').length, 'ดูได้ในหน้าลงทะเบียน & เปลี่ยนตัว')}
          ${stat('แข่งจบแล้ว', real.filter((m) => m.status === 'done').length + ' / ' + real.length, `พร้อมแข่ง ${readyMatches().length} นัด`)}</div>
        <div class="cols">${medalTableHtml()}
          <div class="card flush"><div class="card-head"><h2>นัดที่พร้อมแข่ง</h2><a class="small" href="#/scores">ดูทั้งหมด →</a></div>
            <div class="list" style="border:0;border-radius:0;border-top:1px solid var(--border)">${ready.map((m) => `<a class="li" href="#/score/${m.id}" style="color:inherit"><b style="color:var(--primary);min-width:44px">${esc(m.time || '--:--')}</b><div class="who"><div class="xs muted">${esc(sportOf(m.sportId).name)} • ${esc(roundLabel(m))}</div><div class="row" style="gap:6px;margin-top:4px">${chip(m.teamA)}<span class="xs muted">vs</span>${chip(m.teamB)}</div></div></a>`).join('') || '<div class="empty">ยังไม่มีนัดที่พร้อมแข่ง — ไปที่ "สายการแข่งขัน" เพื่อจับสลาก</div>'}</div></div></div>
        <div class="card flush"><div class="card-head"><h2>ความเคลื่อนไหวล่าสุด</h2><a class="small" href="#/regs">ดูประวัติทั้งหมด →</a></div><div style="padding:0 0 4px">${logList(A.log.slice(0, 8))}</div></div>`);
    }
  };

  PAGES.regs = {
    roles: ['admin'],
    load: loadAdmin,
    view() {
      const B = S.boot, A = S.admin;
      const cell = (sp, t) => {
        const r = B.registrations.find((x) => x.sportId === sp.id && x.teamId === t.id);
        if (!r) return '<span class="xs muted">—</span>';
        const cls = r.status === 'อนุมัติ' ? 'ok' : r.status === 'ไม่อนุมัติ' ? 'no' : 'wait';
        return `<button class="cellbtn ${cls}" data-act="reg-cell" data-id="${r.id}">${r.count}/${sp.maxPlayers}</button>`;
      };
      return adminShell('regs', 'ลงทะเบียน & เปลี่ยนตัว', 'กดตัวเลขในตารางเพื่อดูรายชื่อ อนุมัติ แก้ไข หรือออกรหัสทีมใหม่', `<button class="btn" data-act="export-athletes">ดาวน์โหลดรายชื่อ (CSV)</button>`, `
        <div class="card flush"><div class="tbl-wrap"><table class="tbl matrix"><tr><th>กีฬา</th>${B.teams.map((t) => `<th>${chip(t.id)}</th>`).join('')}</tr>
          ${B.sports.map((sp) => `<tr><td><b>${esc(sp.name)}</b><div class="xs muted">${sp.minPlayers}–${sp.maxPlayers} คน${sp.status === 'ปิดรับ' ? ' • ปิดรับ' : ''}</div></td>${B.teams.map((t) => `<td>${cell(sp, t)}</td>`).join('')}</tr>`).join('')}
        </table></div><p class="xs muted" style="padding:12px 20px"><span class="pill success">อนุมัติ</span> <span class="pill warning">รออนุมัติ</span> <span class="pill danger">ไม่อนุมัติ</span> — ตัวเลข = จำนวนคน/สูงสุด</p></div>
        <div class="cols"><div class="stack"><h2 style="font-size:18px">การเปลี่ยนตัวล่าสุด (${A.requests.length})</h2>${subCards(A.requests)}</div>
          <div class="card flush"><div class="card-head"><h2>ประวัติการแก้ไข</h2>${pill('แก้/ลบไม่ได้')}</div><div style="max-height:560px;overflow:auto">${logList(A.log)}</div></div></div>`);
    }
  };

  ACT['reg-cell'] = (el) => busy(el, async () => {
    const t = await call('publicTeam', { registrationId: el.dataset.id });
    const r = t.registration, sp = sportOf(r.sportId);
    modal(`<h2>${esc(sp.name)}</h2><div class="row">${chip(r.teamId)} ${stPill(r.status)} ${pill(t.athletes.length + '/' + sp.maxPlayers + ' คน')}</div>
      <p class="small muted">ตัวแทนทีม: ${esc(r.repName)} • แก้ล่าสุด ${fmt(r.updatedAt)}</p>
      <div class="list">${t.athletes.map((a) => `<div class="li"><div class="who">${esc(a.fullName)}<div class="xs muted">${esc(a.classRoom)}</div></div>${pill(a.role)}</div>`).join('')}</div>
      <div class="row wrap">${r.status !== 'อนุมัติ' ? `<button class="btn success" data-act="reg-status" data-id="${r.id}" data-v="1">อนุมัติ</button>` : ''}
        ${r.status !== 'ไม่อนุมัติ' ? `<button class="btn danger" data-act="reg-status" data-id="${r.id}" data-v="0">ไม่อนุมัติ</button>` : ''}
        <a class="btn" href="#/manage/${r.id}">แก้รายชื่อ / เปลี่ยนตัว</a><button class="btn" data-act="reset-code" data-id="${r.id}">ออกรหัสใหม่</button></div>`);
  });

  ACT['export-athletes'] = (el) => busy(el, async () => {
    const rows = [['กีฬา', 'สี', 'สถานะทีม', 'ชื่อ-นามสกุล', 'ชั้น', 'ประเภท']];
    for (const r of S.boot.registrations) {
      const t = await call('publicTeam', { registrationId: r.id });
      t.athletes.forEach((a) => rows.push([sportOf(r.sportId).name, 'สี' + teamOf(r.teamId).name, r.status, a.fullName, a.classRoom, a.role]));
    }
    downloadCsv('รายชื่อนักกีฬา.csv', rows);
  });

  PAGES.bracket = {
    roles: ['admin'],
    load: refreshBoot,
    view(parts) {
      const list = S.boot.sports.filter((s) => s.format !== 'จัดอันดับ');
      const sp = sportOf(parts[1]) || list[0];
      if (!sp) return adminShell('bracket', 'สายการแข่งขัน', 'ยังไม่มีกีฬาแบบแพ้คัดออก', '', '');
      const ms = S.boot.matches.filter((m) => m.sportId === sp.id);
      const regs = S.boot.registrations.filter((r) => r.sportId === sp.id);
      const ok = regs.filter((r) => r.status === 'อนุมัติ').length, wait = regs.filter((r) => r.status === 'รออนุมัติ').length;
      const size = ok >= 2 ? Core.nextPow2(ok) : 0;
      return adminShell('bracket', 'สายการแข่งขัน', 'แพ้คัดออก + ชิงอันดับ 3 • ทีมไม่ครบ 2, 4, 8 ระบบเติม BYE ให้อัตโนมัติ',
        `${sportSelect(list, sp.id, 'adm-sport')}<button class="btn primary" data-act="draw" data-id="${sp.id}">${ms.length ? 'จับสลากใหม่' : 'จับสลากจัดสาย'}</button>`, `
        <div class="row wrap">${pill(`อนุมัติแล้ว ${ok} ทีม${size ? ` → สาย ${size} ช่อง` : ''}`, 'primary')} ${size && size > ok ? pill(`BYE ${size - ok} ช่อง (ผ่านรอบแรกอัตโนมัติ)`, 'warning') : ''} ${wait ? pill(`รออนุมัติ ${wait} ทีม`, 'warning') : ''}</div>
        <div class="card">${bracketHtml(ms, true)}</div>
        ${ms.length ? note('primary', 'info', 'กดที่การ์ดนัดแข่งเพื่อกำหนดเวลา/สนาม หรือบันทึกผล • ผู้ชนะเลื่อนเข้าคู่ถัดไปทันที • ผู้แพ้รอบรองฯ ไปชิงที่ 3') : ''}
        ${sportResultsHtml(sp)}`);
    }
  };
  CHANGE['adm-sport'] = (el) => { location.hash = '#/bracket/' + el.value; };

  ACT.draw = (el) => {
    const sp = sportOf(el.dataset.id);
    const regs = S.boot.registrations.filter((r) => r.sportId === sp.id);
    const hasResults = S.boot.matches.some((m) => m.sportId === sp.id && m.status === 'done');
    const wait = regs.filter((r) => r.status === 'รออนุมัติ').length;
    S.view.draw = { includePending: false };
    confirmBox('จับสลากจัดสาย: ' + sp.name, `<div class="stack"><p>ระบบจะสุ่มลำดับทีมที่อนุมัติแล้ว ${regs.filter((r) => r.status === 'อนุมัติ').length} ทีม แล้วเติม BYE ให้ครบ 2, 4, 8 ช่อง</p>
      ${wait ? `<label class="row"><input type="checkbox" data-change="draw-pending"> รวมทีมที่ยังรออนุมัติ (${wait} ทีม)</label>` : ''}
      ${hasResults ? note('danger', 'alert', 'มีผลการแข่งขันบันทึกแล้ว ถ้าจับสลากใหม่ ผลเดิมจะหายทั้งหมด') : ''}</div>`, 'จับสลาก', async () => {
      await call('drawBracket', { sportId: sp.id, includePending: S.view.draw.includePending, force: hasResults });
      toast('จัดสายเรียบร้อย');
      closeModal();
      await reload();
    }, hasResults);
  };
  CHANGE['draw-pending'] = (el) => { S.view.draw.includePending = el.checked; };

  ACT['match-open'] = (el) => {
    const m = S.boot.matches.find((x) => x.id === el.dataset.id);
    const canScore = m.status === 'ready' || m.status === 'done';
    modal(`<h2>${esc(roundLabel(m))}</h2><div class="row">${chip(m.teamA)}<span class="muted">vs</span>${chip(m.teamB)}${m.status === 'done' ? pill(m.scoreA + '–' + m.scoreB, 'success') : ''}</div>
      <div class="form-grid"><label class="field"><span>เวลา</span><input id="m-time" value="${esc(m.time)}" placeholder="เช่น 10 พ.ย. 13:00"></label>
      <label class="field"><span>สนาม</span><input id="m-venue" value="${esc(m.venue || sportOf(m.sportId).venue)}"></label></div>
      <div class="row" style="justify-content:flex-end">${canScore ? `<a class="btn" href="#/score/${m.id}">${m.status === 'done' ? 'แก้ผล' : 'บันทึกผล'}</a>` : `<span class="xs muted grow">รอทีมให้ครบก่อนจึงบันทึกผลได้</span>`}
      <button class="btn primary" data-act="match-save" data-id="${m.id}">บันทึกเวลา/สนาม</button></div>`);
  };
  ACT['match-save'] = (el) => busy(el, async () => {
    await call('setMatchInfo', { matchId: el.dataset.id, time: $('#m-time').value.trim(), venue: $('#m-venue').value.trim() });
    toast('บันทึกแล้ว');
    closeModal();
    await reload();
  });

  PAGES.scores = {
    roles: ['admin'],
    load: refreshBoot,
    view() { return adminShell('scores', 'บันทึกผลการแข่งขัน', 'กรรมการใช้ลิงก์กรรมการบนมือถือได้ (ดูในหน้าตั้งค่า & ลิงก์)', '', `<div class="stack" style="max-width:720px">${refListHtml()}</div>`); }
  };

  PAGES.certs = {
    roles: ['admin'],
    load: loadAdmin,
    view() {
      const B = S.boot, certs = S.admin.certificates;
      const rows = B.sports.map((sp) => {
        const { any, by } = placesOf(sp.id);
        const cellOf = (k) => by[k].map(placeEntry).join(' ') || '<span class="xs muted">—</span>';
        const action = sp.format === 'จัดอันดับ' ? `<a class="btn sm" href="#/rank/${sp.id}">บันทึกอันดับ</a>` : `<a class="btn sm" href="#/bracket/${sp.id}">ดูสาย</a>`;
        return `<tr><td><b>${esc(sp.name)}</b><div class="xs muted">${esc(sp.format)}</div></td><td>${any ? cellOf('1') : pill('ยังไม่จบ')}</td><td>${cellOf('2')}</td><td>${cellOf('3')}</td><td>${cellOf('H')}</td><td>${action}</td></tr>`;
      }).join('');
      const ready = certs.filter((c) => !c.pdfUrl).length;
      return adminShell('certs', 'สรุปผล & เกียรติบัตร', 'อันดับคำนวณจากสายการแข่งขันอัตโนมัติ → สร้างรายชื่อลงชีต Certificates เพื่อทำเกียรติบัตร',
        `<button class="btn" data-act="certs-csv" ${certs.length ? '' : 'disabled'}>ดาวน์โหลด CSV</button><button class="btn primary" data-act="certs-build">สร้าง/อัปเดตรายชื่อเกียรติบัตร</button>`, `
        <div class="card flush"><div class="tbl-wrap"><table class="tbl"><tr><th>รายการ</th><th>ชนะเลิศ</th><th>รองฯ อันดับ 1</th><th>รองฯ อันดับ 2</th><th>ชมเชย</th><th></th></tr>${rows}</table></div></div>
        <div class="cols"><div class="card flush"><div class="card-head"><h2>รายชื่อสำหรับเกียรติบัตร</h2>${pill(`ชีต Certificates • ${certs.length} แถว`, 'success')}</div>
          <div class="tbl-wrap" style="max-height:520px;overflow:auto"><table class="tbl"><tr><th>ชื่อ-นามสกุล</th><th>ชั้น</th><th>สี</th><th>รายการ</th><th>รางวัล</th><th>สถานะ</th></tr>
          ${certs.slice(0, 300).map((c) => `<tr><td>${esc(c.studentName)}</td><td>${esc(c.classRoom)}</td><td>${esc(c.teamName)}</td><td class="small">${esc(c.sportName)}</td><td>${esc(c.award)}</td>
            <td>${c.pdfUrl ? `<a href="${esc(c.pdfUrl)}" target="_blank" rel="noopener">${pill('PDF', 'primary')}</a>` : pill(c.status, 'success')}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">กด "สร้าง/อัปเดตรายชื่อเกียรติบัตร" หลังแข่งจบ</td></tr>'}</table></div></div>
          <div class="card stack"><h2>สร้าง PDF ด้วย Google Slides</h2>
            <p class="small">1. ทำเกียรติบัตร 1 หน้าใน Google Slides ใส่ข้อความตามช่องด้านล่าง<br>2. คัดลอกไอดีไฟล์ (ส่วนระหว่าง <code>/d/</code> กับ <code>/edit</code>) ไปใส่ในหน้าตั้งค่า<br>3. กดปุ่มด้านล่าง ระบบสร้าง PDF รายคนเก็บใน Google Drive</p>
            <div class="chips">${['{{ชื่อ-นามสกุล}}', '{{รางวัล}}', '{{รายการ}}', '{{สี}}', '{{ชั้น}}', '{{ปีการศึกษา}}', '{{โรงเรียน}}', '{{งาน}}'].map((x) => `<span class="pill muted">${x}</span>`).join('')}</div>
            ${Client.demo ? note('warning', 'alert', 'โหมดทดลองสร้าง PDF ไม่ได้ ต้องเชื่อม Google Sheet ก่อน (ใช้ CSV ทำ Mail merge แทนได้)') : ''}
            <button class="btn primary" data-act="certs-pdf" ${ready && !Client.demo ? '' : 'disabled'}>สร้าง PDF (${ready} ใบที่ยังไม่มี)</button></div></div>`);
    }
  };
  ACT['certs-build'] = (el) => busy(el, async () => {
    const r = await call('buildCertificates', {});
    toast(`สร้างรายชื่อเกียรติบัตร ${r.count} ใบแล้ว`);
    await reload();
  });
  ACT['certs-csv'] = () => {
    downloadCsv('เกียรติบัตร.csv', [['ชื่อ-นามสกุล', 'ชั้น', 'สี', 'รายการ', 'รางวัล', 'ปีการศึกษา', 'ลิงก์ PDF']]
      .concat(S.admin.certificates.map((c) => [c.studentName, c.classRoom, c.teamName, c.sportName, c.award, S.boot.event.year, c.pdfUrl])));
  };
  ACT['certs-pdf'] = (el) => busy(el, async () => {
    let total = 0, r;
    do {
      r = await call('makePdfs', {});
      total += r.done;
      toast(`สร้างแล้ว ${total} ใบ เหลือ ${r.remaining}`);
    } while (r.remaining > 0 && r.done > 0);
    await reload();
  });

  // ---------- ตั้งค่า & ลิงก์ ----------

  // ค่าในชีตเป็นเวลาไทย +07:00 ส่วนช่อง datetime-local ไม่มีโซนเวลา
  function toLocalInput(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return new Date(d.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 16);
  }

  PAGES.settings = {
    roles: ['admin'],
    async load() {
      await loadAdmin();
      // จำลิงก์หน้าเว็บไว้ในชีต ให้เมนู "ดูลิงก์ทั้งหมด" ใน Google Sheet แสดงลิงก์จริง
      const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
      if (!Client.demo && !local && setting('siteUrl') !== BASE) {
        await call('saveSettings', { values: { siteUrl: BASE } });
        S.admin = await call('adminData');
      }
    },
    view() {
      const B = S.boot, A = S.admin;
      const f = (k, label, type = 'text', hint = '') => `<label class="field"><span>${label}</span><input type="${type}" data-setting="${k}" value="${esc(k === 'regDeadline' ? toLocalInput(setting(k)) : setting(k))}">${hint ? `<small>${hint}</small>` : ''}</label>`;
      const link = (label, url) => `<div class="link-row"><span style="min-width:150px" class="small"><b>${label}</b></span><code>${esc(url)}</code><button class="btn sm" data-act="copy" data-v="${esc(url)}">${ic('copy', 'sm')} คัดลอก</button></div>`;
      return adminShell('settings', 'ตั้งค่า & ลิงก์', 'ข้อมูลห้อง/นักเรียน/สี แก้ในแท็บ Classes, Students, Teams ของ Google Sheet ได้โดยตรง', `<a class="btn primary" href="#/poster">${ic('print', 'sm')} โปสเตอร์ QR</a>`, `
        <div class="card stack"><h2>ลิงก์สำหรับแต่ละบทบาท (ไม่ต้องล็อกอิน — ใครมีลิงก์ก็ใช้สิทธิ์นั้นได้ ส่งเป็นการส่วนตัว)</h2><div>
          ${link('นักเรียน (ทำ QR)', BASE)}
          ${A.teams.map((t) => link('ประธานสี' + t.name + (t.captainName ? ' (' + t.captainName + ')' : ''), BASE + '?captain=' + t.captainKey)).join('')}
          ${link('กรรมการบันทึกผล', BASE + '?ref=' + setting('refereeKey'))}
          ${link('แอดมิน', BASE + '?admin=' + setting('adminKey'))}</div>
          <p class="xs muted">ถ้าลิงก์หลุด: แก้รหัสในชีต Settings (adminKey, refereeKey) หรือ Teams (captainKey) ลิงก์เดิมจะใช้ไม่ได้ทันที</p></div>
        <div class="card stack"><h2>ข้อมูลงาน</h2><div class="form-grid">
          ${f('eventName', 'ชื่องาน')}${f('schoolName', 'ชื่อโรงเรียน')}${f('academicYear', 'ปีการศึกษา')}
          ${f('regDeadline', 'ปิดรับสมัคร (เวลาไทย)', 'datetime-local', 'หลังเวลานี้เพิ่ม/ลบรายชื่อไม่ได้ แต่ยังเปลี่ยนตัวได้')}
          ${f('pointsGold', 'คะแนนทอง', 'number')}${f('pointsSilver', 'คะแนนเงิน', 'number')}${f('pointsBronze', 'คะแนนทองแดง', 'number')}${f('pointsHonor', 'คะแนนชมเชย', 'number')}
          ${f('certTemplateId', 'ไอดี Google Slides แม่แบบเกียรติบัตร')}${f('certFolderId', 'ไอดีโฟลเดอร์เก็บ PDF', 'text', 'เว้นว่าง = สร้างให้อัตโนมัติ')}</div>
          <div><button class="btn primary" data-act="settings-save">บันทึกการตั้งค่า</button></div></div>
        <div class="card flush"><div class="card-head"><h2>รายการกีฬา</h2><button class="btn primary sm" data-act="sport-edit">+ เพิ่มกีฬา</button></div><div class="tbl-wrap"><table class="tbl">
          <tr><th>ลำดับ</th><th>ชื่อ</th><th>ประเภท</th><th>รูปแบบ</th><th>เพศ/รุ่น</th><th>จำนวนคน</th><th>สถานะ</th><th></th></tr>
          ${B.sports.map((s) => `<tr><td>${esc(s.order)}</td><td><b>${esc(s.name)}</b><div class="xs muted">${esc(s.venue)}</div></td><td>${esc(s.type)}</td><td>${esc(s.format)}</td><td>${esc(s.gender)} • ${esc(s.level)}</td><td>${s.minPlayers}–${s.maxPlayers}</td>
            <td>${pill(s.status, s.status === 'เปิดรับ' ? 'success' : 'muted')}</td><td><button class="btn sm" data-act="sport-edit" data-id="${s.id}">แก้ไข</button></td></tr>`).join('')}
        </table></div></div>
        ${Client.demo ? `<div class="card stack"><h2>โหมดทดลอง</h2><p class="small muted">ตอนนี้ยังไม่ได้ใส่ URL ของ Apps Script ใน config.js ข้อมูลจึงเก็บในเบราว์เซอร์นี้เท่านั้น</p><div><button class="btn danger" data-act="demo-reset">ล้างข้อมูลทดลองทั้งหมด</button></div></div>` : ''}`);
    }
  };

  ACT['settings-save'] = (el) => busy(el, async () => {
    const values = {};
    document.querySelectorAll('[data-setting]').forEach((i) => {
      values[i.dataset.setting] = i.dataset.setting === 'regDeadline' && i.value ? i.value + ':00+07:00' : i.value.trim();
    });
    await call('saveSettings', { values });
    toast('บันทึกการตั้งค่าแล้ว');
    await reload();
  });

  ACT['sport-edit'] = (el) => {
    const s = (el.dataset.id && sportOf(el.dataset.id)) || { name: '', type: 'ทีม', format: 'แพ้คัดออก', gender: 'ชาย', level: 'ม.ต้น', minPlayers: 5, maxPlayers: 10, venue: '', status: 'เปิดรับ', order: S.boot.sports.length + 1 };
    const opt = (k, list) => `<select id="sp-${k}">${list.map((v) => `<option ${v === s[k] ? 'selected' : ''}>${v}</option>`).join('')}</select>`;
    const inp = (k, type = 'text') => `<input id="sp-${k}" type="${type}" value="${esc(s[k])}">`;
    modal(`<h2>${s.id ? 'แก้ไขกีฬา' : 'เพิ่มกีฬา'}</h2><div class="form-grid">
      <label class="field" style="grid-column:1/-1"><span>ชื่อกีฬา</span>${inp('name')}</label>
      <label class="field"><span>ประเภท</span>${opt('type', ['ทีม', 'บุคคล'])}</label>
      <label class="field"><span>รูปแบบการแข่ง</span>${opt('format', ['แพ้คัดออก', 'จัดอันดับ'])}</label>
      <label class="field"><span>เพศ</span>${opt('gender', ['ชาย', 'หญิง', 'ผสม'])}</label>
      <label class="field"><span>รุ่น</span>${opt('level', ['ม.ต้น', 'ม.ปลาย', 'ทั้งหมด'])}</label>
      <label class="field"><span>ขั้นต่ำ (คน)</span>${inp('minPlayers', 'number')}</label>
      <label class="field"><span>สูงสุด (คน)</span>${inp('maxPlayers', 'number')}</label>
      <label class="field"><span>สนาม</span>${inp('venue')}</label>
      <label class="field"><span>ลำดับแสดง</span>${inp('order', 'number')}</label>
      <label class="field"><span>รับสมัคร</span>${opt('status', ['เปิดรับ', 'ปิดรับ'])}</label></div>
      <p class="xs muted">แพ้คัดออก = จับสลากจัดสาย • จัดอันดับ = กรอกที่ 1–3 เอง (เช่น วิ่ง)</p>
      <div class="row">${s.id ? `<button class="btn danger" data-act="sport-del" data-id="${s.id}">ลบ</button>` : ''}<span class="grow"></span><button class="btn" data-act="modal-close">ยกเลิก</button><button class="btn primary" data-act="sport-save" data-id="${s.id || ''}">บันทึก</button></div>`);
  };
  ACT['sport-save'] = (el) => busy(el, async () => {
    const sport = { id: el.dataset.id };
    ['name', 'type', 'format', 'gender', 'level', 'minPlayers', 'maxPlayers', 'venue', 'order', 'status'].forEach((k) => { sport[k] = $('#sp-' + k).value; });
    await call('saveSport', { sport });
    toast('บันทึกกีฬาแล้ว');
    closeModal();
    await reload();
  });
  ACT['sport-del'] = (el) => busy(el, async () => {
    await call('deleteSport', { sportId: el.dataset.id });
    toast('ลบกีฬาแล้ว');
    closeModal();
    await reload();
  });

  PAGES.poster = {
    roles: ['admin'],
    view() {
      const ev = S.boot.event;
      return `<div class="no-print" style="max-width:560px;margin:16px auto 0;padding:0 16px;display:flex;gap:10px"><a class="btn" href="#/settings">${ic('back', 'sm')} กลับ</a><button class="btn primary" data-act="print">${ic('print', 'sm')} พิมพ์</button></div>
        <div class="poster"><div class="logo" style="background:#fff;color:var(--primary)">${ic('trophy', 'lg')}</div>
          <div>${esc(ev.name)} ปีการศึกษา ${esc(ev.year)}</div><h1>สแกนเพื่อสมัครแข่งกีฬา</h1>
          <div class="qr">${qrSvg(BASE, 7)}</div>
          <div>1. สแกน  2. เลือกห้องและชื่อ  3. เลือกกีฬา  4. กรอกสมาชิก</div>
          <div class="dl">ปิดรับสมัคร ${fmt(ev.deadline)}</div><div class="xs" style="opacity:.8">${esc(ev.school)}</div></div>${demoTag()}`;
    }
  };
  ACT.print = () => window.print();

  // ---------- วิธีใช้งาน ----------

  const HELP = [
    ['student', 'นักเรียน', [
      'สแกน QR บนโปสเตอร์ หรือเปิดเว็บ แล้วกด <b>สมัครแข่งกีฬา</b>',
      'เลือก <b>ชั้น/ห้อง</b> และ <b>ชื่อของตัวเอง</b> ระบบเลือกสีให้ตามห้องอัตโนมัติ',
      'เลือกกีฬา: <b>สร้างทีม</b> (สีเรายังไม่มีคนส่ง คุณจะเป็นตัวแทนทีม) · <b>ดูทีม</b> (มีคนส่งแล้ว ติดต่อตัวแทนทีม) · <b>สมัครตัวเอง</b> (กีฬาบุคคล)',
      'พิมพ์ชื่อหรือห้องเพื่อค้นเพื่อนสีเดียวกัน → <b>+ เพิ่ม</b> เลือก จริง/สำรอง → <b>ส่งรายชื่อ</b>',
      'แคปหน้าจอ <b>รหัสแก้ไขทีม 6 ตัว</b> เก็บไว้ ห้ามโพสต์ในกลุ่มรวม'
    ], 'ดูสายการแข่งขันและตารางเหรียญได้จากหน้าแรกตลอดงาน'],
    ['rep', 'ตัวแทนทีม', [
      'หน้าแรก → <b>มีรหัสแก้ไขทีม</b> → กรอกรหัส (หรือเปิดลิงก์แก้ไขที่ได้ตอนส่ง)',
      'ก่อนปิดรับสมัคร: <b>แก้ไขรายชื่อ</b> เพิ่ม/ลบ/สลับจริง-สำรองได้',
      '<b>เปลี่ยนตัว</b> ได้ทุกเวลา: เลือกคนออก → ค้นคนเข้า → มีผลตั้งแต่นัดไหน → เหตุผล → <b>เปลี่ยนตัว (มีผลทันที)</b>',
      'ทุกครั้งที่แก้ ระบบบันทึกชื่อผู้ทำและเวลาให้ประธานสีเห็น ถ้าเปลี่ยนผิดให้แจ้งประธานสีกดย้อนกลับ'
    ], 'นัดที่แข่งไปแล้วยังเก็บชื่อเดิม คนที่ได้ลงแข่งแล้วยังได้เกียรติบัตร'],
    ['captain', 'ประธานสี', [
      'เปิด <b>ลิงก์ประธานสี</b> ที่ครูส่งให้ แล้วบุ๊กมาร์กไว้ (อย่าส่งต่อ)',
      '<b>การเปลี่ยนตัว</b>: เห็นทุกครั้งที่ตัวแทนทีมเปลี่ยน ถ้าไม่เหมาะสมกด <b>ย้อนกลับ</b>',
      '<b>ทีมทั้งหมด</b>: กด <b>เปิด</b> เพื่อดู อนุมัติ แก้รายชื่อ หรือ <b>ออกรหัสใหม่</b> เมื่อรหัสหาย/หลุด',
      '<b>ยังไม่ส่ง</b>: กีฬาที่สีเรายังไม่มีทีม ตามเพื่อนให้สแกน QR',
      '<b>ประวัติ</b>: ใครทำอะไร ผ่านรหัสหรือลิงก์ไหน เมื่อไร'
    ], 'ประธานสีจัดการได้เฉพาะสีของตัวเอง'],
    ['ref', 'กรรมการ', [
      'เปิด <b>ลิงก์กรรมการ</b> บนมือถือ แล้วแตะนัดที่พร้อมแข่ง',
      'กด <b>+ / −</b> ใส่สกอร์ ถ้าเสมอให้เลือกสีที่ชนะ (จุดโทษ/ต่อเวลา)',
      'ดูว่าผู้ชนะไปเจอใครต่อ แล้วกด <b>ยืนยันผลการแข่งขัน</b>',
      'กีฬาจัดอันดับ (เช่น วิ่ง): <b>บันทึกอันดับ</b> เลือกที่ 1–3'
    ], 'บันทึกผิดแก้ได้ ถ้านัดถัดไปยังไม่ได้แข่ง'],
    ['admin', 'แอดมิน (ครู)', [
      'ใน Google Sheet ใส่ห้อง (<b>Classes</b>) นักเรียน (<b>Students</b>) และชื่อประธานสี (<b>Teams</b> คอลัมน์ captainName)',
      '<b>ตั้งค่า & ลิงก์</b>: ตั้งวันปิดรับสมัคร แก้รายการกีฬา ส่งลิงก์ประธานสี/กรรมการ พิมพ์ <b>โปสเตอร์ QR</b>',
      'หลังปิดรับสมัคร: <b>ลงทะเบียน</b> ตรวจ/อนุมัติ → <b>สายการแข่งขัน</b> จับสลาก แล้วกดการ์ดนัดใส่เวลา/สนาม',
      'วันแข่ง: กรรมการบันทึกผล หรือแอดมินบันทึกที่ <b>บันทึกผล</b>',
      'หลังแข่ง: <b>สรุปผล & เกียรติบัตร</b> → สร้างรายชื่อ → ดาวน์โหลด CSV หรือสร้าง PDF จาก Google Slides'
    ], 'ลิงก์แอดมินคือรหัส adminKey ในแท็บ Settings ถ้าหลุดให้เปลี่ยนค่าในชีต']
  ];
  const HELP_DEFAULT = { public: 'student', captain: 'captain', referee: 'ref', admin: 'admin' }[ROLE];

  PAGES.help = {
    view() {
      const cur = S.view.helpTab || HELP_DEFAULT;
      const [, , steps, tip] = HELP.find((h) => h[0] === cur);
      const body = `<div class="tabs">${HELP.map(([k, l]) => `<button class="${cur === k ? 'on' : ''}" data-act="help-tab" data-v="${k}">${l}</button>`).join('')}</div>
        <div class="card"><ol class="stack" style="margin:0;padding-left:22px">${steps.map((s) => `<li>${s}</li>`).join('')}</ol></div>
        ${note('primary', 'info', tip)}
        <div class="card stack"><b>แก้ปัญหาเบื้องต้น</b><div class="small">
          • ขึ้น "ลิงก์ไม่ถูกต้อง" หรือเห็นป้ายโหมดทดลอง → กด Ctrl+F5 (คอม) หรือปิดแท็บแล้วเปิดใหม่ (มือถือ)<br>
          • หาชื่อตัวเองไม่เจอ / ห้องไม่มีสี → แจ้งครู<br>
          • รหัสทีมหาย → ให้ประธานสีกด "ออกรหัสใหม่"<br>
          • หน้าโหลด 3–4 วินาทีเป็นเรื่องปกติ ไม่ต้องกดซ้ำ</div></div>`;
      if (ROLE === 'admin') return adminShell('help', 'วิธีใช้งาน', 'คู่มือสั้น ๆ แยกตามบทบาท', '', `<div class="stack" style="max-width:720px">${body}</div>`);
      return mobileShell('วิธีใช้งาน', body, { back: HOME });
    }
  };
  ACT['help-tab'] = (el) => { S.view.helpTab = el.dataset.v; paint(); };

  // ---------- โหมดทดลอง ----------

  PAGES.demo = {
    view() {
      if (!Client.demo) return mobileShell('โหมดทดลอง', '<div class="empty">เชื่อมกับ Google Sheet แล้ว ไม่มีโหมดทดลอง</div>');
      const k = Db.keys, codes = Db.meta().codes || {};
      const go = (label, q, d) => `<a class="li" href="${esc(BASE + q)}" style="color:inherit"><div class="who"><b>${label}</b><div class="xs muted">${d}</div></div>${ic('back', 'sm')}</a>`;
      const names = ['แดง', 'เหลือง', 'เขียว', 'ฟ้า', 'ชมพู'];
      return mobileShell('โหมดทดลอง', `
        ${note('warning', 'info', 'ยังไม่ได้เชื่อม Google Sheet — ข้อมูลตัวอย่างเก็บในเบราว์เซอร์นี้เท่านั้น ลองสลับบทบาทได้จากลิงก์ด้านล่าง')}
        <b>เปิดในฐานะ…</b><div class="list">
          ${go('นักเรียน (สแกน QR)', '', 'สมัคร / เปิดทีมด้วยรหัส / ดูสาย')}
          ${k.captainKeys.map((c, i) => go('ประธานสี' + names[i], '?captain=' + c, 'อนุมัติรายชื่อ / เปลี่ยนตัว')).join('')}
          ${go('กรรมการ', '?ref=' + k.refereeKey, 'บันทึกผลบนมือถือ')}
          ${go('แอดมิน', '?admin=' + k.adminKey, 'จัดสาย / ผล / เกียรติบัตร / ตั้งค่า')}</div>
        <b>รหัสแก้ไขทีมตัวอย่าง</b><div class="list">${Object.keys(codes).map((n) => `<a class="li" href="${esc(BASE)}#/t/${Core.normalizeCode(codes[n])}" style="color:inherit"><div class="who">${esc(n)}</div><code>${esc(codes[n])}</code></a>`).join('')}</div>
        <button class="btn danger" data-act="demo-reset">ล้างและสร้างข้อมูลตัวอย่างใหม่</button>`, { back: HOME });
    }
  };
  ACT['demo-reset'] = () => {
    confirmBox('ล้างข้อมูลทดลอง?', 'ข้อมูลที่ลองกรอกทั้งหมดในเบราว์เซอร์นี้จะหาย และสร้างข้อมูลตัวอย่างใหม่', 'ล้างข้อมูล', async () => {
      Db.reset();
      location.href = BASE + '#/demo';
      location.reload();
    }, true);
  };

  // ---------- เริ่มทำงาน ----------

  // หน้าเหล่านี้โหลด bootstrap เองใน load()
  ['admin', 'regs', 'certs', 'settings', 'bracket', 'scores', 'ref', 'score'].forEach((k) => { PAGES[k].boots = true; });

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || !ACT[el.dataset.act]) return;
    e.preventDefault();
    ACT[el.dataset.act](el, e);
  });
  document.addEventListener('input', (e) => {
    const el = e.target.closest('[data-input]');
    if (el && INPUT[el.dataset.input]) INPUT[el.dataset.input](el);
  });
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-change]');
    if (el && CHANGE[el.dataset.change]) CHANGE[el.dataset.change](el);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
    if (e.key === 'Enter' && e.target.id === 'code-in') ACT['open-code']();
  });
  window.addEventListener('hashchange', route);
  route();
})();
