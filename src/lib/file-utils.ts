/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import imageCompression from 'browser-image-compression';

/**
 * Converts a File object to a Base64 string with optional compression.
 * @param file The file to convert.
 * @param compress Whether to compress the image first.
 * @returns A promise that resolves with the Base64 string.
 */
export const fileToBase64 = async (file: File, compress = true): Promise<string> => {
  let fileToConvert = file;
  
  if (compress && file.type.startsWith('image/')) {
    const options = {
      maxSizeMB: 0.1, // Target 100KB
      maxWidthOrHeight: 1280,
      useWebWorker: true,
    };
    try {
      fileToConvert = await imageCompression(file, options);
    } catch (error) {
      console.error('Compression failed, using original file:', error);
    }
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(fileToConvert);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};
