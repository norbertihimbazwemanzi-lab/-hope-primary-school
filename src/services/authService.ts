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
import {
  getStaffMembers,
  getEnrolledStudents,
  updateEnrolledStudent,
  syncServerStaff,
  syncServerStudents,
  waitForCredentialSync,
  UserRole,
  CurrentSessionUser,
  StaffMember,
  EnrolledStudent,
} from './adminStore';
import { verifyPortalSecret } from './credentialHash';

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
    console.warn('Firebase email auth notice:', err?.code || err?.message);
    const allStaff = getStaffMembers();
    const cleanUser = email.trim().toLowerCase();
    for (const s of allStaff) {
      if (s.status !== 'Active') continue;
      if (s.username.toLowerCase() !== cleanUser && s.email.toLowerCase() !== cleanUser) continue;
      const storedHash = s.clientPasswordHash || (s as any).passwordHash;
      if (await verifyPortalSecret(pass, storedHash)) {
        const staffSession: CurrentSessionUser = {
          id: s.id,
          name: s.name,
          role: s.role as UserRole,
          username: s.username,
          email: s.email,
          phone: s.phone,
          photoUrl: s.photoUrl,
          bio: s.bio,
          assignedSubjectOrGrade: s.assignedSubjectOrGrade,
        };
        return { user: null, fallbackStaff: staffSession };
      }
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
 * Credential authentication for Parents (Registered Parent Email/Phone + Child's Student Reg# or hashed portal password)
 */
export const authenticateParentAccount = async (
  identifier: string,
  secret: string
): Promise<CurrentSessionUser | null> => {
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

  let isSecretValid = false;
  for (const c of matchedChildren) {
    if (c.regNumber.toLowerCase() === cleanSecret.toLowerCase()) {
      isSecretValid = true;
      break;
    }
    const storedHash = c.clientPasswordHash || (c as any).passwordHash;
    if (await verifyPortalSecret(cleanSecret, storedHash)) {
      isSecretValid = true;
      break;
    }
  }

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

const findMatchingStaffLocally = async (
  allStaff: StaffMember[],
  cleanId: string,
  cleanSecret: string
): Promise<StaffMember | undefined> => {
  const cleanLower = cleanId.toLowerCase();
  if (!cleanLower || !cleanSecret) return undefined;
  for (const s of allStaff) {
    const uname = String(s.username || '').trim().toLowerCase();
    const email = String(s.email || '').trim().toLowerCase();
    if (uname !== cleanLower && email !== cleanLower) continue;
    const storedHash = s.clientPasswordHash || (s as any).passwordHash;
    if (await verifyPortalSecret(cleanSecret, storedHash)) {
      return s;
    }
  }
  return undefined;
};

const authenticateStaffLocallyOrFromCloud = async (
  cleanId: string,
  cleanSecret: string,
  allowCloudSync = false
): Promise<StaffLoginResult & { matchedStaff?: StaffMember }> => {
  let allStaff = getStaffMembers();
  let match = await findMatchingStaffLocally(allStaff, cleanId, cleanSecret);

  if (!match && allowCloudSync) {
    allStaff = await syncServerStaff();
    match = await findMatchingStaffLocally(allStaff, cleanId, cleanSecret);
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
      matchedStaff: match,
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
  if (!cleanSecret || !cleanId) {
    return { authorized: false, reason: 'Please enter your username/email and password.' };
  }

  await waitForCredentialSync();

  let backendHasJson = false;
  let serverErrorMsg = '';
  try {
    const res = await fetch('/api/auth/staff-login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: cleanId, password: cleanSecret }),
    });

    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      backendHasJson = true;
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.session) {
        if (data.token) setStaffAuthToken(data.token);
        return { authorized: true, session: data.session as CurrentSessionUser };
      }

      if (res.status === 403 || res.status === 429) {
        return {
          authorized: false,
          reason:
            data.error ||
            'Authentication blocked or account deactivated. Contact School Administration.',
        };
      }
      serverErrorMsg = data.error || '';
    }
  } catch {
    // Fall back to synced cloud/vault verification only when Express server is unreachable
  }

  if (backendHasJson) {
    return {
      authorized: false,
      reason: serverErrorMsg || 'Invalid staff username, email, or password.',
    };
  }

  const cloudFallback = await authenticateStaffLocallyOrFromCloud(cleanId, cleanSecret, true);
  if (cloudFallback.authorized) {
    return { authorized: true, session: cloudFallback.session };
  }

  if (cloudFallback.reason && cloudFallback.reason.toLowerCase().includes('deactivated')) {
    return { authorized: false, reason: cloudFallback.reason };
  }

  return {
    authorized: false,
    networkError: true,
    reason: serverErrorMsg || 'Invalid staff username, email, or password.',
  };
};

export const fetchActiveServerSession = async (): Promise<CurrentSessionUser | null> => {
  try {
    const staffToken = getStaffAuthToken();
    const studentToken = getStudentAuthToken();
    const token = staffToken || studentToken;
    const res = await fetch('/api/auth/session', {
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) return null;
    const data = await res.json().catch(() => ({}));
    if (data.authenticated && data.session) {
      return data.session as CurrentSessionUser;
    }
  } catch {
    // ignore offline/static mode
  }
  return null;
};

export const logoutServerSession = async (): Promise<void> => {
  setStudentAuthToken(null);
  setStaffAuthToken(null);
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
  } catch {
    // non-fatal
  }
};

export const getBootstrapStatus = async (): Promise<{ needsBootstrap: boolean }> => {
  try {
    const res = await fetch('/api/auth/bootstrap-status', { credentials: 'include' });
    if (!res.ok) return { needsBootstrap: false };
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) return { needsBootstrap: false };
    const data = await res.json().catch(() => ({}));
    return { needsBootstrap: Boolean(data.needsBootstrap) };
  } catch {
    return { needsBootstrap: false };
  }
};

export const bootstrapFirstAdmin = async (payload: {
  name: string;
  email: string;
  username?: string;
  password: string;
}): Promise<StaffLoginResult> => {
  try {
    const res = await fetch('/api/auth/bootstrap-admin', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success && data.session) {
      if (data.token) setStaffAuthToken(data.token);
      return { authorized: true, session: data.session as CurrentSessionUser };
    }
    return {
      authorized: false,
      reason: data.error || 'Failed to complete initial administrator setup.',
    };
  } catch {
    return {
      authorized: false,
      networkError: true,
      reason: 'Could not reach server to initialize administrator account.',
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
      credentials: 'include',
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

export const authenticateStudentAccount = async (
  identifier: string,
  secret: string
): Promise<CurrentSessionUser | null> => {
  const cleanId = identifier.trim().toLowerCase();
  const cleanSecret = secret.trim();
  if (!cleanId || !cleanSecret) return null;

  const students = getEnrolledStudents();
  const matched = await findMatchingStudentLocally(students, cleanId, cleanSecret);
  if (!matched) return null;
  if (matched.studentAccountActive === false || matched.status !== 'Active') {
    return null;
  }

  return {
    id: matched.id,
    name: matched.fullName,
    role: 'Student',
    username: matched.studentUsername || matched.regNumber,
    email: matched.parentEmail || '',
    assignedSubjectOrGrade: `${matched.gradeCode} (${matched.stream || 'Stream A'})`,
    linkedStudentIds: [matched.id],
  };
};

export type StudentLoginResult =
  | { authorized: true; session: CurrentSessionUser }
  | { authorized: false; reason: string };

const findMatchingStudentLocally = async (
  students: EnrolledStudent[],
  cleanId: string,
  cleanSecret: string
): Promise<EnrolledStudent | undefined> => {
  const cleanLower = cleanId.toLowerCase();
  for (const s of students) {
    const uname = String(s.studentUsername || '').trim().toLowerCase();
    const reg = String(s.regNumber || '').trim().toLowerCase();
    const email = String(s.email || '').trim().toLowerCase();
    if (uname !== cleanLower && reg !== cleanLower && email !== cleanLower) continue;
    const storedHash = s.clientPasswordHash || (s as any).passwordHash;
    if (await verifyPortalSecret(cleanSecret, storedHash)) {
      return s;
    }
  }
  return undefined;
};

export const authenticateStudentWithBackend = async (
  identifier: string,
  secret: string
): Promise<StudentLoginResult> => {
  const cleanId = identifier.trim();
  const cleanSecret = secret.trim();
  if (!cleanId || !cleanSecret) {
    return { authorized: false, reason: 'Please enter your Student ID / Username and password.' };
  }

  await waitForCredentialSync();

  // 1. Verify against Express API first when reachable
  let backendHasJson = false;
  let serverErrorMsg = '';
  try {
    const res = await fetch('/api/auth/student-login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: cleanId, password: cleanSecret }),
    });
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      backendHasJson = true;
      const errOrData = await res.json().catch(() => ({}));
      if (res.ok && errOrData.success && errOrData.session) {
        if (errOrData.token) setStudentAuthToken(errOrData.token);
        return { authorized: true, session: errOrData.session as CurrentSessionUser };
      } else if (res.status === 403 || res.status === 429) {
        return {
          authorized: false,
          reason:
            errOrData.error ||
            'Student account access blocked or deactivated. Contact School Administration.',
        };
      }
      serverErrorMsg = errOrData.error || '';
    }
  } catch {
    // Fall back to synced cloud client check only when Express server is unreachable
  }

  if (backendHasJson) {
    return {
      authorized: false,
      reason:
        serverErrorMsg ||
        'Invalid Student ID / Username or password. Contact the DOS or School Administration office.',
    };
  }

  // 2. Offline / static mode fallback: check synced hashed student directory
  let students = getEnrolledStudents();
  let matched = await findMatchingStudentLocally(students, cleanId, cleanSecret);
  if (!matched) {
    students = await syncServerStudents();
    matched = await findMatchingStudentLocally(students, cleanId, cleanSecret);
  }

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

  const token = getStudentAuthToken();
  let verifiedByBackend = false;
  try {
    const res = await fetch('/api/student/change-password', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ studentId, currentPassword: cleanCur, newPassword: cleanNew }),
    });
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, message: data.error || 'Current password is incorrect.' };
      }
      verifiedByBackend = true;
    }
  } catch {
    // Offline/static fallback below verifies against stored salted hash
  }

  if (!verifiedByBackend) {
    const storedHash = target.clientPasswordHash || (target as any).passwordHash;
    const hashMatch = await verifyPortalSecret(cleanCur, storedHash);
    if (!hashMatch) {
      return { success: false, message: 'Current password is incorrect.' };
    }
  }

  updateEnrolledStudent(studentId, { studentPassword: cleanNew });
  await waitForCredentialSync();
  return { success: true, message: 'Your student portal password has been updated and synchronized.' };
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logoutGoogle = async () => {
  await logoutServerSession();
  await signOut(auth);
  cachedAccessToken = null;
};
