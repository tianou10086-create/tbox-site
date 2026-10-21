/* Local-only visual behavior. It never changes product facts, prices, or URLs. */
(() => {
  'use strict';
  if (window.__tboxDesignUpgrade) return;
  window.__tboxDesignUpgrade = true;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const onReady = (fn) => document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', fn, {once:true}) : fn();
  onReady(() => {
    /* Keep the hero preview in its measured position: the responsive contract
       checks the caption against the window bounds before the first observer tick. */
    const nodes = [...document.querySelectorAll('.section, .card, .panel, .steps .step, .trust-grid .panel')];
    nodes.forEach((el, i) => { el.classList.add('tb-reveal'); el.style.setProperty('--tb-delay', `${(i % 4) * 55}ms`); });
    if (reduce || !('IntersectionObserver' in window)) {
      nodes.forEach(el => el.classList.add('tb-visible'));
    } else {
      const io = new IntersectionObserver((entries, observer) => entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('tb-visible'); observer.unobserve(entry.target); } }), {threshold:.08, rootMargin:'0px 0px -24px'});
      nodes.forEach(el => io.observe(el));
    }

    const counters = [...document.querySelectorAll('.hero-facts [data-count]')];
    const finalText = new Map(counters.map(el => [el, el.textContent]));
    const setCounter = (el, value) => { el.textContent = `${value}${el.dataset.suffix || ''}`; };
    const finishCounter = el => { el.textContent = finalText.get(el); el.dataset.countState = 'done'; };
    if (reduce || !('IntersectionObserver' in window)) {
      counters.forEach(finishCounter);
    } else if (counters.length) {
      counters.forEach(el => { setCounter(el, 0); el.dataset.countState = 'pending'; });
      const animateCounter = el => {
        if (el.dataset.countState !== 'pending') return;
        el.dataset.countState = 'running';
        const target = Number(el.dataset.count);
        const started = performance.now();
        const tick = now => {
          const progress = Math.min(1, (now - started) / 1200);
          const eased = 1 - Math.pow(1 - progress, 3);
          setCounter(el, Math.round(target * eased));
          if (progress < 1) requestAnimationFrame(tick); else finishCounter(el);
        };
        requestAnimationFrame(tick);
      };
      const facts = document.querySelector('.hero-facts');
      if (facts) {
        const cio = new IntersectionObserver(entries => entries.forEach(entry => {
          if (entry.isIntersecting) { counters.forEach(animateCounter); cio.disconnect(); }
        }), {threshold: .3});
        cio.observe(facts);
      }
    }

    const download = [...document.querySelectorAll('a[href]')].find(a => /download\.html/i.test(a.getAttribute('href') || ''));
    const hero = document.querySelector('.hero');
    const footer = document.querySelector('footer');
    if (!download || !hero || !document.body.classList.contains('design-upgrade')) return;
    const bar = document.createElement('aside');
    bar.className = 'tb-download-bar';
    bar.setAttribute('aria-label', '快捷下载');
    const label = document.createElement('span'); label.className = 'tb-download-label'; label.textContent = 'T-Box · 快捷下载';
    const action = download.cloneNode(true); action.className = 'btn primary'; action.textContent = '下载试用'; action.removeAttribute('id');
    const close = document.createElement('button'); close.className = 'tb-download-close'; close.type = 'button'; close.setAttribute('aria-label','关闭快捷下载'); close.textContent = '×';
    bar.append(label, action, close); document.body.appendChild(bar);
    let dismissed = false, heroVisible = true, footerVisible = false;
    const update = () => { const show = !dismissed && window.scrollY > 360 && !heroVisible && !footerVisible; bar.classList.toggle('tb-visible', show); bar.setAttribute('aria-hidden', String(!show)); if ('inert' in bar) bar.inert = !show; };
    close.addEventListener('click', () => { dismissed = true; update(); });
    if ('IntersectionObserver' in window) {
      const hi = new IntersectionObserver(es => { heroVisible = es[0].isIntersecting; update(); }); hi.observe(hero);
      if (footer) { const fi = new IntersectionObserver(es => { footerVisible = es[0].isIntersecting; update(); }); fi.observe(footer); }
    }
    window.addEventListener('scroll', update, {passive:true}); window.addEventListener('resize', update, {passive:true}); update();
  });
})();
