// Client-side downscaling for avatar uploads. The backend PUT /api/profile/update
// rejects avatar_url payloads over 200KB, and browser photo files easily exceed
// that as base64 — so every upload is resized to a small JPEG that always fits.
// Mirrors Log/utils/compressImage.js, sized for a circle avatar.
const MAX_DIMENSION = 256;
const MAX_CHARS = 190 * 1024; // safety margin under the backend's 200KB cap

export function compressAvatarFile(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('Please select an image file.'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Image could not be read'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Image could not be read'));
      img.onload = () => {
        const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not process image'));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        // Lower quality until the data URL clears the backend cap.
        let quality = 0.9;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        while (dataUrl.length > MAX_CHARS && quality > 0.3) {
          quality -= 0.15;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        resolve(dataUrl);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
