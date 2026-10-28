/**
 * client.js — เรียกคำสั่งของระบบ
 *  - มี apiUrl → ส่งไป Apps Script (ข้อมูลอยู่ใน Google Sheet)
 *  - ไม่มี    → โหมดทดลอง เรียก Api.js ตรง ๆ ในเบราว์เซอร์ (ข้อมูลอยู่ใน localStorage)
 */
var Client = (function () {
  var cfg = window.SPORTDAY_CONFIG || {};
  var demo = !cfg.apiUrl;

  async function call(action, payload) {
    if (demo) {
      await new Promise(function (r) { setTimeout(r, 60); });
      try {
        return JSON.parse(JSON.stringify(Api.handle(action, payload)));
      } catch (e) {
        throw new Error(e.message);
      }
    }
    var res;
    try {
      // text/plain = simple request ไม่ติด CORS preflight ของ Apps Script
      res = await fetch(cfg.apiUrl, { method: 'POST', body: JSON.stringify({ action: action, payload: payload }) });
    } catch (e) {
      throw new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจสอบอินเทอร์เน็ต');
    }
    if (!res.ok) throw new Error('เซิร์ฟเวอร์ตอบกลับผิดพลาด (' + res.status + ')');
    var json = await res.json();
    if (!json.ok) throw new Error(json.error);
    return json.data;
  }

  return { call: call, demo: demo };
})();
