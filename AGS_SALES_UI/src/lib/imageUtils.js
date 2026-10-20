/**
 * Utility functions for local image processing, compression, and handling
 * Eliminates dependency on external third-party hosts like ImgBB.
 */

/**
 * Checks if a value is a valid image source (URL or Data URI)
 */
export const isImageUrl = (val) => {
  if (!val || typeof val !== 'string') return false;
  const s = val.trim();
  return s.startsWith('http://') || 
         s.startsWith('https://') || 
         s.startsWith('data:image/') || 
         s.startsWith('blob:') || 
         s.startsWith('/media/') ||
         s.startsWith('./') ||
         s.startsWith('/');
};

/**
 * Compresses an image File/Blob and converts it to a Base64 Data URL.
 * Automatically resizes large images to fit within maxWidth / maxHeight.
 */
export const fileToDataUrl = (file, maxWidth = 600, maxHeight = 400, quality = 0.85) => {
  return new Promise((resolve, reject) => {
    if (!file) {
      return reject(new Error('No se proporcionó ningún archivo'));
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Error al leer el archivo'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('El archivo no es una imagen válida'));
      img.onload = () => {
        try {
          let { width, height } = img;

          // Scale down if larger than dimensions
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            return resolve(e.target.result); // Fallback to raw dataUrl
          }

          ctx.drawImage(img, 0, 0, width, height);

          // Preserve PNG transparency or use JPEG for smaller footprint
          const isPng = file.type === 'image/png';
          const outputType = isPng ? 'image/png' : 'image/jpeg';
          const dataUrl = canvas.toDataURL(outputType, quality);
          resolve(dataUrl);
        } catch (err) {
          console.warn('Canvas compression failed, falling back to original dataUrl:', err);
          resolve(e.target.result);
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
};

/**
 * Converts a local file path (from Electron dialog) to an optimized Base64 Data URL.
 */
export const localPathToDataUrl = (localPath, maxWidth = 600, maxHeight = 400, quality = 0.85) => {
  return new Promise((resolve, reject) => {
    try {
      const fs = window.require ? window.require('fs') : null;
      const path = window.require ? window.require('path') : null;
      
      if (!fs) {
        throw new Error('Acceso al sistema de archivos local no disponible');
      }

      const fileBuffer = fs.readFileSync(localPath);
      const ext = path ? path.extname(localPath).toLowerCase().replace('.', '') : 'png';
      const mime = (ext === 'jpg' || ext === 'jpeg') ? 'image/jpeg' : (ext === 'webp' ? 'image/webp' : 'image/png');
      const rawBase64 = `data:${mime};base64,${fileBuffer.toString('base64')}`;

      // Optimize and resize with canvas
      const img = new Image();
      img.onerror = () => resolve(rawBase64); // Fallback if image load fails
      img.onload = () => {
        try {
          let { width, height } = img;
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(rawBase64);

          ctx.drawImage(img, 0, 0, width, height);
          const outputType = ext === 'png' ? 'image/png' : 'image/jpeg';
          resolve(canvas.toDataURL(outputType, quality));
        } catch (e) {
          resolve(rawBase64);
        }
      };
      img.src = rawBase64;
    } catch (err) {
      console.error('Error al procesar archivo local:', err);
      reject(err);
    }
  });
};

/**
 * Prevents the default browser action of navigating away when a file is dropped
 * anywhere on the window. Essential to avoid "white screen of death" on drag-and-drop.
 */
let isDragDropInitialized = false;
export const initGlobalDragDropProtection = () => {
  if (isDragDropInitialized || typeof window === 'undefined') return;
  isDragDropInitialized = true;

  window.addEventListener('dragover', (e) => {
    e.preventDefault();
  }, false);

  window.addEventListener('drop', (e) => {
    e.preventDefault();
  }, false);
};
