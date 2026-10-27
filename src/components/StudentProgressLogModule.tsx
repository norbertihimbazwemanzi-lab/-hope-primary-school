import React, { useState, useEffect, useMemo } from 'react';
import { EnrolledStudent, getCurrentSessionUser } from '../services/adminStore';
import {
  StudentProgressLog,
  saveStudentProgressLogToFirebase,
  fetchStudentProgressLogs,
  deleteStudentProgressLogInFirebase,
} from '../services/firebaseStore';
import {
  BookOpen,
  Sparkles,
  CheckCircle2,
  Calendar,
  User,
  Search,
  Award,
  Heart,
  TrendingUp,
  AlertCircle,
  Trash2,
  Download,
  Flame,
  MessageSquare,
  FileSpreadsheet,
  Clock,
  ShieldCheck,
  ChevronDown,
  RefreshCw,
  Copy,
  Check,
  BarChart2,
  PieChart,
} from 'lucide-react';

interface StudentProgressLogModuleProps {
  students: EnrolledStudent[];
  activeGrade: string;
  initialSelectedStudent?: EnrolledStudent | null;
  onClose?: () => void;
}

const SUBJECT_OPTIONS = [
  'Mathematics',
  'English Language',
  'Science & Technology',
  'Social Studies',
  'Kinyarwanda',
  'Creative Arts & Music',
  'Physical Education & Sports',
  'General Class Performance',
];

export const StudentProgressLogModule: React.FC<StudentProgressLogModuleProps> = ({
  students,
  activeGrade,
  initialSelectedStudent,
  onClose,
}) => {
  const sessionUser = getCurrentSessionUser();

  // Class students only
  const classStudents = useMemo(() => {
    return students.filter((s) => s.gradeCode === activeGrade);
  }, [students, activeGrade]);

  // Selected student for new log
  const [selectedStudentId, setSelectedStudentId] = useState<string>(() => {
    if (initialSelectedStudent) return initialSelectedStudent.id;
    return classStudents.length > 0 ? classStudents[0].id : '';
  });

  const selectedStudent = useMemo(() => {
    return classStudents.find((s) => s.id === selectedStudentId) || classStudents[0] || null;
  }, [classStudents, selectedStudentId]);

  // Form State
  const [logDate, setLogDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [subject, setSubject] = useState<string>('Mathematics');
  const [academicPerformance, setAcademicPerformance] = useState<StudentProgressLog['academicPerformance']>('Proficient');
  const [academicScore, setAcademicScore] = useState<number | ''>(85);
  const [academicNotes, setAcademicNotes] = useState<string>('');
  const [behaviorRating, setBehaviorRating] = useState<StudentProgressLog['behaviorRating']>('Good');
  const [behavioralNotes, setBehavioralNotes] = useState<string>('');
  const [actionOrRecommendation, setActionOrRecommendation] = useState<string>('');
  const [parentNotified, setParentNotified] = useState<boolean>(false);

  // Status & Feedback
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Existing Logs State from Firebase
  const [logs, setLogs] = useState<StudentProgressLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [filterStudentQuery, setFilterStudentQuery] = useState('');
  const [filterSubject, setFilterSubject] = useState('ALL');
  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');

  // Load logs on mount
  const loadLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const records = await fetchStudentProgressLogs(activeGrade);
      setLogs(records);
    } catch (e) {
      console.warn('Failed to load logs:', e);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [activeGrade]);

  // Handle Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) {
      alert('Please select a student.');
      return;
    }

    if (!academicNotes.trim()) {
      alert('Please enter daily academic performance notes for this student.');
      return;
    }

    setIsSaving(true);
    setSaveSuccessMsg(null);

    try {
      const saved = await saveStudentProgressLogToFirebase({
        studentId: selectedStudent.id,
        studentName: selectedStudent.fullName,
        regNumber: selectedStudent.regNumber,
        gradeCode: selectedStudent.gradeCode,
        stream: 'Stream A',
        date: logDate,
        teacherId: sessionUser?.id || 'staff-teacher-1',
        teacherName: sessionUser?.name || 'Class Teacher',
        subject,
        academicPerformance,
        academicScore: academicScore === '' ? undefined : Number(academicScore),
        academicNotes: academicNotes.trim(),
        behaviorRating,
        behavioralNotes: behavioralNotes.trim(),
        actionOrRecommendation: actionOrRecommendation.trim(),
        parentNotified,
      });

      // Update state
      setLogs((prev) => [saved, ...prev.filter((l) => l.id !== saved.id)]);
      setSaveSuccessMsg(`Daily progress log for ${selectedStudent.fullName} successfully saved to Firebase store!`);

      // Reset textareas
      setAcademicNotes('');
      setBehavioralNotes('');
      setActionOrRecommendation('');
      setParentNotified(false);
    } catch (err: any) {
      console.error('Error saving progress log:', err);
      alert('Failed to save progress log. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Log Deletion
  const handleDeleteLog = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete this progress log for ${name}?`)) {
      await deleteStudentProgressLogInFirebase(id);
      setLogs((prev) => prev.filter((l) => l.id !== id));
    }
  };

  // Filtered Logs for History tab
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (filterSubject !== 'ALL' && log.subject !== filterSubject) return false;
      if (!filterStudentQuery.trim()) return true;
      const q = filterStudentQuery.toLowerCase();
      return (
        log.studentName.toLowerCase().includes(q) ||
        log.regNumber.toLowerCase().includes(q) ||
        log.academicNotes.toLowerCase().includes(q) ||
        log.behavioralNotes.toLowerCase().includes(q)
      );
    });
  }, [logs, filterSubject, filterStudentQuery]);

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      'Date',
      'Student Name',
      'Reg Number',
      'Class',
      'Subject',
      'Academic Rating',
      'Academic Score (%)',
      'Academic Notes',
      'Behavior Rating',
      'Behavior Notes',
      'Action / Recommendation',
      'Teacher',
    ];

    const rows = filteredLogs.map((l) => [
      `"${l.date}"`,
      `"${l.studentName.replace(/"/g, '""')}"`,
      `"${l.regNumber}"`,
      `"${l.gradeCode}"`,
      `"${l.subject}"`,
      `"${l.academicPerformance}"`,
      `"${l.academicScore ?? 'N/A'}"`,
      `"${(l.academicNotes || '').replace(/"/g, '""')}"`,
      `"${l.behaviorRating}"`,
      `"${(l.behavioralNotes || '').replace(/"/g, '""')}"`,
      `"${(l.actionOrRecommendation || '').replace(/"/g, '""')}"`,
      `"${l.teacherName}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Student_Progress_Logs_${activeGrade}_${logDate}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Copy Parent Report Snippet
  const handleCopyParentReport = (log: StudentProgressLog) => {
    const text = `*Mugina Hope Academy - Daily Student Progress Note*\nLearner: ${log.studentName} (${log.gradeCode})\nDate: ${log.date}\nSubject: ${log.subject}\nAcademic Performance: ${log.academicPerformance} ${log.academicScore ? `(${log.academicScore}%)` : ''}\nTeacher Academic Notes: "${log.academicNotes}"\nBehavior & Conduct: ${log.behaviorRating}\nBehavior Notes: "${log.behavioralNotes || 'Normal positive conduct'}"\nTeacher Recommendation: ${log.actionOrRecommendation || 'Keep up the good effort!'}\nClass Teacher: ${log.teacherName}`;
    navigator.clipboard.writeText(text);
    setCopiedId(log.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 p-6 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-700/60 rounded-xl">
              <BookOpen className="w-5 h-5 text-amber-300" />
            </span>
            <h2 className="text-lg font-black tracking-tight font-display">
              Student Progress Log
            </h2>
            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>Official Academic Registry</span>
            </span>
          </div>
          <p className="text-xs text-indigo-200 mt-1 max-w-2xl">
            Record daily academic performance, subject comprehension, and behavioral conduct notes for learners in{' '}
            <strong className="text-amber-300">{activeGrade}</strong>. All entries persist across all devices.
          </p>
        </div>

        {/* Tab Switcher & Export */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'create'
                ? 'bg-amber-400 text-slate-950 shadow-md font-black'
                : 'bg-indigo-800/80 hover:bg-indigo-700 text-indigo-100'
            }`}
          >
            + Record New Log
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('history');
              loadLogs();
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'bg-amber-400 text-slate-950 shadow-md font-black'
                : 'bg-indigo-800/80 hover:bg-indigo-700 text-indigo-100'
            }`}
          >
            <span>View Log History ({logs.length})</span>
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-indigo-200 hover:text-white rounded-xl hover:bg-white/10"
              title="Close"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-6">
        {saveSuccessMsg && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl flex items-center justify-between gap-3 text-xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span className="font-semibold">{saveSuccessMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setSaveSuccessMsg(null)}
              className="text-emerald-700 hover:text-emerald-900 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SUBTAB 1: CREATE DAILY LOG */}
        {/* ========================================================================= */}
        {activeTab === 'create' && (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 1. Student Selection Grid */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                1. Select Learner from Assigned Class ({activeGrade}) *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-56 overflow-y-auto p-1 border border-slate-200 rounded-2xl bg-slate-50">
                {classStudents.map((st) => {
                  const isSelected = selectedStudentId === st.id;
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => {
                        setSelectedStudentId(st.id);
                        setSaveSuccessMsg(null);
                      }}
                      className={`p-3 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-700 shadow-md ring-2 ring-indigo-400/40'
                          : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] font-mono font-bold ${isSelected ? 'text-indigo-200' : 'text-blue-600'}`}>
                            {st.regNumber}
                          </span>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${isSelected ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
                            {st.gender}
                          </span>
                        </div>
                        <strong className="block text-xs font-bold mt-1 line-clamp-1">
                          {st.fullName}
                        </strong>
                      </div>
                      <span className={`text-[10px] mt-2 block ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
                        Parent: {st.parentName || 'Guardian'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Student Active Card */}
            {selectedStudent && (
              <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white font-black flex items-center justify-center font-display text-sm shadow-xs">
                    {selectedStudent.fullName.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-indigo-950 text-sm">
                      Logging Progress for: <strong>{selectedStudent.fullName}</strong>
                    </h3>
                    <p className="text-slate-600 text-[11px] mt-0.5">
                      Reg ID: <code className="font-bold text-indigo-700">{selectedStudent.regNumber}</code> • Class: <strong>{selectedStudent.gradeCode}</strong> • Parent: <strong>{selectedStudent.parentName}</strong> ({selectedStudent.parentPhone})
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 bg-white border border-indigo-200 text-indigo-800 rounded-xl font-bold text-[11px] shadow-2xs">
                    Class Teacher: {sessionUser?.name || 'Class Teacher'}
                  </span>
                </div>
              </div>
            )}

            {/* 2. Date & Subject Details */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Observation Date *
                </label>
                <div className="relative">
                  <input
                    type="date"
                    required
                    value={logDate}
                    onChange={(e) => setLogDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-semibold focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Academic Subject *
                </label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-semibold focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                >
                  {SUBJECT_OPTIONS.map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Optional Assessment Score (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  placeholder="e.g. 85"
                  value={academicScore}
                  onChange={(e) => setAcademicScore(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-semibold focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* 3. Academic Performance & Notes */}
            <div className="space-y-2 border border-slate-200 p-5 rounded-2xl bg-white shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-indigo-600" />
                  <span>Academic Performance & Mastery Level *</span>
                </label>
                <div className="flex flex-wrap items-center gap-1.5">
                  {(['Excellent', 'Proficient', 'Developing', 'Needs Support'] as const).map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setAcademicPerformance(level)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                        academicPerformance === level
                          ? level === 'Excellent'
                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                            : level === 'Proficient'
                            ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                            : level === 'Developing'
                            ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-xs'
                            : 'bg-rose-600 text-white border-rose-700 shadow-xs'
                          : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <textarea
                  required
                  rows={3}
                  value={academicNotes}
                  onChange={(e) => setAcademicNotes(e.target.value)}
                  placeholder="e.g. Grasped today's multiplication table of 7 with ease. Solved 8 word problems independently and helped a peer during group work."
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400"
                />
                <span className="text-[10px] text-slate-400 block mt-1">
                  Specify learning progress, topic comprehension, homework feedback, and areas of strength.
                </span>
              </div>
            </div>

            {/* 4. Behavioral & Conduct Notes */}
            <div className="space-y-2 border border-slate-200 p-5 rounded-2xl bg-white shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-1.5">
                  <Heart className="w-4 h-4 text-rose-500" />
                  <span>Classroom Conduct & Behavioral Attitude *</span>
                </label>
                <div className="flex flex-wrap items-center gap-1.5">
                  {(['Exemplary', 'Good', 'Fair', 'Needs Improvement', 'Concern'] as const).map((rating) => (
                    <button
                      key={rating}
                      type="button"
                      onClick={() => setBehaviorRating(rating)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                        behaviorRating === rating
                          ? rating === 'Exemplary'
                            ? 'bg-purple-600 text-white border-purple-700 shadow-xs'
                            : rating === 'Good'
                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                            : rating === 'Fair'
                            ? 'bg-slate-700 text-white border-slate-800 shadow-xs'
                            : rating === 'Needs Improvement'
                            ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-xs'
                            : 'bg-rose-600 text-white border-rose-700 shadow-xs'
                          : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200'
                      }`}
                    >
                      {rating}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <textarea
                  rows={2}
                  value={behavioralNotes}
                  onChange={(e) => setBehavioralNotes(e.target.value)}
                  placeholder="e.g. Very respectful, actively raised hand before speaking, showed great focus during afternoon lessons."
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* 5. Teacher Recommendation & Follow-up */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Teacher Recommendation / Action Plan
                </label>
                <input
                  type="text"
                  value={actionOrRecommendation}
                  onChange={(e) => setActionOrRecommendation(e.target.value)}
                  placeholder="e.g. Extra 15 mins reading practice at home; excellent presentation skill."
                  className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-end">
                <label className="flex items-center gap-2 p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl cursor-pointer w-full">
                  <input
                    type="checkbox"
                    checked={parentNotified}
                    onChange={(e) => setParentNotified(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-slate-700">
                    Flag for Parent WhatsApp/SMS
                  </span>
                </label>
              </div>
            </div>

            {/* Submit Action */}
            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100">
              <div className="flex items-center gap-2 text-slate-500 text-[11px]">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>
                  Saved directly to official school academic records
                </span>
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-3 bg-indigo-700 hover:bg-indigo-800 active:bg-indigo-900 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-amber-300" />
                    <span>Saving Progress Log...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                    <span>Save Daily Progress Log</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* ========================================================================= */}
        {/* SUBTAB 2: VIEW LOG HISTORY & PARENT EXPORTS */}
        {/* ========================================================================= */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            {/* Filter toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="Search learner, reg ID, notes..."
                    value={filterStudentQuery}
                    onChange={(e) => setFilterStudentQuery(e.target.value)}
                    className="pl-8 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 w-52 sm:w-64"
                  />
                </div>

                <select
                  value={filterSubject}
                  onChange={(e) => setFilterSubject(e.target.value)}
                  className="py-2 px-3 text-xs bg-white border border-slate-200 rounded-xl font-medium focus:outline-hidden"
                >
                  <option value="ALL">All Subjects</option>
                  {SUBJECT_OPTIONS.map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={loadLogs}
                  disabled={isLoadingLogs}
                  className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:text-indigo-600 cursor-pointer"
                  title="Reload Records"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLogs ? 'animate-spin' : ''}`} />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportCSV}
                  disabled={filteredLogs.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {/* Visual Performance & Behavior Chart Overview (When logs exist) */}
            {filteredLogs.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Academic Rating Breakdown */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <BarChart2 className="w-4 h-4 text-indigo-700" />
                      <h4 className="text-xs font-bold uppercase text-slate-700 tracking-wider">
                        Academic Performance Distribution
                      </h4>
                    </div>
                    <span className="text-[11px] font-mono font-bold text-slate-500">
                      {filteredLogs.length} Logged Entries
                    </span>
                  </div>
                  <div className="space-y-2">
                    {[
                      { key: 'Excellent', color: 'bg-emerald-500', text: 'text-emerald-800' },
                      { key: 'Proficient', color: 'bg-blue-500', text: 'text-blue-800' },
                      { key: 'Developing', color: 'bg-amber-500', text: 'text-amber-800' },
                      { key: 'Needs Support', color: 'bg-rose-500', text: 'text-rose-800' },
                    ].map(({ key, color, text }) => {
                      const count = filteredLogs.filter((l) => l.academicPerformance === key).length;
                      const pct = Math.round((count / filteredLogs.length) * 100);
                      return (
                        <div key={key}>
                          <div className="flex justify-between text-[11px] mb-0.5">
                            <span className={`font-semibold ${text}`}>{key}</span>
                            <span className="font-mono font-bold text-slate-600">{count} ({pct}%)</span>
                          </div>
                          <div className="h-2 w-full bg-slate-200/70 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${color} rounded-full transition-all duration-500`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Behavioral Conduct & Assessment Average */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <PieChart className="w-4 h-4 text-purple-700" />
                      <h4 className="text-xs font-bold uppercase text-slate-700 tracking-wider">
                        Classroom Conduct & Score Health
                      </h4>
                    </div>
                    {(() => {
                      const scoredLogs = filteredLogs.filter((l) => typeof l.academicScore === 'number');
                      if (scoredLogs.length === 0) return null;
                      const avg = Math.round(
                        scoredLogs.reduce((acc, curr) => acc + (curr.academicScore || 0), 0) / scoredLogs.length
                      );
                      return (
                        <span className="text-[11px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md font-mono">
                          Avg: {avg}%
                        </span>
                      );
                    })()}
                  </div>
                  <div className="space-y-2">
                    {[
                      { key: 'Exemplary', color: 'bg-purple-500', text: 'text-purple-800' },
                      { key: 'Good', color: 'bg-emerald-500', text: 'text-emerald-800' },
                      { key: 'Fair', color: 'bg-slate-500', text: 'text-slate-800' },
                      { key: 'Needs Attention', color: 'bg-rose-500', text: 'text-rose-800' },
                    ].map(({ key, color, text }) => {
                      const count = filteredLogs.filter((l) => l.behaviorRating === key).length;
                      const pct = Math.round((count / filteredLogs.length) * 100);
                      return (
                        <div key={key}>
                          <div className="flex justify-between text-[11px] mb-0.5">
                            <span className={`font-semibold ${text}`}>{key}</span>
                            <span className="font-mono font-bold text-slate-600">{count} ({pct}%)</span>
                          </div>
                          <div className="h-2 w-full bg-slate-200/70 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${color} rounded-full transition-all duration-500`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Logs List */}
            {filteredLogs.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-3xl space-y-2">
                <BookOpen className="w-10 h-10 text-slate-300 mx-auto" />
                <h4 className="text-sm font-bold text-slate-700">No Student Progress Logs Found</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  No progress logs have been recorded yet for class {activeGrade}. Switch to "Record New Log" to add your first observation.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('create')}
                  className="mt-3 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                >
                  <span>+ Record New Log</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-5 bg-white border border-slate-200 hover:border-indigo-300 rounded-2xl shadow-2xs transition-all space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2.5">
                        <span className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-800 font-black text-xs flex items-center justify-center font-display">
                          {log.studentName.charAt(0)}
                        </span>
                        <div>
                          <strong className="text-xs font-bold text-slate-900">
                            {log.studentName}
                          </strong>
                          <span className="text-[11px] font-mono text-indigo-600 ml-2">
                            ({log.regNumber})
                          </span>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          {log.subject}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>{log.date}</span>
                        </span>

                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                            log.academicPerformance === 'Excellent'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : log.academicPerformance === 'Proficient'
                              ? 'bg-blue-50 text-blue-800 border-blue-300'
                              : log.academicPerformance === 'Developing'
                              ? 'bg-amber-50 text-amber-800 border-amber-300'
                              : 'bg-rose-50 text-rose-800 border-rose-300'
                          }`}
                        >
                          {log.academicPerformance} {log.academicScore ? `(${log.academicScore}%)` : ''}
                        </span>

                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                            log.behaviorRating === 'Exemplary'
                              ? 'bg-purple-50 text-purple-800 border-purple-300'
                              : log.behaviorRating === 'Good'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : log.behaviorRating === 'Fair'
                              ? 'bg-slate-50 text-slate-700 border-slate-300'
                              : 'bg-rose-50 text-rose-800 border-rose-300'
                          }`}
                        >
                          Behavior: {log.behaviorRating}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Academic Performance Notes:
                        </span>
                        <p className="text-slate-800 font-medium leading-relaxed">
                          {log.academicNotes}
                        </p>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Behavioral Observations & Conduct:
                        </span>
                        <p className="text-slate-800 font-medium leading-relaxed">
                          {log.behavioralNotes || 'Consistent good classroom demeanor.'}
                        </p>
                      </div>
                    </div>

                    {log.actionOrRecommendation && (
                      <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>
                          <strong>Recommendation / Action:</strong> {log.actionOrRecommendation}
                        </span>
                      </div>
                    )}

                    {/* Card Footer Actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                      <div>
                        Logged by: <strong>{log.teacherName}</strong>
                        {log.source === 'firebase-firestore' && (
                          <span className="ml-2 text-emerald-600 font-semibold text-[10px]">
                            • Verified
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleCopyParentReport(log)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-[10px] flex items-center gap-1 transition-colors cursor-pointer"
                          title="Copy summary message for Parent WhatsApp"
                        >
                          {copiedId === log.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span className="text-emerald-700">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy for Parent</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteLog(log.id, log.studentName)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer transition-colors"
                          title="Delete Log"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
