export const SERVICES = new Set([
  'Custom software', 'AI & automation', 'Website or platform',
  'Engineering & IT support', 'CampusControl', 'Masjid Management',
  'Amar Pirijpur', 'Something else',
]);

export const UNAVAILABLE = 'The form is temporarily unavailable. Please email ithub.com.bd@gmail.com or contact us on WhatsApp.';
export const RETRY = 'We couldn’t send your message. Please try again, or email ithub.com.bd@gmail.com directly.';
export const BODY_LIMIT = 32768;

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      ...extraHeaders,
    },
  });
}

export function isLocal(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname.endsWith('.test');
}

export function hasConfiguration(env, hostname) {
  const required = ['RESEND_API_KEY', 'CONTACT_FROM', 'CONTACT_TO', 'TURNSTILE_SITE_KEY', 'TURNSTILE_SECRET_KEY'];
  if (!required.every((key) => typeof env[key] === 'string' && env[key].trim())) return false;
  if (/[\r\n]/.test(env.CONTACT_FROM + env.CONTACT_TO)) return false;
  // Cloudflare's published test keys must never enable a publicly hosted form.
  if (!isLocal(hostname) && (/^[123]x/.test(env.TURNSTILE_SITE_KEY) || /^[123]x/.test(env.TURNSTILE_SECRET_KEY))) return false;
  return true;
}

export async function readLimitedJson(request) {
  const reader = request.body?.getReader();
  if (!reader) throw new SyntaxError('Missing body');
  const chunks = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > BODY_LIMIT) {
      await reader.cancel();
      throw new RangeError('Request too large');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

export function validate(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const limits = { name: 150, email: 254, company: 200, service: 80, message: 5000, token: 2048, requestId: 36, website: 200 };
  const cleaned = {};
  for (const [key, limit] of Object.entries(limits)) {
    const value = data[key] ?? '';
    if (typeof value !== 'string' || value.length > limit) return null;
    cleaned[key] = value.trim();
  }
  if (!cleaned.name || /[\x00-\x1f\x7f]/.test(cleaned.name + cleaned.email + cleaned.company)) return null;
  if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(cleaned.email)) return null;
  if (!SERVICES.has(cleaned.service) || cleaned.message.length < 10 || /\x00/.test(cleaned.message)) return null;
  if (!cleaned.token || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleaned.requestId)) return null;
  return cleaned;
}
