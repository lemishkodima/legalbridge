function updatePlayerState(player, video, button) {
  const isPlaying = !video.paused && !video.ended;

  player.classList.toggle('is-playing', isPlaying);
  button.setAttribute('aria-label', isPlaying ? 'Поставити відео на паузу' : 'Відтворити відео');
}

export function initVideoPlayers() {
  document.querySelectorAll('[data-video-player]').forEach(player => {
    const video = player.querySelector('video');
    const button = player.querySelector('[data-video-toggle]');

    if (!video || !button) return;

    const togglePlayback = async () => {
      if (video.paused || video.ended) {
        try {
          await video.play();
        } catch {
          updatePlayerState(player, video, button);
        }
      } else {
        video.pause();
      }
    };

    button.addEventListener('click', togglePlayback);
    video.addEventListener('click', togglePlayback);
    video.addEventListener('play', () => updatePlayerState(player, video, button));
    video.addEventListener('pause', () => updatePlayerState(player, video, button));
    video.addEventListener('ended', () => updatePlayerState(player, video, button));

    updatePlayerState(player, video, button);
  });
}
