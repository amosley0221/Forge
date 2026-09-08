import test from 'node:test';
import assert from 'node:assert/strict';
import { setHttpImpl, riggingStatus } from '../dist/index.js';

/**
 * Meshy is inconsistent about wrapping its responses, and getting this wrong is
 * expensive: a rig is charged on acceptance, so a status shape we misread costs
 * real credits and shows the user nothing. These are the shapes it has been
 * seen to return, plus the one that must fail loudly.
 */

const GLB = 'https://assets.meshy.ai/rigged.glb';
const replyWith = (body) =>
  setHttpImpl(async () => new Response(JSON.stringify(body), { status: 200 }), 'stub');

test('reads a flat in-progress job', async () => {
  replyWith({ id: 't', status: 'IN_PROGRESS', progress: 42 });
  assert.deepEqual(await riggingStatus('k', 't'), { state: 'running', progress: 42 });
});

test('reads a flat succeeded job and finds the GLB', async () => {
  replyWith({ id: 't', status: 'SUCCEEDED', result: { rigged_model_urls: { glb: GLB } } });
  const s = await riggingStatus('k', 't');
  assert.equal(s.state, 'succeeded');
  assert.equal(s.modelUrl, GLB);
});

test("surfaces Meshy's own failure message", async () => {
  replyWith({ id: 't', status: 'FAILED', task_error: { message: 'Model is not humanoid' } });
  const s = await riggingStatus('k', 't');
  assert.equal(s.state, 'failed');
  assert.equal(s.error, 'Model is not humanoid');
});

test('reads a job wrapped in result, rather than calling it queued forever', async () => {
  replyWith({ result: { id: 't', status: 'IN_PROGRESS', progress: 17 } });
  assert.deepEqual(await riggingStatus('k', 't'), { state: 'running', progress: 17 });
});

test('reads a wrapped succeeded job', async () => {
  replyWith({ result: { id: 't', status: 'SUCCEEDED', model_urls: { glb: GLB } } });
  const s = await riggingStatus('k', 't');
  assert.equal(s.state, 'succeeded');
  assert.equal(s.modelUrl, GLB);
});

test('a response with no status anywhere fails loudly and names the fields', async () => {
  replyWith({ id: 't', foo: 1, bar: 2 });
  await assert.rejects(riggingStatus('k', 't'), /unexpected response \(fields: id, foo, bar\)/);
});
