import { handleContact } from '../lib/contact-submit.mjs';
import { handleContactConfig } from '../lib/contact-config.mjs';
import { json } from '../lib/contact.mjs';

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/contact') return handleContact({ request, env });
    if (pathname === '/api/contact-config') return handleContactConfig({ request, env });
    if (pathname.startsWith('/api/')) return json({ error: 'Not found.' }, 404);
    return env.ASSETS.fetch(request);
  },
};
