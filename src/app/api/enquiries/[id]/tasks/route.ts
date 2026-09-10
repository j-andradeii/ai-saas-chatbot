import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getOwnedEnquiry } from '@/lib/enquiry-access'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const enquiry = await getOwnedEnquiry(supabase, id, user.id)
  if (!enquiry) {
    return NextResponse.json({ error: 'Enquiry not found' }, { status: 404 })
  }

  const { data: tasks, error } = await supabase
    .from('enquiry_tasks')
    .select('*')
    .eq('enquiry_id', id)
    .order('is_done', { ascending: true })
    .order('due_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(tasks)
}

const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  due_at: z
    .string()
    .refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid date')
    .nullable()
    .optional(),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const enquiry = await getOwnedEnquiry(supabase, id, user.id)
  if (!enquiry) {
    return NextResponse.json({ error: 'Enquiry not found' }, { status: 404 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = createTaskSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }

  const { data: task, error } = await supabase
    .from('enquiry_tasks')
    .insert({
      enquiry_id: id,
      title: parsed.data.title,
      due_at: parsed.data.due_at ?? null,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await supabase.from('enquiry_activities').insert({
    enquiry_id: id,
    type: 'task_created',
    content: `Task added: ${parsed.data.title}`,
    metadata: { task_id: task.id },
    created_by: user.id,
  })

  return NextResponse.json(task, { status: 201 })
}
