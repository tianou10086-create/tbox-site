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

  // 三档各自直链（2026-10-19 加）
  // 原因：只有一个全局 BUY_URL 时，点「先试 7 天」和点「买永久卡」会落到同一个商品页，
  // 价格对不上就是纠纷。现在按 data-buy 的档位名取对应链接，未单独配置时回落到 BUY_URL。
  var BUY_TIER_KEY = { trial: 'BUY_URL_TRIAL', month: 'BUY_URL_MONTH', season: 'BUY_URL_SEASON' };
  function buyUrlFor(a) {
    var tier = a.getAttribute('data-buy');
    if (tier && BUY_TIER_KEY[tier] && configured(c[BUY_TIER_KEY[tier]])) return c[BUY_TIER_KEY[tier]];
    return configured(c.BUY_URL) ? c.BUY_URL : '';
  }
  function anyBuyConfigured() {
    if (configured(c.BUY_URL)) return true;
    for (var k in BUY_TIER_KEY) {
      if (configured(c[BUY_TIER_KEY[k]])) return true;
    }
    return false;
  }

  // Navigation shows status only; purchasing remains in page content.
  document.querySelectorAll('.nav-status').forEach(function (el) {
    el.hidden = anyBuyConfigured();
    el.removeAttribute('title');
  });

  // 购买 CTA
  //
  // 2026-10-19 改：BUY_URL 没填时，原来只把 href 设成 '#'，点击时在旁边冒一行灰字。
  // 这是个死链 —— 卖货站最贵的位置放一个点了不动的「立即购买」，比不放按钮还糟：
  // 用户以为按钮坏了，直接走人。现在改成把它变成一个**真的能走**的动作：
  //   1) 主按钮降级（去掉 primary 高亮，让「先下载体验版」成为主行动）；
  //   2) 文案变成「购买通道开通中」，点它跳到页内那段解释；
  //   3) 那段解释默认 hidden，只有 BUY_URL 为空时才显示 ——
  //      开通后填上 BUY_URL，一切自动恢复正常，不需要回来删区块。
  var PENDING_ID = 'buy-pending';
  function showBuyPending() {
    var box = document.getElementById(PENDING_ID);
    if (!box) return false;
    box.hidden = false;
    box.removeAttribute('hidden');
    return true;
  }
  // 2026-10-19：三档链接的取用逻辑已提前到文件上部（见 buyUrlFor / anyBuyConfigured）。
  document.querySelectorAll('[data-buy]').forEach(function (a) {
    var url = buyUrlFor(a);
    if (url) {
      bindLink(a, url, '购买通道即将开放');
      return;
    }
    a.classList.remove('primary');
    a.classList.add('is-pending');
    a.href = '#' + PENDING_ID;
    a.textContent = '购买通道开通中';
    a.removeAttribute('target');
    showBuyPending();
  });
  // 即使页面上没有 [data-buy]，只要没开通就提示清楚（避免"看不到购买入口在哪"）
  if (!anyBuyConfigured()) {
    showBuyPending();
    // 购买按钮一降级，首屏就一个高亮按钮都不剩了 —— 那等于把用户的下一步也拿走了。
    // 所以让"下载"接替主行动：这是没开通期间唯一能真的走通的路。
    document.querySelectorAll('[data-fallback-primary]').forEach(function (el) {
      el.classList.add('primary');
    });
  }

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
