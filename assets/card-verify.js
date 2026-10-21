/* Local-only Ed25519 card preview.  No network requests and no secret key. */
(function () {
  var PUBLIC_KEY = "grmExCDnnsiwcVvJT8KoXr3hTx/C3PzhOTIl9dxIMAQ=";
  var DAYS = { TRIAL: 7, MONTH: 30, SEASON: 90 };
  var input = document.getElementById("card-token");
  var button = document.getElementById("card-verify");
  var output = document.getElementById("card-result");
  if (!input || !button || !output) return;
  function b64(value) {
    var normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    while (normalized.length % 4) normalized += "=";
    var raw = atob(normalized), bytes = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return bytes;
  }
  function utf8(value) { return new TextEncoder().encode(value); }
  async function verify() {
    var value = input.value.trim();
    if (!value) { output.textContent = "错误码 CARD_EMPTY：请输入卡密 · 可重试"; return; }
    var parts = value.indexOf("#") >= 0 ? value.split("#") : value.split("|");
    var card = parts[0].trim(), sig = (parts[1] || "").trim();
    var match = /^TB-(\d{8})-(TRIAL|MONTH|SEASON)-(\d{4})-([0-9A-F]{4})$/.exec(card);
    if (!match || !sig) { output.textContent = (!match ? "错误码 CARD_FORMAT：卡号格式或校验位不正确" : "错误码 CARD_FORMAT：签名缺失") + " · 可重试"; return; }
    var date = match[1], plan = match[2], seq = match[4];
    var message = card + "|" + plan + "|" + DAYS[plan] + "|" + date + "|" + seq;
    try {
      if (!crypto.subtle || !crypto.subtle.importKey) throw new Error("Ed25519 不受当前浏览器支持");
      var key = await crypto.subtle.importKey("raw", b64(PUBLIC_KEY), { name: "Ed25519" }, false, ["verify"]);
      var ok = await crypto.subtle.verify({ name: "Ed25519" }, key, b64(sig), utf8(message));
      if (!ok) { output.textContent = "错误码 CARD_SIGNATURE_INVALID：签名校验失败 · 可重试"; return; }
      var expiry = new Date(Date.now() + DAYS[plan] * 86400000).toISOString().slice(0, 10);
      output.textContent = "本地签名校验通过：" + plan + " · 标称 " + DAYS[plan] + " 天；本页不确认激活状态或到期时间，请在软件内核对实际授权";
    } catch (error) {
      output.textContent = "错误码 CARD_SIGNATURE_INVALID：" + error.message + " · 可重试";
    }
  }
  button.addEventListener("click", verify);
})();
