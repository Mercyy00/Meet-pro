import * as XLSX from 'xlsx';
import type { StudentAttendanceSummary } from '@/lib/attendance-stats';

export function buildAttendanceXlsx(opts: {
  className: string;
  rangeStart: string;
  rangeEnd: string;
  students: StudentAttendanceSummary[];
}): Blob {
  const rows = opts.students.map((s) => ({
    Student: s.fullName,
    Email: s.email,
    'Attendance %': s.attendancePercent,
    'Meetings Attended': s.meetingsAttended,
    'Meetings Held': s.meetingsHeld,
    'Late Arrivals': s.lateCount,
    'Avg Duration (min)': Math.round(s.avgDurationSeconds / 60),
  }));

  const worksheet = XLSX.utils.aoa_to_sheet([
    [opts.className],
    [`${opts.rangeStart} — ${opts.rangeEnd}`],
    [],
  ]);

  XLSX.utils.sheet_add_json(worksheet, rows, { origin: 'A3' });

  worksheet['!cols'] = [
    { wch: 24 },
    { wch: 28 },
    { wch: 14 },
    { wch: 18 },
    { wch: 16 },
    { wch: 14 },
    { wch: 18 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance');

  const arrayBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([arrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
