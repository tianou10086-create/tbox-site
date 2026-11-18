(() => {
  'use strict';
  const sku = 'tbox_trial_5m_10c_v7';
  const buttons = [...document.querySelectorAll('[data-trial10]')];
  if (!buttons.length) return;
  let revision = 0;
  function show(ready, text) {
    for (const a of buttons) {
      a.removeAttribute('href');
      a.setAttribute('aria-disabled', ready ? 'false' : 'true');
      a.textContent = text;
      if (ready) a.href = 'https://api.tboxapp.top/included/checkout?sku=' + sku;
    }
  }
  async function refresh() {
    const turn = ++revision;
    show(false, '正在查询体验包状态');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    try {
      // Never inherit a staff account's preview entitlement for this public button.
      const response = await fetch('https://api.tboxapp.top/included/catalog', {
        credentials: 'omit', cache: 'no-store', redirect: 'error', signal: controller.signal
      });
      if (!response.ok) throw new Error('catalog unavailable');
      const c = await response.json();
      const rows = Array.isArray(c.domestic) ? c.domestic : [];
      const matches = rows.filter(r => r && r.id === sku);
      const r = matches[0];
      const ready = c.contract_version === 'TBOX-ACTIVE-TIME-V7-20261117' &&
        c.purchasing_open === true && matches.length === 1 &&
        rows.filter(p => p && p.purchasing_open === true).length === 1 &&
        r.purchasing_open === true && r.price_minor === 10 && r.minutes === 5 && r.days === 7;
      if (turn === revision) show(ready, ready ? '购买 5 分钟 · ¥0.10' : '体验包暂未开放购买');
    } catch (_) {
      if (turn === revision) show(false, '暂时无法核实购买状态，请稍后刷新');
    } finally {
      clearTimeout(timeout);
    }
  }
  refresh();
  window.addEventListener('pageshow', e => { if (e.persisted) refresh(); });
})();
