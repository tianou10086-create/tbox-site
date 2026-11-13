/* Only routes verified SKUs to the backend checkout; never logs in or creates orders. */
(() => {
  'use strict';
  const api = 'https://api.tboxapp.top';
  function eligible(config, catalog, expected, sku) {
    if (config?.catalog_url !== api + '/included/catalog' || config?.checkout_url !== api + '/included/checkout' ||
        !Array.isArray(config.approved_skus) || !config.approved_skus.includes(sku) ||
        catalog?.contract_version !== config.contract_version || catalog?.purchasing_open !== true ||
        catalog?.client_integration_verified !== true || !Array.isArray(catalog.domestic) ||
        !Array.isArray(expected?.domestic)) return false;
    const known = expected.domestic.filter(p => p.id === sku);
    const actual = catalog.domestic.filter(p => p.id === sku);
    if (known.length !== 1 || actual.length !== 1 || actual[0].purchasing_open !== true ||
        actual[0].client_integration_verified !== true) return false;
    return ['cny', 'days', 'minutes', 'answers', 'vision'].every(k =>
      Number.isInteger(known[0][k]) && actual[0][k] === known[0][k]);
  }
  if (typeof module !== 'undefined' && module.exports) { module.exports = { eligible }; return; }
  const cards = [...document.querySelectorAll('[data-included-offer]')];
  const title = document.querySelector('#payment-status h2');
  const summary = document.querySelector('#payment-status p');
  async function json(url) {
    const response = await fetch(url, { credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error('状态读取失败（' + response.status + '）');
    return response.json();
  }
  async function load() {
    try {
      const config = await json('assets/checkout-release.json');
      if (!Array.isArray(config.approved_skus) || !config.approved_skus.length) return;
      if (config.catalog_url !== api + '/included/catalog' || config.checkout_url !== api + '/included/checkout')
        throw new Error('收银入口配置不匹配');
      const [catalog, expected] = await Promise.all([
        json(config.catalog_url), json('assets/tbox-value/model-inclusive.json')
      ]);
      let count = 0;
      for (const card of cards) {
        const sku = card.dataset.includedOffer;
        if (!eligible(config, catalog, expected, sku)) continue;
        const state = card.querySelector('[aria-disabled="true"]');
        if (!state) continue;
        const link = document.createElement('a');
        link.className = 'btn primary';
        link.href = config.checkout_url + '?sku=' + encodeURIComponent(sku);
        link.rel = 'noreferrer';
        link.textContent = '进入收银台';
        state.replaceWith(link); count++;
      }
      if (count) {
        title.textContent = count === cards.length ? '以下套餐已开放购买入口' : '部分套餐已开放，其他套餐仍在验证';
        summary.textContent = '仅标有“进入收银台”的套餐可继续。登录已有商业平台账户后，由服务端重新核实可购状态、金额与库存；进入收银台不代表付款成功。';
        document.querySelector('.trust-line').textContent = document.querySelector('.trust-line').textContent.split(' / ')[0] + ' / 到期可续期 / 开放范围以对应套餐按钮为准 / 软件运行需付费授权；关闭软件后暂停计时';
      }
    } catch (error) {
      title.textContent = '暂不能确认购买状态';
      summary.textContent = '未开放付款入口，未创建订单。请稍后刷新；已有订单仍可通过原渠道核对。';
      console.warn('TBOX checkout status:', error.message);
    }
  }
  load();
})();
