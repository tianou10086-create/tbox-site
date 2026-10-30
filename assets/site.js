(() => {
  'use strict';
  const root = document.documentElement;
  const toggle = document.querySelector('.menu-toggle');
  const menu = document.getElementById('primary-menu');
  const closeMenu = restore => {
    if (!toggle || !menu) return;
    toggle.setAttribute('aria-expanded', 'false');
    menu.classList.remove('is-open');
    if (restore) toggle.focus();
  };
  if (toggle && menu) {
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      menu.classList.toggle('is-open', open);
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') closeMenu(true);
    });
    menu.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(false); });
    document.addEventListener('click', event => { if (!event.target.closest('.site-header')) closeMenu(false); });
    window.matchMedia('(min-width: 761px)').addEventListener('change', () => closeMenu(false));
  }

  // Preloaded panels stay readable without JS; controls enable before hiding.
  const controllers = new Map();
  document.querySelectorAll('[data-tabs], .feature-menu[role="tablist"]').forEach(group => {
    const tabs = [...group.querySelectorAll('[role="tab"]')];
    const panels = tabs.map(tab => document.getElementById(tab.getAttribute('aria-controls')));
    if (!tabs.length || panels.some(panel => !panel)) return;
    const activate = selected => {
      if (!tabs.includes(selected)) return;
      tabs.forEach((tab, index) => {
        const active = tab === selected;
        tab.disabled = false;
        tab.setAttribute('aria-selected', String(active));
        tab.tabIndex = active ? 0 : -1;
        panels[index].hidden = !active;
        panels[index].classList.toggle('is-active', active);
      });
    };
    tabs.forEach((tab, index) => {
      controllers.set(panels[index].id, {activate: () => activate(tab), tab});
      tab.addEventListener('click', () => activate(tab));
      tab.addEventListener('keydown', event => {
        let next;
        if (['ArrowRight', 'ArrowDown'].includes(event.key)) next = (index + 1) % tabs.length;
        if (['ArrowLeft', 'ArrowUp'].includes(event.key)) next = (index - 1 + tabs.length) % tabs.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = tabs.length - 1;
        if (next !== undefined) { event.preventDefault(); activate(tabs[next]); tabs[next].focus(); }
      });
    });
    activate(tabs.find(tab => tab.getAttribute('aria-selected') === 'true') || tabs[0]);
    group.hidden = false;
  });

  document.querySelectorAll('[data-practice-scene]').forEach(scene => {
    const input = scene.querySelector('[data-practice-answer]');
    const preview = scene.querySelector('[data-answer-preview]');
    const clear = scene.querySelector('[data-practice-clear]');
    const status = scene.querySelector('[data-practice-status]');
    const update = () => {
      preview.textContent = input.value.trim() || '还没有写下笔记，可以返回“独立作答”。';
      clear.hidden = !input.value;
      status.textContent = '';
    };
    input.addEventListener('input', update);
    clear.addEventListener('click', () => {
      input.value = '';
      update();
      scene.querySelector('.demo-answer summary').focus();
      status.textContent = '这段笔记已清空，没有发送。';
    });
    update();
  });
  document.querySelectorAll('[data-practice-next]').forEach(button => {
    button.hidden = false;
    button.addEventListener('click', () => {
      const target = document.getElementById(button.dataset.practiceNext);
      controllers.get(target.id)?.activate();
      target.focus();
    });
  });

  const navigationType = window.performance?.getEntriesByType?.('navigation')[0]?.type;
  function revealHash(align = true) {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    const target = document.getElementById(id);
    if (!target) return;
    if (id === 'product-film') { const film = target.querySelector('.film-disclosure'); if (film) film.open = true; }
    const scene = target.closest('[data-practice-scene]');
    if (scene) {
      controllers.get(scene.id)?.activate();
      if (align) { scene.scrollIntoView({block: 'start'}); scene.focus({preventScroll: true}); }
    }
    controllers.get(target.id)?.activate();
    let parent = target.closest('details');
    while (parent) { parent.open = true; parent = parent.parentElement?.closest('details'); }
    if (align && !scene) {
      const context = target.closest('details') || target;
      const heading = context.querySelector('summary,h1,h2') || context;
      if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
      window.requestAnimationFrame(() => { context.scrollIntoView({block: 'start'}); heading.focus({preventScroll: true}); });
    }
  }
  window.addEventListener('hashchange', () => revealHash(true));
  revealHash(navigationType !== 'back_forward');
  // Fresh destinations announce their title; history navigation keeps native scroll/focus restoration.
  window.addEventListener('pageshow', event => {
    if (event.persisted || location.hash || navigationType !== 'navigate') return;
    const heading = document.querySelector('h1');
    if (heading) { heading.setAttribute('tabindex','-1'); heading.focus({preventScroll:true}); }
  });

  const header = document.querySelector('.site-header');
  if (header) {
    let pending = false;
    const updateHeader = () => { header.classList.toggle('is-scrolled', window.scrollY > 12); pending = false; };
    window.addEventListener('scroll', () => {
      if (!pending) { pending = true; window.requestAnimationFrame(updateHeader); }
    }, {passive: true});
    updateHeader();
  }

  const guide = document.querySelector('.guide-index');
  if (guide && 'IntersectionObserver' in window) {
    const links = [...guide.querySelectorAll('a[href^="#"]')];
    const visibleSections = new Set();
    const observer = new window.IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) visibleSections.add(entry.target);
        else visibleSections.delete(entry.target);
      });
      const distance = section => Math.abs(section.getBoundingClientRect().top - 100);
      const current = [...visibleSections].sort((a,b) => distance(a) - distance(b))[0];
      if (!current) return;
      links.forEach(link => {
        if (link.getAttribute('href') === '#' + current.id) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }, {rootMargin: '-100px 0px -50% 0px', threshold: 0});
    document.querySelectorAll('.guide-step').forEach(section => observer.observe(section));
  }
  root.classList.add('is-enhanced');
})();
