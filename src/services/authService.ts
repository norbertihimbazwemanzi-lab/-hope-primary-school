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
import { getStaffMembers, UserRole, CurrentSessionUser } from './adminStore';

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
        assignedSubjectOrGrade: match.assignedSubjectOrGrade,
      };
      return { user: null, fallbackStaff: staffSession };
    }
    throw err;
  }
};

/**
 * Resolves an authenticated Firebase identity to their strict institutional staff role.
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

  // 3. Registered Enrolled Staff Members (DOS, DOD, Teacher, Finance, Registrar)
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
        assignedSubjectOrGrade: staffMatch.assignedSubjectOrGrade,
      },
    };
  }

  // 4. Unauthorized User: Not in authorized staff directory
  return {
    authorized: false,
    email: userEmail || 'No email associated with account',
    reason:
      'This Google / Firebase identity is not enrolled in the Mugina Hope Academy staff directory. Access to the administration portal is restricted to verified school personnel.',
  };
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logoutGoogle = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};
