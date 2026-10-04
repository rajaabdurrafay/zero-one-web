import {test} from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import {getUploadsRoot} from '../src/utils/uploadStorage';
import {processOfferBanner} from '../src/utils/offerBanner';

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

test('offer banners save validated images in the persistent uploads root', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zeroone-offer-test-'));
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aFOsAAAAASUVORK5CYII=';
  try {
    assert.equal(processOfferBanner(undefined, root), undefined);
    assert.equal(processOfferBanner(null, root), null);
    assert.equal(processOfferBanner('/uploads/offers/existing.png', root), '/uploads/offers/existing.png');
    const url = processOfferBanner(png, root)!;
    assert.match(url, /^\/uploads\/offers\/offer_[\w-]+\.png$/);
    assert.deepEqual(fs.readFileSync(path.join(root, 'offers', path.basename(url))), Buffer.from(png.split(',')[1], 'base64'));
    assert.throws(() => processOfferBanner('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=', root));
    assert.throws(() => processOfferBanner('data:image/png;base64,PGh0bWw+PC9odG1sPg==', root));
    assert.equal(fs.readdirSync(path.join(root, 'offers')).length, 1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
