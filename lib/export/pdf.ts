import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { StudentAttendanceSummary } from '@/lib/attendance-stats';

export function buildAttendancePdf(opts: {
  className: string;
  rangeStart: string;
  rangeEnd: string;
  students: StudentAttendanceSummary[];
}): Blob {
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text('Attendance Report', 14, 18);

  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(opts.className, 14, 26);
  doc.text(`${opts.rangeStart} — ${opts.rangeEnd}`, 14, 32);

  autoTable(doc, {
    startY: 40,
    head: [['Student', 'Email', 'Attendance %', 'Attended / Held', 'Late arrivals']],
    body: opts.students.map((s) => [
      s.fullName,
      s.email,
      `${s.attendancePercent}%`,
      `${s.meetingsAttended} / ${s.meetingsHeld}`,
      String(s.lateCount),
    ]),
    headStyles: { fillColor: [40, 84, 217] },
    styles: { fontSize: 10 },
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Generated on ${new Date().toLocaleString()}`,
      14,
      doc.internal.pageSize.getHeight() - 10
    );
  }

  return doc.output('blob');
}
