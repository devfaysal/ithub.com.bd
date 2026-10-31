const form = document.querySelector('#enquiry-form');
const submitButton = document.querySelector('#send-enquiry');
const submitLabel = submitButton.querySelector('span');
const retryButton = document.querySelector('#retry-verification');
const formStatus = document.querySelector('#form-status');
const serviceField = form.elements.namedItem('service');
const preferredService = new URLSearchParams(window.location.search).get('service');
const editableFields = [...form.querySelectorAll('input:not([type="hidden"]), select, textarea')];
let widgetId;
let token = '';
let sending = false;
let initialising = false;
let lastPayload = '';
let requestId = '';

function applyPreferredService() {
  if (preferredService && [...serviceField.options].some((option) => option.value === preferredService)) {
    serviceField.value = preferredService;
  }
}
applyPreferredService();

function setStatus(message, state = 'info', reason = '') {
  formStatus.textContent = message;
  formStatus.dataset.state = state;
  formStatus.dataset.reason = reason;
}

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  return new Promise((resolve, reject) => {
    const previous = document.querySelector('#turnstile-script');
    if (previous) previous.remove();
    const script = document.createElement('script');
    script.id = 'turnstile-script';
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    const timer = window.setTimeout(() => reject(new Error('Verification timed out.')), 12000);
    script.addEventListener('load', () => {
      window.clearTimeout(timer);
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error('Verification could not load.'));
    }, { once: true });
    script.addEventListener('error', () => {
      window.clearTimeout(timer);
      reject(new Error('Verification could not load.'));
    }, { once: true });
    document.head.append(script);
  });
}

async function initialiseVerification() {
  if (initialising || sending) return;
  initialising = true;
  submitButton.disabled = true;
  retryButton.hidden = true;
  token = '';
  try {
    if (widgetId !== undefined && window.turnstile) {
      window.turnstile.reset(widgetId);
      submitButton.disabled = false;
      setStatus('');
      return;
    }
    const response = await fetch('/api/contact-config', {
      cache: 'no-store', headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error('Form configuration unavailable.');
    const config = await response.json();
    if (typeof config.siteKey !== 'string' || !config.siteKey) throw new Error('Missing verification configuration.');
    const turnstile = await loadTurnstile();
    widgetId = turnstile.render('#contact-verification', {
      sitekey: config.siteKey,
      action: 'contact',
      theme: 'light',
      size: document.querySelector('#contact-verification').clientWidth < 300 ? 'compact' : 'flexible',
      callback: (value) => {
        token = value;
        if (!sending) {
          retryButton.hidden = true;
          if (formStatus.dataset.reason === 'verification') setStatus('');
        }
      },
      'expired-callback': () => {
        token = '';
        if (!sending) window.turnstile.reset(widgetId);
      },
      'error-callback': () => {
        token = '';
        if (!sending) {
          setStatus('Verification couldn’t finish. Please retry, or contact us by email or WhatsApp.', 'error', 'verification');
          retryButton.hidden = false;
        }
      },
    });
    submitButton.disabled = false;
    setStatus('');
  } catch {
    setStatus('The form is temporarily unavailable. Please retry, email us, or contact us on WhatsApp.', 'error');
    retryButton.hidden = false;
  } finally {
    initialising = false;
  }
}

retryButton.addEventListener('click', initialiseVerification);
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (sending || !form.reportValidity()) return;
  if (!token) {
    setStatus('Please complete the verification before sending your message.', 'error', 'verification');
    document.querySelector('#contact-verification').scrollIntoView({ block: 'center', behavior: 'smooth' });
    return;
  }

  const values = new FormData(form);
  const payload = Object.fromEntries(['name', 'email', 'company', 'service', 'message', 'website'].map((key) => [key, values.get(key) || '']));
  const serialised = JSON.stringify(payload);
  if (serialised !== lastPayload) {
    requestId = crypto.randomUUID();
    lastPayload = serialised;
  }
  sending = true;
  submitButton.disabled = true;
  editableFields.forEach((field) => { field.disabled = true; });
  form.setAttribute('aria-busy', 'true');
  submitLabel.textContent = 'Sending…';
  retryButton.hidden = true;
  setStatus('Sending your message…');
  let delivered = false;
  try {
    const response = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ ...payload, token, requestId }),
      signal: AbortSignal.timeout(20000),
    });
    const result = await response.json();
    if (!response.ok || result.success !== true) {
      setStatus(typeof result.error === 'string' ? result.error : 'We couldn’t send your message. Please try again or email us directly.', 'error');
      return;
    }
    delivered = true;
    form.reset();
    applyPreferredService();
    lastPayload = '';
    requestId = '';
    setStatus('Thank you—your message has been sent. We’ll be in touch.', 'success');
    formStatus.focus();
  } catch {
    setStatus('We couldn’t confirm your message was sent. Your details are still here—please try again, or contact us directly.', 'error');
  } finally {
    sending = false;
    form.removeAttribute('aria-busy');
    editableFields.forEach((field) => { field.disabled = false; });
    submitButton.disabled = false;
    submitLabel.textContent = 'Send message';
    token = '';
    // Keep the confirmation visible when the next verification completes.
    if (delivered) {
      window.turnstile.remove(widgetId);
      widgetId = undefined;
      submitButton.disabled = true;
      retryButton.textContent = 'Write another message';
      retryButton.hidden = false;
    } else if (widgetId !== undefined) {
      window.turnstile.reset(widgetId);
    }
  }
});

initialiseVerification();
