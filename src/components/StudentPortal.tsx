import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CurrentSessionUser,
  EnrolledStudent,
  AttendanceRecord,
  SchoolAnnouncement,
  DisciplineRecord,
  getAttendanceRecords,
  getAnnouncements,
  getDisciplineRecords,
} from '../services/adminStore';
import {
  getExamMarks,
  getExamConfig,
  getExamSchedules,
  getHomeworkAssignments,
  getHomeworkSubmissions,
  saveHomeworkSubmissions,
  submitStudentHomework,
  gradeStructuredAnswers,
  formatDurationMMSS,
  getLearningMaterials,
  getClassTimetables,
  getAcademicYearsTerms,
  getSchoolSubjects,
  getTeacherAssignments,
  getClassStreams,
  getClassAnnouncements,
  getStudentAchievements,
  getStudentNotifications,
  markStudentNotificationRead,
  markAllStudentNotificationsRead,
  ExamMarkRecord,
  ExamScheduleItem,
  HomeworkAssignment,
  HomeworkSubmission,
  LearningMaterialItem,
  ClassTimetableSlot,
  SchoolSubject,
  TeacherSubjectAssignment,
  ClassStreamItem,
  ClassAnnouncement,
  StudentAchievement,
  StudentNotification,
  syncAllSmsDomains,
} from '../services/smsStore';
import { getCachedProgressLogs, StudentProgressLog } from '../services/firebaseStore';
import { uploadSchoolDocument } from '../services/storageService';
import { getStudentAuthToken, changeStudentOwnPassword } from '../services/authService';
import { getStudentSelfRecord } from '../services/rbac';
import { exportStudentIdCardPDF, exportStudentReportCardPDF } from '../services/reportCardPdf';
import { ACADEMIC_GRADES } from '../data/schoolData';
import {
  LayoutDashboard,
  User,
  BookOpen,
  FileText,
  ClipboardList,
  Award,
  FileSpreadsheet,
  CalendarCheck,
  Clock,
  Megaphone,
  Trophy,
  Bell,
  Settings,
  LogOut,
  Download,
  CreditCard,
  Search,
  CheckCircle2,
  XCircle,
  UploadCloud,
  Lock,
  Printer,
  Menu,
  X,
  Sun,
  Moon,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Timer,
  RotateCcw,
} from 'lucide-react';

interface StudentPortalProps {
  sessionUser: CurrentSessionUser;
  students: EnrolledStudent[];
  onLogout?: () => void;
}

type StudentModuleId =
  | 'dashboard'
  | 'profile'
  | 'subjects'
  | 'materials'
  | 'homework'
  | 'results'
  | 'report-cards'
  | 'attendance'
  | 'timetable'
  | 'announcements'
  | 'achievements'
  | 'notifications'
  | 'settings';

export const StudentPortal: React.FC<StudentPortalProps> = ({ sessionUser, students, onLogout }) => {
  const [activeModule, setActiveModule] = useState<StudentModuleId>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const student = useMemo(() => getStudentSelfRecord(sessionUser, students), [sessionUser, students]);

  // Backend-scoped snapshot overlay (if authenticated via /api/auth/student-login)
  const [serverSnapshot, setServerSnapshot] = useState<{
    student?: EnrolledStudent;
    attendance?: AttendanceRecord[];
    marks?: ExamMarkRecord[];
    examSchedules?: ExamScheduleItem[];
    schedules?: ExamScheduleItem[];
    homework?: HomeworkAssignment[];
    submissions?: HomeworkSubmission[];
    materials?: LearningMaterialItem[];
    timetable?: ClassTimetableSlot[];
    subjects?: SchoolSubject[];
    teacherAssignments?: TeacherSubjectAssignment[];
    classStreams?: ClassStreamItem[];
    classAnnouncements?: ClassAnnouncement[];
    schoolAnnouncements?: SchoolAnnouncement[];
    achievements?: StudentAchievement[];
    notifications?: StudentNotification[];
    discipline?: DisciplineRecord[];
  } | null>(null);

  const academicYears = useMemo(() => getAcademicYearsTerms(), [refreshTick]);
  const currentTermObj = academicYears.find((y) => y.isCurrent) || academicYears[0];
  const [selectedYear, setSelectedYear] = useState<string>(currentTermObj?.academicYear || '2026');
  const [selectedTerm, setSelectedTerm] = useState<string>(currentTermObj?.termName || 'Term 1');

  // Module filters & interactive state
  const [materialSearch, setMaterialSearch] = useState('');
  const [materialSubjectFilter, setMaterialSubjectFilter] = useState('ALL');
  const [materialTypeFilter, setMaterialTypeFilter] = useState('ALL');

  const [homeworkSearch, setHomeworkSearch] = useState('');
  const [homeworkStatusFilter, setHomeworkStatusFilter] = useState<'ALL' | 'Pending' | 'Submitted' | 'Graded'>('ALL');
  const [submittingHwId, setSubmittingHwId] = useState<string | null>(null);
  const [hwAnswerText, setHwAnswerText] = useState('');
  const [hwAttachmentFile, setHwAttachmentFile] = useState<File | null>(null);
  const [isSubmittingHw, setIsSubmittingHw] = useState(false);
  const [hwNotice, setHwNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [expandedMaterialId, setExpandedMaterialId] = useState<string | null>(null);
  const [runnerResponses, setRunnerResponses] = useState<Record<string, string>>({});
  const [runnerSecondsLeft, setRunnerSecondsLeft] = useState<number | null>(null);
  const [runnerTotalSeconds, setRunnerTotalSeconds] = useState<number | null>(null);
  const [latestGradedSubId, setLatestGradedSubId] = useState<string | null>(null);
  const [expandedAttemptsHwId, setExpandedAttemptsHwId] = useState<string | null>(null);

  const runnerResponsesRef = useRef<Record<string, string>>({});
  const hwAnswerTextRef = useRef<string>('');
  const runnerSecondsLeftRef = useRef<number | null>(null);
  const runnerTotalSecondsRef = useRef<number | null>(null);
  const hasAutoSubmittedRef = useRef<boolean>(false);
  const handleSubmitHomeworkRef = useRef<(hw: HomeworkAssignment, isTimeout?: boolean) => void | Promise<void>>(() => {});

  useEffect(() => {
    runnerResponsesRef.current = runnerResponses;
  }, [runnerResponses]);

  useEffect(() => {
    hwAnswerTextRef.current = hwAnswerText;
  }, [hwAnswerText]);

  useEffect(() => {
    runnerSecondsLeftRef.current = runnerSecondsLeft;
  }, [runnerSecondsLeft]);

  useEffect(() => {
    runnerTotalSecondsRef.current = runnerTotalSeconds;
  }, [runnerTotalSeconds]);

  const [attendanceMonthFilter, setAttendanceMonthFilter] = useState<string>('ALL');
  const [timetableDayFilter, setTimetableDayFilter] = useState<string>('ALL');
  const [announcementSearch, setAnnouncementSearch] = useState('');
  const [announcementCategory, setAnnouncementCategory] = useState<'ALL' | 'CLASS' | 'SCHOOL'>('ALL');

  // Password Change state
  const [curPassInput, setCurPassInput] = useState('');
  const [newPassInput, setNewPassInput] = useState('');
  const [confirmPassInput, setConfirmPassInput] = useState('');
  const [passChangeStatus, setPassChangeStatus] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Dark / Light sync with global theme
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      return document.documentElement.classList.contains('dark');
    } catch {
      return false;
    }
  });

  const handleToggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    try {
      localStorage.setItem('mugina_theme_mode', next ? 'dark' : 'light');
      document.documentElement.classList.toggle('dark', next);
      window.dispatchEvent(new CustomEvent('mugina-theme-updated', { detail: next ? 'dark' : 'light' }));
    } catch {
      // ignore
    }
  };

  // Fetch scoped student data from Express RBAC endpoint + listen for store broadcasts
  useEffect(() => {
    const bump = () => setRefreshTick((t) => t + 1);
    window.addEventListener('mugina-sms-updated', bump);
    window.addEventListener('mugina-students-updated', bump);
    window.addEventListener('mugina-attendance-updated', bump);
    window.addEventListener('mugina-discipline-updated', bump);
    window.addEventListener('mugina-announcements-updated', bump);
    syncAllSmsDomains().catch(() => {});
    return () => {
      window.removeEventListener('mugina-sms-updated', bump);
      window.removeEventListener('mugina-students-updated', bump);
      window.removeEventListener('mugina-attendance-updated', bump);
      window.removeEventListener('mugina-discipline-updated', bump);
      window.removeEventListener('mugina-announcements-updated', bump);
    };
  }, []);

  useEffect(() => {
    if (!student?.id) return;
    const token = getStudentAuthToken();
    if (!token) return;
    let active = true;
    fetch(`/api/student/portal-data?studentId=${encodeURIComponent(student.id)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((payload) => {
        if (active && payload?.success) {
          const snapshot = payload.data || payload;
          setServerSnapshot(snapshot);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [student?.id, refreshTick]);

  // Resolved authoritative datasets (merging local stores + server scoped snapshot)
  const effectiveStudent = serverSnapshot?.student ? { ...student, ...serverSnapshot.student } : student;

  const examConfig = useMemo(() => getExamConfig(), [refreshTick]);
  const allMarks = useMemo(
    () => (serverSnapshot?.marks && serverSnapshot.marks.length > 0 ? serverSnapshot.marks : getExamMarks()),
    [serverSnapshot, refreshTick]
  );
  const allAttendance = useMemo(
    () => (serverSnapshot?.attendance && serverSnapshot.attendance.length > 0 ? serverSnapshot.attendance : getAttendanceRecords()),
    [serverSnapshot, refreshTick]
  );
  const allSchedules = useMemo(() => {
    const srvSched = serverSnapshot?.examSchedules || serverSnapshot?.schedules;
    return srvSched && srvSched.length > 0 ? srvSched : getExamSchedules();
  }, [serverSnapshot, refreshTick]);
  const allHomework = useMemo(
    () => (serverSnapshot?.homework && serverSnapshot.homework.length > 0 ? serverSnapshot.homework : getHomeworkAssignments()),
    [serverSnapshot, refreshTick]
  );
  const allSubmissions = useMemo(() => {
    const localSubs = getHomeworkSubmissions();
    const srvSubs = serverSnapshot?.submissions || [];
    const map = new Map<string, HomeworkSubmission>();
    [...srvSubs, ...localSubs].forEach((s) => map.set(s.id, s));
    return Array.from(map.values());
  }, [serverSnapshot, refreshTick]);
  const allMaterials = useMemo(
    () => (serverSnapshot?.materials && serverSnapshot.materials.length > 0 ? serverSnapshot.materials : getLearningMaterials()),
    [serverSnapshot, refreshTick]
  );
  const allTimetable = useMemo(
    () => (serverSnapshot?.timetable && serverSnapshot.timetable.length > 0 ? serverSnapshot.timetable : getClassTimetables()),
    [serverSnapshot, refreshTick]
  );
  const allSubjects = useMemo(
    () => (serverSnapshot?.subjects && serverSnapshot.subjects.length > 0 ? serverSnapshot.subjects : getSchoolSubjects()),
    [serverSnapshot, refreshTick]
  );
  const allTeacherAssignments = useMemo(
    () =>
      serverSnapshot?.teacherAssignments && serverSnapshot.teacherAssignments.length > 0
        ? serverSnapshot.teacherAssignments
        : getTeacherAssignments(),
    [serverSnapshot, refreshTick]
  );
  const allClassStreams = useMemo(
    () => (serverSnapshot?.classStreams && serverSnapshot.classStreams.length > 0 ? serverSnapshot.classStreams : getClassStreams()),
    [serverSnapshot, refreshTick]
  );
  const allClassAnnouncements = useMemo(
    () =>
      serverSnapshot?.classAnnouncements && serverSnapshot.classAnnouncements.length > 0
        ? serverSnapshot.classAnnouncements
        : getClassAnnouncements(),
    [serverSnapshot, refreshTick]
  );
  const allSchoolAnnouncements = useMemo(
    () =>
      serverSnapshot?.schoolAnnouncements && serverSnapshot.schoolAnnouncements.length > 0
        ? serverSnapshot.schoolAnnouncements.filter((a) => a.isActive)
        : getAnnouncements().filter((a) => a.isActive),
    [serverSnapshot, refreshTick]
  );
  const allAchievements = useMemo(() => {
    const localAch = getStudentAchievements();
    const srvAch = serverSnapshot?.achievements || [];
    const map = new Map<string, StudentAchievement>();
    [...srvAch, ...localAch].forEach((a) => map.set(a.id, a));
    return Array.from(map.values());
  }, [serverSnapshot, refreshTick]);
  const allNotifications = useMemo(() => {
    const localNotifs = getStudentNotifications();
    const srvNotifs = serverSnapshot?.notifications || [];
    const map = new Map<string, StudentNotification>();
    [...srvNotifs, ...localNotifs].forEach((n) => map.set(n.id, n));
    return Array.from(map.values()).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }, [serverSnapshot, refreshTick]);
  const allProgressLogs = useMemo(() => getCachedProgressLogs(), [refreshTick]);
  const allDiscipline = useMemo(
    () => (serverSnapshot?.discipline && serverSnapshot.discipline.length > 0 ? serverSnapshot.discipline : getDisciplineRecords()),
    [serverSnapshot, refreshTick]
  );

  // Countdown timer effect for active timed homework/quiz (must stay before early return)
  useEffect(() => {
    if (!submittingHwId || runnerSecondsLeft === null) return;
    if (runnerSecondsLeft <= 0) {
      if (!hasAutoSubmittedRef.current) {
        hasAutoSubmittedRef.current = true;
        const targetHw = allHomework.find((h) => h.id === submittingHwId);
        if (targetHw) {
          void handleSubmitHomeworkRef.current(targetHw, true);
        }
      }
      return;
    }
    const timer = window.setTimeout(() => {
      setRunnerSecondsLeft((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [submittingHwId, runnerSecondsLeft, allHomework]);

  if (!effectiveStudent) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center space-y-3">
        <User className="w-10 h-10 text-blue-900 dark:text-amber-400 mx-auto" />
        <h3 className="text-base font-bold text-slate-900 dark:text-white">Student Record Not Found</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Please verify your Student Registration Number with the School Administration office.
        </p>
      </div>
    );
  }

  const gradeCode = effectiveStudent.gradeCode;
  const gradeName = ACADEMIC_GRADES.find((g) => g.code === gradeCode)?.name || gradeCode;
  const studentStream = effectiveStudent.stream || 'Stream A';

  // Class teacher lookup
  const matchingStream = allClassStreams.find(
    (c) =>
      c.gradeCode === gradeCode &&
      (!effectiveStudent.stream || c.streamName.toLowerCase().includes(effectiveStudent.stream.toLowerCase()))
  ) || allClassStreams.find((c) => c.gradeCode === gradeCode);

  const classTeacherName =
    matchingStream?.classTeacherName ||
    allTeacherAssignments.find((ta) => ta.gradeCode === gradeCode)?.teacherName ||
    'Assigned Faculty Mentor';

  // Student-scoped collections
  const mySubjects = allSubjects.filter(
    (sub) => sub.applicableGrades.includes(gradeCode) || sub.applicableGrades.includes('ALL')
  );

  const myMarksAll = allMarks.filter((m) => m.studentId === effectiveStudent.id);
  const myMarksFiltered = myMarksAll.filter(
    (m) => m.academicYear === selectedYear && m.term === selectedTerm
  );
  const myLatestMarks = myMarksFiltered.length > 0 ? myMarksFiltered : myMarksAll;

  const myUpcomingExams = allSchedules.filter(
    (ex) => ex.gradeCode === gradeCode && ex.status !== 'Completed'
  );

  const myAttendance = allAttendance
    .filter((a) => a.studentId === effectiveStudent.id)
    .sort((a, b) => b.date.localeCompare(a.date));

  const presentCount = myAttendance.filter((a) => a.status === 'Present').length;
  const absentCount = myAttendance.filter((a) => a.status === 'Absent').length;
  const lateCount = myAttendance.filter((a) => a.status === 'Late').length;
  const excusedCount = myAttendance.filter((a) => a.status === 'Excused').length;
  const attendancePct =
    myAttendance.length > 0
      ? Math.round(((presentCount + lateCount) / myAttendance.length) * 100)
      : 100;

  // Monthly attendance summary
  const attendanceMonths = Array.from(new Set(myAttendance.map((a) => a.date.slice(0, 7)))).sort((a, b) =>
    b.localeCompare(a)
  );
  const filteredAttendance =
    attendanceMonthFilter === 'ALL'
      ? myAttendance
      : myAttendance.filter((a) => a.date.startsWith(attendanceMonthFilter));

  // Class rank calculation from allMarks if classmates marks exist
  const classStudentAverages = useMemo(() => {
    const classMarks = allMarks.filter(
      (m) => m.gradeCode === gradeCode && m.academicYear === selectedYear && m.term === selectedTerm
    );
    const byStu = new Map<string, number[]>();
    classMarks.forEach((m) => {
      const list = byStu.get(m.studentId) || [];
      list.push(m.totalPercent);
      byStu.set(m.studentId, list);
    });
    const ranked = Array.from(byStu.entries())
      .map(([sid, scores]) => ({
        studentId: sid,
        avg: scores.reduce((a, b) => a + b, 0) / scores.length,
      }))
      .sort((a, b) => b.avg - a.avg);
    const idx = ranked.findIndex((r) => r.studentId === effectiveStudent.id);
    return {
      rank: idx >= 0 ? idx + 1 : undefined,
      total: ranked.length > 0 ? ranked.length : undefined,
    };
  }, [allMarks, gradeCode, selectedYear, selectedTerm, effectiveStudent.id]);

  const termAvg =
    myLatestMarks.length > 0
      ? Math.round((myLatestMarks.reduce((s, m) => s + m.totalPercent, 0) / myLatestMarks.length) * 10) / 10
      : 0;

  const myHomework = allHomework.filter((h) => h.gradeCode === gradeCode);
  const mySubmissions = allSubmissions.filter((s) => s.studentId === effectiveStudent.id);
  const pendingHomework = myHomework.filter(
    (hw) => hw.status === 'Active' && !mySubmissions.some((s) => s.homeworkId === hw.id)
  );

  const myMaterials = allMaterials.filter((m) => m.gradeCode === gradeCode);
  const myTimetable = allTimetable.filter((t) => t.gradeCode === gradeCode);

  // Merged Announcements (Class + School-wide)
  const myAnnouncementsCombined = useMemo(() => {
    const classItems = allClassAnnouncements
      .filter((ca) => ca.isActive && (ca.gradeCode === 'ALL' || ca.gradeCode === gradeCode))
      .map((ca) => ({
        id: `class-${ca.id}`,
        title: ca.title,
        content: ca.content,
        scope: ca.gradeCode === 'ALL' ? 'School-Wide Notice' : `Class Notice (${ca.gradeCode})`,
        author: `${ca.authorName} (${ca.authorRole})`,
        subject: ca.subjectName,
        date: ca.publishedAt,
        kind: 'CLASS' as const,
      }));
    const schoolItems = allSchoolAnnouncements.map((sa) => ({
      id: `school-${sa.id}`,
      title: sa.title,
      content: sa.content,
      scope: sa.badge || 'School Announcement',
      author: 'School Administration',
      subject: undefined,
      date: sa.publishedAt,
      kind: 'SCHOOL' as const,
    }));
    return [...classItems, ...schoolItems].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [allClassAnnouncements, allSchoolAnnouncements, gradeCode]);

  // Achievements (Dedicated achievements + positive progress logs + merit discipline commendations + auto academic milestones)
  const myDirectAchievements = allAchievements.filter((a) => a.studentId === effectiveStudent.id);
  const myCommendations = allDiscipline.filter(
    (d) =>
      d.studentId === effectiveStudent.id &&
      (d.severity === 'Commendation' || d.incidentType === 'Merit / Exemplary Conduct')
  );
  const myExcellentLogs: StudentProgressLog[] = allProgressLogs.filter(
    (l) => l.studentId === effectiveStudent.id && l.academicPerformance === 'Excellent'
  );

  // Scoped notifications
  const myNotifications = useMemo(() => {
    const direct = allNotifications.filter(
      (n) =>
        n.studentId === effectiveStudent.id ||
        n.studentId === 'ALL' ||
        n.studentId === `GRADE:${gradeCode}` ||
        n.gradeCode === gradeCode
    );
    return direct.map((n) => ({
      ...n,
      readForMe: n.isRead || (n.readByIds || []).includes(effectiveStudent.id),
    }));
  }, [allNotifications, effectiveStudent.id, gradeCode]);

  const unreadNotificationsCount = myNotifications.filter((n) => !n.readForMe).length;

  // Material download handler
  const handleDownloadMaterial = (mat: LearningMaterialItem) => {
    if (mat.fileUrl) {
      const a = document.createElement('a');
      a.href = mat.fileUrl;
      a.download = mat.fileName || `${mat.title.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }
    const content = [
      `MUGINA HOPE PRIMARY & NURSERY ACADEMY`,
      `LEARNING MATERIAL / LESSON NOTES`,
      `==================================================`,
      `Title: ${mat.title}`,
      `Subject: ${mat.subjectName}`,
      `Class: ${mat.gradeCode}`,
      `Category: ${mat.materialType}`,
      `Prepared By: ${mat.uploadedBy}`,
      `Date: ${mat.createdAt}`,
      ``,
      `Summary / Description:`,
      mat.description || 'Review notes covered in class.',
      ...(mat.content
        ? [
            ``,
            `--------------------------------------------------`,
            `TEACHER CLASS NOTES:`,
            mat.content,
          ]
        : []),
    ].join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${mat.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Start timed/structured homework or quiz runner
  const handleStartHomeworkRunner = (hw: HomeworkAssignment) => {
    const attemptsForHw = mySubmissions.filter((s) => s.homeworkId === hw.id);
    const maxAttempts = hw.maxAttempts !== undefined ? hw.maxAttempts : 1;
    const hasQuestions = Boolean(hw.questions && hw.questions.length > 0);
    const isPastWindow = Boolean(hw.availableUntil && Date.now() > Date.parse(hw.availableUntil));
    if (hw.status !== 'Active' || isPastWindow) {
      setHwNotice({ type: 'err', text: 'This assignment or quiz is closed and no longer accepts responses.' });
      return;
    }
    if (maxAttempts > 0 && attemptsForHw.length >= maxAttempts) {
      const allowDraftUpdate = !hasQuestions && maxAttempts === 1 && attemptsForHw[0]?.status === 'Submitted';
      if (!allowDraftUpdate) {
        setHwNotice({ type: 'err', text: `Maximum attempts reached (${attemptsForHw.length}/${maxAttempts}).` });
        return;
      }
    }

    hasAutoSubmittedRef.current = false;
    setHwNotice(null);
    setRunnerResponses({});
    setHwAttachmentFile(null);
    setHwAnswerText(!hasQuestions && maxAttempts === 1 && attemptsForHw[0]?.status === 'Submitted' ? attemptsForHw[0].answerText || '' : '');
    const limitSecs = hw.timeLimitMinutes && hw.timeLimitMinutes > 0 ? Math.round(hw.timeLimitMinutes * 60) : null;
    const endMs = hw.availableUntil ? Date.parse(hw.availableUntil) : NaN;
    const windowSecs = !Number.isNaN(endMs) ? Math.max(0, Math.floor((endMs - Date.now()) / 1000)) : null;
    const effectiveTotalSecs =
      limitSecs !== null && windowSecs !== null
        ? Math.min(limitSecs, windowSecs)
        : limitSecs !== null
        ? limitSecs
        : windowSecs;

    if (effectiveTotalSecs !== null) {
      setRunnerTotalSeconds(limitSecs ?? effectiveTotalSecs);
      setRunnerSecondsLeft(effectiveTotalSecs);
    } else {
      setRunnerTotalSeconds(null);
      setRunnerSecondsLeft(null);
    }
    setSubmittingHwId(hw.id);
  };

  // Homework & Quiz submission handler (supports timed auto-submit, MCQ & closed questions, instant marks + review)
  const handleSubmitHomework = async (hw: HomeworkAssignment, isTimeout = false) => {
    const curResponses = runnerResponsesRef.current;
    const curAnswerText = hwAnswerTextRef.current.trim();
    const hasQuestions = Boolean(hw.questions && hw.questions.length > 0);
    const answeredCount = Object.values(curResponses).filter((v) => String(v || '').trim().length > 0).length;

    if (!isTimeout) {
      if (hasQuestions && answeredCount === 0 && !curAnswerText && !hwAttachmentFile) {
        setHwNotice({ type: 'err', text: 'Please answer at least one question before submitting.' });
        return;
      }
      if (!hasQuestions && !curAnswerText && !hwAttachmentFile) {
        setHwNotice({ type: 'err', text: 'Please type your assignment answer or attach a file before submitting.' });
        return;
      }
    }

    setIsSubmittingHw(true);
    setHwNotice(null);
    try {
      let fileUrl: string | undefined;
      let fileName: string | undefined;
      if (hwAttachmentFile) {
        const uploaded = await uploadSchoolDocument(hwAttachmentFile, `HW_${effectiveStudent.regNumber}_${hw.title}`);
        fileUrl = uploaded.url;
        fileName = uploaded.fileName || hwAttachmentFile.name;
      }

      const limitSecs =
        runnerTotalSecondsRef.current ??
        (hw.timeLimitMinutes && hw.timeLimitMinutes > 0 ? Math.round(hw.timeLimitMinutes * 60) : undefined);
      const remSecs =
        limitSecs !== undefined
          ? isTimeout
            ? 0
            : Math.max(0, runnerSecondsLeftRef.current ?? limitSecs)
          : undefined;
      const spentSecs =
        limitSecs !== undefined && remSecs !== undefined ? Math.max(0, limitSecs - remSecs) : undefined;

      const basePayload = {
        homeworkId: hw.id,
        studentId: effectiveStudent.id,
        regNumber: effectiveStudent.regNumber,
        studentName: effectiveStudent.fullName,
        gradeCode: effectiveStudent.gradeCode,
        stream: studentStream,
        subjectName: hw.subjectName,
        answerText: curAnswerText,
        fileUrl,
        fileName,
        maxMarks: hw.maxMarks,
        timeLimitSeconds: limitSecs,
        timeRemainingSeconds: remSecs,
        timeSpentSeconds: spentSecs,
        timedOut: isTimeout,
      };

      const token = getStudentAuthToken();
      let savedSub: HomeworkSubmission | null = null;

      if (token) {
        const res = await fetch('/api/student/homework-submit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            ...basePayload,
            questionResponses: curResponses,
          }),
        });
        const resData = await res.json().catch(() => null);
        if (!res.ok) {
          setHwNotice({
            type: 'err',
            text: resData?.error || 'Could not record your submission. Please verify attempt limits or due window.',
          });
          setSubmittingHwId(null);
          setRunnerSecondsLeft(null);
          setRunnerTotalSeconds(null);
          return;
        }
        if (resData?.submission) {
          savedSub = resData.submission as HomeworkSubmission;
          const existing = getHomeworkSubmissions();
          saveHomeworkSubmissions([savedSub, ...existing.filter((x) => x.id !== savedSub!.id)]);
        }
      }

      if (!savedSub) {
        if (hasQuestions) {
          const graded = gradeStructuredAnswers(hw, curResponses);
          savedSub = submitStudentHomework({
            ...basePayload,
            maxMarks: graded.maxMarks,
            score: graded.score,
            answers: graded.answers,
            autoGraded: !graded.hasPendingManualGrading,
            status: graded.hasPendingManualGrading ? 'Submitted' : 'Graded',
          });
        } else {
          savedSub = submitStudentHomework(basePayload);
        }
      }

      setSubmittingHwId(null);
      setRunnerSecondsLeft(null);
      setRunnerTotalSeconds(null);
      setRunnerResponses({});
      setHwAnswerText('');
      setHwAttachmentFile(null);
      if (savedSub) {
        setLatestGradedSubId(savedSub.id);
      }

      const timeoutPrefix = isTimeout ? 'Time expired — auto-submitted! ' : '';
      const marksLabel =
        savedSub?.score !== undefined
          ? savedSub.status === 'Graded'
            ? ` Your Score: ${savedSub.score} / ${savedSub.maxMarks || hw.maxMarks}. Review your correct answers below.`
            : ` Auto-graded Score: ${savedSub.score} / ${savedSub.maxMarks || hw.maxMarks} (Open questions pending teacher review). Official answers are shown below.`
          : ` Sent to ${hw.teacherName}.`;
      setHwNotice({
        type: 'ok',
        text: `${timeoutPrefix}"${hw.title}" submitted (Attempt #${savedSub?.attemptNumber || 1}).${marksLabel}`,
      });
      setRefreshTick((t) => t + 1);
    } catch (err: any) {
      setHwNotice({ type: 'err', text: err?.message || 'Unable to upload homework submission.' });
    } finally {
      setIsSubmittingHw(false);
    }
  };

  handleSubmitHomeworkRef.current = handleSubmitHomework;

  // Mark notification(s) read
  const handleMarkRead = (notificationId?: string) => {
    if (notificationId) {
      markStudentNotificationRead(notificationId, effectiveStudent.id);
    } else {
      markAllStudentNotificationsRead(effectiveStudent.id, gradeCode);
    }
    const token = getStudentAuthToken();
    if (token) {
      fetch('/api/student/notifications/read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          studentId: effectiveStudent.id,
          gradeCode,
          notificationId,
          markAll: !notificationId,
        }),
      }).catch(() => {});
    }
    setRefreshTick((t) => t + 1);
  };

  // Password Change Submit
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassChangeStatus(null);
    if (newPassInput.trim() !== confirmPassInput.trim()) {
      setPassChangeStatus({ type: 'err', text: 'New password and confirmation password do not match.' });
      return;
    }
    setIsUpdatingPassword(true);
    try {
      const res = await changeStudentOwnPassword(effectiveStudent.id, curPassInput, newPassInput);
      setPassChangeStatus({ type: res.success ? 'ok' : 'err', text: res.message });
      if (res.success) {
        setCurPassInput('');
        setNewPassInput('');
        setConfirmPassInput('');
      }
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  // Exact 14-item Student Navigation Sidebar (Order 1–14)
  const navItems: Array<{
    id: StudentModuleId | 'logout';
    label: string;
    icon: React.ReactNode;
    badge?: number;
  }> = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4 shrink-0" /> },
    { id: 'profile', label: 'My Profile', icon: <User className="w-4 h-4 shrink-0" /> },
    { id: 'subjects', label: 'My Subjects', icon: <BookOpen className="w-4 h-4 shrink-0" /> },
    { id: 'materials', label: 'Learning Materials', icon: <FileText className="w-4 h-4 shrink-0" /> },
    { id: 'homework', label: 'Homework & Assignments', icon: <ClipboardList className="w-4 h-4 shrink-0" />, badge: pendingHomework.length },
    { id: 'results', label: 'Examination Results', icon: <Award className="w-4 h-4 shrink-0" /> },
    { id: 'report-cards', label: 'My Report Cards', icon: <FileSpreadsheet className="w-4 h-4 shrink-0" /> },
    { id: 'attendance', label: 'My Attendance', icon: <CalendarCheck className="w-4 h-4 shrink-0" /> },
    { id: 'timetable', label: 'My Timetable', icon: <Clock className="w-4 h-4 shrink-0" /> },
    { id: 'announcements', label: 'Announcements', icon: <Megaphone className="w-4 h-4 shrink-0" /> },
    { id: 'achievements', label: 'My Achievements', icon: <Trophy className="w-4 h-4 shrink-0" /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4 shrink-0" />, badge: unreadNotificationsCount },
    { id: 'settings', label: 'Account Settings', icon: <Settings className="w-4 h-4 shrink-0" /> },
    { id: 'logout', label: 'Logout', icon: <LogOut className="w-4 h-4 shrink-0" /> },
  ];

  // Filtered Materials
  const filteredMaterials = myMaterials.filter((m) => {
    const matchSubj = materialSubjectFilter === 'ALL' || m.subjectName === materialSubjectFilter;
    const matchType = materialTypeFilter === 'ALL' || m.materialType === materialTypeFilter;
    const q = materialSearch.trim().toLowerCase();
    const matchSearch =
      !q ||
      m.title.toLowerCase().includes(q) ||
      m.subjectName.toLowerCase().includes(q) ||
      m.description.toLowerCase().includes(q);
    return matchSubj && matchType && matchSearch;
  });

  // Filtered Homework (checks latest attempt per assignment)
  const filteredHomework = myHomework.filter((hw) => {
    const attempts = mySubmissions
      .filter((s) => s.homeworkId === hw.id)
      .sort((a, b) => (b.attemptNumber || 1) - (a.attemptNumber || 1) || Date.parse(b.submittedAt) - Date.parse(a.submittedAt));
    const sub = attempts[0];
    const derivedStatus = sub?.status === 'Graded' ? 'Graded' : sub ? 'Submitted' : 'Pending';
    const matchStatus = homeworkStatusFilter === 'ALL' || derivedStatus === homeworkStatusFilter;
    const q = homeworkSearch.trim().toLowerCase();
    const matchQ =
      !q ||
      hw.title.toLowerCase().includes(q) ||
      hw.subjectName.toLowerCase().includes(q) ||
      hw.instructions.toLowerCase().includes(q);
    return matchStatus && matchQ;
  });

  // Filtered Announcements
  const filteredAnnouncements = myAnnouncementsCombined.filter((ann) => {
    const matchCat = announcementCategory === 'ALL' || ann.kind === announcementCategory;
    const q = announcementSearch.trim().toLowerCase();
    const matchQ =
      !q ||
      ann.title.toLowerCase().includes(q) ||
      ann.content.toLowerCase().includes(q) ||
      ann.author.toLowerCase().includes(q);
    return matchCat && matchQ;
  });

  const handleSelectNav = (id: StudentModuleId | 'logout') => {
    setMobileMenuOpen(false);
    if (id === 'logout') {
      if (onLogout) onLogout();
      return;
    }
    setActiveModule(id);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      {/* Mobile Sidebar Drawer Toggle */}
      <div className="w-full lg:hidden flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          {effectiveStudent.photoUrl ? (
            <img
              src={effectiveStudent.photoUrl}
              alt={effectiveStudent.fullName}
              referrerPolicy="no-referrer"
              className="w-9 h-9 rounded-lg object-cover border border-amber-400 shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-blue-900 text-amber-300 font-bold text-xs flex items-center justify-center shrink-0">
              {effectiveStudent.fullName.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{effectiveStudent.fullName}</p>
            <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
              {effectiveStudent.regNumber} · {gradeCode}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-900 text-white cursor-pointer whitespace-nowrap"
        >
          {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          <span>Menu</span>
        </button>
      </div>

      {/* Left Sidebar Navigation (14 Modules) */}
      <aside
        aria-label="Student Portal Navigation"
        className={`${
          mobileMenuOpen ? 'block' : 'hidden'
        } lg:block w-full lg:w-64 shrink-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs`}
      >
        <div className="p-4 bg-blue-950 text-white border-b border-blue-900">
          <div className="flex items-center gap-3">
            {effectiveStudent.photoUrl ? (
              <img
                src={effectiveStudent.photoUrl}
                alt={effectiveStudent.fullName}
                referrerPolicy="no-referrer"
                className="w-11 h-11 rounded-lg object-cover border-2 border-amber-400 shrink-0"
              />
            ) : (
              <div className="w-11 h-11 rounded-lg bg-blue-900 border border-blue-700 text-amber-300 font-bold text-sm flex items-center justify-center shrink-0">
                {effectiveStudent.fullName.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate">{effectiveStudent.fullName}</p>
              <p className="text-[11px] font-mono text-amber-300 truncate">{effectiveStudent.regNumber}</p>
              <p className="text-[10px] text-blue-200 truncate">
                {gradeName} · {studentStream}
              </p>
            </div>
          </div>
        </div>

        <nav className="p-2 space-y-0.5">
          {navItems.map((item) => {
            const isActive = activeModule === item.id;
            const isLogout = item.id === 'logout';
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectNav(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  isLogout
                    ? 'text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 mt-2 border-t border-slate-100 dark:border-slate-800 pt-3'
                    : isActive
                    ? 'bg-blue-900 text-white'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <span className={isActive ? 'text-amber-300' : ''}>{item.icon}</span>
                  <span className="truncate">{item.label}</span>
                </span>
                {typeof item.badge === 'number' && item.badge > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold tabular-nums ${
                      isActive ? 'bg-amber-400 text-slate-950' : 'bg-blue-100 dark:bg-blue-950 text-blue-900 dark:text-amber-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content Workspace */}
      <main className="flex-1 min-w-0 w-full space-y-6">
        {/* 1. DASHBOARD */}
        {activeModule === 'dashboard' && (
          <div className="space-y-6">
            {/* Welcome Banner */}
            <div className="bg-blue-950 text-white rounded-xl p-5 sm:p-6 border border-blue-900 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                {effectiveStudent.photoUrl ? (
                  <img
                    src={effectiveStudent.photoUrl}
                    alt={effectiveStudent.fullName}
                    referrerPolicy="no-referrer"
                    className="w-16 h-16 rounded-xl object-cover border-2 border-amber-400 shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-blue-900 border border-blue-700 flex items-center justify-center text-xl font-bold text-amber-300 shrink-0">
                    {effectiveStudent.fullName.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 space-y-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                    Welcome back to Mugina Hope Primary School
                  </p>
                  <h2 className="text-xl sm:text-2xl font-bold truncate">{effectiveStudent.fullName}</h2>
                  <p className="text-xs text-blue-100 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-mono">Admission #: {effectiveStudent.regNumber}</span>
                    <span>·</span>
                    <span>
                      {gradeName} ({studentStream})
                    </span>
                    <span>·</span>
                    <span>
                      Academic Year {currentTermObj?.academicYear || '2026'} ({currentTermObj?.termName || 'Term 1'})
                    </span>
                  </p>
                  <p className="text-xs text-emerald-300">
                    Class Teacher: <strong className="text-white">{classTeacherName}</strong>
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => exportStudentIdCardPDF(effectiveStudent)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-lg whitespace-nowrap cursor-pointer"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Student ID Card</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    exportStudentReportCardPDF({
                      student: effectiveStudent,
                      marks: allMarks,
                      examConfig,
                      attendance: myAttendance,
                      academicYear: selectedYear,
                      term: selectedTerm,
                      classRank: classStudentAverages.rank,
                      classTotal: classStudentAverages.total,
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold rounded-lg whitespace-nowrap cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Report Card PDF</span>
                </button>
              </div>
            </div>

            {/* KPI Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Attendance Rate</p>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums mt-1">
                  {attendancePct}%
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                  {presentCount} Present · {absentCount} Absent
                </p>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Latest Term Average</p>
                <p className="text-2xl font-bold text-blue-900 dark:text-amber-400 tabular-nums mt-1">{termAvg}%</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                  Across {myLatestMarks.length} subject(s)
                  {classStudentAverages.rank ? ` · Rank ${classStudentAverages.rank}/${classStudentAverages.total}` : ''}
                </p>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Pending Homework</p>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums mt-1">
                  {pendingHomework.length}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                  {mySubmissions.length} submitted this term
                </p>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Upcoming Exams</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums mt-1">
                  {myUpcomingExams.length}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  For {gradeName}
                </p>
              </div>
            </div>

            {/* Dashboard Grid: Latest Results & Pending Homework */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Latest Examination Results */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Latest Examination Results</h3>
                  <button
                    type="button"
                    onClick={() => setActiveModule('results')}
                    className="text-xs font-semibold text-blue-800 dark:text-amber-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>View All</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                {myLatestMarks.length === 0 ? (
                  <p className="p-6 text-xs text-slate-500 dark:text-slate-400 text-center">
                    No published examination marks recorded for {selectedTerm} ({selectedYear}) yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="py-2.5 px-4 font-semibold">Subject</th>
                          <th className="py-2.5 px-3 font-semibold">CAT</th>
                          <th className="py-2.5 px-3 font-semibold">Exam</th>
                          <th className="py-2.5 px-3 font-semibold">Total</th>
                          <th className="py-2.5 px-3 font-semibold">Grade</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {myLatestMarks.slice(0, 5).map((m) => (
                          <tr key={m.id}>
                            <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-white">{m.subjectName}</td>
                            <td className="py-2.5 px-3 tabular-nums">{m.catScore}</td>
                            <td className="py-2.5 px-3 tabular-nums">{m.examScore}</td>
                            <td className="py-2.5 px-3 font-bold text-blue-900 dark:text-amber-400 tabular-nums">
                              {m.totalPercent}%
                            </td>
                            <td className="py-2.5 px-3 font-bold text-emerald-700 dark:text-emerald-400">{m.gradeLetter}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Pending Homework */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Pending Homework</h3>
                  <button
                    type="button"
                    onClick={() => setActiveModule('homework')}
                    className="text-xs font-semibold text-blue-800 dark:text-amber-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>Open Homework</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="p-4 space-y-3">
                  {pendingHomework.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center">
                      All posted assignments are submitted. Great work!
                    </p>
                  ) : (
                    pendingHomework.slice(0, 4).map((hw) => (
                      <div
                        key={hw.id}
                        className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{hw.title}</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {hw.subjectName} · {hw.teacherName}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveModule('homework');
                            setSubmittingHwId(hw.id);
                          }}
                          className="px-2.5 py-1 bg-blue-900 hover:bg-blue-950 text-white text-[11px] font-semibold rounded whitespace-nowrap cursor-pointer"
                        >
                          Due {hw.dueDate}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Upcoming Exams & Recent Announcements */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Upcoming Examinations</h3>
                  <button
                    type="button"
                    onClick={() => setActiveModule('results')}
                    className="text-xs font-semibold text-blue-800 dark:text-amber-400 hover:underline cursor-pointer"
                  >
                    Exam Schedule
                  </button>
                </div>
                {myUpcomingExams.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">No upcoming exam dates scheduled for {gradeCode}.</p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    {myUpcomingExams.slice(0, 4).map((ex) => (
                      <div key={ex.id} className="py-2.5 flex items-center justify-between gap-2">
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">{ex.subjectName}</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {ex.room} · Invigilator: {ex.invigilator}
                          </p>
                        </div>
                        <div className="text-right font-mono tabular-nums">
                          <p className="font-bold text-blue-900 dark:text-amber-400">{ex.examDate}</p>
                          <p className="text-[11px] text-slate-500">{ex.startTime} ({ex.durationMinutes}m)</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Recent Announcements</h3>
                  <button
                    type="button"
                    onClick={() => setActiveModule('announcements')}
                    className="text-xs font-semibold text-blue-800 dark:text-amber-400 hover:underline cursor-pointer"
                  >
                    All Notices
                  </button>
                </div>
                {myAnnouncementsCombined.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">No announcements posted right now.</p>
                ) : (
                  <div className="space-y-2.5">
                    {myAnnouncementsCombined.slice(0, 3).map((ann) => (
                      <div
                        key={ann.id}
                        className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                      >
                        <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                          <span className="font-semibold text-blue-800 dark:text-amber-400">{ann.scope}</span>
                          <span className="font-mono tabular-nums">{ann.date}</span>
                        </div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">{ann.title}</p>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 line-clamp-2">{ann.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 2. MY PROFILE (READ-ONLY OFFICIAL RECORD) */}
        {activeModule === 'profile' && (
          <div className="space-y-5">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Official Student Profile</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Official student records are read-only. Contact School Administration if a biodata correction is required.
                </p>
              </div>
              <button
                type="button"
                onClick={() => exportStudentIdCardPDF(effectiveStudent)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold rounded-lg cursor-pointer whitespace-nowrap"
              >
                <CreditCard className="w-4 h-4 text-amber-400" />
                <span>Download Official Student ID Card</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3 text-xs">
                <div className="flex items-center gap-4 pb-3 border-b border-slate-100 dark:border-slate-800">
                  {effectiveStudent.photoUrl ? (
                    <img
                      src={effectiveStudent.photoUrl}
                      alt={effectiveStudent.fullName}
                      referrerPolicy="no-referrer"
                      className="w-16 h-16 rounded-xl object-cover border border-slate-200 dark:border-slate-700"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-blue-900 text-amber-300 font-bold text-xl flex items-center justify-center">
                      {effectiveStudent.fullName.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">{effectiveStudent.fullName}</h3>
                    <p className="font-mono text-blue-800 dark:text-amber-400 font-semibold">{effectiveStudent.regNumber}</p>
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">
                      Enrollment Status: {effectiveStudent.status}
                    </p>
                  </div>
                </div>

                {[
                  ['Class & Stream', `${gradeName} (${studentStream})`],
                  ['Class Teacher', classTeacherName],
                  ['Gender', effectiveStudent.gender],
                  ['Date of Birth', effectiveStudent.dob || 'Not recorded'],
                  ['Admission Date', effectiveStudent.admissionDate || effectiveStudent.enrolledAt?.split('T')[0] || '2026'],
                  ['Previous School', effectiveStudent.previousSchool || 'None recorded'],
                ].map(([label, val]) => (
                  <div key={label} className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500 dark:text-slate-400">{label}</span>
                    <span className="font-semibold text-slate-900 dark:text-white text-right">{val}</span>
                  </div>
                ))}
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3 text-xs">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white pb-2 border-b border-slate-100 dark:border-slate-800">
                  Guardian & Portal Access Details
                </h3>
                {[
                  ['Parent / Guardian Name', effectiveStudent.parentName || 'Not recorded'],
                  ['Guardian Phone', effectiveStudent.parentPhone || 'Not recorded'],
                  ['Guardian Email', effectiveStudent.parentEmail || 'Not recorded'],
                  ['Home Address', effectiveStudent.address || 'Mugina Sector, Kamonyi District'],
                  ['Student Portal Username', effectiveStudent.studentUsername || effectiveStudent.regNumber],
                  ['Portal Login Status', effectiveStudent.studentAccountActive === false ? 'Deactivated' : 'Active'],
                ].map(([label, val]) => (
                  <div key={label} className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500 dark:text-slate-400">{label}</span>
                    <span className="font-semibold text-slate-900 dark:text-white text-right font-mono">{val}</span>
                  </div>
                ))}

                <div className="pt-2 flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                  <Lock className="w-3.5 h-3.5 text-blue-800 dark:text-amber-400 shrink-0" />
                  <span>Biodata changes are restricted to School Administration & DOS Registrar.</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. MY SUBJECTS */}
        {activeModule === 'subjects' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  My Subjects — {gradeName} ({studentStream})
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  REB Competency-Based Curriculum subjects and assigned teaching faculty.
                </p>
              </div>
              <span className="text-xs font-bold text-blue-900 dark:text-amber-400 tabular-nums">
                {mySubjects.length} Enrolled Subjects
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {mySubjects.map((sub) => {
                const assignedTeachers = allTeacherAssignments.filter(
                  (ta) => ta.gradeCode === gradeCode && (ta.subjectCode === sub.code || ta.subjectName === sub.name)
                );
                const teacherText =
                  assignedTeachers.length > 0
                    ? assignedTeachers.map((t) => t.teacherName).join(', ')
                    : classTeacherName;
                const matCount = myMaterials.filter((m) => m.subjectName === sub.name).length;
                const hwCount = myHomework.filter((h) => h.subjectName === sub.name).length;

                return (
                  <div
                    key={sub.id}
                    className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] font-bold text-blue-800 dark:text-amber-400">
                          {sub.code}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                          {sub.isCore ? 'Core Subject' : 'Enrichment'} · Max {sub.coefficient}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-1">{sub.name}</h3>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                        Teacher: <strong>{teacherText}</strong>
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          setMaterialSubjectFilter(sub.name);
                          setActiveModule('materials');
                        }}
                        className="px-2.5 py-1.5 text-[11px] font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 hover:border-blue-700 cursor-pointer"
                      >
                        Notes & Files ({matCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setHomeworkSearch(sub.name);
                          setActiveModule('homework');
                        }}
                        className="px-2.5 py-1.5 text-[11px] font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 hover:border-blue-700 cursor-pointer"
                      >
                        Homework ({hwCount})
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 4. LEARNING MATERIALS */}
        {activeModule === 'materials' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Learning Materials & Revision Notes ({gradeCode})
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Access lesson notes, worksheets, PDF guides, and study files shared by your teachers.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search materials..."
                    value={materialSearch}
                    onChange={(e) => setMaterialSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
                <select
                  value={materialSubjectFilter}
                  onChange={(e) => setMaterialSubjectFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white"
                >
                  <option value="ALL">All Subjects</option>
                  {mySubjects.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <select
                  value={materialTypeFilter}
                  onChange={(e) => setMaterialTypeFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white"
                >
                  <option value="ALL">All Formats</option>
                  <option value="Lesson Notes">Lesson Notes</option>
                  <option value="Worksheet">Worksheet</option>
                  <option value="Revision Guide">Revision Guide</option>
                  <option value="Video / Audio Link">Video / Audio Link</option>
                </select>
              </div>
            </div>

            {filteredMaterials.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-8 text-center">
                No learning materials match your current filter for {gradeName}.
              </p>
            ) : (
              <div className="space-y-3">
                {filteredMaterials.map((mat) => {
                  const isExpanded = expandedMaterialId === mat.id;
                  return (
                    <div
                      key={mat.id}
                      className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-[11px]">
                            <span className="font-bold text-blue-900 dark:text-amber-400">{mat.subjectName}</span>
                            <span className="text-slate-400">·</span>
                            <span className="font-semibold text-emerald-700 dark:text-emerald-400">{mat.materialType}</span>
                            <span className="text-slate-400">·</span>
                            <span className="font-mono text-slate-500 tabular-nums">{mat.createdAt}</span>
                          </div>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">{mat.title}</h3>
                          <p className="text-xs text-slate-600 dark:text-slate-300">{mat.description}</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Uploaded by {mat.uploadedBy} {mat.fileName ? `· Attachment: ${mat.fileName}` : ''}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          {mat.content && (
                            <button
                              type="button"
                              onClick={() => setExpandedMaterialId(isExpanded ? null : mat.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-amber-400 rounded-lg hover:bg-blue-50 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
                            >
                              <BookOpen className="w-3.5 h-3.5" />
                              <span>{isExpanded ? 'Hide Notes' : 'Read Class Notes'}</span>
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          )}
                          {mat.fileUrl && (
                            <a
                              href={mat.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Open File</span>
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDownloadMaterial(mat)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-blue-900 hover:bg-blue-950 text-white rounded-lg cursor-pointer whitespace-nowrap"
                          >
                            <Download className="w-3.5 h-3.5 text-amber-400" />
                            <span>{mat.fileUrl ? 'Download' : 'Download Notes'}</span>
                          </button>
                        </div>
                      </div>

                      {isExpanded && mat.content && (
                        <div className="p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                          {mat.content}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 5. HOMEWORK, QUIZZES & ASSIGNMENTS */}
        {activeModule === 'homework' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Homework, Quizzes & Assignments ({gradeCode})
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Complete timed quizzes, answer multiple-choice & closed questions, check marks and official correct answers immediately, and track retakes.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search homework..."
                    value={homeworkSearch}
                    onChange={(e) => setHomeworkSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
                <select
                  value={homeworkStatusFilter}
                  onChange={(e) => setHomeworkStatusFilter(e.target.value as any)}
                  className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="Submitted">Submitted</option>
                  <option value="Graded">Graded</option>
                </select>
              </div>
            </div>

            {hwNotice && (
              <div
                className={`p-3 rounded-lg text-xs font-semibold flex items-center gap-2 border ${
                  hwNotice.type === 'ok'
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                    : 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
                }`}
              >
                {hwNotice.type === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                <span>{hwNotice.text}</span>
              </div>
            )}

            {filteredHomework.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-8 text-center">
                No homework assignments or quizzes match this filter.
              </p>
            ) : (
              <div className="space-y-4">
                {filteredHomework.map((hw) => {
                  const attemptsForHw = mySubmissions
                    .filter((s) => s.homeworkId === hw.id)
                    .sort((a, b) => (b.attemptNumber || 1) - (a.attemptNumber || 1) || Date.parse(b.submittedAt) - Date.parse(a.submittedAt));
                  const sub = attemptsForHw[0];
                  const isOpenForm = submittingHwId === hw.id;
                  const questions = Array.isArray(hw.questions) ? hw.questions : [];
                  const hasQuestions = questions.length > 0;
                  const maxAttempts = hw.maxAttempts !== undefined ? hw.maxAttempts : 1;
                  const isPastCloseWindow = Boolean(hw.availableUntil && Date.now() > Date.parse(hw.availableUntil));
                  const isClosed = hw.status === 'Closed' || isPastCloseWindow;
                  const attemptsRemaining = maxAttempts === 0 ? Infinity : Math.max(0, maxAttempts - attemptsForHw.length);
                  const canDraftUpdate = !hasQuestions && maxAttempts === 1 && sub?.status === 'Submitted';
                  const canStartOrRetake = !isClosed && (attemptsRemaining > 0 || canDraftUpdate);
                  const showAllAttempts = expandedAttemptsHwId === hw.id || latestGradedSubId === sub?.id;

                  return (
                    <div
                      key={hw.id}
                      className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-2 text-[11px]">
                            <span className="font-bold uppercase tracking-wide text-blue-900 dark:text-amber-400">
                              {hw.workType === 'quiz' ? 'Timed Quiz' : 'Homework'}
                            </span>
                            <span className="text-slate-400">·</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200">{hw.subjectName}</span>
                            <span className="text-slate-400">·</span>
                            <span className="text-slate-500 dark:text-slate-400">Teacher: {hw.teacherName}</span>
                            <span className="text-slate-400">·</span>
                            <span className="font-mono text-slate-600 dark:text-slate-300 tabular-nums">Max {hw.maxMarks} Marks</span>
                            {hasQuestions && (
                              <>
                                <span className="text-slate-400">·</span>
                                <span className="font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                                  {questions.length} Question{questions.length === 1 ? '' : 's'}
                                </span>
                              </>
                            )}
                          </div>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">{hw.title}</h3>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          {hw.timeLimitMinutes && hw.timeLimitMinutes > 0 ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-blue-900 dark:text-blue-300 tabular-nums">
                              <Timer className="w-3.5 h-3.5" />
                              {hw.timeLimitMinutes} mins
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">Untimed</span>
                          )}
                          <span className="text-slate-300 dark:text-slate-700">|</span>
                          <span className="text-[11px] font-mono font-semibold text-amber-700 dark:text-amber-400 tabular-nums">
                            Due: {hw.dueDate}
                          </span>
                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                              sub?.status === 'Graded'
                                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                                : sub
                                ? 'bg-blue-100 dark:bg-blue-950 text-blue-900 dark:text-blue-300'
                                : isClosed
                                ? 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                : 'bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300'
                            }`}
                          >
                            {sub?.status === 'Graded' ? 'Graded' : sub ? 'Submitted' : isClosed ? 'Closed' : 'Pending'}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-slate-700 dark:text-slate-300">{hw.instructions}</p>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                        <span>
                          Attempts used: <strong className="text-slate-800 dark:text-slate-200">{attemptsForHw.length}</strong> /{' '}
                          {maxAttempts === 0 ? 'Unlimited' : maxAttempts}
                        </span>
                        {hw.availableUntil && (
                          <span>
                            Window closes: <strong className="text-slate-800 dark:text-slate-200">{new Date(hw.availableUntil).toLocaleString()}</strong>
                          </span>
                        )}
                      </div>

                      {/* Interactive Runner (Timed / MCQ + Closed Questions) */}
                      {isOpenForm && (
                        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border-2 border-blue-900 dark:border-amber-500 space-y-4">
                          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
                            <div>
                              <h4 className="text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-amber-400">
                                {hw.workType === 'quiz' ? 'Active Quiz Session' : 'Active Homework Attempt'} · Attempt #{attemptsForHw.length + (canDraftUpdate ? 0 : 1)}
                              </h4>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                Answer carefully. Marks and official correct answers appear immediately after submission.
                              </p>
                            </div>
                            {runnerSecondsLeft !== null && (
                              <div
                                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono text-sm font-extrabold tabular-nums border ${
                                  runnerSecondsLeft <= 15
                                    ? 'bg-rose-50 dark:bg-rose-950/70 border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300'
                                    : runnerSecondsLeft <= 60
                                    ? 'bg-amber-50 dark:bg-amber-950/70 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300'
                                    : 'bg-blue-50 dark:bg-blue-950/70 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200'
                                }`}
                              >
                                <Timer className="w-4 h-4" />
                                <span>Time Left: {formatDurationMMSS(runnerSecondsLeft)}</span>
                              </div>
                            )}
                          </div>

                          {hasQuestions && (
                            <div className="space-y-3">
                              {questions.map((q, qIdx) => {
                                const curChoice = runnerResponses[q.id] || '';
                                return (
                                  <div
                                    key={q.id}
                                    className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5"
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                                        {qIdx + 1}. {q.prompt}
                                        <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                          {q.type === 'mcq' ? 'Multiple Choice' : q.type === 'open' ? 'Open Question' : 'Closed'}
                                        </span>
                                      </p>
                                      <span className="text-[11px] font-mono font-semibold text-slate-500 dark:text-slate-400 shrink-0 tabular-nums">
                                        {q.marks} mark{q.marks === 1 ? '' : 's'}
                                      </span>
                                    </div>

                                    {q.type === 'mcq' && Array.isArray(q.options) && q.options.length > 0 ? (
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {q.options.map((opt, oIdx) => {
                                          const letter = String.fromCharCode(65 + oIdx);
                                          const selected = curChoice === opt;
                                          return (
                                            <button
                                              key={`${q.id}-opt-${oIdx}`}
                                              type="button"
                                              onClick={() =>
                                                setRunnerResponses((prev) => ({
                                                  ...prev,
                                                  [q.id]: opt,
                                                }))
                                              }
                                              className={`text-left px-3 py-2 rounded-lg text-xs border transition-colors cursor-pointer flex items-center gap-2 ${
                                                selected
                                                  ? 'bg-blue-900 border-blue-900 text-white font-semibold'
                                                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-blue-400'
                                              }`}
                                            >
                                              <span
                                                className={`w-5 h-5 rounded flex items-center justify-center text-[11px] font-bold shrink-0 ${
                                                  selected
                                                    ? 'bg-amber-400 text-blue-950'
                                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                                                }`}
                                              >
                                                {letter}
                                              </span>
                                              <span className="break-words">{opt}</span>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    ) : q.type === 'open' ? (
                                      <div>
                                        <textarea
                                          rows={3}
                                          value={curChoice}
                                          onChange={(e) =>
                                            setRunnerResponses((prev) => ({
                                              ...prev,
                                              [q.id]: e.target.value,
                                            }))
                                          }
                                          placeholder="Write your full open answer here..."
                                          className="w-full text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white"
                                        />
                                      </div>
                                    ) : (
                                      <div>
                                        <input
                                          type="text"
                                          value={curChoice}
                                          onChange={(e) =>
                                            setRunnerResponses((prev) => ({
                                              ...prev,
                                              [q.id]: e.target.value,
                                            }))
                                          }
                                          placeholder="Type your concise exact answer..."
                                          className="w-full text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white"
                                        />
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">
                              {hasQuestions ? 'Additional Notes / Working (Optional)' : 'Written Answer / Notes'}
                            </label>
                            <textarea
                              rows={hasQuestions ? 2 : 3}
                              value={hwAnswerText}
                              onChange={(e) => setHwAnswerText(e.target.value)}
                              placeholder="Write your homework answers or working notes for your teacher..."
                              className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">
                              Attach Completed Worksheet / Document (PDF, Word, Image — Optional)
                            </label>
                            <input
                              type="file"
                              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                              onChange={(e) => setHwAttachmentFile(e.target.files?.[0] || null)}
                              className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg p-2"
                            />
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setSubmittingHwId(null);
                                setRunnerSecondsLeft(null);
                                setRunnerTotalSeconds(null);
                                setRunnerResponses({});
                                setHwAnswerText('');
                                setHwAttachmentFile(null);
                              }}
                              className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={isSubmittingHw}
                              onClick={() => handleSubmitHomework(hw, false)}
                              className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg cursor-pointer disabled:opacity-60"
                            >
                              {isSubmittingHw ? 'Submitting...' : hasQuestions ? 'Submit & View Answers' : 'Confirm & Submit'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Latest Submission + Instant Marks & Correct Answers Review */}
                      {sub && !isOpenForm && (
                        <div className="p-3.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
                          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                            <div className="space-y-0.5">
                              <span className="font-bold text-slate-800 dark:text-slate-100">
                                Attempt #{sub.attemptNumber || attemptsForHw.length} · {new Date(sub.submittedAt).toLocaleString()}
                              </span>
                              <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                                {sub.timeLimitSeconds !== undefined && (
                                  <span>
                                    Time Remaining:{' '}
                                    <strong className={sub.timedOut ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-200'}>
                                      {sub.timedOut ? '00:00 (Time Expired)' : formatDurationMMSS(sub.timeRemainingSeconds)}
                                    </strong>
                                  </span>
                                )}
                                {sub.timeSpentSeconds !== undefined && (
                                  <span>
                                    Time Used: <strong className="text-slate-700 dark:text-slate-200">{formatDurationMMSS(sub.timeSpentSeconds)}</strong>
                                  </span>
                                )}
                              </div>
                            </div>
                            {sub.score !== undefined && (
                              <div className="text-right tabular-nums">
                                <span className="text-sm font-extrabold text-emerald-700 dark:text-emerald-400">
                                  Marks: {sub.score} / {sub.maxMarks || hw.maxMarks}
                                </span>
                                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                  {Math.round(((sub.score || 0) / Math.max(1, sub.maxMarks || hw.maxMarks)) * 100)}%
                                  {sub.status !== 'Graded' ? ' (Open Qs pending review)' : ''}
                                </p>
                              </div>
                            )}
                          </div>

                          {sub.answers && sub.answers.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-[11px] font-bold uppercase tracking-wider text-blue-900 dark:text-amber-400">
                                Marks & Correct Answer Review
                              </p>
                              {sub.answers.map((ans, aIdx) => (
                                <div
                                  key={`${sub.id}-q-${ans.questionId}-${aIdx}`}
                                  className={`p-2.5 rounded-lg border space-y-1 ${
                                    ans.needsManualGrading
                                      ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
                                      : ans.isCorrect
                                      ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
                                      : 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800'
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                                      {ans.needsManualGrading ? (
                                        <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                      ) : ans.isCorrect ? (
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                      ) : (
                                        <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                      )}
                                      <span>
                                        {aIdx + 1}. {ans.prompt}
                                      </span>
                                    </p>
                                    <span className="font-mono font-bold text-[11px] shrink-0 tabular-nums text-slate-700 dark:text-slate-200">
                                      {ans.needsManualGrading ? `Pending / ${ans.maxMarks}` : `${ans.earnedMarks} / ${ans.maxMarks}`}
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pl-5">
                                    <p className="text-slate-700 dark:text-slate-300">
                                      <span className="font-semibold">Your Answer:</span>{' '}
                                      <span
                                        className={
                                          ans.needsManualGrading
                                            ? 'text-slate-900 dark:text-white font-semibold'
                                            : ans.isCorrect
                                            ? 'text-emerald-700 dark:text-emerald-300 font-bold'
                                            : 'text-rose-700 dark:text-rose-300 font-bold'
                                        }
                                      >
                                        {ans.studentAnswer || '(No answer)'}
                                      </span>
                                    </p>
                                    <p className="text-slate-700 dark:text-slate-300">
                                      <span className="font-semibold">
                                        {ans.type === 'open' ? 'Model Correct Answer:' : 'Correct Answer:'}
                                      </span>{' '}
                                      <span className="text-emerald-800 dark:text-emerald-300 font-bold">{ans.correctAnswer}</span>
                                    </p>
                                  </div>
                                  {ans.explanation && (
                                    <p className="text-[11px] text-slate-600 dark:text-slate-300 pl-5">
                                      <strong>Explanation:</strong> {ans.explanation}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {sub.answerText && <p className="text-slate-600 dark:text-slate-300">{sub.answerText}</p>}
                          {sub.fileUrl && (
                            <a
                              href={sub.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-blue-800 dark:text-amber-400 font-semibold hover:underline"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>{sub.fileName || 'View Uploaded Work'}</span>
                            </a>
                          )}
                          {sub.teacherFeedback && (
                            <p className="text-[11px] text-emerald-800 dark:text-emerald-300 pt-1 border-t border-slate-100 dark:border-slate-800">
                              <strong>Teacher Feedback:</strong> {sub.teacherFeedback}
                            </p>
                          )}

                          {attemptsForHw.length > 1 && (
                            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                              <button
                                type="button"
                                onClick={() => setExpandedAttemptsHwId(showAllAttempts ? null : hw.id)}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-900 dark:text-amber-400 cursor-pointer"
                              >
                                {showAllAttempts ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                <span>{showAllAttempts ? 'Hide' : 'View'} Earlier Attempts ({attemptsForHw.length - 1})</span>
                              </button>
                              {showAllAttempts && (
                                <div className="mt-2 space-y-1.5">
                                  {attemptsForHw.slice(1).map((prev) => (
                                    <div
                                      key={prev.id}
                                      className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-950 text-[11px] text-slate-600 dark:text-slate-300 tabular-nums"
                                    >
                                      <span>
                                        Attempt #{prev.attemptNumber || 1} · {new Date(prev.submittedAt).toLocaleString()}
                                      </span>
                                      <span className="font-bold">
                                        {prev.score !== undefined ? `${prev.score} / ${prev.maxMarks || hw.maxMarks}` : prev.status}
                                        {prev.timeRemainingSeconds !== undefined
                                          ? ` · Left ${formatDurationMMSS(prev.timeRemainingSeconds)}`
                                          : ''}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Start / Retake Action Footer */}
                      {!isOpenForm && (
                        <div className="pt-1 flex flex-wrap items-center justify-between gap-2">
                          {canStartOrRetake ? (
                            <button
                              type="button"
                              onClick={() => handleStartHomeworkRunner(hw)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-900 hover:bg-blue-950 text-white text-xs font-semibold rounded-lg cursor-pointer"
                            >
                              {sub ? (
                                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                              ) : (
                                <UploadCloud className="w-3.5 h-3.5 text-amber-400" />
                              )}
                              <span>
                                {canDraftUpdate
                                  ? 'Update Submission'
                                  : sub
                                  ? `Retake ${hw.workType === 'quiz' ? 'Quiz' : 'Homework'} (${maxAttempts === 0 ? 'Unlimited' : `${attemptsRemaining} left`})`
                                  : hw.workType === 'quiz'
                                  ? `Start Timed Quiz${hw.timeLimitMinutes ? ` (${hw.timeLimitMinutes}m)` : ''}`
                                  : 'Start Homework'}
                              </span>
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                              <Lock className="w-3.5 h-3.5" />
                              <span>
                                {isClosed
                                  ? 'This assignment or quiz is closed.'
                                  : `All allowed attempts used (${attemptsForHw.length}/${maxAttempts}).`}
                              </span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 6. EXAMINATION RESULTS (READ-ONLY) */}
        {activeModule === 'results' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Examination & CAT Results
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Official assessment formula: CAT ({examConfig.catWeightPercent}%) + Exam ({examConfig.examWeightPercent}%) · Pass Mark: {examConfig.passMarkPercent}%
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    aria-label="Select academic year"
                    className="px-2.5 py-1.5 text-xs font-semibold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white"
                  >
                    {Array.from(new Set(academicYears.map((y) => y.academicYear))).map((yr) => (
                      <option key={yr} value={yr}>
                        {yr}
                      </option>
                    ))}
                  </select>
                  <select
                    value={selectedTerm}
                    onChange={(e) => setSelectedTerm(e.target.value)}
                    aria-label="Select term"
                    className="px-2.5 py-1.5 text-xs font-semibold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white"
                  >
                    <option value="Term 1">Term 1</option>
                    <option value="Term 2">Term 2</option>
                    <option value="Term 3">Term 3</option>
                  </select>
                </div>
              </div>

              {myMarksFiltered.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 py-6 text-center">
                  No marks recorded for {selectedTerm} ({selectedYear}). Try selecting another term.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[640px]">
                    <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-3 px-4 font-semibold">Subject</th>
                        <th className="py-3 px-3 font-semibold">CAT /{examConfig.catMaxMarks}</th>
                        <th className="py-3 px-3 font-semibold">Exam /{examConfig.examMaxMarks}</th>
                        <th className="py-3 px-3 font-semibold">Total %</th>
                        <th className="py-3 px-3 font-semibold">Grade</th>
                        <th className="py-3 px-3 font-semibold">Remark</th>
                        <th className="py-3 px-4 font-semibold">Teacher Comment</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {myMarksFiltered.map((m) => (
                        <tr key={m.id}>
                          <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">{m.subjectName}</td>
                          <td className="py-3 px-3 tabular-nums">{m.catScore}</td>
                          <td className="py-3 px-3 tabular-nums">{m.examScore}</td>
                          <td className="py-3 px-3 font-bold text-blue-900 dark:text-amber-400 tabular-nums">
                            {m.totalPercent}%
                          </td>
                          <td className="py-3 px-3 font-bold text-emerald-700 dark:text-emerald-400">{m.gradeLetter}</td>
                          <td className="py-3 px-3 text-slate-600 dark:text-slate-300">{m.remark}</td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                            {m.teacherComment || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Upcoming Exam Timetable */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Upcoming Examination Schedule ({gradeCode})
              </h3>
              {myUpcomingExams.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">No upcoming exam dates published.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3 font-semibold">Examination</th>
                        <th className="py-2.5 px-3 font-semibold">Subject</th>
                        <th className="py-2.5 px-3 font-semibold">Date & Time</th>
                        <th className="py-2.5 px-3 font-semibold">Room</th>
                        <th className="py-2.5 px-3 font-semibold">Invigilator</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {myUpcomingExams.map((ex) => (
                        <tr key={ex.id}>
                          <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">{ex.title}</td>
                          <td className="py-2.5 px-3">{ex.subjectName}</td>
                          <td className="py-2.5 px-3 font-mono tabular-nums">
                            {ex.examDate} · {ex.startTime} ({ex.durationMinutes}m)
                          </td>
                          <td className="py-2.5 px-3">{ex.room}</td>
                          <td className="py-2.5 px-3">{ex.invigilator}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 7. MY REPORT CARDS */}
        {activeModule === 'report-cards' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Official Term Report Card</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Preview, print, or download your signed term report card PDF.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="px-2.5 py-1.5 text-xs font-semibold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  {Array.from(new Set(academicYears.map((y) => y.academicYear))).map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedTerm}
                  onChange={(e) => setSelectedTerm(e.target.value)}
                  className="px-2.5 py-1.5 text-xs font-semibold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  <option value="Term 1">Term 1</option>
                  <option value="Term 2">Term 2</option>
                  <option value="Term 3">Term 3</option>
                </select>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-white text-xs font-semibold rounded-lg cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    exportStudentReportCardPDF({
                      student: effectiveStudent,
                      marks: allMarks,
                      examConfig,
                      attendance: myAttendance,
                      academicYear: selectedYear,
                      term: selectedTerm,
                      classRank: classStudentAverages.rank,
                      classTotal: classStudentAverages.total,
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded-lg cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Report Card PDF</span>
                </button>
              </div>
            </div>

            {/* Report Card Sheet Preview */}
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
              <div className="bg-blue-950 text-white p-5 border-b-2 border-amber-400">
                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                  Mugina Hope Primary &amp; Nursery Academy · Kamonyi District, Rwanda
                </p>
                <h3 className="text-lg font-bold mt-0.5">
                  Academic Report Card — {selectedTerm} ({selectedYear})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-blue-100 mt-3 pt-3 border-t border-blue-900">
                  <div>
                    Student: <strong className="text-white">{effectiveStudent.fullName}</strong>
                  </div>
                  <div>
                    Reg #: <strong className="font-mono text-amber-300">{effectiveStudent.regNumber}</strong>
                  </div>
                  <div>
                    Class: <strong className="text-white">{gradeName} ({studentStream})</strong>
                  </div>
                </div>
              </div>

              <div className="p-5 space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3 font-semibold">Subject</th>
                        <th className="py-2.5 px-3 font-semibold">CAT</th>
                        <th className="py-2.5 px-3 font-semibold">Exam</th>
                        <th className="py-2.5 px-3 font-semibold">Total %</th>
                        <th className="py-2.5 px-3 font-semibold">Grade</th>
                        <th className="py-2.5 px-3 font-semibold">Remark & Comment</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {myMarksFiltered.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-slate-500">
                            No published subject marks recorded for {selectedTerm} ({selectedYear}).
                          </td>
                        </tr>
                      ) : (
                        myMarksFiltered.map((m) => (
                          <tr key={m.id}>
                            <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">{m.subjectName}</td>
                            <td className="py-2.5 px-3 tabular-nums">{m.catScore}</td>
                            <td className="py-2.5 px-3 tabular-nums">{m.examScore}</td>
                            <td className="py-2.5 px-3 font-bold text-blue-900 dark:text-amber-400 tabular-nums">
                              {m.totalPercent}%
                            </td>
                            <td className="py-2.5 px-3 font-bold text-emerald-700 dark:text-emerald-400">{m.gradeLetter}</td>
                            <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                              {m.remark} {m.teacherComment ? `— ${m.teacherComment}` : ''}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Overall Term Average</span>
                    <p className="text-lg font-bold text-blue-900 dark:text-amber-400 tabular-nums">
                      {myMarksFiltered.length > 0
                        ? `${(
                            Math.round(
                              (myMarksFiltered.reduce((s, m) => s + m.totalPercent, 0) / myMarksFiltered.length) * 10
                            ) / 10
                          ).toFixed(1)}%`
                        : '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Class Position</span>
                    <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                      {classStudentAverages.rank ? `${classStudentAverages.rank} / ${classStudentAverages.total}` : 'Pending'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Attendance Summary</span>
                    <p className="font-semibold text-slate-900 dark:text-white tabular-nums mt-1">
                      Present: {presentCount} · Late: {lateCount} · Absent: {absentCount}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 8. MY ATTENDANCE (STRICTLY READ-ONLY) */}
        {activeModule === 'attendance' && (
          <div className="space-y-5">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">My Attendance Record</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 inline-flex items-center gap-1.5 mt-0.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Read-only official roll-call log recorded by teachers and school administration.</span>
                </p>
              </div>
              <select
                value={attendanceMonthFilter}
                onChange={(e) => setAttendanceMonthFilter(e.target.value)}
                aria-label="Filter attendance by month"
                className="px-3 py-1.5 text-xs font-semibold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white"
              >
                <option value="ALL">All Months</option>
                {attendanceMonths.map((ym) => (
                  <option key={ym} value={ym}>
                    {ym}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { label: 'Attendance %', value: `${attendancePct}%`, color: 'text-blue-900 dark:text-amber-400' },
                { label: 'Present Days', value: presentCount, color: 'text-emerald-700 dark:text-emerald-400' },
                { label: 'Late Arrivals', value: lateCount, color: 'text-amber-600 dark:text-amber-400' },
                { label: 'Excused', value: excusedCount, color: 'text-sky-700 dark:text-sky-400' },
                { label: 'Absent Days', value: absentCount, color: 'text-rose-700 dark:text-rose-400' },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4"
                >
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{stat.label}</p>
                  <p className={`text-2xl font-bold tabular-nums mt-1 ${stat.color}`}>{stat.value}</p>
                </div>
              ))}
            </div>

            {/* Monthly Attendance Report Summary */}
            {attendanceMonths.length > 0 && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Monthly Attendance Summary</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-2.5 px-4 font-semibold">Month</th>
                        <th className="py-2.5 px-3 font-semibold">Present</th>
                        <th className="py-2.5 px-3 font-semibold">Late</th>
                        <th className="py-2.5 px-3 font-semibold">Excused</th>
                        <th className="py-2.5 px-3 font-semibold">Absent</th>
                        <th className="py-2.5 px-4 font-semibold">Monthly Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {attendanceMonths.map((ym) => {
                        const rows = myAttendance.filter((a) => a.date.startsWith(ym));
                        const p = rows.filter((r) => r.status === 'Present').length;
                        const l = rows.filter((r) => r.status === 'Late').length;
                        const ex = rows.filter((r) => r.status === 'Excused').length;
                        const ab = rows.filter((r) => r.status === 'Absent').length;
                        const pct = rows.length > 0 ? Math.round(((p + l) / rows.length) * 100) : 100;
                        return (
                          <tr key={ym}>
                            <td className="py-2.5 px-4 font-mono font-bold text-slate-900 dark:text-white">{ym}</td>
                            <td className="py-2.5 px-3 tabular-nums text-emerald-700 dark:text-emerald-400 font-semibold">{p}</td>
                            <td className="py-2.5 px-3 tabular-nums text-amber-600 font-semibold">{l}</td>
                            <td className="py-2.5 px-3 tabular-nums text-sky-700 font-semibold">{ex}</td>
                            <td className="py-2.5 px-3 tabular-nums text-rose-700 font-semibold">{ab}</td>
                            <td className="py-2.5 px-4 tabular-nums font-bold text-blue-900 dark:text-amber-400">{pct}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Daily Roll-Call Log */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Daily Roll-Call Log</h3>
              </div>
              {filteredAttendance.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 py-8 text-center">
                  No daily attendance entries recorded yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-2.5 px-4 font-semibold">Date</th>
                        <th className="py-2.5 px-3 font-semibold">Status</th>
                        <th className="py-2.5 px-3 font-semibold">Recorded By</th>
                        <th className="py-2.5 px-4 font-semibold">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredAttendance.map((a) => (
                        <tr key={a.id}>
                          <td className="py-2.5 px-4 font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                            {a.date}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                                a.status === 'Present'
                                  ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                                  : a.status === 'Late'
                                  ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                                  : a.status === 'Excused'
                                  ? 'bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300'
                                  : 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300'
                              }`}
                            >
                              {a.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">{a.markedBy}</td>
                          <td className="py-2.5 px-4 text-slate-500 dark:text-slate-400">{a.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 9. MY TIMETABLE */}
        {activeModule === 'timetable' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Weekly Class Timetable — {gradeName} ({studentStream})
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Official lesson periods, assigned subject teachers, and classrooms.
                </p>
              </div>
              <select
                value={timetableDayFilter}
                onChange={(e) => setTimetableDayFilter(e.target.value)}
                aria-label="Filter timetable by day"
                className="px-3 py-1.5 text-xs font-semibold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white"
              >
                <option value="ALL">Full Week (Mon – Fri)</option>
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            {myTimetable.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-8 text-center">
                No timetable slots configured for {gradeCode} yet.
              </p>
            ) : (
              <div className="space-y-4">
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
                  .filter((d) => timetableDayFilter === 'ALL' || d === timetableDayFilter)
                  .map((day) => {
                    const slots = myTimetable
                      .filter((s) => s.dayOfWeek === day)
                      .sort((a, b) => a.startTime.localeCompare(b.startTime));
                    if (slots.length === 0) return null;
                    return (
                      <div key={day} className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-blue-900 dark:text-amber-400">
                          {day}
                        </div>
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                          {slots.map((slot) => (
                            <div
                              key={slot.id}
                              className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                            >
                              <div>
                                <p className="font-bold text-slate-900 dark:text-white">{slot.subjectName}</p>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                  Teacher: {slot.teacherName} · {slot.room}
                                </p>
                              </div>
                              <span className="font-mono font-semibold text-blue-800 dark:text-amber-400 tabular-nums">
                                {slot.startTime} – {slot.endTime}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* 10. ANNOUNCEMENTS */}
        {activeModule === 'announcements' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  School &amp; Class Announcements
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Official notices from School Administration and your {gradeName} teachers.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search notices..."
                    value={announcementSearch}
                    onChange={(e) => setAnnouncementSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
                <select
                  value={announcementCategory}
                  onChange={(e) => setAnnouncementCategory(e.target.value as any)}
                  className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white"
                >
                  <option value="ALL">All Notices</option>
                  <option value="CLASS">Class Notices ({gradeCode})</option>
                  <option value="SCHOOL">School-Wide</option>
                </select>
              </div>
            </div>

            {filteredAnnouncements.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-8 text-center">
                No announcements match your filter.
              </p>
            ) : (
              <div className="space-y-3">
                {filteredAnnouncements.map((ann) => (
                  <div
                    key={ann.id}
                    className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <span className="font-bold text-blue-900 dark:text-amber-400">
                        {ann.scope} {ann.subject ? `· ${ann.subject}` : ''}
                      </span>
                      <span className="font-mono text-slate-500 tabular-nums">{ann.date}</span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">{ann.title}</h3>
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{ann.content}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Posted by {ann.author}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 11. MY ACHIEVEMENTS */}
        {activeModule === 'achievements' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                My Achievements, Awards &amp; Commendations
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Recognitions earned for academic excellence, leadership, attendance, and good character.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myDirectAchievements.map((ach) => (
                <div
                  key={ach.id}
                  className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-amber-300 dark:border-amber-700 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-amber-700 dark:text-amber-400 inline-flex items-center gap-1">
                      <Trophy className="w-3.5 h-3.5" />
                      <span>{ach.category}</span>
                    </span>
                    <span className="font-mono text-slate-500 tabular-nums">{ach.awardedAt}</span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">{ach.title}</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300">{ach.description}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Awarded by {ach.awardedBy} · {ach.term} ({ach.academicYear})
                  </p>
                </div>
              ))}

              {myCommendations.map((c) => (
                <div
                  key={c.id}
                  className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-emerald-700 dark:text-emerald-400">{c.actionTaken}</span>
                    <span className="font-mono text-slate-500 tabular-nums">{c.date}</span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">{c.incidentType}</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300">{c.incidentDescription}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Recorded by {c.recordedBy}</p>
                </div>
              ))}

              {myExcellentLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-blue-900 dark:text-amber-400">Excellent Subject Progress</span>
                    <span className="font-mono text-slate-500 tabular-nums">{log.date}</span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">{log.subject}</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300">{log.academicNotes}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Commended by {log.teacherName}</p>
                </div>
              ))}
            </div>

            {myDirectAchievements.length === 0 && myCommendations.length === 0 && myExcellentLogs.length === 0 && (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-8 text-center">
                No formal awards or merit certificates recorded yet. Keep working hard!
              </p>
            )}
          </div>
        )}

        {/* 12. NOTIFICATIONS */}
        {activeModule === 'notifications' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Notifications Center ({unreadNotificationsCount} Unread)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Real-time alerts for newly posted homework, learning materials, graded results, and awards.
                </p>
              </div>
              {unreadNotificationsCount > 0 && (
                <button
                  type="button"
                  onClick={() => handleMarkRead()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold rounded-lg cursor-pointer whitespace-nowrap"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>Mark All Read</span>
                </button>
              )}
            </div>

            {myNotifications.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-8 text-center">
                You are all caught up — no notifications right now.
              </p>
            ) : (
              <div className="space-y-2.5">
                {myNotifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      notif.readForMe
                        ? 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800'
                        : 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800'
                    }`}
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="font-bold text-blue-900 dark:text-amber-400">{notif.category}</span>
                        <span className="text-slate-400">·</span>
                        <span className="font-mono text-slate-500 tabular-nums">
                          {new Date(notif.createdAt).toLocaleString()}
                        </span>
                        {!notif.readForMe && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 font-bold text-[10px]">
                            NEW
                          </span>
                        )}
                      </div>
                      <h3 className="text-xs font-bold text-slate-900 dark:text-white">{notif.title}</h3>
                      <p className="text-xs text-slate-600 dark:text-slate-300">{notif.message}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {notif.relatedTab && (
                        <button
                          type="button"
                          onClick={() => setActiveModule(notif.relatedTab as StudentModuleId)}
                          className="px-3 py-1.5 text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white cursor-pointer"
                        >
                          Open
                        </button>
                      )}
                      {!notif.readForMe && (
                        <button
                          type="button"
                          onClick={() => handleMarkRead(notif.id)}
                          className="px-3 py-1.5 text-xs font-bold bg-blue-900 text-white rounded-lg cursor-pointer"
                        >
                          Mark Read
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 13. ACCOUNT SETTINGS */}
        {activeModule === 'settings' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Password Change Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
              <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Change Student Portal Password</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Keep your account private. Changes synchronize immediately with the school authentication server.
                </p>
              </div>

              {passChangeStatus && (
                <div
                  className={`p-3 rounded-lg text-xs font-semibold border ${
                    passChangeStatus.type === 'ok'
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                      : 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
                  }`}
                >
                  {passChangeStatus.text}
                </div>
              )}

              <form onSubmit={handlePasswordChange} className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                    Current Password
                  </label>
                  <input
                    type="password"
                    required
                    value={curPassInput}
                    onChange={(e) => setCurPassInput(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 font-mono text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                    New Password (minimum 6 characters)
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPassInput}
                    onChange={(e) => setNewPassInput(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 font-mono text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassInput}
                    onChange={(e) => setConfirmPassInput(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 font-mono text-slate-900 dark:text-white"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isUpdatingPassword}
                  className="px-4 py-2.5 bg-blue-900 hover:bg-blue-950 text-white font-bold rounded-lg cursor-pointer disabled:opacity-60"
                >
                  {isUpdatingPassword ? 'Updating...' : 'Update Portal Password'}
                </button>
              </form>
            </div>

            {/* Preferences & Account Summary */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
              <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Account &amp; Display Preferences</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Manage your display theme and review your login identity.
                </p>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">Admission Number</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{effectiveStudent.regNumber}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">Username</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {effectiveStudent.studentUsername || effectiveStudent.regNumber}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">Assigned Class</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {gradeName} ({studentStream})
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">Appearance Theme</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Current: {isDark ? 'Dark Mode' : 'Light Mode'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleTheme}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-amber-300 font-semibold cursor-pointer"
                  >
                    {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    <span>{isDark ? 'Switch to Light' : 'Switch to Dark'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
