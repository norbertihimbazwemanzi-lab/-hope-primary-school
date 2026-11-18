import {
  fetchSmsDomainFromSupabase,
  saveSmsDomainToSupabase,
  fetchSmsDomainFromFirebase,
  saveSmsDomainToFirebase,
  SmsTableDomain,
} from './smsSupabase';
import { getCurrentSessionUser, persistToServer } from './adminStore';

// ============================================================================
// DOMAIN INTERFACES (Phases 2, 3, 5, 6, 7, 8, 9)
// ============================================================================

export interface AcademicYearTerm {
  id: string;
  academicYear: string;
  termName: 'Term 1' | 'Term 2' | 'Term 3';
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  status: 'Active' | 'Upcoming' | 'Completed';
}

export interface ClassStreamItem {
  id: string;
  gradeCode: string; // N-BABY .. P6
  gradeName: string;
  level: 'Nursery' | 'Primary';
  streamName: string; // Stream A, Stream B
  roomName: string;
  capacity: number;
  classTeacherId?: string;
  classTeacherName?: string;
}

export interface SchoolSubject {
  id: string;
  code: string;
  name: string;
  level: 'Nursery' | 'Lower Primary' | 'Upper Primary' | 'All Primary' | 'All';
  applicableGrades: string[];
  coefficient: number;
  isCore: boolean;
}

export interface TeacherSubjectAssignment {
  id: string;
  teacherId: string;
  teacherName: string;
  gradeCode: string;
  stream: string;
  subjectCode: string;
  subjectName: string;
  academicYear: string;
}

export interface GradingBand {
  grade: string;
  minPercent: number;
  maxPercent: number;
  remark: string;
}

export interface ExamConfig {
  id: string;
  catWeightPercent: number; // Admin configurable (e.g., 40)
  examWeightPercent: number; // Admin configurable (e.g., 60)
  catMaxMarks: number; // Default 100
  examMaxMarks: number; // Default 100
  passMarkPercent: number; // Default 50
  roundingMode: 'nearest' | 'one_decimal' | 'floor';
  gradingScale: GradingBand[];
  updatedAt?: string;
  updatedBy?: string;
}

export interface ExamScheduleItem {
  id: string;
  title: string;
  academicYear: string;
  term: 'Term 1' | 'Term 2' | 'Term 3';
  gradeCode: string;
  subjectCode: string;
  subjectName: string;
  examDate: string;
  startTime: string;
  durationMinutes: number;
  room: string;
  invigilator: string;
  status: 'Scheduled' | 'In Progress' | 'Completed' | 'Published';
}

export interface ExamMarkRecord {
  id: string;
  academicYear: string;
  term: 'Term 1' | 'Term 2' | 'Term 3';
  studentId: string;
  regNumber: string;
  studentName: string;
  gradeCode: string;
  stream: string;
  subjectCode: string;
  subjectName: string;
  catScore: number; // raw score out of examConfig.catMaxMarks
  examScore: number; // raw score out of examConfig.examMaxMarks
  totalPercent: number; // computed from ExamConfig formula
  gradeLetter: string;
  remark: string;
  teacherComment?: string;
  enteredBy: string;
  enteredById: string;
  status: 'Draft' | 'Submitted' | 'Approved' | 'Published';
  updatedAt: string;
}

export interface LessonPlanRecord {
  id: string;
  teacherId: string;
  teacherName: string;
  gradeCode: string;
  stream: string;
  subjectName: string;
  date: string;
  term: 'Term 1' | 'Term 2' | 'Term 3';
  topic: string;
  objectives: string;
  rebCompetencies: string;
  teachingActivities: string;
  assessmentMethod: string;
  status: 'Planned' | 'Delivered' | 'Reviewed';
  updatedAt: string;
}

export interface LearningMaterialItem {
  id: string;
  title: string;
  gradeCode: string;
  stream?: string;
  subjectName: string;
  materialType: 'Lesson Notes' | 'Worksheet' | 'Revision Guide' | 'Video / Audio Link';
  description: string;
  content?: string;
  fileUrl?: string;
  fileName?: string;
  uploadedBy: string;
  uploadedById: string;
  createdAt: string;
}

export interface QuizQuestion {
  id: string;
  type: 'mcq' | 'closed';
  prompt: string;
  options?: string[];
  correctAnswer: string;
  acceptedAnswers?: string[];
  marks: number;
  explanation?: string;
}

export interface SubmissionQuestionResult {
  questionId: string;
  type: 'mcq' | 'closed';
  prompt: string;
  studentAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  earnedMarks: number;
  maxMarks: number;
  explanation?: string;
}

export interface HomeworkAssignment {
  id: string;
  title: string;
  workType?: 'homework' | 'quiz';
  gradeCode: string;
  stream?: string;
  subjectName: string;
  instructions: string;
  dueDate: string;
  availableUntil?: string;
  timeLimitMinutes?: number;
  maxAttempts?: number; // 0 = unlimited retakes; >=1 = exact allowed attempts
  maxMarks: number;
  questions?: QuizQuestion[];
  teacherId: string;
  teacherName: string;
  status: 'Active' | 'Closed';
  createdAt: string;
}

export interface HomeworkSubmission {
  id: string;
  homeworkId: string;
  studentId: string;
  regNumber: string;
  studentName: string;
  gradeCode: string;
  stream?: string;
  subjectName: string;
  answerText: string;
  fileUrl?: string;
  fileName?: string;
  attemptNumber?: number;
  answers?: SubmissionQuestionResult[];
  timeLimitSeconds?: number;
  timeRemainingSeconds?: number;
  timeSpentSeconds?: number;
  timedOut?: boolean;
  autoGraded?: boolean;
  submittedAt: string;
  status: 'Submitted' | 'Graded';
  score?: number;
  maxMarks?: number;
  teacherFeedback?: string;
  gradedBy?: string;
  gradedAt?: string;
  updatedAt?: string;
}

export interface StudentAchievement {
  id: string;
  studentId: string;
  regNumber: string;
  studentName: string;
  gradeCode: string;
  title: string;
  category: 'Academic Excellence' | 'Leadership' | 'Sports & Culture' | 'Attendance' | 'Conduct & Values';
  description: string;
  term: 'Term 1' | 'Term 2' | 'Term 3';
  academicYear: string;
  awardedBy: string;
  awardedAt: string;
  updatedAt?: string;
}

export interface StudentNotification {
  id: string;
  studentId: string; // specific student ID or 'GRADE:<gradeCode>' or 'ALL'
  gradeCode?: string;
  title: string;
  message: string;
  category: 'Homework' | 'Materials' | 'Results' | 'Attendance' | 'Announcement' | 'Achievement';
  createdAt: string;
  readByIds?: string[]; // supports student-specific read state even for class-wide notifications
  isRead?: boolean;
  relatedTab?: string;
  updatedAt?: string;
}

export interface ClassAnnouncement {
  id: string;
  title: string;
  content: string;
  gradeCode: string; // 'ALL' or specific gradeCode like 'P4'
  stream?: string;
  subjectName?: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  publishedAt: string;
  isActive: boolean;
  updatedAt?: string;
}

export interface ClassTimetableSlot {
  id: string;
  gradeCode: string;
  stream: string;
  dayOfWeek: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday';
  startTime: string;
  endTime: string;
  subjectName: string;
  teacherName: string;
  room: string;
}

export interface ParentTeacherMessage {
  id: string;
  studentId: string;
  studentName: string;
  gradeCode: string;
  parentEmail: string;
  parentName: string;
  teacherId: string;
  teacherName: string;
  senderRole: 'Parent' | 'Teacher' | 'Admin';
  senderName: string;
  subject: string;
  message: string;
  createdAt: string;
  isRead: boolean;
}

export interface ClassFeeStructure {
  id: string;
  gradeCode: string;
  gradeName: string;
  term: 'Term 1' | 'Term 2' | 'Term 3';
  academicYear: string;
  tuitionFee: number;
  lunchFee: number;
  transportFee: number;
  materialsFee: number;
  totalExpected: number;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId?: string;
  summary: string;
}

// ============================================================================
// STORAGE KEYS & EVENT DISPATCH
// ============================================================================

const SMS_STORAGE_KEYS: Record<SmsTableDomain, string> = {
  academic_years_terms: 'mugina_sms_academic_years_v1',
  school_classes_streams: 'mugina_sms_classes_streams_v1',
  school_subjects: 'mugina_sms_subjects_v1',
  teacher_assignments: 'mugina_sms_teacher_assignments_v1',
  exam_config: 'mugina_sms_exam_config_v1',
  exam_schedules: 'mugina_sms_exam_schedules_v1',
  exam_marks: 'mugina_sms_exam_marks_v1',
  lesson_plans: 'mugina_sms_lesson_plans_v1',
  learning_materials: 'mugina_sms_learning_materials_v1',
  homework_assignments: 'mugina_sms_homework_v1',
  homework_submissions: 'mugina_sms_homework_submissions_v1',
  student_achievements: 'mugina_sms_student_achievements_v1',
  student_notifications: 'mugina_sms_student_notifications_v1',
  class_announcements: 'mugina_sms_class_announcements_v1',
  class_timetables: 'mugina_sms_timetables_v1',
  parent_teacher_messages: 'mugina_sms_parent_messages_v1',
  audit_logs: 'mugina_sms_audit_logs_v1',
  fee_structures: 'mugina_sms_fee_structures_v1',
};

const emitSmsUpdate = (domain: SmsTableDomain, items: any) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(`mugina-sms-${domain}`, { detail: items }));
    window.dispatchEvent(new CustomEvent('mugina-sms-updated', { detail: { domain, items } }));
  }
};

function readLocalSms<T>(domain: SmsTableDomain, fallback: T): T {
  try {
    const raw = localStorage.getItem(SMS_STORAGE_KEYS[domain]);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    // ignore storage errors
  }
  return fallback;
}

function writeSmsDomain<T extends { id: string }>(domain: SmsTableDomain, items: T[]): T[] {
  try {
    localStorage.setItem(SMS_STORAGE_KEYS[domain], JSON.stringify(items));
  } catch {
    // ignore storage quota errors
  }
  persistToServer(`/api/sms/${domain}`, { items });
  saveSmsDomainToSupabase(domain, items).catch(() => {});
  saveSmsDomainToFirebase(domain, items).catch(() => {});
  emitSmsUpdate(domain, items);
  return items;
}

// ============================================================================
// DEFAULT AUTHORITATIVE RWANDA REB SEED DATA
// ============================================================================

export const DEFAULT_ACADEMIC_YEARS: AcademicYearTerm[] = [
  { id: 'ay-2026-t1', academicYear: '2026', termName: 'Term 1', startDate: '2026-01-12', endDate: '2026-04-03', isCurrent: true, status: 'Active' },
  { id: 'ay-2026-t2', academicYear: '2026', termName: 'Term 2', startDate: '2026-04-20', endDate: '2026-07-17', isCurrent: false, status: 'Upcoming' },
  { id: 'ay-2026-t3', academicYear: '2026', termName: 'Term 3', startDate: '2026-08-10', endDate: '2026-11-13', isCurrent: false, status: 'Upcoming' },
  { id: 'ay-2025-t3', academicYear: '2025', termName: 'Term 3', startDate: '2025-08-11', endDate: '2025-11-14', isCurrent: false, status: 'Completed' },
];

export const DEFAULT_CLASSES_STREAMS: ClassStreamItem[] = [
  { id: 'cls-nbaby-a', gradeCode: 'N-BABY', gradeName: 'Baby Class', level: 'Nursery', streamName: 'Stream A', roomName: 'Nursery Block 1', capacity: 25, classTeacherName: 'Teacher Vestine' },
  { id: 'cls-nmid-a', gradeCode: 'N-MID', gradeName: 'Middle Class', level: 'Nursery', streamName: 'Stream A', roomName: 'Nursery Block 2', capacity: 25, classTeacherName: 'Teacher Solange' },
  { id: 'cls-ntop-a', gradeCode: 'N-TOP', gradeName: 'Pre-Primary (Top)', level: 'Nursery', streamName: 'Stream A', roomName: 'Nursery Block 3', capacity: 28, classTeacherName: 'Teacher Diane' },
  { id: 'cls-p1-a', gradeCode: 'P1', gradeName: 'Primary 1 (P1)', level: 'Primary', streamName: 'Stream A', roomName: 'Wing A - Room 101', capacity: 35, classTeacherId: 'staff-teacher-2', classTeacherName: 'Jean Paul Habimana' },
  { id: 'cls-p2-a', gradeCode: 'P2', gradeName: 'Primary 2 (P2)', level: 'Primary', streamName: 'Stream A', roomName: 'Wing A - Room 102', capacity: 35, classTeacherName: 'Lower Primary Faculty' },
  { id: 'cls-p3-a', gradeCode: 'P3', gradeName: 'Primary 3 (P3)', level: 'Primary', streamName: 'Stream A', roomName: 'Wing A - Room 103', capacity: 35, classTeacherName: 'Lower Primary Faculty' },
  { id: 'cls-p4-a', gradeCode: 'P4', gradeName: 'Primary 4 (P4)', level: 'Primary', streamName: 'Stream A', roomName: 'Wing B - Room 201', capacity: 36, classTeacherId: 'staff-teacher-1', classTeacherName: 'Marie Claire Uwimana' },
  { id: 'cls-p5-a', gradeCode: 'P5', gradeName: 'Primary 5 (P5)', level: 'Primary', streamName: 'Stream A', roomName: 'Wing B - Room 202', capacity: 36, classTeacherName: 'Upper Primary Faculty' },
  { id: 'cls-p6-a', gradeCode: 'P6', gradeName: 'Primary 6 (P6)', level: 'Primary', streamName: 'Stream A', roomName: 'Wing B - PLE Prep Hall', capacity: 36, classTeacherName: 'Senior Candidate Faculty' },
];

export const DEFAULT_SUBJECTS: SchoolSubject[] = [
  { id: 'sub-math', code: 'MATH', name: 'Mathematics', level: 'All Primary', applicableGrades: ['N-TOP', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6'], coefficient: 100, isCore: true },
  { id: 'sub-eng', code: 'ENG', name: 'English Language & Literacy', level: 'All', applicableGrades: ['N-BABY', 'N-MID', 'N-TOP', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6'], coefficient: 100, isCore: true },
  { id: 'sub-kin', code: 'KIN', name: 'Kinyarwanda', level: 'All', applicableGrades: ['N-BABY', 'N-MID', 'N-TOP', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6'], coefficient: 100, isCore: true },
  { id: 'sub-set', code: 'SET', name: 'Science & Elementary Technology (SET)', level: 'All Primary', applicableGrades: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'], coefficient: 100, isCore: true },
  { id: 'sub-srs', code: 'SRS', name: 'Social & Religious Studies (SRS)', level: 'All Primary', applicableGrades: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'], coefficient: 100, isCore: true },
  { id: 'sub-ict', code: 'ICT', name: 'ICT & Practical Computing', level: 'All Primary', applicableGrades: ['P2', 'P3', 'P4', 'P5', 'P6'], coefficient: 50, isCore: false },
  { id: 'sub-fre', code: 'FRE', name: 'French Language', level: 'Upper Primary', applicableGrades: ['P4', 'P5', 'P6'], coefficient: 50, isCore: false },
  { id: 'sub-art', code: 'CAPE', name: 'Creative Arts, Itorero & P.E.', level: 'All', applicableGrades: ['N-BABY', 'N-MID', 'N-TOP', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6'], coefficient: 50, isCore: false },
];

export const DEFAULT_TEACHER_ASSIGNMENTS: TeacherSubjectAssignment[] = [
  { id: 'ta-1', teacherId: 'staff-teacher-1', teacherName: 'Marie Claire Uwimana', gradeCode: 'P4', stream: 'Stream A', subjectCode: 'MATH', subjectName: 'Mathematics', academicYear: '2026' },
  { id: 'ta-2', teacherId: 'staff-teacher-1', teacherName: 'Marie Claire Uwimana', gradeCode: 'P4', stream: 'Stream A', subjectCode: 'SET', subjectName: 'Science & Elementary Technology (SET)', academicYear: '2026' },
  { id: 'ta-3', teacherId: 'staff-teacher-1', teacherName: 'Marie Claire Uwimana', gradeCode: 'P4', stream: 'Stream A', subjectCode: 'ENG', subjectName: 'English Language & Literacy', academicYear: '2026' },
  { id: 'ta-4', teacherId: 'staff-teacher-2', teacherName: 'Jean Paul Habimana', gradeCode: 'P1', stream: 'Stream A', subjectCode: 'MATH', subjectName: 'Mathematics', academicYear: '2026' },
  { id: 'ta-5', teacherId: 'staff-teacher-2', teacherName: 'Jean Paul Habimana', gradeCode: 'P1', stream: 'Stream A', subjectCode: 'ENG', subjectName: 'English Language & Literacy', academicYear: '2026' },
  { id: 'ta-6', teacherId: 'staff-teacher-2', teacherName: 'Jean Paul Habimana', gradeCode: 'P1', stream: 'Stream A', subjectCode: 'KIN', subjectName: 'Kinyarwanda', academicYear: '2026' },
];

export const DEFAULT_EXAM_CONFIG: ExamConfig = {
  id: 'default-exam-config',
  catWeightPercent: 40,
  examWeightPercent: 60,
  catMaxMarks: 100,
  examMaxMarks: 100,
  passMarkPercent: 50,
  roundingMode: 'one_decimal',
  gradingScale: [
    { grade: 'A', minPercent: 80, maxPercent: 100, remark: 'Distinction / Very Good' },
    { grade: 'B', minPercent: 70, maxPercent: 79.99, remark: 'Credit / Good' },
    { grade: 'C', minPercent: 60, maxPercent: 69.99, remark: 'Merit / Satisfactory' },
    { grade: 'D', minPercent: 50, maxPercent: 59.99, remark: 'Pass / Fair' },
    { grade: 'F', minPercent: 0, maxPercent: 49.99, remark: 'Needs Support' },
  ],
  updatedAt: '2026-01-12T08:00:00.000Z',
  updatedBy: 'School Administration',
};

export const DEFAULT_FEE_STRUCTURES: ClassFeeStructure[] = [
  { id: 'fee-nbaby', gradeCode: 'N-BABY', gradeName: 'Baby Class', term: 'Term 1', academicYear: '2026', tuitionFee: 45000, lunchFee: 25000, transportFee: 0, materialsFee: 10000, totalExpected: 80000 },
  { id: 'fee-nmid', gradeCode: 'N-MID', gradeName: 'Middle Class', term: 'Term 1', academicYear: '2026', tuitionFee: 45000, lunchFee: 25000, transportFee: 0, materialsFee: 10000, totalExpected: 80000 },
  { id: 'fee-ntop', gradeCode: 'N-TOP', gradeName: 'Pre-Primary (Top)', term: 'Term 1', academicYear: '2026', tuitionFee: 50000, lunchFee: 25000, transportFee: 0, materialsFee: 12000, totalExpected: 87000 },
  { id: 'fee-p1', gradeCode: 'P1', gradeName: 'Primary 1 (P1)', term: 'Term 1', academicYear: '2026', tuitionFee: 60000, lunchFee: 25000, transportFee: 0, materialsFee: 7000, totalExpected: 92000 },
  { id: 'fee-p2', gradeCode: 'P2', gradeName: 'Primary 2 (P2)', term: 'Term 1', academicYear: '2026', tuitionFee: 60000, lunchFee: 25000, transportFee: 0, materialsFee: 7000, totalExpected: 92000 },
  { id: 'fee-p3', gradeCode: 'P3', gradeName: 'Primary 3 (P3)', term: 'Term 1', academicYear: '2026', tuitionFee: 60000, lunchFee: 25000, transportFee: 0, materialsFee: 7000, totalExpected: 92000 },
  { id: 'fee-p4', gradeCode: 'P4', gradeName: 'Primary 4 (P4)', term: 'Term 1', academicYear: '2026', tuitionFee: 65000, lunchFee: 25000, transportFee: 0, materialsFee: 7000, totalExpected: 97000 },
  { id: 'fee-p5', gradeCode: 'P5', gradeName: 'Primary 5 (P5)', term: 'Term 1', academicYear: '2026', tuitionFee: 65000, lunchFee: 25000, transportFee: 0, materialsFee: 7000, totalExpected: 97000 },
  { id: 'fee-p6', gradeCode: 'P6', gradeName: 'Primary 6 (P6)', term: 'Term 1', academicYear: '2026', tuitionFee: 70000, lunchFee: 25000, transportFee: 0, materialsFee: 10000, totalExpected: 105000 },
];

export const DEFAULT_EXAM_SCHEDULES: ExamScheduleItem[] = [
  { id: 'ex-1', title: 'Term 1 Mid-Term & Final Assessment - Math', academicYear: '2026', term: 'Term 1', gradeCode: 'P4', subjectCode: 'MATH', subjectName: 'Mathematics', examDate: '2026-03-23', startTime: '08:00', durationMinutes: 90, room: 'Wing B - Room 201', invigilator: 'Marie Claire Uwimana', status: 'Published' },
  { id: 'ex-2', title: 'Term 1 Assessment - Science & Tech', academicYear: '2026', term: 'Term 1', gradeCode: 'P4', subjectCode: 'SET', subjectName: 'Science & Elementary Technology (SET)', examDate: '2026-03-24', startTime: '08:00', durationMinutes: 90, room: 'Wing B - Room 201', invigilator: 'Marie Claire Uwimana', status: 'Published' },
  { id: 'ex-3', title: 'Term 1 Literacy Exam - English', academicYear: '2026', term: 'Term 1', gradeCode: 'P4', subjectCode: 'ENG', subjectName: 'English Language & Literacy', examDate: '2026-03-25', startTime: '08:00', durationMinutes: 90, room: 'Wing B - Room 201', invigilator: 'Jean Damascene Murwanashyaka', status: 'Published' },
  { id: 'ex-4', title: 'Term 1 Numeracy Exam - P1', academicYear: '2026', term: 'Term 1', gradeCode: 'P1', subjectCode: 'MATH', subjectName: 'Mathematics', examDate: '2026-03-23', startTime: '08:30', durationMinutes: 60, room: 'Wing A - Room 101', invigilator: 'Jean Paul Habimana', status: 'Published' },
];

export const DEFAULT_EXAM_MARKS: ExamMarkRecord[] = [
  { id: 'mk-1', academicYear: '2026', term: 'Term 1', studentId: 'stu-1', regNumber: 'MHA-2026-001', studentName: 'Keza Aline Manzi', gradeCode: 'P4', stream: 'Stream A', subjectCode: 'MATH', subjectName: 'Mathematics', catScore: 88, examScore: 92, totalPercent: 90.4, gradeLetter: 'A', remark: 'Distinction / Very Good', teacherComment: 'Excellent problem-solving accuracy.', enteredBy: 'Marie Claire Uwimana', enteredById: 'staff-teacher-1', status: 'Published', updatedAt: '2026-03-28T10:00:00.000Z' },
  { id: 'mk-2', academicYear: '2026', term: 'Term 1', studentId: 'stu-1', regNumber: 'MHA-2026-001', studentName: 'Keza Aline Manzi', gradeCode: 'P4', stream: 'Stream A', subjectCode: 'SET', subjectName: 'Science & Elementary Technology (SET)', catScore: 84, examScore: 86, totalPercent: 85.2, gradeLetter: 'A', remark: 'Distinction / Very Good', teacherComment: 'Strong lab curiosity.', enteredBy: 'Marie Claire Uwimana', enteredById: 'staff-teacher-1', status: 'Published', updatedAt: '2026-03-28T10:05:00.000Z' },
  { id: 'mk-3', academicYear: '2026', term: 'Term 1', studentId: 'stu-1', regNumber: 'MHA-2026-001', studentName: 'Keza Aline Manzi', gradeCode: 'P4', stream: 'Stream A', subjectCode: 'ENG', subjectName: 'English Language & Literacy', catScore: 80, examScore: 85, totalPercent: 83.0, gradeLetter: 'A', remark: 'Distinction / Very Good', teacherComment: 'Fluent reading & comprehension.', enteredBy: 'Marie Claire Uwimana', enteredById: 'staff-teacher-1', status: 'Published', updatedAt: '2026-03-28T10:10:00.000Z' },
  { id: 'mk-4', academicYear: '2026', term: 'Term 1', studentId: 'stu-2', regNumber: 'MHA-2026-002', studentName: 'Gasana Eric Ntwari', gradeCode: 'P4', stream: 'Stream A', subjectCode: 'MATH', subjectName: 'Mathematics', catScore: 74, examScore: 78, totalPercent: 76.4, gradeLetter: 'B', remark: 'Credit / Good', teacherComment: 'Consistent effort.', enteredBy: 'Marie Claire Uwimana', enteredById: 'staff-teacher-1', status: 'Published', updatedAt: '2026-03-28T10:15:00.000Z' },
  { id: 'mk-5', academicYear: '2026', term: 'Term 1', studentId: 'stu-3', regNumber: 'MHA-2026-003', studentName: 'Ingabire Divine', gradeCode: 'P4', stream: 'Stream A', subjectCode: 'MATH', subjectName: 'Mathematics', catScore: 82, examScore: 88, totalPercent: 85.6, gradeLetter: 'A', remark: 'Distinction / Very Good', enteredBy: 'Marie Claire Uwimana', enteredById: 'staff-teacher-1', status: 'Published', updatedAt: '2026-03-28T10:20:00.000Z' },
  { id: 'mk-6', academicYear: '2026', term: 'Term 1', studentId: 'stu-4', regNumber: 'MHA-2026-004', studentName: 'Mugisha Christian', gradeCode: 'P4', stream: 'Stream A', subjectCode: 'MATH', subjectName: 'Mathematics', catScore: 62, examScore: 68, totalPercent: 65.6, gradeLetter: 'C', remark: 'Merit / Satisfactory', enteredBy: 'Marie Claire Uwimana', enteredById: 'staff-teacher-1', status: 'Published', updatedAt: '2026-03-28T10:25:00.000Z' },
  { id: 'mk-7', academicYear: '2026', term: 'Term 1', studentId: 'stu-5', regNumber: 'MHA-2026-005', studentName: 'Umutoni Grace', gradeCode: 'P1', stream: 'Stream A', subjectCode: 'MATH', subjectName: 'Mathematics', catScore: 85, examScore: 90, totalPercent: 88.0, gradeLetter: 'A', remark: 'Distinction / Very Good', enteredBy: 'Jean Paul Habimana', enteredById: 'staff-teacher-2', status: 'Published', updatedAt: '2026-03-28T10:30:00.000Z' },
];

export const DEFAULT_TIMETABLES: ClassTimetableSlot[] = [
  { id: 'tt-1', gradeCode: 'P4', stream: 'Stream A', dayOfWeek: 'Monday', startTime: '07:30', endTime: '08:30', subjectName: 'Mathematics', teacherName: 'Marie Claire Uwimana', room: 'Wing B - 201' },
  { id: 'tt-2', gradeCode: 'P4', stream: 'Stream A', dayOfWeek: 'Monday', startTime: '08:30', endTime: '09:30', subjectName: 'English Language & Literacy', teacherName: 'Marie Claire Uwimana', room: 'Wing B - 201' },
  { id: 'tt-3', gradeCode: 'P4', stream: 'Stream A', dayOfWeek: 'Tuesday', startTime: '07:30', endTime: '08:30', subjectName: 'Science & Elementary Technology (SET)', teacherName: 'Marie Claire Uwimana', room: 'Science Corner' },
  { id: 'tt-4', gradeCode: 'P4', stream: 'Stream A', dayOfWeek: 'Wednesday', startTime: '10:45', endTime: '11:45', subjectName: 'ICT & Practical Computing', teacherName: 'Marie Claire Uwimana', room: 'ICT Lab' },
  { id: 'tt-5', gradeCode: 'P4', stream: 'Stream A', dayOfWeek: 'Thursday', startTime: '08:30', endTime: '09:30', subjectName: 'Social & Religious Studies (SRS)', teacherName: 'Jean Damascene Murwanashyaka', room: 'Wing B - 201' },
  { id: 'tt-6', gradeCode: 'P4', stream: 'Stream A', dayOfWeek: 'Friday', startTime: '15:30', endTime: '16:30', subjectName: 'Creative Arts, Itorero & P.E.', teacherName: 'Patrick Niyitegeka', room: 'School Courtyard' },
  { id: 'tt-7', gradeCode: 'P1', stream: 'Stream A', dayOfWeek: 'Monday', startTime: '07:30', endTime: '08:30', subjectName: 'Kinyarwanda Phonics', teacherName: 'Jean Paul Habimana', room: 'Wing A - 101' },
  { id: 'tt-8', gradeCode: 'P1', stream: 'Stream A', dayOfWeek: 'Tuesday', startTime: '08:30', endTime: '09:30', subjectName: 'Mathematics', teacherName: 'Jean Paul Habimana', room: 'Wing A - 101' },
];

export const DEFAULT_LESSON_PLANS: LessonPlanRecord[] = [
  {
    id: 'lp-1',
    teacherId: 'staff-teacher-1',
    teacherName: 'Marie Claire Uwimana',
    gradeCode: 'P4',
    stream: 'Stream A',
    subjectName: 'Mathematics',
    date: new Date().toISOString().split('T')[0],
    term: 'Term 1',
    topic: 'Fractions, Decimals & Word Problem Applications',
    objectives: 'Learners will convert simple fractions to decimals and solve 2-step market word problems.',
    rebCompetencies: 'Critical thinking, numeracy fluency, cooperative group calculation.',
    teachingActivities: 'Visual fraction strips, paired board exercises, 10-minute exit quiz.',
    assessmentMethod: 'Continuous observation + 5-item written exercise',
    status: 'Delivered',
    updatedAt: new Date().toISOString(),
  },
];

export const DEFAULT_LEARNING_MATERIALS: LearningMaterialItem[] = [
  {
    id: 'mat-1',
    title: 'P4 Mathematics Unit 3: Fractions & Decimals Revision Notes',
    gradeCode: 'P4',
    stream: 'Stream A',
    subjectName: 'Mathematics',
    materialType: 'Revision Guide',
    description: 'Step-by-step worked examples aligned with REB Competency-Based Curriculum.',
    uploadedBy: 'Marie Claire Uwimana',
    uploadedById: 'staff-teacher-1',
    createdAt: '2026-02-10',
  },
  {
    id: 'mat-2',
    title: 'P1 Kinyarwanda & English Reading Phonics Booklet',
    gradeCode: 'P1',
    stream: 'Stream A',
    subjectName: 'English Language & Literacy',
    materialType: 'Lesson Notes',
    description: 'Home reading practice sheets for parents and P1 pupils.',
    uploadedBy: 'Jean Paul Habimana',
    uploadedById: 'staff-teacher-2',
    createdAt: '2026-02-12',
  },
];

export const DEFAULT_HOMEWORK: HomeworkAssignment[] = [
  {
    id: 'hw-1',
    title: 'Fractions Practice Set #4 (Questions 1–10)',
    gradeCode: 'P4',
    stream: 'Stream A',
    subjectName: 'Mathematics',
    instructions: 'Complete exercises on page 42 of your Mathematics workbook. Show all working steps neatly.',
    dueDate: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
    maxMarks: 20,
    teacherId: 'staff-teacher-1',
    teacherName: 'Marie Claire Uwimana',
    status: 'Active',
    createdAt: new Date().toISOString().split('T')[0],
  },
];

export const DEFAULT_STUDENT_ACHIEVEMENTS: StudentAchievement[] = [
  {
    id: 'ach-1',
    studentId: 'stu-1',
    regNumber: 'MHA-2026-001',
    studentName: 'Keza Aline Manzi',
    gradeCode: 'P4',
    title: 'Term 1 Mathematics Top Problem Solver',
    category: 'Academic Excellence',
    description: 'Recognized for achieving above 90% in Mathematics continuous assessment and helping classmates in group work.',
    term: 'Term 1',
    academicYear: '2026',
    awardedBy: 'Marie Claire Uwimana',
    awardedAt: '2026-03-15',
  },
  {
    id: 'ach-2',
    studentId: 'stu-5',
    regNumber: 'MHA-2026-005',
    studentName: 'Umutoni Grace',
    gradeCode: 'P1',
    title: 'Reading Phonics Star Reader',
    category: 'Academic Excellence',
    description: 'Awarded for fluent Kinyarwanda and English reading aloud during morning assembly.',
    term: 'Term 1',
    academicYear: '2026',
    awardedBy: 'Jean Paul Habimana',
    awardedAt: '2026-03-10',
  },
];

export const DEFAULT_CLASS_ANNOUNCEMENTS: ClassAnnouncement[] = [
  {
    id: 'cann-1',
    title: 'P4 Mathematics & Science Practical Kit Reminder',
    content: 'Please bring your geometry ruler set and clean science notebook every Tuesday and Thursday morning.',
    gradeCode: 'P4',
    stream: 'Stream A',
    subjectName: 'Mathematics',
    authorId: 'staff-teacher-1',
    authorName: 'Marie Claire Uwimana',
    authorRole: 'Teacher',
    publishedAt: new Date().toISOString().split('T')[0],
    isActive: true,
  },
];

// ============================================================================
// CONFIGURABLE EXAM & CAT CALCULATION ENGINE (No Hardcoded Rigid Formula)
// ============================================================================

export function calculateExamResult(
  catScore: number,
  examScore: number,
  config: ExamConfig = getExamConfig()
): { totalPercent: number; gradeLetter: string; remark: string } {
  const catMax = Math.max(1, Number(config.catMaxMarks) || 100);
  const examMax = Math.max(1, Number(config.examMaxMarks) || 100);
  const catWeight = Number(config.catWeightPercent) || 0;
  const examWeight = Number(config.examWeightPercent) || 0;
  const totalWeight = Math.max(1, catWeight + examWeight);

  const normCat = Math.min(100, Math.max(0, (Number(catScore) || 0) / catMax * 100));
  const normExam = Math.min(100, Math.max(0, (Number(examScore) || 0) / examMax * 100));

  const rawTotal = ((normCat * catWeight) + (normExam * examWeight)) / totalWeight;

  let totalPercent = rawTotal;
  if (config.roundingMode === 'nearest') totalPercent = Math.round(rawTotal);
  else if (config.roundingMode === 'floor') totalPercent = Math.floor(rawTotal);
  else totalPercent = Math.round(rawTotal * 10) / 10;

  const sortedScale = [...(config.gradingScale || DEFAULT_EXAM_CONFIG.gradingScale)].sort(
    (a, b) => b.minPercent - a.minPercent
  );
  const band = sortedScale.find((b) => totalPercent >= b.minPercent) || sortedScale[sortedScale.length - 1];

  return {
    totalPercent,
    gradeLetter: band?.grade || 'F',
    remark: band?.remark || (totalPercent >= config.passMarkPercent ? 'Pass' : 'Needs Support'),
  };
}

// ============================================================================
// PUBLIC GETTERS & MUTATIONS
// ============================================================================

export const getAcademicYearsTerms = (): AcademicYearTerm[] =>
  readLocalSms('academic_years_terms', DEFAULT_ACADEMIC_YEARS);

export const saveAcademicYearsTerms = (items: AcademicYearTerm[]): AcademicYearTerm[] => {
  logAuditEvent('UPDATE', 'AcademicYearTerm', undefined, `Updated academic years/terms (${items.length} entries)`);
  return writeSmsDomain('academic_years_terms', items);
};

export const getClassStreams = (): ClassStreamItem[] =>
  readLocalSms('school_classes_streams', DEFAULT_CLASSES_STREAMS);

export const saveClassStreams = (items: ClassStreamItem[]): ClassStreamItem[] => {
  logAuditEvent('UPDATE', 'ClassStream', undefined, `Updated classes & streams (${items.length} classes)`);
  return writeSmsDomain('school_classes_streams', items);
};

export const getSchoolSubjects = (): SchoolSubject[] =>
  readLocalSms('school_subjects', DEFAULT_SUBJECTS);

export const saveSchoolSubjects = (items: SchoolSubject[]): SchoolSubject[] => {
  logAuditEvent('UPDATE', 'Subject', undefined, `Updated school subjects (${items.length} subjects)`);
  return writeSmsDomain('school_subjects', items);
};

export const getTeacherAssignments = (): TeacherSubjectAssignment[] =>
  readLocalSms('teacher_assignments', DEFAULT_TEACHER_ASSIGNMENTS);

export const saveTeacherAssignments = (items: TeacherSubjectAssignment[]): TeacherSubjectAssignment[] => {
  logAuditEvent('UPDATE', 'TeacherAssignment', undefined, `Updated teacher-subject assignments (${items.length})`);
  return writeSmsDomain('teacher_assignments', items);
};

export const getExamConfig = (): ExamConfig => {
  const list = readLocalSms<ExamConfig[]>('exam_config', [DEFAULT_EXAM_CONFIG]);
  return Array.isArray(list) && list.length > 0 ? list[0] : DEFAULT_EXAM_CONFIG;
};

export const saveExamConfig = (cfg: ExamConfig): ExamConfig => {
  const user = getCurrentSessionUser();
  const stamped: ExamConfig = {
    ...cfg,
    id: cfg.id || 'default-exam-config',
    updatedAt: new Date().toISOString(),
    updatedBy: user?.name || 'Administrator',
  };
  writeSmsDomain('exam_config', [stamped]);

  // Dynamically recalculate existing exam marks whenever the admin updates the calculation rule
  const currentMarks = getExamMarks();
  if (currentMarks.length > 0) {
    const recalculated = currentMarks.map((m) => {
      const calc = calculateExamResult(m.catScore, m.examScore, stamped);
      return { ...m, ...calc, updatedAt: new Date().toISOString() };
    });
    writeSmsDomain('exam_marks', recalculated);
  }
  logAuditEvent(
    'CONFIGURE',
    'ExamConfig',
    stamped.id,
    `Updated Exam Formula: CAT ${stamped.catWeightPercent}% / Exam ${stamped.examWeightPercent}% (Pass ${stamped.passMarkPercent}%)`
  );
  return stamped;
};

export const getExamSchedules = (): ExamScheduleItem[] =>
  readLocalSms('exam_schedules', DEFAULT_EXAM_SCHEDULES);

export const saveExamSchedules = (items: ExamScheduleItem[]): ExamScheduleItem[] => {
  logAuditEvent('UPDATE', 'ExamSchedule', undefined, `Updated examination schedule (${items.length} exams)`);
  return writeSmsDomain('exam_schedules', items);
};

export const getExamMarks = (): ExamMarkRecord[] =>
  readLocalSms('exam_marks', DEFAULT_EXAM_MARKS);

export const saveExamMarks = (items: ExamMarkRecord[]): ExamMarkRecord[] => {
  logAuditEvent('UPDATE', 'ExamMarks', undefined, `Saved examination marks batch (${items.length} total records)`);
  return writeSmsDomain('exam_marks', items);
};

export const upsertExamMark = (
  input: Omit<ExamMarkRecord, 'id' | 'totalPercent' | 'gradeLetter' | 'remark' | 'updatedAt'> & { id?: string }
): ExamMarkRecord => {
  const cfg = getExamConfig();
  const calc = calculateExamResult(input.catScore, input.examScore, cfg);
  const current = getExamMarks();
  const matchIdx = current.findIndex(
    (m) =>
      (input.id && m.id === input.id) ||
      (m.studentId === input.studentId &&
        m.subjectCode === input.subjectCode &&
        m.term === input.term &&
        m.academicYear === input.academicYear)
  );
  const record: ExamMarkRecord = {
    ...input,
    id: matchIdx >= 0 ? current[matchIdx].id : input.id || `mk-${Date.now()}-${Math.floor(Math.random() * 999)}`,
    totalPercent: calc.totalPercent,
    gradeLetter: calc.gradeLetter,
    remark: calc.remark,
    updatedAt: new Date().toISOString(),
  };
  const updated = matchIdx >= 0 ? current.map((m, i) => (i === matchIdx ? record : m)) : [record, ...current];
  writeSmsDomain('exam_marks', updated);
  logAuditEvent(
    'MARK_ENTRY',
    'ExamMark',
    record.id,
    `${record.enteredBy} saved ${record.subjectCode} marks for ${record.studentName} (${record.term} ${record.academicYear}): ${record.totalPercent}% (${record.gradeLetter})`
  );
  return record;
};

export const getLessonPlans = (): LessonPlanRecord[] =>
  readLocalSms('lesson_plans', DEFAULT_LESSON_PLANS);

export const saveLessonPlans = (items: LessonPlanRecord[]): LessonPlanRecord[] =>
  writeSmsDomain('lesson_plans', items);

export const getLearningMaterials = (): LearningMaterialItem[] =>
  readLocalSms('learning_materials', DEFAULT_LEARNING_MATERIALS);

export const saveLearningMaterials = (items: LearningMaterialItem[]): LearningMaterialItem[] =>
  writeSmsDomain('learning_materials', items);

export const getHomeworkAssignments = (): HomeworkAssignment[] =>
  readLocalSms('homework_assignments', DEFAULT_HOMEWORK);

export const saveHomeworkAssignments = (items: HomeworkAssignment[]): HomeworkAssignment[] =>
  writeSmsDomain('homework_assignments', items);

export const getHomeworkSubmissions = (): HomeworkSubmission[] =>
  readLocalSms('homework_submissions', []);

export const saveHomeworkSubmissions = (items: HomeworkSubmission[]): HomeworkSubmission[] =>
  writeSmsDomain('homework_submissions', items);

export const normalizeAnswerValue = (val: string): string =>
  String(val || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

export const formatDurationMMSS = (seconds?: number | null): string => {
  if (seconds === undefined || seconds === null || Number.isNaN(seconds)) return '—';
  const clamped = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

export const gradeStructuredAnswers = (
  hw: HomeworkAssignment,
  studentResponses: Record<string, string>
): { score: number; maxMarks: number; answers: SubmissionQuestionResult[] } => {
  const questions = Array.isArray(hw.questions) ? hw.questions : [];
  let totalScore = 0;
  let totalMax = 0;
  const answers: SubmissionQuestionResult[] = questions.map((q) => {
    const qMax = Math.max(1, Number(q.marks) || 1);
    totalMax += qMax;
    const rawResp = String(studentResponses[q.id] || '').trim();
    const normResp = normalizeAnswerValue(rawResp);
    const acceptedList = [
      q.correctAnswer,
      ...(Array.isArray(q.acceptedAnswers) ? q.acceptedAnswers : []),
    ]
      .map(normalizeAnswerValue)
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
  return {
    score: totalScore,
    maxMarks: totalMax > 0 ? totalMax : hw.maxMarks,
    answers,
  };
};

export const submitStudentHomework = (
  input: Omit<HomeworkSubmission, 'id' | 'submittedAt' | 'status' | 'updatedAt'> & {
    status?: 'Submitted' | 'Graded';
  }
): HomeworkSubmission => {
  const current = getHomeworkSubmissions();
  const priorAttempts = current.filter(
    (s) => s.homeworkId === input.homeworkId && s.studentId === input.studentId
  );
  const assignments = getHomeworkAssignments();
  const hw = assignments.find((h) => h.id === input.homeworkId);
  const hasStructuredQuestions = Boolean(hw?.questions && hw.questions.length > 0);
  const allowRetakeHistory = hasStructuredQuestions || (hw?.maxAttempts !== undefined && hw.maxAttempts !== 1);
  const existingEditableIdx =
    !allowRetakeHistory
      ? current.findIndex((s) => s.homeworkId === input.homeworkId && s.studentId === input.studentId)
      : -1;

  const now = new Date().toISOString();
  const attemptNumber =
    input.attemptNumber ||
    (existingEditableIdx >= 0
      ? current[existingEditableIdx].attemptNumber || 1
      : priorAttempts.length + 1);

  const isAutoGraded = Boolean(input.autoGraded || (input.answers && input.answers.length > 0));
  const record: HomeworkSubmission = {
    ...input,
    id:
      existingEditableIdx >= 0
        ? current[existingEditableIdx].id
        : `hwsub-${Date.now()}-${Math.floor(Math.random() * 999)}`,
    attemptNumber,
    submittedAt: now,
    status: isAutoGraded ? 'Graded' : input.status || 'Submitted',
    gradedBy: isAutoGraded ? 'Auto-Graded' : input.gradedBy,
    gradedAt: isAutoGraded ? now : input.gradedAt,
    updatedAt: now,
  };
  const next =
    existingEditableIdx >= 0
      ? current.map((s, i) => (i === existingEditableIdx ? record : s))
      : [record, ...current];
  writeSmsDomain('homework_submissions', next);
  logAuditEvent(
    'SUBMIT_HOMEWORK',
    'HomeworkSubmission',
    record.id,
    `${record.studentName} (${record.regNumber}) submitted ${record.subjectName} (Attempt #${attemptNumber})`
  );
  return record;
};

export const gradeHomeworkSubmission = (
  submissionId: string,
  score: number,
  teacherFeedback: string,
  gradedBy: string
): HomeworkSubmission[] => {
  const current = getHomeworkSubmissions();
  const now = new Date().toISOString();
  let gradedItem: HomeworkSubmission | null = null;
  const next = current.map((s) => {
    if (s.id !== submissionId) return s;
    gradedItem = {
      ...s,
      score,
      teacherFeedback,
      gradedBy,
      gradedAt: now,
      status: 'Graded',
      updatedAt: now,
    };
    return gradedItem;
  });
  writeSmsDomain('homework_submissions', next);
  if (gradedItem) {
    const g = gradedItem as HomeworkSubmission;
    pushStudentNotification({
      studentId: g.studentId,
      gradeCode: g.gradeCode,
      title: `Homework Graded: ${g.subjectName}`,
      message: `Your submission was graded ${score}${g.maxMarks ? `/${g.maxMarks}` : ''}. Feedback: ${teacherFeedback || 'Good effort.'}`,
      category: 'Homework',
      relatedTab: 'homework',
    });
    logAuditEvent('GRADE_HOMEWORK', 'HomeworkSubmission', g.id, `${gradedBy} graded ${g.studentName} homework (${score})`);
  }
  return next;
};

export const getStudentAchievements = (): StudentAchievement[] =>
  readLocalSms('student_achievements', DEFAULT_STUDENT_ACHIEVEMENTS);

export const saveStudentAchievements = (items: StudentAchievement[]): StudentAchievement[] =>
  writeSmsDomain('student_achievements', items);

export const addStudentAchievement = (
  input: Omit<StudentAchievement, 'id' | 'awardedAt' | 'updatedAt'>
): StudentAchievement => {
  const current = getStudentAchievements();
  const record: StudentAchievement = {
    ...input,
    id: `ach-${Date.now()}-${Math.floor(Math.random() * 999)}`,
    awardedAt: new Date().toISOString().split('T')[0],
    updatedAt: new Date().toISOString(),
  };
  writeSmsDomain('student_achievements', [record, ...current]);
  pushStudentNotification({
    studentId: record.studentId,
    gradeCode: record.gradeCode,
    title: `New Achievement Awarded: ${record.title}`,
    message: `${record.awardedBy} awarded you a ${record.category} recognition.`,
    category: 'Achievement',
    relatedTab: 'achievements',
  });
  logAuditEvent('AWARD_ACHIEVEMENT', 'StudentAchievement', record.id, `${record.awardedBy} awarded "${record.title}" to ${record.studentName}`);
  return record;
};

export const getStudentNotifications = (): StudentNotification[] =>
  readLocalSms('student_notifications', []);

export const saveStudentNotifications = (items: StudentNotification[]): StudentNotification[] =>
  writeSmsDomain('student_notifications', items);

export const pushStudentNotification = (
  input: Omit<StudentNotification, 'id' | 'createdAt' | 'readByIds' | 'isRead' | 'updatedAt'>
): StudentNotification => {
  const current = getStudentNotifications();
  const item: StudentNotification = {
    ...input,
    id: `notif-${Date.now()}-${Math.floor(Math.random() * 999)}`,
    createdAt: new Date().toISOString(),
    readByIds: [],
    isRead: false,
    updatedAt: new Date().toISOString(),
  };
  writeSmsDomain('student_notifications', [item, ...current].slice(0, 300));
  return item;
};

export const markStudentNotificationRead = (notificationId: string, studentId: string): StudentNotification[] => {
  const current = getStudentNotifications();
  const next = current.map((n) => {
    if (n.id !== notificationId) return n;
    const readByIds = Array.from(new Set([...(n.readByIds || []), studentId]));
    return { ...n, readByIds, isRead: n.studentId === studentId ? true : n.isRead, updatedAt: new Date().toISOString() };
  });
  return writeSmsDomain('student_notifications', next);
};

export const markAllStudentNotificationsRead = (studentId: string, gradeCode: string): StudentNotification[] => {
  const current = getStudentNotifications();
  const next = current.map((n) => {
    const applies =
      n.studentId === studentId ||
      n.studentId === 'ALL' ||
      n.studentId === `GRADE:${gradeCode}` ||
      n.gradeCode === gradeCode;
    if (!applies) return n;
    const readByIds = Array.from(new Set([...(n.readByIds || []), studentId]));
    return { ...n, readByIds, isRead: n.studentId === studentId ? true : n.isRead, updatedAt: new Date().toISOString() };
  });
  return writeSmsDomain('student_notifications', next);
};

export const getClassAnnouncements = (): ClassAnnouncement[] =>
  readLocalSms('class_announcements', DEFAULT_CLASS_ANNOUNCEMENTS);

export const saveClassAnnouncements = (items: ClassAnnouncement[]): ClassAnnouncement[] =>
  writeSmsDomain('class_announcements', items);

export const getClassTimetables = (): ClassTimetableSlot[] =>
  readLocalSms('class_timetables', DEFAULT_TIMETABLES);

export const saveClassTimetables = (items: ClassTimetableSlot[]): ClassTimetableSlot[] =>
  writeSmsDomain('class_timetables', items);

export const getParentTeacherMessages = (): ParentTeacherMessage[] =>
  readLocalSms('parent_teacher_messages', []);

export const sendParentTeacherMessage = (
  msg: Omit<ParentTeacherMessage, 'id' | 'createdAt' | 'isRead'>
): ParentTeacherMessage => {
  const current = getParentTeacherMessages();
  const next: ParentTeacherMessage = {
    ...msg,
    id: `ptm-${Date.now()}-${Math.floor(Math.random() * 999)}`,
    createdAt: new Date().toISOString(),
    isRead: false,
  };
  writeSmsDomain('parent_teacher_messages', [next, ...current]);
  logAuditEvent('MESSAGE', 'ParentTeacherMessage', next.id, `${next.senderName} (${next.senderRole}) sent message regarding ${next.studentName}`);
  return next;
};

export const markParentMessageRead = (id: string): ParentTeacherMessage[] => {
  const current = getParentTeacherMessages();
  const updated = current.map((m) => (m.id === id ? { ...m, isRead: true } : m));
  return writeSmsDomain('parent_teacher_messages', updated);
};

export const getFeeStructures = (): ClassFeeStructure[] =>
  readLocalSms('fee_structures', DEFAULT_FEE_STRUCTURES);

export const saveFeeStructures = (items: ClassFeeStructure[]): ClassFeeStructure[] => {
  logAuditEvent('UPDATE', 'FeeStructure', undefined, `Updated term fee structure (${items.length} grade entries)`);
  return writeSmsDomain('fee_structures', items);
};

export const getAuditLogs = (): AuditLogEntry[] =>
  readLocalSms('audit_logs', []);

export const logAuditEvent = (
  action: string,
  entityType: string,
  entityId: string | undefined,
  summary: string
): void => {
  try {
    const user = getCurrentSessionUser();
    const current = getAuditLogs();
    const entry: AuditLogEntry = {
      id: `aud-${Date.now()}-${Math.floor(Math.random() * 999)}`,
      timestamp: new Date().toISOString(),
      actorId: user?.id || 'system',
      actorName: user?.name || 'System Process',
      actorRole: user?.role || 'System',
      action,
      entityType,
      entityId,
      summary,
    };
    const trimmed = [entry, ...current].slice(0, 400);
    localStorage.setItem(SMS_STORAGE_KEYS.audit_logs, JSON.stringify(trimmed));
    persistToServer('/api/sms/audit_logs', { items: trimmed });
    saveSmsDomainToSupabase('audit_logs', trimmed.slice(0, 60)).catch(() => {});
    emitSmsUpdate('audit_logs', trimmed);
  } catch {
    // non-blocking audit log
  }
};

// ============================================================================
// CROSS-DEVICE SYNC FOR ALL SMS DOMAINS
// ============================================================================

const ALL_SMS_DOMAINS: SmsTableDomain[] = [
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
];

export const syncAllSmsDomains = async (): Promise<void> => {
  await Promise.allSettled(
    ALL_SMS_DOMAINS.map(async (domain) => {
      try {
        const [sbItems, fbItems, serverRes] = await Promise.all([
          fetchSmsDomainFromSupabase(domain),
          fetchSmsDomainFromFirebase(domain),
          fetch(`/api/sms/${domain}`)
            .then(async (r) => (r.ok ? (await r.json()).items : null))
            .catch(() => null),
        ]);
        const authoritative =
          (Array.isArray(sbItems) && sbItems.length > 0 && sbItems) ||
          (Array.isArray(fbItems) && fbItems.length > 0 && fbItems) ||
          (Array.isArray(serverRes) && serverRes.length > 0 && serverRes) ||
          null;
        if (authoritative) {
          localStorage.setItem(SMS_STORAGE_KEYS[domain], JSON.stringify(authoritative));
          emitSmsUpdate(domain, authoritative);
        }
      } catch {
        // retain local cache
      }
    })
  );
};
