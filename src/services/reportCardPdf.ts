import jsPDF from 'jspdf';
import { EnrolledStudent, AttendanceRecord, PaymentTransaction, getWebsiteSettings } from './adminStore';
import { ExamConfig, ExamMarkRecord, ClassFeeStructure } from './smsStore';
import { ACADEMIC_GRADES } from '../data/schoolData';

export const exportStudentReportCardPDF = (params: {
  student: EnrolledStudent;
  marks: ExamMarkRecord[];
  examConfig: ExamConfig;
  attendance: AttendanceRecord[];
  academicYear: string;
  term: string;
  classRank?: number;
  classTotal?: number;
  headTeacherRemark?: string;
}) => {
  const { student, marks, examConfig, attendance, academicYear, term, classRank, classTotal, headTeacherRemark } = params;
  const settings = getWebsiteSettings();
  const gradeName = ACADEMIC_GRADES.find((g) => g.code === student.gradeCode)?.name || student.gradeCode;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();

  // Header band (Royal Blue)
  doc.setFillColor(30, 58, 138);
  doc.rect(0, 0, pageW, 34, 'F');
  doc.setFillColor(245, 158, 11);
  doc.rect(0, 34, pageW, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text((settings.schoolName || 'MUGINA HOPE PRIMARY & NURSERY ACADEMY').toUpperCase(), 14, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(253, 224, 71);
  doc.text(`Motto: "${settings.motto || 'We learn for our better future'}"`, 14, 19);
  doc.setTextColor(226, 232, 240);
  doc.text(`${settings.fullAddress || 'Mugina Sector, Kamonyi District, Rwanda'}  |  Tel: ${settings.phone || '+250 788 258 786'}`, 14, 25);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(`OFFICIAL ACADEMIC REPORT CARD — ${term.toUpperCase()} (${academicYear})`, 14, 31);

  // Student Details Box
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, 41, pageW - 28, 28, 2, 2, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(`Learner Name: ${student.fullName}`, 18, 48);
  doc.text(`Reg. Number: ${student.regNumber}`, 120, 48);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Class & Stream: ${gradeName} (${student.stream || 'Stream A'})`, 18, 55);
  doc.text(`Gender: ${student.gender}  |  DOB: ${student.dob || 'N/A'}`, 120, 55);
  doc.text(`Parent / Guardian: ${student.parentName} (${student.parentPhone})`, 18, 62);
  if (classRank && classTotal) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(21, 128, 61);
    doc.text(`Class Position: ${classRank} / ${classTotal}`, 120, 62);
  }

  // Formula Strip
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Assessment Formula: CAT (${examConfig.catWeightPercent}% of ${examConfig.catMaxMarks}) + Exam (${examConfig.examWeightPercent}% of ${examConfig.examMaxMarks}) | Pass Mark: ${examConfig.passMarkPercent}%`,
    14,
    75
  );

  // Table Header
  let y = 79;
  doc.setFillColor(30, 58, 138);
  doc.rect(14, y, pageW - 28, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('Subject', 17, y + 5.5);
  doc.text(`CAT /${examConfig.catMaxMarks}`, 92, y + 5.5);
  doc.text(`Exam /${examConfig.examMaxMarks}`, 114, y + 5.5);
  doc.text('Total %', 138, y + 5.5);
  doc.text('Grade', 158, y + 5.5);
  doc.text('Remark', 173, y + 5.5);

  y += 8;
  const studentMarks = marks.filter(
    (m) => m.studentId === student.id && m.academicYear === academicYear && m.term === term
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);

  if (studentMarks.length === 0) {
    doc.setTextColor(100, 116, 139);
    doc.rect(14, y, pageW - 28, 12);
    doc.text('No subject marks recorded for this term yet.', 18, y + 7.5);
    y += 12;
  } else {
    studentMarks.forEach((m, idx) => {
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(14, y, pageW - 28, 8, 'F');
      }
      doc.setDrawColor(226, 232, 240);
      doc.rect(14, y, pageW - 28, 8);
      doc.setTextColor(15, 23, 42);
      doc.text(m.subjectName.slice(0, 36), 17, y + 5.5);
      doc.text(String(m.catScore), 96, y + 5.5);
      doc.text(String(m.examScore), 118, y + 5.5);
      doc.setFont('helvetica', 'bold');
      doc.text(`${m.totalPercent}%`, 139, y + 5.5);
      doc.text(m.gradeLetter, 160, y + 5.5);
      doc.setFont('helvetica', 'normal');
      doc.text(m.remark.slice(0, 14), 173, y + 5.5);
      y += 8;
    });
  }

  // Summary Metrics
  const avg =
    studentMarks.length > 0
      ? Math.round((studentMarks.reduce((acc, m) => acc + m.totalPercent, 0) / studentMarks.length) * 10) / 10
      : 0;
  const presentCount = attendance.filter((a) => a.studentId === student.id && a.status === 'Present').length;
  const lateCount = attendance.filter((a) => a.studentId === student.id && a.status === 'Late').length;
  const absentCount = attendance.filter((a) => a.studentId === student.id && a.status === 'Absent').length;
  const excusedCount = attendance.filter((a) => a.studentId === student.id && a.status === 'Excused').length;

  y += 6;
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(187, 247, 208);
  doc.roundedRect(14, y, pageW - 28, 20, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(21, 128, 61);
  doc.text(`Overall Term Average: ${avg}%`, 18, y + 7);
  doc.text(
    `Result Status: ${avg >= examConfig.passMarkPercent ? 'PROMOTED / SATISFACTORY' : 'REMEDIAL SUPPORT ADVISED'}`,
    110,
    y + 7
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text(
    `Attendance Summary — Present: ${presentCount}  |  Late: ${lateCount}  |  Excused: ${excusedCount}  |  Absent: ${absentCount}`,
    18,
    y + 15
  );

  // Remarks & Signatures
  y += 28;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('Head Teacher / Administration Remark:', 14, y);
  doc.setFont('helvetica', 'normal');
  doc.text(
    headTeacherRemark ||
      (avg >= 80
        ? 'Outstanding academic dedication and commendable discipline. Keep aiming high!'
        : avg >= examConfig.passMarkPercent
        ? 'Satisfactory competency progression. Encouraged to keep consistent daily revision.'
        : 'Requires targeted remedial coaching and close parent-teacher follow-up.'),
    14,
    y + 6,
    { maxWidth: pageW - 28 }
  );

  y += 24;
  doc.line(14, y, 78, y);
  doc.line(130, y, pageW - 14, y);
  doc.setFontSize(8);
  doc.text('Class Teacher Signature', 14, y + 5);
  doc.text('Head Teacher & Official School Stamp', 130, y + 5);

  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated by Mugina Hope Primary School SMS on ${new Date().toLocaleDateString()}`, 14, 285);

  doc.save(`ReportCard_${student.regNumber}_${term.replace(/\s+/g, '_')}_${academicYear}.pdf`);
};

export const exportStudentIdCardPDF = (student: EnrolledStudent) => {
  const settings = getWebsiteSettings();
  const gradeName = ACADEMIC_GRADES.find((g) => g.code === student.gradeCode)?.name || student.gradeCode;

  // CR80-proportioned wide card on A4 sheet for clean printing/cutting
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const startX = 20;
  const startY = 25;
  const cardW = 100;
  const cardH = 62;

  // Front Card
  doc.setDrawColor(30, 58, 138);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(startX, startY, cardW, cardH, 3, 3, 'FD');

  // Top Header
  doc.setFillColor(30, 58, 138);
  doc.rect(startX, startY, cardW, 15, 'F');
  doc.setFillColor(21, 128, 61);
  doc.rect(startX, startY + 15, cardW, 1.5, 'F');
  doc.setFillColor(245, 158, 11);
  doc.rect(startX, startY + 16.5, cardW, 1, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('MUGINA HOPE PRIMARY SCHOOL', startX + 4, startY + 6.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(253, 224, 71);
  doc.text(`STUDENT IDENTITY CARD  •  "We learn for our better future"`, startX + 4, startY + 11.5);

  // Photo box
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(241, 245, 249);
  doc.rect(startX + 4, startY + 21, 22, 26, 'FD');
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(6);
  doc.text('STUDENT', startX + 8.5, startY + 33);
  doc.text('PHOTO', startX + 9.5, startY + 37);

  // Details
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(student.fullName.toUpperCase(), startX + 30, startY + 26, { maxWidth: 66 });

  doc.setFontSize(7.5);
  doc.setTextColor(30, 58, 138);
  doc.text(`ID NO: ${student.regNumber}`, startX + 30, startY + 33);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text(`Class: ${gradeName} (${student.stream || 'Stream A'})`, startX + 30, startY + 38.5);
  doc.text(`Gender: ${student.gender}   DOB: ${student.dob || 'N/A'}`, startX + 30, startY + 43.5);
  doc.text(`Guardian: ${student.parentName}`, startX + 30, startY + 48.5, { maxWidth: 66 });
  doc.text(`Emergency Tel: ${student.parentPhone}`, startX + 30, startY + 53.5);

  doc.setFontSize(6);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Mugina Sector, Kamonyi • Valid Academic Year ${new Date().getFullYear()} • Tel: ${settings.phone || '+250 788 258 786'}`,
    startX + 4,
    startY + 59
  );

  // Back Card (Verification instructions)
  const backY = startY + cardH + 12;
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(startX, backY, cardW, cardH, 3, 3, 'FD');

  doc.setTextColor(30, 58, 138);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('OFFICIAL DISMISSAL & SECURITY CREDENTIAL', startX + 5, backY + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(51, 65, 85);
  doc.text(
    '1. This card remains the property of Mugina Hope Primary & Nursery Academy.\n' +
      '2. Authorized parent/guardian pickup requires presenting this ID credential.\n' +
      '3. If found, please return immediately to Mugina Hope Primary School (Adjacent to Mugina Police Station, Kamonyi District).\n' +
      `4. Portal Username: ${student.studentUsername || student.regNumber}`,
    startX + 5,
    backY + 18,
    { maxWidth: cardW - 10, lineHeightFactor: 1.45 }
  );

  doc.setFont('helvetica', 'bold');
  doc.text('Authorized By: Head Teacher / School Administration', startX + 5, backY + 54);

  doc.save(`Student_ID_Card_${student.regNumber}.pdf`);
};

export const exportFeeStatementPDF = (params: {
  student: EnrolledStudent;
  transactions: PaymentTransaction[];
  feeStructures: ClassFeeStructure[];
  term: string;
  academicYear: string;
}) => {
  const { student, transactions, feeStructures, term, academicYear } = params;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFillColor(21, 128, 61);
  doc.rect(0, 0, pageW, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('MUGINA HOPE PRIMARY & NURSERY ACADEMY', 14, 12);
  doc.setFontSize(10);
  doc.text(`OFFICIAL STUDENT FEE STATEMENT — ${term.toUpperCase()} (${academicYear})`, 14, 21);

  const feeStruct = feeStructures.find((f) => f.gradeCode === student.gradeCode) || feeStructures[0];
  const expected = feeStruct?.totalExpected || 92000;
  const studentTxs = transactions.filter(
    (tx) =>
      tx.studentId === student.id &&
      (tx.status === 'Completed' || tx.status === 'Refund Requested')
  );
  const totalPaid = studentTxs.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  const balance = Math.max(0, expected - totalPaid);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10);
  doc.text(`Student: ${student.fullName} (${student.regNumber})`, 14, 38);
  doc.setFont('helvetica', 'normal');
  doc.text(`Class: ${student.gradeCode}  |  Guardian: ${student.parentName} (${student.parentPhone})`, 14, 45);
  doc.setFont('helvetica', 'bold');
  doc.text(
    `Expected Fee: ${expected.toLocaleString()} RWF   |   Total Paid: ${totalPaid.toLocaleString()} RWF   |   Outstanding Balance: ${balance.toLocaleString()} RWF`,
    14,
    54
  );

  let y = 64;
  doc.setFillColor(30, 58, 138);
  doc.rect(14, y, pageW - 28, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8.5);
  doc.text('Receipt #', 16, y + 5.5);
  doc.text('Date', 58, y + 5.5);
  doc.text('Payment Type', 85, y + 5.5);
  doc.text('Method', 125, y + 5.5);
  doc.text('Amount (RWF)', 165, y + 5.5);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  studentTxs.forEach((tx) => {
    doc.rect(14, y, pageW - 28, 8);
    doc.text(tx.receiptNumber, 16, y + 5.5);
    doc.text(String(tx.recordedAt || '').split('T')[0], 58, y + 5.5);
    doc.text(tx.paymentType, 85, y + 5.5);
    doc.text(tx.paymentMethod, 125, y + 5.5);
    doc.text(Number(tx.amount).toLocaleString(), 165, y + 5.5);
    y += 8;
  });

  doc.save(`Fee_Statement_${student.regNumber}.pdf`);
};
