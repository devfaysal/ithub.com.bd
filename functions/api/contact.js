import { BODY_LIMIT, hasConfiguration, isLocal, json, readLimitedJson, RETRY, UNAVAILABLE, validate } from '../../lib/contact.mjs';

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, { Allow: 'POST' });
  const url = new URL(request.url);
  if (request.headers.get('Origin') !== url.origin || request.headers.get('Sec-Fetch-Site') === 'cross-site') {
    return json({ error: 'Please send your enquiry from the ITHub contact page.' }, 403);
  }
  if (request.headers.get('Content-Type')?.split(';')[0].trim() !== 'application/json') {
    return json({ error: 'Unsupported request format.' }, 415);
  }
  if (Number(request.headers.get('Content-Length')) > BODY_LIMIT) return json({ error: 'Your message is too long.' }, 413);

  let data;
  try {
    data = await readLimitedJson(request);
  } catch (error) {
    return json({ error: error instanceof RangeError ? 'Your message is too long.' : 'Please check your enquiry and try again.' }, error instanceof RangeError ? 413 : 400);
  }

  // A populated off-screen field indicates an automated submission. No email is sent.
  if (data && typeof data.website === 'string' && data.website.trim()) {
    return json({ error: 'Please check your enquiry and try again.' }, 400);
  }
  const enquiry = validate(data);
  if (!enquiry) return json({ error: 'Please check your name, email, topic, and message, then try again.' }, 400);
  if (!hasConfiguration(env, url.hostname)) return json({ error: UNAVAILABLE }, 503);

  let verification;
  try {
    const verificationResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: env.TURNSTILE_SECRET_KEY,
        response: enquiry.token,
        remoteip: request.headers.get('CF-Connecting-IP') || undefined,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!verificationResponse.ok) return json({ error: 'Verification is temporarily unavailable. Please try again.' }, 503);
    verification = await verificationResponse.json();
  } catch {
    return json({ error: 'Verification is temporarily unavailable. Please try again.' }, 503);
  }

  const localTest = isLocal(url.hostname) && /^[123]x/.test(env.TURNSTILE_SECRET_KEY);
  if (!verification || verification.success !== true || (!localTest && (verification.hostname !== url.hostname || verification.action !== 'contact'))) {
    return json({ error: 'Please complete the verification again before sending.' }, 400);
  }

  try {
    const result = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `contact-${enquiry.requestId}`,
      },
      body: JSON.stringify({
        from: env.CONTACT_FROM,
        to: [env.CONTACT_TO],
        reply_to: enquiry.email,
        subject: `Website enquiry: ${enquiry.service}`,
        text: `New enquiry from the ITHub website\n\nName: ${enquiry.name}\nEmail: ${enquiry.email}\nOrganisation: ${enquiry.company || 'Not provided'}\nInterested in: ${enquiry.service}\n\nMessage:\n${enquiry.message}\n`,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!result.ok) return json({ error: RETRY }, 503);
    const receipt = await result.json();
    if (!receipt || typeof receipt.id !== 'string' || !receipt.id) return json({ error: RETRY }, 502);
    return json({ success: true, message: 'Thank you—your message has been sent. We’ll be in touch.' });
  } catch {
    return json({ error: RETRY }, 503);
  }
}
