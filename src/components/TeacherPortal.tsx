import React, { useState, useMemo, useEffect } from 'react';
import {
  EnrolledStudent,
  getCurrentSessionUser,
  getAnnouncements,
} from '../services/adminStore';
import {
  LessonPlanRecord,
  LearningMaterialItem,
  HomeworkAssignment,
  getTeacherAssignments,
  getLessonPlans,
  saveLessonPlans,
  getLearningMaterials,
  saveLearningMaterials,
  getHomeworkAssignments,
  saveHomeworkAssignments,
  getClassTimetables,
  getParentTeacherMessages,
  sendParentTeacherMessage,
  getExamMarks,
} from '../services/smsStore';
import { extractGradesFromAssignment } from '../services/rbac';
import { ACADEMIC_GRADES } from '../data/schoolData';
import { StudentProgressLogModule } from './StudentProgressLogModule';
import { ExaminationsModule } from './ExaminationsModule';
import { StudentIdAndProfileModal } from './StudentIdAndProfileModal';
import { uploadSchoolAsset } from '../services/storageService';
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
  const [messages, setMessages] = useState(() => getParentTeacherMessages());
  const [timetables] = useState(() => getClassTimetables());
  const [examMarks] = useState(() => getExamMarks());
  const [announcements] = useState(() => getAnnouncements().filter((a) => a.isActive));

  useEffect(() => {
    const sync = () => {
      setLessonPlans(getLessonPlans());
      setMaterials(getLearningMaterials());
      setHomework(getHomeworkAssignments());
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
    title: '',
    subjectName: 'Mathematics',
    materialType: 'Lesson Notes' as LearningMaterialItem['materialType'],
    description: '',
    fileUrl: '',
  });
  const [uploadingMat, setUploadingMat] = useState(false);

  const [hwForm, setHwForm] = useState({
    title: '',
    subjectName: 'Mathematics',
    instructions: '',
    dueDate: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
    maxMarks: 20,
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
      const res = await uploadSchoolAsset(file, matForm.title || file.name, 'teaching_material');
      if (res.url) {
        setMatForm((prev) => ({ ...prev, fileUrl: res.url }));
      }
    } finally {
      setUploadingMat(false);
    }
  };

  const handleAddMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!matForm.title.trim()) return;
    const item: LearningMaterialItem = {
      id: `mat-${Date.now()}`,
      title: matForm.title.trim(),
      gradeCode: activeGrade,
      stream: 'Stream A',
      subjectName: matForm.subjectName,
      materialType: matForm.materialType,
      description: matForm.description.trim(),
      fileUrl: matForm.fileUrl.trim() || undefined,
      uploadedBy: sessionUser?.name || 'Teacher',
      uploadedById: sessionUser?.id || 'teacher',
      createdAt: new Date().toISOString().split('T')[0],
    };
    const next = saveLearningMaterials([item, ...materials]);
    setMaterials(next);
    setMatForm({ ...matForm, title: '', description: '', fileUrl: '' });
    flash(`Published learning material "${item.title}" to ${activeGrade}.`);
  };

  const handleAddHomework = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hwForm.title.trim()) return;
    const item: HomeworkAssignment = {
      id: `hw-${Date.now()}`,
      title: hwForm.title.trim(),
      gradeCode: activeGrade,
      stream: 'Stream A',
      subjectName: hwForm.subjectName,
      instructions: hwForm.instructions.trim(),
      dueDate: hwForm.dueDate,
      maxMarks: Number(hwForm.maxMarks) || 20,
      teacherId: sessionUser?.id || 'teacher',
      teacherName: sessionUser?.name || 'Teacher',
      status: 'Active',
      createdAt: new Date().toISOString().split('T')[0],
    };
    const next = saveHomeworkAssignments([item, ...homework]);
    setHomework(next);
    setHwForm({ ...hwForm, title: '', instructions: '' });
    flash(`Posted homework "${item.title}" for ${activeGrade}.`);
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
    { id: 'materials', label: 'Teaching Materials', icon: <BookOpen size={14} /> },
    { id: 'homework', label: 'Homework', icon: <ClipboardList size={14} /> },
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
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">
              Teacher Management Workspace · {currentGradeObj?.name || activeGrade}
            </p>
            <h2 className="text-xl font-bold text-white tracking-tight">
              {sessionUser?.name} — Assigned Classroom & Instruction Portal
            </h2>
            <p className="text-xs text-blue-200 max-w-2xl">
              Strictly scoped to your assigned grades ({assignedGrades.join(', ')}). Manage daily roll call, CAT/Exam marks, lesson plans, homework, and parent communication.
            </p>
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

      {/* 5. TEACHING MATERIALS */}
      {activeSubTab === 'materials' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form
            onSubmit={handleAddMaterial}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3 h-fit"
          >
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Upload Teaching Material ({activeGrade})</h3>
            <input
              type="text"
              required
              placeholder="Title (e.g. Term 1 Revision Sheet)"
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
              placeholder="Description / instructions for learners"
              value={matForm.description}
              onChange={(e) => setMatForm({ ...matForm, description: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
            <input
              type="file"
              onChange={handleUploadMaterialFile}
              className="text-xs text-slate-500 w-full"
            />
            {uploadingMat && <p className="text-[11px] text-blue-700">Uploading file...</p>}
            <button
              type="submit"
              className="w-full py-2.5 bg-blue-900 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              Publish Material to Class & Parents
            </button>
          </form>

          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Published Materials ({activeGrade})</h3>
            {materials.filter((m) => m.gradeCode === activeGrade).map((mat) => (
              <div key={mat.id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex justify-between gap-4">
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">{mat.title}</p>
                  <p className="text-[11px] text-slate-500">{mat.subjectName} · {mat.materialType} · {mat.createdAt}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{mat.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setMaterials(saveLearningMaterials(materials.filter((x) => x.id !== mat.id)))}
                  className="text-red-500 hover:text-red-700 h-fit cursor-pointer"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. HOMEWORK */}
      {activeSubTab === 'homework' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form
            onSubmit={handleAddHomework}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3 h-fit"
          >
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Assign Homework ({activeGrade})</h3>
            <input
              type="text"
              required
              placeholder="Assignment Title"
              value={hwForm.title}
              onChange={(e) => setHwForm({ ...hwForm, title: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Subject"
                value={hwForm.subjectName}
                onChange={(e) => setHwForm({ ...hwForm, subjectName: e.target.value })}
                className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
              <input
                type="date"
                value={hwForm.dueDate}
                onChange={(e) => setHwForm({ ...hwForm, dueDate: e.target.value })}
                className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
            </div>
            <textarea
              rows={3}
              required
              placeholder="Instructions & exercises..."
              value={hwForm.instructions}
              onChange={(e) => setHwForm({ ...hwForm, instructions: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
            <button
              type="submit"
              className="w-full py-2.5 bg-blue-900 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              Post Homework
            </button>
          </form>

          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Active Class Homework ({activeGrade})</h3>
            {homework.filter((h) => h.gradeCode === activeGrade).map((hw) => (
              <div key={hw.id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex justify-between gap-4">
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">{hw.title}</p>
                  <p className="text-[11px] text-amber-600 font-semibold tabular-nums">
                    {hw.subjectName} · Due {hw.dueDate} · Max {hw.maxMarks} pts
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{hw.instructions}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setHomework(saveHomeworkAssignments(homework.filter((x) => x.id !== hw.id)))}
                  className="text-red-500 hover:text-red-700 h-fit cursor-pointer"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
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

      {/* 11. ANNOUNCEMENTS */}
      {activeSubTab === 'announcements' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">School Announcements</h3>
          {announcements.map((a) => (
            <div key={a.id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
              <p className="text-xs font-bold text-blue-900 dark:text-amber-400">{a.title}</p>
              <p className="text-xs text-slate-600 dark:text-slate-300">{a.content}</p>
            </div>
          ))}
        </div>
      )}

      {/* 12. MY PROFILE */}
      {activeSubTab === 'profile' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 max-w-xl space-y-3 text-xs">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Teacher Profile</h3>
          <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
            <span className="text-slate-500">Full Name</span>
            <span className="font-bold">{sessionUser?.name}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
            <span className="text-slate-500">Portal Username</span>
            <span className="font-mono">{sessionUser?.username}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
            <span className="text-slate-500">Email</span>
            <span>{sessionUser?.email || 'Not set'}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-slate-500">Assigned Grade Scope</span>
            <span className="font-semibold">{assignedGrades.join(', ')}</span>
          </div>
        </div>
      )}

      <StudentIdAndProfileModal
        student={selectedStudentModal}
        onClose={() => setSelectedStudentModal(null)}
        canTransfer={false}
      />
    </div>
  );
};
