import test from 'node:test';
import assert from 'node:assert/strict';
import { appendActivity, mergeActivity, newActivity, ACTIVITY_LIMIT } from '../dist/index.js';

const at = (id, time, message = id) => ({ id, at: time, device: 'desktop', message });

test('newest entry comes first', () => {
  const log = appendActivity([at('a', 1)], at('b', 2));
  assert.deepEqual(log.map((e) => e.id), ['b', 'a']);
});

test('the log is capped, dropping only the oldest', () => {
  let log = [];
  for (let i = 0; i < ACTIVITY_LIMIT + 25; i++) log = appendActivity(log, at(`e${i}`, i));
  assert.equal(log.length, ACTIVITY_LIMIT);
  assert.equal(log[0].id, `e${ACTIVITY_LIMIT + 24}`);
});

test('merging two devices keeps both histories, newest first', () => {
  const desktop = [at('d2', 40), at('d1', 10)];
  const phone = [at('p2', 30), at('p1', 20)];
  assert.deepEqual(
    mergeActivity(desktop, phone).map((e) => e.id),
    ['d2', 'p2', 'p1', 'd1'],
  );
});

test('a device that has been offline cannot have its history erased', () => {
  const offlineWork = [at('x1', 5), at('x2', 6)];
  const merged = mergeActivity([], offlineWork);
  assert.deepEqual(merged.map((e) => e.id).sort(), ['x1', 'x2']);
});

test('the same entry seen twice is not duplicated', () => {
  const shared = at('same', 7);
  assert.equal(mergeActivity([shared], [{ ...shared }]).length, 1);
});

test('a real entry carries a unique id, the device and a timestamp', () => {
  const a = newActivity('Rover rigged', 'android', 'asset1');
  const b = newActivity('Rover rigged', 'android', 'asset1');
  assert.notEqual(a.id, b.id);
  assert.equal(a.device, 'android');
  assert.equal(a.assetId, 'asset1');
  assert.ok(a.at > 0);
});
