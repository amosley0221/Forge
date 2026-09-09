import test from 'node:test';
import assert from 'node:assert/strict';
import { STYLES, DEFAULT_SETTINGS, styleById, stylePhrase } from '../dist/index.js';

test('the stored ids stay what existing projects already saved', () => {
  // Changing these would silently reset the style on every existing install.
  assert.deepEqual(
    STYLES.map((s) => s.id),
    ['toon', 'hand-painted', 'low-poly', 'realistic PBR', 'voxel'],
  );
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
