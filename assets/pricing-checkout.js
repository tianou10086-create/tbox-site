(() => {
  'use strict';

  const API = 'https://api.tboxapp.top';
  const pendingKey = 'tbox-pending-checkout-sku';
  const openStatuses = ['pending', 'payment_unknown', 'paid_awaiting_stock', 'pending_review', 'expired'];
  let modal = null;
  let pollTimer = null;
  let activeOrder = null;
  let cachedConfig = null;

  async function api(path, init = {}) {
    const response = await fetch(API + path, {
      credentials: 'include',
      mode: 'cors',
      cache: 'no-store',
      ...init,
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers || {})
      }
    });
    let data = null;
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) {
      const error = new Error(typeof data?.detail === 'string' ? data.detail : '请求未成功，请稍后重试。');
      error.status = response.status;
      throw error;
    }
    return data;
  }

  async function readSession() {
    const response = await fetch(API + '/account/api/session', {
      credentials: 'include', mode: 'cors', cache: 'no-store'
    });
    if (response.status === 401) return null;
    if (!response.ok) throw new Error('暂时无法确认登录状态，请稍后重试。');
    return response.json();
  }

  async function fetchConfig() {
    if (cachedConfig) return cachedConfig;
    try {
      const response = await fetch(API + '/account/api/config', {
        credentials: 'omit', mode: 'cors', cache: 'no-store'
      });
      if (response.ok) {
        cachedConfig = await response.json();
        return cachedConfig;
      }
    } catch (_) {}
    return null;
  }

  function cardFor(sku) {
    return document.querySelector('.offer-card[data-sku="' + sku + '"]');
  }

  function titleFor(sku) {
    return cardFor(sku)?.querySelector('h3')?.textContent?.trim() || '这份云时长';
  }

  function safeUrl(raw) {
    if (!raw || typeof raw !== 'string') return '';
    try {
      const url = new URL(raw);
      if ((url.origin === 'https://km.iu99.top' || url.origin === API) && !url.username && !url.password) {
        return url.href;
      }
    } catch (_) {}
    return '';
  }

  function makeQrDataUrl(text) {
    if (!text || !window.TBOX_QR || typeof window.TBOX_QR.toDataURL !== 'function') return '';
    try {
      return window.TBOX_QR.toDataURL(text, 260);
    } catch (_) {
      return '';
    }
  }

  function ensureModal() {
    if (modal) return modal;
    modal = document.createElement('dialog');
    modal.className = 'checkout-dialog';
    modal.setAttribute('aria-labelledby', 'checkout-dialog-title');
    modal.innerHTML = `
      <form method="dialog" class="checkout-dialog__shell">
        <button class="checkout-dialog__close" value="cancel" aria-label="关闭购买窗口">×</button>
        <div class="checkout-dialog__body">
          <span class="checkout-dialog__eyebrow">TBOX 官方扫码收银台</span>
          <h2 id="checkout-dialog-title"></h2>
          <div class="checkout-dialog__content" data-checkout-content></div>
          <p class="checkout-dialog__status" data-checkout-status role="status" aria-live="polite"></p>
        </div>
      </form>`;
    (document.querySelector('.pass-preview') || document.body).append(modal);
    modal.addEventListener('close', () => {
      stopPolling();
      activeOrder = null;
    });
    return modal;
  }

  function openModal(sku, statusText = '正在确认账户与订单状态…') {
    const view = ensureModal();
    view.querySelector('#checkout-dialog-title').textContent = '购买 ' + titleFor(sku);
    view.querySelector('[data-checkout-content]').replaceChildren();
    view.querySelector('[data-checkout-status]').textContent = statusText;
    if (!view.open) {
      if (typeof view.showModal === 'function') view.showModal();
      else view.setAttribute('open', '');
    }
    return view;
  }

  function stopPolling() {
    if (pollTimer) window.clearInterval(pollTimer);
    pollTimer = null;
  }

  function money(cents) {
    return '¥' + (Number(cents || 0) / 100).toFixed(2);
  }

  function clearSkuSessionKey(sku) {
    try {
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith('tbox-purchase-') && k.endsWith('-' + sku)) {
          sessionStorage.removeItem(k);
          sessionStorage.removeItem(k + ':order');
        }
      }
    } catch (_) {}
  }

  function appendQrBlock(content, order, cashier, allowQr) {
    const qrMime = order.image_mime || 'image/png';
    if (allowQr && order.qrcode_base64 && ['image/png', 'image/jpeg'].includes(qrMime)) {
      const image = document.createElement('img');
      image.className = 'checkout-dialog__qr';
      image.alt = '本订单付款二维码';
      image.src = 'data:' + qrMime + ';base64,' + order.qrcode_base64;
      content.append(image);
      return true;
    }
    if (allowQr && cashier) {
      const generated = makeQrDataUrl(cashier);
      if (generated) {
        const image = document.createElement('img');
        image.className = 'checkout-dialog__qr';
        image.alt = '手机扫码打开收银台完成微信或支付宝付款';
        image.src = generated;
        content.append(image);
        return true;
      }
    }
    return false;
  }

  function appendCashierExtras(content, cashier) {
    if (!cashier) return;
    const row = document.createElement('div');
    row.className = 'checkout-dialog__subactions';

    const link = document.createElement('a');
    link.className = 'checkout-dialog__subbtn';
    link.href = cashier;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = '直接打开网页收银台';

    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'checkout-dialog__subbtn';
    copy.textContent = '复制付款链接';
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(cashier);
        copy.textContent = '已复制链接';
      } catch (_) {
        if (content.querySelector('input[data-cashier-copy]')) return;
        const field = document.createElement('input');
        field.readOnly = true;
        field.dataset.cashierCopy = '1';
        field.value = cashier;
        field.setAttribute('aria-label', '本单付款链接，可长按复制');
        content.append(field);
        field.focus();
        field.select();
        copy.textContent = '请复制下方链接';
      }
    });

    row.append(link, copy);
    content.append(row);
  }

  function appendReceiptClaimForm(content, sku, order, statusEl) {
    const form = document.createElement('div');
    form.className = 'checkout-dialog__claim';
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = '输入微信交易单号后六位或完整单号';
    input.maxLength = 200;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'checkout-dialog__refresh';
    const submitted = order.receipt_claim_status === 'pending' || order.status === 'pending_review';
    btn.textContent = submitted ? '参考号已提交 · 等待核对' : '已扫码？提交单号加速核对';
    input.disabled = submitted;
    btn.disabled = submitted;
    btn.addEventListener('click', async () => {
      const ref = input.value.trim();
      if (ref.length < 4) {
        statusEl.textContent = '请填写 4 位以上的微信交易单号或付款参考号。';
        return;
      }
      btn.disabled = true;
      try {
        const updated = await api('/account/api/orders/' + encodeURIComponent(order.id) + '/receipt-claim', {
          method: 'POST',
          body: JSON.stringify({ transaction_reference: ref })
        });
        renderOrder(sku, updated);
      } catch (err) {
        statusEl.textContent = err.message;
        btn.disabled = false;
      }
    });
    form.append(input, btn);
    content.append(form);
  }

  function renderOrder(sku, order, customNotice = '') {
    const resolvedSku = order.sku || sku;
    const view = openModal(resolvedSku);
    const content = view.querySelector('[data-checkout-content]');
    const statusEl = view.querySelector('[data-checkout-status]');
    content.replaceChildren();
    activeOrder = order;

    if (customNotice) {
      const alert = document.createElement('p');
      alert.className = 'checkout-dialog__notice';
      alert.textContent = customNotice;
      content.append(alert);
    }

    const amount = document.createElement('p');
    amount.className = 'checkout-dialog__amount';
    amount.textContent = money(order.amount_cents);
    content.append(amount);

    if (order.id) {
      const oid = document.createElement('p');
      oid.className = 'checkout-dialog__orderid';
      oid.textContent = '订单号：' + order.id;
      content.append(oid);
    }

    const cashier = safeUrl(order.cashier_url);
    const isFreeReceipt = order.payment_channel === 'free_receipt';

    if (order.status === 'pending') {
      const hasQr = appendQrBlock(content, order, cashier, true);
      if (hasQr) {
        const hint = document.createElement('p');
        hint.className = 'checkout-dialog__hint';
        hint.textContent = order.qrcode_base64
          ? '用微信扫一扫上方二维码付款，金额以本单为准，到账后自动刷新。'
          : '用手机微信 / 支付宝 / 系统相机扫一扫上方二维码打开收银台付款（若微信拦截，点右上角用浏览器打开即可）。';
        content.append(hint);
      }
      if (cashier) appendCashierExtras(content, cashier);
      if (isFreeReceipt) appendReceiptClaimForm(content, resolvedSku, order, statusEl);
      statusEl.textContent = hasQr
        ? '二维码有效，扫完付款后本弹窗每 5 秒自动查账。'
        : '订单已创建，暂未返回收款地址，请点击下方「刷新订单状态」。';
    } else if (order.status === 'expired') {
      const warn = document.createElement('p');
      warn.className = 'checkout-dialog__hint';
      warn.textContent = '这笔原订单的扫码窗口已超时。若尚未付款，点下方按钮直接重新生成付款码；若已付过款，点“立即查账”。';
      content.append(warn);

      const resumeBtn = document.createElement('button');
      resumeBtn.type = 'button';
      resumeBtn.className = 'button checkout-dialog__link';
      resumeBtn.textContent = '我尚未付款 · 重新生成二维码';
      resumeBtn.addEventListener('click', async () => {
        resumeBtn.disabled = true;
        resumeBtn.textContent = '正在刷新付款码…';
        try {
          const updated = await api('/account/api/orders/' + encodeURIComponent(order.id) + '/resume-payment', {
            method: 'POST',
            body: JSON.stringify({ confirmed_unpaid: true })
          });
          renderOrder(resolvedSku, updated);
          startPolling(resolvedSku, updated);
        } catch (err) {
          statusEl.textContent = err.message;
          resumeBtn.disabled = false;
          resumeBtn.textContent = '我尚未付款 · 重新生成二维码';
        }
      });
      content.append(resumeBtn);
      if (isFreeReceipt) appendReceiptClaimForm(content, resolvedSku, order, statusEl);
      statusEl.textContent = '未付请点上面重新出码，已付请点下方刷新查账。';
      stopPolling();
    } else if (order.status === 'payment_unknown') {
      const hint = document.createElement('p');
      hint.className = 'checkout-dialog__hint';
      hint.textContent = '正在核对上游收银台回调。如果你刚才已完成付款，请勿重复扫码，点下面「立即核对到账状态」或稍等数秒自动更新。';
      content.append(hint);

      if (order.qrcode_base64 || cashier) {
        const fold = document.createElement('details');
        fold.className = 'checkout-dialog__fold';
        const sum = document.createElement('summary');
        sum.textContent = '如果刚才没来得及付款？点此展开原订单二维码';
        fold.append(sum);
        const warn = document.createElement('p');
        warn.className = 'checkout-dialog__hint';
        warn.textContent = '警告：若手机端显示已扣款千万不要再扫！先刷新核对，未付款才可继续扫码。';
        fold.append(warn);
        appendQrBlock(fold, order, cashier, true);
        if (cashier) appendCashierExtras(fold, cashier);
        content.append(fold);
      }
      statusEl.textContent = '支付结果确认中（单号 ' + order.id + '），正在自动查账…';
    } else if (order.status === 'paid_awaiting_stock') {
      view.querySelector('#checkout-dialog-title').textContent = titleFor(resolvedSku) + ' · 已收到付款';
      statusEl.textContent = '已确认收到你的付款，时长正在发放队列中；稍后点刷新或进入账户中心即可看到余额。';
      stopPolling();
    } else if (order.status === 'paid') {
      clearSkuSessionKey(resolvedSku);
      view.querySelector('#checkout-dialog-title').textContent = titleFor(resolvedSku) + ' · 已到账';
      statusEl.textContent = '付款已核验！如为新版 V9 时长包，进入账户中心点一次「激活并加入时长池」，同账号登录电脑客户端即可立刻开始用。';
      if (order.authorization_code) {
        const codeBox = document.createElement('input');
        codeBox.readOnly = true;
        codeBox.value = order.authorization_code;
        codeBox.setAttribute('aria-label', '授权码');
        content.append(codeBox);
      }
      stopPolling();
    } else if (order.status === 'cancelled') {
      clearSkuSessionKey(resolvedSku);
      statusEl.textContent = '该订单已关闭取消，请关闭此窗后重新点击购买即可开新单。';
      stopPolling();
    } else {
      statusEl.textContent = '订单当前状态：' + order.status + '，请点下面刷新核对或去账户中心查看。';
    }

    if (order.status !== 'paid' && order.status !== 'cancelled') {
      const refresh = document.createElement('button');
      refresh.type = 'button';
      refresh.className = order.status === 'payment_unknown' || order.status === 'paid_awaiting_stock'
        ? 'button checkout-dialog__link'
        : 'checkout-dialog__refresh';
      refresh.textContent = order.status === 'payment_unknown' || order.status === 'paid_awaiting_stock'
        ? '我已付款 · 立即核对到账'
        : '刷新订单状态';
      refresh.addEventListener('click', async () => {
        refresh.disabled = true;
        try {
          const updated = await api('/account/api/orders/' + encodeURIComponent(order.id) + '/refresh', { method: 'POST', body: '{}' });
          renderOrder(resolvedSku, updated);
          if (updated.status === 'pending') startPolling(resolvedSku, updated);
        } catch (error) {
          statusEl.textContent = error.message;
        } finally {
          refresh.disabled = false;
        }
      });
      content.append(refresh);
    }

    const account = document.createElement('a');
    account.className = order.status === 'paid' ? 'button checkout-dialog__link' : 'checkout-dialog__account';
    account.href = API + '/account';
    account.textContent = order.status === 'paid' ? '去账户中心激活并使用' : '去账户中心管理全部订单';
    content.append(account);
  }

  function startPolling(sku, order) {
    stopPolling();
    if (!['pending', 'payment_unknown', 'paid_awaiting_stock'].includes(order.status)) return;
    let attempts = 0;
    const maxAttempts = order.status === 'pending' ? 60 : 12;
    pollTimer = window.setInterval(async () => {
      if (!modal?.open || !activeOrder || activeOrder.id !== order.id || attempts >= maxAttempts) {
        stopPolling();
        return;
      }
      attempts += 1;
      try {
        const updated = await api('/account/api/orders/' + encodeURIComponent(order.id) + '/refresh', { method: 'POST', body: '{}' });
        if (updated.status !== activeOrder?.status || updated.qrcode_base64 !== activeOrder?.qrcode_base64 || updated.cashier_url !== activeOrder?.cashier_url) {
          renderOrder(sku, updated);
          if (!['pending', 'payment_unknown', 'paid_awaiting_stock'].includes(updated.status)) stopPolling();
        }
      } catch (_) {}
    }, 5000);
  }

  function requestId(accountId, sku) {
    const key = 'tbox-purchase-' + accountId + '-' + sku;
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(key, id);
    }
    return id;
  }

  function findOpenOrder(ordersList, targetSku) {
    const list = Array.isArray(ordersList) ? ordersList : [];
    const priority = ['pending', 'paid_awaiting_stock', 'payment_unknown', 'pending_review', 'expired'];
    for (const st of priority) {
      const hit = list.find(o => o.sku === targetSku && o.status === st);
      if (hit) return hit;
    }
    return null;
  }

  function findAnyOpenOrder(ordersList) {
    const list = Array.isArray(ordersList) ? ordersList : [];
    const priority = ['pending', 'paid_awaiting_stock', 'payment_unknown', 'pending_review', 'expired'];
    for (const st of priority) {
      const hit = list.find(o => o.status === st);
      if (hit) return hit;
    }
    return null;
  }

  async function beginCheckout(sku, link) {
    if (!sku || link.dataset.checkoutBusy === 'true') return;
    if (link.dataset.skuUnavailable === 'true' || link.getAttribute('aria-disabled') === 'true') {
      const target = document.getElementById('compare-hours') || document.getElementById('home-plans');
      if (target) target.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    link.dataset.checkoutBusy = 'true';
    link.setAttribute('aria-busy', 'true');
    const originalText = link.textContent;
    link.textContent = '正在打开收银台…';
    try {
      const user = await readSession();
      if (!user) {
        sessionStorage.setItem(pendingKey, sku);
        const returnUrl = new URL(window.location.href);
        returnUrl.searchParams.set('checkout_sku', sku);
        window.location.assign(API + '/account?return_to=' + encodeURIComponent(returnUrl.href));
        return;
      }

      openModal(sku, '正在拉取订单与二维码…');
      const orders = await api('/account/api/orders');
      const existing = findOpenOrder(orders.orders, sku);
      if (existing) {
        renderOrder(sku, existing);
        startPolling(sku, existing);
        return;
      }

      const config = await fetchConfig() || await api('/account/api/config');
      const spec = (config.catalog?.domestic || []).find(item => item.id === sku);
      if (!spec?.purchasing_open) {
        const view = openModal(sku, '');
        view.querySelector('[data-checkout-status]').textContent = '该套餐当前暂未开放线上购买，请选购其他开放时长包。';
        return;
      }

      const key = 'tbox-purchase-' + user.account_id + '-' + sku;
      const prior = sessionStorage.getItem(key + ':order');
      if (prior && (orders.orders || []).some(o => o.id === prior && ['paid', 'cancelled', 'expired'].includes(o.status))) {
        sessionStorage.removeItem(key);
        sessionStorage.removeItem(key + ':order');
      }

      const order = await api('/account/api/orders', {
        method: 'POST',
        body: JSON.stringify({ sku, request_id: requestId(user.account_id, sku) })
      });
      if (order.id) sessionStorage.setItem(key + ':order', order.id);
      renderOrder(sku, order);
      startPolling(sku, order);
    } catch (error) {
      const msg = String(error?.message || '');
      if (error.status === 409 || /原订单|恢复|重复|未完成|pending|expired/i.test(msg)) {
        try {
          const freshOrders = await api('/account/api/orders');
          const stuck = findOpenOrder(freshOrders.orders, sku) || findAnyOpenOrder(freshOrders.orders);
          if (stuck) {
            renderOrder(sku, stuck, '你账户下有一笔尚未完结的原订单，已直接为你打开处理（不用另找入口）：');
            startPolling(stuck.sku || sku, stuck);
            return;
          }
        } catch (_) {}
      }
      const view = openModal(sku, '');
      view.querySelector('[data-checkout-status]').textContent = msg || '创建订单时出现异常，请去账户中心核对。';
      const content = view.querySelector('[data-checkout-content]');
      const acc = document.createElement('a');
      acc.className = 'checkout-dialog__account';
      acc.href = API + '/account';
      acc.textContent = '去账户中心查看订单状态';
      content.append(acc);
    } finally {
      link.dataset.checkoutBusy = 'false';
      link.removeAttribute('aria-busy');
      link.textContent = (link.dataset.skuUnavailable === 'true') ? '当前暂未开放' : (link.dataset.checkoutLabel || originalText);
    }
  }

  async function syncCatalogAvailability() {
    const config = await fetchConfig();
    const list = config?.catalog?.domestic;
    if (!Array.isArray(list)) return;

    const map = new Map(list.map(item => [item.id, item]));
    document.querySelectorAll('.offer-card[data-sku]').forEach(card => {
      const spec = map.get(card.dataset.sku);
      if (!spec || spec.purchasing_open !== false) return;

      card.dataset.skuClosed = 'true';
      card.classList.add('offer-card--unavailable');
      const tag = card.querySelector('.offer-tag, .ed-plan-tag');
      if (tag) tag.textContent = '暂未开放';
      const btn = card.querySelector('[data-account-checkout]');
      if (btn) {
        btn.dataset.skuUnavailable = 'true';
        btn.setAttribute('aria-disabled', 'true');
        btn.removeAttribute('href');
        btn.textContent = '暂未开放（请选 ¥20 / 1 小时起步）';
      }
    });
  }

  function bind() {
    const links = [...document.querySelectorAll('[data-account-checkout]')];
    links.forEach(link => {
      const card = link.closest('[data-sku]');
      const sku = card?.dataset.sku;
      if (!sku) return;
      link.addEventListener('click', event => {
        event.preventDefault();
        void beginCheckout(sku, link);
      });
    });

    void syncCatalogAvailability();

    const querySku = new URLSearchParams(window.location.search).get('checkout_sku') || sessionStorage.getItem(pendingKey);
    if (querySku && links.some(link => link.closest('[data-sku]')?.dataset.sku === querySku)) {
      sessionStorage.removeItem(pendingKey);
      const target = links.find(link => link.closest('[data-sku]')?.dataset.sku === querySku);
      void beginCheckout(querySku, target);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
})();
