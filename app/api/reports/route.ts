import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getClassAttendanceSummary } from '@/lib/attendance-stats';
import { buildAttendancePdf } from '@/lib/export/pdf';
import { buildAttendanceXlsx } from '@/lib/export/excel';

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: reports, error } = await supabase
    .from('reports')
    .select('id, class_id, range_start, range_end, file_path, file_type, created_at, classes(name)')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const withUrls = await Promise.all(
    (reports ?? []).map(async (r: any) => {
      const { data: signed } = await supabase.storage
        .from('reports')
        .createSignedUrl(r.file_path, 60 * 60); // 1 hour
      return { ...r, className: r.classes?.name ?? 'Unknown class', signedUrl: signed?.signedUrl ?? null };
    })
  );

  return NextResponse.json({ reports: withUrls });
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { classId, rangeStart, rangeEnd, fileType } = (await request.json()) as {
    classId: string;
    rangeStart: string;
    rangeEnd: string;
    fileType: 'pdf' | 'xlsx';
  };

  const { data: klass } = await supabase.from('classes').select('name, institution_id').eq('id', classId).single();
  if (!klass) return NextResponse.json({ error: 'Class not found' }, { status: 404 });

  const { students } = await getClassAttendanceSummary(
    supabase,
    classId,
    new Date(rangeStart),
    new Date(rangeEnd)
  );

  const blob =
    fileType === 'pdf'
      ? buildAttendancePdf({ className: klass.name, rangeStart, rangeEnd, students })
      : buildAttendanceXlsx({ className: klass.name, rangeStart, rangeEnd, students });

  const arrayBuffer = await blob.arrayBuffer();
  const filePath = `${klass.institution_id}/${classId}/${Date.now()}.${fileType}`;

  const { error: uploadError } = await supabase.storage
    .from('reports')
    .upload(filePath, Buffer.from(arrayBuffer), {
      contentType:
        fileType === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 400 });
  }

  const { data: reportRow, error: insertError } = await supabase
    .from('reports')
    .insert({
      institution_id: klass.institution_id,
      class_id: classId,
      generated_by: user.id,
      range_start: rangeStart,
      range_end: rangeEnd,
      file_path: filePath,
      file_type: fileType,
    })
    .select('id')
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 });

  const { data: signed } = await supabase.storage.from('reports').createSignedUrl(filePath, 60 * 60);

  return NextResponse.json({ reportId: reportRow.id, signedUrl: signed?.signedUrl });
}
