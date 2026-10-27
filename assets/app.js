/**
 * T-Box 站点交互 —— 无依赖、无构建。
 *
 * 原则：配置缺失时不许给用户看内部开发提示。
 * 以前 BUY_URL 没填会 alert("请先在 assets/config.js 填入 BUY_URL")，
 * 那是给开发者看的话术，不该出现在公开站点上。
 */
(function () {
  var c = window.TBOX_CONFIG || {};

  /** 判断是否真的配置了（空串、undefined、以及遗留占位符都算未配置） */
  function configured(v) {
    return typeof v === 'string' && v.length > 0 && v !== 'BUY_URL' && v !== 'MIRROR_1' && v !== 'MIRROR_2';
  }

  /** 在元素旁边给一句友好说明，不打断浏览 */
  function notify(el, text) {
    if (!el) return;
    var tip = el.nextElementSibling;
    if (!tip || !tip.classList.contains('link-note')) {
      tip = document.createElement('span');
      tip.className = 'link-note';
      tip.setAttribute('role', 'status');
      el.insertAdjacentElement('afterend', tip);
    }
    tip.textContent = text;
  }

  /** 绑定一个链接：有真实地址就跳转，否则原地友好提示 */
  function bindLink(el, url, fallbackText) {
    if (configured(url)) {
      el.href = url;
      el.target = '_blank';
      el.rel = 'noopener';
      return;
    }
    el.href = '#';
    el.addEventListener('click', function (e) {
      e.preventDefault();
      notify(el, fallbackText);
    });
  }

  // 已配置购买渠道时直接进入 16688 店铺；未配置时保留本站购买页兜底。
  document.querySelectorAll('.nav-status').forEach(function (el) {
    el.hidden = true;
    el.removeAttribute('title');
  });
  document.querySelectorAll('[data-buy]').forEach(function (a) {
    var key = a.getAttribute('data-buy');
    var url = key === 'trial' ? c.BUY_URL_TRIAL : key === 'month' ? c.BUY_URL_MONTH : key === 'season' ? c.BUY_URL_SEASON : c.BUY_URL;
    if (configured(url)) bindLink(a, url, '购买入口暂时不可用');
    else { a.href = 'buy.html'; a.removeAttribute('target'); }
  });

  // 下载 CTA（主线路 + 备用线路；备用未配置则复用主线路，避免死链）
  var primary = configured(c.PRIMARY_DOWNLOAD) ? c.PRIMARY_DOWNLOAD : '';
  document.querySelectorAll('[data-primary-download]').forEach(function (a) {
    bindLink(a, primary, '下载即将开放');
  });
  [['data-mirror-1', c.MIRROR_1], ['data-mirror-2', c.MIRROR_2]].forEach(function (pair) {
    document.querySelectorAll('[' + pair[0] + ']').forEach(function (a) {
      bindLink(a, configured(pair[1]) ? pair[1] : primary, '下载即将开放');
    });
  });

  // 静态数据回填（链接填 href，其余填文本）
  function fill(attr, value) {
    if (value === undefined || value === null || value === '') return;
    document.querySelectorAll('[' + attr + ']').forEach(function (e) {
      if (e.tagName === 'A') e.href = value;
      else e.textContent = value;
    });
  }
  fill('data-version', c.VERSION);
  fill('data-size', c.SIZE);
  fill('data-sha256', c.SHA256);
  fill('data-release-date', c.RELEASE_DATE);
  fill('data-qq-group', c.QQ_SUPPORT_GROUP);

  // 售后群入口：复制优先，未安装 QQ 也能手动使用群号。
  document.querySelectorAll('[data-copy-qq]').forEach(function (button) {
    button.addEventListener('click', function () {
      var group = c.QQ_SUPPORT_GROUP || button.getAttribute('data-copy-qq') || '';
      if (!group) return;
      var done = function () { notify(button, 'QQ群号已复制：' + group); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(group).then(done).catch(done);
      } else {
        var input = document.createElement('textarea');
        input.value = group; input.setAttribute('readonly', ''); input.style.position = 'fixed'; input.style.opacity = '0';
        document.body.appendChild(input); input.select();
        try { document.execCommand('copy'); } finally { document.body.removeChild(input); }
        done();
      }
    });
  });
})();

/* --- FAQ 手风琴兜底（2026-10-19）---
   首选是 HTML 原生的 exclusive accordion：<details name="faq">，
   Chromium/Edge 点开一个会自动关掉同组其它，无 JS 也生效。
   这里只给"不认 name 的旧内核"补一层：打开某个 details 时关掉同组其它。
   为什么要 name 分组而不是全关：download.html 里的 details 是独立说明，不该被 FAQ 牵连。 */
(function () {
  var guards = new WeakSet();
  document.querySelectorAll('details[name]').forEach(function (d) {
    d.addEventListener('toggle', function () {
      if (!d.open) return;
      if (guards.has(d)) return;            // 防止设置 open 触发 toggle 递归
      guards.add(d);
      try {
        document.querySelectorAll('details[name="' + d.getAttribute('name') + '"]').forEach(function (o) {
          if (o !== d && o.open) o.open = false;
        });
      } finally {
        setTimeout(function () { guards.delete(d); }, 0);
      }
    });
  });
})();
