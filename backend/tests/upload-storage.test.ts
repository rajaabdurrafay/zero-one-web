import {test} from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {getUploadsRoot} from '../src/utils/uploadStorage';

test('Hostinger releases share uploads across version swaps; local storage stays isolated', () => {
  const root = path.resolve('hosting', 'hbuilds');
  const before = path.join(root, 'versions', 'old-release', 'nodejs');
  const after = path.join(root, 'versions', 'new-release', 'nodejs');
  assert.equal(getUploadsRoot(before, undefined, true), path.join(root, 'uploads'));
  assert.equal(getUploadsRoot(after, undefined, true), getUploadsRoot(before, undefined, true));
  assert.equal(getUploadsRoot(path.join(root, 'current', 'nodejs'), undefined, true), path.join(root, 'uploads'));
  assert.equal(getUploadsRoot(before, undefined, false), path.join(before, 'uploads'));
  const local = path.resolve('.local');
  assert.equal(getUploadsRoot(local, undefined, false), path.join(local, 'uploads'));
  assert.equal(getUploadsRoot(local, undefined, true), path.join(local, 'uploads'));
  assert.equal(getUploadsRoot(before, local, true), local);
});
