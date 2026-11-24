import React, { useState, useMemo, useEffect } from 'react';
import {
  EnrolledStudent,
  getCurrentSessionUser,
  setCurrentSessionUser,
  updateStaffMember,
  getAnnouncements,
} from '../services/adminStore';
import {
  LessonPlanRecord,
  LearningMaterialItem,
  HomeworkAssignment,
  HomeworkSubmission,
  QuizQuestion,
  StudentAchievement,
  ClassAnnouncement,
  getTeacherAssignments,
  getLessonPlans,
  saveLessonPlans,
  getLearningMaterials,
  saveLearningMaterials,
  getHomeworkAssignments,
  saveHomeworkAssignments,
  getHomeworkSubmissions,
  gradeHomeworkSubmission,
  formatDurationMMSS,
  getStudentAchievements,
  addStudentAchievement,
  getClassAnnouncements,
  saveClassAnnouncements,
  pushStudentNotification,
  getClassTimetables,
  getParentTeacherMessages,
  sendParentTeacherMessage,
  getExamMarks,
} from '../services/smsStore';
import { getStaffAuthToken } from '../services/authService';
import { extractGradesFromAssignment } from '../services/rbac';
import { ACADEMIC_GRADES } from '../data/schoolData';
import { StudentProgressLogModule } from './StudentProgressLogModule';
import { ExaminationsModule } from './ExaminationsModule';
import { StudentIdAndProfileModal } from './StudentIdAndProfileModal';
import { uploadSchoolAsset, uploadSchoolDocument } from '../services/storageService';
import {
  GraduationCap,
  Users,
  Search,
  Phone,
  Mail,
  FileSpreadsheet,
  ClipboardList,
  BookOpen,
  Award,
  FileText,
  Clock,
  MessageSquare,
  Bell,
  Plus,
  Trash2,
  Send,
  User,
  CheckCircle2,
  BarChart3,
  Camera,
  Download,
  Timer,
  RotateCcw,
  Lock,
  Unlock,
  Edit3,
  Eye,
} from 'lucide-react';

interface TeacherPortalProps {
  students: EnrolledStudent[];
  onTakeAttendance: (gradeCode: string) => void;
}

type TeacherSubTab =
  | 'dashboard'
  | 'roster'
  | 'exams'
  | 'lesson_plans'
  | 'materials'
  | 'homework'
  | 'progress_log'
  | 'timetable'
  | 'reports'
  | 'messages'
  | 'announcements'
  | 'profile';

export const TeacherPortal: React.FC<TeacherPortalProps> = ({ students, onTakeAttendance }) => {
  const sessionUser = getCurrentSessionUser();
  const [activeSubTab, setActiveSubTab] = useState<TeacherSubTab>('dashboard');
  const [selectedStudentForProgress, setSelectedStudentForProgress] = useState<EnrolledStudent | null>(null);
  const [selectedStudentModal, setSelectedStudentModal] = useState<EnrolledStudent | null>(null);

  const teacherAssignments = useMemo(() => getTeacherAssignments(), []);

  // Determine assigned grades strictly from TeacherSubjectAssignment + Staff assignedSubjectOrGrade
  const assignedGrades = useMemo(() => {
    const matchedFromMatrix = teacherAssignments
      .filter(
        (a) =>
          (sessionUser?.id && a.teacherId === sessionUser.id) ||
          (sessionUser?.name && a.teacherName.toLowerCase() === sessionUser.name.toLowerCase())
      )
      .map((a) => a.gradeCode);
    const matchedFromProfile = extractGradesFromAssignment(sessionUser?.assignedSubjectOrGrade);
    const combined = Array.from(new Set([...matchedFromMatrix, ...matchedFromProfile]));
    return combined.length > 0 ? combined : ['P1', 'P4'];
  }, [teacherAssignments, sessionUser]);

  const [activeGrade, setActiveGrade] = useState<string>(assignedGrades[0] || 'P1');
  const [searchQuery, setSearchQuery] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  // Domain states
  const [lessonPlans, setLessonPlans] = useState<LessonPlanRecord[]>(() => getLessonPlans());
  const [materials, setMaterials] = useState<LearningMaterialItem[]>(() => getLearningMaterials());
  const [homework, setHomework] = useState<HomeworkAssignment[]>(() => getHomeworkAssignments());
  const [submissions, setSubmissions] = useState<HomeworkSubmission[]>(() => getHomeworkSubmissions());
  const [achievements, setAchievements] = useState<StudentAchievement[]>(() => getStudentAchievements());
  const [classAnnouncements, setClassAnnouncements] = useState<ClassAnnouncement[]>(() => getClassAnnouncements());
  const [messages, setMessages] = useState(() => getParentTeacherMessages());
  const [timetables] = useState(() => getClassTimetables());
  const [examMarks] = useState(() => getExamMarks());
  const [announcements] = useState(() => getAnnouncements().filter((a) => a.isActive));

  useEffect(() => {
    const sync = () => {
      setLessonPlans(getLessonPlans());
      setMaterials(getLearningMaterials());
      setHomework(getHomeworkAssignments());
      setSubmissions(getHomeworkSubmissions());
      setAchievements(getStudentAchievements());
      setClassAnnouncements(getClassAnnouncements());
      setMessages(getParentTeacherMessages());
    };
    window.addEventListener('mugina-sms-updated', sync);
    return () => window.removeEventListener('mugina-sms-updated', sync);
  }, []);

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3500);
  };

  // Class Students scoped to teacher's selected assigned grade
  const classStudents = useMemo(
    () => students.filter((s) => s.gradeCode === activeGrade),
    [students, activeGrade]
  );

  const filteredClassStudents = useMemo(() => {
    if (!searchQuery.trim()) return classStudents;
    const q = searchQuery.toLowerCase();
    return classStudents.filter(
      (s) =>
        s.fullName.toLowerCase().includes(q) ||
        s.regNumber.toLowerCase().includes(q) ||
        s.parentName.toLowerCase().includes(q)
    );
  }, [classStudents, searchQuery]);

  const classStats = useMemo(() => {
    const total = classStudents.length;
    const boys = classStudents.filter((s) => s.gender === 'Male').length;
    const girls = classStudents.filter((s) => s.gender === 'Female').length;
    return { total, boys, girls };
  }, [classStudents]);

  // Forms for Lesson Plans, Materials, Homework, Parent Messaging
  const [lpForm, setLpForm] = useState({
    subjectName: 'Mathematics',
    date: new Date().toISOString().split('T')[0],
    topic: '',
    objectives: '',
    rebCompetencies: '',
    teachingActivities: '',
    assessmentMethod: 'Written class exercise',
  });

  const [matForm, setMatForm] = useState({
    id: '',
    title: '',
    subjectName: 'Mathematics',
    materialType: 'Lesson Notes' as LearningMaterialItem['materialType'],
    description: '',
    content: '',
    fileUrl: '',
    fileName: '',
  });
  const [uploadingMat, setUploadingMat] = useState(false);

  const [hwForm, setHwForm] = useState({
    title: '',
    workType: 'homework' as 'homework' | 'quiz',
    subjectName: 'Mathematics',
    instructions: '',
    dueDate: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
    availableUntil: '',
    timeLimitMinutes: 20,
    maxAttempts: 2,
    maxMarks: 20,
  });
  const [hwQuestions, setHwQuestions] = useState<QuizQuestion[]>([]);
  const [questionDraft, setQuestionDraft] = useState<{
    type: 'mcq' | 'closed';
    prompt: string;
    options: string[];
    correctOptionIdx: number;
    closedCorrectAnswer: string;
    acceptedVariants: string;
    marks: number;
    explanation: string;
  }>({
    type: 'mcq',
    prompt: '',
    options: ['', '', '', ''],
    correctOptionIdx: 0,
    closedCorrectAnswer: '',
    acceptedVariants: '',
    marks: 2,
    explanation: '',
  });
  const [hwFilterAssignmentId, setHwFilterAssignmentId] = useState<string>('ALL');
  const [expandedSubAnswersId, setExpandedSubAnswersId] = useState<string | null>(null);

  // Teacher Self Profile State
  const [profileForm, setProfileForm] = useState({
    name: sessionUser?.name || '',
    email: sessionUser?.email || '',
    phone: sessionUser?.phone || '',
    photoUrl: sessionUser?.photoUrl || '',
    bio: sessionUser?.bio || '',
    assignedSubjectOrGrade: sessionUser?.assignedSubjectOrGrade || '',
  });
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const [gradingDrafts, setGradingDrafts] = useState<Record<string, { score: string; feedback: string }>>({});
  const [classAnnForm, setClassAnnForm] = useState({ title: '', subjectName: 'General Class', content: '' });
  const [achForm, setAchForm] = useState({
    studentId: '',
    title: '',
    category: 'Academic Excellence' as StudentAchievement['category'],
    description: '',
  });

  const [msgStudentId, setMsgStudentId] = useState(classStudents[0]?.id || '');
  const [msgSubject, setMsgSubject] = useState('');
  const [msgBody, setMsgBody] = useState('');

  const handleAddLessonPlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lpForm.topic.trim()) return;
    const item: LessonPlanRecord = {
      id: `lp-${Date.now()}`,
      teacherId: sessionUser?.id || 'teacher',
      teacherName: sessionUser?.name || 'Teacher',
      gradeCode: activeGrade,
      stream: 'Stream A',
      subjectName: lpForm.subjectName,
      date: lpForm.date,
      term: 'Term 1',
      topic: lpForm.topic.trim(),
      objectives: lpForm.objectives.trim(),
      rebCompetencies: lpForm.rebCompetencies.trim(),
      teachingActivities: lpForm.teachingActivities.trim(),
      assessmentMethod: lpForm.assessmentMethod.trim(),
      status: 'Planned',
      updatedAt: new Date().toISOString(),
    };
    const next = saveLessonPlans([item, ...lessonPlans]);
    setLessonPlans(next);
    setLpForm({ ...lpForm, topic: '', objectives: '', teachingActivities: '' });
    flash(`Saved lesson plan "${item.topic}" for ${activeGrade}.`);
  };

  const handleUploadMaterialFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingMat(true);
    try {
      const isImage = file.type.startsWith('image/');
      const res = isImage
        ? await uploadSchoolAsset(file, matForm.title || file.name, 'teaching_material')
        : await uploadSchoolDocument(file, matForm.title || file.name);
      if (res.url) {
        setMatForm((prev) => ({ ...prev, fileUrl: res.url, fileName: res.fileName || file.name }));
      }
    } finally {
      setUploadingMat(false);
    }
  };

  const handleAddMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!matForm.title.trim()) return;
    if (matForm.id) {
      const updated = materials.map((m) =>
        m.id === matForm.id
          ? {
              ...m,
              title: matForm.title.trim(),
              subjectName: matForm.subjectName,
              materialType: matForm.materialType,
              description: matForm.description.trim(),
              content: matForm.content.trim() || undefined,
              fileUrl: matForm.fileUrl.trim() || undefined,
              fileName: matForm.fileName.trim() || undefined,
            }
          : m
      );
      setMaterials(saveLearningMaterials(updated));
      setMatForm({ id: '', title: '', subjectName: matForm.subjectName, materialType: 'Lesson Notes', description: '', content: '', fileUrl: '', fileName: '' });
      flash(`Updated notes & material "${matForm.title.trim()}" cleanly.`);
      return;
    }

    const item: LearningMaterialItem = {
      id: `mat-${Date.now()}`,
      title: matForm.title.trim(),
      gradeCode: activeGrade,
      stream: 'Stream A',
      subjectName: matForm.subjectName,
      materialType: matForm.materialType,
      description: matForm.description.trim(),
      content: matForm.content.trim() || undefined,
      fileUrl: matForm.fileUrl.trim() || undefined,
      fileName: matForm.fileName.trim() || undefined,
      uploadedBy: sessionUser?.name || 'Teacher',
      uploadedById: sessionUser?.id || 'teacher',
      createdAt: new Date().toISOString().split('T')[0],
    };
    const next = saveLearningMaterials([item, ...materials]);
    setMaterials(next);
    pushStudentNotification({
      studentId: `GRADE:${activeGrade}`,
      gradeCode: activeGrade,
      title: `New Learning Material: ${item.subjectName}`,
      message: `${item.uploadedBy} published "${item.title}" (${item.materialType}).`,
      category: 'Materials',
      relatedTab: 'materials',
    });
    setMatForm({ id: '', title: '', subjectName: matForm.subjectName, materialType: 'Lesson Notes', description: '', content: '', fileUrl: '', fileName: '' });
    flash(`Published notes & material "${item.title}" to ${activeGrade} students & parents.`);
  };

  const handleAddQuestionToDraft = () => {
    const prompt = questionDraft.prompt.trim();
    if (!prompt) return;
    if (questionDraft.type === 'mcq') {
      const cleanedOpts = questionDraft.options.map((o) => o.trim()).filter(Boolean);
      if (cleanedOpts.length < 2) {
        flash('Please provide at least 2 answer choices for a Multiple Choice question.');
        return;
      }
      const selectedOpt = questionDraft.options[questionDraft.correctOptionIdx]?.trim();
      const correctAnswer = selectedOpt && cleanedOpts.includes(selectedOpt) ? selectedOpt : cleanedOpts[0];
      const newQ: QuizQuestion = {
        id: `q-${Date.now()}-${Math.floor(Math.random() * 999)}`,
        type: 'mcq',
        prompt,
        options: cleanedOpts,
        correctAnswer,
        marks: Math.max(1, Number(questionDraft.marks) || 1),
        explanation: questionDraft.explanation.trim() || undefined,
      };
      setHwQuestions((prev) => [...prev, newQ]);
    } else {
      const correctAns = questionDraft.closedCorrectAnswer.trim();
      if (!correctAns) {
        flash('Please specify the official correct answer for this Closed question.');
        return;
      }
      const variants = questionDraft.acceptedVariants
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
      const newQ: QuizQuestion = {
        id: `q-${Date.now()}-${Math.floor(Math.random() * 999)}`,
        type: 'closed',
        prompt,
        correctAnswer: correctAns,
        acceptedAnswers: variants.length > 0 ? variants : undefined,
        marks: Math.max(1, Number(questionDraft.marks) || 1),
        explanation: questionDraft.explanation.trim() || undefined,
      };
      setHwQuestions((prev) => [...prev, newQ]);
    }
    setQuestionDraft((prev) => ({
      ...prev,
      prompt: '',
      options: ['', '', '', ''],
      correctOptionIdx: 0,
      closedCorrectAnswer: '',
      acceptedVariants: '',
      explanation: '',
    }));
  };

  const handleAddHomework = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hwForm.title.trim()) return;
    const computedMaxMarks =
      hwQuestions.length > 0
        ? hwQuestions.reduce((acc, q) => acc + (Number(q.marks) || 1), 0)
        : Math.max(1, Number(hwForm.maxMarks) || 20);
    const item: HomeworkAssignment = {
      id: `hw-${Date.now()}`,
      title: hwForm.title.trim(),
      workType: hwForm.workType,
      gradeCode: activeGrade,
      stream: 'Stream A',
      subjectName: hwForm.subjectName,
      instructions: hwForm.instructions.trim() || 'Answer all questions carefully before the timer ends.',
      dueDate: hwForm.dueDate,
      availableUntil: hwForm.availableUntil ? new Date(hwForm.availableUntil).toISOString() : undefined,
      timeLimitMinutes: Math.max(0, Number(hwForm.timeLimitMinutes) || 0),
      maxAttempts: Math.max(0, Number(hwForm.maxAttempts)),
      maxMarks: computedMaxMarks,
      questions: hwQuestions.length > 0 ? hwQuestions : undefined,
      teacherId: sessionUser?.id || 'teacher',
      teacherName: sessionUser?.name || 'Teacher',
      status: 'Active',
      createdAt: new Date().toISOString().split('T')[0],
    };
    const next = saveHomeworkAssignments([item, ...homework]);
    setHomework(next);
    pushStudentNotification({
      studentId: `GRADE:${activeGrade}`,
      gradeCode: activeGrade,
      title: `New ${item.workType === 'quiz' ? 'Quiz' : 'Homework'}: ${item.subjectName}`,
      message: `"${item.title}" (${item.timeLimitMinutes ? `${item.timeLimitMinutes} mins timed` : 'Untimed'}, ${item.maxAttempts === 0 ? 'Unlimited retakes' : `${item.maxAttempts} attempt(s)`}) is due on ${item.dueDate}.`,
      category: 'Homework',
      relatedTab: 'homework',
    });
    setHwForm({
      ...hwForm,
      title: '',
      instructions: '',
      availableUntil: '',
    });
    setHwQuestions([]);
    flash(`Published ${item.workType === 'quiz' ? 'quiz' : 'homework'} "${item.title}" for ${activeGrade} learners.`);
  };

  const handleToggleHomeworkStatus = (hw: HomeworkAssignment) => {
    const nextStatus = hw.status === 'Active' ? 'Closed' : 'Active';
    const next = homework.map((x) => (x.id === hw.id ? { ...x, status: nextStatus as 'Active' | 'Closed' } : x));
    setHomework(saveHomeworkAssignments(next));
    flash(`"${hw.title}" marked as ${nextStatus}.`);
  };

  const handleUpdateHomeworkRetakes = (hw: HomeworkAssignment, nextAttempts: number) => {
    const clamped = Math.max(0, Math.min(25, nextAttempts));
    const next = homework.map((x) => (x.id === hw.id ? { ...x, maxAttempts: clamped } : x));
    setHomework(saveHomeworkAssignments(next));
    flash(`Updated retake limit for "${hw.title}" to ${clamped === 0 ? 'Unlimited' : `${clamped} attempt(s)`}.`);
  };

  const handleExportWorkRecordsCSV = (targetHw?: HomeworkAssignment) => {
    const gradeSubs = submissions.filter((s) => s.gradeCode === activeGrade);
    const filteredSubs = targetHw ? gradeSubs.filter((s) => s.homeworkId === targetHw.id) : gradeSubs;
    const hwLookup = new Map<string, HomeworkAssignment>();
    homework.forEach((h) => hwLookup.set(h.id, h));

    const headerRows = [
      ['"MUGINA HOPE PRIMARY & NURSERY ACADEMY"'],
      [`"HOMEWORK & QUIZ PERFORMANCE RECORDS (${activeGrade})"`],
      [
        `"Work Filter: ${targetHw ? targetHw.title : 'All Class Homework & Quizzes'}"`,
        `"Teacher: ${sessionUser?.name || 'Teacher'}"`,
        `"Exported: ${new Date().toLocaleString()}"`,
      ],
      [
        '"No."',
        '"Reg Number"',
        '"Student Name"',
        '"Class"',
        '"Assignment / Quiz Title"',
        '"Work Type"',
        '"Subject"',
        '"Attempt #"',
        '"Marks Earned"',
        '"Max Marks"',
        '"Percentage"',
        '"Time Limit"',
        '"Time Remaining"',
        '"Time Spent"',
        '"Timed Out"',
        '"Submitted At"',
        '"Status"',
        '"Teacher Feedback"',
      ],
    ];

    const rows = filteredSubs.map((sub, idx) => {
      const hwObj = hwLookup.get(sub.homeworkId);
      const maxM = sub.maxMarks || hwObj?.maxMarks || 20;
      const earned = sub.score !== undefined ? sub.score : '';
      const pct = sub.score !== undefined && maxM > 0 ? `${Math.round((sub.score / maxM) * 100)}%` : 'Pending';
      const limitLabel = sub.timeLimitSeconds
        ? formatDurationMMSS(sub.timeLimitSeconds)
        : hwObj?.timeLimitMinutes
        ? `${hwObj.timeLimitMinutes}:00`
        : 'Untimed';
      const remainingLabel =
        sub.timeRemainingSeconds !== undefined
          ? sub.timedOut
            ? '00:00 (Time Expired)'
            : formatDurationMMSS(sub.timeRemainingSeconds)
          : '—';
      const spentLabel = sub.timeSpentSeconds !== undefined ? formatDurationMMSS(sub.timeSpentSeconds) : '—';
      return [
        `"${idx + 1}"`,
        `"${sub.regNumber}"`,
        `"${sub.studentName.replace(/"/g, '""')}"`,
        `"${sub.gradeCode}"`,
        `"${(hwObj?.title || sub.subjectName).replace(/"/g, '""')}"`,
        `"${hwObj?.workType === 'quiz' ? 'Quiz' : 'Homework'}"`,
        `"${sub.subjectName}"`,
        `"${sub.attemptNumber || 1}"`,
        `"${earned}"`,
        `"${maxM}"`,
        `"${pct}"`,
        `"${limitLabel}"`,
        `"${remainingLabel}"`,
        `"${spentLabel}"`,
        `"${sub.timedOut ? 'Yes' : 'No'}"`,
        `"${new Date(sub.submittedAt).toLocaleString()}"`,
        `"${sub.status}"`,
        `"${(sub.teacherFeedback || '').replace(/"/g, '""')}"`,
      ];
    });

    const csvContent = '\uFEFF' + [...headerRows, ...rows].map((r) => r.join(',')).join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeTitle = (targetHw ? targetHw.title : activeGrade).replace(/[^a-zA-Z0-9_-]/g, '_');
    a.download = `Mugina_Work_Records_${safeTitle}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    flash(`Exported ${filteredSubs.length} work record(s) with student names, marks, and time remaining.`);
  };

  const handleUploadProfilePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const res = await uploadSchoolAsset(file, `${profileForm.name || 'Teacher'} Photo`, 'staff_avatar');
      if (res.url) {
        setProfileForm((prev) => ({ ...prev, photoUrl: res.url }));
        flash('Profile photo uploaded. Click "Save Profile" to apply changes.');
      }
    } finally {
      setUploadingAvatar(false);
      e.target.value = '';
    }
  };

  const handleSaveTeacherProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionUser) return;
    setSavingProfile(true);
    try {
      const token = getStaffAuthToken();
      let updatedSessionFields = {
        name: profileForm.name.trim() || sessionUser.name,
        email: profileForm.email.trim(),
        phone: profileForm.phone.trim(),
        photoUrl: profileForm.photoUrl.trim(),
        bio: profileForm.bio.trim(),
        assignedSubjectOrGrade: profileForm.assignedSubjectOrGrade.trim() || sessionUser.assignedSubjectOrGrade,
      };
      if (token) {
        const res = await fetch('/api/staff/profile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(updatedSessionFields),
        }).catch(() => null);
        if (res?.ok) {
          const data = await res.json().catch(() => null);
          if (data?.session) {
            updatedSessionFields = {
              name: data.session.name,
              email: data.session.email,
              phone: data.session.phone || '',
              photoUrl: data.session.photoUrl || '',
              bio: data.session.bio || '',
              assignedSubjectOrGrade: data.session.assignedSubjectOrGrade || '',
            };
          }
        }
      }
      updateStaffMember(sessionUser.id, updatedSessionFields);
      setCurrentSessionUser({
        ...sessionUser,
        ...updatedSessionFields,
      });
      flash('Your teacher profile and photo have been saved and synchronized.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleGradeSubmission = (sub: HomeworkSubmission) => {
    const draft = gradingDrafts[sub.id];
    const score = Number(draft?.score ?? sub.score ?? 0);
    const feedback = draft?.feedback ?? sub.teacherFeedback ?? '';
    const updated = gradeHomeworkSubmission(sub.id, score, feedback, sessionUser?.name || 'Teacher');
    setSubmissions(updated);
    flash(`Graded submission for ${sub.studentName} (${score} marks). Student notified.`);
  };

  const handlePublishClassAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!classAnnForm.title.trim() || !classAnnForm.content.trim()) return;
    const item: ClassAnnouncement = {
      id: `cann-${Date.now()}`,
      title: classAnnForm.title.trim(),
      content: classAnnForm.content.trim(),
      gradeCode: activeGrade,
      stream: 'Stream A',
      subjectName: classAnnForm.subjectName,
      authorId: sessionUser?.id || 'teacher',
      authorName: sessionUser?.name || 'Teacher',
      authorRole: 'Teacher',
      publishedAt: new Date().toISOString().split('T')[0],
      isActive: true,
    };
    const next = saveClassAnnouncements([item, ...classAnnouncements]);
    setClassAnnouncements(next);
    pushStudentNotification({
      studentId: `GRADE:${activeGrade}`,
      gradeCode: activeGrade,
      title: `Class Announcement (${activeGrade}): ${item.title}`,
      message: item.content,
      category: 'Announcement',
      relatedTab: 'announcements',
    });
    setClassAnnForm({ title: '', subjectName: 'General Class', content: '' });
    flash(`Published class announcement to ${activeGrade} learners.`);
  };

  const handleAwardAchievement = (e: React.FormEvent) => {
    e.preventDefault();
    const stu = classStudents.find((s) => s.id === (achForm.studentId || classStudents[0]?.id));
    if (!stu || !achForm.title.trim()) return;
    addStudentAchievement({
      studentId: stu.id,
      regNumber: stu.regNumber,
      studentName: stu.fullName,
      gradeCode: stu.gradeCode,
      title: achForm.title.trim(),
      category: achForm.category,
      description: achForm.description.trim() || `Recognized by ${sessionUser?.name || 'Teacher'}.`,
      term: 'Term 1',
      academicYear: '2026',
      awardedBy: sessionUser?.name || 'Teacher',
    });
    setAchievements(getStudentAchievements());
    setAchForm({ ...achForm, title: '', description: '' });
    flash(`Awarded achievement "${achForm.title.trim()}" to ${stu.fullName}.`);
  };

  const handleSendParentMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const stu = classStudents.find((s) => s.id === msgStudentId) || classStudents[0];
    if (!stu || !msgSubject.trim() || !msgBody.trim()) return;
    sendParentTeacherMessage({
      studentId: stu.id,
      studentName: stu.fullName,
      gradeCode: stu.gradeCode,
      parentEmail: stu.parentEmail,
      parentName: stu.parentName,
      teacherId: sessionUser?.id || 'teacher',
      teacherName: sessionUser?.name || 'Teacher',
      senderRole: 'Teacher',
      senderName: sessionUser?.name || 'Teacher',
      subject: msgSubject.trim(),
      message: msgBody.trim(),
    });
    setMessages(getParentTeacherMessages());
    setMsgSubject('');
    setMsgBody('');
    flash(`Message sent to ${stu.parentName} regarding ${stu.fullName}.`);
  };

  const handleExportClassRosterCSV = () => {
    const currentGradeObj = ACADEMIC_GRADES.find((g) => g.code === activeGrade);
    const headers = [
      `"MUGINA HOPE PRIMARY & NURSERY ACADEMY - CLASS ROSTER"`,
      `"Class:","${currentGradeObj?.name || activeGrade}"`,
      `"Teacher:","${sessionUser?.name || 'Teacher'}"`,
      '"No.","Reg Number","Learner Full Name","Gender","Parent","Phone","Email"',
    ];
    const rows = filteredClassStudents.map((s, idx) => [
      `"${idx + 1}"`,
      `"${s.regNumber}"`,
      `"${s.fullName}"`,
      `"${s.gender}"`,
      `"${s.parentName}"`,
      `"${s.parentPhone}"`,
      `"${s.parentEmail || '-'}"`,
    ]);
    const csvContent = '\uFEFF' + [...headers, ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Class_Roster_${activeGrade}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const currentGradeObj = ACADEMIC_GRADES.find((g) => g.code === activeGrade);
  const classMessages = messages.filter((m) => m.gradeCode === activeGrade);
  const classTimetable = timetables.filter((t) => t.gradeCode === activeGrade);
  const classMarks = examMarks.filter((m) => m.gradeCode === activeGrade);

  const subTabs: Array<{ id: TeacherSubTab; label: string; icon: React.ReactNode }> = [
    { id: 'dashboard', label: 'My Dashboard', icon: <GraduationCap size={14} /> },
    { id: 'roster', label: `My Students (${classStudents.length})`, icon: <Users size={14} /> },
    { id: 'exams', label: 'CAT & Exam Marks', icon: <Award size={14} /> },
    { id: 'lesson_plans', label: 'Lesson Plans', icon: <FileText size={14} /> },
    { id: 'materials', label: 'Notes & Materials', icon: <BookOpen size={14} /> },
    { id: 'homework', label: 'Homework & Quizzes', icon: <ClipboardList size={14} /> },
    { id: 'progress_log', label: 'Behaviour & Progress', icon: <CheckCircle2 size={14} /> },
    { id: 'timetable', label: 'Class Timetable', icon: <Clock size={14} /> },
    { id: 'reports', label: 'Academic Reports', icon: <BarChart3 size={14} /> },
    { id: 'messages', label: `Parent Messages (${classMessages.length})`, icon: <MessageSquare size={14} /> },
    { id: 'announcements', label: 'Announcements', icon: <Bell size={14} /> },
    { id: 'profile', label: 'My Profile', icon: <User size={14} /> },
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-blue-950 rounded-2xl p-6 text-white border border-blue-900 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl overflow-hidden bg-blue-900 border-2 border-amber-400/80 flex items-center justify-center shrink-0">
              {profileForm.photoUrl || sessionUser?.photoUrl ? (
                <img
                  src={profileForm.photoUrl || sessionUser?.photoUrl}
                  alt={sessionUser?.name || 'Teacher'}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-lg font-bold text-amber-300">
                  {(sessionUser?.name || 'T').slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                Teacher Management Workspace · {currentGradeObj?.name || activeGrade}
              </p>
              <h2 className="text-xl font-bold text-white tracking-tight">
                {profileForm.name || sessionUser?.name} — Assigned Classroom & Instruction Portal
              </h2>
              <p className="text-xs text-blue-200 max-w-2xl">
                Strictly scoped to your assigned grades ({assignedGrades.join(', ')}). Manage roll call, CAT/Exam marks, class notes, timed MCQ &amp; closed quizzes, and export records.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {assignedGrades.length > 1 && (
              <select
                value={activeGrade}
                onChange={(e) => setActiveGrade(e.target.value)}
                className="px-3 py-2 rounded-lg bg-blue-900 border border-blue-700 text-xs font-semibold text-white"
              >
                {assignedGrades.map((code) => (
                  <option key={code} value={code}>Class {code}</option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={() => onTakeAttendance(activeGrade)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-lg cursor-pointer whitespace-nowrap"
            >
              <ClipboardList size={14} /> Take Today&apos;s Attendance
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-blue-900 text-xs">
          <div className="bg-blue-900/60 rounded-xl p-3">
            <span className="text-blue-200 block text-[11px]">Active Class</span>
            <span className="font-bold text-sm">{activeGrade} (Stream A)</span>
          </div>
          <div className="bg-blue-900/60 rounded-xl p-3">
            <span className="text-blue-200 block text-[11px]">Class Learners</span>
            <span className="font-bold text-sm text-emerald-300 tabular-nums">{classStats.total} ({classStats.boys}B / {classStats.girls}G)</span>
          </div>
          <div className="bg-blue-900/60 rounded-xl p-3">
            <span className="text-blue-200 block text-[11px]">Lesson Plans & Homework</span>
            <span className="font-bold text-sm tabular-nums">
              {lessonPlans.filter((l) => l.gradeCode === activeGrade).length} Plans · {homework.filter((h) => h.gradeCode === activeGrade).length} HW
            </span>
          </div>
          <div className="bg-blue-900/60 rounded-xl p-3">
            <span className="text-blue-200 block text-[11px]">Finance / Role Admin</span>
            <span className="font-semibold text-blue-300">Restricted to Admin/Accountant</span>
          </div>
        </div>
      </div>

      {notice && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-semibold">
          <CheckCircle2 size={14} /> {notice}
        </div>
      )}

      {/* Teacher Sub-Tab Bar */}
      <div className="flex flex-wrap gap-1.5 bg-slate-100 dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800">
        {subTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveSubTab(t.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
              activeSubTab === t.id
                ? 'bg-blue-900 text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* 1. DASHBOARD OVERVIEW */}
      {activeSubTab === 'dashboard' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Assigned Classes Overview</h3>
            <p className="text-xs text-slate-500">Assigned Grade Scope: {assignedGrades.join(', ')}</p>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span>Learners in {activeGrade}</span>
                <span className="font-bold tabular-nums">{classStats.total}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span>Graded Marks Recorded</span>
                <span className="font-bold tabular-nums">{classMarks.length}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span>Parent Inbox Messages</span>
                <span className="font-bold tabular-nums">{classMessages.length}</span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Today&apos;s Quick Actions</h3>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => onTakeAttendance(activeGrade)}
                className="w-full py-2 px-3 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg text-left cursor-pointer"
              >
                Mark Daily Attendance ({activeGrade})
              </button>
              <button
                type="button"
                onClick={() => setActiveSubTab('exams')}
                className="w-full py-2 px-3 bg-blue-900 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg text-left cursor-pointer"
              >
                Enter CAT & Exam Marks ({activeGrade})
              </button>
              <button
                type="button"
                onClick={() => setActiveSubTab('homework')}
                className="w-full py-2 px-3 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold rounded-lg text-left cursor-pointer"
              >
                Post New Homework Assignment
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Latest Announcements</h3>
            {announcements.slice(0, 3).map((a) => (
              <div key={a.id} className="text-xs border-b border-slate-100 dark:border-slate-800 pb-2 last:border-0">
                <p className="font-bold text-slate-900 dark:text-white">{a.title}</p>
                <p className="text-slate-500 line-clamp-2">{a.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. CLASS ROSTER */}
      {activeSubTab === 'roster' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder={`Search learner in ${activeGrade}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 pl-9 pr-3 py-2 text-xs rounded-lg"
              />
            </div>
            <button
              type="button"
              onClick={handleExportClassRosterCSV}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white font-semibold text-xs rounded-lg cursor-pointer"
            >
              <FileSpreadsheet size={14} /> Export Class CSV
            </button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">Reg Number</th>
                  <th className="p-3">Learner</th>
                  <th className="p-3">Gender</th>
                  <th className="p-3">Guardian Contact</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredClassStudents.map((stu, idx) => (
                  <tr key={stu.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="p-3 tabular-nums text-slate-400">{idx + 1}</td>
                    <td className="p-3 font-mono font-bold text-blue-900 dark:text-amber-400">{stu.regNumber}</td>
                    <td className="p-3 font-semibold text-slate-900 dark:text-white">{stu.fullName}</td>
                    <td className="p-3">{stu.gender}</td>
                    <td className="p-3 text-slate-600 dark:text-slate-300">
                      <span className="font-medium block">{stu.parentName}</span>
                      <span className="text-[11px] font-mono inline-flex items-center gap-1">
                        <Phone size={11} /> {stu.parentPhone}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedStudentForProgress(stu);
                          setActiveSubTab('progress_log');
                        }}
                        className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950 text-blue-800 dark:text-blue-200 rounded text-[11px] font-semibold cursor-pointer"
                      >
                        Behaviour / Notes
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedStudentModal(stu)}
                        className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded text-[11px] font-semibold cursor-pointer"
                      >
                        Profile & ID
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. CAT & EXAM MARKS (SCOPED TO TEACHER) */}
      {activeSubTab === 'exams' && sessionUser && (
        <ExaminationsModule currentUser={sessionUser} scopedToTeacher />
      )}

      {/* 4. LESSON PLANS */}
      {activeSubTab === 'lesson_plans' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form
            onSubmit={handleAddLessonPlan}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3 h-fit"
          >
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Create REB Lesson Plan ({activeGrade})</h3>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Subject"
                value={lpForm.subjectName}
                onChange={(e) => setLpForm({ ...lpForm, subjectName: e.target.value })}
                className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
              <input
                type="date"
                value={lpForm.date}
                onChange={(e) => setLpForm({ ...lpForm, date: e.target.value })}
                className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
            </div>
            <input
              type="text"
              required
              placeholder="Lesson Topic / Unit Title"
              value={lpForm.topic}
              onChange={(e) => setLpForm({ ...lpForm, topic: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
            <textarea
              rows={2}
              placeholder="Learning Objectives"
              value={lpForm.objectives}
              onChange={(e) => setLpForm({ ...lpForm, objectives: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
            <textarea
              rows={2}
              placeholder="Teaching Activities & Learner Exercises"
              value={lpForm.teachingActivities}
              onChange={(e) => setLpForm({ ...lpForm, teachingActivities: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 bg-blue-900 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              <Plus size={14} /> Save Lesson Plan
            </button>
          </form>

          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Recorded Lesson Plans ({activeGrade})</h3>
            {lessonPlans.filter((l) => l.gradeCode === activeGrade).map((lp) => (
              <div key={lp.id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-900 dark:text-white">{lp.topic}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 tabular-nums">{lp.date}</span>
                    <button
                      type="button"
                      onClick={() => setLessonPlans(saveLessonPlans(lessonPlans.filter((x) => x.id !== lp.id)))}
                      className="text-red-500 hover:text-red-700 cursor-pointer"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-blue-800 dark:text-blue-300 font-semibold">{lp.subjectName} · {lp.teacherName}</p>
                <p className="text-xs text-slate-600 dark:text-slate-300">{lp.objectives}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. NOTES & TEACHING MATERIALS */}
      {activeSubTab === 'materials' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form
            onSubmit={handleAddMaterial}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3 h-fit"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {matForm.id ? 'Edit Class Notes / Material' : `Add Notes & Material (${activeGrade})`}
              </h3>
              {matForm.id && (
                <button
                  type="button"
                  onClick={() =>
                    setMatForm({
                      id: '',
                      title: '',
                      subjectName: 'Mathematics',
                      materialType: 'Lesson Notes',
                      description: '',
                      content: '',
                      fileUrl: '',
                      fileName: '',
                    })
                  }
                  className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  Cancel Edit
                </button>
              )}
            </div>
            <input
              type="text"
              required
              placeholder="Title (e.g. Fractions Unit 3 Study Notes)"
              value={matForm.title}
              onChange={(e) => setMatForm({ ...matForm, title: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Subject"
                value={matForm.subjectName}
                onChange={(e) => setMatForm({ ...matForm, subjectName: e.target.value })}
                className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
              <select
                value={matForm.materialType}
                onChange={(e) => setMatForm({ ...matForm, materialType: e.target.value as LearningMaterialItem['materialType'] })}
                className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
              >
                <option value="Lesson Notes">Lesson Notes</option>
                <option value="Worksheet">Worksheet</option>
                <option value="Revision Guide">Revision Guide</option>
                <option value="Video / Audio Link">Video / Audio Link</option>
              </select>
            </div>
            <textarea
              rows={2}
              placeholder="Short summary for students..."
              value={matForm.description}
              onChange={(e) => setMatForm({ ...matForm, description: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Full Class / Revision Notes (Read directly by students)
              </label>
              <textarea
                rows={5}
                placeholder="Write key definitions, formulas, worked examples, and revision points for your learners..."
                value={matForm.content}
                onChange={(e) => setMatForm({ ...matForm, content: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 leading-relaxed"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Attach PDF / Worksheet / Image (Optional)
              </label>
              <input
                type="file"
                onChange={handleUploadMaterialFile}
                className="text-xs text-slate-500 w-full"
              />
              {matForm.fileName && (
                <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1">
                  Attached: {matForm.fileName}
                </p>
              )}
              {uploadingMat && <p className="text-[11px] text-blue-700 mt-1">Uploading file...</p>}
            </div>
            <button
              type="submit"
              className="w-full py-2.5 bg-blue-900 hover:bg-blue-950 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              {matForm.id ? 'Update Notes & Material' : 'Publish Notes to Students'}
            </button>
          </form>

          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Published Notes &amp; Materials ({activeGrade})</h3>
            {materials.filter((m) => m.gradeCode === activeGrade).length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center">No notes or materials published for {activeGrade} yet.</p>
            ) : (
              materials
                .filter((m) => m.gradeCode === activeGrade)
                .map((mat) => (
                  <div key={mat.id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex justify-between gap-4">
                    <div className="space-y-1.5 min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-white">{mat.title}</p>
                      <p className="text-[11px] text-slate-500">
                        {mat.subjectName} · {mat.materialType} · <span className="tabular-nums">{mat.createdAt}</span>
                      </p>
                      {mat.description && <p className="text-xs text-slate-600 dark:text-slate-300">{mat.description}</p>}
                      {mat.content && (
                        <div className="mt-2 p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                          {mat.content}
                        </div>
                      )}
                      {mat.fileName && (
                        <p className="text-[11px] font-semibold text-blue-800 dark:text-amber-400">
                          Attachment: {mat.fileName}
                        </p>
                      )}
                    </div>
                    <div className="flex items-start gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          setMatForm({
                            id: mat.id,
                            title: mat.title,
                            subjectName: mat.subjectName,
                            materialType: mat.materialType,
                            description: mat.description,
                            content: mat.content || '',
                            fileUrl: mat.fileUrl || '',
                            fileName: mat.fileName || '',
                          })
                        }
                        title="Edit Notes"
                        className="text-blue-700 hover:text-blue-900 dark:text-amber-400 cursor-pointer"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setMaterials(saveLearningMaterials(materials.filter((x) => x.id !== mat.id)))}
                        title="Delete"
                        className="text-red-500 hover:text-red-700 cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      )}

      {/* 6. HOMEWORK & QUIZZES BUILDER + RECORDS EXPORT */}
      {activeSubTab === 'homework' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Left Column: Assignment & Question Builder */}
          <form
            onSubmit={handleAddHomework}
            className="xl:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 h-fit"
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Create Homework or Quiz ({activeGrade})
              </h3>
              <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-950 text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setHwForm({ ...hwForm, workType: 'homework' })}
                  className={`px-2.5 py-1 rounded-md cursor-pointer ${
                    hwForm.workType === 'homework' ? 'bg-blue-900 text-white' : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Homework
                </button>
                <button
                  type="button"
                  onClick={() => setHwForm({ ...hwForm, workType: 'quiz' })}
                  className={`px-2.5 py-1 rounded-md cursor-pointer ${
                    hwForm.workType === 'quiz' ? 'bg-blue-900 text-white' : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Quiz
                </button>
              </div>
            </div>

            <input
              type="text"
              required
              placeholder={hwForm.workType === 'quiz' ? 'Quiz Title (e.g. Fractions Quick Quiz)' : 'Homework Title'}
              value={hwForm.title}
              onChange={(e) => setHwForm({ ...hwForm, title: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            />

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Subject</label>
                <input
                  type="text"
                  placeholder="Subject"
                  value={hwForm.subjectName}
                  onChange={(e) => setHwForm({ ...hwForm, subjectName: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Due Date</label>
                <input
                  type="date"
                  value={hwForm.dueDate}
                  onChange={(e) => setHwForm({ ...hwForm, dueDate: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 tabular-nums"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  Time Limit (mins)
                </label>
                <input
                  type="number"
                  min={0}
                  max={240}
                  placeholder="0 = Untimed"
                  value={hwForm.timeLimitMinutes}
                  onChange={(e) => setHwForm({ ...hwForm, timeLimitMinutes: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 tabular-nums"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  Allowed Retakes
                </label>
                <input
                  type="number"
                  min={0}
                  max={25}
                  title="0 = Unlimited attempts; 1 = Single attempt; 2+ = Retakes allowed"
                  value={hwForm.maxAttempts}
                  onChange={(e) => setHwForm({ ...hwForm, maxAttempts: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 tabular-nums"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  Total Marks
                </label>
                <input
                  type="number"
                  min={1}
                  disabled={hwQuestions.length > 0}
                  value={
                    hwQuestions.length > 0
                      ? hwQuestions.reduce((acc, q) => acc + (Number(q.marks) || 1), 0)
                      : hwForm.maxMarks
                  }
                  onChange={(e) => setHwForm({ ...hwForm, maxMarks: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 tabular-nums disabled:opacity-60"
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-500 -mt-1">
              Set Time Limit = <code className="font-mono">0</code> for untimed work. Set Allowed Retakes = <code className="font-mono">1</code> for single attempt, <code className="font-mono">2–25</code> for limited retakes, or <code className="font-mono">0</code> for unlimited retakes.
            </p>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Optional Work Close Date &amp; Time (Auto-ends availability)
              </label>
              <input
                type="datetime-local"
                value={hwForm.availableUntil}
                onChange={(e) => setHwForm({ ...hwForm, availableUntil: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 tabular-nums"
              />
            </div>

            <textarea
              rows={2}
              placeholder="Instructions for learners..."
              value={hwForm.instructions}
              onChange={(e) => setHwForm({ ...hwForm, instructions: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            />

            {/* Interactive Question Builder (Multiple Choice + Closed Questions) */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-950 dark:text-amber-400">
                  Add Question (Auto-Graded)
                </span>
                <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-white dark:bg-slate-900 text-[11px] font-semibold">
                  <button
                    type="button"
                    onClick={() => setQuestionDraft({ ...questionDraft, type: 'mcq' })}
                    className={`px-2 py-1 rounded cursor-pointer ${
                      questionDraft.type === 'mcq' ? 'bg-blue-900 text-white' : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    Multiple Choice
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuestionDraft({ ...questionDraft, type: 'closed' })}
                    className={`px-2 py-1 rounded cursor-pointer ${
                      questionDraft.type === 'closed' ? 'bg-blue-900 text-white' : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    Closed Question
                  </button>
                </div>
              </div>

              <input
                type="text"
                placeholder="Enter question prompt..."
                value={questionDraft.prompt}
                onChange={(e) => setQuestionDraft({ ...questionDraft, prompt: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              />

              {questionDraft.type === 'mcq' ? (
                <div className="space-y-1.5">
                  <span className="block text-[11px] text-slate-500 font-semibold">
                    Choices (Select the circle beside the correct answer):
                  </span>
                  {questionDraft.options.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="mcq-correct"
                        checked={questionDraft.correctOptionIdx === idx}
                        onChange={() => setQuestionDraft({ ...questionDraft, correctOptionIdx: idx })}
                        aria-label={`Mark option ${idx + 1} as correct`}
                      />
                      <input
                        type="text"
                        placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                        value={opt}
                        onChange={(e) => {
                          const nextOpts = [...questionDraft.options];
                          nextOpts[idx] = e.target.value;
                          setQuestionDraft({ ...questionDraft, options: nextOpts });
                        }}
                        className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Official Correct Answer (e.g. Kigali)"
                    value={questionDraft.closedCorrectAnswer}
                    onChange={(e) => setQuestionDraft({ ...questionDraft, closedCorrectAnswer: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-slate-900"
                  />
                  <input
                    type="text"
                    placeholder="Accepted variations (comma-separated, optional)"
                    value={questionDraft.acceptedVariants}
                    onChange={(e) => setQuestionDraft({ ...questionDraft, acceptedVariants: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={questionDraft.marks}
                  onChange={(e) => setQuestionDraft({ ...questionDraft, marks: Number(e.target.value) })}
                  placeholder="Marks"
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 tabular-nums"
                />
                <input
                  type="text"
                  value={questionDraft.explanation}
                  onChange={(e) => setQuestionDraft({ ...questionDraft, explanation: e.target.value })}
                  placeholder="Answer explanation (shown on submit)"
                  className="col-span-2 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              </div>

              <button
                type="button"
                onClick={handleAddQuestionToDraft}
                className="w-full py-2 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus size={13} /> Add Question to {hwForm.workType === 'quiz' ? 'Quiz' : 'Homework'} ({hwQuestions.length} added)
              </button>

              {hwQuestions.length > 0 && (
                <div className="space-y-1.5 max-h-52 overflow-y-auto pt-1">
                  {hwQuestions.map((q, i) => (
                    <div
                      key={q.id}
                      className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-2 text-[11px]"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 dark:text-white">
                          Q{i + 1} ({q.type === 'mcq' ? 'MCQ' : 'Closed'} · {q.marks} pts): {q.prompt}
                        </p>
                        <p className="text-emerald-700 dark:text-emerald-400 font-semibold">
                          Correct Answer: {q.correctAnswer}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setHwQuestions((prev) => prev.filter((x) => x.id !== q.id))}
                        className="text-rose-500 hover:text-rose-700 shrink-0 cursor-pointer"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-blue-900 hover:bg-blue-950 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              Publish {hwForm.workType === 'quiz' ? 'Timed Quiz' : 'Homework'} to {activeGrade}
            </button>
          </form>

          {/* Right Column: Published Work + Retakes + Submissions + Records CSV Export */}
          <div className="xl:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Assigned Class Work &amp; Quizzes ({activeGrade})
                </h3>
                <button
                  type="button"
                  onClick={() => handleExportWorkRecordsCSV()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
                >
                  <Download size={13} /> Export All Work Records CSV
                </button>
              </div>

              {homework.filter((h) => h.gradeCode === activeGrade).length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">No homework or quizzes assigned to {activeGrade} yet.</p>
              ) : (
                homework
                  .filter((h) => h.gradeCode === activeGrade)
                  .map((hw) => {
                    const attemptLimit = hw.maxAttempts !== undefined ? hw.maxAttempts : 1;
                    const hwSubCount = submissions.filter((s) => s.homeworkId === hw.id).length;
                    const isExpiredWindow = Boolean(hw.availableUntil && Date.now() > Date.parse(hw.availableUntil));
                    return (
                      <div key={hw.id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2 text-[11px]">
                              <span className="font-bold uppercase tracking-wider text-blue-900 dark:text-amber-400">
                                {hw.workType === 'quiz' ? 'Quiz' : 'Homework'}
                              </span>
                              <span className="text-slate-400">·</span>
                              <span className="font-semibold text-slate-700 dark:text-slate-300">{hw.subjectName}</span>
                              <span className="text-slate-400">·</span>
                              <span className="tabular-nums font-semibold text-amber-700 dark:text-amber-400">
                                {hw.timeLimitMinutes ? `${hw.timeLimitMinutes} mins` : 'Untimed'}
                              </span>
                              <span className="text-slate-400">·</span>
                              <span className="tabular-nums font-semibold text-slate-600 dark:text-slate-300">
                                Max {hw.maxMarks} pts {hw.questions?.length ? `(${hw.questions.length} Qs)` : ''}
                              </span>
                            </div>
                            <p className="text-xs font-bold text-slate-900 dark:text-white">{hw.title}</p>
                            <p className="text-xs text-slate-600 dark:text-slate-300">{hw.instructions}</p>
                            <p className="text-[11px] text-slate-500 tabular-nums">
                              Due {hw.dueDate}
                              {hw.availableUntil ? ` · Closes ${new Date(hw.availableUntil).toLocaleString()}` : ''}
                              {' · '}Status: <strong>{isExpiredWindow ? 'Ended' : hw.status}</strong>
                              {' · '}Submissions: <strong>{hwSubCount}</strong>
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleExportWorkRecordsCSV(hw)}
                              title="Export student names, marks & time remaining for this work"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-emerald-600 text-[11px] font-semibold rounded-lg cursor-pointer"
                            >
                              <Download size={12} /> Export Records
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleHomeworkStatus(hw)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold rounded-lg cursor-pointer"
                            >
                              {hw.status === 'Active' ? <Lock size={12} /> : <Unlock size={12} />}
                              <span>{hw.status === 'Active' ? 'End Work' : 'Reopen'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setHomework(saveHomeworkAssignments(homework.filter((x) => x.id !== hw.id)))}
                              className="text-red-500 hover:text-red-700 p-1.5 cursor-pointer"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>

                        {/* Teacher Retake Limit Control */}
                        <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                          <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-semibold">
                            <RotateCcw size={12} className="text-blue-800 dark:text-amber-400" />
                            Allowed Student Attempts / Retakes:{' '}
                            <strong className="tabular-nums text-slate-900 dark:text-white">
                              {attemptLimit === 0 ? 'Unlimited' : `${attemptLimit} time(s)`}
                            </strong>
                          </span>
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 5, 0].map((val) => (
                              <button
                                key={val}
                                type="button"
                                onClick={() => handleUpdateHomeworkRetakes(hw, val)}
                                className={`px-2 py-0.5 rounded border text-[11px] font-semibold cursor-pointer tabular-nums ${
                                  attemptLimit === val
                                    ? 'bg-blue-900 text-white border-blue-900'
                                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                {val === 0 ? '∞' : `${val}x`}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>

            {/* Student Work Submissions, Time Remaining & Marks Recording */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-amber-400">
                  Student Submissions &amp; Marks Log ({submissions.filter((s) => s.gradeCode === activeGrade).length})
                </h4>
                <select
                  value={hwFilterAssignmentId}
                  onChange={(e) => setHwFilterAssignmentId(e.target.value)}
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                >
                  <option value="ALL">All Assignments &amp; Quizzes</option>
                  {homework
                    .filter((h) => h.gradeCode === activeGrade)
                    .map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.title}
                      </option>
                    ))}
                </select>
              </div>

              {submissions.filter(
                (s) => s.gradeCode === activeGrade && (hwFilterAssignmentId === 'ALL' || s.homeworkId === hwFilterAssignmentId)
              ).length === 0 ? (
                <p className="text-xs text-slate-400 py-4">No student submissions received for this selection yet.</p>
              ) : (
                submissions
                  .filter(
                    (s) =>
                      s.gradeCode === activeGrade &&
                      (hwFilterAssignmentId === 'ALL' || s.homeworkId === hwFilterAssignmentId)
                  )
                  .map((sub) => {
                    const parentHw = homework.find((h) => h.id === sub.homeworkId);
                    const draft = gradingDrafts[sub.id] || {
                      score: sub.score !== undefined ? String(sub.score) : '',
                      feedback: sub.teacherFeedback || '',
                    };
                    const isExpanded = expandedSubAnswersId === sub.id;
                    return (
                      <div key={sub.id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5 text-xs">
                        <div className="flex flex-wrap justify-between gap-2">
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white">{sub.studentName}</span>
                            <span className="text-slate-500 ml-2 font-mono">
                              {sub.regNumber} · {parentHw?.title || sub.subjectName} · Attempt #{sub.attemptNumber || 1}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 tabular-nums">
                            {sub.timeRemainingSeconds !== undefined && (
                              <span className={`inline-flex items-center gap-1 font-mono font-semibold ${sub.timedOut ? 'text-rose-600' : 'text-blue-800 dark:text-blue-300'}`}>
                                <Timer size={12} />
                                {sub.timedOut ? '00:00 Left (Timed Out)' : `${formatDurationMMSS(sub.timeRemainingSeconds)} Left`}
                              </span>
                            )}
                            <span className={`font-bold ${sub.status === 'Graded' ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-600'}`}>
                              {sub.status}
                              {sub.score !== undefined ? ` (${sub.score}/${sub.maxMarks || parentHw?.maxMarks || 20})` : ''}
                            </span>
                          </div>
                        </div>

                        {sub.answerText && (
                          <p className="text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                            {sub.answerText}
                          </p>
                        )}

                        {sub.answers && sub.answers.length > 0 && (
                          <div>
                            <button
                              type="button"
                              onClick={() => setExpandedSubAnswersId(isExpanded ? null : sub.id)}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-800 dark:text-amber-400 hover:underline cursor-pointer"
                            >
                              <Eye size={12} />
                              <span>{isExpanded ? 'Hide Answer Breakdown' : `View Question Answers (${sub.answers.filter((a) => a.isCorrect).length}/${sub.answers.length} correct)`}</span>
                            </button>
                            {isExpanded && (
                              <div className="mt-2 space-y-1.5 bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                                {sub.answers.map((ans, idx) => (
                                  <div key={ans.questionId} className="text-[11px] pb-1.5 border-b last:border-0 border-slate-100 dark:border-slate-800">
                                    <p className="font-semibold text-slate-900 dark:text-white">
                                      Q{idx + 1}: {ans.prompt}
                                    </p>
                                    <p className={ans.isCorrect ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                                      Student Answer: <strong>{ans.studentAnswer || '(Blank)'}</strong> · {ans.earnedMarks}/{ans.maxMarks} pts
                                      {!ans.isCorrect && (
                                        <span className="ml-2 text-emerald-700 dark:text-emerald-400">
                                          | Correct: <strong>{ans.correctAnswer}</strong>
                                        </span>
                                      )}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {sub.fileUrl && (
                          <a
                            href={sub.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            download={sub.fileName || 'submission'}
                            className="inline-flex items-center gap-1 text-blue-700 dark:text-amber-400 font-semibold underline"
                          >
                            Download Attached File ({sub.fileName || 'Attachment'})
                          </a>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1">
                          <input
                            type="number"
                            min={0}
                            max={sub.maxMarks || 100}
                            placeholder={`Marks /${sub.maxMarks || 20}`}
                            value={draft.score}
                            onChange={(e) =>
                              setGradingDrafts((prev) => ({
                                ...prev,
                                [sub.id]: { ...draft, score: e.target.value },
                              }))
                            }
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs tabular-nums"
                          />
                          <input
                            type="text"
                            placeholder="Academic feedback for student..."
                            value={draft.feedback}
                            onChange={(e) =>
                              setGradingDrafts((prev) => ({
                                ...prev,
                                [sub.id]: { ...draft, feedback: e.target.value },
                              }))
                            }
                            className="sm:col-span-2 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => handleGradeSubmission(sub)}
                            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-lg cursor-pointer"
                          >
                            Save Mark &amp; Notify
                          </button>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </div>
      )}

      {/* 7. STUDENT BEHAVIOUR & PROGRESS LOG */}
      {activeSubTab === 'progress_log' && (
        <StudentProgressLogModule
          students={students}
          activeGrade={activeGrade}
          initialSelectedStudent={selectedStudentForProgress}
          onClose={() => setActiveSubTab('roster')}
        />
      )}

      {/* 8. CLASS TIMETABLE */}
      {activeSubTab === 'timetable' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Assigned Class Timetable ({activeGrade})</h3>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {classTimetable.length === 0 ? (
              <p className="text-slate-400 py-8 text-center">No timetable slots configured for {activeGrade}.</p>
            ) : (
              classTimetable.map((slot) => (
                <div key={slot.id} className="py-3 flex justify-between items-center">
                  <div>
                    <span className="font-bold text-blue-900 dark:text-amber-400">{slot.dayOfWeek}</span>
                    <span className="mx-2 text-slate-400">·</span>
                    <span className="font-semibold">{slot.subjectName}</span>
                    <span className="ml-2 text-slate-500">({slot.room})</span>
                  </div>
                  <span className="font-mono tabular-nums">{slot.startTime}–{slot.endTime}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 9. ACADEMIC REPORTS */}
      {activeSubTab === 'reports' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Class Academic Summary ({activeGrade})</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <span className="text-slate-500">Average Class Score</span>
              <p className="text-2xl font-bold text-blue-900 dark:text-amber-400 mt-1 tabular-nums">
                {classMarks.length > 0
                  ? `${Math.round((classMarks.reduce((s, m) => s + m.totalPercent, 0) / classMarks.length) * 10) / 10}%`
                  : 'N/A'}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <span className="text-slate-500">Highest Subject Score</span>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-1 tabular-nums">
                {classMarks.length > 0 ? `${Math.max(...classMarks.map((m) => m.totalPercent))}%` : 'N/A'}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <span className="text-slate-500">Graded Entries</span>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">{classMarks.length}</p>
            </div>
          </div>
        </div>
      )}

      {/* 10. PARENT COMMUNICATION */}
      {activeSubTab === 'messages' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form
            onSubmit={handleSendParentMessage}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3 h-fit"
          >
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Send Parent Message ({activeGrade})</h3>
            <select
              value={msgStudentId || classStudents[0]?.id || ''}
              onChange={(e) => setMsgStudentId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            >
              {classStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName} — Parent: {s.parentName}
                </option>
              ))}
            </select>
            <input
              type="text"
              required
              placeholder="Subject"
              value={msgSubject}
              onChange={(e) => setMsgSubject(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
            <textarea
              rows={3}
              required
              placeholder="Message to parent/guardian..."
              value={msgBody}
              onChange={(e) => setMsgBody(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 bg-blue-900 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              <Send size={13} /> Send Message
            </button>
          </form>

          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Parent-Teacher Inbox ({activeGrade})</h3>
            {classMessages.length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center">No parent messages recorded yet for {activeGrade}.</p>
            ) : (
              classMessages.map((m) => (
                <div key={m.id} className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                  <div className="flex justify-between text-xs font-bold">
                    <span>{m.subject} · {m.studentName}</span>
                    <span className="text-slate-400 tabular-nums">{new Date(m.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-[11px] text-blue-800 dark:text-blue-300">
                    From {m.senderName} ({m.senderRole})
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-300">{m.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 11. ANNOUNCEMENTS & STUDENT ACHIEVEMENTS */}
      {activeSubTab === 'announcements' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Publish Class Announcement ({activeGrade})</h3>
            <form onSubmit={handlePublishClassAnnouncement} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  placeholder="Announcement Title"
                  value={classAnnForm.title}
                  onChange={(e) => setClassAnnForm({ ...classAnnForm, title: e.target.value })}
                  className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
                <input
                  type="text"
                  placeholder="Subject / Scope"
                  value={classAnnForm.subjectName}
                  onChange={(e) => setClassAnnForm({ ...classAnnForm, subjectName: e.target.value })}
                  className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>
              <textarea
                rows={2}
                required
                placeholder={`Write announcement for ${activeGrade} students & parents...`}
                value={classAnnForm.content}
                onChange={(e) => setClassAnnForm({ ...classAnnForm, content: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
              <button type="submit" className="px-4 py-2 bg-blue-900 text-white font-semibold rounded-lg cursor-pointer">
                Publish to {activeGrade} Students
              </button>
            </form>

            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">Class &amp; School Announcements</h4>
              {classAnnouncements
                .filter((c) => c.gradeCode === 'ALL' || c.gradeCode === activeGrade)
                .map((ca) => (
                  <div key={ca.id} className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 flex justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-blue-950 dark:text-amber-300">{ca.title}</p>
                      <p className="text-[11px] text-slate-500">{ca.gradeCode} · {ca.subjectName} · {ca.publishedAt}</p>
                      <p className="text-xs text-slate-700 dark:text-slate-300 mt-1">{ca.content}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setClassAnnouncements(saveClassAnnouncements(classAnnouncements.filter((x) => x.id !== ca.id)))}
                      className="text-rose-500 hover:text-rose-700 h-fit cursor-pointer"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              {announcements.map((a) => (
                <div key={a.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                  <p className="text-xs font-bold text-blue-900 dark:text-amber-400">{a.title}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-300">{a.content}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Award Student Achievement ({activeGrade})</h3>
            <form onSubmit={handleAwardAchievement} className="space-y-3 text-xs">
              <select
                value={achForm.studentId || classStudents[0]?.id || ''}
                onChange={(e) => setAchForm({ ...achForm, studentId: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
              >
                {classStudents.map((s) => (
                  <option key={s.id} value={s.id}>{s.fullName} ({s.regNumber})</option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  placeholder="Achievement Title"
                  value={achForm.title}
                  onChange={(e) => setAchForm({ ...achForm, title: e.target.value })}
                  className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
                <select
                  value={achForm.category}
                  onChange={(e) => setAchForm({ ...achForm, category: e.target.value as StudentAchievement['category'] })}
                  className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                >
                  <option value="Academic Excellence">Academic Excellence</option>
                  <option value="Leadership">Leadership</option>
                  <option value="Sports & Culture">Sports &amp; Culture</option>
                  <option value="Attendance">Attendance</option>
                  <option value="Conduct & Values">Conduct &amp; Values</option>
                </select>
              </div>
              <textarea
                rows={2}
                placeholder="Reason / merit commendation notes..."
                value={achForm.description}
                onChange={(e) => setAchForm({ ...achForm, description: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
              <button type="submit" className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-lg cursor-pointer">
                Award Achievement Certificate
              </button>
            </form>

            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">Recent Class Achievements ({activeGrade})</h4>
              {achievements
                .filter((a) => a.gradeCode === activeGrade)
                .map((ach) => (
                  <div key={ach.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs">
                    <div className="flex justify-between font-bold">
                      <span className="text-slate-900 dark:text-white">{ach.title}</span>
                      <span className="text-emerald-700 dark:text-emerald-400">{ach.studentName}</span>
                    </div>
                    <p className="text-[11px] text-slate-500">{ach.category} · {ach.awardedAt}</p>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* 12. MY PROFILE & PROFILE PICTURE */}
      {activeSubTab === 'profile' && (
        <form
          onSubmit={handleSaveTeacherProfile}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 max-w-2xl space-y-5 text-xs"
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-5 pb-5 border-b border-slate-100 dark:border-slate-800">
            <div className="w-20 h-20 rounded-2xl overflow-hidden bg-blue-950 border-2 border-amber-400 flex items-center justify-center shrink-0">
              {profileForm.photoUrl ? (
                <img src={profileForm.photoUrl} alt={profileForm.name || 'Teacher'} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl font-bold text-amber-300">
                  {(profileForm.name || sessionUser?.name || 'T').slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            <div className="space-y-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Teacher Profile &amp; Photo</h3>
              <p className="text-slate-500 dark:text-slate-400">
                Update your contact information, bio, and profile picture visible across classrooms.
              </p>
              <label className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-semibold rounded-lg cursor-pointer">
                <Camera size={14} className="text-blue-800 dark:text-amber-400" />
                <span>{uploadingAvatar ? 'Uploading Photo...' : 'Upload Profile Picture'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleUploadProfilePhoto}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={profileForm.name}
                onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">Portal Username</label>
              <input
                type="text"
                disabled
                value={sessionUser?.username || ''}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono text-slate-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">Email Address</label>
              <input
                type="email"
                value={profileForm.email}
                onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">Phone Number</label>
              <input
                type="tel"
                value={profileForm.phone}
                onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                placeholder="+250 78..."
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
              Teaching Specialization &amp; Bio
            </label>
            <textarea
              rows={3}
              value={profileForm.bio}
              onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
              placeholder="Describe your subjects, REB teaching experience, and office hours..."
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-slate-500">
              Assigned Grade Scope: <strong className="text-slate-900 dark:text-white">{assignedGrades.join(', ')}</strong>
            </span>
            <button
              type="submit"
              disabled={savingProfile}
              className="px-5 py-2.5 bg-blue-900 hover:bg-blue-950 text-white font-semibold rounded-lg cursor-pointer disabled:opacity-60"
            >
              {savingProfile ? 'Saving Profile...' : 'Save Profile Changes'}
            </button>
          </div>
        </form>
      )}

      <StudentIdAndProfileModal
        student={selectedStudentModal}
        onClose={() => setSelectedStudentModal(null)}
        canTransfer={false}
      />
    </div>
  );
};
