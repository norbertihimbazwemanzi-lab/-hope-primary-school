import React, { useMemo, useState, useEffect } from 'react';
import {
  CurrentSessionUser,
  EnrolledStudent,
  getAttendanceRecords,
  getPaymentTransactions,
  getAnnouncements,
  getStaffMembers,
} from '../services/adminStore';
import {
  getExamMarks,
  getExamConfig,
  getFeeStructures,
  getHomeworkAssignments,
  getLearningMaterials,
  getClassTimetables,
  getParentTeacherMessages,
  sendParentTeacherMessage,
  getAcademicYearsTerms,
} from '../services/smsStore';
import { getParentAuthorizedStudents } from '../services/rbac';
import { exportStudentReportCardPDF, exportFeeStatementPDF } from '../services/reportCardPdf';
import { ACADEMIC_GRADES } from '../data/schoolData';
import {
  Users,
  Award,
  CalendarCheck,
  Wallet,
  BookOpen,
  MessageSquare,
  Bell,
  Download,
  Clock,
  Send,
  CheckCircle2,
} from 'lucide-react';

interface ParentPortalProps {
  sessionUser: CurrentSessionUser;
  students: EnrolledStudent[];
}

type ParentTab =
  | 'overview'
  | 'results'
  | 'attendance'
  | 'fees'
  | 'homework'
  | 'messages'
  | 'announcements';

export const ParentPortal: React.FC<ParentPortalProps> = ({ sessionUser, students }) => {
  const authorizedChildren = useMemo(
    () => getParentAuthorizedStudents(sessionUser, students),
    [sessionUser, students]
  );

  const [selectedChildId, setSelectedChildId] = useState<string>(authorizedChildren[0]?.id || '');
  const [tab, setTab] = useState<ParentTab>('overview');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!authorizedChildren.some((c) => c.id === selectedChildId) && authorizedChildren[0]) {
      setSelectedChildId(authorizedChildren[0].id);
    }
  }, [authorizedChildren, selectedChildId]);

  useEffect(() => {
    const refresh = () => setTick((t) => t + 1);
    window.addEventListener('mugina-sms-updated', refresh);
    return () => window.removeEventListener('mugina-sms-updated', refresh);
  }, []);

  const child = authorizedChildren.find((c) => c.id === selectedChildId) || authorizedChildren[0] || null;

  const academicYears = useMemo(() => getAcademicYearsTerms(), []);
  const currentTermObj = academicYears.find((y) => y.isCurrent) || academicYears[0];
  const currentYear = currentTermObj?.academicYear || '2026';
  const currentTerm = currentTermObj?.termName || 'Term 1';

  const allMarks = useMemo(() => getExamMarks(), [tick]);
  const examConfig = useMemo(() => getExamConfig(), [tick]);
  const allAttendance = useMemo(() => getAttendanceRecords(), [tick]);
  const allTransactions = useMemo(() => getPaymentTransactions(), [tick]);
  const feeStructures = useMemo(() => getFeeStructures(), [tick]);
  const homeworkList = useMemo(() => getHomeworkAssignments(), [tick]);
  const materials = useMemo(() => getLearningMaterials(), [tick]);
  const timetables = useMemo(() => getClassTimetables(), [tick]);
  const announcements = useMemo(() => getAnnouncements().filter((a) => a.isActive), [tick]);
  const staff = useMemo(() => getStaffMembers().filter((s) => s.status === 'Active' && s.role === 'Teacher'), []);
  const messages = useMemo(() => getParentTeacherMessages(), [tick]);

  const [msgSubject, setMsgSubject] = useState('');
  const [msgBody, setMsgBody] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState(staff[0]?.id || '');
  const [msgSentBanner, setMsgSentBanner] = useState<string | null>(null);

  if (!child) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center space-y-3">
        <Users className="w-10 h-10 text-blue-900 dark:text-amber-400 mx-auto" />
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">No Linked Learner Found</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          Your guardian account ({sessionUser.email || sessionUser.username}) does not currently match an enrolled student’s parent email or phone number. Please contact the Registrar’s office (+250 788 258 786) to link your child’s profile.
        </p>
      </div>
    );
  }

  const gradeName = ACADEMIC_GRADES.find((g) => g.code === child.gradeCode)?.name || child.gradeCode;
  const childMarks = allMarks.filter((m) => m.studentId === child.id);
  const childAttendance = allAttendance.filter((a) => a.studentId === child.id);
  const childPayments = allTransactions.filter((t) => t.studentId === child.id);
  const childHomework = homeworkList.filter((h) => h.gradeCode === child.gradeCode);
  const childMaterials = materials.filter((m) => m.gradeCode === child.gradeCode);
  const childTimetable = timetables.filter((t) => t.gradeCode === child.gradeCode);
  const childMessages = messages.filter((m) => m.studentId === child.id);

  const expectedFee = feeStructures.find((f) => f.gradeCode === child.gradeCode)?.totalExpected || 92000;
  const paidFee = childPayments
    .filter((p) => p.status === 'Completed' || p.status === 'Refund Requested')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const feeBalance = Math.max(0, expectedFee - paidFee);

  const avgScore =
    childMarks.length > 0
      ? Math.round((childMarks.reduce((s, m) => s + m.totalPercent, 0) / childMarks.length) * 10) / 10
      : 0;
  const presentDays = childAttendance.filter((a) => a.status === 'Present' || a.status === 'Late').length;
  const attRate =
    childAttendance.length > 0 ? Math.round((presentDays / childAttendance.length) * 100) : 100;

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!msgSubject.trim() || !msgBody.trim()) return;
    const teacher = staff.find((t) => t.id === selectedTeacherId) || staff[0];
    sendParentTeacherMessage({
      studentId: child.id,
      studentName: child.fullName,
      gradeCode: child.gradeCode,
      parentEmail: child.parentEmail || sessionUser.email || '',
      parentName: child.parentName || sessionUser.name,
      teacherId: teacher?.id || 'staff-teacher-1',
      teacherName: teacher?.name || 'Class Teacher',
      senderRole: 'Parent',
      senderName: sessionUser.name,
      subject: msgSubject.trim(),
      message: msgBody.trim(),
    });
    setMsgSubject('');
    setMsgBody('');
    setTick((t) => t + 1);
    setMsgSentBanner('Your message has been delivered to the class teacher.');
    setTimeout(() => setMsgSentBanner(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Guardian Header & Child Switcher */}
      <div className="bg-blue-950 text-white rounded-2xl p-6 border border-blue-900 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">
            Parent & Guardian Portal
          </p>
          <h2 className="text-xl font-bold mt-1">
            Welcome, {sessionUser.name}
          </h2>
          <p className="text-xs text-blue-200 mt-1">
            Viewing academic progress, attendance, and school fee records strictly authorized for {child.fullName} ({child.regNumber} · {gradeName}).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {authorizedChildren.length > 1 && (
            <select
              value={child.id}
              onChange={(e) => setSelectedChildId(e.target.value)}
              className="px-3.5 py-2 rounded-lg bg-blue-900 border border-blue-700 text-xs font-semibold text-white"
            >
              {authorizedChildren.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName} ({c.gradeCode})
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() =>
              exportStudentReportCardPDF({
                student: child,
                marks: allMarks,
                examConfig,
                attendance: allAttendance,
                academicYear: currentYear,
                term: currentTerm,
              })
            }
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold rounded-lg cursor-pointer whitespace-nowrap"
          >
            <Download size={14} /> Report Card PDF
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-500">Current Academic Average</span>
          <p className="text-2xl font-bold text-blue-900 dark:text-amber-400 mt-1 tabular-nums">{avgScore}%</p>
          <span className="text-[11px] text-slate-500 tabular-nums">{childMarks.length} graded subjects</span>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-500">Attendance Rate</span>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-1 tabular-nums">{attRate}%</p>
          <span className="text-[11px] text-slate-500 tabular-nums">{childAttendance.length} logged days</span>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-500">School Fees Balance</span>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
            {feeBalance.toLocaleString()} RWF
          </p>
          <span className="text-[11px] text-emerald-700 dark:text-emerald-400 tabular-nums">
            Paid: {paidFee.toLocaleString()} RWF
          </span>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-500">Class Placement</span>
          <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">{gradeName}</p>
          <span className="text-[11px] text-slate-500">{child.stream || 'Stream A'} · {child.status}</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-1.5 bg-slate-100 dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800">
        {[
          { id: 'overview', label: 'Overview & Timetable', icon: <Clock size={14} /> },
          { id: 'results', label: 'Exam Results', icon: <Award size={14} /> },
          { id: 'attendance', label: 'Attendance History', icon: <CalendarCheck size={14} /> },
          { id: 'fees', label: 'Fees & Receipts', icon: <Wallet size={14} /> },
          { id: 'homework', label: 'Homework & Materials', icon: <BookOpen size={14} /> },
          { id: 'messages', label: 'Teacher Messages', icon: <MessageSquare size={14} /> },
          { id: 'announcements', label: 'Announcements', icon: <Bell size={14} /> },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id as ParentTab)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
              tab === item.id
                ? 'bg-blue-900 text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Views */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Weekly Class Timetable ({child.gradeCode})</h3>
            {childTimetable.length === 0 ? (
              <p className="text-xs text-slate-400">Timetable slots for {child.gradeCode} will appear once published by administration.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {childTimetable.map((slot) => (
                  <div key={slot.id} className="py-2.5 flex items-center justify-between gap-2">
                    <div>
                      <span className="font-bold text-blue-900 dark:text-amber-400">{slot.dayOfWeek}</span>
                      <span className="text-slate-400 mx-2">·</span>
                      <span className="font-semibold text-slate-900 dark:text-white">{slot.subjectName}</span>
                    </div>
                    <span className="font-mono text-slate-500 tabular-nums">
                      {slot.startTime}–{slot.endTime}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Recent School Announcements</h3>
            {announcements.slice(0, 4).map((ann) => (
              <div key={ann.id} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                <p className="text-xs font-bold text-slate-900 dark:text-white">{ann.title}</p>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{ann.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'results' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Academic Performance & Subject Grades ({currentTerm} · {currentYear})
            </h3>
            <button
              type="button"
              onClick={() =>
                exportStudentReportCardPDF({
                  student: child,
                  marks: allMarks,
                  examConfig,
                  attendance: allAttendance,
                  academicYear: currentYear,
                  term: currentTerm,
                })
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-900 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              <Download size={13} /> Download Report Card
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-semibold">Subject</th>
                  <th className="py-3 px-4 font-semibold">Term</th>
                  <th className="py-3 px-4 font-semibold">CAT</th>
                  <th className="py-3 px-4 font-semibold">Exam</th>
                  <th className="py-3 px-4 font-semibold">Final %</th>
                  <th className="py-3 px-4 font-semibold">Grade</th>
                  <th className="py-3 px-4 font-semibold">Teacher Remark</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {childMarks.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No examination marks recorded yet for {child.fullName}.
                    </td>
                  </tr>
                ) : (
                  childMarks.map((m) => (
                    <tr key={m.id}>
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">{m.subjectName}</td>
                      <td className="py-3 px-4 text-slate-500">{m.term} ({m.academicYear})</td>
                      <td className="py-3 px-4 tabular-nums">{m.catScore}</td>
                      <td className="py-3 px-4 tabular-nums">{m.examScore}</td>
                      <td className="py-3 px-4 font-bold text-blue-900 dark:text-amber-400 tabular-nums">{m.totalPercent}%</td>
                      <td className="py-3 px-4 font-bold">{m.gradeLetter}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{m.teacherComment || m.remark}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'attendance' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Daily Roll-Call Attendance History</h3>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {childAttendance.length === 0 ? (
              <p className="p-8 text-center text-slate-400">No attendance logs recorded yet.</p>
            ) : (
              childAttendance.map((att) => (
                <div key={att.id} className="px-5 py-3 flex items-center justify-between gap-4">
                  <div>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">{att.date}</span>
                    {att.notes && <p className="text-slate-500 mt-0.5">{att.notes}</p>}
                  </div>
                  <span
                    className={`font-bold ${
                      att.status === 'Present'
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : att.status === 'Absent'
                        ? 'text-red-600'
                        : 'text-amber-600'
                    }`}
                  >
                    {att.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {tab === 'fees' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Fee Statement & Official Receipts</h3>
              <p className="text-xs text-slate-500 tabular-nums">
                Term Fee: {expectedFee.toLocaleString()} RWF · Paid: {paidFee.toLocaleString()} RWF · Balance: {feeBalance.toLocaleString()} RWF
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                exportFeeStatementPDF({
                  student: child,
                  transactions: allTransactions,
                  feeStructures,
                  term: currentTerm,
                  academicYear: currentYear,
                })
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              <Download size={13} /> Fee Statement PDF
            </button>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {childPayments.length === 0 ? (
              <p className="p-8 text-center text-slate-400">No payments recorded yet for {child.fullName}.</p>
            ) : (
              childPayments.map((tx) => (
                <div key={tx.id} className="px-5 py-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">
                      {tx.receiptNumber} · {tx.paymentType}
                    </p>
                    <p className="text-slate-500 tabular-nums">
                      {String(tx.recordedAt).split('T')[0]} · {tx.paymentMethod} ({tx.term} {tx.academicYear})
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                      {Number(tx.amount).toLocaleString()} RWF
                    </p>
                    <p className="text-[11px] text-slate-500">{tx.status}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {tab === 'homework' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Class Homework ({child.gradeCode})</h3>
            {childHomework.length === 0 ? (
              <p className="text-xs text-slate-400">No active homework posted for {child.gradeCode}.</p>
            ) : (
              childHomework.map((hw) => (
                <div key={hw.id} className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                  <div className="flex justify-between text-xs font-bold text-slate-900 dark:text-white">
                    <span>{hw.title}</span>
                    <span className="text-amber-600 tabular-nums">Due {hw.dueDate}</span>
                  </div>
                  <p className="text-[11px] text-blue-800 dark:text-blue-300 font-semibold">{hw.subjectName} · {hw.teacherName}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-300">{hw.instructions}</p>
                </div>
              ))
            )}
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Study Materials & Worksheets</h3>
            {childMaterials.length === 0 ? (
              <p className="text-xs text-slate-400">No worksheets uploaded yet for {child.gradeCode}.</p>
            ) : (
              childMaterials.map((mat) => (
                <div key={mat.id} className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                  <p className="text-xs font-bold text-slate-900 dark:text-white">{mat.title}</p>
                  <p className="text-[11px] text-slate-500">{mat.subjectName} · {mat.materialType}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-300">{mat.description}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {tab === 'messages' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form
            onSubmit={handleSendMessage}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 h-fit"
          >
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Message Class Teacher</h3>
            {msgSentBanner && (
              <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-800 text-xs flex items-center gap-1.5">
                <CheckCircle2 size={14} /> {msgSentBanner}
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Select Teacher</label>
              <select
                value={selectedTeacherId}
                onChange={(e) => setSelectedTeacherId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
              >
                {staff.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.assignedSubjectOrGrade || 'Teacher'})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Subject</label>
              <input
                type="text"
                required
                placeholder="e.g. Homework question / Absence note"
                value={msgSubject}
                onChange={(e) => setMsgSubject(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Message</label>
              <textarea
                rows={4}
                required
                value={msgBody}
                onChange={(e) => setMsgBody(e.target.value)}
                placeholder={`Write your message regarding ${child.fullName}...`}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
            </div>
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-blue-900 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              <Send size={13} /> Send Message
            </button>
          </form>

          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Conversation History ({childMessages.length})</h3>
            {childMessages.length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center">No parent-teacher messages yet.</p>
            ) : (
              <div className="space-y-3">
                {childMessages.map((m) => (
                  <div key={m.id} className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {m.subject} · {m.senderName} ({m.senderRole})
                      </span>
                      <span className="text-slate-400 tabular-nums">{new Date(m.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300">{m.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'announcements' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Official School Notices</h3>
          {announcements.map((ann) => (
            <div key={ann.id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-bold text-blue-900 dark:text-amber-400">{ann.title}</span>
                <span className="text-slate-400 tabular-nums">{ann.publishedAt}</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{ann.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
