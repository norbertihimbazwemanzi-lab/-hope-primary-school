import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);

export interface StudentProgressLog {
  id: string;
  studentId: string;
  studentName: string;
  regNumber: string;
  gradeCode: string;
  stream?: string;
  date: string; // YYYY-MM-DD
  teacherId: string;
  teacherName: string;
  subject: string;
  academicPerformance: 'Excellent' | 'Proficient' | 'Developing' | 'Needs Support';
  academicScore?: number; // e.g. 85 / 100
  academicNotes: string;
  behaviorRating: 'Exemplary' | 'Good' | 'Fair' | 'Needs Improvement' | 'Concern';
  behavioralNotes: string;
  actionOrRecommendation?: string;
  parentNotified: boolean;
  createdAt: string;
  updatedAt?: string;
  source?: 'firebase-firestore' | 'local-store';
}

const LOCAL_STORAGE_KEY = 'mugina_student_progress_logs_v3';

// Helper to load locally cached logs
export const getCachedProgressLogs = (): StudentProgressLog[] => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Error reading cached progress logs:', e);
  }
  return [];
};

export const saveCachedProgressLogs = (logs: StudentProgressLog[]) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(logs));
  } catch (e) {
    console.error('Error saving cached progress logs:', e);
  }
};

/**
 * Save Student Progress Log to Firebase Firestore
 */
export const saveStudentProgressLogToFirebase = async (
  logData: Omit<StudentProgressLog, 'id' | 'createdAt' | 'source'>
): Promise<StudentProgressLog> => {
  const newId = `prog-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const now = new Date().toISOString();

  const newLog: StudentProgressLog = {
    ...logData,
    id: newId,
    createdAt: now,
    source: 'firebase-firestore',
  };

  // 1. Save to local cache immediately
  const existing = getCachedProgressLogs();
  const updated = [newLog, ...existing.filter((item) => item.id !== newId)];
  saveCachedProgressLogs(updated);

  // 2. Persist to Firebase Firestore
  try {
    const colRef = collection(db, 'student_progress_logs');
    await setDoc(doc(colRef, newId), {
      ...newLog,
      serverTimestamp: Timestamp.now(),
    });
    console.log('[Firebase Store] Student Progress Log saved successfully to Firestore:', newId);
  } catch (err) {
    console.warn('[Firebase Store] Firestore write notice, stored locally:', err);
  }

  return newLog;
};

/**
 * Fetch Student Progress Logs from Firebase Firestore with fallback to cached store
 */
export const fetchStudentProgressLogs = async (
  filterGrade?: string,
  filterStudentId?: string
): Promise<StudentProgressLog[]> => {
  const localLogs = getCachedProgressLogs();

  try {
    const colRef = collection(db, 'student_progress_logs');
    const querySnapshot = await getDocs(colRef);
    const firestoreLogs: StudentProgressLog[] = [];

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      firestoreLogs.push({
        id: docSnap.id,
        studentId: data.studentId || '',
        studentName: data.studentName || '',
        regNumber: data.regNumber || '',
        gradeCode: data.gradeCode || '',
        stream: data.stream || 'Stream A',
        date: data.date || '',
        teacherId: data.teacherId || '',
        teacherName: data.teacherName || '',
        subject: data.subject || 'General Studies',
        academicPerformance: data.academicPerformance || 'Proficient',
        academicScore: data.academicScore,
        academicNotes: data.academicNotes || '',
        behaviorRating: data.behaviorRating || 'Good',
        behavioralNotes: data.behavioralNotes || '',
        actionOrRecommendation: data.actionOrRecommendation || '',
        parentNotified: !!data.parentNotified,
        createdAt: data.createdAt || new Date().toISOString(),
        source: 'firebase-firestore',
      });
    });

    if (firestoreLogs.length > 0) {
      // Merge with local cache
      const map = new Map<string, StudentProgressLog>();
      [...firestoreLogs, ...localLogs].forEach((l) => map.set(l.id, l));
      const merged = Array.from(map.values()).sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      saveCachedProgressLogs(merged);

      return merged.filter((l) => {
        if (filterGrade && filterGrade !== 'ALL' && l.gradeCode !== filterGrade) return false;
        if (filterStudentId && l.studentId !== filterStudentId) return false;
        return true;
      });
    }
  } catch (err) {
    console.warn('[Firebase Store] Firestore read notice, using local cache:', err);
  }

  // Fallback to local logs
  return localLogs.filter((l) => {
    if (filterGrade && filterGrade !== 'ALL' && l.gradeCode !== filterGrade) return false;
    if (filterStudentId && l.studentId !== filterStudentId) return false;
    return true;
  });
};

/**
 * Delete a progress log from Firestore and local cache
 */
export const deleteStudentProgressLogInFirebase = async (id: string): Promise<void> => {
  // 1. Delete from local cache
  const localLogs = getCachedProgressLogs();
  const updated = localLogs.filter((l) => l.id !== id);
  saveCachedProgressLogs(updated);

  // 2. Delete from Firestore
  try {
    const docRef = doc(db, 'student_progress_logs', id);
    await deleteDoc(docRef);
    console.log('[Firebase Store] Student Progress Log deleted from Firestore:', id);
  } catch (err) {
    console.warn('[Firebase Store] Firestore delete notice:', err);
  }
};

/**
 * Save School Logo to Firebase Firestore
 */
export const saveSchoolLogoToFirebase = async (logoUrl: string): Promise<boolean> => {
  try {
    const docRef = doc(db, 'school_settings', 'branding');
    await setDoc(
      docRef,
      {
        schoolLogoUrl: logoUrl,
        updatedAt: new Date().toISOString(),
        updatedBy: 'Norbert Ihimbazwe Manzi (School Administrator)',
        serverTimestamp: Timestamp.now(),
      },
      { merge: true }
    );
    console.log('[Firebase Store] School Logo saved to Firestore branding doc');
    return true;
  } catch (err) {
    console.warn('[Firebase Store] Notice saving school logo to Firestore:', err);
    return false;
  }
};

/**
 * Fetch School Logo from Firebase Firestore (Public readable)
 */
export const fetchSchoolLogoFromFirebase = async (): Promise<string | null> => {
  try {
    const docRef = doc(db, 'school_settings', 'branding');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists() && docSnap.data().schoolLogoUrl) {
      return docSnap.data().schoolLogoUrl;
    }
  } catch (err) {
    console.warn('[Firebase Store] Notice fetching school logo from Firestore:', err);
  }
  return null;
};

/**
 * Real-time listener for School Logo changes across all devices
 */
export const subscribeToSchoolLogo = (callback: (logoUrl: string | null) => void): Unsubscribe => {
  try {
    const docRef = doc(db, 'school_settings', 'branding');
    return onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists() && docSnap.data().schoolLogoUrl) {
          callback(docSnap.data().schoolLogoUrl);
        }
      },
      (err) => {
        console.warn('[Firebase Store] School logo real-time listener notice:', err);
      }
    );
  } catch (err) {
    console.warn('[Firebase Store] Could not register school logo listener:', err);
    return () => {};
  }
};

/**
 * Save School Gallery Photo Item to Firebase Firestore
 * Guarantees cross-device visibility for all uploaded photos
 */
export const saveSchoolGalleryItemToFirebase = async (item: any): Promise<boolean> => {
  try {
    const itemId = item.id || `fac-${Date.now()}`;
    const docRef = doc(db, 'school_gallery', itemId);
    await setDoc(
      docRef,
      {
        ...item,
        id: itemId,
        updatedAt: new Date().toISOString(),
        serverTimestamp: Timestamp.now(),
      },
      { merge: true }
    );
    console.log('[Firebase Store] Gallery photo synced to Firestore:', itemId);
    return true;
  } catch (err) {
    console.warn('[Firebase Store] Firestore gallery write notice:', err);
    return false;
  }
};

/**
 * Fetch All School Gallery Photos from Firebase Firestore (Public readable)
 */
export const fetchSchoolGalleryFromFirebase = async (): Promise<any[]> => {
  try {
    const colRef = collection(db, 'school_gallery');
    const snapshot = await getDocs(colRef);
    const items: any[] = [];
    snapshot.forEach((docSnap) => {
      items.push({ id: docSnap.id, ...docSnap.data() });
    });
    return items;
  } catch (err) {
    console.warn('[Firebase Store] Firestore gallery fetch notice:', err);
    return [];
  }
};

/**
 * Real-time listener for School Gallery photos across all devices
 */
export const subscribeToSchoolGallery = (callback: (items: any[]) => void): Unsubscribe => {
  try {
    const colRef = collection(db, 'school_gallery');
    return onSnapshot(
      colRef,
      (snapshot) => {
        const items: any[] = [];
        snapshot.forEach((docSnap) => {
          items.push({ id: docSnap.id, ...docSnap.data() });
        });
        if (items.length > 0) {
          callback(items);
        }
      },
      (err) => {
        console.warn('[Firebase Store] School gallery real-time listener notice:', err);
      }
    );
  } catch (err) {
    console.warn('[Firebase Store] Could not register school gallery listener:', err);
    return () => {};
  }
};

/**
 * Delete School Gallery Photo from Firebase Firestore
 */
export const deleteSchoolGalleryItemFromFirebase = async (id: string): Promise<boolean> => {
  try {
    const docRef = doc(db, 'school_gallery', id);
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    console.warn('[Firebase Store] Firestore gallery delete notice:', err);
    return false;
  }
};

/**
 * Save School Registration Document to Firebase Firestore
 */
export const saveSchoolDocumentToFirebase = async (documentItem: any): Promise<boolean> => {
  try {
    const docId = documentItem.id || `doc-${Date.now()}`;
    const docRef = doc(db, 'school_documents', docId);
    await setDoc(
      docRef,
      {
        ...documentItem,
        id: docId,
        updatedAt: new Date().toISOString(),
        serverTimestamp: Timestamp.now(),
      },
      { merge: true }
    );
    console.log('[Firebase Store] Document synced to Firestore:', docId);
    return true;
  } catch (err) {
    console.warn('[Firebase Store] Firestore document write notice:', err);
    return false;
  }
};

/**
 * Fetch All School Registration Documents from Firebase Firestore (Public readable)
 */
export const fetchSchoolDocumentsFromFirebase = async (): Promise<any[]> => {
  try {
    const colRef = collection(db, 'school_documents');
    const snapshot = await getDocs(colRef);
    const items: any[] = [];
    snapshot.forEach((docSnap) => {
      items.push({ id: docSnap.id, ...docSnap.data() });
    });
    return items.sort((a, b) => (a.order || 0) - (b.order || 0));
  } catch (err) {
    console.warn('[Firebase Store] Firestore documents fetch notice:', err);
    return [];
  }
};

/**
 * Real-time listener for Registration Documents across all devices
 */
export const subscribeToSchoolDocuments = (callback: (docs: any[]) => void): Unsubscribe => {
  try {
    const colRef = collection(db, 'school_documents');
    return onSnapshot(
      colRef,
      (snapshot) => {
        const items: any[] = [];
        snapshot.forEach((docSnap) => {
          items.push({ id: docSnap.id, ...docSnap.data() });
        });
        if (items.length > 0) {
          callback(items.sort((a, b) => (a.order || 0) - (b.order || 0)));
        }
      },
      (err) => {
        console.warn('[Firebase Store] School documents real-time listener notice:', err);
      }
    );
  } catch (err) {
    console.warn('[Firebase Store] Could not register school documents listener:', err);
    return () => {};
  }
};

/**
 * Delete School Document from Firebase Firestore
 */
export const deleteSchoolDocumentFromFirebase = async (id: string): Promise<boolean> => {
  try {
    const docRef = doc(db, 'school_documents', id);
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    console.warn('[Firebase Store] Firestore document delete notice:', err);
    return false;
  }
};

/**
 * Save School Announcement to Firebase Firestore
 */
export const saveSchoolAnnouncementToFirebase = async (announcement: any): Promise<boolean> => {
  try {
    const annId = announcement.id || `ann-${Date.now()}`;
    const docRef = doc(db, 'school_announcements', annId);
    await setDoc(
      docRef,
      {
        ...announcement,
        id: annId,
        updatedAt: new Date().toISOString(),
        serverTimestamp: Timestamp.now(),
      },
      { merge: true }
    );
    console.log('[Firebase Store] Announcement synced to Firestore:', annId);
    return true;
  } catch (err) {
    console.warn('[Firebase Store] Firestore announcement write notice:', err);
    return false;
  }
};

/**
 * Fetch All School Announcements from Firebase Firestore (Public readable)
 */
export const fetchSchoolAnnouncementsFromFirebase = async (): Promise<any[]> => {
  try {
    const colRef = collection(db, 'school_announcements');
    const snapshot = await getDocs(colRef);
    const items: any[] = [];
    snapshot.forEach((docSnap) => {
      items.push({ id: docSnap.id, ...docSnap.data() });
    });
    return items;
  } catch (err) {
    console.warn('[Firebase Store] Firestore announcements fetch notice:', err);
    return [];
  }
};

/**
 * Real-time listener for School Announcements across all devices
 */
export const subscribeToSchoolAnnouncements = (callback: (items: any[]) => void): Unsubscribe => {
  try {
    const colRef = collection(db, 'school_announcements');
    return onSnapshot(
      colRef,
      (snapshot) => {
        const items: any[] = [];
        snapshot.forEach((docSnap) => {
          items.push({ id: docSnap.id, ...docSnap.data() });
        });
        if (items.length > 0) {
          callback(items);
        }
      },
      (err) => {
        console.warn('[Firebase Store] School announcements listener notice:', err);
      }
    );
  } catch (err) {
    console.warn('[Firebase Store] Could not register announcements listener:', err);
    return () => {};
  }
};

/**
 * Delete School Announcement from Firebase Firestore
 */
export const deleteSchoolAnnouncementFromFirebase = async (id: string): Promise<boolean> => {
  try {
    const docRef = doc(db, 'school_announcements', id);
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    console.warn('[Firebase Store] Firestore announcement delete notice:', err);
    return false;
  }
};

/**
 * Save Global Website Settings to Firebase Firestore
 */
export const saveWebsiteSettingsToFirebase = async (settings: any): Promise<boolean> => {
  try {
    const docRef = doc(db, 'school_settings', 'general');
    await setDoc(
      docRef,
      {
        ...settings,
        updatedAt: new Date().toISOString(),
        serverTimestamp: Timestamp.now(),
      },
      { merge: true }
    );
    console.log('[Firebase Store] Website settings synced to Firestore');
    return true;
  } catch (err) {
    console.warn('[Firebase Store] Firestore settings write notice:', err);
    return false;
  }
};

/**
 * Fetch Global Website Settings from Firebase Firestore (Public readable)
 */
export const fetchWebsiteSettingsFromFirebase = async (): Promise<any | null> => {
  try {
    const docRef = doc(db, 'school_settings', 'general');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data();
    }
  } catch (err) {
    console.warn('[Firebase Store] Firestore settings fetch notice:', err);
  }
  return null;
};

/**
 * Real-time listener for Website Settings across all devices
 */
export const subscribeToWebsiteSettings = (callback: (settings: any) => void): Unsubscribe => {
  try {
    const docRef = doc(db, 'school_settings', 'general');
    return onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          callback(docSnap.data());
        }
      },
      (err) => {
        console.warn('[Firebase Store] Website settings listener notice:', err);
      }
    );
  } catch (err) {
    console.warn('[Firebase Store] Could not register website settings listener:', err);
    return () => {};
  }
};

/**
 * Save Enrolled Student to Firebase Firestore
 */
export const saveEnrolledStudentToFirebase = async (student: any): Promise<boolean> => {
  try {
    const stuId = student.id || `stu-${Date.now()}`;
    const docRef = doc(db, 'enrolled_students', stuId);
    await setDoc(
      docRef,
      {
        ...student,
        id: stuId,
        updatedAt: new Date().toISOString(),
        serverTimestamp: Timestamp.now(),
      },
      { merge: true }
    );
    console.log('[Firebase Store] Enrolled student synced to Firestore:', stuId);
    return true;
  } catch (err) {
    console.warn('[Firebase Store] Firestore student write notice:', err);
    return false;
  }
};

/**
 * Fetch Enrolled Students from Firebase Firestore
 */
export const fetchEnrolledStudentsFromFirebase = async (): Promise<any[]> => {
  try {
    const colRef = collection(db, 'enrolled_students');
    const snapshot = await getDocs(colRef);
    const items: any[] = [];
    snapshot.forEach((docSnap) => {
      items.push({ id: docSnap.id, ...docSnap.data() });
    });
    return items;
  } catch (err) {
    console.warn('[Firebase Store] Firestore students fetch notice:', err);
    return [];
  }
};

/**
 * Delete Enrolled Student from Firebase Firestore
 */
export const deleteEnrolledStudentFromFirebase = async (id: string): Promise<boolean> => {
  try {
    const docRef = doc(db, 'enrolled_students', id);
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    console.warn('[Firebase Store] Firestore student delete notice:', err);
    return false;
  }
};
