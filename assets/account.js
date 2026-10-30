(() => {
  'use strict';
  const form = document.getElementById('account-form');
  if (!form) return;
  const status = document.getElementById('account-status');
  const fields = document.getElementById('account-fields');
  const submit = document.getElementById('account-submit');
  const username = document.getElementById('account-username');
  const password = document.getElementById('account-password');
  const confirm = document.getElementById('account-confirm');
  const confirmGroup = document.getElementById('confirm-group');
  const tabs = [...document.querySelectorAll('.account-tabs [role="tab"]')];
  const panel = document.getElementById('account-auth-panel');
  const userPanel = document.getElementById('account-state');
  const refresh = document.getElementById('account-refresh');
  const logout = document.getElementById('account-logout');
  let mode = 'login', busy = false, token = null, base = '';
  const config = window.TBOX_ACCOUNT_CONFIG || {};
  base = window.TBOX_ACCOUNT_API.resolveBase(config.API_BASE, location);
  const say = (text, error = false) => { status.textContent = text; status.classList.toggle('error', error); };
  const pending = value => { busy = value; fields.disabled = value || !base; tabs.forEach(tab => tab.disabled = value); refresh.disabled = value; logout.disabled = value; submit.textContent = value ? '正在处理…' : !base ? '账户服务暂未开放' : mode === 'login' ? '登录' : '创建账户'; };
  const messages = { invalid_credentials: '账户名或密码不正确，请检查后再试。', username_exists: '这个账户名已注册，请改用登录或更换账户名。', username_invalid: '账户名需为 3–64 位字母、数字或 _ . @ -。', invalid_request: '请检查账户名和密码格式。密码需为 12–128 位。', account_banned: '此账户已被停用。请通过售后渠道核对账户状态。', authentication_required: '请先登录。', session_expired_or_invalid: '登录已失效，请重新登录。', session_revoked: '本次登录已退出，请重新登录。' };
  async function request(path, method = 'GET', body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const headers = { Accept: 'application/json' };
      if (body) headers['Content-Type'] = 'application/json';
      if (token) headers.Authorization = 'Bearer ' + token;
      const response = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: controller.signal, credentials: 'omit', cache: 'no-store', redirect: 'error' });
      let data;
      try { data = await response.json(); } catch { throw new Error('服务未返回有效结果，请稍后再试。'); }
      if (!response.ok) {
        const error = new Error(messages[data.detail] || (response.status === 429 ? '尝试过于频繁，请稍等再试。' : '服务暂时无法完成请求，请稍后再试。'));
        error.status = response.status;
        throw error;
      }
      return data;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('连接超时，未能确认操作结果。若刚提交注册，请先尝试登录。');
      if (error instanceof TypeError) throw new Error('未能连接账户服务，操作结果尚未确认。请检查网络；若刚提交注册，请先尝试登录。');
      throw error;
    } finally { clearTimeout(timer); }
  }
  const switchMode = (next, focus = false) => {
    if (busy) return;
    mode = next;
    tabs.forEach(tab => { const selected = tab.dataset.mode === mode; tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1; if (selected) { panel.setAttribute('aria-labelledby', tab.id); if (focus) tab.focus(); } });
    confirmGroup.hidden = mode !== 'register'; confirm.required = mode === 'register'; confirm.value = ''; password.value = '';
    password.autocomplete = mode === 'register' ? 'new-password' : 'current-password';
    pending(false);
    if (base) say(mode === 'login' ? '登录查看此账户的服务端状态。桌面卡密不会自动关联。' : '注册仅创建账户，不代表已购买或获得桌面授权。');
  };
  function showUser(user) {
    if (!user || typeof user.username !== 'string' || !Number.isFinite(user.expires_at) || typeof user.active !== 'boolean') throw new Error('账户状态格式异常，请稍后再试。');
    document.getElementById('account-name').textContent = user.username;
    document.getElementById('account-entitlement').textContent = user.banned ? '已停用' : user.active ? '服务端权益有效' : '暂无有效的服务端权益';
    document.getElementById('account-expiry').textContent = user.expires_at > 0 ? new Date(user.expires_at * 1000).toLocaleString('zh-CN') : '未设置';
    panel.hidden = true; document.querySelector('.account-tabs').hidden = true; userPanel.hidden = false;
    say('已登录。此处为账户服务返回的状态，不代表本机卡密状态。');
  }
  function showLogin() { token = null; userPanel.hidden = true; panel.hidden = false; document.querySelector('.account-tabs').hidden = false; password.value = ''; confirm.value = ''; }
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => switchMode(tab.dataset.mode));
    tab.addEventListener('keydown', e => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) { e.preventDefault(); const next = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + 1) % tabs.length; switchMode(tabs[next].dataset.mode, true); } });
  });
  document.getElementById('password-toggle').addEventListener('click', e => { const show = password.type === 'password'; password.type = show ? 'text' : 'password'; e.currentTarget.textContent = show ? '隐藏' : '显示'; e.currentTarget.setAttribute('aria-pressed', String(show)); });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!base || busy || !form.reportValidity()) return;
    if (mode === 'register' && password.value !== confirm.value) { say('两次输入的密码不一致。', true); confirm.focus(); return; }
    const payload = { username: username.value.trim().toLowerCase(), password: password.value };
    pending(true); say(mode === 'register' ? '正在创建账户…' : '正在登录…');
    try {
      if (mode === 'register') {
        await request('/v1/register', 'POST', payload);
        pending(false); switchMode('login'); say('账户已创建。请使用刚才的密码登录；注册不会自动购买授权。'); password.focus();
      } else {
        const result = await request('/v1/login', 'POST', payload);
        if (!result || typeof result.access_token !== 'string' || !result.access_token) throw new Error('登录结果不完整，请稍后再试。');
        token = result.access_token;
        showUser(await request('/v1/me'));
        password.value = ''; confirm.value = ''; document.getElementById('account-name').focus();
      }
    } catch (error) { token = null; say(error.message, true); }
    finally { pending(false); }
  });
  refresh.addEventListener('click', async () => {
    if (busy || !token) return; pending(true);
    try { showUser(await request('/v1/me')); } catch (error) { if ([401, 403].includes(error.status)) showLogin(); say(error.message, true); } finally { pending(false); }
  });
  logout.addEventListener('click', async () => {
    if (busy || !token) return; pending(true);
    try { await request('/v1/logout', 'POST'); showLogin(); say('已退出登录。'); }
    catch (error) { showLogin(); say('本页已退出，但未能确认服务端会话已撤销。原会话会在服务端规定时间后到期。', true); }
    finally { pending(false); }
  });
  pending(false);
  if (!base) say('网页账户服务尚未开放，当前不接收账户名或密码。下载、试用与卡密激活不受影响。');
})();
