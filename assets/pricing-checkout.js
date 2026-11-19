(() => {
  'use strict';

  const API = 'https://api.tboxapp.top';
  const pendingKey = 'tbox-pending-checkout-sku';
  let modal = null;
  let pollTimer = null;
  let activeOrder = null;

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

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

  function cardFor(sku) {
    return document.querySelector('.offer-card[data-sku="' + sku + '"]');
  }

  function titleFor(sku) {
    return cardFor(sku)?.querySelector('h3')?.textContent?.trim() || '这份云时长';
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
          <span class="checkout-dialog__eyebrow">TBOX 快码支付</span>
          <h2 id="checkout-dialog-title"></h2>
          <div class="checkout-dialog__content" data-checkout-content></div>
          <p class="checkout-dialog__status" data-checkout-status role="status" aria-live="polite"></p>
        </div>
      </form>`;
    (document.querySelector('.pass-preview') || document.body).append(modal);
    modal.addEventListener('close', () => {
      if (pollTimer) window.clearInterval(pollTimer);
      pollTimer = null;
      activeOrder = null;
    });
    return modal;
  }

  function openModal(sku, status = '正在确认账户与订单状态…') {
    const view = ensureModal();
    view.querySelector('#checkout-dialog-title').textContent = '购买 ' + titleFor(sku);
    view.querySelector('[data-checkout-content]').replaceChildren();
    view.querySelector('[data-checkout-status]').textContent = status;
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

  function renderOrder(sku, order) {
    const view = openModal(sku);
    const content = view.querySelector('[data-checkout-content]');
    const status = view.querySelector('[data-checkout-status]');
    content.replaceChildren();
    activeOrder = order;

    const amount = document.createElement('p');
    amount.className = 'checkout-dialog__amount';
    amount.textContent = money(order.amount_cents);
    content.append(amount);

    const qrMime = order.image_mime || 'image/png';
    if (order.status === 'pending' && order.qrcode_base64 && ['image/png', 'image/jpeg'].includes(qrMime)) {
      const image = document.createElement('img');
      image.className = 'checkout-dialog__qr';
      image.alt = '本订单动态付款二维码';
      image.src = 'data:' + qrMime + ';base64,' + order.qrcode_base64;
      content.append(image);
      const hint = document.createElement('p');
      hint.className = 'checkout-dialog__hint';
      hint.textContent = '用微信扫一扫，核对本单金额后付款。';
      content.append(hint);
    }
    let cashier;
    try {
      const url = new URL(order.cashier_url);
      if (url.origin === 'https://km.iu99.top' && !url.username && !url.password) cashier = url.href;
    } catch (_) {}
    if (cashier && order.status === 'pending') {
      const link = document.createElement('a');
      link.className = 'button checkout-dialog__link';
      link.href = cashier;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = '打开快码收银台';
      content.append(link);
      const hint = document.createElement('p');
      hint.className = 'checkout-dialog__hint';
      hint.textContent = '若提示使用系统浏览器，请复制本单链接，粘贴到手机的 Safari 或系统浏览器。无需重新下单。';
      const copy = document.createElement('button');
      copy.type = 'button';
      copy.className = 'checkout-dialog__refresh';
      copy.textContent = '复制本单付款链接';
      copy.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(cashier);
          copy.textContent = '已复制本单链接';
        } catch (_) {
          if (content.querySelector('input[readonly]')) return;
          const field = document.createElement('input');
          field.readOnly = true;
          field.value = cashier;
          field.setAttribute('aria-label', '本单付款链接，可长按复制');
          content.append(field);
          field.focus(); field.select();
          copy.textContent = '请长按下方链接复制';
        }
      });
      content.append(copy, hint);
    }

    if (order.status === 'paid') {
      status.textContent = '付款已核验，权益已记入账户。';
      stopPolling();
    } else if (order.status === 'paid_awaiting_stock') {
      view.querySelector('#checkout-dialog-title').textContent = titleFor(sku) + ' · 已付款';
      status.textContent = '已收到付款，面试时长正在等待到账。请勿重复付款，可刷新原订单查看进度。';
      stopPolling();
    } else if (order.status === 'pending' && order.qrcode_base64) {
      status.textContent = '二维码有效期内可直接付款；页面会自动刷新订单状态。';
    } else if (order.status === 'pending') {
      status.textContent = '订单已创建，但暂未返回二维码。请在账户中心刷新原订单，不要重复下单。';
    } else if (order.status === 'expired') {
      status.textContent = '该订单付款窗口已结束，请到账户中心查看原订单。';
      stopPolling();
    } else if (order.status === 'cancelled') {
      status.textContent = '该订单已取消，请勿继续付款。';
      stopPolling();
    } else {
      status.textContent = '订单状态：' + order.status + '。请到账户中心核对原订单。';
    }

    const refresh = document.createElement('button');
    refresh.type = 'button';
    refresh.className = 'checkout-dialog__refresh';
    refresh.textContent = '刷新订单状态';
    refresh.addEventListener('click', async () => {
      refresh.disabled = true;
      try {
        const updated = await api('/account/api/orders/' + encodeURIComponent(order.id) + '/refresh', { method: 'POST', body: '{}' });
        renderOrder(sku, updated);
      } catch (error) {
        status.textContent = error.message;
      } finally {
        refresh.disabled = false;
      }
    });
    content.append(refresh);
    if (order.status === 'paid') {
      const account = document.createElement('a');
      account.className = 'checkout-dialog__account';
      account.href = API + '/account';
      account.textContent = '进入账户中心查看权益';
      content.append(account);
    }
  }

  function startPolling(sku, order) {
    stopPolling();
    if (order.status !== 'pending') return;
    let attempts = 0;
    pollTimer = window.setInterval(async () => {
      if (!modal?.open || !activeOrder || activeOrder.id !== order.id || attempts >= 60) {
        stopPolling();
        return;
      }
      attempts += 1;
      try {
        const updated = await api('/account/api/orders/' + encodeURIComponent(order.id) + '/refresh', { method: 'POST', body: '{}' });
        // A status-only poll must not reset a copy action or a selected link.
        if (updated.status !== activeOrder?.status || updated.qrcode_base64 !== activeOrder?.qrcode_base64 || updated.cashier_url !== activeOrder?.cashier_url) renderOrder(sku, updated);
      } catch (_) {
        // The server enforces a five-second per-order refresh cooldown; a later tick retries.
      }
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

  async function beginCheckout(sku, link) {
    if (!sku || link.dataset.checkoutBusy === 'true') return;
    link.dataset.checkoutBusy = 'true';
    link.setAttribute('aria-busy', 'true');
    const originalText = link.textContent;
    link.textContent = '正在创建订单…';
    try {
      const user = await readSession();
      if (!user) {
        sessionStorage.setItem(pendingKey, sku);
        const returnUrl = new URL(window.location.href);
        returnUrl.searchParams.set('checkout_sku', sku);
        window.location.assign(API + '/account?return_to=' + encodeURIComponent(returnUrl.href));
        return;
      }

      openModal(sku, '正在查找本账户的原订单…');
      const orders = await api('/account/api/orders');
      const existing = (orders.orders || []).find(order => order.sku === sku && ['pending', 'payment_unknown', 'paid_awaiting_stock'].includes(order.status));
      if (existing) {
        renderOrder(sku, existing);
        startPolling(sku, existing);
        return;
      }

      const config = await api('/account/api/config');
      const spec = (config.catalog?.domestic || []).find(item => item.id === sku);
      if (!spec?.purchasing_open) {
        const view = openModal(sku, '');
        view.querySelector('[data-checkout-status]').textContent = '该套餐当前没有可用库存或尚未开放付款，服务端没有创建支付单。请稍后重试或到账户中心查看原订单。';
        return;
      }

      const key = 'tbox-purchase-' + user.account_id + '-' + sku;
      // Recover ambiguous requests with the same ID. A confirmed terminal
      // order is not a retry and must not trap the next purchase in this tab.
      const prior = sessionStorage.getItem(key + ':order');
      if (prior && (orders.orders || []).some(o => o.id === prior && ['paid', 'cancelled'].includes(o.status))) {
        sessionStorage.removeItem(key);
        sessionStorage.removeItem(key + ':order');
      }
      let order = await api('/account/api/orders', {
        method: 'POST',
        body: JSON.stringify({ sku, request_id: requestId(user.account_id, sku) })
      });
      if (!prior && ['paid', 'cancelled'].includes(order.status)) {
        // A legacy tab can have an old request ID but no saved order ID.
        // Never auto-submit again; the user can intentionally start a new order.
        sessionStorage.removeItem(key);
      }
      if (order.id) sessionStorage.setItem(key + ':order', order.id);
      renderOrder(sku, order);
      startPolling(sku, order);
    } catch (error) {
      const view = openModal(sku, '');
      view.querySelector('[data-checkout-status]').textContent = error.message;
    } finally {
      link.dataset.checkoutBusy = 'false';
      link.removeAttribute('aria-busy');
      link.textContent = link.dataset.checkoutLabel || originalText;
    }
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
