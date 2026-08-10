import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('classes')
    .select('id, name, subject, created_at')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ classes: data });
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { name, subject, studentEmails } = body as {
    name: string;
    subject?: string;
    studentEmails?: string[];
  };

  const { data: profile } = await supabase
    .from('profiles')
    .select('institution_id')
    .eq('id', user.id)
    .single();

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 400 });

  const { data: newClass, error } = await supabase
    .from('classes')
    .insert({
      name,
      subject,
      teacher_id: user.id,
      institution_id: profile.institution_id,
    })
    .select('id')
    .single();

  if (error || !newClass) {
    return NextResponse.json({ error: error?.message ?? 'Failed to create class' }, { status: 400 });
  }

  // Enroll any students whose emails already have a profile in this institution.
  if (studentEmails && studentEmails.length > 0) {
    const { data: students } = await supabase
      .from('profiles')
      .select('id, email')
      .in('email', studentEmails)
      .eq('institution_id', profile.institution_id);

    if (students && students.length > 0) {
      await supabase.from('class_enrollments').insert(
        students.map((s) => ({ class_id: newClass.id, student_id: s.id }))
      );
    }
  }

  return NextResponse.json({ classId: newClass.id });
}
