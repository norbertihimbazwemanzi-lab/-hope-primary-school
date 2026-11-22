import { createClient, SupabaseClient } from '@supabase/supabase-js';

let activeSupabaseClient: SupabaseClient | null = null;
let activeClientSignature = '';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export const DEFAULT_SUPABASE_URL = 'https://egwzhnzpsgwkhvhesode.supabase.co';
export const DEFAULT_SUPABASE_KEY = 'sb_publishable_982vUUyz9dc8qOU1eCWhAg_TkWcGJj_';

export const ALL_SUPABASE_TABLES = [
  'website_settings',
  'school_gallery',
  'staff_members',
  'enrolled_students',
  'payment_transactions',
  'admissions_applications',
  'attendance_records',
  'teacher_attendance_records',
  'discipline_records',
  'student_progress_logs',
  'school_announcements',
  'registration_documents',
  'visitor_inquiries',
  'campus_tour_bookings',
  'applicant_chats',
] as const;

export type SupabaseTableName = (typeof ALL_SUPABASE_TABLES)[number];

/**
 * Helper: detect PostgreSQL / PostgREST missing-table error when schema SQL has not been run yet
 */
export const isMissingTableError = (error: any): boolean => {
  if (!error) return false;
  const code = String(error.code || '');
  const msg = String(error.message || '');
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    /could not find the table|does not exist|relation .* does not exist/i.test(msg)
  );
};

/**
 * Helper: detect missing-column error when an existing table hasn't had ALTER TABLE migrations run yet
 */
const isMissingColumnError = (error: any): boolean => {
  if (!error) return false;
  const code = String(error.code || '');
  const msg = String(error.message || '');
  return code === '42703' || code === 'PGRST204' || /could not find the .* column|column .* does not exist/i.test(msg);
};

const extractMissingColumnName = (error: any): string | null => {
  const msg = String(error?.message || error?.details || '');
  const pgrst = msg.match(/could not find the ['"]([^'"]+)['"] column/i);
  if (pgrst?.[1]) return pgrst[1];
  const pg = msg.match(/column\s+["']?([a-zA-Z0-9_]+)["']?\s+(?:of relation\s+["']?[^"']+["']?\s+)?does not exist/i);
  if (pg?.[1]) return pg[1];
  return null;
};

const stripColumnFromPayload = <T extends Record<string, any>>(
  payload: T | T[],
  col: string
): T | T[] => {
  if (Array.isArray(payload)) {
    return payload.map((row) => {
      const copy = { ...row };
      delete copy[col];
      return copy;
    });
  }
  const copy = { ...payload };
  delete copy[col];
  return copy;
};

const missingColumnsCache = new Map<string, Set<string>>();

const upsertWithColumnPruning = async (
  client: SupabaseClient,
  table: string,
  payload: Record<string, any> | Record<string, any>[],
  onConflict = 'id'
): Promise<{ error: any | null }> => {
  let current: any = payload;
  const knownMissing = missingColumnsCache.get(table);
  if (knownMissing && knownMissing.size > 0) {
    for (const col of knownMissing) {
      current = stripColumnFromPayload(current, col);
    }
  }
  for (let attempt = 0; attempt < 15; attempt++) {
    const { error } = await client.from(table).upsert(current, { onConflict });
    if (!error) return { error: null };
    if (!isMissingColumnError(error)) return { error };
    const missingCol = extractMissingColumnName(error);
    if (!missingCol) return { error };
    if (!missingColumnsCache.has(table)) {
      missingColumnsCache.set(table, new Set());
    }
    missingColumnsCache.get(table)!.add(missingCol);
    current = stripColumnFromPayload(current, missingCol);
  }
  return client.from(table).upsert(current, { onConflict });
};

/**
 * Safely read cached website settings from localStorage without importing adminStore (avoids circular deps)
 */
const readCachedSettingsSafe = (): { supabaseUrl?: string; supabaseAnonKey?: string } => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return {};
    const raw = window.localStorage.getItem('mugina_website_settings_v3');
    if (raw) return JSON.parse(raw) || {};
  } catch {
    // ignore storage access issues
  }
  return {};
};

/**
 * Retrieve current Supabase configuration from environment variables, stored settings, or defaults
 */
export const getSupabaseConfig = (): SupabaseConfig => {
  const env = (import.meta as any)?.env || {};
  const envUrl = String(env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const envKey = String(
    env.VITE_SUPABASE_ANON_KEY ||
      env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      ''
  ).trim();

  const cached = readCachedSettingsSafe();
  const storedUrl = String(cached.supabaseUrl || '').trim();
  const storedKey = String(cached.supabaseAnonKey || '').trim();

  return {
    url: storedUrl || envUrl || DEFAULT_SUPABASE_URL,
    anonKey: storedKey || envKey || DEFAULT_SUPABASE_KEY,
  };
};

/**
 * Get or initialize Supabase client
 */
export const getSupabaseClient = (): SupabaseClient | null => {
  const config = getSupabaseConfig();
  if (!config.url || !config.anonKey) {
    activeSupabaseClient = null;
    activeClientSignature = '';
    return null;
  }

  const signature = `${config.url}|${config.anonKey}`;
  if (!activeSupabaseClient || activeClientSignature !== signature) {
    try {
      activeSupabaseClient = createClient(config.url, config.anonKey, {
        auth: { persistSession: false },
      });
      activeClientSignature = signature;
    } catch (err) {
      console.warn('[Supabase] Client init error:', err);
      activeSupabaseClient = null;
      activeClientSignature = '';
    }
  }
  return activeSupabaseClient;
};

const createCustomOrActiveClient = (targetUrl?: string, targetKey?: string): SupabaseClient | null => {
  if (targetUrl && targetKey && targetUrl.trim() && targetKey.trim()) {
    try {
      return createClient(targetUrl.trim(), targetKey.trim(), {
        auth: { persistSession: false },
      });
    } catch (err) {
      console.warn('[Supabase] Custom client creation failed:', err);
    }
  }
  return getSupabaseClient();
};

/**
 * Test Supabase connection and inspect readiness across all 15 school tables
 */
export const testSupabaseConnection = async (
  testUrl?: string,
  testKey?: string
): Promise<{
  success: boolean;
  message: string;
  timestamp?: string;
  readyTables?: string[];
  missingTables?: string[];
}> => {
  const url = (testUrl || getSupabaseConfig().url || '').trim();
  const key = (testKey || getSupabaseConfig().anonKey || '').trim();

  if (!url || !key) {
    return {
      success: false,
      message: 'Supabase Project URL and Anon/Public Key are required to establish connection.',
    };
  }

  if (!url.startsWith('https://')) {
    return {
      success: false,
      message: 'Supabase URL must start with https:// (e.g., https://your-project.supabase.co)',
    };
  }

  try {
    const client = createClient(url, key, { auth: { persistSession: false } });

    const probeResults = await Promise.all(
      ALL_SUPABASE_TABLES.map(async (table) => {
        const { error } = await client.from(table).select('*', { count: 'exact', head: true });
        return { table, error };
      })
    );

    const firstFatal = probeResults.find(
      (r) =>
        r.error &&
        !isMissingTableError(r.error) &&
        r.error.code !== 'PGRST116'
    );

    if (firstFatal?.error) {
      const msg = firstFatal.error.message || '';
      if (msg.includes('FetchError') || msg.includes('Failed to fetch')) {
        return {
          success: false,
          message: `Network connection failed: ${msg}. Please check your Supabase Project URL.`,
        };
      }
      if (msg.includes('JWT') || msg.includes('API key') || msg.includes('Invalid API key')) {
        return {
          success: false,
          message: `Authentication error: ${msg}. Please verify your Supabase publishable/anon key.`,
        };
      }
      return {
        success: false,
        message: `Supabase error on ${firstFatal.table}: ${msg}`,
      };
    }

    const readyTables = probeResults.filter((r) => !r.error).map((r) => r.table);
    const missingTables = probeResults.filter((r) => isMissingTableError(r.error)).map((r) => r.table);

    if (missingTables.length === 0) {
      return {
        success: true,
        message: `Connected to Supabase! All ${readyTables.length}/${ALL_SUPABASE_TABLES.length} school database tables are active & real-time ready.`,
        timestamp: new Date().toISOString(),
        readyTables,
        missingTables,
      };
    }

    return {
      success: true,
      message: `Connected to Supabase (${readyTables.length}/${ALL_SUPABASE_TABLES.length} tables active). Pending SQL tables: ${missingTables.join(', ')}. Click "Copy Supabase SQL Setup Script" and run it in Supabase SQL Editor to activate all 15 modules.`,
      timestamp: new Date().toISOString(),
      readyTables,
      missingTables,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Failed to connect to Supabase: ${err.message || 'Unknown network error'}`,
    };
  }
};

// ============================================================================
// ROW MAPPERS (Snake_case PostgreSQL <-> CamelCase TypeScript Models)
// ============================================================================

const mapStaffToRow = (s: any, includeExtended = true) => {
  const base: Record<string, any> = {
    id: s.id,
    name: s.name,
    role: s.role,
    email: s.email || '',
    phone: s.phone || '',
    username: s.username,
    enrolled_at: s.enrolledAt || '',
    assigned_subject_or_grade: s.assignedSubjectOrGrade || '',
    status: s.status || 'Active',
    updated_at: s.updatedAt || new Date().toISOString(),
  };
  const cleanPw = String(s.password || '').trim();
  if (cleanPw && cleanPw !== '••••••') {
    base.password = cleanPw;
  }
  if (includeExtended) {
    if (s.photoUrl) base.photo_url = s.photoUrl;
    if (s.bio) base.bio = s.bio;
  }
  return base;
};

const mapRowToStaff = (row: any) => ({
  id: row.id,
  name: row.name,
  role: row.role,
  email: row.email || '',
  phone: row.phone || '',
  username: row.username,
  password: row.password || '',
  assignedSubjectOrGrade: row.assigned_subject_or_grade || row.assignedSubjectOrGrade || '',
  photoUrl: row.photo_url || row.photoUrl || '',
  bio: row.bio || '',
  enrolledAt: row.enrolled_at || row.enrolledAt || (row.updated_at ? String(row.updated_at).split('T')[0] : ''),
  status: row.status || 'Active',
  updatedAt: row.updated_at || undefined,
});

const mapStudentToRow = (st: any, includeExtended = true) => {
  const base: Record<string, any> = {
    id: st.id,
    full_name: st.fullName,
    reg_number: st.regNumber,
    gender: st.gender || 'Female',
    dob: st.dob || '',
    grade_code: st.gradeCode,
    status: st.status || 'Active',
    parent_name: st.parentName || '',
    parent_phone: st.parentPhone || '',
    parent_email: st.parentEmail || '',
    enrolled_by: st.enrolledBy || '',
    enrolled_at: st.enrolledAt || '',
    feedback_notes: st.feedbackNotes || '',
    updated_at: st.updatedAt || new Date().toISOString(),
  };
  const cleanStudentUser = String(st.studentUsername || '').trim();
  if (cleanStudentUser) {
    base.student_username = cleanStudentUser;
  }
  const cleanStudentPw = String(st.studentPassword || '').trim();
  if (cleanStudentPw && cleanStudentPw !== '••••••') {
    base.student_password = cleanStudentPw;
  }
  if (includeExtended) {
    base.photo_url = st.photoUrl || null;
    base.stream = st.stream || 'Stream A';
    base.address = st.address || '';
    base.admission_date = st.admissionDate || st.enrolledAt || '';
    base.previous_school = st.previousSchool || '';
    base.academic_history = Array.isArray(st.academicHistory) ? st.academicHistory : [];
    base.student_account_active = st.studentAccountActive !== false;
  }
  return base;
};

const mapRowToStudent = (row: any) => ({
  id: row.id,
  regNumber: row.reg_number || row.regNumber,
  fullName: row.full_name || row.fullName,
  gender: row.gender || 'Female',
  dob: row.dob || '',
  gradeCode: row.grade_code || row.gradeCode,
  stream: row.stream || 'Stream A',
  photoUrl: row.photo_url || row.photoUrl || undefined,
  address: row.address || undefined,
  admissionDate: row.admission_date || row.admissionDate || row.enrolled_at || undefined,
  previousSchool: row.previous_school || row.previousSchool || undefined,
  academicHistory: Array.isArray(row.academic_history) ? row.academic_history : undefined,
  parentName: row.parent_name || row.parentName || '',
  parentPhone: row.parent_phone || row.parentPhone || '',
  parentEmail: row.parent_email || row.parentEmail || '',
  studentUsername: row.student_username || row.studentUsername || '',
  studentPassword: row.student_password || row.studentPassword || '',
  studentAccountActive:
    row.student_account_active === false || row.studentAccountActive === false
      ? false
      : row.student_account_active === true || row.studentAccountActive === true
      ? true
      : undefined,
  enrolledBy: row.enrolled_by || row.enrolledBy || 'DOS',
  enrolledAt: row.enrolled_at || row.enrolledAt || (row.updated_at ? String(row.updated_at).split('T')[0] : ''),
  status: row.status || 'Active',
  feedbackNotes: row.feedback_notes || row.feedbackNotes || undefined,
  updatedAt: row.updated_at || undefined,
});

const mapPaymentToRow = (tx: any) => ({
  id: tx.id,
  receipt_number: tx.receiptNumber,
  student_id: tx.studentId,
  student_name: tx.studentName,
  reg_number: tx.regNumber,
  grade_code: tx.gradeCode,
  payment_type: tx.paymentType,
  amount: Number(tx.amount) || 0,
  payment_method: tx.paymentMethod,
  bank_slip_ref: tx.bankSlipRef || null,
  recorded_by: tx.recordedBy || '',
  recorded_at: tx.recordedAt || new Date().toISOString(),
  term: tx.term || 'Term 1',
  academic_year: tx.academicYear || '2026',
  status: tx.status || 'Completed',
  refund_reason: tx.refundReason || null,
  refund_requested_at: tx.refundRequestedAt || null,
  refund_requested_by: tx.refundRequestedBy || null,
  refund_reviewed_at: tx.refundReviewedAt || null,
  refund_reviewed_by: tx.refundReviewedBy || null,
  refund_review_note: tx.refundReviewNote || null,
  updated_at: new Date().toISOString(),
});

const mapRowToPayment = (row: any) => ({
  id: row.id,
  receiptNumber: row.receipt_number,
  studentId: row.student_id,
  studentName: row.student_name,
  regNumber: row.reg_number,
  gradeCode: row.grade_code,
  paymentType: row.payment_type,
  amount: Number(row.amount) || 0,
  paymentMethod: row.payment_method,
  bankSlipRef: row.bank_slip_ref || undefined,
  recordedBy: row.recorded_by || '',
  recordedAt: row.recorded_at,
  term: row.term,
  academicYear: row.academic_year,
  status: row.status || 'Completed',
  refundReason: row.refund_reason || undefined,
  refundRequestedAt: row.refund_requested_at || undefined,
  refundRequestedBy: row.refund_requested_by || undefined,
  refundReviewedAt: row.refund_reviewed_at || undefined,
  refundReviewedBy: row.refund_reviewed_by || undefined,
  refundReviewNote: row.refund_review_note || undefined,
  updatedAt: row.updated_at || undefined,
});

const mapApplicationToRow = (app: any, includeExtended = true) => {
  const base: Record<string, any> = {
    id: app.id,
    ref_code: app.refCode,
    student_name: app.studentName,
    gender: app.gender || 'Female',
    dob: app.dob || '',
    grade_code: app.gradeCode,
    parent_name: app.parentName,
    parent_phone: app.parentPhone,
    parent_email: app.parentEmail || '',
    sector: app.sector || '',
    wants_lunch: !!app.wantsLunch,
    wants_transport: !!app.wantsTransport,
    status: app.status || 'Pending Confirmation',
    feedback_notes: app.feedbackNotes || null,
    assigned_student_id: app.assignedStudentId || null,
    created_at: app.createdAt || new Date().toLocaleString(),
    confirmed_at: app.confirmedAt || null,
    confirmed_by: app.confirmedBy || null,
    updated_at: app.updatedAt || new Date().toISOString(),
  };

  if (includeExtended) {
    base.approval_date = app.approvalDate || null;
    base.email_delivery_status = app.emailDeliveryStatus || null;
    base.verification_status = app.verificationStatus || 'Unverified';
    base.verified_at = app.verifiedAt || null;
    base.reviewed_by = app.reviewedBy || null;
    base.rejection_reason = app.rejectionReason || null;
    base.more_info_notes = app.moreInfoNotes || null;
  }

  return base;
};

const mapRowToApplication = (row: any) => ({
  id: row.id,
  refCode: row.ref_code,
  studentName: row.student_name,
  gender: row.gender || 'Female',
  dob: row.dob || '',
  gradeCode: row.grade_code,
  parentName: row.parent_name,
  parentPhone: row.parent_phone,
  parentEmail: row.parent_email || '',
  sector: row.sector || '',
  wantsLunch: !!row.wants_lunch,
  wantsTransport: !!row.wants_transport,
  status: row.status || 'Pending Confirmation',
  feedbackNotes: row.feedback_notes || undefined,
  assignedStudentId: row.assigned_student_id || undefined,
  createdAt: row.created_at || '',
  confirmedAt: row.confirmed_at || undefined,
  confirmedBy: row.confirmed_by || undefined,
  approvalDate: row.approval_date || undefined,
  emailDeliveryStatus: row.email_delivery_status || undefined,
  verificationStatus: row.verification_status || undefined,
  verifiedAt: row.verified_at || undefined,
  reviewedBy: row.reviewed_by || undefined,
  rejectionReason: row.rejection_reason || undefined,
  moreInfoNotes: row.more_info_notes || undefined,
  updatedAt: row.updated_at || undefined,
});

const mapAttendanceToRow = (rec: any) => ({
  id: rec.id || `${rec.date}_${rec.studentId}`,
  date: rec.date,
  grade_code: rec.gradeCode,
  student_id: rec.studentId,
  student_name: rec.studentName,
  parent_email: rec.parentEmail || '',
  parent_phone: rec.parentPhone || '',
  status: rec.status || 'Present',
  marked_by: rec.markedBy || '',
  notes: rec.notes || '',
  email_notified: !!rec.emailNotified,
  updated_at: new Date().toISOString(),
});

const mapRowToAttendance = (row: any) => ({
  id: row.id,
  date: row.date,
  gradeCode: row.grade_code,
  studentId: row.student_id,
  studentName: row.student_name,
  parentEmail: row.parent_email || '',
  parentPhone: row.parent_phone || '',
  status: row.status || 'Present',
  markedBy: row.marked_by || '',
  notes: row.notes || '',
  emailNotified: !!row.email_notified,
  updatedAt: row.updated_at || undefined,
});

const mapTeacherAttToRow = (rec: any) => ({
  id: rec.id,
  date: rec.date,
  staff_id: rec.staffId,
  teacher_name: rec.teacherName,
  assigned_subject_or_grade: rec.assignedSubjectOrGrade || '',
  status: rec.status || 'Present',
  arrival_check_in_time: rec.arrivalCheckInTime || '',
  marked_by: rec.markedBy || '',
  topics_covered: rec.topicsCovered || '',
  duty_signature: rec.dutySignature || '',
  notes: rec.notes || '',
  updated_at: new Date().toISOString(),
});

const mapRowToTeacherAtt = (row: any) => ({
  id: row.id,
  date: row.date,
  staffId: row.staff_id,
  teacherName: row.teacher_name,
  assignedSubjectOrGrade: row.assigned_subject_or_grade || '',
  status: row.status || 'Present',
  arrivalCheckInTime: row.arrival_check_in_time || undefined,
  markedBy: row.marked_by || '',
  topicsCovered: row.topics_covered || undefined,
  dutySignature: row.duty_signature || undefined,
  notes: row.notes || undefined,
  updatedAt: row.updated_at || undefined,
});

const mapDisciplineToRow = (rec: any) => ({
  id: rec.id,
  case_number: rec.caseNumber,
  date: rec.date,
  student_id: rec.studentId,
  student_name: rec.studentName,
  reg_number: rec.regNumber || '',
  grade_code: rec.gradeCode,
  incident_type: rec.incidentType,
  severity: rec.severity,
  incident_description: rec.incidentDescription || '',
  action_taken: rec.actionTaken,
  parent_notified: !!rec.parentNotified,
  parent_contact: rec.parentContact || '',
  status: rec.status || 'Open',
  recorded_by: rec.recordedBy || '',
  resolution_notes: rec.resolutionNotes || null,
  follow_up_date: rec.followUpDate || null,
  updated_at: new Date().toISOString(),
});

const mapRowToDiscipline = (row: any) => ({
  id: row.id,
  caseNumber: row.case_number,
  date: row.date,
  studentId: row.student_id,
  studentName: row.student_name,
  regNumber: row.reg_number || '',
  gradeCode: row.grade_code,
  incidentType: row.incident_type,
  severity: row.severity,
  incidentDescription: row.incident_description || '',
  actionTaken: row.action_taken,
  parentNotified: !!row.parent_notified,
  parentContact: row.parent_contact || '',
  status: row.status || 'Open',
  recordedBy: row.recorded_by || '',
  resolutionNotes: row.resolution_notes || undefined,
  followUpDate: row.follow_up_date || undefined,
  updatedAt: row.updated_at || undefined,
});

const mapProgressLogToRow = (log: any) => ({
  id: log.id,
  student_id: log.studentId,
  student_name: log.studentName,
  reg_number: log.regNumber || '',
  grade_code: log.gradeCode,
  stream: log.stream || 'Stream A',
  date: log.date,
  teacher_id: log.teacherId || '',
  teacher_name: log.teacherName || '',
  subject: log.subject,
  academic_performance: log.academicPerformance,
  academic_score: log.academicScore ?? null,
  academic_notes: log.academicNotes || '',
  behavior_rating: log.behaviorRating,
  behavioral_notes: log.behavioralNotes || '',
  action_or_recommendation: log.actionOrRecommendation || '',
  parent_notified: !!log.parentNotified,
  created_at: log.createdAt || new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

const mapRowToProgressLog = (row: any) => ({
  id: row.id,
  studentId: row.student_id,
  studentName: row.student_name,
  regNumber: row.reg_number || '',
  gradeCode: row.grade_code,
  stream: row.stream || 'Stream A',
  date: row.date,
  teacherId: row.teacher_id || '',
  teacherName: row.teacher_name || '',
  subject: row.subject,
  academicPerformance: row.academic_performance,
  academicScore: row.academic_score !== null && row.academic_score !== undefined ? Number(row.academic_score) : undefined,
  academicNotes: row.academic_notes || '',
  behaviorRating: row.behavior_rating,
  behavioralNotes: row.behavioral_notes || '',
  actionOrRecommendation: row.action_or_recommendation || '',
  parentNotified: !!row.parent_notified,
  createdAt: row.created_at || row.updated_at || new Date().toISOString(),
  updatedAt: row.updated_at,
  source: 'firebase-firestore' as const,
});

const mapAnnouncementToRow = (ann: any) => ({
  id: ann.id,
  title: ann.title,
  content: ann.content,
  badge: ann.badge || 'Announcement',
  is_active: ann.isActive !== false,
  published_at: ann.publishedAt || new Date().toISOString().split('T')[0],
  updated_at: new Date().toISOString(),
});

const mapRowToAnnouncement = (row: any) => ({
  id: row.id,
  title: row.title,
  content: row.content,
  badge: row.badge || 'Announcement',
  isActive: row.is_active !== false,
  publishedAt: row.published_at || '',
  updatedAt: row.updated_at || undefined,
});

const mapDocumentToRow = (doc: any) => ({
  id: doc.id,
  title: doc.title,
  description: doc.description || '',
  is_required: doc.isRequired !== false,
  applicable_grades: doc.applicableGrades || '',
  format_hint: doc.formatHint || '',
  file_url: doc.fileUrl || null,
  file_name: doc.fileName || null,
  file_size: doc.fileSize || null,
  file_type: doc.fileType || null,
  uploaded_at: doc.uploadedAt || null,
  sort_order: Number(doc.order) || 1,
  updated_at: new Date().toISOString(),
});

const mapRowToDocument = (row: any) => ({
  id: row.id,
  title: row.title,
  description: row.description || '',
  isRequired: row.is_required !== false,
  applicableGrades: row.applicable_grades || '',
  formatHint: row.format_hint || undefined,
  fileUrl: row.file_url || undefined,
  fileName: row.file_name || undefined,
  fileSize: row.file_size || undefined,
  fileType: row.file_type || undefined,
  uploadedAt: row.uploaded_at || undefined,
  order: Number(row.sort_order ?? row.order ?? 1),
  updatedAt: row.updated_at || undefined,
});

const mapInquiryToRow = (inq: any) => ({
  id: inq.id,
  name: inq.name,
  phone: inq.phone,
  email: inq.email || null,
  subject: inq.subject,
  message: inq.message,
  created_at: inq.createdAt || new Date().toLocaleString(),
  status: inq.status || 'New',
  email_sent_status: inq.emailSentStatus || null,
  updated_at: new Date().toISOString(),
});

const mapRowToInquiry = (row: any) => ({
  id: row.id,
  name: row.name,
  phone: row.phone,
  email: row.email || undefined,
  subject: row.subject,
  message: row.message,
  createdAt: row.created_at || '',
  status: row.status || 'New',
  emailSentStatus: row.email_sent_status || undefined,
  updatedAt: row.updated_at || undefined,
});

const mapTourToRow = (tour: any) => ({
  id: tour.id,
  parent_name: tour.parentName,
  phone: tour.phone,
  date: tour.date,
  time_slot: tour.timeSlot,
  grade_interest: tour.gradeInterest || '',
  guests_count: tour.guestsCount || '1',
  status: tour.status || 'Confirmed',
  created_at: tour.createdAt || new Date().toLocaleString(),
  updated_at: new Date().toISOString(),
});

const mapRowToTour = (row: any) => ({
  id: row.id,
  parentName: row.parent_name,
  phone: row.phone,
  date: row.date,
  timeSlot: row.time_slot,
  gradeInterest: row.grade_interest || '',
  guestsCount: row.guests_count || '1',
  status: row.status || 'Confirmed',
  createdAt: row.created_at || '',
  updatedAt: row.updated_at || undefined,
});

const mapChatToRow = (thread: any) => ({
  ref_code: String(thread.refCode || '').trim().toUpperCase(),
  student_name: thread.studentName || '',
  parent_name: thread.parentName || '',
  parent_email: thread.parentEmail || null,
  parent_phone: thread.parentPhone || null,
  grade_code: thread.gradeCode || '',
  status: thread.status || 'Pending Confirmation',
  messages: Array.isArray(thread.messages) ? thread.messages : [],
  updated_at: thread.updatedAt || new Date().toISOString(),
});

const mapRowToChat = (row: any) => ({
  refCode: row.ref_code,
  studentName: row.student_name || '',
  parentName: row.parent_name || '',
  parentEmail: row.parent_email || undefined,
  parentPhone: row.parent_phone || undefined,
  gradeCode: row.grade_code || '',
  status: row.status || 'Pending Confirmation',
  messages: Array.isArray(row.messages) ? row.messages : [],
  updatedAt: row.updated_at || new Date().toISOString(),
});

// ============================================================================
// GENERIC REALTIME HELPER
// ============================================================================

const createRealtimeTableSubscription = (
  tableName: SupabaseTableName,
  fetcher: () => Promise<any[] | null>,
  callback: (items: any[]) => void
): (() => void) => {
  const client = getSupabaseClient();
  if (!client) return () => {};
  try {
    const channel = client
      .channel(`public:${tableName}:${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: tableName }, async () => {
        const fresh = await fetcher();
        if (fresh !== null) {
          callback(fresh);
        }
      })
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  } catch (err) {
    console.warn(`[Supabase Store] Could not register channel for ${tableName}:`, err);
    return () => {};
  }
};

// ============================================================================
// 1. WEBSITE SETTINGS
// ============================================================================

export const saveWebsiteSettingsToSupabase = async (
  settings: any,
  customClient?: SupabaseClient | null
): Promise<boolean> => {
  const client = customClient || getSupabaseClient();
  if (!client || !settings) return false;
  try {
    const payloadData = {
      ...settings,
      updatedAt: settings.updatedAt || new Date().toISOString(),
    };
    const { error } = await client.from('website_settings').upsert(
      {
        id: 'general',
        data: payloadData,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
    if (!error) {
      return true;
    }
    if (!isMissingTableError(error)) {
      console.warn('[Supabase Store] Website settings write notice:', error.message);
    }
  } catch (err) {
    console.warn('[Supabase Store] Website settings write notice:', err);
  }
  return false;
};

export const fetchWebsiteSettingsFromSupabase = async (): Promise<any | null> => {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from('website_settings')
      .select('data, updated_at')
      .eq('id', 'general')
      .maybeSingle();

    if (!error && data && data.data) {
      return {
        ...data.data,
        updatedAt: data.data.updatedAt || data.updated_at,
      };
    }
  } catch (err) {
    console.warn('[Supabase Store] Fetch website settings notice:', err);
  }
  return null;
};

export const subscribeToSupabaseWebsiteSettings = (callback: (settings: any) => void): (() => void) => {
  const client = getSupabaseClient();
  if (!client) return () => {};
  try {
    const channel = client
      .channel('public:website_settings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'website_settings' }, (payload) => {
        if (payload.new && (payload.new as any).data) {
          const row = payload.new as any;
          callback({ ...row.data, updatedAt: row.data.updatedAt || row.updated_at });
        }
      })
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  } catch (err) {
    console.warn('[Supabase Store] Could not register Supabase settings channel:', err);
    return () => {};
  }
};

// ============================================================================
// 1B. PORTAL AUTH VAULT (Zero-Schema-Migration Salted Credential Hashes)
// Stores cryptographic salted password hashes & derived usernames in
// `website_settings` (`id = 'portal_auth_vault_v1'`) so newly added/edited
// Staff & Student accounts authenticate across browsers and static hosts.
// ============================================================================

export interface AuthVaultStaffEntry {
  id: string;
  username: string;
  email?: string;
  role: string;
  status?: 'Active' | 'Inactive';
  passwordHash?: string;
  updatedAt: string;
}

export interface AuthVaultStudentEntry {
  id: string;
  regNumber: string;
  studentUsername: string;
  studentAccountActive?: boolean;
  passwordHash?: string;
  hasPassword?: boolean;
  updatedAt: string;
}

export interface PortalAuthVaultData {
  staff: Record<string, AuthVaultStaffEntry>;
  students: Record<string, AuthVaultStudentEntry>;
  updatedAt: string;
}

export const AUTH_VAULT_ROW_ID = 'portal_auth_vault_v1';

export const fetchAuthVaultFromSupabase = async (
  targetUrl?: string,
  targetKey?: string
): Promise<PortalAuthVaultData | null> => {
  const client = createCustomOrActiveClient(targetUrl, targetKey);
  if (!client) return null;
  try {
    const { data, error } = await client
      .from('website_settings')
      .select('data, updated_at')
      .eq('id', AUTH_VAULT_ROW_ID)
      .maybeSingle();

    if (!error && data && data.data && typeof data.data === 'object') {
      const raw = data.data as any;
      return {
        staff: raw.staff && typeof raw.staff === 'object' ? raw.staff : {},
        students: raw.students && typeof raw.students === 'object' ? raw.students : {},
        updatedAt: raw.updatedAt || data.updated_at || new Date().toISOString(),
      };
    }
  } catch (err) {
    console.warn('[Supabase Auth Vault] Fetch notice:', err);
  }
  return null;
};

export const upsertAuthVaultToSupabase = async (params: {
  staffEntries?: AuthVaultStaffEntry[];
  studentEntries?: AuthVaultStudentEntry[];
  deleteStaffIds?: string[];
  deleteStudentIds?: string[];
  targetUrl?: string;
  targetKey?: string;
}): Promise<boolean> => {
  const client = createCustomOrActiveClient(params.targetUrl, params.targetKey);
  if (!client) return false;
  try {
    const existing = (await fetchAuthVaultFromSupabase(params.targetUrl, params.targetKey)) || {
      staff: {},
      students: {},
      updatedAt: new Date().toISOString(),
    };

    const nextStaff: Record<string, AuthVaultStaffEntry> = { ...existing.staff };
    const nextStudents: Record<string, AuthVaultStudentEntry> = { ...existing.students };

    if (Array.isArray(params.deleteStaffIds)) {
      params.deleteStaffIds.forEach((id) => {
        if (id) delete nextStaff[id];
      });
    }
    if (Array.isArray(params.deleteStudentIds)) {
      params.deleteStudentIds.forEach((id) => {
        if (id) delete nextStudents[id];
      });
    }

    if (Array.isArray(params.staffEntries)) {
      for (const entry of params.staffEntries) {
        if (!entry?.id) continue;
        const prev = nextStaff[entry.id];
        const cleanIncomingHash = String(entry.passwordHash || '').trim();
        nextStaff[entry.id] = {
          ...(prev || {}),
          ...entry,
          username: String(entry.username || prev?.username || '').trim(),
          email: entry.email !== undefined ? entry.email : prev?.email || '',
          role: entry.role || prev?.role || 'Teacher',
          status: entry.status || prev?.status || 'Active',
          passwordHash: cleanIncomingHash || prev?.passwordHash || '',
          updatedAt: entry.updatedAt || new Date().toISOString(),
        };
      }
    }

    if (Array.isArray(params.studentEntries)) {
      for (const entry of params.studentEntries) {
        if (!entry?.id) continue;
        const prev = nextStudents[entry.id];
        const cleanIncomingHash = String(entry.passwordHash || '').trim();
        const cleanIncomingUser = String(entry.studentUsername || '').trim();
        const finalHash = cleanIncomingHash || prev?.passwordHash || '';
        nextStudents[entry.id] = {
          ...(prev || {}),
          ...entry,
          regNumber: String(entry.regNumber || prev?.regNumber || '').trim(),
          studentUsername: cleanIncomingUser || prev?.studentUsername || '',
          studentAccountActive:
            entry.studentAccountActive !== undefined
              ? entry.studentAccountActive
              : prev?.studentAccountActive !== undefined
              ? prev.studentAccountActive
              : true,
          passwordHash: finalHash,
          hasPassword: Boolean(finalHash || entry.hasPassword || prev?.hasPassword),
          updatedAt: entry.updatedAt || new Date().toISOString(),
        };
      }
    }

    const nowIso = new Date().toISOString();
    const nextVault: PortalAuthVaultData = {
      staff: nextStaff,
      students: nextStudents,
      updatedAt: nowIso,
    };

    const { error } = await client.from('website_settings').upsert(
      {
        id: AUTH_VAULT_ROW_ID,
        data: nextVault,
        updated_at: nowIso,
      },
      { onConflict: 'id' }
    );

    if (!error) return true;
    if (!isMissingTableError(error)) {
      console.warn('[Supabase Auth Vault] Write notice:', error.message);
    }
  } catch (err) {
    console.warn('[Supabase Auth Vault] Write notice:', err);
  }
  return false;
};

// ============================================================================
// 2. SCHOOL GALLERY
// ============================================================================

export const fetchSchoolGalleryFromSupabase = async (): Promise<any[] | null> => {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from('school_gallery')
      .select('*')
      .order('updated_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      return data.map((item) => ({
        id: item.id,
        title: item.title,
        category: item.category,
        description: item.description,
        imageSrc: item.image_src || item.imageSrc,
        caption: item.caption || item.description,
        altText: item.alt_text || item.altText || item.title,
        updatedAt: item.updated_at,
      }));
    }
  } catch (err) {
    console.warn('[Supabase Store] Fetch gallery notice:', err);
  }
  return null;
};

export const saveSchoolGalleryItemToSupabase = async (item: any): Promise<boolean> => {
  const client = getSupabaseClient();
  if (!client || !item) return false;
  try {
    const payload = {
      id: item.id,
      title: item.title,
      category: item.category || 'outdoor',
      description: item.description || item.title,
      image_src: item.imageSrc || item.image_src,
      caption: item.caption || item.description || item.title,
      alt_text: item.altText || item.alt_text || item.title,
      updated_at: new Date().toISOString(),
    };
    const { error } = await client.from('school_gallery').upsert(payload, { onConflict: 'id' });
    return !error;
  } catch (err) {
    console.warn('[Supabase Store] Gallery item write notice:', err);
  }
  return false;
};

export const saveGalleryBatchToSupabase = async (
  items: any[],
  customClient?: SupabaseClient | null
): Promise<boolean> => {
  const client = customClient || getSupabaseClient();
  if (!client || items.length === 0) return false;
  try {
    const rows = items.map((g) => ({
      id: g.id,
      title: g.title,
      category: g.category || 'outdoor',
      description: g.description || g.title,
      image_src: g.imageSrc || g.image_src,
      caption: g.caption || g.description || g.title,
      alt_text: g.altText || g.alt_text || g.title,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await client.from('school_gallery').upsert(rows, { onConflict: 'id' });
    return !error;
  } catch {
    return false;
  }
};

export const deleteSchoolGalleryItemFromSupabase = async (id: string): Promise<boolean> => {
  const client = getSupabaseClient();
  if (!client || !id) return false;
  try {
    const { error } = await client.from('school_gallery').delete().eq('id', id);
    return !error;
  } catch {
    return false;
  }
};

export const subscribeToSupabaseGallery = (callback: (items: any[]) => void): (() => void) =>
  createRealtimeTableSubscription('school_gallery', fetchSchoolGalleryFromSupabase, callback);

// ============================================================================
// 3. STAFF MEMBERS
// ============================================================================

export const fetchStaffMembersFromSupabase = async (): Promise<any[] | null> => {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const { data, error } = await client.from('staff_members').select('*');
    if (!error && Array.isArray(data)) {
      return data.map(mapRowToStaff);
    }
  } catch (err) {
    console.warn('[Supabase Store] Fetch staff notice:', err);
  }
  return null;
};

export const saveStaffMemberToSupabase = async (staff: any): Promise<boolean> => {
  const client = getSupabaseClient();
  if (!client || !staff) return false;
  try {
    const { error } = await upsertWithColumnPruning(client, 'staff_members', mapStaffToRow(staff, true), 'id');
    if (!error) return true;
    console.warn('[Supabase Store] Staff upsert error:', error);
  } catch (err) {
    console.warn('[Supabase Store] Staff write notice:', err);
  }
  return false;
};

export const saveStaffMembersBatchToSupabase = async (
  list: any[],
  customClient?: SupabaseClient | null
): Promise<boolean> => {
  const client = customClient || getSupabaseClient();
  if (!client || list.length === 0) return false;
  try {
    const { error } = await upsertWithColumnPruning(
      client,
      'staff_members',
      list.map((s) => mapStaffToRow(s, true)),
      'id'
    );
    if (!error) return true;
    console.warn('[Supabase Store] Staff batch upsert error:', error);
  } catch (err) {
    console.warn('[Supabase Store] Staff batch write notice:', err);
    return false;
  }
  return false;
};

export const deleteStaffMemberFromSupabase = async (id: string): Promise<boolean> => {
  const client = getSupabaseClient();
  if (!client || !id) return false;
  try {
    const { error } = await client.from('staff_members').delete().eq('id', id);
    return !error;
  } catch {
    return false;
  }
};

export const subscribeToSupabaseStaffMembers = (callback: (items: any[]) => void): (() => void) =>
  createRealtimeTableSubscription('staff_members', fetchStaffMembersFromSupabase, callback);

// ============================================================================
// 4. ENROLLED STUDENTS
// ============================================================================

export const fetchEnrolledStudentsFromSupabase = async (): Promise<any[] | null> => {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from('enrolled_students')
      .select('*')
      .order('updated_at', { ascending: false });
    if (!error && Array.isArray(data)) {
      return data.map(mapRowToStudent);
    }
  } catch (err) {
    console.warn('[Supabase Store] Fetch students notice:', err);
  }
  return null;
};

export const saveEnrolledStudentToSupabase = async (student: any): Promise<boolean> => {
  const client = getSupabaseClient();
  if (!client || !student) return false;
  try {
    const { error } = await upsertWithColumnPruning(
      client,
      'enrolled_students',
      mapStudentToRow(student, true),
      'id'
    );
    if (!error) return true;
    console.warn('[Supabase Store] Student upsert error:', error);
  } catch (err) {
    console.warn('[Supabase Store] Student write notice:', err);
  }
  return false;
};

export const saveEnrolledStudentsBatchToSupabase = async (
  students: any[],
  customClient?: SupabaseClient | null
): Promise<boolean> => {
  const client = customClient || getSupabaseClient();
  if (!client || students.length === 0) return false;
  try {
    const { error } = await upsertWithColumnPruning(
      client,
      'enrolled_students',
      students.map((st) => mapStudentToRow(st, true)),
      'id'
    );
    if (!error) return true;
    console.warn('[Supabase Store] Student batch upsert error:', error);
  } catch (err) {
    console.warn('[Supabase Store] Student batch write notice:', err);
    return false;
  }
  return false;
};

export const deleteEnrolledStudentFromSupabase = async (id: string): Promise<boolean> => {
  const client = getSupabaseClient();
  if (!client || !id) return false;
  try {
    const { error } = await client.from('enrolled_students').delete().eq('id', id);
    return !error;
  } catch {
    return false;
  }
};

export const subscribeToSupabaseEnrolledStudents = (callback: (items: any[]) => void): (() => void) =>
  createRealtimeTableSubscription('enrolled_students', fetchEnrolledStudentsFromSupabase, callback);

// ============================================================================
// 5. PAYMENT TRANSACTIONS
// ============================================================================

export const fetchPaymentTransactionsFromSupabase = async (): Promise<any[] | null> => {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from('payment_transactions')
      .select('*')
      .order('recorded_at', { ascending: false });
    if (!error && Array.isArray(data)) {
      return data.map(mapRowToPayment);
    }
  } catch {
    return null;
  }
  return null;
};

export const savePaymentTransactionToSupabase = async (tx: any): Promise<boolean> => {
  const client = getSupabaseClient();
  if (!client || !tx) return false;
  try {
    const { error } = await client.from('payment_transactions').upsert(mapPaymentToRow(tx), { onConflict: 'id' });
    return !error;
  } catch {
    return false;
  }
};

export const savePaymentTransactionsBatchToSupabase = async (
  txs: any[],
  customClient?: SupabaseClient | null
): Promise<boolean> => {
  const client = customClient || getSupabaseClient();
  if (!client || txs.length === 0) return false;
  try {
    const { error } = await client
      .from('payment_transactions')
      .upsert(txs.map(mapPaymentToRow), { onConflict: 'id' });
    return !error;
  } catch {
    return false;
  }
};

export const deletePaymentTransactionFromSupabase = async (id: string): Promise<boolean> => {
  const client = getSupabaseClient();
  if (!client || !id) return false;
  try {
    const { error } = await client.from('payment_transactions').delete().eq('id', id);
    return !error;
  } catch {
    return false;
  }
};

export const subscribeToSupabasePayments = (callback: (items: any[]) => void): (() => void) =>
  createRealtimeTableSubscription('payment_transactions', fetchPaymentTransactionsFromSupabase, callback);

// ============================================================================
// 6. ADMISSIONS APPLICATIONS
// ============================================================================

export const fetchApplicationsFromSupabase = async (): Promise<any[] | null> => {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from('admissions_applications')
      .select('*')
      .order('updated_at', { ascending: false });
    if (!error && Array.isArray(data)) {
      return data.map(mapRowToApplication);
    }
  } catch {
    return null;
  }
  return null;
};

export const saveApplicationToSupabase = async (app: any): Promise<boolean> => {
  const client = getSupabaseClient();
  if (!client || !app) return false;
  try {
    const { error } = await client
      .from('admissions_applications')
      .upsert(mapApplicationToRow(app, true), { onConflict: 'id' });
    if (!error) return true;
    if (isMissingColumnError(error)) {
      const { error: fbErr } = await client
        .from('admissions_applications')
        .upsert(mapApplicationToRow(app, false), { onConflict: 'id' });
      return !fbErr;
    }
    return false;
  } catch {
    return false;
  }
};

export const saveApplicationsBatchToSupabase = async (
  apps: any[],
  customClient?: SupabaseClient | null
): Promise<boolean> => {
  const client = customClient || getSupabaseClient();
  if (!client || apps.length === 0) return false;
  try {
    const { error } = await client
      .from('admissions_applications')
      .upsert(apps.map((a) => mapApplicationToRow(a, true)), { onConflict: 'id' });
    if (!error) return true;
    if (isMissingColumnError(error)) {
      const { error: fbErr } = await client
        .from('admissions_applications')
        .upsert(apps.map((a) => mapApplicationToRow(a, false)), { onConflict: 'id' });
      return !fbErr;
    }
    return false;
  } catch {
    return false;
  }
};

export const deleteApplicationFromSupabase = async (id: string): Promise<boolean> => {
  const client = getSupabaseClient();
  if (!client || !id) return false;
  try {
    const { error } = await client.from('admissions_applications').delete().eq('id', id);
    return !error;
  } catch {
    return false;
  }
};

export const subscribeToSupabaseApplications = (callback: (items: any[]) => void): (() => void) =>
  createRealtimeTableSubscription('admissions_applications', fetchApplicationsFromSupabase, callback);

// ============================================================================
// 7. ATTENDANCE RECORDS (Students)
// ============================================================================

export const fetchAttendanceRecordsFromSupabase = async (): Promise<any[] | null> => {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from('attendance_records')
      .select('*')
      .order('date', { ascending: false });
    if (!error && Array.isArray(data)) {
      return data.map(mapRowToAttendance);
    }
  } catch {
    return null;
  }
  return null;
};

export const saveAttendanceBatchToSupabase = async (
  records: any[],
  customClient?: SupabaseClient | null
): Promise<boolean> => {
  const client = customClient || getSupabaseClient();
  if (!client || records.length === 0) return false;
  try {
    const { error } = await client
      .from('attendance_records')
      .upsert(records.map(mapAttendanceToRow), { onConflict: 'id' });
    return !error;
  } catch {
    return false;
  }
};

export const deleteAttendanceRecordFromSupabase = async (id: string): Promise<boolean> => {
  const client = getSupabaseClient();
  if (!client || !id) return false;
  try {
    const { error } = await client.from('attendance_records').delete().eq('id', id);
    return !error;
  } catch {
    return false;
  }
};

export const clearAttendanceDateFromSupabase = async (date: string): Promise<boolean> => {
  const client = getSupabaseClient();
  if (!client || !date) return false;
  try {
    const { error } = await client.from('attendance_records').delete().eq('date', date);
    return !error;
  } catch {
    return false;
  }
};

export const subscribeToSupabaseAttendance = (callback: (items: any[]) => void): (() => void) =>
  createRealtimeTableSubscription('attendance_records', fetchAttendanceRecordsFromSupabase, callback);

// ============================================================================
// 8. TEACHER ATTENDANCE RECORDS
// ============================================================================

export const fetchTeacherAttendanceFromSupabase = async (): Promise<any[] | null> => {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from('teacher_attendance_records')
      .select('*')
      .order('date', { ascending: false });
    if (!error && Array.isArray(data)) {
      return data.map(mapRowToTeacherAtt);
    }
  } catch {
    return null;
  }
  return null;
};

export const saveTeacherAttendanceBatchToSupabase = async (
  records: any[],
  customClient?: SupabaseClient | null
): Promise<boolean> => {
  const client = customClient || getSupabaseClient();
  if (!client || records.length === 0) return false;
  try {
    const { error } = await client
      .from('teacher_attendance_records')
      .upsert(records.map(mapTeacherAttToRow), { onConflict: 'id' });
    return !error;
  } catch {
    return false;
  }
};

export const deleteTeacherAttendanceRecordFromSupabase = async (id: string): Promise<boolean> => {
  const client = getSupabaseClient();
  if (!client || !id) return false;
  try {
    const { error } = await client.from('teacher_attendance_records').delete().eq('id', id);
    return !error;
  } catch {
    return false;
  }
};

export const subscribeToSupabaseTeacherAttendance = (callback: (items: any[]) => void): (() => void) =>
  createRealtimeTableSubscription('teacher_attendance_records', fetchTeacherAttendanceFromSupabase, callback);

// ============================================================================
// 9. DISCIPLINE RECORDS (DOD)
// ============================================================================

export const fetchDisciplineRecordsFromSupabase = async (): Promise<any[] | null> => {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from('discipline_records')
      .select('*')
      .order('date', { ascending: false });
    if (!error && Array.isArray(data)) {
      return data.map(mapRowToDiscipline);
    }
  } catch {
    return null;
  }
  return null;
};

export const saveDisciplineRecordToSupabase = async (record: any): Promise<boolean> => {
  const client = getSupabaseClient();
  if (!client || !record) return false;
  try {
    const { error } = await client
      .from('discipline_records')
      .upsert(mapDisciplineToRow(record), { onConflict: 'id' });
    return !error;
  } catch {
    return false;
  }
};

export const saveDisciplineBatchToSupabase = async (
  records: any[],
  customClient?: SupabaseClient | null
): Promise<boolean> => {
  const client = customClient || getSupabaseClient();
  if (!client || records.length === 0) return false;
  try {
    const { error } = await client
      .from('discipline_records')
      .upsert(records.map(mapDisciplineToRow), { onConflict: 'id' });
    return !error;
  } catch {
    return false;
  }
};

export const deleteDisciplineRecordFromSupabase = async (id: string): Promise<boolean> => {
  const client = getSupabaseClient();
  if (!client || !id) return false;
  try {
    const { error } = await client.from('discipline_records').delete().eq('id', id);
    return !error;
  } catch {
    return false;
  }
};

export const subscribeToSupabaseDiscipline = (callback: (items: any[]) => void): (() => void) =>
  createRealtimeTableSubscription('discipline_records', fetchDisciplineRecordsFromSupabase, callback);

// ============================================================================
// 10. STUDENT PROGRESS LOGS (Teacher Portal)
// ============================================================================

export const fetchStudentProgressLogsFromSupabase = async (
  filterGrade?: string,
  filterStudentId?: string
): Promise<any[] | null> => {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    let q = client.from('student_progress_logs').select('*').order('date', { ascending: false });
    if (filterGrade && filterGrade !== 'ALL') {
      q = q.eq('grade_code', filterGrade);
    }
    if (filterStudentId) {
      q = q.eq('student_id', filterStudentId);
    }
    const { data, error } = await q;
    if (!error && Array.isArray(data)) {
      return data.map(mapRowToProgressLog);
    }
  } catch {
    return null;
  }
  return null;
};

export const saveStudentProgressLogToSupabase = async (log: any): Promise<boolean> => {
  const client = getSupabaseClient();
  if (!client || !log) return false;
  try {
    const { error } = await client
      .from('student_progress_logs')
      .upsert(mapProgressLogToRow(log), { onConflict: 'id' });
    return !error;
  } catch {
    return false;
  }
};

export const saveStudentProgressLogsBatchToSupabase = async (
  logs: any[],
  customClient?: SupabaseClient | null
): Promise<boolean> => {
  const client = customClient || getSupabaseClient();
  if (!client || logs.length === 0) return false;
  try {
    const { error } = await client
      .from('student_progress_logs')
      .upsert(logs.map(mapProgressLogToRow), { onConflict: 'id' });
    return !error;
  } catch {
    return false;
  }
};

export const deleteStudentProgressLogFromSupabase = async (id: string): Promise<boolean> => {
  const client = getSupabaseClient();
  if (!client || !id) return false;
  try {
    const { error } = await client.from('student_progress_logs').delete().eq('id', id);
    return !error;
  } catch {
    return false;
  }
};

export const subscribeToSupabaseProgressLogs = (callback: (items: any[]) => void): (() => void) =>
  createRealtimeTableSubscription('student_progress_logs', () => fetchStudentProgressLogsFromSupabase(), callback);

// ============================================================================
// 11. SCHOOL ANNOUNCEMENTS
// ============================================================================

export const fetchAnnouncementsFromSupabase = async (): Promise<any[] | null> => {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from('school_announcements')
      .select('*')
      .order('updated_at', { ascending: false });
    if (!error && Array.isArray(data)) {
      return data.map(mapRowToAnnouncement);
    }
  } catch {
    return null;
  }
  return null;
};

export const saveAnnouncementToSupabase = async (ann: any): Promise<boolean> => {
  const client = getSupabaseClient();
  if (!client || !ann) return false;
  try {
    const { error } = await client
      .from('school_announcements')
      .upsert(mapAnnouncementToRow(ann), { onConflict: 'id' });
    return !error;
  } catch {
    return false;
  }
};

export const saveAnnouncementsBatchToSupabase = async (
  list: any[],
  customClient?: SupabaseClient | null
): Promise<boolean> => {
  const client = customClient || getSupabaseClient();
  if (!client || list.length === 0) return false;
  try {
    const { error } = await client
      .from('school_announcements')
      .upsert(list.map(mapAnnouncementToRow), { onConflict: 'id' });
    return !error;
  } catch {
    return false;
  }
};

export const deleteAnnouncementFromSupabase = async (id: string): Promise<boolean> => {
  const client = getSupabaseClient();
  if (!client || !id) return false;
  try {
    const { error } = await client.from('school_announcements').delete().eq('id', id);
    return !error;
  } catch {
    return false;
  }
};

export const subscribeToSupabaseAnnouncements = (callback: (items: any[]) => void): (() => void) =>
  createRealtimeTableSubscription('school_announcements', fetchAnnouncementsFromSupabase, callback);

// ============================================================================
// 12. REGISTRATION DOCUMENTS
// ============================================================================

export const fetchDocumentsFromSupabase = async (): Promise<any[] | null> => {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from('registration_documents')
      .select('*')
      .order('sort_order', { ascending: true });
    if (!error && Array.isArray(data)) {
      return data.map(mapRowToDocument);
    }
  } catch {
    return null;
  }
  return null;
};

export const saveDocumentToSupabase = async (docItem: any): Promise<boolean> => {
  const client = getSupabaseClient();
  if (!client || !docItem) return false;
  try {
    const { error } = await client
      .from('registration_documents')
      .upsert(mapDocumentToRow(docItem), { onConflict: 'id' });
    return !error;
  } catch {
    return false;
  }
};

export const saveDocumentsBatchToSupabase = async (
  docs: any[],
  customClient?: SupabaseClient | null
): Promise<boolean> => {
  const client = customClient || getSupabaseClient();
  if (!client || docs.length === 0) return false;
  try {
    const { error } = await client
      .from('registration_documents')
      .upsert(docs.map(mapDocumentToRow), { onConflict: 'id' });
    return !error;
  } catch {
    return false;
  }
};

export const deleteDocumentFromSupabase = async (id: string): Promise<boolean> => {
  const client = getSupabaseClient();
  if (!client || !id) return false;
  try {
    const { error } = await client.from('registration_documents').delete().eq('id', id);
    return !error;
  } catch {
    return false;
  }
};

export const subscribeToSupabaseDocuments = (callback: (items: any[]) => void): (() => void) =>
  createRealtimeTableSubscription('registration_documents', fetchDocumentsFromSupabase, callback);

// ============================================================================
// 13. VISITOR INQUIRIES
// ============================================================================

export const fetchInquiriesFromSupabase = async (): Promise<any[] | null> => {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from('visitor_inquiries')
      .select('*')
      .order('updated_at', { ascending: false });
    if (!error && Array.isArray(data)) {
      return data.map(mapRowToInquiry);
    }
  } catch {
    return null;
  }
  return null;
};

export const saveInquiryToSupabase = async (inq: any): Promise<boolean> => {
  const client = getSupabaseClient();
  if (!client || !inq) return false;
  try {
    const { error } = await client.from('visitor_inquiries').upsert(mapInquiryToRow(inq), { onConflict: 'id' });
    return !error;
  } catch {
    return false;
  }
};

export const saveInquiriesBatchToSupabase = async (
  list: any[],
  customClient?: SupabaseClient | null
): Promise<boolean> => {
  const client = customClient || getSupabaseClient();
  if (!client || list.length === 0) return false;
  try {
    const { error } = await client.from('visitor_inquiries').upsert(list.map(mapInquiryToRow), { onConflict: 'id' });
    return !error;
  } catch {
    return false;
  }
};

export const subscribeToSupabaseInquiries = (callback: (items: any[]) => void): (() => void) =>
  createRealtimeTableSubscription('visitor_inquiries', fetchInquiriesFromSupabase, callback);

// ============================================================================
// 14. CAMPUS TOUR BOOKINGS
// ============================================================================

export const fetchTourBookingsFromSupabase = async (): Promise<any[] | null> => {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from('campus_tour_bookings')
      .select('*')
      .order('updated_at', { ascending: false });
    if (!error && Array.isArray(data)) {
      return data.map(mapRowToTour);
    }
  } catch {
    return null;
  }
  return null;
};

export const saveTourBookingToSupabase = async (tour: any): Promise<boolean> => {
  const client = getSupabaseClient();
  if (!client || !tour) return false;
  try {
    const { error } = await client
      .from('campus_tour_bookings')
      .upsert(mapTourToRow(tour), { onConflict: 'id' });
    return !error;
  } catch {
    return false;
  }
};

export const saveTourBookingsBatchToSupabase = async (
  tours: any[],
  customClient?: SupabaseClient | null
): Promise<boolean> => {
  const client = customClient || getSupabaseClient();
  if (!client || tours.length === 0) return false;
  try {
    const { error } = await client
      .from('campus_tour_bookings')
      .upsert(tours.map(mapTourToRow), { onConflict: 'id' });
    return !error;
  } catch {
    return false;
  }
};

export const subscribeToSupabaseTourBookings = (callback: (items: any[]) => void): (() => void) =>
  createRealtimeTableSubscription('campus_tour_bookings', fetchTourBookingsFromSupabase, callback);

// ============================================================================
// 15. APPLICANT CHATS
// ============================================================================

export const fetchApplicantChatsFromSupabase = async (): Promise<any[] | null> => {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from('applicant_chats')
      .select('*')
      .order('updated_at', { ascending: false });
    if (!error && Array.isArray(data)) {
      return data.map(mapRowToChat);
    }
  } catch {
    return null;
  }
  return null;
};

export const fetchApplicantChatByRefFromSupabase = async (refOrEmail: string): Promise<any | null> => {
  const client = getSupabaseClient();
  if (!client || !refOrEmail) return null;
  const clean = refOrEmail.trim();
  const upperRef = clean.toUpperCase();
  const lowerEmail = clean.toLowerCase();
  try {
    const { data: byRef, error: refErr } = await client
      .from('applicant_chats')
      .select('*')
      .eq('ref_code', upperRef)
      .maybeSingle();

    if (!refErr && byRef) {
      return mapRowToChat(byRef);
    }

    if (clean.includes('@')) {
      const { data: byEmail, error: emailErr } = await client
        .from('applicant_chats')
        .select('*')
        .ilike('parent_email', lowerEmail)
        .order('updated_at', { ascending: false })
        .limit(1);
      if (!emailErr && Array.isArray(byEmail) && byEmail.length > 0) {
        return mapRowToChat(byEmail[0]);
      }
    }
  } catch {
    return null;
  }
  return null;
};

export const saveApplicantChatToSupabase = async (
  thread: any,
  customClient?: SupabaseClient | null
): Promise<boolean> => {
  const client = customClient || getSupabaseClient();
  if (!client || !thread || !thread.refCode) return false;
  try {
    const { error } = await client
      .from('applicant_chats')
      .upsert(mapChatToRow(thread), { onConflict: 'ref_code' });
    return !error;
  } catch {
    return false;
  }
};

export const appendApplicantChatMessageToSupabase = async (
  refCode: string,
  message: { id: string; sender: 'parent' | 'admin' | 'system'; senderName: string; text: string; createdAt: string },
  fallbackMeta?: Partial<{
    studentName: string;
    parentName: string;
    parentEmail?: string;
    parentPhone?: string;
    gradeCode: string;
    status: string;
  }>
): Promise<any | null> => {
  const existing = await fetchApplicantChatByRefFromSupabase(refCode);
  const updatedThread = existing
    ? {
        ...existing,
        messages: [...(existing.messages || []), message],
        updatedAt: new Date().toISOString(),
      }
    : {
        refCode: refCode.trim().toUpperCase(),
        studentName: fallbackMeta?.studentName || 'Applicant',
        parentName: fallbackMeta?.parentName || 'Applicant Parent',
        parentEmail: fallbackMeta?.parentEmail,
        parentPhone: fallbackMeta?.parentPhone,
        gradeCode: fallbackMeta?.gradeCode || 'P1',
        status: fallbackMeta?.status || 'Pending Confirmation',
        messages: [message],
        updatedAt: new Date().toISOString(),
      };

  const saved = await saveApplicantChatToSupabase(updatedThread);
  return saved ? updatedThread : updatedThread;
};

export const subscribeToSupabaseApplicantChats = (callback: (items: any[]) => void): (() => void) =>
  createRealtimeTableSubscription('applicant_chats', fetchApplicantChatsFromSupabase, callback);

// ============================================================================
// FULL 15-MODULE BULK SYNCHRONIZATION
// ============================================================================

export const syncAllDataToSupabase = async (
  targetUrl?: string,
  targetKey?: string
): Promise<{
  success: boolean;
  message: string;
  syncedCount: {
    gallery: number;
    staff: number;
    students: number;
    payments: number;
    applications: number;
    attendance: number;
    teacherAttendance: number;
    discipline: number;
    progressLogs: number;
    announcements: number;
    documents: number;
    inquiries: number;
    tours: number;
    chats: number;
  };
  missingTables: string[];
}> => {
  const emptyCounts = {
    gallery: 0,
    staff: 0,
    students: 0,
    payments: 0,
    applications: 0,
    attendance: 0,
    teacherAttendance: 0,
    discipline: 0,
    progressLogs: 0,
    announcements: 0,
    documents: 0,
    inquiries: 0,
    tours: 0,
    chats: 0,
  };

  const client = createCustomOrActiveClient(targetUrl, targetKey);
  if (!client) {
    return {
      success: false,
      message: 'Supabase is not configured yet. Please configure your Project URL and Anon Key.',
      syncedCount: emptyCounts,
      missingTables: [],
    };
  }

  try {
    // Dynamically read all stores cleanly at runtime (no circular dependency)
    const store = await import('./adminStore');
    const fbStore = await import('./firebaseStore');

    const galleryItems = store.getGalleryItems();
    const staffMembers = store.getStaffMembers();
    const students = store.getEnrolledStudents();
    const currentSettings = store.getWebsiteSettings();
    const payments = store.getPaymentTransactions();
    const applications = store.getApplications();
    const attendance = store.getAttendanceRecords();
    const teacherAttendance = store.getTeacherAttendanceRecords();
    const discipline = store.getDisciplineRecords();
    const progressLogs = fbStore.getCachedProgressLogs();
    const announcements = store.getAnnouncements();
    const documents = store.getRequiredDocuments();
    const inquiries = store.getInquiries();
    const tours = store.getTourBookings();

    // Build initial chat threads from stored applications if not yet created
    const existingRemoteChats = (await fetchApplicantChatsFromSupabase()) || [];
    const existingChatMap = new Map(existingRemoteChats.map((c: any) => [String(c.refCode).toUpperCase(), c]));
    applications.forEach((app) => {
      const refKey = String(app.refCode).toUpperCase();
      if (!existingChatMap.has(refKey)) {
        existingChatMap.set(refKey, {
          refCode: refKey,
          studentName: app.studentName,
          parentName: app.parentName,
          parentEmail: app.parentEmail,
          parentPhone: app.parentPhone,
          gradeCode: app.gradeCode,
          status: app.status,
          messages: [
            {
              id: `init-${app.id}`,
              sender: 'system',
              senderName: 'Mugina Hope Administration Desk',
              text: `Application ${app.refCode} for ${app.studentName} logged (${app.status}).`,
              createdAt: app.createdAt || new Date().toISOString(),
            },
          ],
          updatedAt: new Date().toISOString(),
        });
      }
    });
    const chatList = Array.from(existingChatMap.values());

    const missingTables: string[] = [];
    const syncedCount = { ...emptyCounts };

    const upsertTable = async (
      table: SupabaseTableName,
      rows: any[],
      onConflict: string,
      onCount: (n: number) => void,
      fallbackRows?: any[]
    ) => {
      if (rows.length === 0) return;
      const { error } = await client.from(table).upsert(rows, { onConflict });
      if (!error) {
        onCount(rows.length);
        return;
      }
      if (isMissingColumnError(error) && fallbackRows) {
        const { error: fbErr } = await client.from(table).upsert(fallbackRows, { onConflict });
        if (!fbErr) {
          onCount(rows.length);
          return;
        }
      }
      if (isMissingTableError(error)) {
        missingTables.push(table);
      } else {
        console.warn(`[Supabase Sync] Notice on ${table}:`, error.message);
      }
    };

    // Purge remotely deleted (tombstoned) records before upserting
    const deletedGalleryIds = Array.isArray(currentSettings?.deletedGalleryIds)
      ? currentSettings.deletedGalleryIds.filter(Boolean)
      : [];
    const deletedStaffIds = Array.isArray(currentSettings?.deletedStaffIds)
      ? currentSettings.deletedStaffIds.filter(Boolean)
      : [];
    const deletedStudentIds = Array.isArray(currentSettings?.deletedStudentIds)
      ? currentSettings.deletedStudentIds.filter(Boolean)
      : [];

    if (deletedGalleryIds.length > 0) {
      await client.from('school_gallery').delete().in('id', deletedGalleryIds).then(() => {}, () => {});
    }
    if (galleryItems.length === 0 && currentSettings?.galleryInitialized) {
      const { data: existingGal } = await client.from('school_gallery').select('id');
      if (Array.isArray(existingGal) && existingGal.length > 0) {
        await client
          .from('school_gallery')
          .delete()
          .in('id', existingGal.map((g: any) => g.id))
          .then(() => {}, () => {});
      }
    }
    if (deletedStaffIds.length > 0) {
      await client.from('staff_members').delete().in('id', deletedStaffIds).then(() => {}, () => {});
    }
    if (deletedStudentIds.length > 0) {
      await client.from('enrolled_students').delete().in('id', deletedStudentIds).then(() => {}, () => {});
    }

    // Core Settings
    const { error: settingsErr } = await client.from('website_settings').upsert(
      { id: 'general', data: { ...currentSettings, updatedAt: new Date().toISOString() }, updated_at: new Date().toISOString() },
      { onConflict: 'id' }
    );
    if (isMissingTableError(settingsErr)) missingTables.push('website_settings');

    const credHashMod = await import('./credentialHash');
    const vaultStaffEntries: AuthVaultStaffEntry[] = await Promise.all(
      staffMembers.map(async (s) => {
        const plainPw = String(s.password || '').trim();
        const pwHash =
          plainPw && plainPw !== '••••••'
            ? await credHashMod.hashPortalSecret(plainPw)
            : String(s.clientPasswordHash || '').trim();
        return {
          id: s.id,
          username: s.username,
          email: s.email || '',
          role: s.role,
          status: s.status,
          ...(pwHash ? { passwordHash: pwHash } : {}),
          updatedAt: s.updatedAt || new Date().toISOString(),
        };
      })
    );
    const vaultStudentEntries: AuthVaultStudentEntry[] = await Promise.all(
      students.map(async (st) => {
        const plainPw = String(st.studentPassword || '').trim();
        const pwHash =
          plainPw && plainPw !== '••••••'
            ? await credHashMod.hashPortalSecret(plainPw)
            : String(st.clientPasswordHash || '').trim();
        return {
          id: st.id,
          regNumber: st.regNumber,
          studentUsername: st.studentUsername || '',
          studentAccountActive: st.studentAccountActive !== false,
          ...(pwHash ? { passwordHash: pwHash } : {}),
          hasPassword: Boolean(pwHash || st.hasPasswordHash),
          updatedAt: st.updatedAt || new Date().toISOString(),
        };
      })
    );

    // Parallel module upserts
    await Promise.all([
      upsertAuthVaultToSupabase({
        staffEntries: vaultStaffEntries,
        studentEntries: vaultStudentEntries,
        deleteStaffIds: deletedStaffIds,
        deleteStudentIds: deletedStudentIds,
        targetUrl,
        targetKey,
      }),
      upsertTable(
        'school_gallery',
        galleryItems.map((g) => ({
          id: g.id,
          title: g.title,
          category: g.category || 'outdoor',
          description: g.description || g.title,
          image_src: g.imageSrc,
          caption: g.caption || g.description || g.title,
          alt_text: g.altText || g.title,
          updated_at: new Date().toISOString(),
        })),
        'id',
        (n) => (syncedCount.gallery = n)
      ),
      upsertTable(
        'staff_members',
        staffMembers.map((s) => mapStaffToRow(s, true)),
        'id',
        (n) => (syncedCount.staff = n),
        staffMembers.map((s) => mapStaffToRow(s, false))
      ),
      upsertTable(
        'enrolled_students',
        students.map((st) => mapStudentToRow(st, true)),
        'id',
        (n) => (syncedCount.students = n),
        students.map((st) => mapStudentToRow(st, false))
      ),
      upsertTable('payment_transactions', payments.map(mapPaymentToRow), 'id', (n) => (syncedCount.payments = n)),
      upsertTable(
        'admissions_applications',
        applications.map((a) => mapApplicationToRow(a, true)),
        'id',
        (n) => (syncedCount.applications = n),
        applications.map((a) => mapApplicationToRow(a, false))
      ),
      upsertTable('attendance_records', attendance.map(mapAttendanceToRow), 'id', (n) => (syncedCount.attendance = n)),
      upsertTable('teacher_attendance_records', teacherAttendance.map(mapTeacherAttToRow), 'id', (n) => (syncedCount.teacherAttendance = n)),
      upsertTable('discipline_records', discipline.map(mapDisciplineToRow), 'id', (n) => (syncedCount.discipline = n)),
      upsertTable('student_progress_logs', progressLogs.map(mapProgressLogToRow), 'id', (n) => (syncedCount.progressLogs = n)),
      upsertTable('school_announcements', announcements.map(mapAnnouncementToRow), 'id', (n) => (syncedCount.announcements = n)),
      upsertTable('registration_documents', documents.map(mapDocumentToRow), 'id', (n) => (syncedCount.documents = n)),
      upsertTable('visitor_inquiries', inquiries.map(mapInquiryToRow), 'id', (n) => (syncedCount.inquiries = n)),
      upsertTable('campus_tour_bookings', tours.map(mapTourToRow), 'id', (n) => (syncedCount.tours = n)),
      upsertTable('applicant_chats', chatList.map(mapChatToRow), 'ref_code', (n) => (syncedCount.chats = n)),
    ]);

    const summaryParts = [
      `${syncedCount.gallery} gallery`,
      `${syncedCount.staff} staff`,
      `${syncedCount.students} students`,
      `${syncedCount.payments} payments`,
      `${syncedCount.applications} applications`,
      `${syncedCount.discipline} discipline`,
      `${syncedCount.announcements} announcements`,
      `${syncedCount.documents} docs`,
    ];

    if (missingTables.length > 0) {
      return {
        success: true,
        message: `Synced active tables (${summaryParts.join(', ')}). ${missingTables.length} table(s) still need creation in Supabase SQL Editor: ${missingTables.join(', ')}.`,
        syncedCount,
        missingTables,
      };
    }

    return {
      success: true,
      message: `All 15 Supabase modules synchronized successfully! (${summaryParts.join(', ')}, ${syncedCount.attendance} student roll-calls, ${syncedCount.teacherAttendance} teacher attendance, ${syncedCount.inquiries} inquiries, ${syncedCount.chats} chat threads).`,
      syncedCount,
      missingTables: [],
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Error syncing data to Supabase: ${err.message || 'Unknown error'}`,
      syncedCount: emptyCounts,
      missingTables: [],
    };
  }
};
