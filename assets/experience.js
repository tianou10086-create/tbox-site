/* Progressive enhancements: essential facts and navigation stay in HTML. */
(() => {
  const toast = document.createElement('div');
  toast.className = 'site-toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.setAttribute('aria-atomic', 'true');
  document.body.append(toast);
  let toastTimer;
  document.addEventListener('tbox:copied', event => {
    clearTimeout(toastTimer);
    toast.textContent = event.detail;
    toast.classList.add('is-visible');
    toastTimer = setTimeout(() => {
      toast.classList.remove('is-visible');
      toast.textContent = '';
    }, 3500);
  });

  const menu = document.querySelector('.mobile-menu');
  if (menu) {
    const toggle = menu.querySelector('summary');
    menu.addEventListener('click', event => {
      if (event.target.closest('a')) menu.open = false;
    });
    document.addEventListener('click', event => {
      if (menu.open && !menu.contains(event.target)) menu.open = false;
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && menu.open) {
        menu.open = false;
        toggle.focus();
      }
    });
  }

  // A deep link must reveal the answer, not land on a collapsed FAQ.
  const revealHash = () => {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    const target = id && document.getElementById(id);
    if (!target) return;
    const detail = target.closest('details');
    if (detail) {
      detail.open = true;
      target.scrollIntoView({ block: 'start' });
    }
  };
  revealHash();
  window.addEventListener('hashchange', revealHash);

  const triggers = [...document.querySelectorAll('[data-plan-compare]')];
  const cards = [...document.querySelectorAll('.price, .plan-card')];
  if (!triggers.length || cards.length < 2 || !window.HTMLDialogElement) return;
  const rows = cards.map(card => {
    const label = card.querySelector('h3')?.textContent;
    const price = card.querySelector('.amount')?.textContent.match(/¥[\d.]+/)?.[0];
    const termSource = card.querySelector('.amount small') || card.querySelector(':scope > p');
    const term = termSource?.textContent.match(/\d+\s*天/)?.[0];
    return { label, price, term };
  });
  if (rows.some(row => !row.label || !row.price || !row.term)) return;
  const drawer = document.createElement('dialog');
  drawer.id = 'plan-comparison';
  drawer.className = 'plan-drawer';
  drawer.setAttribute('aria-labelledby', 'comparison-title');
  drawer.setAttribute('aria-describedby', 'comparison-note');
  drawer.setAttribute('aria-modal', 'false');
  drawer.innerHTML = `<div class="drawer-head"><div><span class="eyebrow">PLAN COMPARISON</span><h2 id="comparison-title">按准备周期选方案</h2></div><button type="button" class="drawer-close" aria-label="关闭方案对比">×</button></div><p id="comparison-note">这是含模型总价候选；包含价格页列明的语音、回答与视觉额度，验证中暂未开售。</p><div class="comparison-rows"></div><p class="drawer-notice">微信充值接入中，暂未开放在线购买。可先下载免费试用。</p><div class="drawer-actions"><a class="btn primary" href="download.html">先下载试用</a><a class="btn" href="pricing.html">查看完整权益</a><a href="buy.html">购买状态与历史订单 →</a></div><p class="drawer-hint">此面板不会锁定页面，可继续浏览对照。</p>`;
  const rowContainer = drawer.querySelector('.comparison-rows');
  rows.forEach(({ label, price, term }) => {
    const row = document.createElement('div');
    row.className = 'comparison-row';
    const name = document.createElement('h3');
    const amount = document.createElement('strong');
    const duration = document.createElement('span');
    name.textContent = label;
    amount.textContent = price;
    duration.textContent = term;
    row.append(name, amount, duration);
    rowContainer.append(row);
  });
  document.body.append(drawer);
  let opener;
  const compact = window.matchMedia('(max-width: 600px)');
  const showDrawer = () => {
    drawer.setAttribute('aria-modal', String(compact.matches));
    drawer.querySelector('.drawer-hint').textContent = compact.matches
      ? '关闭方案对比，即可回到刚才的位置。'
      : '此面板不会锁定页面，可继续浏览对照。';
    compact.matches ? drawer.showModal() : drawer.show();
  };
  compact.addEventListener('change', () => {
    if (drawer.open) { drawer.close(); showDrawer(); }
  });
  const close = () => {
    if (!drawer.open) return;
    drawer.close();
  };
  drawer.addEventListener('close', () => {
    if (drawer.open) return; // A responsive mode switch reopens the same panel.
    triggers.forEach(trigger => trigger.setAttribute('aria-expanded', 'false'));
    opener?.focus({ preventScroll: true });
  });
  drawer.querySelector('.drawer-close').addEventListener('click', close);
  drawer.addEventListener('keydown', event => {
    if (event.key !== 'Tab' || !compact.matches) return;
    const stops = [...drawer.querySelectorAll('button, a[href]')];
    const first = stops[0], last = stops[stops.length - 1];
    if ((event.shiftKey && document.activeElement === first) ||
        (!event.shiftKey && document.activeElement === last)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && drawer.open) {
      event.preventDefault();
      close();
    }
  });
  triggers.forEach(trigger => {
    trigger.setAttribute('aria-controls', drawer.id);
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.addEventListener('click', event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      opener = trigger;
      if (!drawer.open) showDrawer();
      trigger.setAttribute('aria-expanded', 'true');
      drawer.querySelector('.drawer-close').focus();
    });
  });
})();
