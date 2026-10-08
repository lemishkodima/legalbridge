export function initDocumentsGallery() {
  const track = document.querySelector('[data-documents-track]');
  if (!track) return;

  document.querySelectorAll('[data-gallery-scroll]').forEach((button) => {
    button.addEventListener('click', () => {
      const direction = Number(button.dataset.galleryScroll) || 1;
      const card = track.querySelector('.document-card');
      const gap = Number.parseFloat(getComputedStyle(track).columnGap) || 0;
      const distance = card ? card.getBoundingClientRect().width + gap : track.clientWidth * 0.8;
      track.scrollBy({ left: direction * distance, behavior: 'smooth' });
    });
  });
}
