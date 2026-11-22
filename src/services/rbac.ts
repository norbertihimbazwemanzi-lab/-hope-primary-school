import type { CurrentSessionUser, EnrolledStudent, UserRole } from './adminStore';

export type CanonicalRole =
  | 'SuperAdmin'
  | 'SchoolAdmin'
  | 'HeadTeacher'
  | 'Teacher'
  | 'Accountant'
  | 'Parent'
  | 'Student';

export type SmsPermission =
  | 'manage_staff_roles'
  | 'manage_system_settings'
  | 'view_audit_logs'
  | 'manage_backups'
  | 'manage_website_content'
  | 'manage_gallery'
  | 'manage_announcements'
  | 'manage_inquiries'
  | 'manage_admissions'
  | 'manage_students'
  | 'promote_transfer_students'
  | 'manage_documents'
  | 'manage_academics'
  | 'configure_exam_rules'
  | 'approve_exam_results'
  | 'enter_assigned_marks'
  | 'manage_all_attendance'
  | 'manage_assigned_attendance'
  | 'manage_teacher_attendance'
  | 'manage_discipline'
  | 'access_accounting'
  | 'approve_refunds'
  | 'view_school_reports'
  | 'manage_lesson_plans'
  | 'manage_materials_homework'
  | 'message_parents'
  | 'view_parent_portal'
  | 'view_student_portal';

const ROLE_ALIASES: Record<string, CanonicalRole> = {
  SuperAdmin: 'SuperAdmin',
  Admin: 'SuperAdmin',
  SchoolAdmin: 'SchoolAdmin',
  HeadTeacher: 'HeadTeacher',
  DOS: 'HeadTeacher',
  DOD: 'HeadTeacher',
  Registrar: 'HeadTeacher',
  Teacher: 'Teacher',
  Accountant: 'Accountant',
  Finance: 'Accountant',
  Parent: 'Parent',
  Student: 'Student',
};

export const normalizeUserRole = (role?: string | null): CanonicalRole => {
  if (!role) return 'Student';
  return ROLE_ALIASES[role] || 'Teacher';
};

export const getRoleDisplayLabel = (role?: string | null): string => {
  switch (role) {
    case 'SuperAdmin':
    case 'Admin':
      return 'Super Administrator';
    case 'SchoolAdmin':
      return 'School Administrator';
    case 'HeadTeacher':
      return 'Head Teacher';
    case 'DOS':
      return 'Director of Studies (DOS)';
    case 'DOD':
      return 'Director of Discipline (DOD)';
    case 'Registrar':
      return 'Admissions Registrar';
    case 'Accountant':
    case 'Finance':
      return 'Accountant & Bursar';
    case 'Teacher':
      return 'Class / Subject Teacher';
    case 'Parent':
      return 'Parent / Guardian';
    case 'Student':
      return 'Enrolled Student';
    default:
      return role || 'Staff';
  }
};

const PERMISSION_MATRIX: Record<CanonicalRole, SmsPermission[]> = {
  SuperAdmin: [
    'manage_staff_roles',
    'manage_system_settings',
    'view_audit_logs',
    'manage_backups',
    'manage_website_content',
    'manage_gallery',
    'manage_announcements',
    'manage_inquiries',
    'manage_admissions',
    'manage_students',
    'promote_transfer_students',
    'manage_documents',
    'manage_academics',
    'configure_exam_rules',
    'approve_exam_results',
    'enter_assigned_marks',
    'manage_all_attendance',
    'manage_assigned_attendance',
    'manage_teacher_attendance',
    'manage_discipline',
    'access_accounting',
    'approve_refunds',
    'view_school_reports',
    'manage_lesson_plans',
    'manage_materials_homework',
    'message_parents',
  ],
  SchoolAdmin: [
    'manage_staff_roles',
    'manage_system_settings',
    'view_audit_logs',
    'manage_backups',
    'manage_website_content',
    'manage_gallery',
    'manage_announcements',
    'manage_inquiries',
    'manage_admissions',
    'manage_students',
    'promote_transfer_students',
    'manage_documents',
    'manage_academics',
    'configure_exam_rules',
    'approve_exam_results',
    'enter_assigned_marks',
    'manage_all_attendance',
    'manage_assigned_attendance',
    'manage_teacher_attendance',
    'manage_discipline',
    'access_accounting',
    'view_school_reports',
    'manage_lesson_plans',
    'manage_materials_homework',
    'message_parents',
  ],
  HeadTeacher: [
    'manage_website_content',
    'manage_gallery',
    'manage_announcements',
    'manage_inquiries',
    'manage_admissions',
    'manage_students',
    'promote_transfer_students',
    'manage_documents',
    'manage_academics',
    'configure_exam_rules',
    'approve_exam_results',
    'enter_assigned_marks',
    'manage_all_attendance',
    'manage_assigned_attendance',
    'manage_teacher_attendance',
    'manage_discipline',
    'view_school_reports',
    'manage_lesson_plans',
    'manage_materials_homework',
    'message_parents',
  ],
  Teacher: [
    'enter_assigned_marks',
    'manage_assigned_attendance',
    'manage_lesson_plans',
    'manage_materials_homework',
    'message_parents',
  ],
  Accountant: [
    'access_accounting',
    'view_school_reports',
  ],
  Parent: ['view_parent_portal'],
  Student: ['view_student_portal'],
};

export const hasPermission = (
  user: Pick<CurrentSessionUser, 'role'> | { role?: UserRole | string } | null | undefined,
  permission: SmsPermission
): boolean => {
  if (!user?.role) return false;
  // Preserve scoped sub-restrictions for DOS/DOD/Registrar
  if (user.role === 'Registrar') {
    const registrarAllowed: SmsPermission[] = [
      'manage_admissions',
      'manage_students',
      'promote_transfer_students',
      'manage_documents',
      'view_school_reports',
    ];
    return registrarAllowed.includes(permission);
  }
  if (user.role === 'DOD') {
    const dodAllowed: SmsPermission[] = [
      'manage_all_attendance',
      'manage_assigned_attendance',
      'manage_discipline',
      'message_parents',
      'view_school_reports',
    ];
    return dodAllowed.includes(permission);
  }
  const canonical = normalizeUserRole(user.role);
  return PERMISSION_MATRIX[canonical]?.includes(permission) ?? false;
};

export const isAdminOrExecutive = (role?: string | null): boolean => {
  const c = normalizeUserRole(role);
  return c === 'SuperAdmin' || c === 'SchoolAdmin' || c === 'HeadTeacher';
};

export const isFullAdmin = (role?: string | null): boolean => {
  const c = normalizeUserRole(role);
  return c === 'SuperAdmin' || c === 'SchoolAdmin';
};

export const extractGradesFromAssignment = (assignedText?: string): string[] => {
  if (!assignedText) return [];
  const txt = assignedText.toUpperCase();
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
};

export const getParentAuthorizedStudents = (
  user: CurrentSessionUser | null | undefined,
  students: EnrolledStudent[]
): EnrolledStudent[] => {
  if (!user || normalizeUserRole(user.role) !== 'Parent') return [];
  const email = (user.email || '').trim().toLowerCase();
  const uname = (user.username || '').trim().toLowerCase();
  const linkedIds = new Set(user.linkedStudentIds || []);
  return students.filter((s) => {
    if (linkedIds.has(s.id)) return true;
    const pEmail = (s.parentEmail || '').trim().toLowerCase();
    const pPhone = (s.parentPhone || '').replace(/\s+/g, '').toLowerCase();
    const cleanUname = uname.replace(/\s+/g, '');
    if (email && pEmail && pEmail === email) return true;
    if (cleanUname && pEmail && pEmail === cleanUname) return true;
    if (cleanUname && pPhone && (pPhone === cleanUname || pPhone.endsWith(cleanUname))) return true;
    return false;
  });
};

export const getStudentSelfRecord = (
  user: CurrentSessionUser | null | undefined,
  students: EnrolledStudent[]
): EnrolledStudent | null => {
  if (!user || normalizeUserRole(user.role) !== 'Student') return null;
  const uname = (user.username || '').trim().toLowerCase();
  const email = (user.email || '').trim().toLowerCase();
  const userFullName = (user.name || '').trim().toLowerCase();
  return (
    students.find(
      (s) =>
        s.id === user.id ||
        (uname && String(s.studentUsername || '').trim().toLowerCase() === uname) ||
        (uname && String(s.regNumber || '').trim().toLowerCase() === uname) ||
        (email &&
          String(s.parentEmail || '').trim().toLowerCase() === email &&
          String(s.fullName || '').trim().toLowerCase() === userFullName)
    ) || null
  );
};

export const ROLE_PERMISSION_DIRECTORY: Array<{
  role: CanonicalRole;
  title: string;
  legacyAliases: string[];
  summary: string;
  capabilities: string[];
  restrictions: string[];
}> = [
  {
    role: 'SuperAdmin',
    title: 'Super Administrator',
    legacyAliases: ['Admin'],
    summary: 'Unrestricted system governance, staff role allocation, database backup/restore, audit logs, and all SMS modules.',
    capabilities: [
      'Full access across all 18 administrative, financial, academic, and portal modules',
      'Create, update, and revoke staff roles & permissions',
      'Configure examination formulas, approve refunds, view audit logs & database backups',
    ],
    restrictions: ['Actions automatically logged in immutable system Audit Log'],
  },
  {
    role: 'SchoolAdmin',
    title: 'School Administrator',
    legacyAliases: ['SchoolAdmin'],
    summary: 'Full operational school management including website content, staff oversight, admissions, students, academics, and reports.',
    capabilities: [
      'Manage staff, students, admissions, website CMS, gallery, and announcements',
      'Review academic results, attendance records, and accounting ledger reports',
    ],
    restrictions: ['Principal Refund Queue sign-off reserved for SuperAdmin / Principal'],
  },
  {
    role: 'HeadTeacher',
    title: 'Head Teacher / Academic Leadership',
    legacyAliases: ['DOS', 'DOD', 'Registrar'],
    summary: 'Academic, examination moderation, attendance, discipline, curriculum, and student enrollment leadership.',
    capabilities: [
      'Approve & publish exam results, manage timetables, subjects, and teacher assignments',
      'Oversee school-wide student & teacher attendance, discipline cases, and promotions',
    ],
    restrictions: ['No direct changes to accounting/staff system permissions unless also SuperAdmin'],
  },
  {
    role: 'Teacher',
    title: 'Class & Subject Teacher',
    legacyAliases: ['Teacher'],
    summary: 'Strictly scoped to assigned classrooms and subjects for instruction, roll-call, CAT/Exam marks, lesson plans, and parent messaging.',
    capabilities: [
      'Manage assigned class roster, attendance (Present/Absent/Late/Excused), CAT & Exam marks',
      'Create lesson plans, upload teaching materials, assign homework & message class parents',
    ],
    restrictions: [
      'Cannot access School Fees & Accounting ledger',
      'Cannot create/modify user roles or inspect unassigned classes',
    ],
  },
  {
    role: 'Accountant',
    title: 'Accountant & School Bursar',
    legacyAliases: ['Finance'],
    summary: 'Financial governance including fee structures, billing, official receipts, ledger auditing, balances, and refund requests.',
    capabilities: [
      'Record tuition, lunch, transport & uniform payments; issue receipts & balance statements',
      'Export financial reports (PDF/Excel) and initiate refund requests for Principal approval',
    ],
    restrictions: ['Cannot edit student exam marks or alter system user permissions'],
  },
  {
    role: 'Parent',
    title: 'Parent / Guardian Portal',
    legacyAliases: ['Parent'],
    summary: 'Authenticated guardian workspace scoped strictly to their linked child(ren).',
    capabilities: [
      'View child academic performance, exam results, attendance history, and fee balances/receipts',
      'Download printable term report cards and message class teachers directly',
    ],
    restrictions: ['Read-only academic/financial records; cannot view other families’ learners'],
  },
  {
    role: 'Student',
    title: 'Enrolled Student Portal',
    legacyAliases: ['Student'],
    summary: 'Personal learner portal scoped strictly to the authenticated student profile.',
    capabilities: [
      'View personal profile & student ID card, class timetable, homework, and learning materials',
      'Check published exam results and school-wide announcements',
    ],
    restrictions: ['Strictly scoped to own record; cannot access classmates’ data or edit grades'],
  },
];
