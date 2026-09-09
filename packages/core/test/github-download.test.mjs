import test from 'node:test';
import assert from 'node:assert/strict';
import { setHttpImpl, downloadModel } from '../dist/index.js';

/**
 * Sync failed with a bare "Failed to fetch" because the signed-URL downloads
 * were the one path with no error handling around them. These pin both the
 * routing and the message.
 */

const cfg = { owner: 'me', repo: 'lib', branch: 'main', token: 't' };
const bigMeta = { sha: 's', size: 5e6, download_url: 'https://raw.githubusercontent.com/me/lib/main/models/a.glb?token=x' };

/** Serve each URL from a table; anything unlisted is a transport failure. */
const serve = (routes) => {
  const seen = [];
  setHttpImpl(async (url, init) => {
    seen.push(String(url));
    for (const [match, make] of routes) {
      if (String(url).includes(match)) return make(init);
    }
    throw new TypeError('Failed to fetch');
  }, 'stub');
  return seen;
};

const json = (body) => async () => new Response(JSON.stringify(body), { status: 200 });

test('a large model is fetched from the API host, not the signed URL', async () => {
  const seen = serve([
    ['accept-raw', null],
    ['api.github.com', async (init) => {
      const accept = new Headers(init?.headers).get('accept');
      if (accept === 'application/vnd.github.raw') return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
      return new Response(JSON.stringify(bigMeta), { status: 200 });
    }],
  ]);
  const blob = await downloadModel(cfg, 'a');
  assert.equal(blob.size, 3);
  assert.ok(!seen.some((u) => u.includes('raw.githubusercontent.com')), 'must not need the signed host');
});

test('a small model still comes back inline', async () => {
  serve([['api.github.com', json({ sha: 's', size: 12, content: btoa('hello'), encoding: 'base64' })]]);
  const blob = await downloadModel(cfg, 'a');
  assert.equal(await blob.text(), 'hello');
});

test('the signed URL is the fallback when the raw request is refused', async () => {
  const seen = serve([
    ['api.github.com', async (init) => {
      const accept = new Headers(init?.headers).get('accept');
      if (accept === 'application/vnd.github.raw') return new Response('nope', { status: 415 });
      return new Response(JSON.stringify(bigMeta), { status: 200 });
    }],
    ['raw.githubusercontent.com', async () => new Response(new Uint8Array([9]), { status: 200 })],
  ]);
  const blob = await downloadModel(cfg, 'a');
  assert.equal(blob.size, 1);
  assert.ok(seen.some((u) => u.includes('raw.githubusercontent.com')));
});

test('a transport failure on the signed URL names the host and the file', async () => {
  serve([
    ['api.github.com', async (init) => {
      const accept = new Headers(init?.headers).get('accept');
      if (accept === 'application/vnd.github.raw') return new Response('nope', { status: 415 });
      return new Response(JSON.stringify(bigMeta), { status: 200 });
    }],
  ]);
  await assert.rejects(downloadModel(cfg, 'a'), (e) => {
    assert.match(e.message, /model a/);
    assert.match(e.message, /raw\.githubusercontent\.com/);
    assert.match(e.message, /Failed to fetch/);
    return true;
  });
});

test('a missing model is absent, not an error', async () => {
  serve([['api.github.com', async () => new Response('{}', { status: 404 })]]);
  assert.equal(await downloadModel(cfg, 'gone'), null);
});
