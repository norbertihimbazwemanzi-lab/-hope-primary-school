import React, { useState, useMemo } from 'react';
import {
  StaffMember,
  TeacherAttendanceRecord,
  getCurrentSessionUser,
} from '../services/adminStore';
import { ACADEMIC_GRADES, SCHOOL_INFO } from '../data/schoolData';
import {
  Calendar,
  Users,
  CheckCircle2,
  Clock,
  Search,
  UserCheck,
  FileSpreadsheet,
  Plus,
  Trash2,
  Edit3,
  Award,
  Sparkles,
  BookOpen,
  Check,
  X,
  AlertTriangle,
} from 'lucide-react';

interface TeacherAttendanceTrackerProps {
  staffList: StaffMember[];
}

const LOCAL_TEACHER_ATT_KEY = 'mugina_teacher_attendance_v3';

const defaultTeacherAttendanceSeed: TeacherAttendanceRecord[] = [
  {
    id: 't-att-1',
    date: new Date().toISOString().split('T')[0],
    staffId: 'staff-teacher-1',
    teacherName: 'Marie Claire Mukamana',
    assignedSubjectOrGrade: 'Primary 1 • Literacy & Numeracy',
    status: 'Present',
    arrivalCheckInTime: '06:55 AM',
    markedBy: 'Jean Damascene (DOS)',
    topicsCovered: 'Phonics reading syllables & single-digit addition',
    dutySignature: 'M.Claire (Signed)',
    notes: 'Arrived early; morning assembly line conductor.',
  },
  {
    id: 't-att-2',
    date: new Date().toISOString().split('T')[0],
    staffId: 'staff-teacher-2',
    teacherName: 'Emmanuel Habimana',
    assignedSubjectOrGrade: 'Primary 4 • STEM & Science',
    status: 'Present',
    arrivalCheckInTime: '07:10 AM',
    markedBy: 'Jean Damascene (DOS)',
    topicsCovered: 'Plant reproduction & seed germination experiment',
    dutySignature: 'E.Habimana (Signed)',
    notes: 'Science laboratory apparatus cleaned & stored.',
  },
];

export const TeacherAttendanceTracker: React.FC<TeacherAttendanceTrackerProps> = ({ staffList }) => {
  const sessionUser = getCurrentSessionUser();

  // Teachers only from staffList
  const teachers = useMemo(() => {
    return staffList.filter((s) => s.role === 'Teacher');
  }, [staffList]);

  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Load records
  const [records, setRecords] = useState<TeacherAttendanceRecord[]>(() => {
    try {
      const raw = localStorage.getItem(LOCAL_TEACHER_ATT_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn('Error reading teacher attendance records:', e);
    }
    return defaultTeacherAttendanceSeed;
  });

  const saveRecords = (updated: TeacherAttendanceRecord[]) => {
    setRecords(updated);
    try {
      localStorage.setItem(LOCAL_TEACHER_ATT_KEY, JSON.stringify(updated));
      fetch('/api/teacher-attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: updated }),
      }).catch((e) => console.warn('Teacher attendance sync note:', e));
    } catch (e) {
      console.error('Error saving teacher attendance:', e);
    }
  };

  // State for daily roll-call map
  const [dailyMap, setDailyMap] = useState<
    Record<
      string,
      {
        status: TeacherAttendanceRecord['status'];
        arrivalTime: string;
        topicsCovered: string;
        notes: string;
      }
    >
  >({});

  // Sync daily map when date changes
  useMemo(() => {
    const existing = records.filter((r) => r.date === selectedDate);
    const map: Record<string, any> = {};

    teachers.forEach((t) => {
      const match = existing.find((r) => r.staffId === t.id);
      if (match) {
        map[t.id] = {
          status: match.status,
          arrivalTime: match.arrivalCheckInTime || '07:00 AM',
          topicsCovered: match.topicsCovered || '',
          notes: match.notes || '',
        };
      } else {
        map[t.id] = {
          status: 'Present',
          arrivalTime: '07:00 AM',
          topicsCovered: '',
          notes: '',
        };
      }
    });

    setDailyMap(map);
  }, [selectedDate, teachers, records]);

  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Save Today's Teacher Roll Call
  const handleSaveBatch = () => {
    const now = new Date().toISOString();
    const dosName = sessionUser?.name || 'Director of Studies (DOS)';

    const newEntries: TeacherAttendanceRecord[] = teachers.map((t) => {
      const entry = dailyMap[t.id] || {
        status: 'Present',
        arrivalTime: '07:00 AM',
        topicsCovered: '',
        notes: '',
      };

      return {
        id: `tatt-${t.id}-${selectedDate}`,
        date: selectedDate,
        staffId: t.id,
        teacherName: t.name,
        assignedSubjectOrGrade: t.assignedSubjectOrGrade || 'Class Teacher',
        status: entry.status,
        arrivalCheckInTime: entry.arrivalTime,
        markedBy: dosName,
        topicsCovered: entry.topicsCovered,
        dutySignature: `${t.name.split(' ')[0]} (Verified by DOS)`,
        notes: entry.notes,
      };
    });

    const otherDates = records.filter((r) => r.date !== selectedDate);
    const updated = [...newEntries, ...otherDates];
    saveRecords(updated);
    setSuccessMsg(`Teacher attendance for ${selectedDate} successfully saved to school database!`);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Export Teacher Attendance CSV
  const handleExportCSV = () => {
    const headers = [
      'Date',
      'Teacher Name',
      'Assigned Subject / Class',
      'Status',
      'Arrival Time',
      'Topics Covered',
      'Verified By (DOS)',
      'Notes',
    ];

    const currentRecords = records.filter((r) => r.date === selectedDate);
    const rows = currentRecords.map((r) => [
      `"${r.date}"`,
      `"${r.teacherName}"`,
      `"${r.assignedSubjectOrGrade}"`,
      `"${r.status}"`,
      `"${r.arrivalCheckInTime || ''}"`,
      `"${(r.topicsCovered || '').replace(/"/g, '""')}"`,
      `"${r.markedBy}"`,
      `"${(r.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Teacher_Attendance_Report_${selectedDate}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* DOS Teacher Attendance Banner */}
      <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-indigo-950 rounded-3xl p-6 text-white shadow-lg space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-300 text-xs font-bold uppercase tracking-wider">
              <UserCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>Director of Studies (DOS) • Teacher Presence & Duty Tracker</span>
            </div>
            <h2 className="text-2xl font-black font-display tracking-tight text-white">
              Teacher & Staff Daily Attendance
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl">
              Track classroom teacher presence, check-in arrival times, topics covered in each period, and verify teaching duty logs.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportCSV}
              className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-2xl border border-white/20 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Export Daily Report</span>
            </button>
            <button
              type="button"
              onClick={handleSaveBatch}
              className="px-5 py-3 bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-slate-950 font-black text-xs rounded-2xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Save Teacher Attendance</span>
            </button>
          </div>
        </div>

        {/* Date Selector and Quick Summary */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/10 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-300 font-bold">Select Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-1.5 bg-white/10 border border-white/20 rounded-xl text-white font-semibold focus:bg-white focus:text-slate-900 focus:outline-hidden"
            />
          </div>

          <div className="flex items-center gap-3">
            <span className="text-slate-300">
              Active Teaching Staff: <strong>{teachers.length}</strong>
            </span>
            <span className="text-emerald-300">
              Present Today:{' '}
              <strong>
                {Object.values(dailyMap).filter((v) => v.status === 'Present').length}
              </strong>
            </span>
          </div>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl flex items-center gap-2 text-xs font-semibold animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Teacher Attendance Roll Call Table */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-2xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
              <th className="p-3.5">#</th>
              <th className="p-3.5">Teacher Name</th>
              <th className="p-3.5">Assigned Stream / Level</th>
              <th className="p-3.5">Attendance Status</th>
              <th className="p-3.5">Check-In Time</th>
              <th className="p-3.5">Curriculum Topics Covered</th>
              <th className="p-3.5">DOS Observations / Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {teachers.map((t, idx) => {
              const current = dailyMap[t.id] || {
                status: 'Present',
                arrivalTime: '07:00 AM',
                topicsCovered: '',
                notes: '',
              };

              return (
                <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="p-3.5 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                  <td className="p-3.5">
                    <strong className="block text-slate-900 font-bold">{t.name}</strong>
                    <span className="text-[10px] text-slate-400 font-mono">{t.phone}</span>
                  </td>
                  <td className="p-3.5 text-slate-700 font-medium">
                    {t.assignedSubjectOrGrade || 'Primary Teacher'}
                  </td>
                  <td className="p-3.5">
                    <div className="flex items-center gap-1">
                      {(['Present', 'Late', 'On Leave', 'Absent'] as const).map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => {
                            setDailyMap((prev) => ({
                              ...prev,
                              [t.id]: {
                                ...(prev[t.id] || current),
                                status: st,
                              },
                            }));
                          }}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                            current.status === st
                              ? st === 'Present'
                                ? 'bg-emerald-600 text-white border-emerald-700'
                                : st === 'Late'
                                ? 'bg-amber-500 text-slate-950 border-amber-600'
                                : st === 'On Leave'
                                ? 'bg-blue-600 text-white border-blue-700'
                                : 'bg-rose-600 text-white border-rose-700'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200'
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td className="p-3.5">
                    <input
                      type="text"
                      value={current.arrivalTime}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDailyMap((prev) => ({
                          ...prev,
                          [t.id]: {
                            ...(prev[t.id] || current),
                            arrivalTime: val,
                          },
                        }));
                      }}
                      className="w-24 bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg text-xs font-mono font-medium"
                    />
                  </td>
                  <td className="p-3.5">
                    <input
                      type="text"
                      placeholder="e.g. Unit 3: Fraction multiplication"
                      value={current.topicsCovered}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDailyMap((prev) => ({
                          ...prev,
                          [t.id]: {
                            ...(prev[t.id] || current),
                            topicsCovered: val,
                          },
                        }));
                      }}
                      className="w-full bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg text-xs font-medium placeholder:text-slate-300"
                    />
                  </td>
                  <td className="p-3.5">
                    <input
                      type="text"
                      placeholder="DOS note..."
                      value={current.notes}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDailyMap((prev) => ({
                          ...prev,
                          [t.id]: {
                            ...(prev[t.id] || current),
                            notes: val,
                          },
                        }));
                      }}
                      className="w-full bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg text-xs font-medium placeholder:text-slate-300"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
