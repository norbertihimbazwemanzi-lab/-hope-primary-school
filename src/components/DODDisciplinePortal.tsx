import React, { useState, useMemo } from 'react';
import {
  EnrolledStudent,
  DisciplineRecord,
  getCurrentSessionUser,
} from '../services/adminStore';
import { ACADEMIC_GRADES, SCHOOL_INFO } from '../data/schoolData';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Search,
  User,
  Phone,
  Plus,
  Trash2,
  Edit3,
  FileSpreadsheet,
  Clock,
  Printer,
  Sparkles,
  ChevronDown,
  Filter,
  Users,
  Award,
  Send,
  X,
  FileText,
} from 'lucide-react';

interface DODDisciplinePortalProps {
  students: EnrolledStudent[];
}

const LOCAL_DISCIPLINE_KEY = 'mugina_discipline_records_v3';

const defaultDisciplineRecords: DisciplineRecord[] = [
  {
    id: 'disc-1',
    caseNumber: 'DISC-2026-001',
    date: '2026-02-10',
    studentId: 'stu-p4-3',
    studentName: 'Eric Mugisha',
    regNumber: 'MHA-2026-104',
    gradeCode: 'P4',
    incidentType: 'Tardiness / Truancy',
    severity: 'Minor',
    incidentDescription: 'Arrived 45 minutes late without parent written excuse for the 3rd consecutive morning.',
    actionTaken: 'Verbal Warning',
    parentNotified: true,
    parentContact: '+250 788 123 456',
    status: 'Resolved & Closed',
    recordedBy: 'Patrick Niyitegeka (DOD)',
    resolutionNotes: 'Parent came in, agreed to morning transport adjustment. Student pledged punctuality.',
  },
  {
    id: 'disc-2',
    caseNumber: 'DISC-2026-002',
    date: '2026-02-14',
    studentId: 'stu-p4-5',
    studentName: 'Christian Kwizera',
    regNumber: 'MHA-2026-106',
    gradeCode: 'P4',
    incidentType: 'Uniform & Grooming Violation',
    severity: 'Minor',
    incidentDescription: 'Repeated non-regulation footwear and missing school tie during morning assembly.',
    actionTaken: 'Written Reprimand',
    parentNotified: true,
    parentContact: '+250 788 456 789',
    status: 'Action In Progress',
    recordedBy: 'Patrick Niyitegeka (DOD)',
    resolutionNotes: 'Parent contacted via phone, uniform pack collection arranged with bursar.',
  },
  {
    id: 'disc-3',
    caseNumber: 'DISC-2026-003',
    date: '2026-02-18',
    studentId: 'stu-p4-1',
    studentName: 'Keza Aline Manzi',
    regNumber: 'MHA-2026-102',
    gradeCode: 'P4',
    incidentType: 'Merit / Exemplary Conduct',
    severity: 'Commendation',
    incidentDescription: 'Helped injured nursery child safely return to dispensary and assisted during campus tree planting.',
    actionTaken: 'Merit Certificate Awarded',
    parentNotified: true,
    parentContact: '+250 788 258 786',
    status: 'Resolved & Closed',
    recordedBy: 'Patrick Niyitegeka (DOD)',
    resolutionNotes: 'Commended during Friday assembly before entire school body.',
  },
];

export const DODDisciplinePortal: React.FC<DODDisciplinePortalProps> = ({ students }) => {
  const sessionUser = getCurrentSessionUser();

  // Load Discipline Records
  const [records, setRecords] = useState<DisciplineRecord[]>(() => {
    try {
      const raw = localStorage.getItem(LOCAL_DISCIPLINE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn('Error reading discipline records:', e);
    }
    return defaultDisciplineRecords;
  });

  const saveRecords = (updated: DisciplineRecord[]) => {
    setRecords(updated);
    try {
      localStorage.setItem(LOCAL_DISCIPLINE_KEY, JSON.stringify(updated));
      fetch('/api/discipline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: updated }),
      }).catch((e) => console.warn('Discipline sync notice:', e));
    } catch (e) {
      console.error('Error saving discipline records:', e);
    }
  };

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterGrade, setFilterGrade] = useState('ALL');

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DisciplineRecord | null>(null);
  const [showSummonsModal, setShowSummonsModal] = useState<DisciplineRecord | null>(null);

  // Form State
  const [selectedStudentId, setSelectedStudentId] = useState<string>(students.length > 0 ? students[0].id : '');
  const [incidentDate, setIncidentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [incidentType, setIncidentType] = useState<DisciplineRecord['incidentType']>('Tardiness / Truancy');
  const [severity, setSeverity] = useState<DisciplineRecord['severity']>('Minor');
  const [description, setDescription] = useState('');
  const [actionTaken, setActionTaken] = useState<DisciplineRecord['actionTaken']>('Verbal Warning');
  const [parentNotified, setParentNotified] = useState(true);
  const [status, setStatus] = useState<DisciplineRecord['status']>('Open');
  const [resolutionNotes, setResolutionNotes] = useState('');

  // Metrics
  const stats = useMemo(() => {
    const total = records.length;
    const openCases = records.filter((r) => r.status === 'Open' || r.status === 'Action In Progress').length;
    const summons = records.filter((r) => r.status === 'Parent Summoned').length;
    const resolved = records.filter((r) => r.status === 'Resolved & Closed').length;
    const merits = records.filter((r) => r.incidentType === 'Merit / Exemplary Conduct').length;
    return { total, openCases, summons, resolved, merits };
  }, [records]);

  // Filtered list
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (filterSeverity !== 'ALL' && r.severity !== filterSeverity) return false;
      if (filterStatus !== 'ALL' && r.status !== filterStatus) return false;
      if (filterGrade !== 'ALL' && r.gradeCode !== filterGrade) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        r.studentName.toLowerCase().includes(q) ||
        r.regNumber.toLowerCase().includes(q) ||
        r.caseNumber.toLowerCase().includes(q) ||
        r.incidentDescription.toLowerCase().includes(q)
      );
    });
  }, [records, filterSeverity, filterStatus, filterGrade, searchQuery]);

  // Handle Save
  const handleSaveIncident = (e: React.FormEvent) => {
    e.preventDefault();
    const st = students.find((s) => s.id === selectedStudentId);
    if (!st) {
      alert('Please select a student.');
      return;
    }

    if (editingRecord) {
      const updated = records.map((r) =>
        r.id === editingRecord.id
          ? {
              ...r,
              incidentDate,
              incidentType,
              severity,
              incidentDescription: description,
              actionTaken,
              parentNotified,
              status,
              resolutionNotes,
            }
          : r
      );
      saveRecords(updated);
      setEditingRecord(null);
    } else {
      const newRecord: DisciplineRecord = {
        id: `disc-${Date.now()}`,
        caseNumber: `DISC-2026-${Math.floor(100 + Math.random() * 900)}`,
        date: incidentDate,
        studentId: st.id,
        studentName: st.fullName,
        regNumber: st.regNumber,
        gradeCode: st.gradeCode,
        incidentType,
        severity,
        incidentDescription: description,
        actionTaken,
        parentNotified,
        parentContact: st.parentPhone || st.parentEmail,
        status,
        recordedBy: sessionUser?.name || 'Director of Discipline (DOD)',
        resolutionNotes,
      };
      saveRecords([newRecord, ...records]);
    }

    setShowAddModal(false);
    setDescription('');
    setResolutionNotes('');
  };

  // Handle Delete
  const handleDelete = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete this discipline record for ${name}?`)) {
      const updated = records.filter((r) => r.id !== id);
      saveRecords(updated);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      'Case Number',
      'Date',
      'Student Name',
      'Reg ID',
      'Class',
      'Incident Type',
      'Severity',
      'Incident Description',
      'Action Taken',
      'Parent Contact',
      'Status',
      'Resolution Notes',
      'DOD Officer',
    ];

    const rows = filteredRecords.map((r) => [
      `"${r.caseNumber}"`,
      `"${r.date}"`,
      `"${r.studentName.replace(/"/g, '""')}"`,
      `"${r.regNumber}"`,
      `"${r.gradeCode}"`,
      `"${r.incidentType}"`,
      `"${r.severity}"`,
      `"${r.incidentDescription.replace(/"/g, '""')}"`,
      `"${r.actionTaken}"`,
      `"${r.parentContact}"`,
      `"${r.status}"`,
      `"${(r.resolutionNotes || '').replace(/"/g, '""')}"`,
      `"${r.recordedBy}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Mugina_Hope_Discipline_Ledger_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* DOD Persona Header */}
      <div className="bg-gradient-to-r from-rose-950 via-slate-900 to-indigo-950 rounded-3xl p-6 text-white shadow-lg space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-400/30 text-rose-300 text-xs font-bold uppercase tracking-wider">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              <span>Director of Discipline (DOD) • Student Conduct & Discipline Suite</span>
            </div>
            <h2 className="text-2xl font-black font-display tracking-tight text-white">
              Student Discipline & Behavior Control Desk
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl">
              Official console for Director of Discipline <strong>{sessionUser?.name || 'Patrick Niyitegeka'}</strong>. Log behavior infractions, commendations, parent summoning, and manage disciplinary follow-ups.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                setEditingRecord(null);
                setDescription('');
                setResolutionNotes('');
                setShowAddModal(true);
              }}
              className="px-5 py-3 bg-rose-500 hover:bg-rose-400 active:bg-rose-600 text-white font-black text-xs rounded-2xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Log Discipline Incident</span>
            </button>
            <button
              type="button"
              onClick={handleExportCSV}
              className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-2xl border border-white/20 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Export Ledger</span>
            </button>
          </div>
        </div>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-3 border-t border-white/10">
          <div className="bg-white/10 backdrop-blur-xs rounded-2xl p-3 border border-white/10">
            <span className="text-[10px] uppercase font-bold text-slate-300 tracking-wider block">
              Total Logged
            </span>
            <span className="text-xl font-black font-mono text-white">
              {stats.total} Cases
            </span>
          </div>

          <div className="bg-white/10 backdrop-blur-xs rounded-2xl p-3 border border-white/10">
            <span className="text-[10px] uppercase font-bold text-amber-300 tracking-wider block">
              Open / In Progress
            </span>
            <span className="text-xl font-black font-mono text-amber-400">
              {stats.openCases}
            </span>
          </div>

          <div className="bg-white/10 backdrop-blur-xs rounded-2xl p-3 border border-white/10">
            <span className="text-[10px] uppercase font-bold text-rose-300 tracking-wider block">
              Parent Summoned
            </span>
            <span className="text-xl font-black font-mono text-rose-400">
              {stats.summons}
            </span>
          </div>

          <div className="bg-white/10 backdrop-blur-xs rounded-2xl p-3 border border-white/10">
            <span className="text-[10px] uppercase font-bold text-emerald-300 tracking-wider block">
              Resolved & Closed
            </span>
            <span className="text-xl font-black font-mono text-emerald-400">
              {stats.resolved}
            </span>
          </div>

          <div className="bg-white/10 backdrop-blur-xs rounded-2xl p-3 border border-white/10 col-span-2 sm:col-span-1">
            <span className="text-[10px] uppercase font-bold text-purple-300 tracking-wider block">
              Merits & Awards
            </span>
            <span className="text-xl font-black font-mono text-purple-300">
              {stats.merits}
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search case #, student, reg ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 pl-9 pr-3 py-2 rounded-xl focus:bg-white focus:outline-hidden font-medium"
            />
          </div>

          <select
            value={filterGrade}
            onChange={(e) => setFilterGrade(e.target.value)}
            className="bg-slate-50 border border-slate-200 py-2 px-3 rounded-xl font-semibold"
          >
            <option value="ALL">All Classes</option>
            {ACADEMIC_GRADES.map((g) => (
              <option key={g.code} value={g.code}>
                {g.name}
              </option>
            ))}
          </select>

          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="bg-slate-50 border border-slate-200 py-2 px-3 rounded-xl font-semibold"
          >
            <option value="ALL">All Severities</option>
            <option value="Minor">Minor</option>
            <option value="Moderate">Moderate</option>
            <option value="High">High</option>
            <option value="Severe">Severe</option>
            <option value="Commendation">Commendation / Merit</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-slate-50 border border-slate-200 py-2 px-3 rounded-xl font-semibold"
          >
            <option value="ALL">All Statuses</option>
            <option value="Open">Open</option>
            <option value="Action In Progress">Action In Progress</option>
            <option value="Parent Summoned">Parent Summoned</option>
            <option value="Resolved & Closed">Resolved & Closed</option>
          </select>
        </div>

        <span className="text-slate-500 font-medium">
          Showing <strong>{filteredRecords.length}</strong> of {records.length} records
        </span>
      </div>

      {/* Incident Records Table */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-2xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
              <th className="p-3.5">Case #</th>
              <th className="p-3.5">Date</th>
              <th className="p-3.5">Student / Class</th>
              <th className="p-3.5">Incident Type</th>
              <th className="p-3.5">Severity</th>
              <th className="p-3.5">Action Taken</th>
              <th className="p-3.5">Status</th>
              <th className="p-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRecords.length > 0 ? (
              filteredRecords.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="p-3.5 font-mono font-bold text-rose-800">{r.caseNumber}</td>
                  <td className="p-3.5 text-slate-500 font-mono">{r.date}</td>
                  <td className="p-3.5">
                    <strong className="block text-slate-900 font-bold">{r.studentName}</strong>
                    <span className="text-[10px] text-blue-700 font-mono">
                      {r.regNumber} • {r.gradeCode}
                    </span>
                  </td>
                  <td className="p-3.5">
                    <span className="font-semibold text-slate-800">{r.incidentType}</span>
                    <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{r.incidentDescription}</p>
                  </td>
                  <td className="p-3.5">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                        r.severity === 'Minor'
                          ? 'bg-slate-100 text-slate-800 border-slate-200'
                          : r.severity === 'Moderate'
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : r.severity === 'High'
                          ? 'bg-orange-100 text-orange-900 border-orange-300'
                          : r.severity === 'Severe'
                          ? 'bg-rose-100 text-rose-900 border-rose-300'
                          : 'bg-purple-100 text-purple-900 border-purple-300'
                      }`}
                    >
                      {r.severity}
                    </span>
                  </td>
                  <td className="p-3.5 text-slate-700 font-medium">{r.actionTaken}</td>
                  <td className="p-3.5">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        r.status === 'Resolved & Closed'
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                          : r.status === 'Parent Summoned'
                          ? 'bg-rose-100 text-rose-900 border-rose-300'
                          : 'bg-amber-100 text-amber-900 border-amber-300'
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="p-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setShowSummonsModal(r)}
                        className="px-2 py-1 text-[11px] font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors cursor-pointer"
                        title="Generate Parent Summons Letter"
                      >
                        Summons
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingRecord(r);
                          setSelectedStudentId(r.studentId);
                          setIncidentDate(r.date);
                          setIncidentType(r.incidentType);
                          setSeverity(r.severity);
                          setDescription(r.incidentDescription);
                          setActionTaken(r.actionTaken);
                          setStatus(r.status);
                          setResolutionNotes(r.resolutionNotes || '');
                          setShowAddModal(true);
                        }}
                        className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 cursor-pointer"
                        title="Edit Incident"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(r.id, r.studentName)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer"
                        title="Delete Record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-400">
                  <ShieldAlert className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-xs">No disciplinary records match your criteria.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: LOG / EDIT DISCIPLINE INCIDENT */}
      {/* ========================================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                <span>{editingRecord ? `Edit Case: ${editingRecord.caseNumber}` : 'Log Student Discipline Incident'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveIncident} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold block mb-1">Select Student *</label>
                <select
                  disabled={!!editingRecord}
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full bg-slate-50 border p-2.5 rounded-xl font-semibold"
                >
                  {students.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.fullName} ({st.regNumber} - {st.gradeCode})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold block mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={incidentDate}
                    onChange={(e) => setIncidentDate(e.target.value)}
                    className="w-full bg-slate-50 border p-2.5 rounded-xl font-semibold"
                  />
                </div>
                <div>
                  <label className="font-bold block mb-1">Severity *</label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as DisciplineRecord['severity'])}
                    className="w-full bg-slate-50 border p-2.5 rounded-xl font-semibold"
                  >
                    <option value="Minor">Minor</option>
                    <option value="Moderate">Moderate</option>
                    <option value="High">High</option>
                    <option value="Severe">Severe</option>
                    <option value="Commendation">Commendation / Merit</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold block mb-1">Incident Category *</label>
                <select
                  value={incidentType}
                  onChange={(e) => setIncidentType(e.target.value as DisciplineRecord['incidentType'])}
                  className="w-full bg-slate-50 border p-2.5 rounded-xl font-semibold"
                >
                  <option value="Tardiness / Truancy">Tardiness / Truancy</option>
                  <option value="Uniform & Grooming Violation">Uniform & Grooming Violation</option>
                  <option value="Classroom Disruption">Classroom Disruption</option>
                  <option value="Disrespect / Insubordination">Disrespect / Insubordination</option>
                  <option value="Physical Altercation">Physical Altercation</option>
                  <option value="Property Damage">Property Damage</option>
                  <option value="Academic Dishonesty">Academic Dishonesty</option>
                  <option value="Merit / Exemplary Conduct">Merit / Exemplary Conduct</option>
                </select>
              </div>

              <div>
                <label className="font-bold block mb-1">Incident Description & Circumstances *</label>
                <textarea
                  required
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detail the events, location (e.g. school playground, classroom 4), witnesses, and behavior observed."
                  className="w-full bg-slate-50 border p-2.5 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold block mb-1">Action Taken *</label>
                  <select
                    value={actionTaken}
                    onChange={(e) => setActionTaken(e.target.value as DisciplineRecord['actionTaken'])}
                    className="w-full bg-slate-50 border p-2.5 rounded-xl font-semibold"
                  >
                    <option value="Verbal Warning">Verbal Warning</option>
                    <option value="Written Reprimand">Written Reprimand</option>
                    <option value="Counseling Session">Counseling Session</option>
                    <option value="Detention / Campus Service">Detention / Campus Service</option>
                    <option value="Parent Conference Summoned">Parent Conference Summoned</option>
                    <option value="Suspension Recommendation">Suspension Recommendation</option>
                    <option value="Merit Certificate Awarded">Merit Certificate Awarded</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold block mb-1">Case Status *</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as DisciplineRecord['status'])}
                    className="w-full bg-slate-50 border p-2.5 rounded-xl font-semibold"
                  >
                    <option value="Open">Open</option>
                    <option value="Action In Progress">Action In Progress</option>
                    <option value="Parent Summoned">Parent Summoned</option>
                    <option value="Resolved & Closed">Resolved & Closed</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold block mb-1">Resolution & Follow-up Notes</label>
                <textarea
                  rows={2}
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Record outcomes of parent conference, behavior improvements, or follow-up date."
                  className="w-full bg-slate-50 border p-2.5 rounded-xl"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 font-semibold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  {editingRecord ? 'Update Record' : 'Save Disciplinary Log'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: OFFICIAL PARENT SUMMONS NOTICE */}
      {/* ========================================================================= */}
      {showSummonsModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm">Official Parent Summons Notice</h3>
              <button
                type="button"
                onClick={() => setShowSummonsModal(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50 space-y-3 text-xs leading-relaxed">
              <div className="text-center pb-3 border-b border-slate-200">
                <strong className="block text-sm font-black text-slate-900">{SCHOOL_INFO.name}</strong>
                <span className="text-[11px] text-slate-500">Office of the Director of Discipline (DOD)</span>
                <span className="block mt-1 font-mono text-[10px] font-bold text-rose-700">
                  REF: {showSummonsModal.caseNumber}
                </span>
              </div>

              <p>
                <strong>To Parent / Guardian of:</strong> {showSummonsModal.studentName} (ID: {showSummonsModal.regNumber}, Class: {showSummonsModal.gradeCode})
              </p>
              <p>
                <strong>Subject:</strong> Urgent Parent Disciplinary Consultation regarding <em>{showSummonsModal.incidentType}</em>
              </p>
              <p className="text-slate-700">
                You are respectfully requested to report to the Director of Discipline desk at Mugina Hope Academy (adjacent to Mugina Police Station, Kamonyi) to discuss this matter with the disciplinary committee.
              </p>
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900">
                <strong>Incident Summary:</strong> {showSummonsModal.incidentDescription}
              </div>
              <p className="text-[11px] text-slate-500 pt-2 border-t border-slate-200">
                Authorized by: {showSummonsModal.recordedBy} • School Tel: {SCHOOL_INFO.contact.phone}
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Notice</span>
              </button>
              <button
                type="button"
                onClick={() => setShowSummonsModal(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
