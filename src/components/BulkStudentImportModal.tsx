import React, { useState, useEffect } from 'react';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  FileUp,
  FileText,
  Users,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  X,
  RefreshCw,
  Calendar,
  ClipboardCheck,
} from 'lucide-react';
import { ACADEMIC_GRADES } from '../data/schoolData';
import {
  EnrolledStudent,
  AttendanceRecord,
  getEnrolledStudents,
  enrollStudentsBatchByDOS,
  saveAttendanceBatch,
} from '../services/adminStore';

if (pdfjsLib?.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
}

export interface BulkStudentImportModalProps {
  isOpen: boolean;
  defaultGradeCode?: string;
  defaultAttendanceDate?: string;
  enrolledBy?: string;
  onClose: () => void;
  onImported: (
    createdStudents: EnrolledStudent[],
    gradeCode: string,
    attendanceDate: string,
    markPresent: boolean
  ) => void;
}

interface ParsedStudentRow {
  rowKey: string;
  fullName: string;
  gender: 'Female' | 'Male';
  parentName: string;
  parentPhone: string;
  parentEmail: string;
}

const NOISE_EXACT_SET = new Set([
  'no',
  'no.',
  '#',
  's/n',
  'sn',
  'id',
  'reg',
  'reg id',
  'reg number',
  'registration id',
  'registration number',
  'name',
  'names',
  'full name',
  'student name',
  'student full name',
  'learner name',
  'learner full name',
  'pupil name',
  'pupils',
  'students',
  'learners',
  'student list',
  'class list',
  'class roster',
  'attendance list',
  'attendance sheet',
  'gender',
  'sex',
  'class',
  'grade',
  'parent',
  'parent name',
  'guardian',
  'phone',
  'parent phone',
  'email',
  'parent email',
  'status',
  'signature',
  'total',
]);

const SKIP_CONTAINS = [
  'mugina hope',
  'kamonyi district',
  'southern province',
  'mineduc',
  'mugina sector',
  'official student list',
  'daily attendance report',
];

const cleanLeadingListMarker = (text: string): string =>
  text
    .replace(/^\s*(?:\(\s*\d{1,4}\s*\)|\d{1,4}\s*[.)\]:\-–]|[a-zA-Z]\s*\)|[•●▪◦‣\-–—*#]+)\s+/u, '')
    .trim();

const isNoiseHeaderOrFooter = (line: string): boolean => {
  const lower = line.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!lower || lower.length < 2) return true;
  if (NOISE_EXACT_SET.has(lower)) return true;
  if (/^page\s+\d+(\s+(of|\/)\s+\d+)?$/i.test(lower)) return true;
  if (/^date\s*[:\-]/i.test(lower)) return true;
  if (/^class\s*[:\-]/i.test(lower)) return true;
  if (/^teacher\s*[:\-]/i.test(lower)) return true;
  if (/^total(\s+students|\s+learners|\s+pupils)?\s*[:\-]?\s*\d*$/i.test(lower)) return true;
  if (/^\d+$/.test(lower)) return true;
  if (/^[_\-=*.]{3,}$/.test(lower)) return true;
  if (SKIP_CONTAINS.some((phrase) => lower.includes(phrase) && lower.length < 80)) return true;
  return false;
};

const normalizeGender = (val: string): 'Female' | 'Male' | null => {
  const clean = val.trim().toLowerCase();
  if (clean === 'm' || clean === 'male' || clean === 'boy' || clean === 'b') return 'Male';
  if (clean === 'f' || clean === 'female' || clean === 'girl' || clean === 'g') return 'Female';
  return null;
};

const isEmailToken = (val: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());

const isPhoneToken = (val: string): boolean => {
  const digits = val.replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15 && /^[+\d\s\-().]+$/.test(val.trim());
};

const isSerialOrRegToken = (val: string): boolean => {
  const clean = val.trim();
  if (/^\d{1,4}[.)]?$/.test(clean)) return true;
  if (/^(MHA|STU)[-_]?\d+/i.test(clean)) return true;
  return false;
};

const parseLinesToStudentRows = (rawLines: string[]): ParsedStudentRow[] => {
  const rows: ParsedStudentRow[] = [];
  const seenNames = new Set<string>();

  rawLines.forEach((rawLine, index) => {
    const trimmed = rawLine.replace(/\u00a0/g, ' ').trim();
    if (!trimmed || isNoiseHeaderOrFooter(trimmed)) return;

    // Split delimited rows (tabs from Word tables / aligned PDF columns, pipes, semicolons, or CSV commas)
    let cells: string[] = [];
    if (trimmed.includes('\t')) {
      cells = trimmed.split('\t').map((c) => c.trim()).filter(Boolean);
    } else if (trimmed.includes('|')) {
      cells = trimmed.split('|').map((c) => c.trim()).filter(Boolean);
    } else if (trimmed.includes(';')) {
      cells = trimmed.split(';').map((c) => c.trim()).filter(Boolean);
    } else if (trimmed.includes(',')) {
      const commaParts = trimmed.split(',').map((c) => c.trim()).filter(Boolean);
      if (commaParts.length >= 2) {
        cells = commaParts;
      }
    }

    if (cells.length >= 2) {
      // Drop serial number / Reg ID / column header fragments
      const filteredCells = cells.filter((cell, idx) => {
        if (idx === 0 && isSerialOrRegToken(cell)) return false;
        return !NOISE_EXACT_SET.has(cell.toLowerCase());
      });

      if (filteredCells.length === 0) return;

      let gender: 'Female' | 'Male' = 'Female';
      let parentEmail = '';
      let parentPhone = '';
      const nameCandidates: string[] = [];

      filteredCells.forEach((cell) => {
        const cleanedCell = cleanLeadingListMarker(cell);
        if (!cleanedCell) return;

        const g = normalizeGender(cleanedCell);
        if (g) {
          gender = g;
          return;
        }
        if (isEmailToken(cleanedCell) && !parentEmail) {
          parentEmail = cleanedCell;
          return;
        }
        if (isPhoneToken(cleanedCell) && !parentPhone) {
          parentPhone = cleanedCell;
          return;
        }
        if (!isSerialOrRegToken(cleanedCell) && !isNoiseHeaderOrFooter(cleanedCell)) {
          nameCandidates.push(cleanedCell);
        }
      });

      const fullName = nameCandidates[0] || '';
      const parentName = nameCandidates[1] || '';

      if (fullName && /[a-zA-Z\u00C0-\u024F]/.test(fullName)) {
        const dedupeKey = fullName.toLowerCase();
        if (!seenNames.has(dedupeKey)) {
          seenNames.add(dedupeKey);
          rows.push({
            rowKey: `row-${Date.now()}-${index}`,
            fullName,
            gender,
            parentName,
            parentPhone,
            parentEmail,
          });
        }
      }
      return;
    }

    // Single-column line (e.g. numbered Word list, bullet list, or plain line per pupil)
    let lineName = cleanLeadingListMarker(trimmed);

    // Strip trailing inline gender marker like "Keza Aline (F)" or "Gasana Eric - M"
    let detectedGender: 'Female' | 'Male' = 'Female';
    const trailingGenderMatch = lineName.match(/(?:\s*[\(\[-]\s*|\s+)(Male|Female|M|F|Boy|Girl)\s*[\)\]]?\s*$/i);
    if (trailingGenderMatch) {
      const g = normalizeGender(trailingGenderMatch[1]);
      if (g) {
        detectedGender = g;
        lineName = lineName.slice(0, trailingGenderMatch.index).trim();
      }
    }

    if (!lineName || isNoiseHeaderOrFooter(lineName)) return;
    if (!/[a-zA-Z\u00C0-\u024F]{2,}/.test(lineName)) return;

    const dedupeKey = lineName.toLowerCase();
    if (!seenNames.has(dedupeKey)) {
      seenNames.add(dedupeKey);
      rows.push({
        rowKey: `row-${Date.now()}-${index}`,
        fullName: lineName,
        gender: detectedGender,
        parentName: '',
        parentPhone: '',
        parentEmail: '',
      });
    }
  });

  return rows;
};

const extractLinesFromDocx = async (file: File): Promise<string[]> => {
  const arrayBuffer = await file.arrayBuffer();
  const lines: string[] = [];

  try {
    const htmlResult = await mammoth.convertToHtml({ arrayBuffer });
    if (htmlResult?.value) {
      const doc = new DOMParser().parseFromString(htmlResult.value, 'text/html');

      // Extract tables row by row (preserving column boundaries with tabs)
      const tableRows = Array.from(doc.querySelectorAll('table tr'));
      tableRows.forEach((tr) => {
        const cellTexts = Array.from(tr.querySelectorAll('th, td'))
          .map((cell) => (cell.textContent || '').replace(/\s+/g, ' ').trim())
          .filter(Boolean);
        if (cellTexts.length > 0) {
          lines.push(cellTexts.join('\t'));
        }
      });

      // Extract non-table paragraphs and list items
      const blockEls = Array.from(doc.body.querySelectorAll('p, li, h1, h2, h3, h4'));
      blockEls.forEach((el) => {
        if (el.closest('table')) return;
        const txt = (el.textContent || '').replace(/\u00a0/g, ' ').trim();
        if (txt) {
          txt.split(/\r?\n/).forEach((sub) => {
            if (sub.trim()) lines.push(sub.trim());
          });
        }
      });
    }
  } catch (err) {
    console.warn('DOCX HTML parse fallback notice:', err);
  }

  if (lines.length === 0) {
    const rawResult = await mammoth.extractRawText({ arrayBuffer });
    if (rawResult?.value) {
      rawResult.value.split(/\r?\n/).forEach((line) => {
        if (line.trim()) lines.push(line.trim());
      });
    }
  }

  return lines;
};

const extractLinesFromPdf = async (file: File): Promise<string[]> => {
  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdf = await loadingTask.promise;
  const allLines: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    interface TextChunk {
      str: string;
      x: number;
      y: number;
      width: number;
    }

    const chunks: TextChunk[] = [];
    for (const item of content.items as any[]) {
      if (!item || typeof item.str !== 'string') continue;
      const text = item.str.replace(/\u00a0/g, ' ').trim();
      if (!text) continue;
      const x = Array.isArray(item.transform) ? Number(item.transform[4]) || 0 : 0;
      const y = Array.isArray(item.transform) ? Number(item.transform[5]) || 0 : 0;
      const width = typeof item.width === 'number' ? item.width : text.length * 4;
      chunks.push({ str: text, x, y, width });
    }

    // Group chunks into visual lines by vertical Y coordinate (PDF Y grows upwards)
    chunks.sort((a, b) => b.y - a.y || a.x - b.x);

    const visualLines: { y: number; items: TextChunk[] }[] = [];
    for (const chunk of chunks) {
      const existing = visualLines.find((line) => Math.abs(line.y - chunk.y) <= 4.5);
      if (existing) {
        existing.items.push(chunk);
      } else {
        visualLines.push({ y: chunk.y, items: [chunk] });
      }
    }

    visualLines.sort((a, b) => b.y - a.y);

    for (const vLine of visualLines) {
      vLine.items.sort((a, b) => a.x - b.x);
      let combined = '';
      for (let i = 0; i < vLine.items.length; i++) {
        const cur = vLine.items[i];
        if (i === 0) {
          combined = cur.str;
        } else {
          const prev = vLine.items[i - 1];
          const gap = cur.x - (prev.x + prev.width);
          combined += gap > 18 ? `\t${cur.str}` : ` ${cur.str}`;
        }
      }
      if (combined.trim()) {
        allLines.push(combined.trim());
      }
    }
  }

  return allLines;
};

export const BulkStudentImportModal: React.FC<BulkStudentImportModalProps> = ({
  isOpen,
  defaultGradeCode = 'P1',
  defaultAttendanceDate,
  enrolledBy = 'Director of Studies',
  onClose,
  onImported,
}) => {
  const todayDate = new Date().toISOString().split('T')[0];

  const [targetGradeCode, setTargetGradeCode] = useState<string>(defaultGradeCode || 'P1');
  const [attendanceDate, setAttendanceDate] = useState<string>(defaultAttendanceDate || todayDate);
  const [markPresentInAttendance, setMarkPresentInAttendance] = useState<boolean>(true);
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [rows, setRows] = useState<ParsedStudentRow[]>([]);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pasteModeOpen, setPasteModeOpen] = useState<boolean>(false);
  const [pastedText, setPastedText] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      const validGrade = ACADEMIC_GRADES.some((g) => g.code === defaultGradeCode)
        ? defaultGradeCode
        : 'P1';
      setTargetGradeCode(validGrade);
      setAttendanceDate(defaultAttendanceDate || todayDate);
      setErrorMsg(null);
    }
  }, [isOpen, defaultGradeCode, defaultAttendanceDate, todayDate]);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setErrorMsg(null);
    setIsParsing(true);
    setSelectedFileName(file.name);

    try {
      const lowerName = file.name.toLowerCase();
      let lines: string[] = [];

      if (lowerName.endsWith('.docx')) {
        lines = await extractLinesFromDocx(file);
      } else if (lowerName.endsWith('.pdf')) {
        lines = await extractLinesFromPdf(file);
      } else if (lowerName.endsWith('.txt') || lowerName.endsWith('.csv')) {
        const text = await file.text();
        lines = text.split(/\r?\n/);
      } else if (lowerName.endsWith('.doc')) {
        setErrorMsg(
          'Legacy binary .doc format cannot be parsed directly in the browser. Please save as Word (.docx) or PDF (.pdf), or paste the names directly below.'
        );
        setIsParsing(false);
        return;
      } else {
        setErrorMsg('Unsupported file format. Please upload a Word (.docx), PDF (.pdf), TXT, or CSV file.');
        setIsParsing(false);
        return;
      }

      const parsed = parseLinesToStudentRows(lines);
      if (parsed.length === 0) {
        setErrorMsg(
          `No student names could be extracted from "${file.name}". If the PDF is a scanned photo, paste the names directly or add rows manually.`
        );
      } else {
        setRows(parsed);
      }
    } catch (err: any) {
      console.error('Document parsing error:', err);
      setErrorMsg(`Failed to read "${file.name}": ${err?.message || 'Unknown error'}`);
    } finally {
      setIsParsing(false);
    }
  };

  const handleParsePastedText = () => {
    setErrorMsg(null);
    const lines = pastedText.split(/\r?\n/);
    const parsed = parseLinesToStudentRows(lines);
    if (parsed.length === 0) {
      setErrorMsg('Please paste at least one valid student name per line.');
      return;
    }
    setSelectedFileName('Pasted Class List');
    setRows((prev) => {
      const existing = new Set(prev.map((r) => r.fullName.trim().toLowerCase()));
      const additions = parsed.filter((r) => !existing.has(r.fullName.trim().toLowerCase()));
      return [...prev, ...additions];
    });
    setPastedText('');
    setPasteModeOpen(false);
  };

  const handleRowChange = (index: number, field: keyof ParsedStudentRow, value: string) => {
    setRows((prev) =>
      prev.map((r, idx) => (idx === index ? { ...r, [field]: value } : r))
    );
  };

  const handleAddEmptyRow = () => {
    setRows((prev) => [
      ...prev,
      {
        rowKey: `manual-${Date.now()}-${prev.length}`,
        fullName: '',
        gender: 'Female',
        parentName: '',
        parentPhone: '',
        parentEmail: '',
      },
    ]);
  };

  const handleRemoveRow = (index: number) => {
    setRows((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSaveAll = () => {
    setErrorMsg(null);
    const validRows = rows.filter((r) => r.fullName.trim().length > 0);
    if (validRows.length === 0) {
      setErrorMsg('Please upload a file or add at least one learner with a full name before saving.');
      return;
    }

    setIsSaving(true);
    try {
      const existingStudents = getEnrolledStudents();
      const usedRegNumbers = new Set(existingStudents.map((s) => s.regNumber.toUpperCase()));
      const usedUsernames = new Set(existingStudents.map((s) => s.studentUsername.toLowerCase()));

      let nextCounter = existingStudents.length + 1;
      const studentsToEnroll: Array<Omit<EnrolledStudent, 'id' | 'enrolledAt'>> = validRows.map((row) => {
        const cleanFullName = row.fullName.trim();
        let regCandidate = `MHA-2026-${String(nextCounter).padStart(3, '0')}`;
        while (usedRegNumbers.has(regCandidate)) {
          nextCounter++;
          regCandidate = `MHA-2026-${String(nextCounter).padStart(3, '0')}`;
        }
        usedRegNumbers.add(regCandidate);
        nextCounter++;

        const slug = cleanFullName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '.')
          .replace(/^\.+|\.+$/g, '')
          .slice(0, 24) || 'learner';
        let usernameCandidate = `stu.${slug}`;
        let suffix = 2;
        while (usedUsernames.has(usernameCandidate)) {
          usernameCandidate = `stu.${slug}${suffix}`;
          suffix++;
        }
        usedUsernames.add(usernameCandidate);

        return {
          regNumber: regCandidate,
          fullName: cleanFullName,
          gender: row.gender || 'Female',
          dob: '2018-01-01',
          gradeCode: targetGradeCode,
          parentName: row.parentName.trim() || 'Parent / Guardian',
          parentPhone: row.parentPhone.trim() || '+250 788 000 000',
          parentEmail: row.parentEmail.trim(),
          studentUsername: usernameCandidate,
          studentPassword: 'student@2026',
          enrolledBy,
          status: 'Active',
          feedbackNotes: selectedFileName ? `Imported via ${selectedFileName}` : 'Batch class import',
        };
      });

      const createdStudents = enrollStudentsBatchByDOS(studentsToEnroll);

      if (markPresentInAttendance && createdStudents.length > 0) {
        const attendanceRecords: AttendanceRecord[] = createdStudents.map((st) => ({
          id: `att-${st.id}-${attendanceDate}`,
          date: attendanceDate,
          gradeCode: targetGradeCode,
          studentId: st.id,
          studentName: st.fullName,
          parentEmail: st.parentEmail || '',
          parentPhone: st.parentPhone || '',
          status: 'Present',
          markedBy: enrolledBy,
          notes: 'Imported from class document list',
          emailNotified: false,
        }));
        saveAttendanceBatch(attendanceRecords);
      }

      onImported(createdStudents, targetGradeCode, attendanceDate, markPresentInAttendance);
      setRows([]);
      setSelectedFileName('');
      onClose();
    } catch (err: any) {
      setErrorMsg(`Could not save learners: ${err?.message || 'Unexpected error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const selectedGradeObj = ACADEMIC_GRADES.find((g) => g.code === targetGradeCode);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/75 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[94vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:px-6 sm:py-4 border-b border-slate-200 flex items-start justify-between gap-3 shrink-0 bg-slate-50/60">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-900 text-white flex items-center justify-center shrink-0">
              <FileUp className="w-5 h-5 text-amber-400" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                Import Student List from Word (.docx) or PDF (.pdf)
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Choose the destination class, preview and edit the extracted learners, then save directly to your enrollment roster and attendance tracker.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close import modal"
            className="min-h-[44px] min-w-[44px] -mr-2 -mt-1 inline-flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 rounded-lg transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5 text-xs">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-medium flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span className="flex-1">{errorMsg}</span>
              <button
                type="button"
                onClick={() => setErrorMsg(null)}
                className="text-rose-600 hover:text-rose-900 font-bold"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Step 1: Class Selection & File Upload Controls */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
            <div className="lg:col-span-5 p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
              <div>
                <label className="block font-bold text-slate-800 mb-1.5">
                  1. Select Target Class *
                </label>
                <select
                  value={targetGradeCode}
                  onChange={(e) => setTargetGradeCode(e.target.value)}
                  className="w-full min-h-[44px] bg-white border border-slate-300 rounded-lg px-3 py-2 font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-800"
                >
                  {ACADEMIC_GRADES.map((grade) => (
                    <option key={grade.code} value={grade.code}>
                      {grade.code} — {grade.name} ({grade.level})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 border-t border-slate-200 space-y-2.5">
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={markPresentInAttendance}
                    onChange={(e) => setMarkPresentInAttendance(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded border-slate-300 text-blue-900 focus:ring-blue-800"
                  />
                  <span className="text-slate-700 leading-relaxed">
                    Mark imported pupils <strong>Present</strong> on the Attendance Tracker immediately
                  </span>
                </label>

                {markPresentInAttendance && (
                  <div className="flex items-center gap-2 pl-6">
                    <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <input
                      type="date"
                      value={attendanceDate}
                      onChange={(e) => setAttendanceDate(e.target.value)}
                      className="min-h-[38px] bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-mono text-slate-800"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-7 p-4 rounded-xl border border-dashed border-blue-300 bg-blue-50/40 flex flex-col justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-blue-800 shrink-0" />
                    <span>2. Upload Word (.docx) or PDF (.pdf) Document</span>
                  </span>
                  {selectedFileName && (
                    <span className="text-[11px] font-medium text-emerald-700 truncate max-w-[220px]">
                      Loaded: {selectedFileName}
                    </span>
                  )}
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Supports numbered lists, plain line-by-line class rolls, or multi-column tables (Name, Gender, Parent, Phone, Email).
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <label className="min-h-[44px] px-4 py-2 bg-blue-900 hover:bg-blue-950 text-white font-semibold rounded-lg inline-flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap shrink-0">
                  {isParsing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                      <span>Extracting Names...</span>
                    </>
                  ) : (
                    <>
                      <FileUp className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>{rows.length > 0 ? 'Upload Another File (.docx / .pdf)' : 'Choose Word (.docx) or PDF (.pdf)'}</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept=".docx,.pdf,.txt,.csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf"
                    onChange={handleFileChange}
                    disabled={isParsing}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => setPasteModeOpen(!pasteModeOpen)}
                  className="min-h-[44px] px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 font-semibold border border-slate-300 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  {pasteModeOpen ? 'Hide Text Paste' : 'Paste List Instead'}
                </button>

                <button
                  type="button"
                  onClick={handleAddEmptyRow}
                  className="min-h-[44px] px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 font-semibold border border-slate-300 rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                >
                  <Plus className="w-4 h-4 text-blue-800 shrink-0" />
                  <span>Add Blank Row</span>
                </button>
              </div>
            </div>
          </div>

          {/* Optional Paste Text Area */}
          {pasteModeOpen && (
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2.5">
              <label className="block font-bold text-slate-800">
                Paste Student Names (One learner per line, optionally comma or tab separated with Gender / Parent Phone)
              </label>
              <textarea
                rows={4}
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder={'1. Keza Aline Manzi\n2. Ntwari Kevin, Male, +250 788 222 333\n3. Uwase Ange'}
                className="w-full bg-white border border-slate-300 rounded-lg p-3 text-xs font-mono focus:outline-hidden focus:ring-2 focus:ring-blue-800"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPasteModeOpen(false)}
                  className="min-h-[40px] px-3.5 py-1.5 text-slate-600 font-semibold hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleParsePastedText}
                  className="min-h-[40px] px-4 py-1.5 bg-blue-900 hover:bg-blue-950 text-white font-semibold rounded-lg"
                >
                  Extract Names to Table
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Preview & Edit Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-slate-900">
                <Users className="w-4 h-4 text-blue-800 shrink-0" />
                <span className="font-bold">3. Preview &amp; Edit Extracted Learners</span>
                <span className="text-slate-500 font-mono tabular-nums">
                  · {rows.length} {rows.length === 1 ? 'learner' : 'learners'} · Class {targetGradeCode}
                </span>
              </div>

              {(rows.length > 0 || selectedFileName) && (
                <button
                  type="button"
                  onClick={() => {
                    setRows([]);
                    setSelectedFileName('');
                    setErrorMsg(null);
                  }}
                  className="px-2.5 py-1.5 text-rose-700 hover:bg-rose-50 rounded-lg font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{selectedFileName ? 'Remove File & Clear List' : 'Clear Table'}</span>
                </button>
              )}
            </div>

            {rows.length === 0 ? (
              <div className="p-8 sm:p-12 text-center space-y-2.5 text-slate-500">
                <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <ClipboardCheck className="w-6 h-6" />
                </div>
                <p className="font-semibold text-slate-800 text-sm">
                  No learners loaded in the preview table yet
                </p>
                <p className="text-xs max-w-md mx-auto">
                  Upload a <strong>.docx</strong> Word file or <strong>.pdf</strong> roster above to inspect, edit names, and enroll the full class at once.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[340px]">
                <table className="w-full text-left border-collapse min-w-[740px]">
                  <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                    <tr>
                      <th className="py-2.5 px-3 w-12 tabular-nums">#</th>
                      <th className="py-2.5 px-3 min-w-[210px]">Student Full Name *</th>
                      <th className="py-2.5 px-3 w-28">Gender</th>
                      <th className="py-2.5 px-3 min-w-[150px]">Parent / Guardian</th>
                      <th className="py-2.5 px-3 min-w-[130px]">Parent Phone</th>
                      <th className="py-2.5 px-3 min-w-[160px]">Parent Email</th>
                      <th className="py-2.5 px-3 w-16 text-right">Remove</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((row, idx) => (
                      <tr key={row.rowKey} className="hover:bg-slate-50/70">
                        <td className="py-2 px-3 font-mono font-bold text-slate-400 tabular-nums">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="text"
                            value={row.fullName}
                            onChange={(e) => handleRowChange(idx, 'fullName', e.target.value)}
                            placeholder="Learner full name"
                            className="w-full min-h-[38px] bg-white border border-slate-200 focus:border-blue-800 rounded-lg px-2.5 py-1.5 font-semibold text-slate-900 focus:outline-hidden"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <select
                            value={row.gender}
                            onChange={(e) => handleRowChange(idx, 'gender', e.target.value)}
                            className="w-full min-h-[38px] bg-white border border-slate-200 focus:border-blue-800 rounded-lg px-2 py-1.5 font-medium text-slate-800 focus:outline-hidden"
                          >
                            <option value="Female">Female</option>
                            <option value="Male">Male</option>
                          </select>
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="text"
                            value={row.parentName}
                            onChange={(e) => handleRowChange(idx, 'parentName', e.target.value)}
                            placeholder="Optional"
                            className="w-full min-h-[38px] bg-white border border-slate-200 focus:border-blue-800 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-hidden"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="tel"
                            value={row.parentPhone}
                            onChange={(e) => handleRowChange(idx, 'parentPhone', e.target.value)}
                            placeholder="+250 78..."
                            className="w-full min-h-[38px] bg-white border border-slate-200 focus:border-blue-800 rounded-lg px-2.5 py-1.5 font-mono text-slate-800 focus:outline-hidden"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="email"
                            value={row.parentEmail}
                            onChange={(e) => handleRowChange(idx, 'parentEmail', e.target.value)}
                            placeholder="Optional"
                            className="w-full min-h-[38px] bg-white border border-slate-200 focus:border-blue-800 rounded-lg px-2.5 py-1.5 font-mono text-slate-800 focus:outline-hidden"
                          />
                        </td>
                        <td className="py-2 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(idx)}
                            title="Remove row"
                            className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:px-6 sm:py-4 border-t border-slate-200 bg-slate-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 text-xs">
          <div className="text-slate-600">
            Destination:{' '}
            <strong className="text-slate-900">
              {selectedGradeObj ? `${selectedGradeObj.name} (${selectedGradeObj.code})` : targetGradeCode}
            </strong>{' '}
            <span aria-hidden="true">·</span>{' '}
            <span className="tabular-nums font-medium">
              {rows.filter((r) => r.fullName.trim()).length} ready to enroll
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 font-semibold text-slate-700 hover:bg-slate-200/70 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSaving || rows.filter((r) => r.fullName.trim()).length === 0}
              onClick={handleSaveAll}
              className="min-h-[44px] px-5 py-2.5 bg-blue-900 hover:bg-blue-950 disabled:bg-slate-300 disabled:text-slate-500 text-white font-bold rounded-lg shadow-xs transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                {isSaving
                  ? 'Saving Learners...'
                  : 'Save All to Student List & Attendance Tracker'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
