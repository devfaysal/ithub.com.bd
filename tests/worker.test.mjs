import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.mjs';

test('routes contact API requests to the form handlers rather than static assets', async () => {
  const env = { ASSETS: { fetch() { throw new Error('API must not be served as an asset'); } } };
  const contact = await worker.fetch(new Request('https://ithub.com.bd/api/contact'), env);
  assert.equal(contact.status, 405);
  assert.equal(contact.headers.get('Allow'), 'POST');
  const config = await worker.fetch(new Request('https://ithub.com.bd/api/contact-config'), env);
  assert.equal(config.status, 503);
  assert.equal(config.headers.get('Cache-Control'), 'no-store');
});

test('unknown API endpoints return JSON 404s', async () => {
  const response = await worker.fetch(new Request('https://ithub.com.bd/api/missing'), {});
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: 'Not found.' });
});

test('passes page requests, query strings, and asset responses through unchanged', async () => {
  const request = new Request('https://ithub.com.bd/contact/?service=CampusControl');
  const assetResponse = new Response('custom 404', { status: 404, headers: { 'X-Test': 'preserved' } });
  const env = { ASSETS: { fetch(actualRequest) {
    assert.equal(actualRequest, request);
    return assetResponse;
  } } };
  const response = await worker.fetch(request, env);
  assert.equal(response, assetResponse);
  assert.equal(response.status, 404);
  assert.equal(response.headers.get('X-Test'), 'preserved');
});
