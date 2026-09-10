import { createClient } from '@/lib/supabase/server'
import type { Enquiry } from '@/types'

type ServerClient = Awaited<ReturnType<typeof createClient>>

/**
 * Fetch an enquiry only if it belongs to a chatbot owned by `userId`.
 * Returns the full row (so callers can diff funnel fields) or null when the
 * enquiry is missing or not owned by the user. RLS also enforces this at the
 * database layer; the explicit check yields clean 403/404 responses.
 */
export async function getOwnedEnquiry(
  supabase: ServerClient,
  enquiryId: string,
  userId: string,
): Promise<Enquiry | null> {
  const { data: enquiry } = await supabase
    .from('enquiries')
    .select('*')
    .eq('id', enquiryId)
    .single()

  if (!enquiry) return null

  const { data: chatbot } = await supabase
    .from('chatbots')
    .select('user_id')
    .eq('id', enquiry.chatbot_id)
    .single()

  if (!chatbot || chatbot.user_id !== userId) return null

  return enquiry as Enquiry
}
