import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getOwnedEnquiry } from '@/lib/enquiry-access'

const updateTaskSchema = z.object({
  is_done: z.boolean().optional(),
  title: z.string().min(1).max(200).optional(),
  due_at: z
    .string()
    .refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid date')
    .nullable()
    .optional(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> },
) {
  const { id, taskId } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const enquiry = await getOwnedEnquiry(supabase, id, user.id)
  if (!enquiry) {
    return NextResponse.json({ error: 'Enquiry not found' }, { status: 404 })
  }

  const { data: existingTask } = await supabase
    .from('enquiry_tasks')
    .select('*')
    .eq('id', taskId)
    .eq('enquiry_id', id)
    .single()

  if (!existingTask) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = updateTaskSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }
  const input = parsed.data

  const update: Record<string, unknown> = {}
  if (input.title !== undefined) update.title = input.title
  if (input.due_at !== undefined) update.due_at = input.due_at
  if (input.is_done !== undefined) {
    update.is_done = input.is_done
    update.completed_at = input.is_done ? new Date().toISOString() : null
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json(existingTask)
  }

  const { data: task, error } = await supabase
    .from('enquiry_tasks')
    .update(update)
    .eq('id', taskId)
    .eq('enquiry_id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Log only the false -> true completion transition.
  if (input.is_done === true && !existingTask.is_done) {
    await supabase.from('enquiry_activities').insert({
      enquiry_id: id,
      type: 'task_completed',
      content: `Task completed: ${task.title}`,
      metadata: { task_id: taskId },
      created_by: user.id,
    })
  }

  return NextResponse.json(task)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> },
) {
  const { id, taskId } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const enquiry = await getOwnedEnquiry(supabase, id, user.id)
  if (!enquiry) {
    return NextResponse.json({ error: 'Enquiry not found' }, { status: 404 })
  }

  const { error } = await supabase
    .from('enquiry_tasks')
    .delete()
    .eq('id', taskId)
    .eq('enquiry_id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
