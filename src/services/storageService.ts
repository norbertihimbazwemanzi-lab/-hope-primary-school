import { initializeApp, getApps, getApp } from 'firebase/app';
import { getStorage, ref, uploadBytesResumable, getDownloadURL, uploadString } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const storage = getStorage(app);

export interface UploadResult {
  url: string;
  source: 'firebase-storage' | 'server-upload' | 'base64';
  error?: string;
  fileName?: string;
  fileSize?: string;
  fileType?: string;
}

/**
 * Uploads an image file or base64 data to Firebase Storage.
 * If Firebase Storage is unavailable or restricted by permissions/CORS,
 * it automatically falls back to the backend /api/upload endpoint so administrators
 * can always upload photos without disruption.
 */
export const uploadSchoolAsset = async (
  fileOrBase64: File | string,
  fileName: string,
  category: string = 'gallery'
): Promise<UploadResult> => {
  const cleanName = fileName.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const timestamp = Date.now();
  const storagePath = `school-assets/${category}/${timestamp}_${cleanName}`;

  // 1. Try Firebase Storage
  try {
    const storageRef = ref(storage, storagePath);
    if (typeof fileOrBase64 === 'string') {
      // Base64 Data URL
      await uploadString(storageRef, fileOrBase64, 'data_url');
      const downloadURL = await getDownloadURL(storageRef);
      return { url: downloadURL, source: 'firebase-storage' };
    } else {
      // File object
      const uploadTask = await uploadBytesResumable(storageRef, fileOrBase64);
      const downloadURL = await getDownloadURL(uploadTask.ref);
      return { url: downloadURL, source: 'firebase-storage' };
    }
  } catch (storageError: any) {
    console.warn('Firebase Storage upload notice (falling back to server endpoint):', storageError?.message || storageError);

    // 2. Fallback to Express backend /api/upload
    try {
      let base64Data = '';
      if (typeof fileOrBase64 === 'string') {
        base64Data = fileOrBase64;
      } else {
        base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(fileOrBase64);
        });
      }

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileData: base64Data,
          fileName: cleanName,
          category,
          title: fileName,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.asset?.imageSrc) {
          return { url: data.asset.imageSrc, source: 'server-upload' };
        }
      }

      // If server returned ok with base64 data or fallback
      return { url: base64Data, source: 'base64' };
    } catch (serverErr: any) {
      console.warn('Server upload fallback:', serverErr);
      if (typeof fileOrBase64 === 'string') {
        return { url: fileOrBase64, source: 'base64' };
      }
      throw new Error('Unable to upload image file. Please check file format and try again.');
    }
  }
};

/**
 * Uploads a school document (PDF, Word, Form template) to Firebase Storage
 * Stored under school-assets/documents/
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

  // 1. Try Firebase Storage
  try {
    const storageRef = ref(storage, storagePath);
    const metadata = {
      contentType: file.type || 'application/pdf',
      customMetadata: {
        title: documentTitle,
        originalName: file.name,
      },
    };
    const uploadTask = await uploadBytesResumable(storageRef, file, metadata);
    const downloadURL = await getDownloadURL(uploadTask.ref);
    return {
      url: downloadURL,
      source: 'firebase-storage',
      fileName: file.name,
      fileSize: fileSizeStr,
      fileType: file.type || 'application/pdf',
    };
  } catch (storageError: any) {
    console.warn(
      'Firebase Storage document upload notice (falling back to server endpoint):',
      storageError?.message || storageError
    );

    // 2. Fallback to Express backend /api/upload
    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

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

      return {
        url: base64Data,
        source: 'base64',
        fileName: file.name,
        fileSize: fileSizeStr,
        fileType: file.type || 'application/pdf',
      };
    } catch (serverErr: any) {
      console.warn('Server document upload fallback error:', serverErr);
      throw new Error('Unable to upload document file. Please verify file format.');
    }
  }
};

