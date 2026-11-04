import { renderOwnPrices, renderComparison, renderOfficialFacts } from './comparison.js?v=20261103-v5';

const own = document.getElementById('value-own-prices');
const comparison = document.getElementById('value-comparison');
try {
  const response = await fetch(new URL('./price-comparison.json', import.meta.url));
  if (!response.ok) throw new Error('Price data HTTP ' + response.status);
  const data = await response.json();
  renderOwnPrices(own, data);
  renderComparison(comparison, data);
  const officialRows = renderOfficialFacts(document.getElementById('official-price-facts'), data);
  document.getElementById('price-reference').hidden = officialRows === 0;
  if (officialRows && location.hash === '#price-reference') {
    const revealReference = () => document.getElementById('price-reference').scrollIntoView({behavior:'instant'});
    if (document.readyState === 'complete') revealReference();
    else window.addEventListener('load', revealReference, {once:true});
  }
  // Do not keep displaying a fixed-price campaign image after its data changes.
  const imageMatchesApprovedPrice = data.own_price_public_copy_ready === true &&
    data.public_sale_ready === false &&
    [['tbox_byok_trial', 9.9, 7], ['tbox_byok_month', 29, 30], ['tbox_byok_season', 69, 90]]
      .every(([id, price, days]) => data.own_prices.some(p =>
        p.id === id && p.price_cny === price && p.validity_days === days &&
        p.model_fee_included === false && p.auto_renew === false && p.online_purchasing_open === false));
  document.querySelector('[data-approved-promo]').hidden = !imageMatchesApprovedPrice;
} catch (error) {
  own.textContent = '价格信息暂不可用，请查看价格与授权说明页。';
  comparison.hidden = true;
  console.error(error);
}
