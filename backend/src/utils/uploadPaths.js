import path from 'path';
import { unlink } from 'node:fs/promises';

export const getUploadDirectory = () => {
  const uploadDirectory = path.resolve(process.cwd(), process.env.UPLOAD_DIR || './uploads/complaints');
  const relativeDirectory = path.relative(process.cwd(), uploadDirectory);
  if (
    path.isAbsolute(relativeDirectory) ||
    relativeDirectory === '..' ||
    relativeDirectory.startsWith(`..${path.sep}`)
  ) {
    throw new Error('UPLOAD_DIR must be inside the project directory.');
  }

  return uploadDirectory;
};

export const toRelativeUploadPath = (filename) => {
  if (
    typeof filename !== 'string' ||
    !filename ||
    filename === '.' ||
    filename === '..' ||
    path.isAbsolute(filename) ||
    path.basename(filename) !== filename ||
    filename.includes('/') ||
    filename.includes('\\')
  ) {
    throw new Error('Invalid uploaded filename.');
  }

  const uploadDirectory = getUploadDirectory();
  const relativeDirectory = path.relative(process.cwd(), uploadDirectory);
  return path.posix.join(relativeDirectory.split(path.sep).join('/'), filename);
};

export const resolveUploadedFilePath = (storedPath) => {
  if (typeof storedPath !== 'string' || !storedPath) {
    throw new Error('Invalid stored upload path.');
  }

  const normalizedPath = storedPath.replace(/\\/g, '/');
  const filename = path.posix.basename(normalizedPath);
  if (normalizedPath !== toRelativeUploadPath(filename)) {
    throw new Error('Stored upload path is outside the configured upload directory.');
  }

  const absolutePath = path.resolve(process.cwd(), ...normalizedPath.split('/'));
  if (path.dirname(absolutePath) !== getUploadDirectory()) {
    throw new Error('Stored upload path is outside the configured upload directory.');
  }
  return absolutePath;
};

export const removeUploadedFile = async (storedPath) => {
  try {
    await unlink(resolveUploadedFilePath(storedPath));
    return null;
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    return error;
  }
};
