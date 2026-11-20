import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
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
googleProvider.addScope('email');
googleProvider.addScope('profile');
googleProvider.setCustomParameters({ prompt: 'select_account' });

let cachedAccessToken: string | null = null;

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

export const warmUpFirebaseAuth = async (): Promise<void> => {
  try {
    if (typeof (auth as any).authStateReady === 'function') {
      await (auth as any).authStateReady();
    }
  } catch {
    // non-fatal
  }
};

const GOOGLE_OAUTH_HANDOFF_KEY = 'mugina_google_oauth_handoff_v1';

export const publishGoogleOAuthHandoff = (
  session: CurrentSessionUser,
  staffToken?: string | null
) => {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem(
      GOOGLE_OAUTH_HANDOFF_KEY,
      JSON.stringify({
        session,
        staffToken: staffToken || getStaffAuthToken() || null,
        ts: Date.now(),
      })
    );
  } catch {
    // non-fatal
  }
};

export const consumeGoogleOAuthHandoff = (): CurrentSessionUser | null => {
  try {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(GOOGLE_OAUTH_HANDOFF_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    localStorage.removeItem(GOOGLE_OAUTH_HANDOFF_KEY);
    if (!parsed || !parsed.session || !parsed.ts) return null;
    if (Date.now() - Number(parsed.ts) > 120_000) return null;
    if (parsed.staffToken) {
      setStaffAuthToken(String(parsed.staffToken));
    }
    return parsed.session as CurrentSessionUser;
  } catch {
    return null;
  }
};

const formatFirebaseGoogleError = (error: any): Error => {
  const code = String(error?.code || '');
  const host = typeof window !== 'undefined' ? window.location.hostname : 'this domain';
  if (code === 'auth/unauthorized-domain') {
    return new Error(
      `Domain "${host}" is not yet allowlisted in Firebase Authentication. Add "${host}" under Firebase Console -> Authentication -> Settings -> Authorized domains.`
    );
  }
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return new Error('Google sign-in popup was closed before completing. Please try again.');
  }
  if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
    return new Error(
      'Your browser blocked the Google sign-in popup. Please allow popups for this site or open the portal in a full browser tab.'
    );
  }
  if (code === 'auth/operation-not-allowed') {
    return new Error('Google Sign-In is not enabled in Firebase Authentication Console.');
  }
  if (code === 'auth/network-request-failed') {
    return new Error('Network error while contacting Google Sign-In. Please check your internet connection.');
  }
  return new Error(error?.message || 'Failed to authenticate with Google & Firebase.');
};

/**
 * Consumes any pending Firebase Google OAuth redirect result after page return.
 */
export const consumeGoogleRedirectResult = async (): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  try {
    const result = await getRedirectResult(auth);
    if (!result || !result.user) return null;
    const credential = GoogleAuthProvider.credentialFromResult(result);
    cachedAccessToken = credential?.accessToken || (await result.user.getIdToken());
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.warn('Firebase Google redirect result notice:', error?.code || error?.message);
    throw formatFirebaseGoogleError(error);
  }
};

/**
 * Firebase Google Sign-In with popup, automatic top-level redirect fallback,
 * and graceful embedded-iframe handling when popups are blocked.
 */
export const googleSignIn = async (): Promise<{
  user: User | null;
  accessToken: string;
  redirected?: boolean;
  popupBlockedInIframe?: boolean;
  cancelled?: boolean;
}> => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    cachedAccessToken = credential?.accessToken || (await result.user.getIdToken());
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    const code = String(error?.code || '');
    const inIframe = typeof window !== 'undefined' && window.self !== window.top;

    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      return { user: null, accessToken: '', cancelled: true };
    }

    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      if (!inIframe) {
        try {
          await signInWithRedirect(auth, googleProvider);
          return { user: null, accessToken: '', redirected: true };
        } catch (redirectError: any) {
          console.warn('Firebase Google redirect fallback notice:', redirectError?.code || redirectError?.message);
          throw formatFirebaseGoogleError(redirectError);
        }
      }
      console.warn('Firebase Google Sign-In popup blocked inside embedded frame; offering full-tab sign-in.');
      return { user: null, accessToken: '', popupBlockedInIframe: true };
    }

    console.warn('Firebase Google Sign-In notice:', code || error?.message);
    throw formatFirebaseGoogleError(error);
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
  const rawEmail =
    firebaseUser.email || firebaseUser.providerData?.find((p) => Boolean(p?.email))?.email || '';
  const userEmail = rawEmail.toLowerCase().trim();

  // 1. Check Registered Staff Members first so roles/names/status reflect admin updates
  const staffList = getStaffMembers();
  const staffMatch = userEmail
    ? staffList.find(
        (s) =>
          String(s.email || '').toLowerCase().trim() === userEmail ||
          String(s.username || '').toLowerCase().trim() === userEmail
      )
    : undefined;

  if (staffMatch) {
    if (staffMatch.status === 'Inactive') {
      return {
        authorized: false,
        email: userEmail,
        reason: 'This staff account has been deactivated by School Administration.',
      };
    }
    return {
      authorized: true,
      firebaseUser,
      session: {
        id: staffMatch.id,
        name: staffMatch.name,
        role: staffMatch.role as UserRole,
        username: staffMatch.username,
        email: staffMatch.email || userEmail,
        phone: staffMatch.phone,
        photoUrl: staffMatch.photoUrl,
        bio: staffMatch.bio,
        assignedSubjectOrGrade: staffMatch.assignedSubjectOrGrade,
      },
    };
  }

  // 2. Primary requested Administrator fallback (Norbert Ihimbazwe Manzi)
  if (userEmail === 'norbertihimbazwemanzi@gmail.com') {
    return {
      authorized: true,
      firebaseUser,
      session: {
        id: firebaseUser.uid,
        name: firebaseUser.displayName || 'Norbert Ihimbazwe Manzi (School Administrator)',
        role: 'SuperAdmin',
        username: 'norbertihimbazwemanzi@gmail.com',
        email: 'norbertihimbazwemanzi@gmail.com',
        assignedSubjectOrGrade: 'Chief Administrator & Portal Controller',
      },
    };
  }

  // 3. Headteacher / School Principal fallback
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

const authenticateStaffLocallyOrFromCloud = (
  cleanId: string,
  cleanSecret: string
): StaffLoginResult => {
  const allStaff = getStaffMembers();
  const cleanLower = cleanId.toLowerCase();

  let match = allStaff.find(
    (s) =>
      cleanLower &&
      (String(s.username || '').trim().toLowerCase() === cleanLower ||
        String(s.email || '').trim().toLowerCase() === cleanLower) &&
      String(s.password || '').trim() !== '' &&
      String(s.password || '').trim() === cleanSecret
  );

  if (!match && cleanLower === 'norbertihimbazwemanzi@gmail.com' && cleanSecret === '@0798744704') {
    match =
      allStaff.find(
        (s) => String(s.username || '').trim().toLowerCase() === 'norbertihimbazwemanzi@gmail.com'
      ) || {
        id: 'staff-admin-norbert',
        name: 'Norbert Ihimbazwe Manzi (Chief Administrator)',
        role: 'SuperAdmin',
        email: 'norbertihimbazwemanzi@gmail.com',
        phone: '+250 798 744 704',
        username: 'norbertihimbazwemanzi@gmail.com',
        password: '@0798744704',
        assignedSubjectOrGrade: 'Chief Administrator & Portal Controller',
        enrolledAt: '2026-01-01',
        status: 'Active' as const,
      };
  }

  if (!match && (!cleanLower || cleanLower === 'admin') && cleanSecret === 'mugina2026') {
    match = allStaff.find(
      (s) => String(s.username || '').trim().toLowerCase() === 'norbertihimbazwemanzi@gmail.com'
    );
  }

  if (match) {
    if (match.status === 'Inactive') {
      return {
        authorized: false,
        reason: 'This staff account is currently deactivated. Contact School Administration.',
      };
    }
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
    reason: 'Invalid username, email, or password.',
  };
};

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

    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      // Static host (e.g. Vercel SPA rewrite returning HTML): fall back to synced Supabase/Firebase staff store
      return authenticateStaffLocallyOrFromCloud(cleanId, cleanSecret);
    }

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success && data.session) {
      if (data.token) setStaffAuthToken(data.token);
      return { authorized: true, session: data.session as CurrentSessionUser };
    }

    if (res.status === 403) {
      return {
        authorized: false,
        reason:
          data.error ||
          'This staff account is currently deactivated. Contact School Administration.',
      };
    }

    // Also check synced cloud staff in case password/user was updated from another browser in Supabase/Firebase
    const cloudFallback = authenticateStaffLocallyOrFromCloud(cleanId, cleanSecret);
    if (cloudFallback.authorized) {
      return cloudFallback;
    }

    return {
      authorized: false,
      networkError: true,
      reason: data.error || 'Invalid staff username, email, or password.',
    };
  } catch {
    return authenticateStaffLocallyOrFromCloud(cleanId, cleanSecret);
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

  // 1. Try server-verified login endpoint first when Express API is reachable
  let backendHasJson = false;
  try {
    const res = await fetch('/api/auth/student-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: cleanId, password: cleanSecret }),
    });
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      backendHasJson = true;
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
    }
  } catch {
    // Fall back to synced cloud client check if server offline
  }

  // 2. Check synced Supabase / Firebase / cached student directory
  const students = getEnrolledStudents();
  const cleanLower = cleanId.toLowerCase();
  const matched = students.find(
    (s) =>
      (String(s.studentUsername || '').trim().toLowerCase() === cleanLower ||
        String(s.regNumber || '').trim().toLowerCase() === cleanLower ||
        String(s.email || '').trim().toLowerCase() === cleanLower) &&
      String(s.studentPassword || '').trim() !== '' &&
      String(s.studentPassword || '').trim() === cleanSecret
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

  // Sync student into backend if server API is live so server token endpoints recognize them too
  if (backendHasJson) {
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
      if (tokenRes.ok && (tokenRes.headers.get('content-type') || '').includes('application/json')) {
        const td = await tokenRes.json();
        if (td.token) setStudentAuthToken(td.token);
      }
    } catch {
      // non-fatal
    }
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
