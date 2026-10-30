(() => {
  'use strict';
  const toggle = document.querySelector('.menu-toggle');
  const menu = document.getElementById('primary-menu');
  const closeMenu = (restore) => { if (!toggle || !menu) return; toggle.setAttribute('aria-expanded', 'false'); menu.classList.remove('is-open'); if (restore) toggle.focus(); };
  if (toggle && menu) {
    toggle.addEventListener('click', () => { const open = toggle.getAttribute('aria-expanded') !== 'true'; toggle.setAttribute('aria-expanded', String(open)); menu.classList.toggle('is-open', open); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') closeMenu(true); });
    menu.addEventListener('click', e => { if (e.target.closest('a')) closeMenu(false); });
    document.addEventListener('click', e => { if (!e.target.closest('.site-header')) closeMenu(false); });
    const desktop = window.matchMedia('(min-width: 761px)');
    desktop.addEventListener('change', () => closeMenu(false));
  }
  const tabs = [...document.querySelectorAll('.feature-menu [role="tab"]')];
  const activate = tab => tabs.forEach(item => { const selected = item === tab; item.setAttribute('aria-selected', String(selected)); item.tabIndex = selected ? 0 : -1; document.getElementById(item.getAttribute('aria-controls')).hidden = !selected; });
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activate(tab));
    tab.addEventListener('keydown', e => { let next; if (['ArrowRight', 'ArrowDown'].includes(e.key)) next = (index + 1) % tabs.length; if (['ArrowLeft', 'ArrowUp'].includes(e.key)) next = (index - 1 + tabs.length) % tabs.length; if (e.key === 'Home') next = 0; if (e.key === 'End') next = tabs.length - 1; if (next !== undefined) { e.preventDefault(); activate(tabs[next]); tabs[next].focus(); } });
  });
  // Direct FAQ deep links open the containing disclosure without losing its anchor.
  if (location.hash) { const target = document.getElementById(decodeURIComponent(location.hash.slice(1))); if (target) { let parent = target.closest('details'); while (parent) { parent.open = true; parent = parent.parentElement.closest('details'); } } }
})();
