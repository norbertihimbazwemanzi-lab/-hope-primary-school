import React, { useEffect, useMemo, useState } from 'react';
import {
  FileSpreadsheet,
  Award,
  CalendarClock,
  CheckCircle2,
  Printer,
  Plus,
  Trash2,
  Search,
  Send,
} from 'lucide-react';
import {
  ExamScheduleItem,
  ExamMarkRecord,
  getAcademicYearsTerms,
  getSchoolSubjects,
  getTeacherAssignments,
  getExamConfig,
  getExamSchedules,
  saveExamSchedules,
  getExamMarks,
  saveExamMarks,
  upsertExamMark,
  calculateExamResult,
} from '../services/smsStore';
import {
  CurrentSessionUser,
  getEnrolledStudents,
  getAttendanceRecords,
} from '../services/adminStore';
import { ACADEMIC_GRADES } from '../data/schoolData';
import { exportStudentReportCardPDF } from '../services/reportCardPdf';
import { extractGradesFromAssignment, hasPermission } from '../services/rbac';

type ExamTab = 'marks' | 'schedules' | 'rankings' | 'report_cards';

interface ExaminationsModuleProps {
  currentUser: CurrentSessionUser;
  scopedToTeacher?: boolean;
}

export const ExaminationsModule: React.FC<ExaminationsModuleProps> = ({
  currentUser,
  scopedToTeacher = false,
}) => {
  const [tab, setTab] = useState<ExamTab>('marks');
  const [yearsTerms] = useState(() => getAcademicYearsTerms());
  const activeTermObj = yearsTerms.find((y) => y.isCurrent) || yearsTerms[0];

  const [selectedYear, setSelectedYear] = useState(activeTermObj?.academicYear || '2026');
  const [selectedTerm, setSelectedTerm] = useState<'Term 1' | 'Term 2' | 'Term 3'>(
    activeTermObj?.termName || 'Term 1'
  );

  const [subjects] = useState(() => getSchoolSubjects());
  const [assignments] = useState(() => getTeacherAssignments());
  const [examConfig, setExamConfig] = useState(() => getExamConfig());
  const [schedules, setSchedules] = useState<ExamScheduleItem[]>(() => getExamSchedules());
  const [marks, setMarks] = useState<ExamMarkRecord[]>(() => getExamMarks());
  const [students] = useState(() => getEnrolledStudents().filter((s) => s.status === 'Active'));
  const [attendance] = useState(() => getAttendanceRecords());

  const canApprove = hasPermission(currentUser, 'approve_exam_results') && !scopedToTeacher;

  // Determine teacher's allowed grades/subjects if scoped
  const allowedGrades = useMemo(() => {
    if (!scopedToTeacher) return ACADEMIC_GRADES.map((g) => g.code);
    const fromAssign = assignments
      .filter((a) => a.teacherId === currentUser.id || a.teacherName.toLowerCase() === currentUser.name.toLowerCase())
      .map((a) => a.gradeCode);
    const fromProfile = extractGradesFromAssignment(currentUser.assignedSubjectOrGrade);
    const combined = Array.from(new Set([...fromAssign, ...fromProfile]));
    return combined.length > 0 ? combined : ACADEMIC_GRADES.map((g) => g.code);
  }, [scopedToTeacher, assignments, currentUser]);

  const [selectedGrade, setSelectedGrade] = useState(allowedGrades[0] || 'P4');
  const [selectedSubjectCode, setSelectedSubjectCode] = useState(subjects[0]?.code || 'MATH');
  const [searchQuery, setSearchQuery] = useState('');
  const [draftEdits, setDraftEdits] = useState<Record<string, { cat: number; exam: number; comment: string }>>({});
  const [notice, setNotice] = useState<string | null>(null);

  const [scheduleForm, setScheduleForm] = useState({
    title: '',
    gradeCode: allowedGrades[0] || 'P4',
    subjectCode: subjects[0]?.code || 'MATH',
    examDate: new Date().toISOString().split('T')[0],
    startTime: '08:00',
    durationMinutes: 90,
    room: 'Wing B - Room 201',
    invigilator: currentUser.name,
  });

  useEffect(() => {
    const sync = () => {
      setExamConfig(getExamConfig());
      setSchedules(getExamSchedules());
      setMarks(getExamMarks());
    };
    window.addEventListener('mugina-sms-updated', sync);
    return () => window.removeEventListener('mugina-sms-updated', sync);
  }, []);

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3500);
  };

  const classStudents = useMemo(
    () =>
      students.filter(
        (s) =>
          s.gradeCode === selectedGrade &&
          (!searchQuery.trim() ||
            s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.regNumber.toLowerCase().includes(searchQuery.toLowerCase()))
      ),
    [students, selectedGrade, searchQuery]
  );

  const selectedSubject = subjects.find((s) => s.code === selectedSubjectCode) || subjects[0];

  const getExistingMark = (studentId: string) =>
    marks.find(
      (m) =>
        m.studentId === studentId &&
        m.subjectCode === selectedSubjectCode &&
        m.term === selectedTerm &&
        m.academicYear === selectedYear
    );

  const handleSaveStudentMark = (studentId: string) => {
    const student = students.find((s) => s.id === studentId);
    if (!student || !selectedSubject) return;
    const existing = getExistingMark(studentId);
    const edit = draftEdits[studentId];
    const catScore = edit ? edit.cat : existing?.catScore ?? 0;
    const examScore = edit ? edit.exam : existing?.examScore ?? 0;
    const comment = edit ? edit.comment : existing?.teacherComment || '';

    upsertExamMark({
      id: existing?.id,
      academicYear: selectedYear,
      term: selectedTerm,
      studentId: student.id,
      regNumber: student.regNumber,
      studentName: student.fullName,
      gradeCode: student.gradeCode,
      stream: student.stream || 'Stream A',
      subjectCode: selectedSubject.code,
      subjectName: selectedSubject.name,
      catScore: Math.min(examConfig.catMaxMarks, Math.max(0, Number(catScore) || 0)),
      examScore: Math.min(examConfig.examMaxMarks, Math.max(0, Number(examScore) || 0)),
      teacherComment: comment,
      enteredBy: currentUser.name,
      enteredById: currentUser.id,
      status: canApprove ? 'Published' : 'Submitted',
    });
    setMarks(getExamMarks());
    flash(`Saved ${selectedSubject.code} mark for ${student.fullName}.`);
  };

  const handleBulkSaveClassMarks = () => {
    if (!selectedSubject) return;
    classStudents.forEach((student) => {
      if (draftEdits[student.id]) {
        const existing = getExistingMark(student.id);
        const edit = draftEdits[student.id];
        upsertExamMark({
          id: existing?.id,
          academicYear: selectedYear,
          term: selectedTerm,
          studentId: student.id,
          regNumber: student.regNumber,
          studentName: student.fullName,
          gradeCode: student.gradeCode,
          stream: student.stream || 'Stream A',
          subjectCode: selectedSubject.code,
          subjectName: selectedSubject.name,
          catScore: Math.min(examConfig.catMaxMarks, Math.max(0, Number(edit.cat) || 0)),
          examScore: Math.min(examConfig.examMaxMarks, Math.max(0, Number(edit.exam) || 0)),
          teacherComment: edit.comment,
          enteredBy: currentUser.name,
          enteredById: currentUser.id,
          status: canApprove ? 'Published' : 'Submitted',
        });
      }
    });
    setDraftEdits({});
    setMarks(getExamMarks());
    flash(`Saved class mark sheet for ${selectedGrade} · ${selectedSubject.name}.`);
  };

  const handlePublishAllClassResults = () => {
    if (!canApprove) return;
    const updated = marks.map((m) =>
      m.gradeCode === selectedGrade && m.term === selectedTerm && m.academicYear === selectedYear
        ? { ...m, status: 'Published' as const, updatedAt: new Date().toISOString() }
        : m
    );
    saveExamMarks(updated);
    setMarks(updated);
    flash(`Published ${selectedGrade} ${selectedTerm} (${selectedYear}) results to Parent & Student Portals.`);
  };

  // Class Rankings computation
  const classRankings = useMemo(() => {
    const gradeLearners = students.filter((s) => s.gradeCode === selectedGrade);
    const list = gradeLearners.map((s) => {
      const stuMarks = marks.filter(
        (m) => m.studentId === s.id && m.term === selectedTerm && m.academicYear === selectedYear
      );
      const avg =
        stuMarks.length > 0
          ? Math.round((stuMarks.reduce((acc, m) => acc + m.totalPercent, 0) / stuMarks.length) * 10) / 10
          : 0;
      return {
        student: s,
        subjectCount: stuMarks.length,
        average: avg,
        passed: avg >= examConfig.passMarkPercent,
      };
    });
    return list.sort((a, b) => b.average - a.average);
  }, [students, marks, selectedGrade, selectedTerm, selectedYear, examConfig.passMarkPercent]);

  // Subject averages SVG chart data
  const subjectAverages = useMemo(() => {
    const classMarks = marks.filter(
      (m) => m.gradeCode === selectedGrade && m.term === selectedTerm && m.academicYear === selectedYear
    );
    const grouped = new Map<string, { name: string; total: number; count: number }>();
    classMarks.forEach((m) => {
      const prev = grouped.get(m.subjectCode) || { name: m.subjectCode, total: 0, count: 0 };
      grouped.set(m.subjectCode, { name: m.subjectCode, total: prev.total + m.totalPercent, count: prev.count + 1 });
    });
    return Array.from(grouped.values()).map((g) => ({
      code: g.name,
      avg: Math.round((g.total / g.count) * 10) / 10,
    }));
  }, [marks, selectedGrade, selectedTerm, selectedYear]);

  const handleAddSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    const subj = subjects.find((s) => s.code === scheduleForm.subjectCode);
    const item: ExamScheduleItem = {
      id: `ex-${Date.now()}`,
      title: scheduleForm.title.trim() || `${selectedTerm} Exam - ${subj?.name || scheduleForm.subjectCode}`,
      academicYear: selectedYear,
      term: selectedTerm,
      gradeCode: scheduleForm.gradeCode,
      subjectCode: scheduleForm.subjectCode,
      subjectName: subj?.name || scheduleForm.subjectCode,
      examDate: scheduleForm.examDate,
      startTime: scheduleForm.startTime,
      durationMinutes: Number(scheduleForm.durationMinutes) || 90,
      room: scheduleForm.room,
      invigilator: scheduleForm.invigilator,
      status: 'Scheduled',
    };
    const next = saveExamSchedules([item, ...schedules]);
    setSchedules(next);
    setScheduleForm({ ...scheduleForm, title: '' });
    flash(`Scheduled ${item.subjectName} for ${item.gradeCode} on ${item.examDate}.`);
  };

  return (
    <div className="space-y-6">
      {/* Context Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
            Examinations, CAT Grading & Report Cards
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Active Rule: CAT {examConfig.catWeightPercent}% (/{examConfig.catMaxMarks}) + Exam {examConfig.examWeightPercent}% (/{examConfig.examMaxMarks}) · Pass {examConfig.passMarkPercent}%
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
          >
            <option value="2026">2026</option>
            <option value="2025">2025</option>
          </select>
          <select
            value={selectedTerm}
            onChange={(e) => setSelectedTerm(e.target.value as 'Term 1' | 'Term 2' | 'Term 3')}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
          >
            <option value="Term 1">Term 1</option>
            <option value="Term 2">Term 2</option>
            <option value="Term 3">Term 3</option>
          </select>
          <select
            value={selectedGrade}
            onChange={(e) => setSelectedGrade(e.target.value)}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
          >
            {ACADEMIC_GRADES.filter((g) => allowedGrades.includes(g.code)).map((g) => (
              <option key={g.code} value={g.code}>{g.name}</option>
            ))}
          </select>
        </div>
      </div>

      {notice && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-semibold">
          <CheckCircle2 size={15} /> {notice}
        </div>
      )}

      {/* Navigation */}
      <div className="flex flex-wrap gap-1.5 bg-slate-100 dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800">
        {[
          { id: 'marks', label: 'CAT & Exam Marks', icon: <FileSpreadsheet size={14} /> },
          { id: 'rankings', label: 'Class Rankings & Analytics', icon: <Award size={14} /> },
          { id: 'report_cards', label: 'Printable PDF Report Cards', icon: <Printer size={14} /> },
          { id: 'schedules', label: 'Exam Timetable', icon: <CalendarClock size={14} /> },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id as ExamTab)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
              tab === item.id
                ? 'bg-blue-900 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: CAT & EXAM MARKS */}
      {tab === 'marks' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={selectedSubjectCode}
                onChange={(e) => setSelectedSubjectCode(e.target.value)}
                className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.code}>{s.name} ({s.code})</option>
                ))}
              </select>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter learner name or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 w-56"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {Object.keys(draftEdits).length > 0 && (
                <button
                  type="button"
                  onClick={handleBulkSaveClassMarks}
                  className="px-3.5 py-2 bg-blue-900 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
                >
                  Save All Edits ({Object.keys(draftEdits).length})
                </button>
              )}
              {canApprove && (
                <button
                  type="button"
                  onClick={handlePublishAllClassResults}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg cursor-pointer"
                >
                  <Send size={13} /> Approve & Publish {selectedGrade} Results
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-semibold">Reg #</th>
                  <th className="py-3 px-4 font-semibold">Learner</th>
                  <th className="py-3 px-4 font-semibold">CAT /{examConfig.catMaxMarks}</th>
                  <th className="py-3 px-4 font-semibold">Exam /{examConfig.examMaxMarks}</th>
                  <th className="py-3 px-4 font-semibold">Computed %</th>
                  <th className="py-3 px-4 font-semibold">Grade</th>
                  <th className="py-3 px-4 font-semibold">Teacher Remark</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Save</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {classStudents.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-slate-400">
                      No active learners enrolled in {selectedGrade}.
                    </td>
                  </tr>
                ) : (
                  classStudents.map((stu) => {
                    const existing = getExistingMark(stu.id);
                    const draft = draftEdits[stu.id];
                    const catVal = draft ? draft.cat : existing?.catScore ?? 0;
                    const examVal = draft ? draft.exam : existing?.examScore ?? 0;
                    const commentVal = draft ? draft.comment : existing?.teacherComment ?? '';
                    const liveCalc = calculateExamResult(catVal, examVal, examConfig);
                    return (
                      <tr key={stu.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-4 font-mono text-slate-500 tabular-nums">{stu.regNumber}</td>
                        <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-white">{stu.fullName}</td>
                        <td className="py-2.5 px-4">
                          <input
                            type="number"
                            min={0}
                            max={examConfig.catMaxMarks}
                            value={catVal}
                            onChange={(e) =>
                              setDraftEdits({
                                ...draftEdits,
                                [stu.id]: { cat: Number(e.target.value), exam: examVal, comment: commentVal },
                              })
                            }
                            className="w-20 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 tabular-nums"
                          />
                        </td>
                        <td className="py-2.5 px-4">
                          <input
                            type="number"
                            min={0}
                            max={examConfig.examMaxMarks}
                            value={examVal}
                            onChange={(e) =>
                              setDraftEdits({
                                ...draftEdits,
                                [stu.id]: { cat: catVal, exam: Number(e.target.value), comment: commentVal },
                              })
                            }
                            className="w-20 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 tabular-nums"
                          />
                        </td>
                        <td className="py-2.5 px-4 font-bold tabular-nums text-blue-900 dark:text-amber-400">
                          {liveCalc.totalPercent}%
                        </td>
                        <td className="py-2.5 px-4 font-bold text-slate-800 dark:text-slate-100">{liveCalc.gradeLetter}</td>
                        <td className="py-2.5 px-4">
                          <input
                            type="text"
                            placeholder="Optional remark"
                            value={commentVal}
                            onChange={(e) =>
                              setDraftEdits({
                                ...draftEdits,
                                [stu.id]: { cat: catVal, exam: examVal, comment: e.target.value },
                              })
                            }
                            className="w-40 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                          />
                        </td>
                        <td className="py-2.5 px-4">
                          <span
                            className={`text-[11px] font-semibold ${
                              existing?.status === 'Published'
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : existing
                                ? 'text-amber-600'
                                : 'text-slate-400'
                            }`}
                          >
                            {existing?.status || 'Pending'}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleSaveStudentMark(stu.id)}
                            className="px-3 py-1 bg-blue-900 hover:bg-blue-800 text-white rounded text-[11px] font-semibold cursor-pointer"
                          >
                            Save
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: RANKINGS & ANALYTICS */}
      {tab === 'rankings' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {selectedGrade} Merit Standing — {selectedTerm} ({selectedYear})
              </h3>
              <span className="text-xs text-slate-500 tabular-nums">{classRankings.length} students</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Position</th>
                    <th className="py-3 px-4 font-semibold">Learner</th>
                    <th className="py-3 px-4 font-semibold">Subjects Graded</th>
                    <th className="py-3 px-4 font-semibold">Term Average</th>
                    <th className="py-3 px-4 font-semibold text-right">Standing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {classRankings.map((row, idx) => (
                    <tr key={row.student.id}>
                      <td className="py-3 px-4 font-bold tabular-nums text-blue-900 dark:text-amber-400">#{idx + 1}</td>
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                        {row.student.fullName} <span className="text-slate-400 font-mono">({row.student.regNumber})</span>
                      </td>
                      <td className="py-3 px-4 tabular-nums">{row.subjectCount}</td>
                      <td className="py-3 px-4 font-bold tabular-nums">{row.average}%</td>
                      <td className="py-3 px-4 text-right font-semibold">
                        <span className={row.passed ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-600'}>
                          {row.subjectCount === 0 ? 'Pending Marks' : row.passed ? 'Pass' : 'Remedial'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 h-fit">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Subject Performance Chart</h3>
            {subjectAverages.length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center">No marks recorded for {selectedGrade} yet.</p>
            ) : (
              <div className="space-y-3">
                {subjectAverages.map((sa) => (
                  <div key={sa.code} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="font-mono text-slate-700 dark:text-slate-300">{sa.code}</span>
                      <span className="tabular-nums font-bold text-blue-900 dark:text-amber-400">{sa.avg}%</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 rounded-full"
                        style={{ width: `${Math.min(100, sa.avg)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: REPORT CARDS */}
      {tab === 'report_cards' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Official Term Report Cards (PDF)</h3>
              <p className="text-xs text-slate-500">Generates official Mugina Hope Primary School report card PDFs with rank, attendance, and signatures.</p>
            </div>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {classRankings.map((row, idx) => (
              <div key={row.student.id} className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{row.student.fullName}</p>
                  <p className="text-xs text-slate-500 tabular-nums">
                    {row.student.regNumber} · Rank #{idx + 1} / {classRankings.length} · Average {row.average}% ({row.subjectCount} subjects)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    exportStudentReportCardPDF({
                      student: row.student,
                      marks,
                      examConfig,
                      attendance,
                      academicYear: selectedYear,
                      term: selectedTerm,
                      classRank: idx + 1,
                      classTotal: classRankings.length,
                    })
                  }
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
                >
                  <Printer size={14} /> Download Report Card PDF
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: EXAM TIMETABLE */}
      {tab === 'schedules' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form
            onSubmit={handleAddSchedule}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 h-fit"
          >
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Schedule Assessment Paper</h3>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Title</label>
              <input
                type="text"
                placeholder="e.g. Term 1 Final Math Exam"
                value={scheduleForm.title}
                onChange={(e) => setScheduleForm({ ...scheduleForm, title: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Grade</label>
                <select
                  value={scheduleForm.gradeCode}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, gradeCode: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                >
                  {ACADEMIC_GRADES.filter((g) => allowedGrades.includes(g.code)).map((g) => (
                    <option key={g.code} value={g.code}>{g.code}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Subject</label>
                <select
                  value={scheduleForm.subjectCode}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, subjectCode: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                >
                  {subjects.map((s) => <option key={s.id} value={s.code}>{s.code}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Exam Date</label>
                <input
                  type="date"
                  required
                  value={scheduleForm.examDate}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, examDate: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Start Time</label>
                <input
                  type="time"
                  required
                  value={scheduleForm.startTime}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, startTime: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Room</label>
                <input
                  type="text"
                  value={scheduleForm.room}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, room: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Duration (min)</label>
                <input
                  type="number"
                  value={scheduleForm.durationMinutes}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, durationMinutes: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 tabular-nums"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-900 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              <Plus size={14} /> Add Exam Date
            </button>
          </form>

          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Examination Timetable</h3>
              <span className="text-xs text-slate-500 tabular-nums">{schedules.length} sittings</span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {schedules.map((sc) => (
                <div key={sc.id} className="px-5 py-3.5 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">{sc.title}</p>
                    <p className="text-xs text-slate-500 tabular-nums">
                      {sc.gradeCode} · {sc.examDate} at {sc.startTime} ({sc.durationMinutes} mins) · {sc.room} · Invigilator: {sc.invigilator}
                    </p>
                  </div>
                  {!scopedToTeacher && (
                    <button
                      type="button"
                      onClick={() => setSchedules(saveExamSchedules(schedules.filter((x) => x.id !== sc.id)))}
                      className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950 rounded cursor-pointer"
                      aria-label="Delete schedule"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
