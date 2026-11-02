// Motion starts quietly; an explicit pause or reduced-motion preference wins.
(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  document.querySelectorAll('video').forEach(video => {
    if (reduced.matches) return;
    video.muted = true;
    video.loop = true;
    let userPaused = false;
    video.addEventListener('pause', () => { userPaused = true; });
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting) && !userPaused) {
        video.play().catch(() => {}); // Browser autoplay denial leaves native controls usable.
        observer.disconnect();
      }
    }, { threshold: 0.25 });
    observer.observe(video);
    reduced.addEventListener('change', event => { if (event.matches) video.pause(); });
  });
})();
