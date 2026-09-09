import test from 'node:test';
import assert from 'node:assert/strict';
import { setHttpImpl, riggingStatus } from '../dist/index.js';

/**
 * A rig is charged when Meshy accepts it. A finished job whose download URL we
 * cannot locate therefore costs real credits and reports a failure for work
 * that succeeded — which is exactly what happened. These are the response
 * shapes the URL search has to survive.
 */

const GLB = 'https://assets.meshy.ai/tasks/abc/model.glb';
const SIGNED = 'https://assets.meshy.ai/tasks/abc/download?token=xyz';
const reply = (body) =>
  setHttpImpl(async () => new Response(JSON.stringify(body), { status: 200 }), 'stub');

const succeeded = async () => {
  const s = await riggingStatus('k', 't');
  assert.equal(s.state, 'succeeded');
  return s.modelUrl;
};

test('finds it under the key "glb"', async () => {
  reply({ status: 'SUCCEEDED', model_urls: { glb: GLB } });
  assert.equal(await succeeded(), GLB);
});

test('finds it under a differently named urls object', async () => {
  reply({ status: 'SUCCEEDED', result: { rigged_model_urls: { glb: GLB } } });
  assert.equal(await succeeded(), GLB);
});

test('finds it when the key is not "glb" but the URL plainly is', async () => {
  reply({ status: 'SUCCEEDED', rigged_model_url: GLB });
  assert.equal(await succeeded(), GLB);
});

test('prefers the .glb over other formats offered alongside it', async () => {
  reply({
    status: 'SUCCEEDED',
    model_urls: {
      fbx: 'https://assets.meshy.ai/tasks/abc/model.fbx',
      usdz: 'https://assets.meshy.ai/tasks/abc/model.usdz',
      glb: GLB,
    },
  });
  assert.equal(await succeeded(), GLB);
});

test('falls back to a key that says glb when the URL is signed and has no extension', async () => {
  reply({ status: 'SUCCEEDED', downloads: { glb_url: SIGNED, fbx_url: 'https://x/y?token=1' } });
  assert.equal(await succeeded(), SIGNED);
});

test('finds it several levels down', async () => {
  reply({ status: 'SUCCEEDED', result: { output: { assets: { model: { glb: GLB } } } } });
  assert.equal(await succeeded(), GLB);
});

test('when there is genuinely no model, the error names what did come back', async () => {
  reply({ status: 'SUCCEEDED', result: { thumbnail_url: 'https://x/y.png' } });
  await assert.rejects(riggingStatus('k', 't'), /URLs present: thumbnail_url/);
});
