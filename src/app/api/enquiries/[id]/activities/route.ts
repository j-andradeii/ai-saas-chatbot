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

  const { data: activities, error } = await supabase
    .from('enquiry_activities')
    .select('*')
    .eq('enquiry_id', id)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(activities)
}

const createNoteSchema = z.object({
  content: z.string().min(1).max(5000),
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

  const parsed = createNoteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }

  const { data: activity, error } = await supabase
    .from('enquiry_activities')
    .insert({
      enquiry_id: id,
      type: 'note',
      content: parsed.data.content,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(activity, { status: 201 })
}
