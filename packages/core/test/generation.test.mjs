import test from 'node:test';
import assert from 'node:assert/strict';
import { setHttpImpl, runGeneration } from '../dist/index.js';

/**
 * A model is charged on acceptance, so a stage aimed at the wrong endpoint
 * costs real credits and then fails. This is the shape of the bug that sent an
 * image-to-3D task to the text-to-3D refine endpoint and got back
 * "Preview task not found".
 */

const GLB = 'https://assets.meshy.ai/model.glb';

function fakeProvider(calls) {
  return {
    id: 'meshy',
    name: 'Fake',
    keyPlaceholder: '',
    keysUrl: '',
    async validateKey() {
      return { ok: true, message: 'ok' };
    },
    async textTo3D() {
      calls.push('textTo3D');
      return 'text-task';
    },
    async imageTo3D() {
      calls.push('imageTo3D');
      return 'img:image-task';
    },
    async status() {
      return { state: 'succeeded', progress: 100, modelUrl: GLB };
    },
    textureStage: {
      label: 'Painting',
      sources: ['text'],
      async start(_key, meshTaskId) {
        calls.push(`textureStage(${meshTaskId})`);
        return 'texture-task';
      },
    },
  };
}

const stubDownload = () =>
  setHttpImpl(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 }), 'stub');

test('a text generation runs the texture stage', async () => {
  stubDownload();
  const calls = [];
  await runGeneration({
    provider: fakeProvider(calls),
    apiKey: 'k',
    source: 'text',
    prompt: 'a rover',
    texture: true,
    pollMs: 1,
  });
  assert.deepEqual(calls, ['textTo3D', 'textureStage(text-task)']);
});

test('an image generation does not, because that endpoint cannot resolve its id', async () => {
  stubDownload();
  const calls = [];
  await runGeneration({
    provider: fakeProvider(calls),
    apiKey: 'k',
    source: 'image',
    prompt: 'this character',
    imageUrl: 'data:image/png;base64,AAAA',
    texture: true,
    pollMs: 1,
  });
  assert.deepEqual(calls, ['imageTo3D']);
});

test('both stages are reported as paid the moment they are accepted', async () => {
  stubDownload();
  const paid = [];
  await runGeneration({
    provider: fakeProvider([]),
    apiKey: 'k',
    source: 'text',
    prompt: 'a rover',
    texture: true,
    pollMs: 1,
    onTaskCreated: (id, stage) => paid.push(`${stage}:${id}`),
  });
  assert.deepEqual(paid, ['mesh:text-task', 'texture:texture-task']);
});

test('turning texturing off skips the stage entirely', async () => {
  stubDownload();
  const calls = [];
  await runGeneration({
    provider: fakeProvider(calls),
    apiKey: 'k',
    source: 'text',
    prompt: 'a rover',
    texture: false,
    pollMs: 1,
  });
  assert.deepEqual(calls, ['textTo3D']);
});
