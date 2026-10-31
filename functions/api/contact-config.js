import { hasConfiguration, json, UNAVAILABLE } from '../../lib/contact.mjs';

export function onRequest({ request, env }) {
  if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405, { Allow: 'GET' });
  if (!hasConfiguration(env, new URL(request.url).hostname)) return json({ error: UNAVAILABLE }, 503);
  return json({ siteKey: env.TURNSTILE_SITE_KEY });
}
