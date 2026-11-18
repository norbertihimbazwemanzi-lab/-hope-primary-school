import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Layers,
  BookOpen,
  UserCheck,
  Clock,
  Sliders,
  Wallet,
  Plus,
  Trash2,
  CheckCircle2,
  Save,
  RotateCcw,
} from 'lucide-react';
import {
  AcademicYearTerm,
  ClassStreamItem,
  SchoolSubject,
  TeacherSubjectAssignment,
  ExamConfig,
  ClassTimetableSlot,
  ClassFeeStructure,
  DEFAULT_EXAM_CONFIG,
  getAcademicYearsTerms,
  saveAcademicYearsTerms,
  getClassStreams,
  saveClassStreams,
  getSchoolSubjects,
  saveSchoolSubjects,
  getTeacherAssignments,
  saveTeacherAssignments,
  getExamConfig,
  saveExamConfig,
  calculateExamResult,
  getClassTimetables,
  saveClassTimetables,
  getFeeStructures,
  saveFeeStructures,
} from '../services/smsStore';
import { getStaffMembers } from '../services/adminStore';
import { ACADEMIC_GRADES } from '../data/schoolData';

type SubTab =
  | 'years'
  | 'classes'
  | 'subjects'
  | 'assignments'
  | 'timetables'
  | 'formula'
  | 'fees';

interface AcademicManagementModuleProps {
  canConfigureExam?: boolean;
  canManageFees?: boolean;
}

const DAYS: Array<ClassTimetableSlot['dayOfWeek']> = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
];

export const AcademicManagementModule: React.FC<AcademicManagementModuleProps> = ({
  canConfigureExam = true,
  canManageFees = true,
}) => {
  const [subTab, setSubTab] = useState<SubTab>('years');
  const [yearsTerms, setYearsTerms] = useState<AcademicYearTerm[]>(() => getAcademicYearsTerms());
  const [classes, setClasses] = useState<ClassStreamItem[]>(() => getClassStreams());
  const [subjects, setSubjects] = useState<SchoolSubject[]>(() => getSchoolSubjects());
  const [assignments, setAssignments] = useState<TeacherSubjectAssignment[]>(() => getTeacherAssignments());
  const [examCfg, setExamCfg] = useState<ExamConfig>(() => getExamConfig());
  const [timetables, setTimetables] = useState<ClassTimetableSlot[]>(() => getClassTimetables());
  const [feeStructures, setFeeStructures] = useState<ClassFeeStructure[]>(() => getFeeStructures());
  const [bannerMsg, setBannerMsg] = useState<string | null>(null);

  const staffTeachers = useMemo(
    () =>
      getStaffMembers().filter(
        (s) => s.status === 'Active' && (s.role === 'Teacher' || s.role === 'HeadTeacher' || s.role === 'DOS')
      ),
    []
  );

  useEffect(() => {
    const refresh = () => {
      setYearsTerms(getAcademicYearsTerms());
      setClasses(getClassStreams());
      setSubjects(getSchoolSubjects());
      setAssignments(getTeacherAssignments());
      setExamCfg(getExamConfig());
      setTimetables(getClassTimetables());
      setFeeStructures(getFeeStructures());
    };
    window.addEventListener('mugina-sms-updated', refresh);
    return () => window.removeEventListener('mugina-sms-updated', refresh);
  }, []);

  const flash = (msg: string) => {
    setBannerMsg(msg);
    setTimeout(() => setBannerMsg(null), 4000);
  };

  // --- Form states ---
  const [newYearForm, setNewYearForm] = useState({
    academicYear: String(new Date().getFullYear()),
    termName: 'Term 2' as AcademicYearTerm['termName'],
    startDate: '2026-04-20',
    endDate: '2026-07-17',
  });

  const [newClassForm, setNewClassForm] = useState({
    gradeCode: 'P1',
    streamName: 'Stream B',
    roomName: 'Wing A - Room 104',
    capacity: 35,
    classTeacherId: '',
  });

  const [newSubjectForm, setNewSubjectForm] = useState({
    code: '',
    name: '',
    level: 'All Primary' as SchoolSubject['level'],
    coefficient: 100,
    isCore: true,
    applicableGrades: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'],
  });

  const [newAssignForm, setNewAssignForm] = useState({
    teacherId: staffTeachers[0]?.id || '',
    gradeCode: 'P4',
    stream: 'Stream A',
    subjectCode: 'MATH',
  });

  const [timetableGrade, setTimetableGrade] = useState('P4');
  const [newSlotForm, setNewSlotForm] = useState({
    dayOfWeek: 'Monday' as ClassTimetableSlot['dayOfWeek'],
    startTime: '09:30',
    endTime: '10:30',
    subjectName: 'Mathematics',
    teacherName: staffTeachers[0]?.name || 'Marie Claire Uwimana',
    room: 'Wing B - 201',
  });

  // Preview exam formula calculator
  const [previewCat, setPreviewCat] = useState(76);
  const [previewExam, setPreviewExam] = useState(84);
  const previewResult = useMemo(
    () => calculateExamResult(previewCat, previewExam, examCfg),
    [previewCat, previewExam, examCfg]
  );

  // --- Handlers ---
  const handleAddYearTerm = (e: React.FormEvent) => {
    e.preventDefault();
    const item: AcademicYearTerm = {
      id: `ay-${Date.now()}`,
      academicYear: newYearForm.academicYear.trim(),
      termName: newYearForm.termName,
      startDate: newYearForm.startDate,
      endDate: newYearForm.endDate,
      isCurrent: false,
      status: 'Upcoming',
    };
    const next = saveAcademicYearsTerms([item, ...yearsTerms]);
    setYearsTerms(next);
    flash(`Added ${item.academicYear} · ${item.termName}.`);
  };

  const handleSetCurrentTerm = (id: string) => {
    const next = yearsTerms.map((yt) => ({
      ...yt,
      isCurrent: yt.id === id,
      status: yt.id === id ? ('Active' as const) : yt.status === 'Active' ? ('Completed' as const) : yt.status,
    }));
    saveAcademicYearsTerms(next);
    setYearsTerms(next);
    flash('Active academic term updated school-wide.');
  };

  const handleAddClassStream = (e: React.FormEvent) => {
    e.preventDefault();
    const gradeMeta = ACADEMIC_GRADES.find((g) => g.code === newClassForm.gradeCode);
    const teacher = staffTeachers.find((t) => t.id === newClassForm.classTeacherId);
    const nextItem: ClassStreamItem = {
      id: `cls-${Date.now()}`,
      gradeCode: newClassForm.gradeCode,
      gradeName: gradeMeta?.name || newClassForm.gradeCode,
      level: gradeMeta?.level || 'Primary',
      streamName: newClassForm.streamName.trim() || 'Stream A',
      roomName: newClassForm.roomName.trim() || 'Classroom',
      capacity: Math.max(10, Number(newClassForm.capacity) || 35),
      classTeacherId: teacher?.id,
      classTeacherName: teacher?.name || 'Unassigned',
    };
    const next = saveClassStreams([...classes, nextItem]);
    setClasses(next);
    flash(`Added ${nextItem.gradeCode} ${nextItem.streamName}.`);
  };

  const handleUpdateClassTeacher = (classId: string, teacherId: string) => {
    const teacher = staffTeachers.find((t) => t.id === teacherId);
    const next = classes.map((c) =>
      c.id === classId
        ? { ...c, classTeacherId: teacher?.id, classTeacherName: teacher?.name || 'Unassigned' }
        : c
    );
    saveClassStreams(next);
    setClasses(next);
    flash('Class teacher updated.');
  };

  const handleAddSubject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjectForm.code.trim() || !newSubjectForm.name.trim()) return;
    const item: SchoolSubject = {
      id: `sub-${Date.now()}`,
      code: newSubjectForm.code.trim().toUpperCase(),
      name: newSubjectForm.name.trim(),
      level: newSubjectForm.level,
      applicableGrades: newSubjectForm.applicableGrades,
      coefficient: Number(newSubjectForm.coefficient) || 100,
      isCore: newSubjectForm.isCore,
    };
    const next = saveSchoolSubjects([...subjects, item]);
    setSubjects(next);
    setNewSubjectForm({ ...newSubjectForm, code: '', name: '' });
    flash(`Subject ${item.code} (${item.name}) saved.`);
  };

  const handleAddAssignment = (e: React.FormEvent) => {
    e.preventDefault();
    const teacher = staffTeachers.find((t) => t.id === newAssignForm.teacherId);
    const subj = subjects.find((s) => s.code === newAssignForm.subjectCode);
    if (!teacher || !subj) return;
    const currentYear = yearsTerms.find((y) => y.isCurrent)?.academicYear || '2026';
    const item: TeacherSubjectAssignment = {
      id: `ta-${Date.now()}`,
      teacherId: teacher.id,
      teacherName: teacher.name,
      gradeCode: newAssignForm.gradeCode,
      stream: newAssignForm.stream,
      subjectCode: subj.code,
      subjectName: subj.name,
      academicYear: currentYear,
    };
    const next = saveTeacherAssignments([item, ...assignments]);
    setAssignments(next);
    flash(`Assigned ${teacher.name} to ${subj.name} (${item.gradeCode}).`);
  };

  const handleAddTimetableSlot = (e: React.FormEvent) => {
    e.preventDefault();
    const slot: ClassTimetableSlot = {
      id: `tt-${Date.now()}`,
      gradeCode: timetableGrade,
      stream: 'Stream A',
      dayOfWeek: newSlotForm.dayOfWeek,
      startTime: newSlotForm.startTime,
      endTime: newSlotForm.endTime,
      subjectName: newSlotForm.subjectName,
      teacherName: newSlotForm.teacherName,
      room: newSlotForm.room,
    };
    const next = saveClassTimetables([...timetables, slot]);
    setTimetables(next);
    flash(`Added timetable period for ${timetableGrade} on ${slot.dayOfWeek}.`);
  };

  const handleSaveExamFormula = (e: React.FormEvent) => {
    e.preventDefault();
    const saved = saveExamConfig(examCfg);
    setExamCfg(saved);
    flash('Assessment formula saved & existing marks dynamically recalculated!');
  };

  const handleUpdateFeeRow = (id: string, field: 'tuitionFee' | 'lunchFee' | 'transportFee' | 'materialsFee', val: number) => {
    const next = feeStructures.map((row) => {
      if (row.id !== id) return row;
      const updated = { ...row, [field]: Math.max(0, Number(val) || 0) };
      updated.totalExpected = updated.tuitionFee + updated.lunchFee + updated.transportFee + updated.materialsFee;
      return updated;
    });
    setFeeStructures(next);
  };

  const handlePersistFeeStructures = () => {
    saveFeeStructures(feeStructures);
    flash('Official term fee structure saved across Finance & Parent Portals.');
  };

  const tabs: Array<{ id: SubTab; label: string; icon: React.ReactNode; show?: boolean }> = [
    { id: 'years', label: 'Years & Terms', icon: <Calendar size={14} /> },
    { id: 'classes', label: 'Classes & Streams', icon: <Layers size={14} /> },
    { id: 'subjects', label: 'REB Subjects', icon: <BookOpen size={14} /> },
    { id: 'assignments', label: 'Teacher Assignments', icon: <UserCheck size={14} /> },
    { id: 'timetables', label: 'Class Timetables', icon: <Clock size={14} /> },
    { id: 'formula', label: 'Exam & CAT Formula', icon: <Sliders size={14} />, show: canConfigureExam },
    { id: 'fees', label: 'Fee Structures', icon: <Wallet size={14} />, show: canManageFees },
  ];

  return (
    <div className="space-y-6">
      {/* Header & Sub-Navigation */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
            Academic Management & Curriculum Architecture
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Configure academic calendars, Nursery–P6 streams, REB subjects, teacher allocations, timetables, and grading rules.
          </p>
        </div>
        {bannerMsg && (
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-medium">
            <CheckCircle2 size={14} className="shrink-0" />
            <span>{bannerMsg}</span>
          </div>
        )}
      </div>

      {/* Horizontal Tabs */}
      <div className="flex flex-wrap gap-1.5 bg-slate-100 dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800">
        {tabs
          .filter((t) => t.show !== false)
          .map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                subTab === t.id
                  ? 'bg-blue-900 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
      </div>

      {/* 1. ACADEMIC YEARS & TERMS */}
      {subTab === 'years' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form
            onSubmit={handleAddYearTerm}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 h-fit"
          >
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Add Academic Year / Term</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Academic Year</label>
                <input
                  type="text"
                  required
                  value={newYearForm.academicYear}
                  onChange={(e) => setNewYearForm({ ...newYearForm, academicYear: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Term</label>
                <select
                  value={newYearForm.termName}
                  onChange={(e) => setNewYearForm({ ...newYearForm, termName: e.target.value as AcademicYearTerm['termName'] })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                >
                  <option value="Term 1">Term 1</option>
                  <option value="Term 2">Term 2</option>
                  <option value="Term 3">Term 3</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Start Date</label>
                <input
                  type="date"
                  required
                  value={newYearForm.startDate}
                  onChange={(e) => setNewYearForm({ ...newYearForm, startDate: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">End Date</label>
                <input
                  type="date"
                  required
                  value={newYearForm.endDate}
                  onChange={(e) => setNewYearForm({ ...newYearForm, endDate: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-900 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              <Plus size={14} /> Add Academic Term
            </button>
          </form>

          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Academic Calendar Registry</h3>
              <span className="text-xs text-slate-500 tabular-nums">{yearsTerms.length} terms</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Year & Term</th>
                    <th className="py-3 px-4 font-semibold">Duration</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {yearsTerms.map((yt) => (
                    <tr key={yt.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white tabular-nums">
                        {yt.academicYear} · {yt.termName}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300 tabular-nums">
                        {yt.startDate} to {yt.endDate}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`font-semibold ${
                            yt.isCurrent
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : yt.status === 'Upcoming'
                              ? 'text-blue-700 dark:text-blue-400'
                              : 'text-slate-500'
                          }`}
                        >
                          {yt.isCurrent ? 'Current Active Term' : yt.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                        {!yt.isCurrent && (
                          <button
                            type="button"
                            onClick={() => handleSetCurrentTerm(yt.id)}
                            className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-600 text-white rounded text-[11px] font-semibold cursor-pointer"
                          >
                            Set Current
                          </button>
                        )}
                        {!yt.isCurrent && (
                          <button
                            type="button"
                            onClick={() => setYearsTerms(saveAcademicYearsTerms(yearsTerms.filter((x) => x.id !== yt.id)))}
                            className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-950 rounded cursor-pointer"
                            aria-label="Delete term"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. CLASSES & STREAMS */}
      {subTab === 'classes' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form
            onSubmit={handleAddClassStream}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 h-fit"
          >
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Create Class Stream</h3>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Grade Level</label>
              <select
                value={newClassForm.gradeCode}
                onChange={(e) => setNewClassForm({ ...newClassForm, gradeCode: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              >
                {ACADEMIC_GRADES.map((g) => (
                  <option key={g.code} value={g.code}>{g.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Stream Name</label>
                <input
                  type="text"
                  required
                  value={newClassForm.streamName}
                  onChange={(e) => setNewClassForm({ ...newClassForm, streamName: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Capacity</label>
                <input
                  type="number"
                  min={10}
                  max={60}
                  value={newClassForm.capacity}
                  onChange={(e) => setNewClassForm({ ...newClassForm, capacity: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white tabular-nums"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Room / Block</label>
              <input
                type="text"
                required
                value={newClassForm.roomName}
                onChange={(e) => setNewClassForm({ ...newClassForm, roomName: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Homeroom Teacher</label>
              <select
                value={newClassForm.classTeacherId}
                onChange={(e) => setNewClassForm({ ...newClassForm, classTeacherId: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              >
                <option value="">Select Teacher (Optional)</option>
                {staffTeachers.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-900 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              <Plus size={14} /> Add Class Stream
            </button>
          </form>

          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Active Classes & Streams (Nursery – P6)</h3>
              <span className="text-xs text-slate-500 tabular-nums">{classes.length} streams</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Class & Stream</th>
                    <th className="py-3 px-4 font-semibold">Room</th>
                    <th className="py-3 px-4 font-semibold">Cap.</th>
                    <th className="py-3 px-4 font-semibold">Class Teacher</th>
                    <th className="py-3 px-4 font-semibold text-right">Remove</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {classes.map((cls) => (
                    <tr key={cls.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                        {cls.gradeName} · {cls.streamName}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{cls.roomName}</td>
                      <td className="py-3 px-4 tabular-nums text-slate-700 dark:text-slate-300">{cls.capacity}</td>
                      <td className="py-3 px-4">
                        <select
                          value={cls.classTeacherId || ''}
                          onChange={(e) => handleUpdateClassTeacher(cls.id, e.target.value)}
                          className="px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200"
                        >
                          <option value="">{cls.classTeacherName || 'Unassigned'}</option>
                          {staffTeachers.map((t) => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setClasses(saveClassStreams(classes.filter((x) => x.id !== cls.id)))}
                          className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-950 rounded cursor-pointer"
                          aria-label="Remove stream"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. SUBJECTS */}
      {subTab === 'subjects' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form
            onSubmit={handleAddSubject}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 h-fit"
          >
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Register REB Subject</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. KIS"
                  value={newSubjectForm.code}
                  onChange={(e) => setNewSubjectForm({ ...newSubjectForm, code: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white uppercase"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Subject Name</label>
                <input
                  type="text"
                  required
                  placeholder="Kiswahili"
                  value={newSubjectForm.name}
                  onChange={(e) => setNewSubjectForm({ ...newSubjectForm, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Level Scope</label>
                <select
                  value={newSubjectForm.level}
                  onChange={(e) => setNewSubjectForm({ ...newSubjectForm, level: e.target.value as SchoolSubject['level'] })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                >
                  <option value="All">All (Nursery & Primary)</option>
                  <option value="Nursery">Nursery Only</option>
                  <option value="Lower Primary">Lower Primary (P1–P3)</option>
                  <option value="Upper Primary">Upper Primary (P4–P6)</option>
                  <option value="All Primary">All Primary (P1–P6)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Max Weight / Coeff.</label>
                <input
                  type="number"
                  min={10}
                  max={200}
                  value={newSubjectForm.coefficient}
                  onChange={(e) => setNewSubjectForm({ ...newSubjectForm, coefficient: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white tabular-nums"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={newSubjectForm.isCore}
                onChange={(e) => setNewSubjectForm({ ...newSubjectForm, isCore: e.target.checked })}
              />
              <span>Core National Exam Subject (PLE / REB)</span>
            </label>
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-900 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              <Plus size={14} /> Add Subject
            </button>
          </form>

          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Approved Curriculum Subjects</h3>
              <span className="text-xs text-slate-500 tabular-nums">{subjects.length} subjects</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Code</th>
                    <th className="py-3 px-4 font-semibold">Subject</th>
                    <th className="py-3 px-4 font-semibold">Level</th>
                    <th className="py-3 px-4 font-semibold">Type</th>
                    <th className="py-3 px-4 font-semibold text-right">Remove</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {subjects.map((sub) => (
                    <tr key={sub.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="py-3 px-4 font-mono font-bold text-blue-900 dark:text-blue-300">{sub.code}</td>
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">{sub.name}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{sub.level}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                        {sub.isCore ? 'Core REB' : 'Enrichment'} · {sub.coefficient} pts
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setSubjects(saveSchoolSubjects(subjects.filter((x) => x.id !== sub.id)))}
                          className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-950 rounded cursor-pointer"
                          aria-label="Remove subject"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. TEACHER ASSIGNMENTS */}
      {subTab === 'assignments' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form
            onSubmit={handleAddAssignment}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 h-fit"
          >
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Assign Teacher to Class & Subject</h3>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Teacher</label>
              <select
                required
                value={newAssignForm.teacherId}
                onChange={(e) => setNewAssignForm({ ...newAssignForm, teacherId: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              >
                {staffTeachers.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.assignedSubjectOrGrade || t.role})</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Class</label>
                <select
                  value={newAssignForm.gradeCode}
                  onChange={(e) => setNewAssignForm({ ...newAssignForm, gradeCode: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                >
                  {ACADEMIC_GRADES.map((g) => (
                    <option key={g.code} value={g.code}>{g.code} · {g.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Stream</label>
                <input
                  type="text"
                  value={newAssignForm.stream}
                  onChange={(e) => setNewAssignForm({ ...newAssignForm, stream: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Subject</label>
              <select
                value={newAssignForm.subjectCode}
                onChange={(e) => setNewAssignForm({ ...newAssignForm, subjectCode: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.code}>{s.code} · {s.name}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-900 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              <Plus size={14} /> Assign Subject Teacher
            </button>
          </form>

          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Teacher–Subject–Class Matrix</h3>
              <span className="text-xs text-slate-500 tabular-nums">{assignments.length} active allocations</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Teacher</th>
                    <th className="py-3 px-4 font-semibold">Class & Stream</th>
                    <th className="py-3 px-4 font-semibold">Subject</th>
                    <th className="py-3 px-4 font-semibold text-right">Revoke</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {assignments.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">{a.teacherName}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{a.gradeCode} · {a.stream}</td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-200">{a.subjectName}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setAssignments(saveTeacherAssignments(assignments.filter((x) => x.id !== a.id)))}
                          className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-950 rounded cursor-pointer"
                          aria-label="Revoke assignment"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 5. CLASS TIMETABLES */}
      {subTab === 'timetables' && (
        <div className="space-y-5">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Filter Class Timetable:</label>
              <select
                value={timetableGrade}
                onChange={(e) => setTimetableGrade(e.target.value)}
                className="px-3 py-2 text-sm font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              >
                {ACADEMIC_GRADES.map((g) => (
                  <option key={g.code} value={g.code}>{g.name}</option>
                ))}
              </select>
            </div>
            <form onSubmit={handleAddTimetableSlot} className="flex flex-wrap items-center gap-2">
              <select
                value={newSlotForm.dayOfWeek}
                onChange={(e) => setNewSlotForm({ ...newSlotForm, dayOfWeek: e.target.value as ClassTimetableSlot['dayOfWeek'] })}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
              >
                {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <input
                type="time"
                value={newSlotForm.startTime}
                onChange={(e) => setNewSlotForm({ ...newSlotForm, startTime: e.target.value })}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
              <input
                type="time"
                value={newSlotForm.endTime}
                onChange={(e) => setNewSlotForm({ ...newSlotForm, endTime: e.target.value })}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
              <select
                value={newSlotForm.subjectName}
                onChange={(e) => setNewSlotForm({ ...newSlotForm, subjectName: e.target.value })}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
              >
                {subjects.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
              <input
                type="text"
                placeholder="Teacher"
                value={newSlotForm.teacherName}
                onChange={(e) => setNewSlotForm({ ...newSlotForm, teacherName: e.target.value })}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 w-36"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-900 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                <Plus size={13} /> Add Slot
              </button>
            </form>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {DAYS.map((day) => {
              const slots = timetables
                .filter((s) => s.gradeCode === timetableGrade && s.dayOfWeek === day)
                .sort((a, b) => a.startTime.localeCompare(b.startTime));
              return (
                <div
                  key={day}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                    <span className="text-xs font-bold text-blue-900 dark:text-blue-300 uppercase tracking-wider">{day}</span>
                    <span className="text-[11px] text-slate-400 tabular-nums">{slots.length} periods</span>
                  </div>
                  {slots.length === 0 ? (
                    <p className="text-xs text-slate-400 py-4 text-center">No scheduled periods.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {slots.map((slot) => (
                        <div
                          key={slot.id}
                          className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                              {slot.startTime}–{slot.endTime}
                            </span>
                            <button
                              type="button"
                              onClick={() => setTimetables(saveClassTimetables(timetables.filter((x) => x.id !== slot.id)))}
                              className="text-red-500 hover:text-red-700 cursor-pointer"
                              aria-label="Delete period"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                          <p className="font-semibold text-slate-900 dark:text-white leading-snug">{slot.subjectName}</p>
                          <p className="text-[11px] text-slate-500">{slot.teacherName} · {slot.room}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 6. CONFIGURABLE EXAM & CAT FORMULA + GRADING SCALE */}
      {subTab === 'formula' && canConfigureExam && (
        <form onSubmit={handleSaveExamFormula} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Configurable CAT + Examination Weighting Rule
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Adjust school-wide assessment percentages, maximum scores, rounding, and REB letter grade boundaries. Saving automatically recalculates recorded marks.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setExamCfg(DEFAULT_EXAM_CONFIG)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                <RotateCcw size={13} /> Reset Defaults
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">CAT Weight (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={examCfg.catWeightPercent}
                  onChange={(e) => setExamCfg({ ...examCfg, catWeightPercent: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-sm font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Final Exam Weight (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={examCfg.examWeightPercent}
                  onChange={(e) => setExamCfg({ ...examCfg, examWeightPercent: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-sm font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Pass Mark (%)</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={examCfg.passMarkPercent}
                  onChange={(e) => setExamCfg({ ...examCfg, passMarkPercent: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-sm font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">CAT Max Raw Score</label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={examCfg.catMaxMarks}
                  onChange={(e) => setExamCfg({ ...examCfg, catMaxMarks: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-sm font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Exam Max Raw Score</label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={examCfg.examMaxMarks}
                  onChange={(e) => setExamCfg({ ...examCfg, examMaxMarks: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-sm font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Rounding Mode</label>
                <select
                  value={examCfg.roundingMode}
                  onChange={(e) => setExamCfg({ ...examCfg, roundingMode: e.target.value as ExamConfig['roundingMode'] })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                >
                  <option value="one_decimal">One Decimal (85.4%)</option>
                  <option value="nearest">Nearest Whole (85%)</option>
                  <option value="floor">Floor Whole (85%)</option>
                </select>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Grading Scale Boundaries</h4>
              <div className="space-y-2">
                {examCfg.gradingScale.map((band, idx) => (
                  <div key={band.grade} className="grid grid-cols-12 gap-2 items-center text-xs">
                    <div className="col-span-2 font-bold text-center py-2 bg-blue-950 text-amber-400 rounded-lg">
                      {band.grade}
                    </div>
                    <div className="col-span-3">
                      <input
                        type="number"
                        step="0.1"
                        value={band.minPercent}
                        onChange={(e) => {
                          const nextScale = examCfg.gradingScale.map((b, i) =>
                            i === idx ? { ...b, minPercent: Number(e.target.value) } : b
                          );
                          setExamCfg({ ...examCfg, gradingScale: nextScale });
                        }}
                        className="w-full px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 tabular-nums"
                      />
                    </div>
                    <div className="col-span-3">
                      <input
                        type="number"
                        step="0.01"
                        value={band.maxPercent}
                        onChange={(e) => {
                          const nextScale = examCfg.gradingScale.map((b, i) =>
                            i === idx ? { ...b, maxPercent: Number(e.target.value) } : b
                          );
                          setExamCfg({ ...examCfg, gradingScale: nextScale });
                        }}
                        className="w-full px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 tabular-nums"
                      />
                    </div>
                    <div className="col-span-4">
                      <input
                        type="text"
                        value={band.remark}
                        onChange={(e) => {
                          const nextScale = examCfg.gradingScale.map((b, i) =>
                            i === idx ? { ...b, remark: e.target.value } : b
                          );
                          setExamCfg({ ...examCfg, gradingScale: nextScale });
                        }}
                        className="w-full px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              <Save size={14} /> Save Formula & Recalculate All Marks
            </button>
          </div>

          <div className="bg-blue-950 text-white rounded-xl p-6 space-y-5 h-fit border border-blue-900">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">Live Formula Preview</p>
              <h4 className="text-base font-bold mt-1">
                ({examCfg.catWeightPercent}% CAT + {examCfg.examWeightPercent}% Exam)
              </h4>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-blue-200 mb-1">Test CAT Score (out of {examCfg.catMaxMarks})</label>
                <input
                  type="number"
                  min={0}
                  max={examCfg.catMaxMarks}
                  value={previewCat}
                  onChange={(e) => setPreviewCat(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-blue-900 border border-blue-800 text-white tabular-nums"
                />
              </div>
              <div>
                <label className="block text-blue-200 mb-1">Test Exam Score (out of {examCfg.examMaxMarks})</label>
                <input
                  type="number"
                  min={0}
                  max={examCfg.examMaxMarks}
                  value={previewExam}
                  onChange={(e) => setPreviewExam(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-blue-900 border border-blue-800 text-white tabular-nums"
                />
              </div>
            </div>
            <div className="p-4 rounded-xl bg-blue-900/70 border border-blue-800 space-y-1">
              <p className="text-xs text-blue-200">Computed Final Score</p>
              <p className="text-3xl font-bold text-amber-400 tabular-nums">{previewResult.totalPercent}%</p>
              <p className="text-xs font-semibold text-emerald-300">
                Grade {previewResult.gradeLetter} · {previewResult.remark}
              </p>
            </div>
          </div>
        </form>
      )}

      {/* 7. FEE STRUCTURES */}
      {subTab === 'fees' && canManageFees && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Per-Grade Term Fee Schedule (RWF)</h3>
              <p className="text-xs text-slate-500">Used by Finance & Parent Portals to compute outstanding balances.</p>
            </div>
            <button
              type="button"
              onClick={handlePersistFeeStructures}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              <Save size={14} /> Save Fee Schedule
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-semibold">Class</th>
                  <th className="py-3 px-4 font-semibold">Tuition (RWF)</th>
                  <th className="py-3 px-4 font-semibold">Lunch Program</th>
                  <th className="py-3 px-4 font-semibold">Transport</th>
                  <th className="py-3 px-4 font-semibold">Materials</th>
                  <th className="py-3 px-4 font-semibold text-right">Total Term Fee</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {feeStructures.map((row) => (
                  <tr key={row.id}>
                    <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-white">{row.gradeName}</td>
                    <td className="py-2.5 px-4">
                      <input
                        type="number"
                        value={row.tuitionFee}
                        onChange={(e) => handleUpdateFeeRow(row.id, 'tuitionFee', Number(e.target.value))}
                        className="w-28 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 tabular-nums"
                      />
                    </td>
                    <td className="py-2.5 px-4">
                      <input
                        type="number"
                        value={row.lunchFee}
                        onChange={(e) => handleUpdateFeeRow(row.id, 'lunchFee', Number(e.target.value))}
                        className="w-28 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 tabular-nums"
                      />
                    </td>
                    <td className="py-2.5 px-4">
                      <input
                        type="number"
                        value={row.transportFee}
                        onChange={(e) => handleUpdateFeeRow(row.id, 'transportFee', Number(e.target.value))}
                        className="w-28 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 tabular-nums"
                      />
                    </td>
                    <td className="py-2.5 px-4">
                      <input
                        type="number"
                        value={row.materialsFee}
                        onChange={(e) => handleUpdateFeeRow(row.id, 'materialsFee', Number(e.target.value))}
                        className="w-28 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 tabular-nums"
                      />
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold text-blue-900 dark:text-amber-400 tabular-nums">
                      {row.totalExpected.toLocaleString()} RWF
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
