import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  Users,
  GraduationCap,
  Wallet,
  CalendarCheck,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import {
  getEnrolledStudents,
  getStaffMembers,
  getAttendanceRecords,
  getApplications,
  getPaymentTransactions,
} from '../services/adminStore';
import { getExamMarks, getFeeStructures } from '../services/smsStore';
import { ACADEMIC_GRADES } from '../data/schoolData';

export const ReportsAnalyticsModule: React.FC = () => {
  const [gradeFilter, setGradeFilter] = useState<string>('ALL');

  const students = useMemo(() => getEnrolledStudents(), []);
  const staff = useMemo(() => getStaffMembers(), []);
  const attendance = useMemo(() => getAttendanceRecords(), []);
  const examMarks = useMemo(() => getExamMarks(), []);
  const applications = useMemo(() => getApplications(), []);
  const payments = useMemo(() => getPaymentTransactions(), []);
  const feeStructures = useMemo(() => getFeeStructures(), []);

  const filteredStudents = useMemo(
    () => (gradeFilter === 'ALL' ? students : students.filter((s) => s.gradeCode === gradeFilter)),
    [students, gradeFilter]
  );

  // Gender counts
  const maleCount = filteredStudents.filter((s) => s.gender === 'Male').length;
  const femaleCount = filteredStudents.filter((s) => s.gender === 'Female').length;
  const totalStudents = filteredStudents.length;

  // Per-class enrollment breakdown
  const classBreakdown = useMemo(() => {
    return ACADEMIC_GRADES.map((g) => {
      const list = students.filter((s) => s.gradeCode === g.code);
      const classMarks = examMarks.filter((m) => m.gradeCode === g.code);
      const avgScore =
        classMarks.length > 0
          ? Math.round((classMarks.reduce((sum, m) => sum + m.totalPercent, 0) / classMarks.length) * 10) / 10
          : 0;
      const expectedPerStudent = feeStructures.find((f) => f.gradeCode === g.code)?.totalExpected || 92000;
      const expectedTotal = list.filter((s) => s.status === 'Active').length * expectedPerStudent;
      const collectedTotal = payments
        .filter((p) => p.gradeCode === g.code && (p.status === 'Completed' || p.status === 'Refund Requested'))
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);

      return {
        code: g.code,
        name: g.name,
        count: list.length,
        avgScore,
        expectedTotal,
        collectedTotal,
        outstandingTotal: Math.max(0, expectedTotal - collectedTotal),
      };
    });
  }, [students, examMarks, feeStructures, payments]);

  const totalCollected = payments
    .filter((p) => p.status === 'Completed' || p.status === 'Refund Requested')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const totalExpectedSchool = classBreakdown.reduce((sum, c) => sum + c.expectedTotal, 0);
  const totalOutstanding = Math.max(0, totalExpectedSchool - totalCollected);

  const presentTotal = attendance.filter((a) => a.status === 'Present').length;
  const lateTotal = attendance.filter((a) => a.status === 'Late').length;
  const excusedTotal = attendance.filter((a) => a.status === 'Excused').length;
  const absentTotal = attendance.filter((a) => a.status === 'Absent').length;
  const attendanceRate =
    attendance.length > 0 ? Math.round(((presentTotal + lateTotal) / attendance.length) * 1000) / 10 : 100;

  const maxClassCount = Math.max(1, ...classBreakdown.map((c) => c.count));

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const summaryRows = classBreakdown.map((c) => ({
      Grade: c.code,
      ClassName: c.name,
      EnrolledStudents: c.count,
      AverageExamPercent: c.avgScore,
      ExpectedFeesRWF: c.expectedTotal,
      CollectedFeesRWF: c.collectedTotal,
      OutstandingRWF: c.outstandingTotal,
    }));
    const ws1 = XLSX.utils.json_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, ws1, 'Class Analytics');

    const studentRows = filteredStudents.map((s) => ({
      RegNumber: s.regNumber,
      FullName: s.fullName,
      Grade: s.gradeCode,
      Stream: s.stream || 'Stream A',
      Gender: s.gender,
      Status: s.status,
      Parent: s.parentName,
      ParentPhone: s.parentPhone,
    }));
    const ws2 = XLSX.utils.json_to_sheet(studentRows);
    XLSX.utils.book_append_sheet(wb, ws2, 'Students Directory');

    XLSX.writeFile(wb, `Mugina_Hope_School_Analytics_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportSummaryPdf = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    doc.setFillColor(30, 58, 138);
    doc.rect(0, 0, pageW, 26, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('MUGINA HOPE PRIMARY SCHOOL — EXECUTIVE ANALYTICS REPORT', 14, 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleDateString()}  |  Location: Mugina, Kamonyi District`, 14, 20);

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text('School-Wide Executive KPIs', 14, 36);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text(
      `Total Enrolled Learners: ${students.length} (Male: ${students.filter((s) => s.gender === 'Male').length}, Female: ${students.filter((s) => s.gender === 'Female').length})`,
      14,
      44
    );
    doc.text(`Active Teaching & Administrative Staff: ${staff.filter((s) => s.status === 'Active').length}`, 14, 51);
    doc.text(`Admissions Applications: ${applications.length} (${applications.filter((a) => a.status === 'Pending Confirmation').length} pending)`, 14, 58);
    doc.text(`Attendance Rate: ${attendanceRate}% (Present: ${presentTotal}, Late: ${lateTotal}, Excused: ${excusedTotal}, Absent: ${absentTotal})`, 14, 65);
    doc.text(
      `Fee Collection Summary: Collected ${totalCollected.toLocaleString()} RWF  |  Outstanding: ${totalOutstanding.toLocaleString()} RWF`,
      14,
      72
    );

    let y = 84;
    doc.setFillColor(30, 58, 138);
    doc.rect(14, y, pageW - 28, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('Class', 17, y + 5.5);
    doc.text('Students', 60, y + 5.5);
    doc.text('Avg Exam %', 88, y + 5.5);
    doc.text('Collected (RWF)', 120, y + 5.5);
    doc.text('Outstanding (RWF)', 162, y + 5.5);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    classBreakdown.forEach((c) => {
      doc.rect(14, y, pageW - 28, 7.5);
      doc.text(`${c.code} - ${c.name}`, 17, y + 5);
      doc.text(String(c.count), 64, y + 5);
      doc.text(`${c.avgScore}%`, 92, y + 5);
      doc.text(c.collectedTotal.toLocaleString(), 120, y + 5);
      doc.text(c.outstandingTotal.toLocaleString(), 162, y + 5);
      y += 7.5;
    });

    doc.save(`Mugina_Hope_Executive_Report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const malePct = totalStudents > 0 ? Math.round((maleCount / totalStudents) * 100) : 50;

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <BarChart3 size={20} className="text-blue-900 dark:text-amber-400" />
            School Analytics & Institutional Reporting
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Live metrics computed from enrolled students, staff directory, attendance registers, examination grades, and fee ledger.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
          >
            <option value="ALL">All Grades (Nursery – P6)</option>
            {ACADEMIC_GRADES.map((g) => (
              <option key={g.code} value={g.code}>{g.name}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg cursor-pointer"
          >
            <FileSpreadsheet size={14} /> Export Excel (.xlsx)
          </button>
          <button
            type="button"
            onClick={handleExportSummaryPdf}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-900 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
          >
            <Download size={14} /> Export PDF Report
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Total Enrolled Students</span>
            <GraduationCap size={16} className="text-blue-900 dark:text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2 tabular-nums">{totalStudents}</p>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            Male: {maleCount} · Female: {femaleCount}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Attendance Reliability</span>
            <CalendarCheck size={16} className="text-emerald-700 dark:text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-2 tabular-nums">{attendanceRate}%</p>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            Present: {presentTotal} · Late: {lateTotal} · Excused: {excusedTotal}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Fees Collected</span>
            <Wallet size={16} className="text-blue-900 dark:text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2 tabular-nums">
            {totalCollected.toLocaleString()} RWF
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 tabular-nums">
            Outstanding: {totalOutstanding.toLocaleString()} RWF
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Faculty & Admissions</span>
            <Users size={16} className="text-blue-900 dark:text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2 tabular-nums">
            {staff.filter((s) => s.status === 'Active').length} Staff
          </p>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            {applications.length} Total Admissions Applications
          </p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Per-class Enrollment Bar Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Students & Academic Performance by Class</h3>
            <span className="text-xs text-slate-500">Nursery to P6</span>
          </div>
          <div className="space-y-3">
            {classBreakdown.map((c) => (
              <div key={c.code} className="grid grid-cols-12 items-center gap-3 text-xs">
                <div className="col-span-3 font-semibold text-slate-800 dark:text-slate-200 truncate">{c.code} · {c.name}</div>
                <div className="col-span-6 h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-900 dark:bg-amber-400 rounded-full transition-all"
                    style={{ width: `${Math.round((c.count / maxClassCount) * 100)}%` }}
                  />
                </div>
                <div className="col-span-3 text-right tabular-nums text-slate-600 dark:text-slate-300">
                  <span className="font-bold">{c.count}</span> learners · <span className="text-emerald-700 dark:text-emerald-400">{c.avgScore}% avg</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Gender Ratio & Admissions Funnel */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-6">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Gender Ratio Distribution</h3>
            <div className="flex items-center gap-6">
              <svg viewBox="0 0 36 36" className="w-24 h-24 shrink-0">
                <circle
                  cx="18"
                  cy="18"
                  r="15.915"
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="4"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="15.915"
                  fill="none"
                  stroke="#1e3a8a"
                  strokeWidth="4"
                  strokeDasharray={`${malePct} ${100 - malePct}`}
                  strokeDashoffset="25"
                />
              </svg>
              <div className="space-y-2 text-xs">
                <p className="font-semibold text-blue-900 dark:text-blue-300 tabular-nums">Male: {maleCount} ({malePct}%)</p>
                <p className="font-semibold text-amber-600 dark:text-amber-400 tabular-nums">Female: {femaleCount} ({100 - malePct}%)</p>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-2 text-xs">
            <h4 className="font-bold text-slate-900 dark:text-white">Admissions Funnel</h4>
            <div className="flex justify-between py-1">
              <span className="text-slate-600 dark:text-slate-400">Confirmed & Enrolled</span>
              <span className="font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                {applications.filter((a) => a.status === 'Confirmed & Enrolled').length}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-600 dark:text-slate-400">Pending Review</span>
              <span className="font-bold text-amber-600 tabular-nums">
                {applications.filter((a) => a.status === 'Pending Confirmation').length}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-600 dark:text-slate-400">Waitlist</span>
              <span className="font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                {applications.filter((a) => a.status === 'Waitlist').length}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
