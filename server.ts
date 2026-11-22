import express from 'express';
import nodemailer, { type Transporter } from 'nodemailer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Shared public uploads directory for cross-device image visibility
const uploadsDir = path.resolve(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Signed Session Token Utilities, Hashing & Backend RBAC Guard (Registered before all /api routes)
const STUDENT_TOKEN_SECRET = process.env.SESSION_SECRET || 'mugina-hope-academy-sms-rbac-key-2026';

function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function hashPassword(plain: string): string {
  const clean = String(plain || '').trim();
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(clean, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

function hashSha256Credential(plain: string): string {
  const clean = String(plain || '').trim();
  const salt = crypto.randomBytes(12).toString('hex');
  const digest = sha256Hex(`${salt}:${clean}`);
  return `sha256$${salt}$${digest}`;
}

function verifyPassword(plain: string, stored?: string): boolean {
  const cleanPlain = String(plain || '').trim();
  const cleanStored = String(stored || '').trim();
  if (!cleanStored || !cleanPlain) return false;
  if (cleanStored.startsWith('scrypt$')) {
    const parts = cleanStored.split('$');
    if (parts.length !== 3) return false;
    const [, salt, hexHash] = parts;
    try {
      const derived = crypto.scryptSync(cleanPlain, salt, 64);
      const target = Buffer.from(hexHash, 'hex');
      if (derived.length === 0 || derived.length !== target.length) return false;
      return crypto.timingSafeEqual(derived, target);
    } catch {
      return false;
    }
  }
  if (cleanStored.startsWith('sha256$')) {
    const parts = cleanStored.split('$');
    if (parts.length !== 3) return false;
    const [, salt, hexHash] = parts;
    try {
      const derived = Buffer.from(sha256Hex(`${salt}:${cleanPlain}`), 'hex');
      const target = Buffer.from(hexHash, 'hex');
      if (derived.length === 0 || derived.length !== target.length) return false;
      return crypto.timingSafeEqual(derived, target);
    } catch {
      return false;
    }
  }
  return cleanStored === cleanPlain;
}

async function syncCredentialHashToSupabaseVault(params: {
  accountType: 'staff' | 'student';
  account: any;
  sha256Hash: string;
}) {
  try {
    const sbUrl = (process.env.VITE_SUPABASE_URL || 'https://egwzhnzpsgwkhvhesode.supabase.co').replace(/\/$/, '');
    const sbKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_982vUUyz9dc8qOU1eCWhAg_TkWcGJj_';
    const res = await fetch(
      `${sbUrl}/rest/v1/website_settings?id=eq.portal_auth_vault_v1&select=data`,
      {
        headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}` },
        signal: AbortSignal.timeout(3000),
      }
    );
    const rows = res.ok ? ((await res.json()) as any[]) : [];
    const current = rows?.[0]?.data || { staff: {}, students: {} };
    const nowIso = new Date().toISOString();
    const nextStaff = { ...(current.staff || {}) };
    const nextStudents = { ...(current.students || {}) };
    if (params.accountType === 'staff') {
      nextStaff[params.account.id] = {
        ...(nextStaff[params.account.id] || {}),
        id: params.account.id,
        username: params.account.username,
        email: params.account.email || '',
        role: params.account.role || 'Teacher',
        status: params.account.status || 'Active',
        passwordHash: params.sha256Hash,
        updatedAt: nowIso,
      };
    } else {
      nextStudents[params.account.id] = {
        ...(nextStudents[params.account.id] || {}),
        id: params.account.id,
        regNumber: params.account.regNumber || '',
        studentUsername: params.account.studentUsername || '',
        studentAccountActive: params.account.studentAccountActive !== false,
        passwordHash: params.sha256Hash,
        hasPassword: true,
        updatedAt: nowIso,
      };
    }
    await fetch(`${sbUrl}/rest/v1/website_settings?on_conflict=id`, {
      method: 'POST',
      headers: {
        apikey: sbKey,
        Authorization: `Bearer ${sbKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        id: 'portal_auth_vault_v1',
        data: { staff: nextStaff, students: nextStudents, updatedAt: nowIso },
        updated_at: nowIso,
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // non-fatal when offline
  }
}

interface StudentTokenPayload {
  id: string;
  regNumber: string;
  gradeCode: string;
  stream: string;
  role: 'Student';
  exp: number;
}

interface StaffTokenPayload {
  id: string;
  name: string;
  username: string;
  email: string;
  role: string;
  exp: number;
}

function signStudentToken(payload: StudentTokenPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', STUDENT_TOKEN_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function signStaffToken(payload: StaffTokenPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', STUDENT_TOKEN_SECRET).update(encoded).digest('base64url');
  return `staff.${encoded}.${sig}`;
}

function verifyStudentToken(authHeader?: string): StudentTokenPayload | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (token.startsWith('staff.')) return null;
  const [encoded, sig] = token.split('.');
  if (!encoded || !sig) return null;
  const expectedSig = crypto.createHmac('sha256', STUDENT_TOKEN_SECRET).update(encoded).digest('base64url');
  if (sig !== expectedSig) return null;
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as StudentTokenPayload;
    if (parsed.role !== 'Student' || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function verifyStaffToken(authHeader?: string): StaffTokenPayload | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const rawToken = authHeader.slice(7).trim();
  if (!rawToken.startsWith('staff.')) return null;
  const body = rawToken.slice(6);
  const [encoded, sig] = body.split('.');
  if (!encoded || !sig) return null;
  const expectedSig = crypto.createHmac('sha256', STUDENT_TOKEN_SECRET).update(encoded).digest('base64url');
  if (sig !== expectedSig) return null;
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as StaffTokenPayload;
    if (!parsed.role || parsed.role === 'Student' || parsed.role === 'Parent' || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

const ADMISSIONS_ADMIN_ROLES = new Set([
  'SuperAdmin',
  'Admin',
  'SchoolAdmin',
  'HeadTeacher',
  'DOS',
  'Registrar',
]);

const FULL_ADMIN_ROLES = new Set(['SuperAdmin', 'Admin', 'SchoolAdmin']);

function extractGradesFromText(assignedText?: string): string[] {
  if (!assignedText) return [];
  const txt = String(assignedText).toUpperCase();
  const matched: string[] = [];
  if (txt.includes('N-BABY') || txt.includes('BABY')) matched.push('N-BABY');
  if (txt.includes('N-MID') || txt.includes('MID')) matched.push('N-MID');
  if (txt.includes('N-TOP') || txt.includes('TOP')) matched.push('N-TOP');
  (['P1', 'P2', 'P3', 'P4', 'P5', 'P6'] as const).forEach((code, idx) => {
    const num = idx + 1;
    if (txt.includes(code) || txt.includes(`PRIMARY ${num}`)) {
      matched.push(code);
    }
  });
  return Array.from(new Set(matched));
}

function getTeacherAllowedGradesServer(staffId: string, staffName: string): string[] {
  const staffList = ensureAuthoritativeStaffList();
  const staffMember = staffList.find((s: any) => s.id === staffId);
  const sms = loadSmsStore();
  const assignments = Array.isArray(sms.teacher_assignments) ? sms.teacher_assignments : [];
  const fromMatrix = assignments
    .filter(
      (a: any) =>
        (staffId && a.teacherId === staffId) ||
        (staffName && String(a.teacherName || '').toLowerCase() === staffName.toLowerCase())
    )
    .map((a: any) => String(a.gradeCode || '').toUpperCase())
    .filter(Boolean);
  const fromProfile = extractGradesFromText(staffMember?.assignedSubjectOrGrade);
  return Array.from(new Set([...fromMatrix, ...fromProfile]));
}

function normalizeQuizAnswer(val: string): string {
  return String(val || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

const STUDENT_READONLY_SMS_DOMAINS = new Set([
  'academic_years_terms',
  'school_classes_streams',
  'school_subjects',
  'teacher_assignments',
  'exam_config',
  'exam_schedules',
  'exam_marks',
  'lesson_plans',
  'learning_materials',
  'homework_assignments',
  'student_achievements',
  'class_announcements',
  'class_timetables',
  'fee_structures',
]);

// In-memory sliding-window rate limiter
const rateLimitBuckets = new Map<string, number[]>();
function rateLimitCheck(key: string, maxRequests: number, windowMs: number): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const cutoff = now - windowMs;
  const existing = (rateLimitBuckets.get(key) || []).filter((ts) => ts > cutoff);
  if (existing.length >= maxRequests) {
    const oldest = existing[0] || now;
    const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    rateLimitBuckets.set(key, existing);
    return { allowed: false, retryAfterSec };
  }
  existing.push(now);
  rateLimitBuckets.set(key, existing);
  return { allowed: true, retryAfterSec: 0 };
}

// Reject Student Bearer tokens if they attempt to mutate protected endpoints or read other users' private records
app.use(
  [
    '/api/staff',
    '/api/students',
    '/api/attendance',
    '/api/teacher-attendance',
    '/api/discipline',
    '/api/payments',
    '/api/applications',
    '/api/admissions/review',
    '/api/admissions/confirm',
    '/api/admin',
    '/api/chats',
    '/api/sms/restore',
    '/api/sms/backup',
  ],
  (req, res, next) => {
    const stuToken = verifyStudentToken(req.headers.authorization);
    if (stuToken) {
      if (
        req.method !== 'GET' ||
        req.baseUrl === '/api/staff' ||
        req.baseUrl === '/api/students' ||
        req.baseUrl === '/api/payments' ||
        req.baseUrl === '/api/applications' ||
        req.baseUrl === '/api/admin' ||
        req.baseUrl === '/api/chats' ||
        req.baseUrl === '/api/sms/backup'
      ) {
        return res.status(403).json({
          error: 'Forbidden: Student accounts cannot access or modify administrative, staff, classmate, or financial records.',
        });
      }
    }
    return next();
  }
);

// Persistent server-side gallery store
const galleryStoreFile = path.resolve(__dirname, 'gallery_store.json');
function loadServerGallery(): any[] {
  try {
    if (fs.existsSync(galleryStoreFile)) {
      return JSON.parse(fs.readFileSync(galleryStoreFile, 'utf8'));
    }
  } catch (err) {
    console.warn('Error reading gallery_store.json:', err);
  }
  return [];
}

function saveServerGallery(items: any[]) {
  try {
    fs.writeFileSync(galleryStoreFile, JSON.stringify(items, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving gallery_store.json:', err);
  }
}

// Persistent server-side website settings store (Admin updates)
const settingsStoreFile = path.resolve(__dirname, 'website_settings_store.json');
function loadServerSettings(): any {
  try {
    if (fs.existsSync(settingsStoreFile)) {
      return JSON.parse(fs.readFileSync(settingsStoreFile, 'utf8'));
    }
  } catch (err) {
    console.warn('Error reading website_settings_store.json:', err);
  }
  return null;
}

function saveServerSettings(settings: any) {
  try {
    fs.writeFileSync(settingsStoreFile, JSON.stringify(settings, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving website_settings_store.json:', err);
  }
}

// Persistent database stores on disk for all entities
const staffStoreFile = path.resolve(__dirname, 'staff_store.json');
function loadServerStaff(): any[] | null {
  try {
    if (fs.existsSync(staffStoreFile)) {
      return JSON.parse(fs.readFileSync(staffStoreFile, 'utf8'));
    }
  } catch (err) {
    console.warn('Error reading staff_store.json:', err);
  }
  return null;
}
function saveServerStaff(items: any[]) {
  try {
    fs.writeFileSync(staffStoreFile, JSON.stringify(items, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving staff_store.json:', err);
  }
}

const studentsStoreFile = path.resolve(__dirname, 'students_store.json');
function loadServerStudents(): any[] | null {
  try {
    if (fs.existsSync(studentsStoreFile)) {
      return JSON.parse(fs.readFileSync(studentsStoreFile, 'utf8'));
    }
  } catch (err) {
    console.warn('Error reading students_store.json:', err);
  }
  return null;
}
function saveServerStudents(items: any[]) {
  try {
    fs.writeFileSync(studentsStoreFile, JSON.stringify(items, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving students_store.json:', err);
  }
}

const attendanceStoreFile = path.resolve(__dirname, 'attendance_store.json');
function loadServerAttendance(): any[] | null {
  try {
    if (fs.existsSync(attendanceStoreFile)) {
      return JSON.parse(fs.readFileSync(attendanceStoreFile, 'utf8'));
    }
  } catch (err) {
    console.warn('Error reading attendance_store.json:', err);
  }
  return null;
}
function saveServerAttendance(items: any[]) {
  try {
    fs.writeFileSync(attendanceStoreFile, JSON.stringify(items, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving attendance_store.json:', err);
  }
}

const teacherAttendanceStoreFile = path.resolve(__dirname, 'teacher_attendance_store.json');
function loadServerTeacherAttendance(): any[] | null {
  try {
    if (fs.existsSync(teacherAttendanceStoreFile)) {
      return JSON.parse(fs.readFileSync(teacherAttendanceStoreFile, 'utf8'));
    }
  } catch (err) {
    console.warn('Error reading teacher_attendance_store.json:', err);
  }
  return null;
}
function saveServerTeacherAttendance(items: any[]) {
  try {
    fs.writeFileSync(teacherAttendanceStoreFile, JSON.stringify(items, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving teacher_attendance_store.json:', err);
  }
}

const disciplineStoreFile = path.resolve(__dirname, 'discipline_store.json');
function loadServerDiscipline(): any[] | null {
  try {
    if (fs.existsSync(disciplineStoreFile)) {
      return JSON.parse(fs.readFileSync(disciplineStoreFile, 'utf8'));
    }
  } catch (err) {
    console.warn('Error reading discipline_store.json:', err);
  }
  return null;
}
function saveServerDiscipline(items: any[]) {
  try {
    fs.writeFileSync(disciplineStoreFile, JSON.stringify(items, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving discipline_store.json:', err);
  }
}

const paymentsStoreFile = path.resolve(__dirname, 'payments_store.json');
function loadServerPayments(): any[] | null {
  try {
    if (fs.existsSync(paymentsStoreFile)) {
      return JSON.parse(fs.readFileSync(paymentsStoreFile, 'utf8'));
    }
  } catch (err) {
    console.warn('Error reading payments_store.json:', err);
  }
  return null;
}
function saveServerPayments(items: any[]) {
  try {
    fs.writeFileSync(paymentsStoreFile, JSON.stringify(items, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving payments_store.json:', err);
  }
}

const documentsStoreFile = path.resolve(__dirname, 'documents_store.json');
function loadServerDocuments(): any[] | null {
  try {
    if (fs.existsSync(documentsStoreFile)) {
      return JSON.parse(fs.readFileSync(documentsStoreFile, 'utf8'));
    }
  } catch (err) {
    console.warn('Error reading documents_store.json:', err);
  }
  return null;
}
function saveServerDocuments(items: any[]) {
  try {
    fs.writeFileSync(documentsStoreFile, JSON.stringify(items, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving documents_store.json:', err);
  }
}

const applicationsStoreFile = path.resolve(__dirname, 'applications_store.json');
function loadServerApplications(): any[] | null {
  try {
    if (fs.existsSync(applicationsStoreFile)) {
      return JSON.parse(fs.readFileSync(applicationsStoreFile, 'utf8'));
    }
  } catch (err) {
    console.warn('Error reading applications_store.json:', err);
  }
  return null;
}
function saveServerApplications(items: any[]) {
  try {
    fs.writeFileSync(applicationsStoreFile, JSON.stringify(items, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving applications_store.json:', err);
  }
}

// Persistent server-side chats & messaging store between applicants and admin
interface ChatMessage {
  id: string;
  sender: 'parent' | 'admin' | 'system';
  senderName: string;
  text: string;
  createdAt: string;
}

interface ChatThread {
  refCode: string;
  studentName: string;
  parentName: string;
  parentEmail?: string;
  parentPhone?: string;
  gradeCode: string;
  status: 'Pending Confirmation' | 'Confirmed & Enrolled' | 'Waitlist';
  messages: ChatMessage[];
  updatedAt: string;
}

const chatsStoreFile = path.resolve(__dirname, 'chats_store.json');
function loadServerChats(): ChatThread[] {
  try {
    if (fs.existsSync(chatsStoreFile)) {
      return JSON.parse(fs.readFileSync(chatsStoreFile, 'utf8'));
    }
  } catch (err) {
    console.warn('Error reading chats_store.json:', err);
  }
  return [];
}

function saveServerChats(threads: ChatThread[]) {
  try {
    fs.writeFileSync(chatsStoreFile, JSON.stringify(threads, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving chats_store.json:', err);
  }
}

// =========================================================================
// GMAIL SMTP EMAIL ENGINE, TOKEN STORES, EMAIL LOGS & TEMPLATES
// =========================================================================
const GMAIL_USER = (process.env.GMAIL_USER || process.env.SMTP_USER || '').trim();
const GMAIL_APP_PASSWORD = (process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS || '').replace(/\s+/g, '');
const EMAIL_FROM_ADDRESS = (
  process.env.EMAIL_FROM || process.env.SCHOOL_GMAIL || GMAIL_USER || 'norbertihimbazwemanzi@gmail.com'
).trim();
const SCHOOL_OFFICIAL_EMAIL = (process.env.SCHOOL_GMAIL || GMAIL_USER || 'norbertihimbazwemanzi@gmail.com').trim();

function formatSmtpError(err: any): string {
  const raw = String(err?.message || 'SMTP delivery failed');
  if (/535|BadCredentials|Username and Password not accepted/i.test(raw)) {
    return `${raw} — Google rejected Gmail SMTP login. Use a 16-character Google App Password (with 2-Step Verification enabled on ${GMAIL_USER || 'your Gmail'}) in GMAIL_APP_PASSWORD/SMTP_PASS (not your regular Gmail login password).`;
  }
  return raw;
}

const getPublicAppUrl = (req?: express.Request): string => {
  if (process.env.APP_URL && process.env.APP_URL !== 'MY_APP_URL') {
    return process.env.APP_URL.replace(/\/+$/, '');
  }
  if (req) {
    const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
    const host = req.headers.host || `localhost:${PORT}`;
    return `${proto}://${host}`.replace(/\/+$/, '');
  }
  return `http://localhost:${PORT}`;
};

let transporter: Transporter;
if (GMAIL_USER && GMAIL_APP_PASSWORD) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_APP_PASSWORD,
    },
  });
} else {
  // Local / preview fallback when Gmail App Password is not yet configured in env
  transporter = nodemailer.createTransport({
    jsonTransport: true,
  });
}

const emailLogsStoreFile = path.resolve(__dirname, 'email_logs_store.json');
interface EmailDeliveryLog {
  id: string;
  recipientEmail: string;
  emailType:
    | 'password_reset'
    | 'admission_approved'
    | 'admission_verification'
    | 'admission_rejected'
    | 'admission_more_info'
    | 'admission_received'
    | 'attendance_alert'
    | 'contact_inquiry'
    | 'general';
  subject: string;
  status: 'Sent' | 'Failed';
  errorMessage?: string;
  relatedRef?: string;
  sentAt: string;
  retryCount: number;
  sanitizedSummary: string;
  safeRetryHtml?: string;
}

function loadEmailLogs(): EmailDeliveryLog[] {
  try {
    if (fs.existsSync(emailLogsStoreFile)) {
      const parsed = JSON.parse(fs.readFileSync(emailLogsStoreFile, 'utf8'));
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (err) {
    console.warn('Error reading email_logs_store.json:', err);
  }
  return [];
}
function saveEmailLogs(items: EmailDeliveryLog[]) {
  try {
    fs.writeFileSync(emailLogsStoreFile, JSON.stringify(items.slice(0, 500), null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving email_logs_store.json:', err);
  }
}

const resetTokensStoreFile = path.resolve(__dirname, 'password_reset_tokens_store.json');
interface PasswordResetTokenRecord {
  id: string;
  tokenHash: string;
  accountType: 'staff' | 'student';
  accountId: string;
  email: string;
  displayName: string;
  createdAt: string;
  expiresAt: number;
  used: boolean;
  usedAt?: string;
}

function loadResetTokens(): PasswordResetTokenRecord[] {
  try {
    if (fs.existsSync(resetTokensStoreFile)) {
      const parsed = JSON.parse(fs.readFileSync(resetTokensStoreFile, 'utf8'));
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (err) {
    console.warn('Error reading password_reset_tokens_store.json:', err);
  }
  return [];
}
function saveResetTokens(items: PasswordResetTokenRecord[]) {
  try {
    fs.writeFileSync(resetTokensStoreFile, JSON.stringify(items.slice(-500), null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving password_reset_tokens_store.json:', err);
  }
}

const admissionVerificationStoreFile = path.resolve(__dirname, 'admission_verification_store.json');
interface AdmissionVerificationRecord {
  id: string;
  appId: string;
  refCode: string;
  parentEmail: string;
  studentName: string;
  gradeCode: string;
  codeHash: string;
  createdAt: string;
  expiresAt: number;
  attempts: number;
  maxAttempts: number;
  used: boolean;
  usedAt?: string;
  locked?: boolean;
}

function loadVerificationRecords(): AdmissionVerificationRecord[] {
  try {
    if (fs.existsSync(admissionVerificationStoreFile)) {
      const parsed = JSON.parse(fs.readFileSync(admissionVerificationStoreFile, 'utf8'));
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (err) {
    console.warn('Error reading admission_verification_store.json:', err);
  }
  return [];
}
function saveVerificationRecords(items: AdmissionVerificationRecord[]) {
  try {
    fs.writeFileSync(admissionVerificationStoreFile, JSON.stringify(items, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving admission_verification_store.json:', err);
  }
}

const emailTemplatesStoreFile = path.resolve(__dirname, 'email_templates_store.json');
interface EmailTemplateConfig {
  id: 'admission_approved' | 'admission_rejected' | 'admission_more_info' | 'password_reset';
  label: string;
  subject: string;
  introParagraph: string;
  instructionsParagraph: string;
  footerSignature: string;
  updatedAt: string;
}

const DEFAULT_EMAIL_TEMPLATES: Record<EmailTemplateConfig['id'], EmailTemplateConfig> = {
  admission_approved: {
    id: 'admission_approved',
    label: 'Admission Application Approved & Verification Code',
    subject: 'Mugina Hope Primary School - Admission Application Approved',
    introParagraph:
      'We are delighted to inform you that your admission application has been reviewed and APPROVED by the Admissions Office at Mugina Hope Primary & Nursery Academy.',
    instructionsParagraph:
      'To confirm your place and unlock your student admission record, please use your Admission Reference and unique Verification Code below on our Admission Verification page.',
    footerSignature: 'Admissions Office, Mugina Hope Primary School',
    updatedAt: new Date().toISOString(),
  },
  admission_rejected: {
    id: 'admission_rejected',
    label: 'Admission Application Decision (Not Approved)',
    subject: 'Mugina Hope Primary School - Admission Application Update',
    introParagraph:
      'Thank you for your interest in Mugina Hope Primary & Nursery Academy. After careful review of your application for this term, we regret to inform you that we are unable to offer a placement at this time.',
    instructionsParagraph:
      'Please feel free to contact our Admissions Office at +250 788 258 786 for guidance on upcoming term intakes or waitlist options.',
    footerSignature: 'Admissions Office, Mugina Hope Primary School',
    updatedAt: new Date().toISOString(),
  },
  admission_more_info: {
    id: 'admission_more_info',
    label: 'Request Additional Documents / Information',
    subject: 'Mugina Hope Primary School - Additional Information Requested',
    introParagraph:
      'Thank you for applying to Mugina Hope Primary & Nursery Academy. Before finalizing your admission decision, our Admissions Office requires a few additional details or documents.',
    instructionsParagraph:
      'Please submit the requested information via our website Application Status & Chat Tracker or visit our campus office adjacent to Mugina Police Station.',
    footerSignature: 'Admissions Office, Mugina Hope Primary School',
    updatedAt: new Date().toISOString(),
  },
  password_reset: {
    id: 'password_reset',
    label: 'Portal Password Reset Link',
    subject: 'Mugina Hope Primary School - Password Reset Request',
    introParagraph:
      'We received a request to reset the password for your Mugina Hope Primary School portal account.',
    instructionsParagraph:
      'Click the secure single-use link below to choose a new password. This link will expire in 30 minutes. If you did not request a reset, you can safely ignore this message.',
    footerSignature: 'IT & Administration Security Desk, Mugina Hope Primary School',
    updatedAt: new Date().toISOString(),
  },
};

function loadEmailTemplates(): Record<EmailTemplateConfig['id'], EmailTemplateConfig> {
  try {
    if (fs.existsSync(emailTemplatesStoreFile)) {
      const parsed = JSON.parse(fs.readFileSync(emailTemplatesStoreFile, 'utf8'));
      return { ...DEFAULT_EMAIL_TEMPLATES, ...parsed };
    }
  } catch (err) {
    console.warn('Error reading email_templates_store.json:', err);
  }
  return { ...DEFAULT_EMAIL_TEMPLATES };
}
function saveEmailTemplates(tpls: Record<EmailTemplateConfig['id'], EmailTemplateConfig>) {
  try {
    fs.writeFileSync(emailTemplatesStoreFile, JSON.stringify(tpls, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving email_templates_store.json:', err);
  }
}

function redactSensitiveEmailText(text: string): string {
  return String(text || '')
    .replace(/token=[a-zA-Z0-9_-]+/gi, 'token=[REDACTED]')
    .replace(/Verification Code:\s*<\/?[^>]*>\s*[A-Z0-9-]+/gi, 'Verification Code: [REDACTED]')
    .replace(/\b\d{6}\b/g, '[CODE-REDACTED]');
}

async function sendSchoolEmail(params: {
  to: string;
  subject: string;
  html: string;
  emailType: EmailDeliveryLog['emailType'];
  relatedRef?: string;
  sanitizedSummary: string;
  allowRetryHtml?: boolean;
  simulateFailure?: boolean;
}): Promise<{ success: boolean; log: EmailDeliveryLog; error?: string }> {
  const fromHeader = EMAIL_FROM_ADDRESS.includes('<')
    ? EMAIL_FROM_ADDRESS
    : `"Mugina Hope Primary School" <${EMAIL_FROM_ADDRESS}>`;

  const logs = loadEmailLogs();
  const logEntry: EmailDeliveryLog = {
    id: `eml-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    recipientEmail: params.to,
    emailType: params.emailType,
    subject: params.subject,
    status: 'Sent',
    relatedRef: params.relatedRef,
    sentAt: new Date().toISOString(),
    retryCount: 0,
    sanitizedSummary: redactSensitiveEmailText(params.sanitizedSummary),
    ...(params.allowRetryHtml ? { safeRetryHtml: params.html } : {}),
  };

  try {
    if (params.simulateFailure || !params.to || !params.to.includes('@')) {
      throw new Error(!params.to || !params.to.includes('@') ? 'Invalid recipient email address' : 'Simulated SMTP delivery failure');
    }

    await transporter.sendMail({
      from: fromHeader,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });

    logEntry.status = 'Sent';
    logs.unshift(logEntry);
    saveEmailLogs(logs);
    return { success: true, log: logEntry };
  } catch (err: any) {
    logEntry.status = 'Failed';
    logEntry.errorMessage = formatSmtpError(err);
    logs.unshift(logEntry);
    saveEmailLogs(logs);
    return { success: false, log: logEntry, error: logEntry.errorMessage };
  }
}

// Seed default administrators if staff_store.json does not exist yet (storing salted scrypt hashes cleanly)
function ensureAuthoritativeStaffList(): any[] {
  const disk = loadServerStaff();
  const seeds = [
    {
      id: 'staff-admin-norbert',
      name: 'Norbert Ihimbazwe Manzi (Chief Administrator)',
      role: 'SuperAdmin',
      email: 'norbertihimbazwemanzi@gmail.com',
      phone: '+250 788 258 786',
      username: 'norbertihimbazwemanzi@gmail.com',
      passwordHash: hashPassword('@0798744704'),
      assignedSubjectOrGrade: 'School Principal & System Controller',
      enrolledAt: '2026-01-01',
      status: 'Active',
    },
    {
      id: 'staff-headteacher-1',
      name: 'Headteacher / School Principal',
      role: 'HeadTeacher',
      email: 'headteacher@muginahopeschool.com',
      phone: '+250 788 258 786',
      username: 'hopeprimaryschool',
      passwordHash: hashPassword('hopeprimary@123'),
      assignedSubjectOrGrade: 'Executive School Leadership & Academics',
      enrolledAt: '2026-01-01',
      status: 'Active',
    },
  ];

  if (!disk || disk.length === 0) {
    saveServerStaff(seeds);
    return seeds;
  }

  // Upgrade any legacy plaintext password records silently into salted scrypt hashes without exposing plaintext
  let mutated = false;
  const upgraded = disk.map((st: any) => {
    if (!st) return st;
    if (!st.passwordHash && st.password && !st.password.startsWith('scrypt$')) {
      mutated = true;
      const { password, ...rest } = st;
      return { ...rest, passwordHash: hashPassword(password) };
    }
    return st;
  });

  const hasNorbert = upgraded.some(
    (s: any) =>
      s &&
      (String(s.username || '').toLowerCase() === 'norbertihimbazwemanzi@gmail.com' ||
        s.id === 'staff-admin-norbert')
  );
  if (!hasNorbert) {
    upgraded.unshift(seeds[0]);
    mutated = true;
  } else {
    for (let i = 0; i < upgraded.length; i++) {
      const s = upgraded[i];
      if (
        s &&
        (String(s.username || '').toLowerCase() === 'norbertihimbazwemanzi@gmail.com' ||
          s.id === 'staff-admin-norbert') &&
        !s.passwordHash
      ) {
        upgraded[i] = { ...s, username: 'norbertihimbazwemanzi@gmail.com', passwordHash: hashPassword('@0798744704') };
        mutated = true;
      }
    }
  }

  if (mutated) saveServerStaff(upgraded);
  return upgraded;
}

// 1. API Endpoint: Forward Contact Form Submissions
app.post('/api/contact', async (req, res) => {
  try {
    const { name, phone, email, subject, message } = req.body;

    if (!name || !phone || !message) {
      return res.status(400).json({ error: 'Missing required fields (name, phone, message)' });
    }

    // Email to School Official Gmail
    const adminMailOptions = {
      from: `"Mugina Hope Academy Web" <${SCHOOL_OFFICIAL_EMAIL}>`,
      to: SCHOOL_OFFICIAL_EMAIL,
      replyTo: email || undefined,
      subject: `[Website Inquiry] ${subject || 'New Contact'} from ${name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #1e3a8a; margin-top: 0;">Mugina Hope Primary & Nursery Academy</h2>
          <h3 style="color: #0f172a;">New Message from Contact Form</h3>
          <p><strong>Sender Name:</strong> ${name}</p>
          <p><strong>Phone:</strong> <a href="tel:${phone}">${phone}</a></p>
          <p><strong>Email:</strong> ${email || 'Not provided'}</p>
          <p><strong>Subject:</strong> ${subject}</p>
          <div style="background-color: #f8fafc; padding: 15px; border-left: 4px solid #3b82f6; margin: 15px 0;">
            <p style="margin: 0; white-space: pre-wrap;">${message}</p>
          </div>
          <p style="font-size: 12px; color: #64748b;">Campus Location: Adjacent to Mugina Police Station, Kamonyi, Rwanda</p>
        </div>
      `,
    };

    // Automated Feedback Email to Parent / Sender
    let feedbackSent = false;
    if (email && email.includes('@')) {
      const feedbackMailOptions = {
        from: `"Mugina Hope Academy" <${SCHOOL_OFFICIAL_EMAIL}>`,
        to: email,
        subject: `Thank you for contacting Mugina Hope Academy - We received your inquiry`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <div style="background-color: #1e3a8a; padding: 12px 16px; border-radius: 6px; color: white;">
              <h2 style="margin: 0; font-size: 18px;">Mugina Hope Primary & Nursery Academy</h2>
              <p style="margin: 2px 0 0 0; font-size: 12px; color: #fde047; font-style: italic;">&ldquo;We learn for our better future&rdquo;</p>
            </div>
            <h3 style="color: #0f172a; margin-top: 20px;">Muraho, ${name}!</h3>
            <p>Thank you for getting in touch with our school regarding <strong>&ldquo;${subject || 'General Inquiry'}&rdquo;</strong>.</p>
            <p>We have safely logged your message. Our administration desk, located right next to the Mugina Police Station in Kamonyi District, will follow up with you at <strong>${phone}</strong> shortly.</p>
            <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 12px; margin: 16px 0; font-size: 13px; color: #166534;">
              For urgent admissions questions, call or WhatsApp our official line: <strong>+250 788 258 786</strong>.
            </div>
            <p style="font-size: 12px; color: #64748b;">Mugina Sector, Kamonyi District, Southern Province, Rwanda · muginahopeschool.com</p>
          </div>
        `,
      };

      try {
        await transporter.sendMail(feedbackMailOptions);
        feedbackSent = true;
      } catch (err) {
        console.warn('Feedback email dispatch notice:', err);
      }
    }

    const adminInfo = await transporter.sendMail(adminMailOptions);

    return res.json({
      success: true,
      message: 'Inquiry forwarded to official school Gmail successfully',
      feedbackSent,
      info: adminInfo?.messageId || 'Delivered',
    });
  } catch (error: any) {
    console.error('Nodemailer Contact Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to send message' });
  }
});

// 2. API Endpoint: Student Attendance Notification to Parent's Gmail
app.post('/api/attendance/notify', async (req, res) => {
  try {
    const { studentName, studentId, grade, parentEmail, parentName, date, status, notes } = req.body;

    if (!studentName || !parentEmail || !status) {
      return res.status(400).json({ error: 'Missing required attendance fields' });
    }

    const isAbsent = status === 'Absent';
    const subject = isAbsent
      ? `[ATTENDANCE ALERT] ${studentName} was marked ABSENT on ${date}`
      : `[Attendance Notice] ${studentName} Attendance Record (${status}) on ${date}`;

    const mailOptions = {
      from: `"Mugina Hope Academy Discipline Office" <${SCHOOL_OFFICIAL_EMAIL}>`,
      to: parentEmail,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px; border: 1px solid ${isAbsent ? '#fca5a5' : '#e2e8f0'}; border-radius: 8px;">
          <div style="background-color: ${isAbsent ? '#b91c1c' : '#1e3a8a'}; padding: 12px 16px; border-radius: 6px; color: white;">
            <h2 style="margin: 0; font-size: 18px;">Mugina Hope Primary & Nursery Academy</h2>
            <p style="margin: 2px 0 0 0; font-size: 12px; color: #fde047;">Director of Discipline (DOD) Notification</p>
          </div>
          <h3 style="color: #0f172a; margin-top: 18px;">Dear Parent / Guardian of ${studentName},</h3>
          <p style="font-size: 14px; line-height: 1.5;">
            This is an official attendance notice for <strong>${studentName}</strong> (ID: <code>${studentId || 'N/A'}</code>, Class: <strong>${grade}</strong>) for date: <strong>${date}</strong>.
          </p>
          <div style="background-color: ${isAbsent ? '#fef2f2' : '#f0fdf4'}; border: 1px solid ${isAbsent ? '#fecaca' : '#bbf7d0'}; border-radius: 6px; padding: 14px; margin: 16px 0;">
            <p style="margin: 0; font-size: 15px; font-weight: bold; color: ${isAbsent ? '#991b1b' : '#166534'};">
              Status Recorded: ${status.toUpperCase()}
            </p>
            ${notes ? `<p style="margin: 6px 0 0 0; font-size: 13px; color: #475569;">Teacher Notes: ${notes}</p>` : ''}
          </div>
          ${isAbsent ? `
            <p style="font-size: 13px; color: #b91c1c; font-weight: bold;">
              If this absence was unexpected, please immediately contact our Director of Discipline (DOD) or administration desk at +250 788 258 786.
            </p>
          ` : `
            <p style="font-size: 13px; color: #475569;">Thank you for your active partnership in ensuring consistent learning.</p>
          `}
          <div style="margin-top: 20px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b;">
            Mugina Hope Academy · Kamonyi District · Southern Province, Rwanda
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    // Forward absence alert directly to school official Gmail as well
    if (isAbsent) {
      try {
        await transporter.sendMail({
          from: `"Mugina Hope Attendance Alert" <${SCHOOL_OFFICIAL_EMAIL}>`,
          to: SCHOOL_OFFICIAL_EMAIL,
          subject: `[ATTENDANCE ALERT] ${studentName} (${grade}) Recorded ABSENT on ${date}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px; border: 1px solid #fca5a5; border-radius: 8px;">
              <div style="background-color: #b91c1c; padding: 12px 16px; border-radius: 6px; color: white;">
                <h2 style="margin: 0; font-size: 18px;">Mugina Hope Primary & Nursery Academy</h2>
                <p style="margin: 2px 0 0 0; font-size: 12px; color: #fde047;">Official Discipline & Absence Alert</p>
              </div>
              <h3 style="color: #0f172a; margin-top: 16px;">Student Absence Logged</h3>
              <p><strong>Student Name:</strong> ${studentName}</p>
              <p><strong>Registration ID:</strong> <code>${studentId || 'N/A'}</code></p>
              <p><strong>Class:</strong> ${grade}</p>
              <p><strong>Date:</strong> ${date}</p>
              <p><strong>Parent Name:</strong> ${parentName || 'Parent'}</p>
              <p><strong>Parent Gmail:</strong> ${parentEmail}</p>
              ${notes ? `<p><strong>Discipline Notes:</strong> ${notes}</p>` : ''}
              <p style="font-size: 12px; color: #64748b; margin-top: 16px;">Automated attendance status dispatch to official school inbox.</p>
            </div>
          `,
        });
      } catch (adminErr) {
        console.warn('Notice sending copy to official school gmail:', adminErr);
      }
    }

    return res.json({ success: true, message: `Attendance email dispatched to ${parentEmail} and school Gmail` });
  } catch (error: any) {
    console.error('Attendance Notify Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to dispatch attendance notice' });
  }
});

// 2b. API Endpoint: Full Daily Attendance Status Report to School Official Gmail
app.post('/api/attendance/report', async (req, res) => {
  try {
    const { date, grade, total, present, absent, late, absentList, senderName } = req.body;

    const subject = `[Daily Attendance Report] Mugina Hope Academy - ${date} (${grade || 'All Classes'})`;
    const mailOptions = {
      from: `"Mugina Hope Attendance Desk" <${SCHOOL_OFFICIAL_EMAIL}>`,
      to: SCHOOL_OFFICIAL_EMAIL,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <div style="background-color: #1e3a8a; padding: 14px 18px; border-radius: 6px; color: white;">
            <h2 style="margin: 0; font-size: 20px;">Mugina Hope Primary & Nursery Academy</h2>
            <p style="margin: 2px 0 0 0; font-size: 12px; color: #fde047;">Official Daily Attendance Status Report</p>
          </div>
          <h3 style="color: #0f172a; margin-top: 18px;">Attendance Summary for ${date}</h3>
          <p>Class / Level: <strong>${grade || 'All Classes'}</strong> · Logged by: <strong>${senderName || 'Staff Administrator'}</strong></p>
          <div style="display: flex; gap: 10px; margin: 16px 0;">
            <div style="background-color: #f1f5f9; padding: 10px; border-radius: 6px; flex: 1; text-align: center;">
              <span style="font-size: 11px; color: #475569; display: block;">Total Learners</span>
              <strong style="font-size: 18px; color: #0f172a;">${total || 0}</strong>
            </div>
            <div style="background-color: #f0fdf4; padding: 10px; border-radius: 6px; flex: 1; text-align: center;">
              <span style="font-size: 11px; color: #166534; display: block;">Present</span>
              <strong style="font-size: 18px; color: #15803d;">${present || 0}</strong>
            </div>
            <div style="background-color: #fef2f2; padding: 10px; border-radius: 6px; flex: 1; text-align: center;">
              <span style="font-size: 11px; color: #991b1b; display: block;">Absent</span>
              <strong style="font-size: 18px; color: #b91c1c;">${absent || 0}</strong>
            </div>
            <div style="background-color: #fffbeb; padding: 10px; border-radius: 6px; flex: 1; text-align: center;">
              <span style="font-size: 11px; color: #92400e; display: block;">Late</span>
              <strong style="font-size: 18px; color: #b45309;">${late || 0}</strong>
            </div>
          </div>
          ${absentList && absentList.length > 0 ? `
            <div style="margin-top: 16px;">
              <h4 style="color: #b91c1c; margin-bottom: 8px;">Absent Students:</h4>
              <ul style="padding-left: 20px; font-size: 13px; color: #334155;">
                ${absentList.map((a: any) => `<li><strong>${a.name}</strong> (${a.grade || grade}) - Parent: ${a.parentEmail || a.parentPhone || 'N/A'}</li>`).join('')}
              </ul>
            </div>
          ` : '<p style="color: #15803d; font-size: 13px;">No absent students recorded.</p>'}
          <p style="font-size: 11px; color: #64748b; margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 12px;">
            Mugina Hope Primary & Nursery Academy · Located Adjacent to Mugina Police Station, Kamonyi, Rwanda
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    return res.json({ success: true, message: 'Daily attendance status report sent to official school Gmail' });
  } catch (error: any) {
    console.error('Attendance Report Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to send attendance report' });
  }
});

// 3a. API Endpoint: New Student Admission Registration
app.post('/api/admissions/register', async (req, res) => {
  try {
    const {
      refCode,
      studentName,
      gender,
      dob,
      gradeCode,
      parentName,
      parentPhone,
      parentEmail,
      sector,
      wantsLunch,
      wantsTransport,
      previousSchool,
      notes,
    } = req.body;

    if (!studentName || !parentPhone || !gradeCode) {
      return res.status(400).json({ error: 'Missing required registration fields' });
    }

    const applicationRef = refCode || `MHA-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    // 1. Mandatory Email Notification to School Admin (norbertihimbazwemanzi@gmail.com)
    const adminAlertOptions = {
      from: `"Mugina Hope Admissions Desk" <${SCHOOL_OFFICIAL_EMAIL}>`,
      to: SCHOOL_OFFICIAL_EMAIL,
      replyTo: parentEmail || undefined,
      subject: `[NEW REGISTRATION ALERT] Pupil ${studentName} applied for ${gradeCode} (Ref: ${applicationRef})`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 620px; padding: 22px; border: 1px solid #cbd5e1; border-radius: 10px; background-color: #ffffff;">
          <div style="background-color: #1e3a8a; padding: 14px 18px; border-radius: 8px; color: white;">
            <h2 style="margin: 0; font-size: 20px;">Mugina Hope Primary & Nursery Academy</h2>
            <p style="margin: 3px 0 0 0; font-size: 13px; color: #fde047; font-weight: bold;">
              New Online Student Admission Registered
            </p>
          </div>

          <div style="padding: 16px 0; border-bottom: 1px solid #e2e8f0;">
            <p style="margin: 0 0 10px 0; font-size: 15px; color: #0f172a;">
              A new student registration has been submitted and is <strong>waiting for administrator confirmation</strong> in the Staff Portal.
            </p>
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px;">
              <p style="margin: 4px 0; font-size: 14px;"><strong>Application Ref Code:</strong> <code style="background-color: #e0f2fe; padding: 2px 6px; border-radius: 4px; font-weight: bold; color: #0369a1;">${applicationRef}</code></p>
              <p style="margin: 4px 0; font-size: 14px;"><strong>Learner Name:</strong> ${studentName}</p>
              <p style="margin: 4px 0; font-size: 14px;"><strong>Target Class / Grade:</strong> <strong>${gradeCode}</strong></p>
              <p style="margin: 4px 0; font-size: 13px;"><strong>Gender / DOB:</strong> ${gender || 'N/A'} · ${dob || 'N/A'}</p>
              <p style="margin: 4px 0; font-size: 13px;"><strong>Parent / Guardian:</strong> ${parentName} (${parentPhone})</p>
              <p style="margin: 4px 0; font-size: 13px;"><strong>Parent Gmail:</strong> ${parentEmail || 'Not provided'}</p>
              <p style="margin: 4px 0; font-size: 13px;"><strong>Residential Location:</strong> ${sector || 'Mugina, Kamonyi'}</p>
              <p style="margin: 4px 0; font-size: 13px;"><strong>Hot Lunch Service:</strong> ${wantsLunch ? 'Yes (Requested)' : 'No'}</p>
              <p style="margin: 4px 0; font-size: 13px;"><strong>School Van Pick-up:</strong> ${wantsTransport ? 'Yes (Requested)' : 'No'}</p>
              ${previousSchool ? `<p style="margin: 4px 0; font-size: 13px;"><strong>Previous School:</strong> ${previousSchool}</p>` : ''}
              ${notes ? `<p style="margin: 4px 0; font-size: 13px;"><strong>Notes:</strong> ${notes}</p>` : ''}
            </div>
          </div>

          <div style="padding: 16px 0;">
            <p style="margin: 0 0 10px 0; font-size: 13px; color: #b45309; font-weight: bold;">
              Action Required: Please log in to the Admin Portal to review, verify required documentation, and confirm this registration.
            </p>
            <p style="margin: 0; font-size: 12px; color: #64748b;">
              Upon your confirmation, an automated acceptance notice and student portal credentials will be dispatched to the parent.
            </p>
          </div>

          <div style="margin-top: 18px; border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 11px; color: #94a3b8;">
            Mugina Hope Academy · Adjacent to Mugina Police Station, Kamonyi, Southern Province, Rwanda
          </div>
        </div>
      `,
    };

    try {
      await transporter.sendMail(adminAlertOptions);
    } catch (adminErr) {
      console.warn('Admin registration notification dispatch note:', adminErr);
    }

    // 2. Automated Confirmation Receipt to Parent's Gmail
    let parentReceiptSent = false;
    if (parentEmail && parentEmail.includes('@')) {
      const parentMailOptions = {
        from: `"Mugina Hope Primary & Nursery Academy" <${SCHOOL_OFFICIAL_EMAIL}>`,
        to: parentEmail,
        subject: `[Mugina Hope Academy] Registration Received for ${studentName} - Ref: ${applicationRef}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 22px; border: 1px solid #cbd5e1; border-radius: 10px; background-color: #ffffff;">
            <div style="background-color: #1e3a8a; padding: 14px 18px; border-radius: 8px; color: white;">
              <h2 style="margin: 0; font-size: 20px;">Mugina Hope Primary & Nursery Academy</h2>
              <p style="margin: 3px 0 0 0; font-size: 12px; color: #fde047; font-style: italic;">&ldquo;We learn for our better future&rdquo;</p>
            </div>

            <div style="padding: 18px 0; border-bottom: 1px solid #e2e8f0;">
              <h3 style="color: #0f172a; margin: 0 0 12px 0;">Muraho, ${parentName}!</h3>
              <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 14px 0;">
                Thank you for applying to enroll <strong>${studentName}</strong> into <strong>${gradeCode}</strong> at Mugina Hope Academy.
              </p>
              
              <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 14px; margin: 14px 0;">
                <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: bold; color: #92400e;">
                  Current Status: PENDING ADMINISTRATOR CONFIRMATION
                </p>
                <p style="margin: 0; font-size: 13px; color: #78350f;">
                  Your application has been safely registered and forwarded directly to School Administrator Norbert Ihimbazwe Manzi for verification.
                </p>
              </div>

              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px;">
                <p style="margin: 4px 0; font-size: 13px;"><strong>Your Application Reference Code:</strong> <code style="font-size: 15px; font-weight: bold; color: #1e3a8a;">${applicationRef}</code></p>
                <p style="margin: 4px 0; font-size: 13px;"><strong>Target Class:</strong> ${gradeCode}</p>
                <p style="margin: 4px 0; font-size: 13px;"><strong>Registered Contact:</strong> ${parentPhone}</p>
              </div>
            </div>

            <div style="padding: 16px 0;">
              <h4 style="color: #1e3a8a; margin: 0 0 8px 0;">What Happens Next?</h4>
              <ol style="margin: 0; padding-left: 20px; font-size: 13px; color: #475569; line-height: 1.6;">
                <li>Administrator review will be completed within 24–48 hours.</li>
                <li>Once confirmed, you will receive an official approval email with your child's assigned Student ID & Portal credentials right here at <strong>${parentEmail}</strong>.</li>
                <li>You can also visit our website anytime to track your live status and <strong>chat directly with the school administration</strong> using your reference code: <code>${applicationRef}</code>.</li>
              </ol>
            </div>

            <div style="margin-top: 16px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px; font-size: 12px; color: #166534;">
              Campus Location: Mugina Sector, Kamonyi District (Adjacent to Mugina Police Station) · Helpline: +250 788 258 786
            </div>
          </div>
        `,
      };

      try {
        await transporter.sendMail(parentMailOptions);
        parentReceiptSent = true;
      } catch (parentErr) {
        console.warn('Parent registration receipt dispatch note:', parentErr);
      }
    }

    // 3. Initialize Chat Thread in Server Store
    const threads = loadServerChats();
    const existingIdx = threads.findIndex((t) => t.refCode === applicationRef);
    const initialMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'system',
      senderName: 'Mugina Hope Administration Desk',
      text: `Registration received for ${studentName} (${gradeCode}). Application is currently under review by School Administrator Norbert Ihimbazwe Manzi.`,
      createdAt: new Date().toISOString(),
    };

    if (existingIdx >= 0) {
      threads[existingIdx].status = 'Pending Confirmation';
      threads[existingIdx].updatedAt = new Date().toISOString();
      threads[existingIdx].messages.push(initialMsg);
    } else {
      threads.unshift({
        refCode: applicationRef,
        studentName,
        parentName,
        parentEmail,
        parentPhone,
        gradeCode,
        status: 'Pending Confirmation',
        messages: [initialMsg],
        updatedAt: new Date().toISOString(),
      });
    }
    saveServerChats(threads);

    return res.json({
      success: true,
      refCode: applicationRef,
      message: 'Registration submitted successfully. Admin notified at official school Gmail.',
      parentReceiptSent,
    });
  } catch (error: any) {
    console.error('Registration API Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to submit registration' });
  }
});

// 3b. API Endpoint: Admissions Confirmation & Student Credentials Feedback
app.post('/api/admissions/confirm', async (req, res) => {
  try {
    const { studentName, studentId, grade, parentName, parentEmail, studentUsername, studentPassword, feedbackNotes, refCode } = req.body;

    if (!parentEmail || !studentName) {
      return res.status(400).json({ error: 'Missing required admission fields' });
    }

    const mailOptions = {
      from: `"Mugina Hope Academy - Administration" <${SCHOOL_OFFICIAL_EMAIL}>`,
      to: parentEmail,
      subject: `Official Admission Confirmation & Student Portal Credentials: ${studentName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px; border: 1px solid #93c5fd; border-radius: 8px;">
          <div style="background-color: #1e3a8a; padding: 14px 18px; border-radius: 6px; color: white;">
            <h2 style="margin: 0; font-size: 20px;">Mugina Hope Primary & Nursery Academy</h2>
            <p style="margin: 2px 0 0 0; font-size: 12px; color: #fde047;">Official Acceptance & Enrollment Notification</p>
          </div>
          <h3 style="color: #0f172a; margin-top: 20px;">Congratulations, ${parentName || 'Parent / Guardian'}!</h3>
          <p style="font-size: 14px; line-height: 1.6;">
            We are pleased to inform you that the registration for <strong>${studentName}</strong> into <strong>${grade}</strong> has been <strong>OFFICIALLY CONFIRMED & APPROVED</strong> by School Administrator Norbert Ihimbazwe Manzi and the Board of Studies.
          </p>

          <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; margin: 18px 0;">
            <h4 style="margin: 0 0 10px 0; color: #1e3a8a; font-size: 14px;">Student Portal Credentials:</h4>
            <p style="margin: 4px 0; font-size: 13px;"><strong>Student Registration ID:</strong> <code>${studentId || 'MHA-STU-2026'}</code></p>
            <p style="margin: 4px 0; font-size: 13px;"><strong>Username / Code:</strong> <code>${studentUsername || studentId}</code></p>
            <p style="margin: 4px 0; font-size: 13px;"><strong>Temporary Password:</strong> <code>${studentPassword || 'mugina@student'}</code></p>
            <p style="margin: 8px 0 0 0; font-size: 12px; color: #64748b;">(Keep these credentials safe for viewing attendance and school reports)</p>
          </div>

          ${feedbackNotes ? `
            <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px; margin: 16px 0; font-size: 13px; color: #1e3a8a;">
              <strong>Administration Feedback:</strong> ${feedbackNotes}
            </div>
          ` : ''}

          <div style="font-size: 13px; color: #334155; line-height: 1.5;">
            <p><strong>Next Steps:</strong></p>
            <ol style="padding-left: 20px;">
              <li>Visit the bursar's office next to Mugina Police Station to collect the uniform pack.</li>
              <li>Attend new learner orientation with class teacher.</li>
            </ol>
          </div>

          <div style="margin-top: 24px; padding-top: 14px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b;">
            Mugina Hope Primary & Nursery Academy · Kamonyi District · Tel: +250 788 258 786
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    // Send copy to School Official Gmail (norbertihimbazwemanzi@gmail.com)
    try {
      await transporter.sendMail({
        from: `"Mugina Hope Admissions Confirmations" <${SCHOOL_OFFICIAL_EMAIL}>`,
        to: SCHOOL_OFFICIAL_EMAIL,
        subject: `[CONFIRMATION DISPATCHED] ${studentName} (${grade}) Confirmed - ID: ${studentId}`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 16px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h3 style="color: #1e3a8a;">Registration Confirmed & Dispatched</h3>
            <p><strong>Student:</strong> ${studentName} (${grade})</p>
            <p><strong>Assigned ID:</strong> <code>${studentId}</code></p>
            <p><strong>Parent Gmail:</strong> ${parentEmail}</p>
            <p><strong>Parent Name:</strong> ${parentName}</p>
            <p><strong>Feedback:</strong> ${feedbackNotes || 'None'}</p>
          </div>
        `,
      });
    } catch (e) {
      console.warn('Copy to admin notice:', e);
    }

    // Update Chat Thread to Confirmed & add system message
    const threads = loadServerChats();
    const targetThread = threads.find(
      (t) => (refCode && t.refCode === refCode) || (t.studentName.toLowerCase() === studentName.toLowerCase())
    );
    if (targetThread) {
      targetThread.status = 'Confirmed & Enrolled';
      targetThread.updatedAt = new Date().toISOString();
      targetThread.messages.push({
        id: `msg-${Date.now()}`,
        sender: 'system',
        senderName: 'Mugina Hope Administration Desk',
        text: `🎉 Registration confirmed! ${studentName} has been officially approved and enrolled. Assigned Student Registration ID: ${studentId}. Welcome to Mugina Hope Academy!`,
        createdAt: new Date().toISOString(),
      });
      saveServerChats(threads);
    }

    return res.json({ success: true, message: `Admission approval email dispatched to ${parentEmail} and admin notified` });
  } catch (error: any) {
    console.error('Admission Confirmation Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to dispatch admission confirmation' });
  }
});

// 3c. API Endpoints: Applicant & Admin Live Chat Threads
app.get('/api/chats', (req, res) => {
  const threads = loadServerChats();
  res.json({ success: true, threads });
});

app.get('/api/chats/:refCode', (req, res) => {
  const { refCode } = req.params;
  const threads = loadServerChats();
  const search = refCode.trim().toLowerCase();
  const match = threads.find(
    (t) => t.refCode.toLowerCase() === search || (t.parentEmail && t.parentEmail.toLowerCase() === search)
  );

  if (!match) {
    return res.status(404).json({ error: 'Chat thread not found for reference code' });
  }
  return res.json({ success: true, thread: match });
});

app.post('/api/chats/:refCode/messages', async (req, res) => {
  try {
    const { refCode } = req.params;
    const { sender, senderName, text } = req.body;

    if (!text || !sender) {
      return res.status(400).json({ error: 'Message text and sender are required' });
    }

    const threads = loadServerChats();
    let thread = threads.find((t) => t.refCode.toLowerCase() === refCode.trim().toLowerCase());

    const newMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: sender as 'parent' | 'admin',
      senderName: senderName || (sender === 'admin' ? 'Norbert Ihimbazwe Manzi (Admin)' : 'Parent'),
      text: text.trim(),
      createdAt: new Date().toISOString(),
    };

    if (!thread) {
      thread = {
        refCode,
        studentName: 'Applicant',
        parentName: senderName || 'Parent',
        gradeCode: 'General Inquiry',
        status: 'Pending Confirmation',
        messages: [newMessage],
        updatedAt: new Date().toISOString(),
      };
      threads.unshift(thread);
    } else {
      thread.messages.push(newMessage);
      thread.updatedAt = new Date().toISOString();
    }

    saveServerChats(threads);

    // If Parent sent message -> Notify Admin via Gmail
    if (sender === 'parent') {
      try {
        await transporter.sendMail({
          from: `"Mugina Hope Applicant Chat" <${SCHOOL_OFFICIAL_EMAIL}>`,
          to: SCHOOL_OFFICIAL_EMAIL,
          subject: `[New Parent Message] Ref: ${refCode} from ${senderName || 'Parent'}`,
          html: `
            <div style="font-family: Arial, sans-serif; padding: 18px; border: 1px solid #e2e8f0; border-radius: 8px;">
              <h3 style="color: #1e3a8a; margin-top: 0;">New Message from Applicant Parent</h3>
              <p><strong>Ref Code:</strong> <code>${refCode}</code></p>
              <p><strong>Sender:</strong> ${senderName || 'Parent'}</p>
              <p><strong>Student:</strong> ${thread.studentName} (${thread.gradeCode})</p>
              <div style="background-color: #f1f5f9; padding: 12px; border-left: 4px solid #3b82f6; border-radius: 4px; margin: 12px 0;">
                <p style="margin: 0; font-size: 14px;">${text}</p>
              </div>
              <p style="font-size: 12px; color: #64748b;">Reply directly in the Admin Portal Applicant Chat tab.</p>
            </div>
          `,
        });
      } catch (err) {
        console.warn('Parent message notification note:', err);
      }
    }

    // If Admin sent message -> Notify Parent via Gmail
    if (sender === 'admin' && thread.parentEmail && thread.parentEmail.includes('@')) {
      try {
        await transporter.sendMail({
          from: `"Mugina Hope Academy Administration" <${SCHOOL_OFFICIAL_EMAIL}>`,
          to: thread.parentEmail,
          subject: `[Mugina Hope Academy] Message from Administrator Norbert Ihimbazwe Manzi regarding ${thread.studentName}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px; border: 1px solid #cbd5e1; border-radius: 8px;">
              <h3 style="color: #1e3a8a; margin-top: 0;">Message from School Administration</h3>
              <p>Dear ${thread.parentName || 'Parent'},</p>
              <p>School Administrator Norbert Ihimbazwe Manzi sent a message regarding application <strong>${refCode}</strong> for <strong>${thread.studentName}</strong>:</p>
              <div style="background-color: #eff6ff; padding: 14px; border-left: 4px solid #2563eb; border-radius: 6px; margin: 16px 0;">
                <p style="margin: 0; font-size: 14px; color: #1e3a8a; font-weight: 500;">${text}</p>
              </div>
              <p style="font-size: 13px; color: #475569;">You can reply to this message anytime directly in the Applicant Chat console on our school website.</p>
              <p style="font-size: 11px; color: #94a3b8; margin-top: 18px; border-top: 1px solid #e2e8f0; padding-top: 10px;">
                Mugina Hope Primary & Nursery Academy · Kamonyi District, Rwanda
              </p>
            </div>
          `,
        });
      } catch (err) {
        console.warn('Admin message dispatch note to parent:', err);
      }
    }

    return res.json({ success: true, message: newMessage });
  } catch (error: any) {
    console.error('Chat message error:', error);
    return res.status(500).json({ error: error.message || 'Failed to post message' });
  }
});

// 4. API Endpoint: File / Asset Upload handler (Cross-Device Shared Storage)
app.post('/api/upload', (req, res) => {
  try {
    const { fileData, fileName, category, title, description, caption } = req.body;
    if (!fileData || !title) {
      return res.status(400).json({ error: 'fileData and title are required' });
    }

    let publicUrl = fileData;

    // If fileData is base64 data (image or document), persist it to disk in uploads directory so all devices can view/download it
    if (typeof fileData === 'string' && fileData.startsWith('data:')) {
      try {
        const imgMatches = fileData.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
        const docMatches = fileData.match(/^data:([a-zA-Z0-9.+/-]+);base64,(.+)$/);
        if (imgMatches && imgMatches.length === 3) {
          const ext = imgMatches[1] === 'jpeg' ? 'jpg' : imgMatches[1].replace('+xml', '');
          const base64Content = imgMatches[2];
          const buffer = Buffer.from(base64Content, 'base64');
          const cleanName = (fileName || title || 'asset').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
          const savedFileName = `${Date.now()}_${cleanName}.${ext}`;
          const filePath = path.join(uploadsDir, savedFileName);

          fs.writeFileSync(filePath, buffer);
          publicUrl = `/uploads/${savedFileName}`;
        } else if (docMatches && docMatches.length === 3) {
          const mime = docMatches[1];
          const rawExt = path.extname(fileName || '').replace('.', '').toLowerCase();
          const ext =
            rawExt ||
            (mime.includes('pdf')
              ? 'pdf'
              : mime.includes('wordprocessingml')
              ? 'docx'
              : mime.includes('msword')
              ? 'doc'
              : mime.includes('plain')
              ? 'txt'
              : 'bin');
          const buffer = Buffer.from(docMatches[2], 'base64');
          const cleanName = (fileName || title || 'doc').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 36);
          const savedFileName = `${Date.now()}_${cleanName}.${ext}`;
          const filePath = path.join(uploadsDir, savedFileName);
          fs.writeFileSync(filePath, buffer);
          publicUrl = `/uploads/${savedFileName}`;
        }
      } catch (writeErr) {
        console.warn('Error saving file buffer to uploads dir:', writeErr);
      }
    }

    // Returns formatted asset object ready for gallery consumption
    const newAsset = {
      id: `asset-${Date.now()}`,
      title,
      category: category || 'classrooms',
      description: description || title,
      caption: caption || title,
      imageSrc: publicUrl,
      createdAt: new Date().toISOString(),
    };

    // Persist into server gallery store
    const currentItems = loadServerGallery();
    const updatedItems = [newAsset, ...currentItems.filter((i: any) => i.id !== newAsset.id)];
    saveServerGallery(updatedItems);

    return res.json({ success: true, asset: newAsset });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Upload failed' });
  }
});

// 5. API Endpoints: Shared Cross-Device School Gallery
app.get('/api/gallery', (req, res) => {
  const items = loadServerGallery();
  res.json({ success: true, items });
});

app.post('/api/gallery', (req, res) => {
  try {
    if (Array.isArray(req.body?.items)) {
      const nextItems = req.body.items;
      saveServerGallery(nextItems);
      return res.json({ success: true, items: nextItems });
    }
    const item = req.body;
    if (!item || !item.title) {
      return res.status(400).json({ error: 'Item data with title is required' });
    }
    const currentItems = loadServerGallery();
    const itemWithId = {
      ...item,
      id: item.id || `fac-${Date.now()}`,
    };
    const updated = [itemWithId, ...currentItems.filter((i: any) => i.id !== itemWithId.id)];
    saveServerGallery(updated);
    return res.json({ success: true, item: itemWithId, items: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to save gallery item' });
  }
});

app.delete('/api/gallery/:id', (req, res) => {
  try {
    const { id } = req.params;
    const currentItems = loadServerGallery();
    const updated = currentItems.filter((i: any) => i.id !== id);
    saveServerGallery(updated);
    return res.json({ success: true, items: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to delete gallery item' });
  }
});

// Website settings endpoint for admin web updates
app.get('/api/settings', (req, res) => {
  const settings = loadServerSettings();
  res.json({ success: true, settings });
});

app.post('/api/settings', (req, res) => {
  try {
    const settings = req.body;
    saveServerSettings(settings);
    res.json({ success: true, settings });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to save settings' });
  }
});

// Database REST API Endpoints (All changes saved to persistent disk database)
// 1. Staff Members (Strips sensitive hashes/plaintext on GET; hashes new plaintext safely on POST)
app.get('/api/staff', (req, res) => {
  const items = ensureAuthoritativeStaffList();
  const sanitized = items.map(({ passwordHash: _ph, clientPasswordHash: _cph, password: _pw, ...rest }: any) => ({
    ...rest,
    password: '',
    hasPassword: Boolean(_ph || _cph || _pw),
  }));
  res.json({ success: true, items: sanitized });
});
app.post('/api/staff', (req, res) => {
  try {
    const incoming = Array.isArray(req.body?.items) ? req.body.items : Array.isArray(req.body) ? req.body : [];
    const existing = ensureAuthoritativeStaffList();
    const existingById = new Map<string, any>();
    const existingByUsername = new Map<string, any>();
    existing.forEach((st: any) => {
      if (st?.id) existingById.set(st.id, st);
      if (st?.username) existingByUsername.set(String(st.username).trim().toLowerCase(), st);
    });

    const merged = incoming.map((item: any) => {
      const unameKey = String(item.username || '').trim().toLowerCase();
      const prev = existingById.get(item.id) || (unameKey ? existingByUsername.get(unameKey) : undefined);
      const rawPw = String(item.password || '').trim();
      const rawClientHash = String(item.clientPasswordHash || '').trim();
      const { password: _discardPlain, clientPasswordHash: _discardClientHash, ...rest } = item;
      let nextHash = prev?.passwordHash || item.passwordHash;
      if (rawPw && rawPw !== '••••••') {
        nextHash = hashPassword(rawPw);
      } else if (rawClientHash && (rawClientHash.startsWith('sha256$') || rawClientHash.startsWith('scrypt$'))) {
        nextHash = rawClientHash;
      } else if (!nextHash && prev?.password) {
        nextHash = hashPassword(prev.password);
      }
      return {
        ...rest,
        status: rest.status === 'Inactive' ? 'Inactive' : 'Active',
        ...(nextHash ? { passwordHash: nextHash } : {}),
      };
    });

    saveServerStaff(merged);
    const sanitized = merged.map(({ passwordHash: _ph, clientPasswordHash: _cph, password: _pw, ...rest }: any) => ({
      ...rest,
      password: '',
      hasPassword: Boolean(_ph || _cph || _pw),
    }));
    res.json({ success: true, items: sanitized });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to save staff database' });
  }
});

app.delete('/api/staff/:id', (req, res) => {
  try {
    const { id } = req.params;
    const currentItems = ensureAuthoritativeStaffList();
    const updated = currentItems.filter((s: any) => s.id !== id);
    saveServerStaff(updated);
    const sanitized = updated.map(({ passwordHash: _ph, password: _pw, ...rest }: any) => ({
      ...rest,
      password: '',
      hasPassword: Boolean(_ph || _pw),
    }));
    return res.json({ success: true, items: sanitized });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to delete staff member' });
  }
});

// 1b. Self-service Staff / Teacher Profile Update (name, email, phone, photoUrl, bio, assignedSubjectOrGrade)
app.post('/api/staff/profile', (req, res) => {
  try {
    const staffToken = verifyStaffToken(req.headers.authorization);
    if (!staffToken) {
      return res.status(401).json({ error: 'Valid staff authentication token required.' });
    }
    const { name, email, phone, photoUrl, bio, assignedSubjectOrGrade } = req.body || {};
    const list = ensureAuthoritativeStaffList();
    const idx = list.findIndex((s: any) => s.id === staffToken.id);
    if (idx < 0) {
      return res.status(404).json({ error: 'Staff profile record not found.' });
    }
    const current = list[idx];
    const updatedMember = {
      ...current,
      name: typeof name === 'string' && name.trim() ? name.trim() : current.name,
      email: typeof email === 'string' ? email.trim() : current.email,
      phone: typeof phone === 'string' ? phone.trim() : current.phone,
      photoUrl: typeof photoUrl === 'string' ? photoUrl.trim() : current.photoUrl,
      bio: typeof bio === 'string' ? bio.trim() : current.bio,
      assignedSubjectOrGrade:
        typeof assignedSubjectOrGrade === 'string' && assignedSubjectOrGrade.trim()
          ? assignedSubjectOrGrade.trim()
          : current.assignedSubjectOrGrade,
      updatedAt: new Date().toISOString(),
    };
    list[idx] = updatedMember;
    saveServerStaff(list);

    const { passwordHash: _ph, password: _pw, ...safeMember } = updatedMember;
    return res.json({
      success: true,
      staff: { ...safeMember, password: '', hasPassword: Boolean(_ph || _pw) },
      session: {
        id: updatedMember.id,
        name: updatedMember.name,
        role: updatedMember.role,
        username: updatedMember.username,
        email: updatedMember.email || '',
        phone: updatedMember.phone || '',
        photoUrl: updatedMember.photoUrl || '',
        bio: updatedMember.bio || '',
        assignedSubjectOrGrade: updatedMember.assignedSubjectOrGrade || '',
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to update staff profile' });
  }
});

// 2. Enrolled Students (Preserves passwordHash cleanly on updates)
app.get('/api/students', (req, res) => {
  const items = loadServerStudents();
  if (!items) return res.json({ success: true, items: null });
  const sanitized = items.map(({ passwordHash: _ph, clientPasswordHash: _cph, ...rest }: any) => ({
    ...rest,
    hasPasswordHash: Boolean(_ph || _cph),
  }));
  res.json({ success: true, items: sanitized });
});
app.post('/api/students', (req, res) => {
  try {
    const incoming = req.body.items || req.body;
    const existing = loadServerStudents() || [];
    const existingById = new Map<string, any>();
    const existingByReg = new Map<string, any>();
    existing.forEach((st: any) => {
      if (st?.id) existingById.set(st.id, st);
      if (st?.regNumber) existingByReg.set(String(st.regNumber).trim().toLowerCase(), st);
    });

    const normalized = Array.isArray(incoming)
      ? incoming.map((st: any) => {
          const regKey = String(st.regNumber || '').trim().toLowerCase();
          const prev = existingById.get(st.id) || (regKey ? existingByReg.get(regKey) : undefined);
          const rawPw = String(st.studentPassword || '').trim();
          const rawClientHash = String(st.clientPasswordHash || '').trim();
          const incomingUser = String(st.studentUsername || '').trim();
          const { clientPasswordHash: _discardClientHash, ...restSt } = st;
          let nextHash = prev?.passwordHash || st.passwordHash;
          if (rawPw && rawPw !== '••••••') {
            nextHash = hashPassword(rawPw);
          } else if (rawClientHash && (rawClientHash.startsWith('sha256$') || rawClientHash.startsWith('scrypt$'))) {
            nextHash = rawClientHash;
          } else if (!nextHash && prev?.studentPassword) {
            nextHash = hashPassword(prev.studentPassword);
          }
          // Avoid storing plain passwords on disk once passwordHash exists
          return {
            ...restSt,
            studentUsername: incomingUser || prev?.studentUsername || '',
            studentAccountActive:
              st.studentAccountActive !== undefined
                ? st.studentAccountActive
                : prev?.studentAccountActive !== undefined
                ? prev.studentAccountActive
                : true,
            studentPassword: '',
            ...(nextHash ? { passwordHash: nextHash } : {}),
          };
        })
      : incoming;

    saveServerStudents(normalized);
    const sanitized = Array.isArray(normalized)
      ? normalized.map(({ passwordHash: _ph, clientPasswordHash: _cph, ...rest }: any) => ({
          ...rest,
          hasPasswordHash: Boolean(_ph || _cph),
        }))
      : normalized;
    res.json({ success: true, items: sanitized });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to save students database' });
  }
});

// 3. Student Attendance Records
app.get('/api/attendance', (req, res) => {
  const items = loadServerAttendance();
  res.json({ success: true, items });
});
app.post('/api/attendance', (req, res) => {
  try {
    const incoming = Array.isArray(req.body?.items)
      ? req.body.items
      : Array.isArray(req.body?.records)
      ? req.body.records
      : Array.isArray(req.body)
      ? req.body
      : [];
    const staffToken = verifyStaffToken(req.headers.authorization);
    if (staffToken && staffToken.role === 'Teacher') {
      const allowedGrades = getTeacherAllowedGradesServer(staffToken.id, staffToken.name);
      const existing = loadServerAttendance() || [];
      const existingByKey = new Map<string, any>();
      existing.forEach((rec: any) => {
        existingByKey.set(`${rec.studentId}_${rec.date}`, rec);
      });
      for (const rec of incoming) {
        const key = `${rec.studentId}_${rec.date}`;
        const prev = existingByKey.get(key);
        const isChangedOrNew =
          !prev ||
          prev.status !== rec.status ||
          (prev.notes || '') !== (rec.notes || '') ||
          prev.gradeCode !== rec.gradeCode;
        if (isChangedOrNew && !allowedGrades.includes(String(rec.gradeCode || '').toUpperCase())) {
          return res.status(403).json({
            error:
              allowedGrades.length > 0
                ? `Forbidden: Teachers can only record attendance for their assigned class(es): ${allowedGrades.join(', ')}.`
                : 'Forbidden: You do not have any assigned classes for attendance recording.',
          });
        }
      }
      // Preserve untouched records from other grades safely while updating teacher's assigned grades
      const mergedMap = new Map<string, any>();
      existing.forEach((rec: any) => {
        mergedMap.set(`${rec.studentId}_${rec.date}`, rec);
      });
      incoming.forEach((rec: any) => {
        if (allowedGrades.includes(String(rec.gradeCode || '').toUpperCase())) {
          mergedMap.set(`${rec.studentId}_${rec.date}`, rec);
        }
      });
      const merged = Array.from(mergedMap.values());
      saveServerAttendance(merged);
      return res.json({ success: true, items: merged });
    }
    saveServerAttendance(incoming);
    res.json({ success: true, items: incoming });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to save attendance database' });
  }
});

// 3b. Teacher & Staff Attendance (DOS & Admin)
app.get('/api/teacher-attendance', (req, res) => {
  const items = loadServerTeacherAttendance();
  res.json({ success: true, items });
});
app.post('/api/teacher-attendance', (req, res) => {
  try {
    const items = req.body.items || req.body;
    saveServerTeacherAttendance(items);
    res.json({ success: true, items });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to save teacher attendance database' });
  }
});

// 3c. Student Discipline & Conduct Records (DOD & Admin)
app.get('/api/discipline', (req, res) => {
  const items = loadServerDiscipline();
  res.json({ success: true, items });
});
app.post('/api/discipline', (req, res) => {
  try {
    const items = req.body.items || req.body;
    saveServerDiscipline(items);
    res.json({ success: true, items });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to save discipline database' });
  }
});

// 4. Payment Transactions & Accounting Ledger
app.get('/api/payments', (req, res) => {
  const items = loadServerPayments();
  res.json({ success: true, items });
});
app.post('/api/payments', (req, res) => {
  try {
    const items = req.body.items || req.body;
    saveServerPayments(items);
    res.json({ success: true, items });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to save payments database' });
  }
});

// 5. Registration Documents
app.get('/api/documents', (req, res) => {
  const items = loadServerDocuments();
  res.json({ success: true, items });
});
app.post('/api/documents', (req, res) => {
  try {
    const items = req.body.items || req.body;
    saveServerDocuments(items);
    res.json({ success: true, items });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to save documents database' });
  }
});

// 6. Applications & Confirmations
app.get('/api/applications', (req, res) => {
  const items = loadServerApplications();
  res.json({ success: true, items });
});
app.post('/api/applications', (req, res) => {
  try {
    const items = req.body.items || req.body;
    saveServerApplications(items);
    res.json({ success: true, items });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to save applications database' });
  }
});

// 7. School Management System (SMS) Extended Domain Store (Academics, Exams, LMS, Messages, Audit Logs)
const smsStoreFile = path.resolve(__dirname, 'sms_store.json');
function loadSmsStore(): Record<string, any> {
  try {
    if (fs.existsSync(smsStoreFile)) {
      return JSON.parse(fs.readFileSync(smsStoreFile, 'utf8'));
    }
  } catch (err) {
    console.warn('Error reading sms_store.json:', err);
  }
  return {};
}
function saveSmsStore(store: Record<string, any>) {
  try {
    fs.writeFileSync(smsStoreFile, JSON.stringify(store, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving sms_store.json:', err);
  }
}

const VALID_SMS_DOMAINS = new Set([
  'academic_years_terms',
  'school_classes_streams',
  'school_subjects',
  'teacher_assignments',
  'exam_config',
  'exam_schedules',
  'exam_marks',
  'lesson_plans',
  'learning_materials',
  'homework_assignments',
  'homework_submissions',
  'student_achievements',
  'student_notifications',
  'class_announcements',
  'class_timetables',
  'parent_teacher_messages',
  'audit_logs',
  'fee_structures',
]);

// 7a. Backend Staff & Admin Authentication Endpoint (Supports salted scrypt hashes + Active check)
app.post('/api/auth/staff-login', (req, res) => {
  try {
    const { identifier, password } = req.body || {};
    const cleanId = String(identifier || '').trim().toLowerCase();
    const cleanPass = String(password || '').trim();

    if (!cleanPass) {
      return res.status(400).json({ error: 'Password is required.' });
    }

    const staffList = ensureAuthoritativeStaffList();

    // Lookup matching staff by username, email, or quick admin shortcut
    let match = staffList.find(
      (s: any) =>
        cleanId &&
        (String(s.username || '').trim().toLowerCase() === cleanId ||
          String(s.email || '').trim().toLowerCase() === cleanId)
    );

    if (!match && (!cleanId || cleanId === 'admin') && cleanPass === 'mugina2026') {
      match = staffList.find((s: any) => String(s.username || '').trim().toLowerCase() === 'norbertihimbazwemanzi@gmail.com');
    } else if (!match && !cleanId) {
      match = staffList.find((s: any) => verifyPassword(cleanPass, s.passwordHash || s.clientPasswordHash || s.password));
    }

    if (!match) {
      return res.status(401).json({ error: 'Invalid staff username/email or password.' });
    }

    // Verify password against hashed/stored credential (if not shared quick-access mugina2026 shortcut before reset)
    const isSharedAdminCode =
      (!cleanId || cleanId === 'admin') &&
      cleanPass === 'mugina2026' &&
      String(match.username || '').trim().toLowerCase() === 'norbertihimbazwemanzi@gmail.com';
    const validPass =
      isSharedAdminCode || verifyPassword(cleanPass, match.passwordHash || match.clientPasswordHash || match.password);

    if (!validPass) {
      return res.status(401).json({ error: 'Invalid staff username/email or password.' });
    }

    if (match.status === 'Inactive') {
      return res.status(403).json({
        error: 'This staff account has been deactivated by the Administrator. Contact School Administration.',
      });
    }

    const tokenPayload: StaffTokenPayload = {
      id: match.id,
      name: match.name,
      username: match.username,
      email: match.email || '',
      role: match.role,
      exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
    };
    const token = signStaffToken(tokenPayload);

    return res.json({
      success: true,
      token,
      session: {
        id: match.id,
        name: match.name,
        role: match.role,
        username: match.username,
        email: match.email || '',
        phone: match.phone || '',
        photoUrl: match.photoUrl || '',
        bio: match.bio || '',
        assignedSubjectOrGrade: match.assignedSubjectOrGrade || '',
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Staff authentication failed' });
  }
});

// 7a-2. Backend Firebase Google Identity -> Signed Staff Token Exchange
app.post('/api/auth/staff-firebase-session', async (req, res) => {
  try {
    const { idToken } = req.body || {};
    if (!idToken) {
      return res.status(400).json({ error: 'Firebase idToken is required.' });
    }
    const firebaseConfigPath = path.resolve(__dirname, 'firebase-applet-config.json');
    const fbCfg = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
    const lookupRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(fbCfg.apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!lookupRes.ok) {
      return res.status(401).json({ error: 'Invalid Firebase authentication token.' });
    }
    const lookupData = (await lookupRes.json()) as any;
    const fbUser = lookupData?.users?.[0];
    const verifiedEmail = String(fbUser?.email || '').trim().toLowerCase();
    if (!verifiedEmail) {
      return res.status(401).json({ error: 'Verified email missing from Firebase identity.' });
    }

    const staffList = ensureAuthoritativeStaffList();
    const match = staffList.find(
      (s: any) =>
        s.status !== 'Inactive' &&
        (String(s.email || '').toLowerCase() === verifiedEmail ||
          String(s.username || '').toLowerCase() === verifiedEmail)
    );
    if (!match) {
      return res.status(403).json({ error: 'Firebase account is not an active authorized school staff member.' });
    }

    const token = signStaffToken({
      id: match.id,
      name: match.name,
      username: match.username,
      email: match.email || verifiedEmail,
      role: match.role,
      exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
    });
    return res.json({
      success: true,
      token,
      session: {
        id: match.id,
        name: match.name,
        role: match.role,
        username: match.username,
        email: match.email || verifiedEmail,
        phone: match.phone || '',
        photoUrl: match.photoUrl || '',
        bio: match.bio || '',
        assignedSubjectOrGrade: match.assignedSubjectOrGrade || '',
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to verify Firebase staff session' });
  }
});

// 7a-3. Backend Student Login Endpoint (Supports salted scrypt hashes + legacy credentials)
app.post('/api/auth/student-login', (req, res) => {
  try {
    const { identifier, password } = req.body || {};
    const cleanId = String(identifier || '').trim().toLowerCase();
    const cleanPass = String(password || '').trim();
    if (!cleanId || !cleanPass) {
      return res.status(400).json({ error: 'Student ID / Username and password are required.' });
    }

    const students = loadServerStudents() || [];
    const match = students.find(
      (s: any) =>
        (String(s.studentUsername || '').trim().toLowerCase() === cleanId ||
          String(s.regNumber || '').trim().toLowerCase() === cleanId ||
          String(s.email || '').trim().toLowerCase() === cleanId) &&
        verifyPassword(cleanPass, s.passwordHash || s.clientPasswordHash || s.studentPassword)
    );

    if (!match) {
      return res.status(401).json({ error: 'Invalid Student ID / Username or password.' });
    }

    if (match.studentAccountActive === false || (match.status && match.status !== 'Active')) {
      return res.status(403).json({
        error: `Student portal access is currently ${match.status === 'Active' ? 'deactivated' : match.status}. Please contact School Administration.`,
      });
    }

    const tokenPayload: StudentTokenPayload = {
      id: match.id,
      regNumber: match.regNumber,
      gradeCode: match.gradeCode,
      stream: match.stream || 'Stream A',
      role: 'Student',
      exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
    };

    const token = signStudentToken(tokenPayload);
    return res.json({
      success: true,
      token,
      session: {
        id: match.id,
        name: match.fullName,
        role: 'Student',
        username: match.studentUsername || match.regNumber,
        email: match.email || match.parentEmail || '',
        assignedSubjectOrGrade: `${match.gradeCode} (${match.stream || 'Stream A'})`,
        linkedStudentIds: [match.id],
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Student login failed' });
  }
});

// 7a-4. Forgot Password & Secure Single-Use Reset Workflow (Students, Teachers, Staff, Admins)
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const rawEmail = String(req.body?.email || '').trim().toLowerCase();
    if (!rawEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    const clientIp = req.ip || String(req.headers['x-forwarded-for'] || 'unknown');
    const ipLimit = rateLimitCheck(`forgot:ip:${clientIp}`, 15, 15 * 60 * 1000);
    const emailLimit = rateLimitCheck(`forgot:email:${rawEmail}`, 5, 15 * 60 * 1000);
    if (!ipLimit.allowed || !emailLimit.allowed) {
      return res.status(429).json({
        error: `Too many password reset requests. Please try again in ${Math.max(ipLimit.retryAfterSec, emailLimit.retryAfterSec)} seconds.`,
      });
    }

    // Generic response guarantees zero account enumeration regardless of whether email matches
    const genericMessage =
      'If an account matching that email exists in our school directory, a secure password reset link has been sent to that email address.';

    const staffList = ensureAuthoritativeStaffList();
    const staffMatch = staffList.find(
      (s: any) =>
        s.status !== 'Inactive' &&
        (String(s.email || '').trim().toLowerCase() === rawEmail ||
          String(s.username || '').trim().toLowerCase() === rawEmail)
    );

    const students = loadServerStudents() || [];
    const studentMatch = !staffMatch
      ? students.find(
          (st: any) =>
            st.status === 'Active' &&
            st.studentAccountActive !== false &&
            (String(st.email || '').trim().toLowerCase() === rawEmail ||
              String(st.parentEmail || '').trim().toLowerCase() === rawEmail)
        )
      : null;

    if (!staffMatch && !studentMatch) {
      return res.json({ success: true, message: genericMessage });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = sha256Hex(rawToken);
    const expiresAt = Date.now() + 30 * 60 * 1000; // 30-minute single-use expiry

    const targetType: 'staff' | 'student' = staffMatch ? 'staff' : 'student';
    const targetId = staffMatch ? staffMatch.id : studentMatch.id;
    const displayName = staffMatch ? staffMatch.name : studentMatch.fullName;

    // Invalidate previous active tokens for same account
    const tokens = loadResetTokens().map((t) =>
      t.accountId === targetId && !t.used ? { ...t, used: true, usedAt: new Date().toISOString() } : t
    );

    tokens.push({
      id: `rst-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
      tokenHash,
      accountType: targetType,
      accountId: targetId,
      email: rawEmail,
      displayName,
      createdAt: new Date().toISOString(),
      expiresAt,
      used: false,
    });
    saveResetTokens(tokens);

    const baseUrl = getPublicAppUrl(req);
    const resetLink = `${baseUrl}/reset-password?token=${rawToken}`;
    const templates = loadEmailTemplates();
    const tpl = templates.password_reset;

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 10px; overflow: hidden; background-color: #ffffff;">
        <div style="background-color: #1e3a8a; padding: 18px 22px; color: #ffffff;">
          <h2 style="margin: 0; font-size: 20px;">Mugina Hope Primary School</h2>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: #fde047; font-style: italic;">&ldquo;We learn for our better future&rdquo;</p>
        </div>
        <div style="padding: 22px; color: #1e293b; font-size: 14px; line-height: 1.6;">
          <p>Hello <strong>${displayName}</strong>,</p>
          <p>${tpl.introParagraph}</p>
          <p>${tpl.instructionsParagraph}</p>
          <div style="margin: 22px 0; text-align: center;">
            <a href="${resetLink}" style="display: inline-block; background-color: #1e3a8a; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; font-size: 14px;">
              Reset My Portal Password
            </a>
          </div>
          <p style="font-size: 12px; color: #64748b;">
            Or open this link in your browser:<br />
            <span style="word-break: break-all; color: #1d4ed8;">${resetLink}</span>
          </p>
          <p style="font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 14px; margin-top: 20px;">
            ${tpl.footerSignature}
          </p>
        </div>
      </div>
    `;

    await sendSchoolEmail({
      to: rawEmail,
      subject: tpl.subject,
      html: emailHtml,
      emailType: 'password_reset',
      relatedRef: targetId,
      sanitizedSummary: `Password reset email dispatched to ${rawEmail} (${targetType} account; token redacted).`,
      allowRetryHtml: false,
    });

    return res.json({ success: true, message: genericMessage });
  } catch (err: any) {
    console.error('Forgot password error:', err);
    return res.status(500).json({ error: 'Unable to process password reset request at this time.' });
  }
});

app.get('/api/auth/verify-reset-token', (req, res) => {
  const rawToken = String(req.query.token || '').trim();
  if (!rawToken || rawToken.length < 16) {
    return res.status(400).json({ valid: false, error: 'Missing or invalid password reset token.' });
  }
  const tokenHash = sha256Hex(rawToken);
  const tokens = loadResetTokens();
  const match = tokens.find((t) => t.tokenHash === tokenHash);
  if (!match) {
    return res.status(404).json({ valid: false, error: 'Invalid or expired password reset link.' });
  }
  if (match.used) {
    return res.status(410).json({ valid: false, error: 'This password reset link has already been used.' });
  }
  if (Date.now() > match.expiresAt) {
    return res.status(410).json({ valid: false, error: 'This password reset link has expired. Please request a new one.' });
  }
  return res.json({
    valid: true,
    accountType: match.accountType,
    expiresAt: match.expiresAt,
  });
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const rawToken = String(req.body?.token || '').trim();
    const newPassword = String(req.body?.newPassword || '').trim();
    const confirmPassword = String(req.body?.confirmPassword || '').trim();

    if (!rawToken) {
      return res.status(400).json({ error: 'Password reset token is required.' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters long.' });
    }
    if (confirmPassword && newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'Password confirmation does not match.' });
    }

    const tokenHash = sha256Hex(rawToken);
    const tokens = loadResetTokens();
    const tokenIdx = tokens.findIndex((t) => t.tokenHash === tokenHash);

    if (tokenIdx < 0) {
      return res.status(400).json({ error: 'Invalid or expired password reset token.' });
    }
    const tokenRec = tokens[tokenIdx];
    if (tokenRec.used) {
      return res.status(410).json({ error: 'This password reset link has already been used.' });
    }
    if (Date.now() > tokenRec.expiresAt) {
      return res.status(410).json({ error: 'This password reset link has expired. Please request a new reset email.' });
    }

    const newHash = hashPassword(newPassword);
    const shaHash = hashSha256Credential(newPassword);
    const nowIso = new Date().toISOString();
    let updatedAccount: any = null;

    if (tokenRec.accountType === 'staff') {
      const staff = ensureAuthoritativeStaffList();
      const sIdx = staff.findIndex((s: any) => s.id === tokenRec.accountId);
      if (sIdx < 0) {
        return res.status(404).json({ error: 'Associated staff account not found.' });
      }
      const { password: _discardPlain, ...rest } = staff[sIdx];
      staff[sIdx] = { ...rest, passwordHash: newHash, updatedAt: nowIso };
      updatedAccount = staff[sIdx];
      saveServerStaff(staff);
    } else {
      const students = loadServerStudents() || [];
      const stIdx = students.findIndex((st: any) => st.id === tokenRec.accountId);
      if (stIdx < 0) {
        return res.status(404).json({ error: 'Associated student account not found.' });
      }
      students[stIdx] = {
        ...students[stIdx],
        studentPassword: '',
        passwordHash: newHash,
        updatedAt: nowIso,
      };
      updatedAccount = students[stIdx];
      saveServerStudents(students);
    }

    // Best-effort sync to Supabase auth vault so password resets also work across browsers/deployments
    if (updatedAccount) {
      await syncCredentialHashToSupabaseVault({
        accountType: tokenRec.accountType,
        account: updatedAccount,
        sha256Hash: shaHash,
      });
    }

    tokens[tokenIdx] = { ...tokenRec, used: true, usedAt: nowIso };
    saveResetTokens(tokens);

    return res.json({
      success: true,
      accountType: tokenRec.accountType,
      message: 'Your password has been updated securely. You can now sign in with your new password.',
    });
  } catch (err: any) {
    console.error('Reset password error:', err);
    return res.status(500).json({ error: err.message || 'Failed to reset password' });
  }
});

// 7b. Scoped Student Portal Data Endpoint (Strict Backend Isolation)
app.get('/api/student/portal-data', (req, res) => {
  const tokenUser = verifyStudentToken(req.headers.authorization);
  if (!tokenUser) {
    return res.status(401).json({ error: 'Valid student authentication token required.' });
  }
  const requestedStudentId = String(req.query.studentId || tokenUser.id);
  if (requestedStudentId !== tokenUser.id) {
    return res.status(403).json({ error: 'Forbidden: Students cannot access another learner’s records.' });
  }

  const students = loadServerStudents() || [];
  const student = students.find((s: any) => s.id === tokenUser.id);
  if (!student) {
    return res.status(404).json({ error: 'Student record not found.' });
  }
  const { studentPassword: _pw, ...safeStudent } = student;

  const sms = loadSmsStore();
  const attendance = (loadServerAttendance() || []).filter((a: any) => a.studentId === tokenUser.id);
  const grade = student.gradeCode;

  const rawHomework = (sms.homework_assignments || []).filter((h: any) => h.gradeCode === grade);
  const safeHomework = rawHomework.map((hw: any) => ({
    ...hw,
    questions: Array.isArray(hw.questions)
      ? hw.questions.map(({ correctAnswer: _ca, acceptedAnswers: _aa, explanation: _ex, ...qRest }: any) => qRest)
      : undefined,
  }));

  return res.json({
    success: true,
    student: safeStudent,
    marks: (sms.exam_marks || []).filter((m: any) => m.studentId === tokenUser.id),
    attendance,
    homework: safeHomework,
    submissions: (sms.homework_submissions || []).filter((sub: any) => sub.studentId === tokenUser.id),
    materials: (sms.learning_materials || []).filter((m: any) => m.gradeCode === grade),
    timetable: (sms.class_timetables || []).filter((t: any) => t.gradeCode === grade),
    examSchedules: (sms.exam_schedules || []).filter((ex: any) => ex.gradeCode === grade),
    achievements: (sms.student_achievements || []).filter((a: any) => a.studentId === tokenUser.id),
    notifications: (sms.student_notifications || []).filter(
      (n: any) => n.studentId === tokenUser.id || n.studentId === 'ALL' || n.studentId === `GRADE:${grade}` || n.gradeCode === grade
    ),
    classAnnouncements: (sms.class_announcements || []).filter((c: any) => c.gradeCode === 'ALL' || c.gradeCode === grade),
  });
});

// 7c. Student Homework & Quiz Submission Endpoint (Auto-grades MCQ & Closed Qs, enforces retakes, tracks timer)
app.post('/api/student/homework-submit', (req, res) => {
  const tokenUser = verifyStudentToken(req.headers.authorization);
  const {
    homeworkId,
    studentId,
    regNumber,
    studentName,
    gradeCode,
    stream,
    subjectName,
    answerText,
    fileUrl,
    fileName,
    questionResponses,
    timeLimitSeconds,
    timeRemainingSeconds,
    timeSpentSeconds,
    timedOut,
  } = req.body || {};

  if (tokenUser && studentId && studentId !== tokenUser.id) {
    return res.status(403).json({ error: 'Forbidden: Cannot submit homework on behalf of another student.' });
  }
  const targetStudentId = tokenUser?.id || studentId;
  const hasStructuredResp = questionResponses && typeof questionResponses === 'object' && Object.keys(questionResponses).length > 0;
  if (!homeworkId || !targetStudentId || (!answerText && !fileUrl && !hasStructuredResp && !timedOut)) {
    return res.status(400).json({ error: 'homeworkId, studentId, and responses or attachment are required.' });
  }

  const store = loadSmsStore();
  const assignments = Array.isArray(store.homework_assignments) ? store.homework_assignments : [];
  const hw = assignments.find((h: any) => h.id === homeworkId);

  if (hw && hw.status === 'Closed') {
    return res.status(400).json({ error: 'This homework/quiz is closed and no longer accepts submissions.' });
  }
  if (hw?.availableUntil && Date.now() > Date.parse(hw.availableUntil)) {
    return res.status(400).json({ error: 'The scheduled submission window for this work has ended.' });
  }

  const list = Array.isArray(store.homework_submissions) ? store.homework_submissions : [];
  const priorAttempts = list.filter((s: any) => s.homeworkId === homeworkId && s.studentId === targetStudentId);

  const hasStructuredQuestions = Boolean(hw && Array.isArray(hw.questions) && hw.questions.length > 0);
  const maxAttempts = hw?.maxAttempts !== undefined ? Number(hw.maxAttempts) : 1;
  if (maxAttempts > 0 && priorAttempts.length >= maxAttempts) {
    // Allow updating an ungraded plain homework draft only if maxAttempts===1 and not structured quiz
    const singleDraft = !hasStructuredQuestions && maxAttempts === 1 && priorAttempts[0]?.status === 'Submitted';
    if (!singleDraft) {
      return res.status(403).json({
        error: `Maximum allowed attempts (${maxAttempts}) reached for this work.`,
      });
    }
  }

  const now = new Date().toISOString();
  let autoGradedResult: { score: number; maxMarks: number; answers: any[] } | null = null;
  if (hasStructuredQuestions) {
    const respMap = questionResponses && typeof questionResponses === 'object' ? questionResponses : {};
    let totalScore = 0;
    let totalMax = 0;
    const answers = hw.questions.map((q: any) => {
      const qMax = Math.max(1, Number(q.marks) || 1);
      totalMax += qMax;
      const rawResp = String(respMap[q.id] || '').trim();
      const normResp = normalizeQuizAnswer(rawResp);
      const acceptedList = [
        q.correctAnswer,
        ...(Array.isArray(q.acceptedAnswers) ? q.acceptedAnswers : []),
      ]
        .map(normalizeQuizAnswer)
        .filter(Boolean);
      const isCorrect = Boolean(normResp) && acceptedList.includes(normResp);
      const earnedMarks = isCorrect ? qMax : 0;
      totalScore += earnedMarks;
      return {
        questionId: q.id,
        type: q.type,
        prompt: q.prompt,
        studentAnswer: rawResp,
        correctAnswer: q.correctAnswer,
        isCorrect,
        earnedMarks,
        maxMarks: qMax,
        explanation: q.explanation,
      };
    });
    autoGradedResult = {
      score: totalScore,
      maxMarks: totalMax > 0 ? totalMax : hw.maxMarks || 20,
      answers,
    };
  }

  const allowSingleDraftUpdate = !hasStructuredQuestions && maxAttempts === 1 && priorAttempts.length === 1 && priorAttempts[0]?.status === 'Submitted';
  const existingIdx = allowSingleDraftUpdate
    ? list.findIndex((s: any) => s.id === priorAttempts[0].id)
    : -1;
  const attemptNumber = existingIdx >= 0 ? list[existingIdx].attemptNumber || 1 : priorAttempts.length + 1;

  const record: any = {
    id: existingIdx >= 0 ? list[existingIdx].id : `hwsub-${Date.now()}-${Math.floor(Math.random() * 999)}`,
    homeworkId,
    studentId: targetStudentId,
    regNumber: tokenUser?.regNumber || regNumber || '',
    studentName: studentName || 'Student',
    gradeCode: tokenUser?.gradeCode || gradeCode || '',
    stream: tokenUser?.stream || stream || 'Stream A',
    subjectName: subjectName || hw?.subjectName || 'Subject',
    answerText: String(answerText || '').trim(),
    fileUrl: fileUrl || undefined,
    fileName: fileName || undefined,
    attemptNumber,
    timeLimitSeconds: typeof timeLimitSeconds === 'number' ? timeLimitSeconds : hw?.timeLimitMinutes ? hw.timeLimitMinutes * 60 : undefined,
    timeRemainingSeconds: typeof timeRemainingSeconds === 'number' ? Math.max(0, timeRemainingSeconds) : undefined,
    timeSpentSeconds: typeof timeSpentSeconds === 'number' ? Math.max(0, timeSpentSeconds) : undefined,
    timedOut: Boolean(timedOut),
    submittedAt: now,
    updatedAt: now,
    ...(autoGradedResult
      ? {
          autoGraded: true,
          status: 'Graded',
          score: autoGradedResult.score,
          maxMarks: autoGradedResult.maxMarks,
          answers: autoGradedResult.answers,
          gradedBy: 'Auto-Graded',
          gradedAt: now,
        }
      : {
          autoGraded: false,
          status: 'Submitted',
          maxMarks: hw?.maxMarks || 20,
        }),
  };

  store.homework_submissions =
    existingIdx >= 0
      ? list.map((s: any, idx: number) => (idx === existingIdx ? record : s))
      : [record, ...list];
  saveSmsStore(store);

  return res.json({ success: true, submission: record });
});

// 7d. Student Password Change Endpoint (Uses salted scrypt hash; zero plaintext retention)
app.post('/api/student/change-password', async (req, res) => {
  try {
    const tokenUser = verifyStudentToken(req.headers.authorization);
    const { studentId, currentPassword, newPassword } = req.body || {};
    const targetId = tokenUser?.id || studentId;
    if (tokenUser && studentId && studentId !== tokenUser.id) {
      return res.status(403).json({ error: 'Forbidden: Students can only change their own password.' });
    }
    if (!targetId || !currentPassword || !newPassword || String(newPassword).trim().length < 6) {
      return res.status(400).json({ error: 'Valid studentId, current password, and new password (min 6 chars) are required.' });
    }

    const students = loadServerStudents() || [];
    const idx = students.findIndex((s: any) => s.id === targetId);
    if (idx >= 0) {
      const storedSecret = students[idx].passwordHash || students[idx].clientPasswordHash || students[idx].studentPassword;
      if (!verifyPassword(String(currentPassword).trim(), storedSecret)) {
        return res.status(401).json({ error: 'Current password does not match your account.' });
      }
      const cleanNew = String(newPassword).trim();
      students[idx] = {
        ...students[idx],
        studentPassword: '',
        passwordHash: hashPassword(cleanNew),
        updatedAt: new Date().toISOString(),
      };
      saveServerStudents(students);
      await syncCredentialHashToSupabaseVault({
        accountType: 'student',
        account: students[idx],
        sha256Hash: hashSha256Credential(cleanNew),
      });
    }

    return res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to update password' });
  }
});

// 7e. Student Notification Read Endpoint
app.post('/api/student/notifications/read', (req, res) => {
  const tokenUser = verifyStudentToken(req.headers.authorization);
  const { notificationId, studentId, gradeCode, markAll } = req.body || {};
  const targetId = tokenUser?.id || studentId;
  if (!targetId) {
    return res.status(400).json({ error: 'studentId is required.' });
  }
  const store = loadSmsStore();
  const list = Array.isArray(store.student_notifications) ? store.student_notifications : [];
  store.student_notifications = list.map((n: any) => {
    const matchesTarget = markAll
      ? n.studentId === targetId || n.studentId === 'ALL' || n.studentId === `GRADE:${gradeCode}` || n.gradeCode === gradeCode
      : n.id === notificationId;
    if (!matchesTarget) return n;
    const readByIds = Array.from(new Set([...(n.readByIds || []), targetId]));
    return { ...n, readByIds, isRead: n.studentId === targetId ? true : n.isRead, updatedAt: new Date().toISOString() };
  });
  saveSmsStore(store);
  return res.json({ success: true });
});

app.get('/api/sms/backup', (req, res) => {
  try {
    const backup = {
      exportedAt: new Date().toISOString(),
      school: 'Mugina Hope Primary & Nursery Academy',
      version: '2.0',
      websiteSettings: loadServerSettings(),
      gallery: loadServerGallery(),
      staff: loadServerStaff(),
      students: loadServerStudents(),
      attendance: loadServerAttendance(),
      teacherAttendance: loadServerTeacherAttendance(),
      discipline: loadServerDiscipline(),
      payments: loadServerPayments(),
      documents: loadServerDocuments(),
      applications: loadServerApplications(),
      chats: loadServerChats(),
      sms: loadSmsStore(),
    };
    res.json({ success: true, backup });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to generate backup' });
  }
});

app.post('/api/sms/restore', (req, res) => {
  try {
    const b = req.body?.backup || req.body;
    if (!b || typeof b !== 'object') {
      return res.status(400).json({ error: 'Invalid backup payload' });
    }
    if (b.websiteSettings) saveServerSettings(b.websiteSettings);
    if (Array.isArray(b.gallery)) saveServerGallery(b.gallery);
    if (Array.isArray(b.staff)) saveServerStaff(b.staff);
    if (Array.isArray(b.students)) saveServerStudents(b.students);
    if (Array.isArray(b.attendance)) saveServerAttendance(b.attendance);
    if (Array.isArray(b.teacherAttendance)) saveServerTeacherAttendance(b.teacherAttendance);
    if (Array.isArray(b.discipline)) saveServerDiscipline(b.discipline);
    if (Array.isArray(b.payments)) saveServerPayments(b.payments);
    if (Array.isArray(b.documents)) saveServerDocuments(b.documents);
    if (Array.isArray(b.applications)) saveServerApplications(b.applications);
    if (Array.isArray(b.chats)) saveServerChats(b.chats);
    if (b.sms && typeof b.sms === 'object') saveSmsStore(b.sms);
    return res.json({ success: true, message: 'Server backup restored successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to restore backup' });
  }
});

app.get('/api/sms/:domain', (req, res) => {
  const { domain } = req.params;
  if (!VALID_SMS_DOMAINS.has(domain)) {
    return res.status(400).json({ error: 'Invalid SMS domain' });
  }
  const store = loadSmsStore();
  let items = store[domain] ?? null;
  if (domain === 'homework_assignments' && Array.isArray(items) && verifyStudentToken(req.headers.authorization)) {
    items = items.map((hw: any) => ({
      ...hw,
      questions: Array.isArray(hw.questions)
        ? hw.questions.map(({ correctAnswer: _ca, acceptedAnswers: _aa, explanation: _ex, ...qRest }: any) => qRest)
        : undefined,
    }));
  }
  return res.json({ success: true, items });
});

app.post('/api/sms/:domain', (req, res) => {
  try {
    const { domain } = req.params;
    if (!VALID_SMS_DOMAINS.has(domain)) {
      return res.status(400).json({ error: 'Invalid SMS domain' });
    }
    const stuToken = verifyStudentToken(req.headers.authorization);
    if (stuToken && STUDENT_READONLY_SMS_DOMAINS.has(domain)) {
      return res.status(403).json({
        error: `Forbidden: Student accounts cannot modify ${domain}.`,
      });
    }
    const store = loadSmsStore();
    const payload = req.body?.items !== undefined ? req.body.items : req.body;
    store[domain] = payload;
    saveSmsStore(store);
    return res.json({ success: true, items: payload });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to save SMS domain data' });
  }
});

// =========================================================================
// 8. ADMISSIONS APPROVAL EMAILS, VERIFICATION CODES & ADMIN EMAIL CONSOLE
// =========================================================================

async function issueAndSendAdmissionVerificationEmail(params: {
  appRecord: any;
  req?: express.Request;
  emailType: 'admission_approved' | 'admission_verification';
  reviewerNotes?: string;
  simulateFailure?: boolean;
}) {
  const { appRecord, req, emailType, reviewerNotes, simulateFailure } = params;
  const rawCode = String(crypto.randomInt(100000, 999999));
  const codeHash = sha256Hex(`${String(appRecord.refCode).trim().toUpperCase()}:${rawCode}`);
  const expiresAt = Date.now() + 48 * 60 * 60 * 1000; // 48 hours

  // Invalidate any prior unused verification codes for this application
  const records = loadVerificationRecords().map((r) =>
    (r.appId === appRecord.id || r.refCode.toUpperCase() === String(appRecord.refCode).toUpperCase()) && !r.used
      ? { ...r, used: true, locked: true }
      : r
  );

  records.push({
    id: `avc-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
    appId: appRecord.id,
    refCode: String(appRecord.refCode).trim().toUpperCase(),
    parentEmail: appRecord.parentEmail || '',
    studentName: appRecord.studentName,
    gradeCode: appRecord.gradeCode,
    codeHash,
    createdAt: new Date().toISOString(),
    expiresAt,
    attempts: 0,
    maxAttempts: 5,
    used: false,
  });
  saveVerificationRecords(records);

  const templates = loadEmailTemplates();
  const tpl = templates.admission_approved;
  const baseUrl = getPublicAppUrl(req);
  const verifyUrl = `${baseUrl}/verify-admission?ref=${encodeURIComponent(appRecord.refCode)}`;

  const subject =
    emailType === 'admission_approved'
      ? tpl.subject || 'Mugina Hope Primary School - Admission Application Approved'
      : `Mugina Hope Primary School - Verification Code (${appRecord.refCode})`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 10px; overflow: hidden; background-color: #ffffff;">
      <div style="background-color: #1e3a8a; padding: 18px 22px; color: #ffffff;">
        <h2 style="margin: 0; font-size: 20px;">Mugina Hope Primary School</h2>
        <p style="margin: 4px 0 0 0; font-size: 12px; color: #fde047; font-style: italic;">&ldquo;We learn for our better future&rdquo;</p>
      </div>
      <div style="padding: 22px; color: #1e293b; font-size: 14px; line-height: 1.6;">
        <p>Dear <strong>${appRecord.parentName || 'Parent / Guardian'}</strong>,</p>
        <p>${tpl.introParagraph}</p>

        <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 4px 0;"><strong>Student Full Name:</strong> ${appRecord.studentName}</p>
          <p style="margin: 4px 0;"><strong>Requested Class:</strong> ${appRecord.gradeCode}</p>
          <p style="margin: 4px 0;"><strong>Admission Reference:</strong> <code style="font-weight: bold; color: #1e3a8a;">${appRecord.refCode}</code></p>
          <p style="margin: 10px 0 4px 0;"><strong>Verification Code:</strong> <span style="display: inline-block; background-color: #fef3c7; border: 1px solid #f59e0b; color: #78350f; font-family: monospace; font-size: 18px; font-weight: bold; padding: 4px 12px; border-radius: 6px; letter-spacing: 2px;">${rawCode}</span></p>
        </div>

        <p>${tpl.instructionsParagraph}</p>
        ${
          reviewerNotes
            ? `<div style="background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 12px; margin: 14px 0; font-size: 13px; color: #1e3a8a;"><strong>Admissions Note:</strong> ${reviewerNotes}</div>`
            : ''
        }
        <div style="margin: 20px 0; text-align: center;">
          <a href="${verifyUrl}" style="display: inline-block; background-color: #15803d; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; font-size: 14px;">
            Verify Admission &amp; Complete Enrollment
          </a>
        </div>
        <p style="font-size: 12px; color: #64748b;">
          Verification Portal: <span style="color: #1d4ed8;">${verifyUrl}</span> (This code expires in 48 hours and can be used once.)
        </p>
        <p style="margin-top: 20px; padding-top: 14px; border-top: 1px solid #e2e8f0; font-size: 13px; color: #334155;">
          Sincerely,<br />
          <strong>${tpl.footerSignature}</strong><br />
          <span style="font-size: 11px; color: #64748b;">Motto: We learn for our better future · Mugina Sector, Kamonyi District</span>
        </p>
      </div>
    </div>
  `;

  return sendSchoolEmail({
    to: appRecord.parentEmail || '',
    subject,
    html,
    emailType,
    relatedRef: appRecord.refCode,
    sanitizedSummary: `Admission verification code sent to ${appRecord.parentEmail || 'N/A'} for ${appRecord.studentName} (Ref: ${appRecord.refCode}). Verification code redacted.`,
    allowRetryHtml: false,
    simulateFailure,
  });
}

// 8a. Admin Admissions Review Endpoint (Approve / Reject / Request More Info)
app.post('/api/admissions/review', async (req, res) => {
  try {
    const staffToken = verifyStaffToken(req.headers.authorization);
    if (!staffToken || !ADMISSIONS_ADMIN_ROLES.has(staffToken.role)) {
      return res.status(403).json({
        error: 'Forbidden: Only authorized School Administrators, Headteachers, DOS, or Registrars may review admission applications.',
      });
    }

    const { appId, action, notes, simulateFailure } = req.body || {};
    if (!appId || !['approve', 'reject', 'more_info'].includes(action)) {
      return res.status(400).json({ error: 'Valid appId and action (approve, reject, or more_info) are required.' });
    }

    const apps = loadServerApplications() || [];
    const appIdx = apps.findIndex((a: any) => a.id === appId || a.refCode === appId);
    if (appIdx < 0) {
      return res.status(404).json({ error: 'Admission application not found.' });
    }

    const targetApp = apps[appIdx];
    const nowIso = new Date().toISOString();
    const reviewer = staffToken.name || 'Admissions Office';
    const templates = loadEmailTemplates();

    if (action === 'approve') {
      const dispatchRes = await issueAndSendAdmissionVerificationEmail({
        appRecord: targetApp,
        req,
        emailType: 'admission_approved',
        reviewerNotes: notes,
        simulateFailure: Boolean(simulateFailure),
      });

      const updatedApp = {
        ...targetApp,
        status: 'Approved',
        approvalDate: nowIso,
        reviewedBy: reviewer,
        feedbackNotes: notes || targetApp.feedbackNotes || 'Application approved pending parent verification.',
        emailDeliveryStatus: dispatchRes.success ? 'Sent' : 'Failed',
        verificationStatus: targetApp.verificationStatus === 'Verified' ? 'Verified' : 'Pending Verification',
        updatedAt: nowIso,
      };
      apps[appIdx] = updatedApp;
      saveServerApplications(apps);

      // Update chat thread status cleanly
      const threads = loadServerChats();
      const tIdx = threads.findIndex((t) => t.refCode.toUpperCase() === String(targetApp.refCode).toUpperCase());
      if (tIdx >= 0) {
        threads[tIdx].status = 'Confirmed & Enrolled';
        threads[tIdx].updatedAt = nowIso;
        threads[tIdx].messages.push({
          id: `rev-${Date.now()}`,
          sender: 'system',
          senderName: 'Admissions Office, Mugina Hope Primary School',
          text: `Admission Approved by ${reviewer}. A unique verification code has been emailed to ${targetApp.parentEmail || 'the registered parent email'} to verify admission.`,
          createdAt: nowIso,
        });
        saveServerChats(threads);
      }

      return res.json({
        success: true,
        application: updatedApp,
        emailDeliveryStatus: dispatchRes.log.status,
        emailLogId: dispatchRes.log.id,
        error: dispatchRes.error,
      });
    }

    if (action === 'reject') {
      const tpl = templates.admission_rejected;
      const reason = String(notes || 'Capacity reached for requested grade level this term.').trim();
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 10px; overflow: hidden; background-color: #ffffff;">
          <div style="background-color: #1e3a8a; padding: 18px 22px; color: #ffffff;">
            <h2 style="margin: 0; font-size: 20px;">Mugina Hope Primary School</h2>
            <p style="margin: 4px 0 0 0; font-size: 12px; color: #fde047; font-style: italic;">&ldquo;We learn for our better future&rdquo;</p>
          </div>
          <div style="padding: 22px; color: #1e293b; font-size: 14px; line-height: 1.6;">
            <p>Dear <strong>${targetApp.parentName || 'Parent / Guardian'}</strong>,</p>
            <p>${tpl.introParagraph}</p>
            <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 14px; margin: 16px 0;">
              <p style="margin: 4px 0;"><strong>Student:</strong> ${targetApp.studentName} (${targetApp.gradeCode})</p>
              <p style="margin: 4px 0;"><strong>Admission Reference:</strong> ${targetApp.refCode}</p>
              <p style="margin: 8px 0 0 0;"><strong>Admissions Decision Note:</strong> ${reason}</p>
            </div>
            <p>${tpl.instructionsParagraph}</p>
            <p style="margin-top: 20px; font-size: 13px;">Sincerely,<br /><strong>${tpl.footerSignature}</strong></p>
          </div>
        </div>
      `;

      const dispatchRes = await sendSchoolEmail({
        to: targetApp.parentEmail || '',
        subject: `${tpl.subject} (${targetApp.refCode})`,
        html,
        emailType: 'admission_rejected',
        relatedRef: targetApp.refCode,
        sanitizedSummary: `Admission rejection notification sent to ${targetApp.parentEmail || 'N/A'} for Ref ${targetApp.refCode}.`,
        allowRetryHtml: true,
        simulateFailure: Boolean(simulateFailure),
      });

      const updatedApp = {
        ...targetApp,
        status: 'Rejected',
        reviewedBy: reviewer,
        rejectionReason: reason,
        feedbackNotes: reason,
        emailDeliveryStatus: dispatchRes.success ? 'Sent' : 'Failed',
        updatedAt: nowIso,
      };
      apps[appIdx] = updatedApp;
      saveServerApplications(apps);

      return res.json({
        success: true,
        application: updatedApp,
        emailDeliveryStatus: dispatchRes.log.status,
        emailLogId: dispatchRes.log.id,
      });
    }

    // action === 'more_info'
    const tpl = templates.admission_more_info;
    const requestedDetails = String(notes || 'Please upload or bring an updated birth certificate and previous report card.').trim();
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 10px; overflow: hidden; background-color: #ffffff;">
        <div style="background-color: #1e3a8a; padding: 18px 22px; color: #ffffff;">
          <h2 style="margin: 0; font-size: 20px;">Mugina Hope Primary School</h2>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: #fde047; font-style: italic;">&ldquo;We learn for our better future&rdquo;</p>
        </div>
        <div style="padding: 22px; color: #1e293b; font-size: 14px; line-height: 1.6;">
          <p>Dear <strong>${targetApp.parentName || 'Parent / Guardian'}</strong>,</p>
          <p>${tpl.introParagraph}</p>
          <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 14px; margin: 16px 0;">
            <p style="margin: 4px 0;"><strong>Student:</strong> ${targetApp.studentName} (${targetApp.gradeCode})</p>
            <p style="margin: 4px 0;"><strong>Admission Reference:</strong> ${targetApp.refCode}</p>
            <p style="margin: 8px 0 0 0;"><strong>Requested Information:</strong> ${requestedDetails}</p>
          </div>
          <p>${tpl.instructionsParagraph}</p>
          <p style="margin-top: 20px; font-size: 13px;">Sincerely,<br /><strong>${tpl.footerSignature}</strong></p>
        </div>
      </div>
    `;

    const dispatchRes = await sendSchoolEmail({
      to: targetApp.parentEmail || '',
      subject: `${tpl.subject} (${targetApp.refCode})`,
      html,
      emailType: 'admission_more_info',
      relatedRef: targetApp.refCode,
      sanitizedSummary: `Additional document request sent to ${targetApp.parentEmail || 'N/A'} for Ref ${targetApp.refCode}.`,
      allowRetryHtml: true,
      simulateFailure: Boolean(simulateFailure),
    });

    const updatedApp = {
      ...targetApp,
      status: 'More Info Requested',
      reviewedBy: reviewer,
      moreInfoNotes: requestedDetails,
      feedbackNotes: requestedDetails,
      emailDeliveryStatus: dispatchRes.success ? 'Sent' : 'Failed',
      updatedAt: nowIso,
    };
    apps[appIdx] = updatedApp;
    saveServerApplications(apps);

    return res.json({
      success: true,
      application: updatedApp,
      emailDeliveryStatus: dispatchRes.log.status,
      emailLogId: dispatchRes.log.id,
    });
  } catch (err: any) {
    console.error('Admission review error:', err);
    return res.status(500).json({ error: err.message || 'Failed to process admission review' });
  }
});

// 8b. Public Admission Verification Endpoint (Validates code, attempt limit, expiry, single-use & creates single student record)
app.post('/api/admissions/verify-code', (req, res) => {
  try {
    const refCode = String(req.body?.refCode || '').trim().toUpperCase();
    const code = String(req.body?.code || '').trim().toUpperCase();

    if (!refCode || !code) {
      return res.status(400).json({ error: 'Both Admission Reference Number and Verification Code are required.' });
    }

    const verifications = loadVerificationRecords();
    const candidates = verifications
      .map((rec, idx) => ({ rec, idx }))
      .filter(({ rec }) => rec.refCode.toUpperCase() === refCode);

    if (candidates.length === 0) {
      return res.status(404).json({ error: 'No pending admission verification found for that Reference Number.' });
    }

    // Use the most recently issued verification record
    const latest = candidates[candidates.length - 1];
    const rec = latest.rec;

    if (rec.used && !rec.locked) {
      return res.status(409).json({
        error: 'This admission application has already been verified. No further verification is needed.',
      });
    }
    if (rec.locked || rec.attempts >= rec.maxAttempts) {
      return res.status(429).json({
        error: 'Maximum verification attempts reached. Please click "Resend Verification Code" to receive a new code.',
      });
    }
    if (Date.now() > rec.expiresAt) {
      return res.status(410).json({
        error: 'This verification code has expired. Please request a new code.',
      });
    }

    const expectedHash = sha256Hex(`${refCode}:${code}`);
    if (expectedHash !== rec.codeHash) {
      const nextAttempts = rec.attempts + 1;
      const isNowLocked = nextAttempts >= rec.maxAttempts;
      verifications[latest.idx] = {
        ...rec,
        attempts: nextAttempts,
        locked: isNowLocked,
      };
      saveVerificationRecords(verifications);
      const remaining = Math.max(0, rec.maxAttempts - nextAttempts);
      return res.status(400).json({
        error: isNowLocked
          ? 'Too many incorrect attempts. This code is now locked — please resend a new verification code.'
          : `Incorrect verification code. ${remaining} attempt(s) remaining.`,
        remainingAttempts: remaining,
      });
    }

    // Valid code -> Mark used & verify application + idempotently create/link single student record
    const nowIso = new Date().toISOString();
    verifications[latest.idx] = { ...rec, used: true, usedAt: nowIso };
    saveVerificationRecords(verifications);

    const apps = loadServerApplications() || [];
    const appIdx = apps.findIndex((a: any) => a.id === rec.appId || String(a.refCode || '').toUpperCase() === refCode);
    if (appIdx < 0) {
      return res.status(404).json({ error: 'Application record not found.' });
    }

    const targetApp = apps[appIdx];
    const students = loadServerStudents() || [];

    // Prevent duplicate student records! Check existing student by assignedStudentId or matching fullName + grade + parentEmail
    let studentRecord = students.find(
      (s: any) =>
        (targetApp.assignedStudentId && s.regNumber === targetApp.assignedStudentId) ||
        (s.fullName?.toLowerCase() === targetApp.studentName?.toLowerCase() &&
          s.gradeCode === targetApp.gradeCode &&
          (s.parentEmail || '').toLowerCase() === (targetApp.parentEmail || '').toLowerCase())
    );

    let assignedRegNumber = targetApp.assignedStudentId || studentRecord?.regNumber;
    if (!studentRecord) {
      assignedRegNumber =
        assignedRegNumber || `MHA-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      const usernameBase = String(targetApp.studentName || 'student')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '.')
        .replace(/^\.+|\.+$/g, '');
      const tempPassword = `Mha@${crypto.randomInt(1000, 9999)}`;

      studentRecord = {
        id: `stu-${Date.now()}`,
        regNumber: assignedRegNumber,
        fullName: targetApp.studentName,
        gender: targetApp.gender || 'Female',
        dob: targetApp.dob || '2019-01-01',
        gradeCode: targetApp.gradeCode,
        stream: 'A',
        parentName: targetApp.parentName,
        parentPhone: targetApp.parentPhone,
        parentEmail: targetApp.parentEmail || '',
        studentUsername: usernameBase || assignedRegNumber.toLowerCase(),
        studentPassword: '',
        passwordHash: hashPassword(tempPassword),
        studentAccountActive: true,
        enrolledBy: targetApp.reviewedBy || 'Admissions Verification',
        enrolledAt: nowIso.split('T')[0],
        status: 'Active',
        feedbackNotes: `Verified admission application ${refCode}`,
      };
      saveServerStudents([studentRecord, ...students]);
    }

    const updatedApp = {
      ...targetApp,
      status: 'Confirmed & Enrolled',
      verificationStatus: 'Verified',
      verifiedAt: nowIso,
      assignedStudentId: assignedRegNumber,
      confirmedAt: targetApp.confirmedAt || new Date().toLocaleString(),
      confirmedBy: targetApp.reviewedBy || 'Parent Verification',
      updatedAt: nowIso,
    };
    apps[appIdx] = updatedApp;
    saveServerApplications(apps);

    return res.json({
      success: true,
      message: 'Admission verified successfully! Your child is now registered for enrollment.',
      application: {
        refCode: updatedApp.refCode,
        studentName: updatedApp.studentName,
        gradeCode: updatedApp.gradeCode,
        assignedStudentId: assignedRegNumber,
        verificationStatus: 'Verified',
        verifiedAt: nowIso,
      },
      nextSteps: [
        `Save your assigned Student Registration ID: ${assignedRegNumber}.`,
        'Use Forgot Password on the Student Portal login page with your registered parent email if you need to set a custom student portal password.',
        'Report to the school Bursar & Registrar office adjacent to Mugina Police Station for uniform collection and term clearance.',
      ],
    });
  } catch (err: any) {
    console.error('Verify admission code error:', err);
    return res.status(500).json({ error: err.message || 'Verification failed' });
  }
});

// 8c. Resend Admission Verification Code (Rate-limited; accepts authorized Staff OR public refCode)
app.post('/api/admissions/resend-code', async (req, res) => {
  try {
    const stuToken = verifyStudentToken(req.headers.authorization);
    if (stuToken) {
      return res.status(403).json({ error: 'Forbidden: Student accounts cannot resend admission codes.' });
    }

    const staffToken = verifyStaffToken(req.headers.authorization);
    const refCode = String(req.body?.refCode || '').trim().toUpperCase();
    const appId = String(req.body?.appId || '').trim();

    if (!refCode && !appId) {
      return res.status(400).json({ error: 'Admission Reference Number is required.' });
    }

    const rateKey = staffToken ? `resend:admin:${refCode || appId}` : `resend:public:${refCode || appId}:${req.ip}`;
    const limit = rateLimitCheck(rateKey, staffToken ? 10 : 5, 15 * 60 * 1000);
    if (!limit.allowed) {
      return res.status(429).json({
        error: `Please wait ${limit.retryAfterSec} seconds before requesting another verification code.`,
      });
    }

    const apps = loadServerApplications() || [];
    const appIdx = apps.findIndex(
      (a: any) =>
        (appId && a.id === appId) ||
        (refCode && String(a.refCode || '').toUpperCase() === refCode)
    );
    if (appIdx < 0) {
      return res.status(404).json({ error: 'Admission application not found for that Reference Number.' });
    }

    const targetApp = apps[appIdx];
    if (targetApp.verificationStatus === 'Verified') {
      return res.status(409).json({ error: 'This application has already been verified.' });
    }
    if (targetApp.status !== 'Approved' && targetApp.status !== 'Confirmed & Enrolled') {
      return res.status(400).json({ error: 'Application must be approved by Admissions before requesting a verification code.' });
    }

    const dispatchRes = await issueAndSendAdmissionVerificationEmail({
      appRecord: targetApp,
      req,
      emailType: 'admission_verification',
    });

    apps[appIdx] = {
      ...targetApp,
      verificationStatus: 'Pending Verification',
      emailDeliveryStatus: dispatchRes.success ? 'Sent' : 'Failed',
      updatedAt: new Date().toISOString(),
    };
    saveServerApplications(apps);

    return res.json({
      success: dispatchRes.success,
      message: dispatchRes.success
        ? 'A fresh verification code has been dispatched to the registered parent email.'
        : dispatchRes.error || 'Failed to resend verification email.',
      emailDeliveryStatus: dispatchRes.log.status,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to resend verification code' });
  }
});

// 8d. Admin Email Delivery Logs, Retry & Template Configuration Endpoints
app.get('/api/admin/email-logs', (req, res) => {
  const staffToken = verifyStaffToken(req.headers.authorization);
  if (!staffToken || !FULL_ADMIN_ROLES.has(staffToken.role)) {
    return res.status(403).json({ error: 'Forbidden: Only authorized Administrators may view email delivery logs.' });
  }
  const logs = loadEmailLogs().map(({ safeRetryHtml: _html, ...log }) => log);
  return res.json({ success: true, logs });
});

app.post('/api/admin/email-logs/:id/retry', async (req, res) => {
  try {
    const staffToken = verifyStaffToken(req.headers.authorization);
    if (!staffToken || !FULL_ADMIN_ROLES.has(staffToken.role)) {
      return res.status(403).json({ error: 'Forbidden: Only authorized Administrators may retry emails.' });
    }

    const { id } = req.params;
    const logs = loadEmailLogs();
    const idx = logs.findIndex((l) => l.id === id);
    if (idx < 0) {
      return res.status(404).json({ error: 'Email log record not found.' });
    }
    const targetLog = logs[idx];

    // Re-issue fresh verification code cleanly if retrying an admission approval/verification email
    if (
      (targetLog.emailType === 'admission_approved' || targetLog.emailType === 'admission_verification') &&
      targetLog.relatedRef
    ) {
      const apps = loadServerApplications() || [];
      const appRec = apps.find(
        (a: any) => String(a.refCode || '').toUpperCase() === String(targetLog.relatedRef).toUpperCase()
      );
      if (appRec) {
        const retryRes = await issueAndSendAdmissionVerificationEmail({
          appRecord: appRec,
          req,
          emailType: targetLog.emailType,
        });
        const updatedApps = apps.map((a: any) =>
          a.id === appRec.id ? { ...a, emailDeliveryStatus: retryRes.success ? 'Sent' : 'Failed' } : a
        );
        saveServerApplications(updatedApps);

        const refreshed = loadEmailLogs();
        const origIdx = refreshed.findIndex((l) => l.id === id);
        if (origIdx >= 0 && retryRes.success) {
          refreshed[origIdx] = {
            ...refreshed[origIdx],
            status: 'Sent',
            errorMessage: undefined,
            retryCount: (refreshed[origIdx].retryCount || 0) + 1,
          };
          saveEmailLogs(refreshed);
        }
        return res.json({ success: retryRes.success, message: 'Retried admission verification email dispatch.' });
      }
    }

    const fromHeader = EMAIL_FROM_ADDRESS.includes('<')
      ? EMAIL_FROM_ADDRESS
      : `"Mugina Hope Primary School" <${EMAIL_FROM_ADDRESS}>`;

    const htmlToSend =
      targetLog.safeRetryHtml ||
      `<div style="font-family: Arial, sans-serif; padding: 18px;"><h3>Mugina Hope Primary School</h3><p>${targetLog.sanitizedSummary}</p><p>Motto: We learn for our better future</p></div>`;

    await transporter.sendMail({
      from: fromHeader,
      to: targetLog.recipientEmail,
      subject: targetLog.subject,
      html: htmlToSend,
    });

    logs[idx] = {
      ...targetLog,
      status: 'Sent',
      errorMessage: undefined,
      retryCount: (targetLog.retryCount || 0) + 1,
      sentAt: new Date().toISOString(),
    };
    saveEmailLogs(logs);

    return res.json({ success: true, log: logs[idx] });
  } catch (err: any) {
    return res.status(500).json({ error: formatSmtpError(err) });
  }
});

app.get('/api/admin/email-status', (req, res) => {
  const staffToken = verifyStaffToken(req.headers.authorization);
  if (!staffToken || !FULL_ADMIN_ROLES.has(staffToken.role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  return res.json({
    success: true,
    configured: Boolean(GMAIL_USER && GMAIL_APP_PASSWORD),
    gmailUser: GMAIL_USER ? `${GMAIL_USER.slice(0, 3)}***@${GMAIL_USER.split('@')[1] || ''}` : '',
    appPasswordLength: GMAIL_APP_PASSWORD.length,
    mode: GMAIL_USER && GMAIL_APP_PASSWORD ? 'gmail-smtp' : 'local-preview-json',
  });
});

app.post('/api/admin/email-test', async (req, res) => {
  try {
    const staffToken = verifyStaffToken(req.headers.authorization);
    if (!staffToken || !FULL_ADMIN_ROLES.has(staffToken.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
      return res.json({
        success: false,
        configured: false,
        error: 'GMAIL_USER or GMAIL_APP_PASSWORD is not set in server environment variables. Preview mode logs emails locally without sending to Gmail.',
      });
    }
    await transporter.verify();
    return res.json({
      success: true,
      configured: true,
      message: `Gmail SMTP connection verified cleanly for ${GMAIL_USER}.`,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      configured: true,
      error: formatSmtpError(err),
    });
  }
});

app.get('/api/admin/email-templates', (req, res) => {
  const staffToken = verifyStaffToken(req.headers.authorization);
  if (!staffToken || !ADMISSIONS_ADMIN_ROLES.has(staffToken.role)) {
    return res.status(403).json({ error: 'Forbidden: Only authorized Administrators may view email templates.' });
  }
  return res.json({ success: true, templates: loadEmailTemplates() });
});

app.post('/api/admin/email-templates', (req, res) => {
  const staffToken = verifyStaffToken(req.headers.authorization);
  if (!staffToken || !FULL_ADMIN_ROLES.has(staffToken.role)) {
    return res.status(403).json({ error: 'Forbidden: Only authorized Administrators may modify email templates.' });
  }
  const { id, subject, introParagraph, instructionsParagraph, footerSignature } = req.body || {};
  const validIds = new Set(['admission_approved', 'admission_rejected', 'admission_more_info', 'password_reset']);
  if (!validIds.has(id)) {
    return res.status(400).json({ error: 'Invalid email template ID.' });
  }
  const templates = loadEmailTemplates();
  const key = id as EmailTemplateConfig['id'];
  templates[key] = {
    ...templates[key],
    subject: String(subject || templates[key].subject).trim(),
    introParagraph: String(introParagraph || templates[key].introParagraph).trim(),
    instructionsParagraph: String(instructionsParagraph || templates[key].instructionsParagraph).trim(),
    footerSignature: String(footerSignature || templates[key].footerSignature).trim(),
    updatedAt: new Date().toISOString(),
  };
  saveEmailTemplates(templates);
  return res.json({ success: true, templates });
});

// Server health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), school: 'Mugina Hope Academy' });
});

// Dynamic / static sitemap.xml endpoint with proper XML Content-Type
app.get(['/sitemap.xml', '/api/sitemap'], (req, res) => {
  const baseUrl = (process.env.APP_URL || 'https://mugina-hope-primary-school-u2su.vercel.app').replace(/\/+$/, '');
  const lastMod = new Date().toISOString().split('T')[0];
  const routes = [
    { path: '/', changefreq: 'daily', priority: '1.0' },
    { path: '/about', changefreq: 'monthly', priority: '0.9' },
    { path: '/staff', changefreq: 'monthly', priority: '0.8' },
    { path: '/admissions', changefreq: 'weekly', priority: '0.9' },
    { path: '/verify-admission', changefreq: 'monthly', priority: '0.7' },
    { path: '/fees', changefreq: 'monthly', priority: '0.9' },
    { path: '/campus-life', changefreq: 'weekly', priority: '0.8' },
    { path: '/contact', changefreq: 'monthly', priority: '0.8' },
  ];

  const urlsXml = routes
    .map(
      (r) => `  <url>
    <loc>${baseUrl}${r.path}</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority}</priority>
  </url>`
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlsXml}
</urlset>
`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.send(xml);
});

// Mount Vite middleware in development or serve static files in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Mugina Hope Academy Server running on http://localhost:${PORT}`);
  });
}

startServer();
