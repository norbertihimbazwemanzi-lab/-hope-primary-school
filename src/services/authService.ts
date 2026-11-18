import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  signInAnonymously,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { getStaffMembers, getEnrolledStudents, updateEnrolledStudent, UserRole, CurrentSessionUser } from './adminStore';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

/**
 * Ensures the administrator has an active Firebase Auth identity
 * so Firestore security rules recognize the authorized session.
 */
export const ensureAdminFirebaseAuth = async (): Promise<User | null> => {
  if (auth.currentUser) return auth.currentUser;
  try {
    const cred = await signInAnonymously(auth);
    return cred.user;
  } catch (err) {
    console.warn('[Auth Service] Firebase anonymous auth notice:', err);
    return null;
  }
};

// Standard Google Auth Provider for identity verification
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

let cachedAccessToken: string | null = null;
let isSigningIn = false;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      const token = cachedAccessToken || (await user.getIdToken().catch(() => 'firebase-token'));
      if (onAuthSuccess) onAuthSuccess(user, token);
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

/**
 * Firebase Google Sign-In with popup
 * Securely verifies user identity against Google & Firebase Authentication
 */
export const googleSignIn = async (): Promise<{ user: User; accessToken: string }> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    cachedAccessToken = credential?.accessToken || (await result.user.getIdToken());
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Firebase Google Sign-In Error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Firebase Email and Password Sign-In
 */
export const emailPasswordSignIn = async (
  email: string,
  pass: string
): Promise<{ user: User | null; fallbackStaff?: CurrentSessionUser }> => {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    return { user: cred.user };
  } catch (err: any) {
    // If user not registered in Firebase Auth or provider not enabled, check staff registry
    console.warn('Firebase email auth notice:', err?.code || err?.message);
    const allStaff = getStaffMembers();
    const cleanUser = email.trim().toLowerCase();
    const match = allStaff.find(
      (s) =>
        (s.username.toLowerCase() === cleanUser || s.email.toLowerCase() === cleanUser) &&
        s.password === pass &&
        s.status === 'Active'
    );
    if (match) {
      const staffSession: CurrentSessionUser = {
        id: match.id,
        name: match.name,
        role: match.role as UserRole,
        username: match.username,
        email: match.email,
        phone: match.phone,
        photoUrl: match.photoUrl,
        bio: match.bio,
        assignedSubjectOrGrade: match.assignedSubjectOrGrade,
      };
      return { user: null, fallbackStaff: staffSession };
    }
    throw err;
  }
};

/**
 * Resolves an authenticated Firebase identity to their strict institutional staff or parent role.
 * Replaces manual role switching with zero-trust identity-based access control.
 */
export type RoleResolutionResult =
  | { authorized: true; session: CurrentSessionUser; firebaseUser: User }
  | { authorized: false; email: string; reason: string };

export const resolveStaffRoleForFirebaseUser = (firebaseUser: User): RoleResolutionResult => {
  const userEmail = (firebaseUser.email || '').toLowerCase().trim();

  // 1. Primary requested Administrator (Norbert Ihimbazwe Manzi)
  if (userEmail === 'norbertihimbazwemanzi@gmail.com') {
    return {
      authorized: true,
      firebaseUser,
      session: {
        id: firebaseUser.uid,
        name: firebaseUser.displayName || 'Norbert Ihimbazwe Manzi (School Administrator)',
        role: 'Admin',
        username: 'norbertihimbazwemanzi@gmail.com',
        email: 'norbertihimbazwemanzi@gmail.com',
        assignedSubjectOrGrade: 'Chief Administrator & Portal Controller',
      },
    };
  }

  // 2. Headteacher / School Principal
  if (
    userEmail === 'headteacher@muginahopeschool.com' ||
    userEmail === 'hopeprimaryschool@gmail.com' ||
    userEmail === 'hopeprimaryschool'
  ) {
    return {
      authorized: true,
      firebaseUser,
      session: {
        id: firebaseUser.uid,
        name: firebaseUser.displayName || 'Headteacher / School Principal',
        role: 'Admin',
        username: 'hopeprimaryschool',
        email: userEmail,
        assignedSubjectOrGrade: 'Executive School Leadership & Administration',
      },
    };
  }

  // 3. Registered Enrolled Staff Members (SuperAdmin, SchoolAdmin, HeadTeacher, DOS, DOD, Teacher, Accountant/Finance, Registrar)
  const staffList = getStaffMembers();
  const staffMatch = staffList.find(
    (s) =>
      s.status === 'Active' &&
      (s.email.toLowerCase() === userEmail ||
        s.username.toLowerCase() === userEmail ||
        (userEmail && s.email.toLowerCase().includes(userEmail)))
  );

  if (staffMatch) {
    return {
      authorized: true,
      firebaseUser,
      session: {
        id: staffMatch.id,
        name: staffMatch.name,
        role: staffMatch.role as UserRole,
        username: staffMatch.username,
        email: staffMatch.email,
        phone: staffMatch.phone,
        photoUrl: staffMatch.photoUrl,
        bio: staffMatch.bio,
        assignedSubjectOrGrade: staffMatch.assignedSubjectOrGrade,
      },
    };
  }

  // 4. Verified Parent / Guardian email matched to enrolled learners
  const enrolledStudents = getEnrolledStudents();
  const linkedChildren = enrolledStudents.filter(
    (st) => userEmail && st.parentEmail && st.parentEmail.toLowerCase().trim() === userEmail
  );
  if (linkedChildren.length > 0) {
    const primaryParentName = linkedChildren[0].parentName || firebaseUser.displayName || 'Parent / Guardian';
    return {
      authorized: true,
      firebaseUser,
      session: {
        id: `parent-${userEmail}`,
        name: primaryParentName,
        role: 'Parent',
        username: userEmail,
        email: userEmail,
        linkedStudentIds: linkedChildren.map((c) => c.id),
      },
    };
  }

  // 5. Unauthorized User: Not in authorized staff or parent directory
  return {
    authorized: false,
    email: userEmail || 'No email associated with account',
    reason:
      'This Google / Firebase identity is not enrolled in the Mugina Hope Academy staff or parent directory. Access is restricted to verified school personnel and registered guardians.',
  };
};

/**
 * Credential authentication for Parents (Parent Email/Phone + Student Reg# or 'parent2026')
 * and Students (Student Username or Reg# + Student Password)
 */
export const authenticateParentAccount = (
  identifier: string,
  secret: string
): CurrentSessionUser | null => {
  const cleanId = identifier.trim().toLowerCase();
  const cleanPhone = cleanId.replace(/\s+/g, '');
  const cleanSecret = secret.trim();
  if (!cleanId || !cleanSecret) return null;

  const students = getEnrolledStudents();
  const matchedChildren = students.filter((s) => {
    const pEmail = (s.parentEmail || '').trim().toLowerCase();
    const pPhone = (s.parentPhone || '').replace(/\s+/g, '').toLowerCase();
    return (pEmail && pEmail === cleanId) || (pPhone && (pPhone === cleanPhone || pPhone.endsWith(cleanPhone)));
  });

  if (matchedChildren.length === 0) return null;

  // Parent verifies using child's registration number, child's studentPassword, or shared guardian PIN 'parent2026'
  const isSecretValid =
    cleanSecret.toLowerCase() === 'parent2026' ||
    matchedChildren.some(
      (c) =>
        c.regNumber.toLowerCase() === cleanSecret.toLowerCase() ||
        c.studentPassword === cleanSecret
    );

  if (!isSecretValid) return null;

  return {
    id: `parent-${matchedChildren[0].parentEmail || cleanId}`,
    name: matchedChildren[0].parentName || 'Parent / Guardian',
    role: 'Parent',
    username: matchedChildren[0].parentEmail || identifier.trim(),
    email: matchedChildren[0].parentEmail || '',
    linkedStudentIds: matchedChildren.map((c) => c.id),
  };
};

const STUDENT_TOKEN_KEY = 'mugina_student_bearer_token';
const STAFF_TOKEN_KEY = 'mugina_staff_bearer_token';

export const getStaffAuthToken = (): string | null => {
  try {
    return sessionStorage.getItem(STAFF_TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setStaffAuthToken = (token: string | null) => {
  try {
    if (token) sessionStorage.setItem(STAFF_TOKEN_KEY, token);
    else sessionStorage.removeItem(STAFF_TOKEN_KEY);
  } catch {
    // ignore
  }
};

export const getStudentAuthToken = (): string | null => {
  try {
    return sessionStorage.getItem(STUDENT_TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setStudentAuthToken = (token: string | null) => {
  try {
    if (token) sessionStorage.setItem(STUDENT_TOKEN_KEY, token);
    else sessionStorage.removeItem(STUDENT_TOKEN_KEY);
  } catch {
    // ignore
  }
};

export type StaffLoginResult =
  | { authorized: true; session: CurrentSessionUser }
  | { authorized: false; reason: string; networkError?: boolean };

export const authenticateStaffWithBackend = async (
  identifier: string,
  secret: string
): Promise<StaffLoginResult> => {
  const cleanId = identifier.trim();
  const cleanSecret = secret.trim();
  if (!cleanSecret && !cleanId) {
    return { authorized: false, reason: 'Please enter your username/email and password.' };
  }

  try {
    const res = await fetch('/api/auth/staff-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: cleanId, password: cleanSecret }),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success && data.session) {
      if (data.token) setStaffAuthToken(data.token);
      return { authorized: true, session: data.session as CurrentSessionUser };
    }

    return {
      authorized: false,
      reason:
        data.error ||
        (res.status === 403
          ? 'This staff account is currently deactivated. Contact School Administration.'
          : 'Invalid staff username, email, or password.'),
    };
  } catch {
    // Network unreachable: fallback only to synced client staff registry
    const allStaff = getStaffMembers();
    const match = allStaff.find(
      (s) =>
        (s.username.toLowerCase() === cleanId.toLowerCase() ||
          s.email.toLowerCase() === cleanId.toLowerCase()) &&
        s.password &&
        s.password === cleanSecret &&
        s.status === 'Active'
    );
    if (match) {
      return {
        authorized: true,
        session: {
          id: match.id,
          name: match.name,
          role: match.role as UserRole,
          username: match.username,
          email: match.email,
          phone: match.phone,
          photoUrl: match.photoUrl,
          bio: match.bio,
          assignedSubjectOrGrade: match.assignedSubjectOrGrade,
        },
      };
    }
    return {
      authorized: false,
      networkError: true,
      reason: 'Could not reach authentication server and no matching offline credential was found.',
    };
  }
};

export const exchangeFirebaseTokenForStaffSession = async (
  firebaseUser: User
): Promise<{ success: boolean; session?: CurrentSessionUser }> => {
  try {
    const idToken = await firebaseUser.getIdToken();
    const res = await fetch('/api/auth/staff-firebase-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    if (!res.ok) return { success: false };
    const data = await res.json().catch(() => ({}));
    if (data.success && data.token) {
      setStaffAuthToken(data.token);
      return { success: true, session: data.session as CurrentSessionUser };
    }
  } catch {
    // non-fatal when offline
  }
  return { success: false };
};

export const requestPasswordReset = async (
  email: string
): Promise<{ success: boolean; message: string; rateLimited?: boolean }> => {
  try {
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 429) {
      return {
        success: false,
        rateLimited: true,
        message: data.error || 'Too many password reset requests. Please try again in 15 minutes.',
      };
    }
    if (!res.ok) {
      return {
        success: false,
        message: data.error || 'Unable to process password reset request at this time.',
      };
    }
    return {
      success: true,
      message:
        data.message ||
        'If an account exists for that email address, password reset instructions have been sent.',
    };
  } catch {
    return {
      success: false,
      message: 'Network error while connecting to password reset service. Please try again.',
    };
  }
};

export const verifyResetToken = async (
  token: string
): Promise<{ valid: boolean; reason?: string; expiresAt?: string }> => {
  try {
    const res = await fetch(`/api/auth/verify-reset-token?token=${encodeURIComponent(token.trim())}`);
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.valid) {
      return { valid: true, expiresAt: data.expiresAt };
    }
    return { valid: false, reason: data.error || 'This password reset link is invalid or has expired.' };
  } catch {
    return { valid: false, reason: 'Could not verify reset token. Please check your connection.' };
  }
};

export const submitPasswordReset = async (
  token: string,
  newPassword: string,
  confirmPassword: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token.trim(), newPassword, confirmPassword }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      return {
        success: true,
        message: data.message || 'Your password has been updated securely. You may now sign in.',
      };
    }
    return {
      success: false,
      message: data.error || 'Unable to reset password. Please request a new reset link.',
    };
  } catch {
    return {
      success: false,
      message: 'Network error while updating password. Please try again.',
    };
  }
};

export const authenticateStudentAccount = (
  identifier: string,
  secret: string
): CurrentSessionUser | null => {
  const cleanId = identifier.trim().toLowerCase();
  const cleanSecret = secret.trim();
  if (!cleanId || !cleanSecret) return null;

  const students = getEnrolledStudents();
  const student = students.find(
    (s) =>
      ((s.studentUsername || '').toLowerCase() === cleanId || (s.regNumber || '').toLowerCase() === cleanId) &&
      s.studentPassword === cleanSecret
  );

  if (!student) return null;
  if (student.studentAccountActive === false || student.status !== 'Active') {
    return null;
  }

  return {
    id: student.id,
    name: student.fullName,
    role: 'Student',
    username: student.studentUsername || student.regNumber,
    email: student.parentEmail || '',
    assignedSubjectOrGrade: `${student.gradeCode} (${student.stream || 'Stream A'})`,
    linkedStudentIds: [student.id],
  };
};

export type StudentLoginResult =
  | { authorized: true; session: CurrentSessionUser }
  | { authorized: false; reason: string };

export const authenticateStudentWithBackend = async (
  identifier: string,
  secret: string
): Promise<StudentLoginResult> => {
  const cleanId = identifier.trim();
  const cleanSecret = secret.trim();
  if (!cleanId || !cleanSecret) {
    return { authorized: false, reason: 'Please enter your Student ID / Username and password.' };
  }

  // 1. Try server-verified login endpoint first
  try {
    const res = await fetch('/api/auth/student-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: cleanId, password: cleanSecret }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.session) {
        if (data.token) setStudentAuthToken(data.token);
        return { authorized: true, session: data.session as CurrentSessionUser };
      }
    } else if (res.status === 403) {
      const errData = await res.json().catch(() => ({}));
      return {
        authorized: false,
        reason: errData.error || 'This student account is currently deactivated. Contact School Administration.',
      };
    }
  } catch {
    // Fall back to synced cloud client check if server offline
  }

  // 2. Check synced Supabase / Firebase / cached student directory
  const students = getEnrolledStudents();
  const matched = students.find(
    (s) =>
      ((s.studentUsername || '').toLowerCase() === cleanId.toLowerCase() ||
        (s.regNumber || '').toLowerCase() === cleanId.toLowerCase()) &&
      s.studentPassword === cleanSecret
  );

  if (!matched) {
    return {
      authorized: false,
      reason: 'Invalid Student ID / Username or password. Contact the DOS or School Administration office.',
    };
  }

  if (matched.studentAccountActive === false || matched.status !== 'Active') {
    return {
      authorized: false,
      reason: `Student portal access is currently ${
        matched.status !== 'Active' ? matched.status : 'deactivated'
      }. Please contact School Administration.`,
    };
  }

  const session: CurrentSessionUser = {
    id: matched.id,
    name: matched.fullName,
    role: 'Student',
    username: matched.studentUsername || matched.regNumber,
    email: matched.parentEmail || '',
    assignedSubjectOrGrade: `${matched.gradeCode} (${matched.stream || 'Stream A'})`,
    linkedStudentIds: [matched.id],
  };

  // Sync student into backend if missing so server token endpoints recognize them too
  try {
    await fetch('/api/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: students }),
    });
    const tokenRes = await fetch('/api/auth/student-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: cleanId, password: cleanSecret }),
    });
    if (tokenRes.ok) {
      const td = await tokenRes.json();
      if (td.token) setStudentAuthToken(td.token);
    }
  } catch {
    // non-fatal
  }

  return { authorized: true, session };
};

export const changeStudentOwnPassword = async (
  studentId: string,
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> => {
  const cleanCur = currentPassword.trim();
  const cleanNew = newPassword.trim();
  if (cleanNew.length < 6) {
    return { success: false, message: 'New password must be at least 6 characters long.' };
  }

  const students = getEnrolledStudents();
  const target = students.find((s) => s.id === studentId);
  if (!target) {
    return { success: false, message: 'Student record not found.' };
  }
  if (target.studentPassword !== cleanCur) {
    return { success: false, message: 'Current password is incorrect.' };
  }

  const token = getStudentAuthToken();
  try {
    const res = await fetch('/api/student/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ studentId, currentPassword: cleanCur, newPassword: cleanNew }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 403) {
        return { success: false, message: err.error || 'Password update rejected by server.' };
      }
    }
  } catch {
    // continue persisting via Supabase / Firebase / Store
  }

  updateEnrolledStudent(studentId, { studentPassword: cleanNew });
  return { success: true, message: 'Your student portal password has been updated and synchronized.' };
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logoutGoogle = async () => {
  setStudentAuthToken(null);
  setStaffAuthToken(null);
  await signOut(auth);
  cachedAccessToken = null;
};
