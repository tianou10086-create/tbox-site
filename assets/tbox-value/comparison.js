/* Candidate only. Both website and software read this same data source. */
export function approvedComparisons(data) {
  if (data?.publishable !== true || data.status !== 'approved' ||
      !data.evidence_ref || !data.approval_ref || !Array.isArray(data.comparisons)) return [];
  return data.comparisons.filter(row =>
    row.approved === true && row.evidence_ref && row.approval_ref &&
    row.sku && row.unit && row.term && row.offer_condition && row.observed_at &&
    row.comparison_basis && /^https:\/\//.test(row.source_url || '') &&
    Number.isFinite(row.our_price) && row.our_price >= 0 &&
    Number.isFinite(row.compare_price) && row.compare_price >= 0
  );
}

export function renderComparison(root, data) {
  const rows = approvedComparisons(data);
  root.replaceChildren();
  root.hidden = rows.length === 0;
  root.dataset.state = rows.length ? 'ready' : 'pending_evidence';
  if (!rows.length) return { state: root.dataset.state, visibleRows: 0 };
  const element = (tag, text) => {
    const el = document.createElement(tag);
    el.textContent = text;
    return el;
  };
  root.append(element('h2', '同口径，看价格与权益'));
  const wrap = element('div', ''); wrap.className = 'tbox-compare-scroll';
  const table = element('table', '');
  table.append(element('caption', '价格为采集日期的记录，不代表当前成交价；以实际订单页为准。'));
  const head = element('thead', ''); const tr = element('tr', '');
  for (const name of ['比较项目', 'T-Box', '对比价格', '适用条件', '来源']) tr.append(element('th', name));
  head.append(tr); table.append(head);
  const body = element('tbody', '');
  const currency = new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' });
  rows.forEach((row, i) => {
    const line = element('tr', '');
    line.append(element('td', row.sku + ' / ' + row.unit + ' / ' + row.term));
    line.append(element('td', currency.format(row.our_price)));
    line.append(element('td', currency.format(row.compare_price)));
    line.append(element('td', row.offer_condition + '；' + row.comparison_basis));
    const source = element('td', '');
    source.append(element('span', row.observed_at + ' '));
    const link = element('a', '来源 ' + (i + 1));
    link.href = row.source_url; link.target = '_blank'; link.rel = 'noopener noreferrer';
    source.append(link); line.append(source); body.append(line);
  });
  table.append(body); wrap.append(table); root.append(wrap);
  return { state: 'ready', visibleRows: rows.length };
}

export function renderOwnPrices(root, data) {
  const plans = data.own_price_public_copy_ready === true ? (data.own_prices || []) : [];
  root.replaceChildren(); root.hidden = plans.length === 0;
  if (!plans.length) return { visiblePlans: 0 };
  const list = document.createElement('div'); list.className = 'tbox-own-plans';
  for (const plan of plans) {
    const article = document.createElement('article');
    const name = document.createElement('h3'); name.textContent = plan.name;
    const price = document.createElement('p'); price.className = 'tbox-own-price';
    price.textContent = '¥' + plan.price_cny + ' / ' + plan.validity_days + '个自然日';
    const unit = document.createElement('p'); unit.textContent = '软件授权 · 不自动续费';
    article.append(name, price, unit); list.append(article);
  }
  const limits = document.createElement('p'); limits.className = 'tbox-own-limits';
  limits.textContent = '第三方模型调用额度不包含；微信充值接入中，暂未开放在线购买。展示价格不代表当前可以下单。';
  const date = document.createElement('p'); date.className = 'tbox-price-date';
  date.textContent = '展示价核对日期：' + data.own_price_verified_at;
  root.append(list, limits, date);
  return { visiblePlans: plans.length };
}

export function renderOfficialFacts(root, data) {
  root.replaceChildren();
  if (!data.official_price_fact_table_ready || !data.official_fact_approval_ref) return 0;
  const rows = (data.official_reference_rows || []).filter(r => r.public_fact_table_allowed);
  const create = (tag, text) => { const el=document.createElement(tag);el.textContent=text;return el; };
  const list=create('div','');list.className='value-reference-list';
  const own=create('article','');
  const plan=(data.own_prices || []).find(r=>r.id==='tbox_byok_season');
  if (plan) {
    own.append(create('h3','T-Box｜¥'+plan.price_cny+' / '+plan.validity_days+'个自然日'));
    own.append(create('p','软件授权；第三方模型费用另付。不自动续费，在线购买暂未开放。'));
    list.append(own);
  }
  for(const row of rows) {
    const article=create('article','');
    article.append(create('h3',row.label+'｜¥'+row.price_cny+' / '+row.quantity+row.unit));
    article.append(create('p',row.public_summary || row.model_terms));
    const terms=create('details','');terms.append(create('summary','套餐说明'),create('p',row.model_terms+' '+row.conditions));article.append(terms);
    const source=create('a','原始来源 · '+row.observed_at);
    source.href=row.source_url;source.target='_blank';source.rel='noopener noreferrer';
    article.append(source);list.append(article);
  }
  root.append(list);return rows.length;
}

export async function loadComparison(root, url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('对比数据读取失败：HTTP ' + response.status);
  return renderComparison(root, await response.json());
}
