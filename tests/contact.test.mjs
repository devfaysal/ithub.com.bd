import { test, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { onRequest as submit } from '../functions/api/contact.js';
import { onRequest as configure } from '../functions/api/contact-config.js';
import { BODY_LIMIT } from '../lib/contact.mjs';

const env = {
  RESEND_API_KEY: 'fake-key-for-tests',
  CONTACT_FROM: 'ITHub Website <website@notify.ithub.com.bd>',
  CONTACT_TO: 'ithub.com.bd@gmail.com',
  TURNSTILE_SITE_KEY: '0x-test-public-key',
  TURNSTILE_SECRET_KEY: '0x-test-private-key',
};
const enquiry = {
  name: 'Test Visitor', email: 'visitor@example.org', company: 'Example organisation',
  service: 'AI & automation', message: 'Please help us automate our document processing.',
  website: '', token: 'verification-token', requestId: '4b7526da-d0a2-44e0-8742-315ae947dd85',
};
function request(payload = enquiry, headers = {}, origin = 'https://ithub.com.bd') {
  return new Request(`${origin}/api/contact`, {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(payload),
  });
}
function validVerification(overrides = {}) {
  return Response.json({ success: true, hostname: 'ithub.com.bd', action: 'contact', ...overrides });
}
afterEach(() => mock.restoreAll());

test('sends to the configured inbox and sets the visitor as Reply-To', async () => {
  const calls = [];
  mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options });
    if (url.includes('siteverify')) return validVerification();
    return Response.json({ id: 'accepted-message' });
  });
  const response = await submit({ request: request(), env });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).success, true);
  assert.equal(calls.length, 2);
  const mail = JSON.parse(calls[1].options.body);
  assert.deepEqual(mail.to, [env.CONTACT_TO]);
  assert.equal(mail.from, env.CONTACT_FROM);
  assert.equal(mail.reply_to, enquiry.email);
  assert.equal(mail.subject, 'Website enquiry: AI & automation');
  assert.ok(mail.text.includes(enquiry.message));
  assert.equal(mail.html, undefined);
  assert.equal(calls[1].options.headers['Idempotency-Key'], `contact-${enquiry.requestId}`);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('retries the same enquiry with the same email idempotency key', async () => {
  const keys = [];
  mock.method(globalThis, 'fetch', async (url, options) => {
    if (url.includes('siteverify')) return validVerification();
    keys.push(options.headers['Idempotency-Key']);
    return Response.json({ id: 'same-message' });
  });
  await submit({ request: request(), env });
  await submit({ request: request({ ...enquiry, token: 'new-verification-token' }), env });
  assert.equal(keys.length, 2);
  assert.equal(keys[0], keys[1]);
});

test('does not send email if verification fails, has the wrong hostname, or wrong action', async () => {
  for (const override of [{ success: false }, { hostname: 'other.example' }, { action: 'login' }, { success: 'true' }]) {
    const fetch = mock.method(globalThis, 'fetch', async () => validVerification(override));
    const response = await submit({ request: request(), env });
    assert.equal(response.status, 400);
    assert.equal(fetch.mock.callCount(), 1);
    fetch.mock.restore();
  }
});

test('does not send email when verification is unavailable or malformed', async () => {
  for (const result of [() => new Response('Unavailable', { status: 503 }), () => new Response('not json'), () => { throw new Error('Network failure'); }]) {
    const fetch = mock.method(globalThis, 'fetch', async () => result());
    const response = await submit({ request: request(), env });
    assert.equal(response.status, 503);
    assert.equal(fetch.mock.callCount(), 1);
    fetch.mock.restore();
  }
});

test('never reports success for a rejected email or missing delivery receipt', async () => {
  for (const result of [() => new Response('Provider detail with private information', { status: 429 }), () => Response.json({}), () => { throw new Error('Timeout'); }]) {
    mock.method(globalThis, 'fetch', async (url) => url.includes('siteverify') ? validVerification() : result());
    const response = await submit({ request: request(), env });
    assert.ok(response.status >= 500);
    const body = await response.json();
    assert.notEqual(body.success, true);
    assert.ok(!JSON.stringify(body).includes('Provider detail'));
    mock.restoreAll();
  }
});

test('rejects malformed fields before contacting either service', async () => {
  const fetch = mock.method(globalThis, 'fetch', async () => { throw new Error('Must not call'); });
  for (const override of [
    { name: '' }, { email: 'invalid' }, { email: 'person@example.org\r\nBcc: x@example.org' },
    { company: ['unexpected'] }, { message: 'short' }, { message: 'x'.repeat(5001) },
    { service: 'unlisted' }, { token: '' }, { token: 'x'.repeat(2049) },
    { requestId: 'invalid' }, { name: '<script>safe as text</script>', website: 'https://spam.example' },
  ]) {
    assert.equal((await submit({ request: request({ ...enquiry, ...override }), env })).status, 400);
  }
  assert.equal(fetch.mock.callCount(), 0);
});

test('rejects cross-origin submissions, wrong methods, and unsupported content types', async () => {
  const fetch = mock.method(globalThis, 'fetch', async () => { throw new Error('Must not call'); });
  assert.equal((await submit({ request: request(enquiry, { Origin: 'https://unrelated.example' }), env })).status, 403);
  assert.equal((await submit({ request: request(enquiry, { 'Sec-Fetch-Site': 'cross-site' }), env })).status, 403);
  assert.equal((await submit({ request: new Request('https://ithub.com.bd/api/contact'), env })).status, 405);
  assert.equal((await submit({ request: request(enquiry, { 'Content-Type': 'text/plain' }), env })).status, 415);
  assert.equal(fetch.mock.callCount(), 0);
});

test('rejects oversized requests even without a Content-Length header', async () => {
  assert.equal((await submit({ request: request({ ...enquiry, message: 'x'.repeat(BODY_LIMIT) }), env })).status, 413);
  assert.equal((await submit({ request: request(enquiry, { 'Content-Length': String(BODY_LIMIT + 1) }), env })).status, 413);
});

test('handles invalid JSON and non-object JSON', async () => {
  const broken = new Request('https://ithub.com.bd/api/contact', {
    method: 'POST', headers: { Origin: 'https://ithub.com.bd', 'Content-Type': 'application/json' }, body: '{broken',
  });
  assert.equal((await submit({ request: broken, env })).status, 400);
  for (const payload of [null, [], 'text', 123]) {
    assert.equal((await submit({ request: request(payload), env })).status, 400);
  }
});

test('fails closed if configuration is missing and never exposes secrets', async () => {
  for (const key of Object.keys(env)) {
    const incomplete = { ...env, [key]: '' };
    const response = await submit({ request: request(), env: incomplete });
    assert.equal(response.status, 503);
  }
  const response = configure({ request: new Request('https://ithub.com.bd/api/contact-config'), env });
  assert.deepEqual(await response.json(), { siteKey: env.TURNSTILE_SITE_KEY });
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  const unavailable = configure({ request: new Request('https://ithub.com.bd/api/contact-config'), env: {} });
  assert.equal(unavailable.status, 503);
});

test('rejects published Turnstile test keys on public hosts', async () => {
  const testKeys = { ...env, TURNSTILE_SITE_KEY: '1x00000000000000000000AA', TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA' };
  assert.equal((await submit({ request: request(), env: testKeys })).status, 503);
  assert.equal(configure({ request: new Request('https://ithub.com.bd/api/contact-config'), env: testKeys }).status, 503);
  assert.equal(configure({ request: new Request('http://localhost:8788/api/contact-config'), env: testKeys }).status, 200);
});
