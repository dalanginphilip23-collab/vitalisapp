// Module 6 — client-side compression for progress photos before they go into
// the DB (progress_photos.image_data is a data URL; ~896px JPEG keeps the
// pose readable at a few hundred KB).
export async function compressImage(dataUrl, maxWidth = 896, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = img.width > maxWidth ? maxWidth / img.width : 1;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not process image'));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('Image could not be read'));
    img.src = dataUrl;
  });
}
