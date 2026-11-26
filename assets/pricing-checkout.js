(() => {
  'use strict';

  const API = 'https://api.tboxapp.top';
  const pendingKey = 'tbox-pending-checkout-sku';
  const LIVE_STATUSES = ['pending', 'paid_awaiting_stock', 'payment_unknown', 'pending_review'];
  const REQUEST_TIMEOUT_MS = 12000;
  let modal = null;
  let pollTimer = null;
  let countdownTimer = null;
  let activeOrder = null;
  let cachedConfig = null;
  let serverCancelUnsupported = false;
  const recentRefreshAt = new Map();

  async function api(path, init = {}) {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(API + path, {
        credentials: 'include',
        mode: 'cors',
        cache: 'no-store',
        signal: ctrl.signal,
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
        error.data = data;
        throw error;
      }
      return data;
    } catch (err) {
      if (err?.name === 'AbortError') {
        const timeoutErr = new Error('连接收银台超时，请检查网络或刷新后再试。');
        timeoutErr.status = 408;
        throw timeoutErr;
      }
      throw err;
    } finally {
      window.clearTimeout(timer);
    }
  }

  async function readSession() {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(API + '/account/api/session', {
        credentials: 'include', mode: 'cors', cache: 'no-store', signal: ctrl.signal
      });
      if (response.status === 401) return null;
      if (!response.ok) throw new Error('暂时无法确认登录状态，请稍后重试。');
      return response.json();
    } catch (err) {
      if (err?.name === 'AbortError') throw new Error('确认登录状态超时，请刷新后重试。');
      throw err;
    } finally {
      window.clearTimeout(timer);
    }
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

  const SKU_FALLBACK_NAMES = {
    tbox_trial_5m_10c_v7: '5 分钟体验（¥0.10）',
    tbox_day_1h_v9: '1 小时时长包',
    tbox_day_2h_v9: '2 小时时长包',
    tbox_day_3h_v9: '3 小时时长包',
    tbox_month_6h_v9: '6 小时标准包',
    tbox_quarter_15h_v9: '15 小时主力包',
    tbox_year_36h_v9: '36 小时全年包'
  };

  function cardFor(sku) {
    return document.querySelector('.offer-card[data-sku="' + sku + '"]');
  }

  function titleFor(sku) {
    return cardFor(sku)?.querySelector('h3')?.textContent?.trim() || SKU_FALLBACK_NAMES[sku] || '所选云时长包';
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

  function remainingSeconds(order) {
    if (!order?.payment_expires_at) return null;
    const end = Date.parse(order.payment_expires_at);
    if (!Number.isFinite(end)) return null;
    return Math.max(0, Math.floor((end - Date.now()) / 1000));
  }

  function isOrderWindowEnded(order) {
    if (!order) return false;
    if (order.status === 'expired') return true;
    if (order.status === 'pending' && order.payment_expires_at) {
      const left = remainingSeconds(order);
      return left !== null && left <= 0;
    }
    return false;
  }

  function formatDuration(sec) {
    const s = Math.max(0, Math.floor(Number(sec) || 0));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return String(m).padStart(2, '0') + ':' + String(r).padStart(2, '0');
  }

  function stopPolling() {
    if (pollTimer) window.clearInterval(pollTimer);
    pollTimer = null;
  }

  function stopCountdown() {
    if (countdownTimer) window.clearInterval(countdownTimer);
    countdownTimer = null;
  }

  function stopTimers() {
    stopPolling();
    stopCountdown();
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
      stopTimers();
      activeOrder = null;
    });
    return modal;
  }

  function openModal(sku, statusText = '正在核对账户与订单状态…') {
    stopTimers();
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

  function setModalAlert(content, statusEl, message) {
    if (!message) return;
    if (statusEl) statusEl.textContent = message;
    if (!content) return;
    let alert = content.querySelector('.checkout-dialog__notice');
    if (!alert) {
      alert = document.createElement('p');
      alert.className = 'checkout-dialog__notice';
      content.prepend(alert);
    }
    alert.textContent = message;
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

  function clearAccountSessionKeys(accountId) {
    if (!accountId) return;
    try {
      const prefix = 'tbox-purchase-' + accountId + '-';
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith(prefix)) sessionStorage.removeItem(k);
      }
    } catch (_) {}
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

  async function tryRefreshOrder(orderId, respectCooldown = true) {
    if (!orderId) return null;
    const nowMs = Date.now();
    const lastMs = recentRefreshAt.get(orderId) || 0;
    if (respectCooldown && nowMs - lastMs < 5200) {
      return { _skippedCooldown: true };
    }
    try {
      recentRefreshAt.set(orderId, nowMs);
      return await api('/account/api/orders/' + encodeURIComponent(orderId) + '/refresh', {
        method: 'POST',
        body: '{}'
      });
    } catch (err) {
      return { _refreshError: err };
    }
  }

  async function tryCancelOrder(orderId, reason, forceProbe = false) {
    if (!orderId) return { cancelled: false, unsupported: true };
    if (serverCancelUnsupported && !forceProbe) {
      return { cancelled: false, unsupported: true };
    }
    try {
      const updated = await api('/account/api/orders/' + encodeURIComponent(orderId) + '/cancel', {
        method: 'POST',
        body: JSON.stringify({ confirmed_unpaid: true, reason: reason || 'customer_recreate' })
      });
      serverCancelUnsupported = false;
      return { cancelled: updated?.status === 'cancelled', order: updated };
    } catch (err) {
      if (err.status === 404 || err.status === 405) {
        serverCancelUnsupported = true;
        return { cancelled: false, unsupported: true, error: err };
      }
      return { cancelled: false, unsupported: false, error: err };
    }
  }

  async function createFreshOrder(accountId, sku, forceNewKey = true) {
    if (forceNewKey) clearSkuSessionKey(sku);
    const key = 'tbox-purchase-' + accountId + '-' + sku;
    const order = await api('/account/api/orders', {
      method: 'POST',
      body: JSON.stringify({ sku, request_id: requestId(accountId, sku) })
    });
    if (order?.id) sessionStorage.setItem(key + ':order', order.id);
    return order;
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

  function appendReceiptClaimForm(content, sku, order, statusEl, extra = {}) {
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
        renderOrder(sku, updated, extra);
      } catch (err) {
        statusEl.textContent = err.message;
        btn.disabled = false;
      }
    });
    form.append(input, btn);
    content.append(form);
  }

  function startCountdown(order, timerEl, onWindowEnd) {
    stopCountdown();
    const initial = remainingSeconds(order);
    if (initial === null) return;
    let fired = false;
    const update = () => {
      const left = remainingSeconds(order);
      if (left === null) return;
      if (left <= 0) {
        timerEl.textContent = '已满 5 分钟（00:00），正在自动切换新单…';
        stopCountdown();
        if (!fired && typeof onWindowEnd === 'function') {
          fired = true;
          void onWindowEnd();
        }
        return;
      }
      timerEl.textContent = '5 分钟有效 · 到期自动切换还剩 ' + formatDuration(left);
    };
    update();
    countdownTimer = window.setInterval(update, 1000);
  }

  async function abandonAndRecreate(targetSku, accountId, stuckOrder, statusEl, contentEl) {
    setModalAlert(contentEl, statusEl, '正在向支付通道核对原单是否未付款…');
    const refreshed = await tryRefreshOrder(stuckOrder.id, true);
    const current = refreshed && !refreshed._refreshError && !refreshed._skippedCooldown ? refreshed : stuckOrder;
    if (current.status === 'paid') {
      renderOrder(current.sku || targetSku, current, { customNotice: '刚才那笔原订单实际已完成付款，已为你加载到账详情：' });
      return true;
    }

    if (current.status !== 'cancelled') {
      setModalAlert(contentEl, statusEl, '确认未付款，正在关闭原单并准备新二维码…');
      const cancelRes = await tryCancelOrder(
        current.id,
        targetSku !== current.sku ? 'switch_sku' : 'recreate_expired',
        true
      );
      if (cancelRes.order?.status === 'paid') {
        renderOrder(current.sku || targetSku, cancelRes.order, { customNotice: '检测到原单已付款到账，未重复创建新单：' });
        return true;
      }
      if (!cancelRes.cancelled) {
        if (cancelRes.unsupported) {
          const left = remainingSeconds(current);
          const tip = left !== null && left > 0
            ? '当前后台（api.tboxapp.top）暂未更新主动关单接口（/cancel 返回 404），因此还无法提前作废未付单，需等待这单倒计时结束并在服务端升级后自动出新码。'
            : '原单已超过 5 分钟，但当前线上后台（api.tboxapp.top）尚未更新自动关单补丁（/cancel 返回 404），后台仍在锁定旧单不让建新单，需先更新服务端。';
          setModalAlert(contentEl, statusEl, tip);
        } else {
          setModalAlert(contentEl, statusEl, cancelRes.error?.message || '原订单关闭前核验暂未成功，请点下方核对到账状态。');
        }
        return false;
      }
    }

    clearAccountSessionKeys(accountId);
    const freshOrder = await createFreshOrder(accountId, targetSku, true);
    renderOrder(targetSku, freshOrder, { accountId, targetSku, customNotice: '已自动关闭未付款旧单，并为你切换出全新付款二维码：' });
    startPolling(targetSku, freshOrder, { accountId, targetSku });
    return true;
  }

  function renderOrder(sku, order, options = {}) {
    const resolvedSku = order.sku || sku;
    const targetSku = options.targetSku || resolvedSku;
    const accountId = options.accountId || '';
    const customNotice = options.customNotice || '';

    const view = openModal(resolvedSku);
    const titleEl = view.querySelector('#checkout-dialog-title');
    const content = view.querySelector('[data-checkout-content]');
    const statusEl = view.querySelector('[data-checkout-status]');
    content.replaceChildren();
    activeOrder = order;

    const windowEnded = isOrderWindowEnded(order);
    const effectiveStatus = (order.status === 'pending' && windowEnded) ? 'expired' : order.status;
    titleEl.textContent = '购买 ' + titleFor(resolvedSku);

    if (customNotice) {
      setModalAlert(content, statusEl, customNotice);
    }

    const payCents = Number(order.payable_cents || order.amount_cents || 0);
    const amount = document.createElement('p');
    amount.className = 'checkout-dialog__amount';
    amount.textContent = money(payCents);
    content.append(amount);

    if (order.status === 'pending' && payCents !== Number(order.amount_cents || 0)) {
      const floatNote = document.createElement('p');
      floatNote.className = 'checkout-dialog__notice';
      floatNote.textContent = '防撞单核账提示：本单请严格按上方实付金额 ' + money(payCents) + ' 输入付款（勿多付或少付 1 分钱，以便系统 5 秒内自动识别发卡）。';
      content.append(floatNote);
    }

    if (order.id) {
      const oid = document.createElement('p');
      oid.className = 'checkout-dialog__orderid';
      oid.textContent = '订单号：' + order.id;
      content.append(oid);
    }

    const cashier = order.native_qr ? null : safeUrl(order.cashier_url);
    const isFreeReceipt = order.payment_channel === 'free_receipt';

    if (effectiveStatus === 'pending') {
      if (order.payment_expires_at) {
        const timerBadge = document.createElement('p');
        timerBadge.className = 'checkout-dialog__timer';
        content.append(timerBadge);
        startCountdown(order, timerBadge, async () => {
          const updated = await tryRefreshOrder(order.id, false);
          const current = updated && !updated._refreshError ? updated : { ...order, status: 'expired' };
          if (current.status === 'paid') {
            renderOrder(resolvedSku, current, { ...options, targetSku, accountId });
            return;
          }
          if (!isFreeReceipt) {
            const acct = accountId || (await readSession().catch(() => null))?.account_id;
            if (acct) {
              try {
                const switched = await abandonAndRecreate(targetSku, acct, current, statusEl, content);
                if (switched) return;
              } catch (_) {}
            }
          }
          renderOrder(resolvedSku, current.status === 'cancelled' ? current : { ...current, status: 'expired' }, { ...options, targetSku, accountId });
        });
      }

      const hasQr = appendQrBlock(content, order, cashier, true);
      if (hasQr) {
        const hint = document.createElement('p');
        hint.className = 'checkout-dialog__hint';
        hint.textContent = order.native_qr
          ? '打开手机微信「扫一扫」识别上方原生收款码，输入实付金额 ' + money(payCents) + ' 即可付款（无需跳外部网页，付完约 5 秒自动发卡）。'
          : order.qrcode_base64
          ? '请用微信扫一扫上方二维码完成支付，金额以 ' + money(payCents) + ' 为准，到账后自动刷新。'
          : '用手机微信 / 支付宝 / 系统相机扫一扫上方二维码即可支付。';
        content.append(hint);
      }
      if (cashier) appendCashierExtras(content, cashier);
      if (isFreeReceipt) appendReceiptClaimForm(content, resolvedSku, order, statusEl, options);

      if (accountId && targetSku && resolvedSku !== targetSku && !isFreeReceipt) {
        const switchBtn = document.createElement('button');
        switchBtn.type = 'button';
        switchBtn.className = 'checkout-dialog__abandon';
        const switchLabel = '放弃这笔未付订单，改买「' + titleFor(targetSku) + '」';
        switchBtn.textContent = switchLabel;
        switchBtn.addEventListener('click', async () => {
          switchBtn.disabled = true;
          switchBtn.textContent = '正在核对并切换下单…';
          try {
            await abandonAndRecreate(targetSku, accountId, order, statusEl, content);
          } catch (err) {
            setModalAlert(content, statusEl, err.message || '切换失败，请稍后重试。');
          } finally {
            if (switchBtn.isConnected) {
              switchBtn.disabled = false;
              switchBtn.textContent = switchLabel;
            }
          }
        });
        content.append(switchBtn);
      }

      statusEl.textContent = hasQr
        ? '二维码有效，扫完付款后每 5 秒自动查账；过 5 分钟未付将尝试自动切换新单。'
        : '订单已创建，收银台地址正在返回中，请点下方「刷新订单状态」。';
    } else if (effectiveStatus === 'expired') {
      stopPolling();
      clearSkuSessionKey(resolvedSku);
      const warn = document.createElement('p');
      warn.className = 'checkout-dialog__hint';
      warn.textContent = isFreeReceipt
        ? '该收款窗口已过 5 分钟有效期。若尚未扫码付款，点下方延长付款窗口；若已付款请填写交易单号核验。'
        : '这笔原订单已超过 5 分钟有效窗口。若确认未扣款，点下方重新关闭旧单并生成新二维码；若刚付过款，先点「我已付款 · 立即核对到账」。';
      content.append(warn);

      if (isFreeReceipt) {
        const resumeBtn = document.createElement('button');
        resumeBtn.type = 'button';
        resumeBtn.className = 'button checkout-dialog__link';
        resumeBtn.textContent = '我尚未付款 · 重新生成二维码';
        resumeBtn.addEventListener('click', async () => {
          resumeBtn.disabled = true;
          resumeBtn.textContent = '正在延长付款窗口…';
          try {
            const updated = await api('/account/api/orders/' + encodeURIComponent(order.id) + '/resume-payment', {
              method: 'POST',
              body: JSON.stringify({ confirmed_unpaid: true })
            });
            renderOrder(resolvedSku, updated, options);
            startPolling(resolvedSku, updated, options);
          } catch (err) {
            statusEl.textContent = err.message;
          } finally {
            if (resumeBtn.isConnected) {
              resumeBtn.disabled = false;
              resumeBtn.textContent = '我尚未付款 · 重新生成二维码';
            }
          }
        });
        content.append(resumeBtn);
        appendReceiptClaimForm(content, resolvedSku, order, statusEl, options);
      } else {
        const recreateBtn = document.createElement('button');
        recreateBtn.type = 'button';
        recreateBtn.className = 'button checkout-dialog__link';
        const recreateLabel = '重试：关闭过期旧单并出「' + titleFor(targetSku) + '」新二维码';
        recreateBtn.textContent = recreateLabel;
        recreateBtn.addEventListener('click', async () => {
          recreateBtn.disabled = true;
          recreateBtn.textContent = '正在核验旧单并尝试出新码…';
          try {
            const acct = accountId || (await readSession())?.account_id;
            if (!acct) throw new Error('登录状态已过期，请先重新登录。');
            await abandonAndRecreate(targetSku, acct, order, statusEl, content);
          } catch (err) {
            setModalAlert(content, statusEl, err.message || '重新建单未成功，请先点击下方核对到账状态。');
          } finally {
            if (recreateBtn.isConnected) {
              recreateBtn.disabled = false;
              recreateBtn.textContent = recreateLabel;
            }
          }
        });
        content.append(recreateBtn);
      }
      if (!customNotice) {
        statusEl.textContent = '重开前会先向支付通道核实这笔单确实没扣款，防止重复下单。';
      }
    } else if (effectiveStatus === 'payment_unknown') {
      const hint = document.createElement('p');
      hint.className = 'checkout-dialog__hint';
      hint.textContent = '正在向上游收银台核对订单状态。如果你刚才已完成付款，请勿重复扫码，等待几秒或点「我已付款 · 立即核对到账」。';
      content.append(hint);

      if (order.qrcode_base64 || cashier) {
        const fold = document.createElement('details');
        fold.className = 'checkout-dialog__fold';
        const sum = document.createElement('summary');
        sum.textContent = '刚才没来得及付款？展开确认未扣款后继续扫码';
        fold.append(sum);
        const warn = document.createElement('p');
        warn.className = 'checkout-dialog__hint';
        warn.textContent = '警告：若手机端显示已扣款千万不要再扫！先刷新核对，未扣款才可继续支付。';
        fold.append(warn);
        appendQrBlock(fold, order, cashier, true);
        if (cashier) appendCashierExtras(fold, cashier);
        content.append(fold);
      }
      statusEl.textContent = '支付结果确认中（单号 ' + order.id + '），正在自动查账…';
    } else if (effectiveStatus === 'paid_awaiting_stock') {
      titleEl.textContent = titleFor(resolvedSku) + ' · 已收到付款';
      statusEl.textContent = '已确认收到你的付款，时长正在发放队列中；稍后点刷新或进入账户中心即可看到余额。';
      stopTimers();
    } else if (effectiveStatus === 'paid') {
      clearSkuSessionKey(resolvedSku);
      titleEl.textContent = titleFor(resolvedSku) + ' · 已到账';
      statusEl.textContent = '付款已核验！进入账户中心点击一次「激活并加入时长池」，同一账号登录电脑端 TBOX 即可立刻开始使用。';
      if (order.authorization_code) {
        const codeBox = document.createElement('input');
        codeBox.readOnly = true;
        codeBox.value = order.authorization_code;
        codeBox.setAttribute('aria-label', '授权码');
        content.append(codeBox);
      }
      stopTimers();
    } else if (effectiveStatus === 'cancelled') {
      clearSkuSessionKey(resolvedSku);
      titleEl.textContent = '原订单已超时或取消';
      statusEl.textContent = '该未付款原订单已彻底关闭（未扣款），可以直接点下方按钮重新下单付款。';
      const retryBtn = document.createElement('button');
      retryBtn.type = 'button';
      retryBtn.className = 'button checkout-dialog__link';
      const retryLabel = '重新购买「' + titleFor(targetSku) + '」生成新二维码';
      retryBtn.textContent = retryLabel;
      retryBtn.addEventListener('click', async () => {
        retryBtn.disabled = true;
        retryBtn.textContent = '正在创建新订单…';
        try {
          const acct = accountId || (await readSession())?.account_id;
          if (!acct) throw new Error('登录状态已过期，请先重新登录。');
          const fresh = await createFreshOrder(acct, targetSku, true);
          renderOrder(targetSku, fresh, { accountId: acct, targetSku });
          startPolling(targetSku, fresh, { accountId: acct, targetSku });
        } catch (err) {
          setModalAlert(content, statusEl, err.message || '重新建单未成功。');
        } finally {
          if (retryBtn.isConnected) {
            retryBtn.disabled = false;
            retryBtn.textContent = retryLabel;
          }
        }
      });
      content.append(retryBtn);
      stopTimers();
    } else {
      statusEl.textContent = '订单当前状态：' + effectiveStatus + '，请点击刷新核对或去账户中心管理。';
    }

    if (!['paid', 'cancelled'].includes(effectiveStatus)) {
      const refresh = document.createElement('button');
      refresh.type = 'button';
      refresh.className = 'checkout-dialog__refresh';
      refresh.textContent = effectiveStatus === 'pending'
        ? '刷新订单状态'
        : '我已付款 · 立即核对到账';
      refresh.addEventListener('click', async () => {
        refresh.disabled = true;
        try {
          const updated = await api('/account/api/orders/' + encodeURIComponent(order.id) + '/refresh', { method: 'POST', body: '{}' });
          recentRefreshAt.set(order.id, Date.now());
          renderOrder(resolvedSku, updated, options);
          if (updated.status === 'pending' && !isOrderWindowEnded(updated)) {
            startPolling(resolvedSku, updated, options);
          }
        } catch (error) {
          statusEl.textContent = error.message;
        } finally {
          if (refresh.isConnected) refresh.disabled = false;
        }
      });
      content.append(refresh);
    }

    const account = document.createElement('a');
    account.className = effectiveStatus === 'paid' ? 'button checkout-dialog__link' : 'checkout-dialog__account';
    account.href = API + '/account';
    account.textContent = effectiveStatus === 'paid' ? '去账户中心激活并使用' : '去账户中心管理全部订单';
    content.append(account);
  }

  function startPolling(sku, order, options = {}) {
    stopPolling();
    if (!['pending', 'payment_unknown', 'paid_awaiting_stock'].includes(order.status)) return;
    if (order.status === 'pending' && isOrderWindowEnded(order)) return;
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
        recentRefreshAt.set(order.id, Date.now());
        if (updated.status !== activeOrder?.status || updated.qrcode_base64 !== activeOrder?.qrcode_base64 || updated.cashier_url !== activeOrder?.cashier_url) {
          renderOrder(sku, updated, options);
          if (!['pending', 'payment_unknown', 'paid_awaiting_stock'].includes(updated.status) || isOrderWindowEnded(updated)) {
            stopPolling();
          }
        }
      } catch (_) {}
    }, 5000);
  }

  function findLiveOrder(ordersList, targetSku) {
    const list = Array.isArray(ordersList) ? ordersList : [];
    for (const st of LIVE_STATUSES) {
      const hit = list.find(o => o.sku === targetSku && o.status === st && !isOrderWindowEnded(o));
      if (hit) return hit;
    }
    return null;
  }

  function findAnyBlockingOrder(ordersList) {
    const list = Array.isArray(ordersList) ? ordersList : [];
    for (const st of LIVE_STATUSES) {
      const liveHit = list.find(o => o.status === st && !isOrderWindowEnded(o));
      if (liveHit) return liveHit;
    }
    return list.find(o => isOrderWindowEnded(o) && o.status !== 'cancelled' && o.status !== 'paid') || null;
  }

  async function resolveLatestEndedOrder(accountId, list) {
    const latestEnded = (Array.isArray(list) ? list : []).find(o =>
      ['pending', 'payment_unknown', 'expired'].includes(o.status) && isOrderWindowEnded(o)
    );
    if (!latestEnded) return { paidOrder: null };

    const refreshed = await tryRefreshOrder(latestEnded.id, true);
    const current = refreshed && !refreshed._refreshError && !refreshed._skippedCooldown ? refreshed : latestEnded;
    if (current.status === 'paid') return { paidOrder: current };

    if (current.status !== 'cancelled' && current.payment_channel !== 'free_receipt') {
      const cancelRes = await tryCancelOrder(current.id, 'auto_close_expired', false);
      if (cancelRes.order?.status === 'paid') return { paidOrder: cancelRes.order };
    }
    clearAccountSessionKeys(accountId);
    return { paidOrder: null };
  }

  async function beginCheckout(sku, link) {
    if (!sku || link.dataset.checkoutBusy === 'true') return;
    if (link.dataset.skuUnavailable === 'true' || link.getAttribute('aria-disabled') === 'true') {
      const view = openModal(sku, '「' + titleFor(sku) + '」目前后端服务器（api.tboxapp.top）尚未开启售卖开关或未导入体验卡库存。');
      const content = view.querySelector('[data-checkout-content]');
      const fallback = document.querySelector('#compare-hours [data-account-checkout]');
      if (fallback) {
        const buy1hBtn = document.createElement('button');
        buy1hBtn.type = 'button';
        buy1hBtn.className = 'button checkout-dialog__link';
        buy1hBtn.textContent = '改买 1 小时（¥20）立即扫码测试';
        buy1hBtn.addEventListener('click', () => {
          view.close();
          void beginCheckout('tbox_day_1h_v9', fallback);
        });
        content.append(buy1hBtn);
      } else {
        const go = document.createElement('a');
        go.className = 'button checkout-dialog__link';
        go.href = 'pricing.html#compare-hours';
        go.textContent = '查看并购买 1 小时（¥20）起步包';
        content.append(go);
      }
      return;
    }

    link.dataset.checkoutBusy = 'true';
    link.setAttribute('aria-busy', 'true');
    const originalText = link.textContent;
    link.textContent = '正在准备二维码…';
    let accountId = '';

    try {
      const user = await readSession();
      if (!user) {
        sessionStorage.setItem(pendingKey, sku);
        const returnUrl = new URL(window.location.href);
        returnUrl.searchParams.set('checkout_sku', sku);
        window.location.assign(API + '/account?return_to=' + encodeURIComponent(returnUrl.href));
        return;
      }
      accountId = user.account_id;

      openModal(sku, '正在拉取订单与生成收款二维码…');
      const ordersData = await api('/account/api/orders');
      const ordersList = Array.isArray(ordersData?.orders) ? ordersData.orders : [];

      const sameLive = findLiveOrder(ordersList, sku);
      if (sameLive) {
        renderOrder(sku, sameLive, { accountId, targetSku: sku });
        startPolling(sku, sameLive, { accountId, targetSku: sku });
        return;
      }

      const { paidOrder } = await resolveLatestEndedOrder(accountId, ordersList);
      if (paidOrder && paidOrder.sku === sku) {
        renderOrder(sku, paidOrder, { accountId, targetSku: sku, customNotice: '刚才的订单已完成支付到账：' });
        return;
      }

      const config = await fetchConfig() || await api('/account/api/config');
      const spec = (config.catalog?.domestic || []).find(item => item.id === sku);
      if (!spec?.purchasing_open) {
        const view = openModal(sku, '');
        view.querySelector('[data-checkout-status]').textContent = '该套餐当前暂未开放线上购买，请选择已开放的正式时长包。';
        return;
      }

      const key = 'tbox-purchase-' + accountId + '-' + sku;
      const priorId = sessionStorage.getItem(key + ':order');
      if (priorId) {
        const priorOrder = ordersList.find(o => o.id === priorId);
        if (!priorOrder || ['paid', 'cancelled', 'expired'].includes(priorOrder.status) || isOrderWindowEnded(priorOrder)) {
          clearSkuSessionKey(sku);
        }
      }

      const order = await createFreshOrder(accountId, sku, false);
      renderOrder(sku, order, { accountId, targetSku: sku });
      startPolling(sku, order, { accountId, targetSku: sku });
    } catch (error) {
      const msg = String(error?.message || '');
      if (error.status === 409 || /原订单|恢复|重复|未完成|pending|expired/i.test(msg)) {
        if (/限购一次/.test(msg)) {
          const view = openModal(sku, msg);
          const acc = document.createElement('a');
          acc.className = 'button checkout-dialog__link';
          acc.href = API + '/account';
          acc.textContent = '去账户中心查看体验订单';
          view.querySelector('[data-checkout-content]').append(acc);
          return;
        }
        try {
          const freshData = await api('/account/api/orders');
          let stuck = findAnyBlockingOrder(freshData?.orders);
          if (stuck && isOrderWindowEnded(stuck) && stuck.payment_channel !== 'free_receipt') {
            const refreshed = await tryRefreshOrder(stuck.id, true);
            const afterRefresh = refreshed && !refreshed._refreshError && !refreshed._skippedCooldown ? refreshed : stuck;
            if (afterRefresh.status === 'paid') {
              renderOrder(afterRefresh.sku || sku, afterRefresh, { accountId, targetSku: sku, customNotice: '刚才的订单已完成支付，已为你打开到账详情：' });
              return;
            }
            const cancelRes = await tryCancelOrder(afterRefresh.id, 'auto_close_409', false);
            if (cancelRes.cancelled && accountId) {
              const newOrder = await createFreshOrder(accountId, sku, true);
              renderOrder(sku, newOrder, { accountId, targetSku: sku, customNotice: '原 5 分钟超时订单已自动关闭，已为你生成全新二维码：' });
              startPolling(sku, newOrder, { accountId, targetSku: sku });
              return;
            }
            stuck = afterRefresh;
          }

          if (stuck) {
            const ended = isOrderWindowEnded(stuck);
            const sameSku = stuck.sku === sku;
            let notice = '';
            if (ended) {
              notice = '旧订单（' + titleFor(stuck.sku) + '）已超过 5 分钟有效期，但当前服务器（api.tboxapp.top）尚未更新自动关单接口，暂时拦住了新下单：';
            } else if (sameSku) {
              notice = '为你接回正在 5 分钟有效期内的原订单，手机扫下方二维码即可直接付款：';
            } else {
              notice = '你账户下还有一笔「' + titleFor(stuck.sku) + '」尚在 5 分钟倒计时中。你可以直接扫码完成，或点下方放弃原单改买「' + titleFor(sku) + '」（超时满 5 分钟将自动切换）：';
            }
            renderOrder(stuck.sku || sku, stuck, { accountId, targetSku: sku, customNotice: notice });
            startPolling(stuck.sku || sku, stuck, { accountId, targetSku: sku });
            return;
          }
        } catch (_) {}
      }
      const view = openModal(sku, '');
      view.querySelector('[data-checkout-status]').textContent = msg || '创建订单时遇到网络波动，请稍后重试或去账户中心查看。';
      const content = view.querySelector('[data-checkout-content]');
      const acc = document.createElement('a');
      acc.className = 'checkout-dialog__account';
      acc.href = API + '/account';
      acc.textContent = '去账户中心查看订单状态';
      content.append(acc);
    } finally {
      link.dataset.checkoutBusy = 'false';
      link.removeAttribute('aria-busy');
      link.textContent = (link.dataset.skuUnavailable === 'true') ? '体验通道维护中（可选 ¥20 起步）' : (link.dataset.checkoutLabel || originalText);
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
        btn.textContent = '体验通道维护中（可选 ¥20 起步）';
      }
    });
  }

  function bind() {
    const links = [...document.querySelectorAll('[data-account-checkout]')];
    links.forEach(link => {
      const card = link.closest('[data-sku]');
      const sku = card?.dataset.sku;
      if (!sku) return;
      link.dataset.checkoutLabel = link.textContent.trim();
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
