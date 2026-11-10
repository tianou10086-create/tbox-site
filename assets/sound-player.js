/* Explicit sound playback only; native video controls keep their own choices. */
(() => {
  document.querySelectorAll('button[data-sound-play]').forEach(button => {
    const video = document.getElementById(button.dataset.soundPlay);
    if (!(video instanceof HTMLVideoElement)) return;

    button.type = 'button';
    button.setAttribute('aria-controls', video.id);
    let status = button.nextElementSibling;
    if (!status || status.getAttribute('role') !== 'status') {
      status = document.createElement('span');
      status.className = 'sound-player-status';
      status.setAttribute('role', 'status');
      button.insertAdjacentElement('afterend', status);
    }

    const sync = () => {
      const playing = !video.paused && !video.ended;
      const label = playing ? '暂停讲解' : '有声播放 · 23 秒';
      button.textContent = label;
      button.setAttribute('aria-label', label);
      button.setAttribute('aria-pressed', String(playing));
    };
    ['play', 'pause', 'ended', 'emptied'].forEach(event => {
      video.addEventListener(event, sync);
    });
    video.addEventListener('playing', () => { status.textContent = ''; });

    button.addEventListener('click', async () => {
      status.textContent = '';
      if (!video.paused && !video.ended) {
        video.pause();
        sync();
        return;
      }
      try {
        if (video.ended) video.currentTime = 0;
        video.muted = false;
        video.volume = 1;
        await video.play();
      } catch {
        video.pause();
        status.textContent = '播放没有开始，请点击播放器上的播放按钮重试。';
      }
      sync();
    });
    sync();
  });
})();
