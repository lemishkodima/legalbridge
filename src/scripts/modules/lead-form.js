const SUBMIT_LABEL = 'Отримати консультацію';
const SUBMITTING_LABEL = 'Надсилаємо заявку…';

function setStatus(status, message, type = '') {
  status.textContent = message;
  status.classList.toggle('is-success', type === 'success');
  status.classList.toggle('is-error', type === 'error');
}

export function initLeadForm() {
  const form = document.getElementById('lead-form');
  const status = document.getElementById('form-status');
  const submitButton = form?.querySelector('[type="submit"]');

  if (!form || !status || !submitButton) return;

  form.addEventListener('submit', async event => {
    event.preventDefault();

    if (!form.reportValidity()) return;

    const data = new FormData(form);
    const payload = {
      name: String(data.get('name') || '').trim(),
      phone: String(data.get('phone') || '').trim(),
      problem: String(data.get('problem') || '').trim(),
      website: String(data.get('website') || '').trim()
    };
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);

    submitButton.disabled = true;
    submitButton.textContent = SUBMITTING_LABEL;
    setStatus(status, '');

    try {
      const response = await fetch('/api/leeloo-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.ok) {
        throw new Error(result.message || 'Не вдалося передати заявку.');
      }

      form.reset();
      setStatus(
        status,
        'Дякуємо! Заявку передано менеджеру. Ми зв’яжемося з вами найближчим часом.',
        'success'
      );
    } catch (error) {
      const message = error.name === 'AbortError'
        ? 'Сервер відповідає надто довго. Спробуйте ще раз.'
        : error.message;

      setStatus(
        status,
        `${message} Або зателефонуйте: +380 73 543 74 41.`,
        'error'
      );
    } finally {
      window.clearTimeout(timeout);
      submitButton.disabled = false;
      submitButton.textContent = SUBMIT_LABEL;
    }
  });
}
