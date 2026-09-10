import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOwnedEnquiry } from '@/lib/enquiry-access'
import { scoreEnquiry } from '@/lib/lead-score'
import { supabaseAdmin } from '@/lib/supabase/admin'

/**
 * Score (or re-score) one enquiry on demand.
 *
 * New enquiries are scored automatically on submit. This exists for the two
 * cases that misses: rows created before scoring existed, and re-running after
 * a model outage left the score NULL.
 *
 * Runs inline rather than in `after()` -- the operator clicked a button and is
 * waiting to see the number change.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const enquiry = await getOwnedEnquiry(supabase, id, user.id)
  if (!enquiry) {
    return NextResponse.json({ error: 'Enquiry not found' }, { status: 404 })
  }

  const score = await scoreEnquiry(id)
  if (!score) {
    return NextResponse.json(
      { error: 'Scoring failed. Check the chatbot\'s LLM provider is configured and enabled.' },
      { status: 502 }
    )
  }

  // Return the persisted row so the client does not have to guess what was
  // written (lead_scored_at and lead_score_model are set inside scoreEnquiry).
  const { data: updated } = await supabaseAdmin
    .from('enquiries')
    .select('*')
    .eq('id', id)
    .single()

  return NextResponse.json(updated)
}
