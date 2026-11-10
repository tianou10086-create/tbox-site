/* Account API deployed — navigation guard; server independently authorizes downloads.
 * This static guard controls navigation, not access to public assets or HTML.
 * The download server must authorize every request; login is not a purchase.
 * Mark protected pages with <html data-account-required> and put this CSS in
 * the initial <head>, before any body can paint (also fails closed if JS fails):
 * html[data-account-required]:not([data-account-state="ready"]):not([data-account-state="error"]) body{visibility:hidden}
 * about.html / faq.html must NOT receive the marker/CSS gate. Their terms,
 * privacy and support sections remain readable before registration.
 */
(() => {
  'use strict';
  const root = document.documentElement;
  const current = new URL(window.location.href);
  const publicPaths = new Set(['/about.html', '/faq.html']);
  const required = root.hasAttribute('data-account-required') && !publicPaths.has(current.pathname);

  const allowedOrigins = new Set(['https://tboxapp.top', 'https://www.tboxapp.top']);
  const allowedPaths = new Set([
    '/', '/index.html', '/download.html', '/pricing.html', '/media.html',
    '/buy.html', '/activate.html', '/setup-key.html', '/membership.html',
    '/en.html', '/connector.html', '/about.html', '/faq.html', '/404.html'
  ]);
  const trustedPage = allowedOrigins.has(current.origin) && allowedPaths.has(current.pathname)
    && !current.username && !current.password;
  // Never consume next/return_to from the query string. Retain only our origin
  // and an exact known path; arbitrary query/fragment data is not propagated.
  const returnTo = trustedPage ? current.origin + current.pathname : 'https://tboxapp.top/';
  const login = new URL('https://api.tboxapp.top/account');
  login.searchParams.set('return_to', returnTo);
  const api = 'https://api.tboxapp.top';
  const originalVisibility = root.style.visibility;
  if (required) root.style.visibility = 'hidden';
  root.setAttribute('data-account-state', 'checking');

  const domReady = document.readyState === 'loading'
    ? new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true }))
    : Promise.resolve();
  let originalNodes;
  let busy = false;

  function reveal(state) {
    root.setAttribute('data-account-state', state);
    root.style.visibility = originalVisibility;
  }

  function updateAccount(session, pending = false) {
    document.querySelectorAll('[data-account-link]').forEach(link => {
      link.textContent = session ? session.email : pending ? '确认登录状态' : '登录';
      link.href = session || pending ? api + '/account' : api + '/account?return_to=https%3A%2F%2Ftboxapp.top%2F';
      link.title = session ? '账户中心 · ' + session.email : link.textContent;
      link.setAttribute('aria-label', session ? '账户中心：' + session.email : link.textContent);
    });
  }

  async function failure(reason) {
    await domReady;
    updateAccount(null, true);
    if (!required) { reveal('error'); return; }
    if (!originalNodes) originalNodes = Array.from(document.body.childNodes);
    const view = document.createElement('main');
    view.setAttribute('role', 'alert');
    view.style.cssText = 'max-width:40rem;margin:12vh auto;padding:2rem;font:1rem/1.7 system-ui,sans-serif';
    const title = document.createElement('h1');
    title.textContent = '暂时无法确认登录状态';
    const message = document.createElement('p');
    message.textContent = reason === 'timeout'
      ? '验证登录状态超时，页面尚未开放。请重试，或前往登录页。'
      : '登录服务暂时未能完成验证，页面尚未开放。请重试，或前往登录页。';
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.textContent = '重试验证';
    retry.addEventListener('click', check);
    const signIn = document.createElement('a');
    signIn.href = login.href;
    signIn.textContent = '前往登录';
    signIn.style.marginLeft = '1rem';
    view.append(title, message, retry, signIn);
    document.body.replaceChildren(view);
    reveal('error');
  }

  async function readSession(signal) {
    const response = await fetch(api + '/account/api/session', {
      method: 'GET', credentials: 'include', mode: 'cors',
      cache: 'no-store', redirect: 'error', signal
    });
    if (response.status === 401) return false;
    if (response.status !== 200) throw new Error('service');
    const session = await response.json();
    if (!session || typeof session.email !== 'string' || !session.email.trim()
      || typeof session.account_id !== 'string' || !session.account_id.trim()
      || !Array.isArray(session.grants)) throw new Error('response');
    // A verified session suffices; grants may be empty. Never create an order,
    // a device, or a client-side substitute for the server's session cookie.
    return session;
  }

  async function check() {
    if (busy) return;
    busy = true;
    await domReady;
    updateAccount(null, true);
    if (required) root.style.visibility = 'hidden';
    root.setAttribute('data-account-state', 'checking');
    const controller = new AbortController();
    let timer;
    try {
      if (!trustedPage) throw new Error('origin');
      const deadline = new Promise((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error('timeout'));
        }, 10000);
      });
      const signedIn = await Promise.race([readSession(controller.signal), deadline]);
      if (!signedIn) {
        updateAccount(null);
        if (!required) { reveal('ready'); return; }
        window.location.replace(login.href);
        return; // Stay hidden until the login navigation completes.
      }
      await domReady;
      if (originalNodes) document.body.replaceChildren(...originalNodes);
      for (const [selector, kind] of [
        ['[data-primary-download], [data-account-download="installer"]', 'installer'],
        ['[data-portable-download], [data-account-download="portable"]', 'portable']
      ]) {
        document.querySelectorAll(selector).forEach(link => {
          link.href = api + '/account/download?kind=' + kind;
        });
      }
      updateAccount(signedIn);
      reveal('ready');
    } catch (error) {
      await failure(error.message);
    } finally {
      clearTimeout(timer);
      busy = false;
    }
  }
  window.addEventListener('pageshow', event => { if (event.persisted) void check(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void check(); });
  void check();
})();
