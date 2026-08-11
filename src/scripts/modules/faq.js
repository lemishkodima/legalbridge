export function initFaq() {
  document.querySelectorAll('.faq-item').forEach((item, index) => {
    const question = item.querySelector('.faq-q');
    const answer = item.querySelector('.faq-a');

    if (!question || !answer) return;

    const answerId = `faq-answer-${index + 1}`;

    question.setAttribute('role', 'button');
    question.setAttribute('tabindex', '0');
    question.setAttribute('aria-expanded', 'false');
    question.setAttribute('aria-controls', answerId);
    answer.id = answerId;
    answer.setAttribute('aria-hidden', 'true');

    const toggle = () => {
      const isOpen = item.classList.toggle('open');
      question.setAttribute('aria-expanded', String(isOpen));
      answer.setAttribute('aria-hidden', String(!isOpen));
    };

    question.addEventListener('click', toggle);
    question.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggle();
      }
    });
  });
}
