import { initializeApp, getApps, getApp } from 'firebase/app';
import { getStorage, ref, uploadBytesResumable, getDownloadURL, uploadString } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

import { getSupabaseClient } from './supabaseClient';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const storage = getStorage(app);

export interface UploadResult {
  url: string;
  source: 'firebase-storage' | 'supabase-storage' | 'cloud-optimized-data-uri' | 'server-upload' | 'base64';
  error?: string;
  fileName?: string;
  fileSize?: string;
  fileType?: string;
}

const STORAGE_TIMEOUT_MS = 1800;
let firebaseStorageUnavailable = false;
let supabaseBucketUnavailable = false;

const withStorageTimeout = <T,>(promise: PromiseLike<T>, ms: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error('Storage upload timeout'));
      }
    }, ms);
    Promise.resolve(promise).then(
      (val) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(val);
        }
      },
      (err) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(err);
        }
      }
    );
  });

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

/**
 * Optimizes and compresses an image in the browser (max 1200px, ~78-82% quality).
 * Produces a lightweight, highly compatible data URI (~40KB-140KB)
 * that safely fits within cloud database records (Supabase + Firestore + Express)
 * and renders identically across all browsers and devices.
 */
export const compressImageForCloud = async (
  fileOrBase64: File | string,
  maxDimension = 1200,
  quality = 0.8,
  preserveTransparency = false
): Promise<string> => {
  if (typeof window === 'undefined') {
    return typeof fileOrBase64 === 'string' ? fileOrBase64 : '';
  }

  // Keep compact SVGs intact as crisp vector data URIs
  if (fileOrBase64 instanceof File && fileOrBase64.type === 'image/svg+xml' && fileOrBase64.size <= 160 * 1024) {
    return readFileAsDataUrl(fileOrBase64);
  }
  if (typeof fileOrBase64 === 'string' && fileOrBase64.startsWith('data:image/svg+xml') && fileOrBase64.length <= 220000) {
    return fileOrBase64;
  }

  return new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const handleLoad = () => {
      let width = img.naturalWidth || img.width || maxDimension;
      let height = img.naturalHeight || img.height || maxDimension;

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, width);
      canvas.height = Math.max(1, height);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(img.src);
        return;
      }

      if (preserveTransparency) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const pngUri = canvas.toDataURL('image/png');
        if (pngUri.length <= 180000) {
          resolve(pngUri);
          return;
        }
      }

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      let currentQuality = quality;
      let compressedUri = canvas.toDataURL('image/jpeg', currentQuality);
      while (compressedUri.length > 220000 && currentQuality > 0.45) {
        currentQuality = Number((currentQuality - 0.1).toFixed(2));
        compressedUri = canvas.toDataURL('image/jpeg', currentQuality);
      }
      resolve(compressedUri);
    };

    img.onload = handleLoad;

    img.onerror = () => {
      if (typeof fileOrBase64 === 'string') {
        resolve(fileOrBase64);
      } else {
        readFileAsDataUrl(fileOrBase64).then(resolve).catch(reject);
      }
    };

    if (typeof fileOrBase64 === 'string') {
      img.src = fileOrBase64;
    } else {
      readFileAsDataUrl(fileOrBase64)
        .then((dataUrl) => {
          img.src = dataUrl;
        })
        .catch(reject);
    }
  });
};

/**
 * Uploads an image file to cloud storage or compresses to a portable cloud data URI.
 * Guaranteed to resolve fast without hanging and remain visible across all devices, browsers, and hosts.
 */
export const uploadSchoolAsset = async (
  fileOrBase64: File | string,
  fileName: string,
  category: string = 'gallery'
): Promise<UploadResult> => {
  const cleanName = fileName.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const timestamp = Date.now();
  const isBranding = category === 'branding';
  const isPngOrWebp =
    fileOrBase64 instanceof File
      ? /png|webp|svg/i.test(fileOrBase64.type)
      : /^data:image\/(png|webp|svg)/i.test(fileOrBase64);
  const storagePath = `school-assets/${category}/${timestamp}_${cleanName}.jpg`;

  // Always compress image first so it is lightweight and cloud-database portable
  let compressedDataUrl = '';
  try {
    compressedDataUrl = await compressImageForCloud(
      fileOrBase64,
      isBranding ? 900 : 1200,
      0.8,
      isBranding && isPngOrWebp
    );
  } catch (compErr) {
    console.warn('Compression notice, proceeding with raw data:', compErr);
    if (typeof fileOrBase64 === 'string') {
      compressedDataUrl = fileOrBase64;
    } else {
      compressedDataUrl = await readFileAsDataUrl(fileOrBase64);
    }
  }

  // 1. Try Firebase Storage (strict timeout so unprovisioned buckets never stall UI)
  if (!firebaseStorageUnavailable) {
    try {
      const storageRef = ref(storage, storagePath);
      if (compressedDataUrl) {
        await withStorageTimeout(uploadString(storageRef, compressedDataUrl, 'data_url'), STORAGE_TIMEOUT_MS);
        const downloadURL = await withStorageTimeout(getDownloadURL(storageRef), STORAGE_TIMEOUT_MS);
        return { url: downloadURL, source: 'firebase-storage' };
      } else if (fileOrBase64 instanceof File) {
        const task = uploadBytesResumable(storageRef, fileOrBase64);
        const uploadSnap = await withStorageTimeout(
          new Promise<typeof task.snapshot>((res, rej) => task.then(res, rej)),
          STORAGE_TIMEOUT_MS
        );
        const downloadURL = await withStorageTimeout(getDownloadURL(uploadSnap.ref), STORAGE_TIMEOUT_MS);
        return { url: downloadURL, source: 'firebase-storage' };
      }
    } catch (firebaseStorageError: any) {
      firebaseStorageUnavailable = true;
      console.warn(
        'Firebase Storage upload notice (proceeding to cloud data storage):',
        firebaseStorageError?.message || firebaseStorageError
      );
    }
  }

  // 2. Try Supabase Storage (if 'school-media' bucket exists)
  if (!supabaseBucketUnavailable) {
    try {
      const supabase = getSupabaseClient();
      if (supabase && compressedDataUrl) {
        const parts = compressedDataUrl.split(',');
        const mimeMatch = parts[0]?.match(/data:([^;]+);base64/i);
        const mimeType = mimeMatch?.[1] || 'image/jpeg';
        const ext = mimeType.includes('png') ? 'png' : mimeType.includes('svg') ? 'svg' : 'jpg';
        const base64Content = parts[1];
        if (base64Content) {
          const byteCharacters = atob(base64Content);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: mimeType });

          const sbPath = `public/${timestamp}_${cleanName}.${ext}`;
          const { data: uploadData, error: sbErr } = await withStorageTimeout(
            supabase.storage
              .from('school-media')
              .upload(sbPath, blob, { contentType: mimeType, upsert: true }),
            STORAGE_TIMEOUT_MS
          );

          if (!sbErr && uploadData) {
            const { data: publicUrlData } = supabase.storage.from('school-media').getPublicUrl(sbPath);
            if (publicUrlData?.publicUrl) {
              return { url: publicUrlData.publicUrl, source: 'supabase-storage' };
            }
          } else {
            supabaseBucketUnavailable = true;
          }
        }
      }
    } catch {
      supabaseBucketUnavailable = true;
    }
  }

  // 3. Fallback: Return the optimized, highly-compressed Cloud Data URI.
  // Stored directly inside Supabase and Express records so every visitor on every device/browser sees it!
  if (compressedDataUrl) {
    return {
      url: compressedDataUrl,
      source: 'cloud-optimized-data-uri',
    };
  }

  if (typeof fileOrBase64 === 'string') {
    return { url: fileOrBase64, source: 'base64' };
  }

  throw new Error('Unable to process image file for cloud storage.');
};

/**
 * Uploads a school document (PDF, Word, Form template) to Firebase Storage or server/cloud fallback
 */
export const uploadSchoolDocument = async (
  file: File,
  documentTitle: string
): Promise<UploadResult> => {
  const cleanName = file.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const timestamp = Date.now();
  const storagePath = `school-assets/documents/${timestamp}_${cleanName}`;
  const fileSizeStr =
    file.size < 1024 * 1024
      ? `${(file.size / 1024).toFixed(1)} KB`
      : `${(file.size / (1024 * 1024)).toFixed(2)} MB`;

  // 1. Try Firebase Storage with timeout
  if (!firebaseStorageUnavailable) {
    try {
      const storageRef = ref(storage, storagePath);
      const metadata = {
        contentType: file.type || 'application/pdf',
        customMetadata: {
          title: documentTitle,
          originalName: file.name,
        },
      };
      const task = uploadBytesResumable(storageRef, file, metadata);
      const uploadSnap = await withStorageTimeout(
        new Promise<typeof task.snapshot>((res, rej) => task.then(res, rej)),
        STORAGE_TIMEOUT_MS * 2
      );
      const downloadURL = await withStorageTimeout(getDownloadURL(uploadSnap.ref), STORAGE_TIMEOUT_MS);
      return {
        url: downloadURL,
        source: 'firebase-storage',
        fileName: file.name,
        fileSize: fileSizeStr,
        fileType: file.type || 'application/pdf',
      };
    } catch (storageError: any) {
      firebaseStorageUnavailable = true;
      console.warn(
        'Firebase Storage document upload notice (falling back to server/base64):',
        storageError?.message || storageError
      );
    }
  }

  // 2. Fallback to Express backend /api/upload or portable Data URI
  try {
    const base64Data = await readFileAsDataUrl(file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileData: base64Data,
          fileName: cleanName,
          category: 'documents',
          title: documentTitle || file.name,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.asset?.imageSrc) {
          return {
            url: data.asset.imageSrc,
            source: 'server-upload',
            fileName: file.name,
            fileSize: fileSizeStr,
            fileType: file.type || 'application/pdf',
          };
        }
      }
    } catch {
      // Static host fallback uses portable base64 below
    }

    return {
      url: base64Data,
      source: 'base64',
      fileName: file.name,
      fileSize: fileSizeStr,
      fileType: file.type || 'application/pdf',
    };
  } catch (serverErr: any) {
    console.warn('Document upload fallback error:', serverErr);
    throw new Error('Unable to upload document file. Please verify file format.');
  }
};

