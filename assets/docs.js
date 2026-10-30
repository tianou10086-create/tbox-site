(() => {
  'use strict';
  const query=document.getElementById('docs-query');if(!query)return;
  const clear=document.getElementById('docs-clear');const counter=document.getElementById('docs-count');const empty=document.getElementById('docs-empty');
  const articles=[...document.querySelectorAll('.doc-article')];const filters=[...document.querySelectorAll('[data-doc-category]')];let category='all';
  const index=articles.map(element=>({element,category:element.dataset.category,text:element.textContent+' '+element.dataset.keywords}));
  const update=()=>{
    const matched=index.filter(item=>window.TBOX_PLATFORM.matches(item.text,query.value));
    let count=0;index.forEach(item=>{const show=matched.includes(item)&&(category==='all'||item.category===category);item.element.hidden=!show;if(show)count++;});
    filters.forEach(button=>{button.setAttribute('aria-pressed',String(button.dataset.docCategory===category));const value=button.dataset.docCategory;button.querySelector('[data-category-count]').textContent=matched.filter(item=>value==='all'||value===item.category).length;});
    counter.textContent='显示 '+count+' / '+articles.length+' 篇说明';empty.hidden=count!==0;clear.disabled=!query.value;
  };
  query.disabled=false;filters.forEach(button=>{button.disabled=false;button.addEventListener('click',()=>{category=button.dataset.docCategory;update();});});
  query.addEventListener('input',update);clear.addEventListener('click',()=>{query.value='';update();query.focus();});
  document.getElementById('docs-reset').addEventListener('click',()=>{category='all';query.value='';update();query.focus();});
  document.addEventListener('keydown',e=>{const editing=e.target.matches('input,textarea,select,[contenteditable="true"]');if(e.key==='/'&&!editing&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();query.focus();}if(e.key==='Escape'&&e.target===query){query.value='';update();}});
  function revealHash(){const id=location.hash.slice(1);const article=articles.find(item=>item.id===id);if(article){category='all';query.value='';update();article.scrollIntoView({block:'start'});}}
  window.addEventListener('hashchange',revealHash);update();revealHash();
})();
