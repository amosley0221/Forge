import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeName, MAX_NAME } from '../dist/assets.js';

test('keeps a plain title, turning spaces into underscores', () => {
  assert.equal(sanitizeName('Ray Calder'), 'Ray_Calder');
  assert.equal(sanitizeName('  wasteland   rover  '), 'wasteland_rover');
});

test('case is the user’s, not ours', () => {
  assert.equal(sanitizeName('RAY'), 'RAY');
});

test('strips anything that would break an export path', () => {
  assert.equal(sanitizeName('../../etc/passwd'), 'etcpasswd');
  assert.equal(sanitizeName('ray "the boss" calder'), 'ray_the_boss_calder');
  assert.equal(sanitizeName('model/v2'), 'modelv2');
  assert.equal(sanitizeName('.hidden'), 'hidden');
});

test('folds accents rather than dropping the letter', () => {
  assert.equal(sanitizeName('Renée'), 'Renee');
});

test('refuses a title with nothing usable in it', () => {
  assert.equal(sanitizeName('***'), null);
  assert.equal(sanitizeName('   '), null);
  assert.equal(sanitizeName(''), null);
});

test('sidesteps Windows reserved device names', () => {
  assert.equal(sanitizeName('con'), 'con_');
  assert.equal(sanitizeName('LPT1'), 'LPT1_');
  assert.equal(sanitizeName('console'), 'console');
});

test('caps the length and never ends on a separator', () => {
  const long = sanitizeName('a'.repeat(80));
  assert.equal(long.length, MAX_NAME);
  assert.equal(sanitizeName('rover ' + 'x'.repeat(60)).endsWith('_'), false);
});
