function updatePlayerState(player, video, button) {
  const isPlaying = !video.paused && !video.ended;

  player.classList.toggle('is-playing', isPlaying);
  button.setAttribute('aria-label', isPlaying ? 'Поставити відео на паузу' : 'Відтворити відео');
}

function updateSoundState(player, video, button) {
  const isMuted = video.muted;

  player.classList.toggle('is-muted', isMuted);
  button.setAttribute('aria-label', isMuted ? 'Увімкнути звук' : 'Вимкнути звук');
  button.setAttribute('aria-pressed', String(!isMuted));
}

export function initVideoPlayers() {
  document.querySelectorAll('[data-video-player]').forEach(player => {
    const video = player.querySelector('video');
    const button = player.querySelector('[data-video-toggle]');
    const soundButton = player.querySelector('[data-video-sound]');

    if (!video || !button || !soundButton) return;

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

    const toggleSound = () => {
      video.muted = !video.muted;
    };

    button.addEventListener('click', togglePlayback);
    soundButton.addEventListener('click', toggleSound);
    video.addEventListener('click', togglePlayback);
    video.addEventListener('play', () => updatePlayerState(player, video, button));
    video.addEventListener('pause', () => updatePlayerState(player, video, button));
    video.addEventListener('ended', () => updatePlayerState(player, video, button));
    video.addEventListener('volumechange', () => updateSoundState(player, video, soundButton));

    updatePlayerState(player, video, button);
    updateSoundState(player, video, soundButton);
  });
}
