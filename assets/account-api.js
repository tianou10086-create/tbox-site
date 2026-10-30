/* Shared public endpoint validation. No runtime secrets. */
(function (root) {
  'use strict';
  function resolveBase(raw, location) {
    if (typeof raw !== 'string' || !/^\/[A-Za-z0-9/_-]+$/.test(raw) || raw.startsWith('//')) return '';
    if (location.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(location.hostname)) return '';
    try {
      const endpoint = new URL(raw, location.origin);
      if (endpoint.origin !== location.origin || endpoint.search || endpoint.hash || endpoint.username || endpoint.password) return '';
      return endpoint.pathname.replace(/\/$/, '');
    } catch { return ''; }
  }
  if (typeof module === 'object' && module.exports) module.exports = { resolveBase };
  else root.TBOX_ACCOUNT_API = Object.freeze({ resolveBase });
})(typeof window === 'object' ? window : globalThis);
