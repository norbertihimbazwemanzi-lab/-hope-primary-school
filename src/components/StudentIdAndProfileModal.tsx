import React, { useState, useMemo } from 'react';
import {
  EnrolledStudent,
  getAttendanceRecords,
  getPaymentTransactions,
  transferStudentRecord,
  getCurrentSessionUser,
} from '../services/adminStore';
import {
  getExamMarks,
  getExamConfig,
  getFeeStructures,
  logAuditEvent,
} from '../services/smsStore';
import { ACADEMIC_GRADES, SCHOOL_INFO } from '../data/schoolData';
import { SchoolLogo } from './SchoolLogo';
import { exportStudentIdCardPDF, exportStudentReportCardPDF } from '../services/reportCardPdf';
import {
  X,
  User,
  Award,
  Calendar,
  CreditCard,
  Printer,
  FileDown,
  ShieldCheck,
  MapPin,
  Phone,
  Mail,
  ArrowRightLeft,
  History,
  CheckCircle2,
  ClipboardList,
} from 'lucide-react';

interface StudentIdAndProfileModalProps {
  student: EnrolledStudent | null;
  onClose: () => void;
  onStudentUpdated?: () => void;
  canTransfer?: boolean;
}

export const StudentIdAndProfileModal: React.FC<StudentIdAndProfileModalProps> = ({
  student,
  onClose,
  onStudentUpdated,
  canTransfer = false,
}) => {
  const sessionUser = getCurrentSessionUser();
  const [activeView, setActiveView] = useState<'profile' | 'id_card' | 'history' | 'transfer'>('profile');
  const [transferSchool, setTransferSchool] = useState('');
  const [transferNotes, setTransferNotes] = useState('');
  const [transferSuccess, setTransferSuccess] = useState<string | null>(null);

  const attendance = useMemo(() => (student ? getAttendanceRecords().filter((r) => r.studentId === student.id) : []), [student]);
  const marks = useMemo(() => (student ? getExamMarks().filter((m) => m.studentId === student.id) : []), [student]);
  const payments = useMemo(() => (student ? getPaymentTransactions().filter((p) => p.studentId === student.id) : []), [student]);
  const examConfig = useMemo(() => getExamConfig(), []);
  const feeStructures = useMemo(() => getFeeStructures(), []);

  if (!student) return null;

  const gradeName = ACADEMIC_GRADES.find((g) => g.code === student.gradeCode)?.name || student.gradeCode;
  const expectedFee = feeStructures.find((f) => f.gradeCode === student.gradeCode)?.totalExpected || 92000;
  const totalPaid = payments
    .filter((p) => p.status === 'Completed' || p.status === 'Refund Requested')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const feeBalance = Math.max(0, expectedFee - totalPaid);
  const avgMark =
    marks.length > 0 ? Math.round((marks.reduce((s, m) => s + m.totalPercent, 0) / marks.length) * 10) / 10 : 0;

  const handleTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferSchool.trim()) return;
    transferStudentRecord(
      student.id,
      transferSchool.trim(),
      transferNotes.trim() || 'Official student transfer processed.',
      sessionUser?.name || 'Administration'
    );
    logAuditEvent(
      'TRANSFER',
      'EnrolledStudent',
      student.id,
      `Transferred ${student.fullName} (${student.regNumber}) to ${transferSchool.trim()}`
    );
    setTransferSuccess(`Transfer record for ${student.fullName} saved successfully.`);
    if (onStudentUpdated) onStudentUpdated();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 max-w-3xl w-full max-h-[92vh] overflow-y-auto shadow-2xl">
        {/* Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-200 dark:border-slate-700 bg-blue-950 text-white rounded-t-2xl">
          <div className="flex items-center gap-3">
            {student.photoUrl ? (
              <img
                src={student.photoUrl}
                alt={student.fullName}
                className="w-11 h-11 rounded-lg object-cover border border-amber-400"
              />
            ) : (
              <div className="w-11 h-11 rounded-lg bg-blue-900 border border-blue-700 flex items-center justify-center font-bold text-amber-300">
                {student.fullName.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <h3 className="text-base font-bold text-white leading-tight">{student.fullName}</h3>
              <p className="text-xs text-amber-300 font-mono">
                {student.regNumber} • {gradeName} ({student.stream || 'Stream A'}) • {student.status}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close student modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* View Switcher */}
        <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveView('profile')}
            className={`px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeView === 'profile'
                ? 'bg-blue-900 text-white'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Full Profile</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveView('id_card')}
            className={`px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeView === 'id_card'
                ? 'bg-blue-900 text-white'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Student ID Card</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveView('history')}
            className={`px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeView === 'history'
                ? 'bg-blue-900 text-white'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Academic, Attendance & Results</span>
          </button>

          {canTransfer && (
            <button
              type="button"
              onClick={() => setActiveView('transfer')}
              className={`px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeView === 'transfer'
                  ? 'bg-amber-600 text-white'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
              }`}
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Transfer Student</span>
            </button>
          )}
        </div>

        <div className="p-5 space-y-5 text-xs">
          {/* 1. PROFILE VIEW */}
          {activeView === 'profile' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Exam Average</span>
                  <span className="text-lg font-bold text-blue-900 dark:text-blue-300 tabular-nums">
                    {marks.length > 0 ? `${avgMark}%` : 'No marks'}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Attendance Logs</span>
                  <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                    {attendance.filter((a) => a.status === 'Present').length} / {attendance.length} Present
                  </span>
                </div>
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Fees Paid</span>
                  <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                    {totalPaid.toLocaleString()} RWF
                  </span>
                </div>
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Term Balance</span>
                  <span className={`text-lg font-bold tabular-nums ${feeBalance > 0 ? 'text-amber-600' : 'text-emerald-700'}`}>
                    {feeBalance.toLocaleString()} RWF
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2.5">
                  <h4 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-2">
                    Learner Biodata & Enrollment
                  </h4>
                  <div className="grid grid-cols-2 gap-y-2 text-xs">
                    <span className="text-slate-500 dark:text-slate-400">Registration #:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">{student.regNumber}</span>
                    <span className="text-slate-500 dark:text-slate-400">Gender:</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{student.gender}</span>
                    <span className="text-slate-500 dark:text-slate-400">Date of Birth:</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{student.dob || 'N/A'}</span>
                    <span className="text-slate-500 dark:text-slate-400">Class / Stream:</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{gradeName} · {student.stream || 'Stream A'}</span>
                    <span className="text-slate-500 dark:text-slate-400">Admission Date:</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{student.admissionDate || student.enrolledAt}</span>
                    <span className="text-slate-500 dark:text-slate-400">Previous School:</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{student.previousSchool || 'Direct Entry'}</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2.5">
                  <h4 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-2">
                    Parent / Guardian & Portal Credentials
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Guardian Name:</span>
                      <span className="font-semibold text-slate-900 dark:text-white">{student.parentName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400 inline-flex items-center gap-1"><Phone className="w-3 h-3" /> Phone:</span>
                      <span className="font-mono text-slate-900 dark:text-white">{student.parentPhone}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400 inline-flex items-center gap-1"><Mail className="w-3 h-3" /> Email:</span>
                      <span className="text-slate-900 dark:text-white truncate max-w-[180px]">{student.parentEmail}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400 inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> Address:</span>
                      <span className="text-slate-900 dark:text-white">{student.address || 'Mugina Sector, Kamonyi'}</span>
                    </div>
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Student Portal Login:</span>
                      <span className="font-mono text-blue-700 dark:text-blue-400 font-semibold">{student.studentUsername}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Student Profile</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    exportStudentReportCardPDF({
                      student,
                      marks: getExamMarks(),
                      examConfig,
                      attendance: getAttendanceRecords(),
                      academicYear: '2026',
                      term: 'Term 1',
                    })
                  }
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>Download Term Report Card (PDF)</span>
                </button>
                <button
                  type="button"
                  onClick={() => exportStudentIdCardPDF(student)}
                  className="px-4 py-2 bg-blue-900 hover:bg-blue-950 text-white font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                  <span>Export ID Card (PDF)</span>
                </button>
              </div>
            </div>
          )}

          {/* 2. PRINTABLE / DOWNLOADABLE STUDENT ID CARD PREVIEW */}
          {activeView === 'id_card' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                {/* Front Card */}
                <div className="rounded-xl border-2 border-blue-900 bg-white overflow-hidden shadow-md">
                  <div className="bg-blue-950 text-white px-4 py-3 flex items-center justify-between border-b-4 border-amber-400">
                    <div className="flex items-center gap-2.5">
                      <SchoolLogo size="sm" />
                      <div>
                        <div className="font-bold text-xs tracking-wide uppercase">Mugina Hope Primary School</div>
                        <div className="text-[10px] text-amber-300 italic">&ldquo;{SCHOOL_INFO.motto}&rdquo;</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">Student ID</span>
                  </div>

                  <div className="p-4 flex gap-4 items-center text-slate-900">
                    <div className="w-20 h-24 rounded-lg border border-slate-300 bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                      {student.photoUrl ? (
                        <img src={student.photoUrl} alt={student.fullName} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xl font-bold text-blue-900">{student.fullName.slice(0, 2).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="space-y-1 min-w-0">
                      <div className="font-bold text-sm text-slate-950 truncate">{student.fullName}</div>
                      <div className="font-mono text-xs font-bold text-blue-900">{student.regNumber}</div>
                      <div className="text-[11px] text-slate-700">
                        Class: <strong>{gradeName}</strong> ({student.stream || 'Stream A'})
                      </div>
                      <div className="text-[11px] text-slate-700">
                        Gender: {student.gender} • DOB: {student.dob || 'N/A'}
                      </div>
                      <div className="text-[11px] text-slate-700 truncate">
                        Guardian: {student.parentName}
                      </div>
                      <div className="text-[11px] font-mono text-emerald-800 font-semibold">
                        Emergency: {student.parentPhone}
                      </div>
                    </div>
                  </div>

                  <div className="bg-emerald-800 text-white px-4 py-1.5 text-[10px] flex items-center justify-between">
                    <span>Mugina Sector, Kamonyi District</span>
                    <span>Academic Year {new Date().getFullYear()}</span>
                  </div>
                </div>

                {/* Back Card */}
                <div className="rounded-xl border border-slate-300 bg-slate-50 p-4 space-y-3 text-slate-800 shadow-sm">
                  <div className="font-bold text-xs text-blue-950 uppercase tracking-wider border-b border-slate-200 pb-2">
                    Verified Dismissal & Gate Security Credential
                  </div>
                  <ul className="space-y-1.5 text-[11px] text-slate-700 list-disc pl-4">
                    <li>This identification card is an official credential of Mugina Hope Primary &amp; Nursery Academy.</li>
                    <li>Authorized parent or guardian must present this ID card during campus dismissal.</li>
                    <li>Adjacent to Mugina Police Station, Kamonyi District, Southern Province, Rwanda.</li>
                    <li>Student Portal Username: <strong className="font-mono">{student.studentUsername}</strong></li>
                  </ul>
                  <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500">
                    <span>Office Tel: {SCHOOL_INFO.contact.phone}</span>
                    <span className="font-semibold text-slate-800">Authorized School Seal</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print ID Card</span>
                </button>
                <button
                  type="button"
                  onClick={() => exportStudentIdCardPDF(student)}
                  className="px-4 py-2 bg-blue-900 hover:bg-blue-950 text-white font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <FileDown className="w-3.5 h-3.5 text-amber-400" />
                  <span>Download Official ID Card (PDF)</span>
                </button>
              </div>
            </div>
          )}

          {/* 3. ACADEMIC HISTORY, ATTENDANCE & EXAM RESULTS */}
          {activeView === 'history' && (
            <div className="space-y-4">
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-amber-500" />
                  <span>Recorded Examination & CAT Results ({marks.length})</span>
                </h4>
                {marks.length === 0 ? (
                  <p className="text-slate-500 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                    No exam marks recorded for this learner yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl">
                    <table className="w-full text-left text-xs tabular-nums">
                      <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold">
                        <tr>
                          <th className="p-2.5">Term / Year</th>
                          <th className="p-2.5">Subject</th>
                          <th className="p-2.5">CAT</th>
                          <th className="p-2.5">Exam</th>
                          <th className="p-2.5">Total %</th>
                          <th className="p-2.5">Grade</th>
                          <th className="p-2.5">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {marks.map((m) => (
                          <tr key={m.id}>
                            <td className="p-2.5">{m.term} {m.academicYear}</td>
                            <td className="p-2.5 font-semibold">{m.subjectName}</td>
                            <td className="p-2.5">{m.catScore}</td>
                            <td className="p-2.5">{m.examScore}</td>
                            <td className="p-2.5 font-bold text-blue-900 dark:text-blue-300">{m.totalPercent}%</td>
                            <td className="p-2.5 font-bold">{m.gradeLetter}</td>
                            <td className="p-2.5">{m.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div>
                <h4 className="font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-1.5">
                  <ClipboardList className="w-4 h-4 text-emerald-600" />
                  <span>Promotion & Academic History</span>
                </h4>
                {(!student.academicHistory || student.academicHistory.length === 0) ? (
                  <p className="text-slate-500 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                    Enrolled into {gradeName} on {student.admissionDate || student.enrolledAt} by {student.enrolledBy}.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {student.academicHistory.map((h, i) => (
                      <div key={i} className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                        <div>
                          <span className="font-bold text-slate-900 dark:text-white">{h.action}: {h.fromGrade} &rarr; {h.toGrade}</span>
                          {h.notes && <span className="text-slate-500 block">{h.notes}</span>}
                        </div>
                        <span className="font-mono text-[11px] text-slate-500">{h.date} • {h.recordedBy}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 4. TRANSFER STUDENT */}
          {activeView === 'transfer' && canTransfer && (
            <form onSubmit={handleTransferSubmit} className="space-y-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">Official Student Transfer Record</h4>
              <p className="text-slate-600 dark:text-slate-300">
                Marks {student.fullName} as <strong>Transferred</strong> while preserving complete academic, attendance, and payment history.
              </p>
              {transferSuccess && (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{transferSuccess}</span>
                </div>
              )}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">Destination School Name</label>
                <input
                  type="text"
                  required
                  value={transferSchool}
                  onChange={(e) => setTransferSchool(e.target.value)}
                  placeholder="e.g. Groupe Scolaire Kamonyi"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">Transfer Notes & Clearance Status</label>
                <textarea
                  rows={2}
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  placeholder="Fee clearance verified; academic report handed to parent."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg cursor-pointer"
                >
                  Confirm Student Transfer
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
