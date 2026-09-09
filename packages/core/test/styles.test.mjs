import test from 'node:test';
import assert from 'node:assert/strict';
import { STYLES, DEFAULT_SETTINGS, styleById, stylePhrase } from '../dist/index.js';

test('ids that existing projects already saved are never renamed', () => {
  // Adding a style is fine. Renaming or removing one silently resets the style
  // on every install that had it selected, which is why this is pinned.
  const ids = STYLES.map((s) => s.id);
  for (const saved of ['toon', 'hand-painted', 'low-poly', 'realistic PBR', 'voxel']) {
    assert.ok(ids.includes(saved), `${saved} was renamed or removed`);
  }
});

test('the stylised styles stay distinct from each other', () => {
  // Three of these live near one another; if two ever sent the same wording
  // the picker would be lying about offering a choice.
  const phrases = STYLES.map((s) => s.phrase);
  assert.equal(new Set(phrases).size, phrases.length);
});

test('no two styles share an id', () => {
  const ids = STYLES.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('the default style is one that actually exists', () => {
  assert.ok(styleById(DEFAULT_SETTINGS.style));
});

test('every style explains itself and sends real wording', () => {
  for (const style of STYLES) {
    assert.ok(style.description.length > 30, `${style.id} needs a description`);
    assert.ok(style.looksLike.length > 0, `${style.id} needs a reference`);
    // A bare word is what made the setting opaque in the first place.
    assert.ok(style.phrase.split(/[ ,]+/).length >= 6, `${style.id} phrase is too thin`);
  }
});

test('an unknown style falls back to its own id rather than sending nothing', () => {
  assert.equal(stylePhrase('something-else'), 'something-else');
});

test('a known style sends its full phrase, not its label', () => {
  assert.equal(stylePhrase('toon'), styleById('toon').phrase);
  assert.notEqual(stylePhrase('toon'), 'toon');
});

test('viewer preferences that used to be component state are remembered', () => {
  // Turntable reset itself on every desktop launch and could not be turned off
  // on Android at all, because it was not part of settings.
  assert.equal(typeof DEFAULT_SETTINGS.turntable, 'boolean');
  assert.equal(typeof DEFAULT_SETTINGS.textured, 'boolean');
  assert.ok([2048, 4096].includes(DEFAULT_SETTINGS.textureSize));
});
