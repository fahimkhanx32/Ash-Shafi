/**
 * Downscale an image File to a square-bounded JPEG data URL (default 256px,
 * quality 0.85) so a profile picture stays small enough to store on the user
 * record. Rejects non-images and undecodable files.
 */
export function resizeImageToDataUrl(file, maxSize = 256, quality = 0.85) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type)) {
      reject(new Error('Please choose a JPEG, PNG or WebP image.'));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      // Centre-crop to a square so avatars are never stretched.
      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) / 2;
      const out = Math.min(maxSize, side);
      const canvas = document.createElement('canvas');
      canvas.width = out;
      canvas.height = out;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, out, out);
      ctx.drawImage(img, sx, sy, side, side, 0, 0, out, out);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That image could not be read.'));
    };
    img.src = url;
  });
}
