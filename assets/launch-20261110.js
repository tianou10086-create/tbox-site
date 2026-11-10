
(() => {
  'use strict';
  const c = window.TBOX_CONFIG || {};
  const expectedVersion = '0.1.51';
  const text = (selector,value) => {
    if (value == null || value === '') return;
    document.querySelectorAll(selector).forEach(el => { el.textContent = String(value); });
  };
  text('[data-qq-group]', c.QQ_SUPPORT_GROUP);
  if (c.VERSION === expectedVersion) {
    [['[data-version]','VERSION'],['[data-size]','SIZE'],['[data-sha256]','SHA256'],
      ['[data-release-date]','RELEASE_DATE'],['[data-portable-size]','PORTABLE_SIZE'],
      ['[data-portable-sha256]','PORTABLE_SHA256']].forEach(([s,k]) => text(s,c[k]));
    [['[data-primary-download]','PRIMARY_DOWNLOAD'],['[data-portable-download]','PORTABLE_URL']]
      .forEach(([s,k]) => { if (typeof c[k] === 'string' && c[k].startsWith('https://')) document.querySelectorAll(s).forEach(a=>{ a.href=c[k]; }); });
  } else if (document.querySelector('[data-download-status]')) {
    text('[data-download-status]','下载信息正在同步，请稍后刷新本页。');
  }
  document.querySelectorAll('[data-copy-support]').forEach(button => {
    button.addEventListener('click', async () => {
      const group = String(c.QQ_SUPPORT_GROUP || '1127804697');
      try {
        await navigator.clipboard.writeText(group);
        text('[data-copy-status]','群号已复制');
      } catch (_) {
        text('[data-copy-status]','请在 QQ 搜索群号 '+group);
      }
    });
  });
  const menu=document.querySelector('.launch-menu');
  if(menu){
    menu.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{menu.open=false;}));
    document.addEventListener('click',e=>{if(!menu.contains(e.target))menu.open=false;});
    document.addEventListener('keydown',e=>{if(e.key==='Escape' && menu.open){menu.open=false;menu.querySelector('summary').focus();}});
  }
  // Play only the video the visitor chose; no autoplay, extra downloads or account requests.
  document.querySelectorAll('video').forEach(video => video.addEventListener('play',()=>{
    document.querySelectorAll('video').forEach(other=>{if(other!==video)other.pause();});
  }));
})();
