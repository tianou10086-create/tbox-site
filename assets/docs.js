(() => {
  'use strict';
  const query = document.getElementById('docs-query');
  if (!query) return;
  const clear = document.getElementById('docs-clear');
  const counter = document.getElementById('docs-count');
  const empty = document.getElementById('docs-empty');
  const articles = [...document.querySelectorAll('.doc-article')];
  const filters = [...document.querySelectorAll('[data-doc-category]')];
  const expand = document.getElementById('docs-expand');
  const collapse = document.getElementById('docs-collapse');
  const clearCategory = document.getElementById('docs-clear-category');
  const filterState = document.getElementById('docs-filter-state');
  const history = window.history;
  let category = 'all';
  const index = articles.map(element => ({element, category: element.dataset.category, text: element.textContent + ' ' + element.dataset.keywords + ' ' + (element.dataset.searchText || ''), details: element.querySelector('.doc-disclosure'), link: element.querySelector('[data-doc-link]')}));
  const save = () => {
    // Same history entry, unchanged URL: queries never enter network requests.
    if (history?.replaceState) history.replaceState({...history.state, tboxDocs: {query: query.value, category, open: index.filter(item => item.details?.open).map(item => item.element.id)}}, '');
  };
  const restore = () => {
    const state = history?.state?.tboxDocs;
    query.value = typeof state?.query === 'string' ? state.query.slice(0,200) : '';
    category = filters.some(button => button.dataset.docCategory === state?.category) ? state.category : 'all';
    index.forEach(item => { if (item.details) item.details.open = Array.isArray(state?.open) && state.open.includes(item.element.id); });
  };
  const update = (search = false) => {
    const matched = index.filter(item => window.TBOX_PLATFORM.matches(item.text, query.value));
    let count = 0;
    index.forEach(item => {
      const show = matched.includes(item) && (category === 'all' || item.category === category);
      item.element.hidden = !show;
      item.element.classList.toggle('is-search-result', show && Boolean(query.value.trim()));
      if (item.details && search) item.details.open = show && Boolean(query.value.trim());
      if (show) count++;
    });
    filters.forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.docCategory === category));
      const value = button.dataset.docCategory;
      button.querySelector('[data-category-count]').textContent = matched.filter(item => value === 'all' || value === item.category).length;
    });
    counter.textContent = '显示 ' + count + ' / ' + articles.length + ' 条结果';
    empty.hidden = count !== 0;
    clear.disabled = !query.value;
    if (expand) expand.disabled = !count;
    if (collapse) collapse.disabled = !count;
    if (clearCategory) clearCategory.hidden = category === 'all';
    if (filterState) {
      const selected = filters.find(button => button.dataset.docCategory === category);
      const label = selected?.textContent.replace(/\s*\d+\s*$/, '').trim();
      filterState.textContent = [query.value.trim() ? '关键词：' + query.value.trim() : '全部关键词', category === 'all' ? '全部分类' : label].join(' · ');
    }
    save();
  };
  restore();
  query.disabled = false;
  filters.forEach(button => { button.disabled = false; button.addEventListener('click', () => { category = button.dataset.docCategory; update(); }); });
  query.addEventListener('input', () => update(true));
  clear.addEventListener('click', () => { query.value = ''; update(true); query.focus(); });
  clearCategory?.addEventListener('click', () => { category = 'all'; update(); query.focus(); });
  document.getElementById('docs-reset').addEventListener('click', () => { category = 'all'; query.value = ''; update(true); query.focus(); });
  for (const [button, open] of [[expand,true], [collapse,false]]) {
    if (!button) continue;
    button.disabled = false;
    button.closest('.docs-view-actions').hidden = false;
    button.addEventListener('click', () => { index.filter(item => !item.element.hidden && item.details).forEach(item => { item.details.open = open; }); save(); });
  }
  if (filterState) filterState.closest('.docs-filter-summary').hidden = false;
  index.forEach(item => item.details?.addEventListener('toggle', save));
  document.addEventListener('keydown', event => {
    const editing = event.target.matches('input,textarea,select,[contenteditable="true"]');
    if (event.key === '/' && !editing && !event.ctrlKey && !event.metaKey && !event.altKey) { event.preventDefault(); query.focus(); }
    if (event.key === 'Escape' && event.target === query) { query.value = ''; update(true); }
    if (event.target === query && ['ArrowDown', 'Enter'].includes(event.key)) {
      const first = index.find(item => !item.element.hidden && (item.details || item.link));
      if (first) { event.preventDefault(); if(first.details) {first.details.open = true; first.details.querySelector('summary').focus();} else first.link.focus(); save(); }
    }
  });
  function revealHash() {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    const article = index.find(item => item.element.id === id);
    if (article) {
      const destination = article.link?.getAttribute('href');
      if (destination && /^docs-(start|audio|config|license|account)\.html#doc-[a-z-]+$/.test(destination) && window.location?.replace) { window.location.replace(destination); return; }
      category = 'all'; query.value = ''; update(); if (article.details) article.details.open = true; article.element.scrollIntoView({block:'start'}); save();
    }
  }
  window.addEventListener('hashchange', revealHash);
  window.addEventListener('popstate', () => { restore(); update(); revealHash(); });
  update();
  revealHash();
})();
