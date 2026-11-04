import { renderOwnPrices, renderComparison, renderOfficialFacts } from './comparison.js?v=20261104-included';

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
  // The image now depicts the NEW included-model catalog, never the legacy BYOK prices.
  const offerResponse = await fetch(new URL('./model-inclusive.json', import.meta.url));
  if (!offerResponse.ok) throw new Error('Offer data HTTP ' + offerResponse.status);
  const offer = await offerResponse.json();
  const imageMatchesApprovedPrice = offer.brand === 'TBOX' && offer.purchasing_open === false &&
    offer.status === 'candidate_disabled' && offer.model_fee_included === true &&
    [['tbox_included_7',99,7,120,250,50],['tbox_included_30',299,30,600,1200,200],['tbox_included_90',699,90,1800,3600,600]]
      .every(([id,price,days,minutes,answers,vision]) => offer.domestic.some(p =>
        p.id === id && p.cny === price && p.days === days && p.minutes === minutes &&
        p.answers === answers && p.vision === vision && p.included_model === true &&
        p.auto_renew === false && p.purchasing_open === false));
  document.querySelector('[data-approved-promo]').hidden = !imageMatchesApprovedPrice;
} catch (error) {
  own.textContent = '价格信息暂不可用，请查看价格与授权说明页。';
  comparison.hidden = true;
  console.error(error);
}
