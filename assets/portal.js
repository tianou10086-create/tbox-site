// Autoplay follows visibility; explicit user pause always wins.
(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  document.querySelectorAll('video').forEach(video => {
    if (video.dataset.manualPlay === 'true') return;
    video.muted = true;
    video.loop = true;
    let inView = false, focused = document.hasFocus();
    let userPaused = false, blocked = false, systemPauses = 0;
    const visible = () => inView && focused && document.visibilityState === 'visible';
    const suspend = () => {
      if (!video.paused) { systemPauses += 1; video.pause(); }
    };
    const sync = () => {
      if (!visible()) { suspend(); return; }
      if (reduced.matches || userPaused || blocked || !video.paused) return;
      video.play().then(() => {
        if (!visible()) suspend(); // Visibility may change while play() is pending.
      }).catch(error => {
        if (error.name !== 'AbortError') blocked = true;
        // Native controls remain available if the browser declines autoplay.
      });
    };
    video.addEventListener('pause', () => {
      if (systemPauses > 0) { systemPauses -= 1; return; }
      userPaused = true;
    });
    video.addEventListener('play', () => {
      userPaused = false;
      blocked = false;
      if (!visible()) suspend();
    });
    const observer = new IntersectionObserver(entries => {
      const entry = entries[entries.length - 1];
      inView = entry.isIntersecting && entry.intersectionRatio >= 0.25;
      sync();
    }, { threshold: [0, 0.25], rootMargin: '-80px 0px 0px 0px' });
    observer.observe(video);
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('focus', () => { focused = true; sync(); });
    window.addEventListener('blur', () => { focused = false; sync(); });
    window.addEventListener('pagehide', suspend);
    window.addEventListener('pageshow', () => { focused = document.hasFocus(); sync(); });
    reduced.addEventListener('change', () => { if (reduced.matches) suspend(); else sync(); });
  });
})();
