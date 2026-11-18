import React, { useMemo, useState } from 'react';
import {
  CurrentSessionUser,
  EnrolledStudent,
  getAttendanceRecords,
  getAnnouncements,
} from '../services/adminStore';
import {
  getExamMarks,
  getExamConfig,
  getHomeworkAssignments,
  getLearningMaterials,
  getClassTimetables,
  getAcademicYearsTerms,
} from '../services/smsStore';
import { getStudentSelfRecord } from '../services/rbac';
import { exportStudentIdCardPDF, exportStudentReportCardPDF } from '../services/reportCardPdf';
import { ACADEMIC_GRADES } from '../data/schoolData';
import {
  User,
  Award,
  Clock,
  BookOpen,
  FileText,
  CalendarCheck,
  Bell,
  Download,
  CreditCard,
} from 'lucide-react';

interface StudentPortalProps {
  sessionUser: CurrentSessionUser;
  students: EnrolledStudent[];
}

type StudentTab = 'profile' | 'timetable' | 'homework' | 'results' | 'materials' | 'attendance' | 'announcements';

export const StudentPortal: React.FC<StudentPortalProps> = ({ sessionUser, students }) => {
  const [tab, setTab] = useState<StudentTab>('profile');
  const student = useMemo(() => getStudentSelfRecord(sessionUser, students), [sessionUser, students]);

  const academicYears = useMemo(() => getAcademicYearsTerms(), []);
  const currentTermObj = academicYears.find((y) => y.isCurrent) || academicYears[0];
  const currentYear = currentTermObj?.academicYear || '2026';
  const currentTerm = currentTermObj?.termName || 'Term 1';

  const marks = useMemo(() => getExamMarks(), []);
  const examConfig = useMemo(() => getExamConfig(), []);
  const attendance = useMemo(() => getAttendanceRecords(), []);
  const timetable = useMemo(() => getClassTimetables(), []);
  const homework = useMemo(() => getHomeworkAssignments(), []);
  const materials = useMemo(() => getLearningMaterials(), []);
  const announcements = useMemo(() => getAnnouncements().filter((a) => a.isActive), []);

  if (!student) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center space-y-2">
        <User className="w-10 h-10 text-blue-900 mx-auto" />
        <h3 className="text-base font-bold text-slate-900 dark:text-white">Student Record Not Found</h3>
        <p className="text-xs text-slate-500">Please verify your Registration Number with the School Administration.</p>
      </div>
    );
  }

  const gradeName = ACADEMIC_GRADES.find((g) => g.code === student.gradeCode)?.name || student.gradeCode;
  const myMarks = marks.filter((m) => m.studentId === student.id);
  const myAttendance = attendance.filter((a) => a.studentId === student.id);
  const myTimetable = timetable.filter((t) => t.gradeCode === student.gradeCode);
  const myHomework = homework.filter((h) => h.gradeCode === student.gradeCode);
  const myMaterials = materials.filter((m) => m.gradeCode === student.gradeCode);

  const avgScore =
    myMarks.length > 0 ? Math.round((myMarks.reduce((s, m) => s + m.totalPercent, 0) / myMarks.length) * 10) / 10 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-blue-950 text-white rounded-2xl p-6 border border-blue-900 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {student.photoUrl ? (
            <img
              src={student.photoUrl}
              alt={student.fullName}
              className="w-14 h-14 rounded-xl object-cover border-2 border-amber-400"
            />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-blue-900 border border-blue-700 flex items-center justify-center text-lg font-bold text-amber-300">
              {student.fullName.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">Enrolled Student Portal</p>
            <h2 className="text-xl font-bold">{student.fullName}</h2>
            <p className="text-xs text-blue-200 font-mono">
              {student.regNumber} · {gradeName} ({student.stream || 'Stream A'})
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => exportStudentIdCardPDF(student)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-lg cursor-pointer"
          >
            <CreditCard size={14} /> Download Student ID
          </button>
          <button
            type="button"
            onClick={() =>
              exportStudentReportCardPDF({
                student,
                marks,
                examConfig,
                attendance,
                academicYear: currentYear,
                term: currentTerm,
              })
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold rounded-lg cursor-pointer"
          >
            <Download size={14} /> Report Card PDF
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5 bg-slate-100 dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800">
        {[
          { id: 'profile', label: 'My Profile & ID', icon: <User size={14} /> },
          { id: 'timetable', label: 'Class Timetable', icon: <Clock size={14} /> },
          { id: 'homework', label: 'Homework', icon: <BookOpen size={14} /> },
          { id: 'results', label: 'Exam Results', icon: <Award size={14} /> },
          { id: 'materials', label: 'Learning Materials', icon: <FileText size={14} /> },
          { id: 'attendance', label: 'Attendance', icon: <CalendarCheck size={14} /> },
          { id: 'announcements', label: 'Announcements', icon: <Bell size={14} /> },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id as StudentTab)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
              tab === t.id
                ? 'bg-blue-900 text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3 text-xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Learner Identity Record</h3>
            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Registration Number</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">{student.regNumber}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Class & Stream</span>
              <span className="font-semibold">{gradeName} · {student.stream || 'Stream A'}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Gender & Date of Birth</span>
              <span>{student.gender} · {student.dob || 'N/A'}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Guardian Contact</span>
              <span>{student.parentName} ({student.parentPhone})</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-500">Home Address</span>
              <span>{student.address || 'Kamonyi District, Rwanda'}</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Academic Snapshot</h3>
            <p className="text-3xl font-bold text-blue-900 dark:text-amber-400 tabular-nums">{avgScore}%</p>
            <p className="text-xs text-slate-500">
              Overall term average across {myMarks.length} subject(s) · {myHomework.length} active homework assignment(s) · {myMaterials.length} class resource(s).
            </p>
          </div>
        </div>
      )}

      {tab === 'timetable' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">My Class Timetable ({student.gradeCode})</h3>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {myTimetable.length === 0 ? (
              <p className="text-slate-400 py-6 text-center">No timetable slots configured for your class yet.</p>
            ) : (
              myTimetable.map((slot) => (
                <div key={slot.id} className="py-3 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-blue-900 dark:text-amber-400">{slot.dayOfWeek}</span>
                    <span className="mx-2 text-slate-400">·</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{slot.subjectName}</span>
                    <span className="ml-2 text-slate-500">({slot.teacherName} · {slot.room})</span>
                  </div>
                  <span className="font-mono text-slate-600 dark:text-slate-300 tabular-nums">
                    {slot.startTime}–{slot.endTime}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {tab === 'homework' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Homework & Assignments ({student.gradeCode})</h3>
          {myHomework.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">No homework posted yet.</p>
          ) : (
            myHomework.map((hw) => (
              <div key={hw.id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-900 dark:text-white">{hw.title}</span>
                  <span className="text-amber-600 tabular-nums">Due: {hw.dueDate}</span>
                </div>
                <p className="text-[11px] text-blue-800 dark:text-blue-300">{hw.subjectName} · Teacher: {hw.teacherName}</p>
                <p className="text-xs text-slate-600 dark:text-slate-300">{hw.instructions}</p>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'results' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">My Examination Results</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-semibold">Subject</th>
                  <th className="py-3 px-4 font-semibold">CAT</th>
                  <th className="py-3 px-4 font-semibold">Exam</th>
                  <th className="py-3 px-4 font-semibold">Total %</th>
                  <th className="py-3 px-4 font-semibold">Grade</th>
                  <th className="py-3 px-4 font-semibold">Remark</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {myMarks.map((m) => (
                  <tr key={m.id}>
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">{m.subjectName}</td>
                    <td className="py-3 px-4 tabular-nums">{m.catScore}</td>
                    <td className="py-3 px-4 tabular-nums">{m.examScore}</td>
                    <td className="py-3 px-4 font-bold text-blue-900 dark:text-amber-400 tabular-nums">{m.totalPercent}%</td>
                    <td className="py-3 px-4 font-bold">{m.gradeLetter}</td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{m.remark}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'materials' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Learning Materials ({student.gradeCode})</h3>
          {myMaterials.map((mat) => (
            <div key={mat.id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
              <p className="text-xs font-bold text-slate-900 dark:text-white">{mat.title}</p>
              <p className="text-[11px] text-slate-500">{mat.subjectName} · {mat.materialType} · Uploaded by {mat.uploadedBy}</p>
              <p className="text-xs text-slate-600 dark:text-slate-300">{mat.description}</p>
            </div>
          ))}
        </div>
      )}

      {tab === 'attendance' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-2 text-xs">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">My Attendance Summary</h3>
          {myAttendance.length === 0 ? (
            <p className="text-slate-400 py-6 text-center">No attendance entries recorded yet.</p>
          ) : (
            myAttendance.map((a) => (
              <div key={a.id} className="py-2 flex justify-between border-b border-slate-100 dark:border-slate-800">
                <span className="font-mono">{a.date}</span>
                <span className="font-bold">{a.status}</span>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'announcements' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">School Announcements</h3>
          {announcements.map((ann) => (
            <div key={ann.id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
              <p className="text-xs font-bold text-blue-900 dark:text-amber-400">{ann.title}</p>
              <p className="text-xs text-slate-600 dark:text-slate-300">{ann.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
