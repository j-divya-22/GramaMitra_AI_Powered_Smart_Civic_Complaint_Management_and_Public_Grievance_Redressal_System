import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {
  getUploadDirectory,
  resolveUploadedFilePath,
  toRelativeUploadPath,
} from '../src/utils/uploadPaths.js';

test('resolves a stored image only within the configured upload directory', () => {
  const filename = 'replacement-image.jpg';
  assert.equal(
    resolveUploadedFilePath(toRelativeUploadPath(filename)),
    path.join(getUploadDirectory(), filename)
  );
});

test('rejects stored paths that escape or do not match the upload directory', () => {
  assert.throws(() => resolveUploadedFilePath('../private.jpg'));
  assert.throws(() => resolveUploadedFilePath('uploads/complaints/../private.jpg'));
  assert.throws(() => toRelativeUploadPath('nested/replacement.jpg'));
});
