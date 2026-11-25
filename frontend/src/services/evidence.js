const MAX_FILE_SIZE = 8 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1440;

const toDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(new Error('Could not read the selected image.'));
  reader.readAsDataURL(blob);
});

export const prepareEvidenceImage = async (file) => {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error(`${file.name}: choose a JPG, PNG, or WebP image.`);
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`${file.name}: images must be smaller than 8 MB.`);
  }
  if (typeof createImageBitmap !== 'function') {
    throw new Error('This browser cannot prepare image previews. Try a current version of Chrome, Edge, or Firefox.');
  }

  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image editing is unavailable in this browser.');

    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.78));
    if (!blob) throw new Error(`Could not prepare ${file.name}.`);

    const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 40) || 'evidence';
    const name = `${baseName}.jpg`;
    return {
      id: crypto.randomUUID(),
      name,
      size: blob.size,
      type: blob.type,
      blob,
      previewUrl: await toDataUrl(blob),
    };
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error(`Could not prepare ${file.name}.`);
  } finally {
    bitmap?.close();
  }
};
