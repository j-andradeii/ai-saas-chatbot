import { generateObject } from 'ai'
import { z } from 'zod'
import { getModelForChatbot } from '@/lib/ai/provider'
import { supabaseAdmin } from '@/lib/supabase/admin'

/**
 * How many transcript messages to feed the scorer. Buying intent shows up in
 * the last stretch of a conversation, and an unbounded transcript would let one
 * long chat cost far more than the enquiry is worth.
 */
const MAX_TRANSCRIPT_MESSAGES = 40
const MAX_MESSAGE_CHARS = 600

const leadScoreSchema = z.object({
  score: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe(
      'Probability this enquiry becomes a paid booking, 0-100. 0-24 just browsing, ' +
        '25-49 curious but uncommitted, 50-74 actively planning, 75-100 ready to book now.'
    ),
  rationale: z
    .string()
    .max(400)
    .describe('One or two sentences an operator can read before calling this lead.'),
  signals: z
    .array(z.string().max(80))
    .max(5)
    .describe('Short evidence phrases quoted or paraphrased from the conversation.'),
})

export type LeadScore = z.infer<typeof leadScoreSchema>

const SYSTEM_PROMPT = `You score sales leads for a business that answers customer questions through a website chatbot.

Given a chat transcript and the enquiry form the visitor submitted, estimate how likely this person is to become a PAYING CUSTOMER, not merely how polite or chatty they were.

Weigh heavily:
- Specific dates, headcount, or quantities given unprompted
- Questions about price, availability, payment, or how to book
- Urgency ("this weekend", "we fly in on the 14th")
- Complete, plausible contact details
- Confirming details back, or asking what happens next

Weigh against:
- Vague browsing with no dates or numbers
- Price objections left unresolved
- One-line enquiries with no engagement
- Contact details that look fake or throwaway
- Questions answered but never followed up on

A short transcript is weak evidence, not bad evidence: when there is little to go on, score near the middle and say so in the rationale rather than inventing certainty. Base everything on what is actually in the transcript; never assume facts that were not stated.`

function buildPrompt(
  transcript: { role: string; content: string }[],
  formName: string,
  formData: Record<string, unknown>
): string {
  const conversation = transcript.length
    ? transcript
        .map((m) => `${m.role === 'user' ? 'Visitor' : 'Bot'}: ${m.content.slice(0, MAX_MESSAGE_CHARS)}`)
        .join('\n')
    : '(no chat transcript — the form was submitted without a conversation)'

  return [
    `Enquiry form submitted: ${formName}`,
    '',
    'Form data:',
    JSON.stringify(formData, null, 2),
    '',
    'Chat transcript:',
    conversation,
  ].join('\n')
}

/**
 * Score one enquiry and persist the result.
 *
 * Never throws: scoring is an enhancement to an enquiry that has already been
 * saved, so a model outage must not turn into a failed submission or a lost
 * lead. On failure the score columns stay NULL and the row reads as "not
 * scored", which the UI renders distinctly from a genuine low score.
 */
export async function scoreEnquiry(enquiryId: string): Promise<LeadScore | null> {
  try {
    const { data: enquiry } = await supabaseAdmin
      .from('enquiries')
      .select('id, form_name, data, conversation_id, chatbot_id')
      .eq('id', enquiryId)
      .single()

    if (!enquiry) return null

    const { data: chatbot } = await supabaseAdmin
      .from('chatbots')
      .select('llm_provider, llm_model, api_key')
      .eq('id', enquiry.chatbot_id)
      .single()

    if (!chatbot) return null

    // Tool rows are internal plumbing, not something a visitor said.
    let transcript: { role: string; content: string }[] = []
    if (enquiry.conversation_id) {
      const { data: messages } = await supabaseAdmin
        .from('messages')
        .select('role, content')
        .eq('conversation_id', enquiry.conversation_id)
        .in('role', ['user', 'assistant'])
        .order('created_at', { ascending: true })
        .limit(MAX_TRANSCRIPT_MESSAGES)

      transcript = messages ?? []
    }

    const model = await getModelForChatbot(chatbot)

    const { object } = await generateObject({
      model,
      schema: leadScoreSchema,
      system: SYSTEM_PROMPT,
      prompt: buildPrompt(
        transcript,
        enquiry.form_name,
        (enquiry.data ?? {}) as Record<string, unknown>
      ),
      // The same conversation should not score 40 one day and 70 the next.
      temperature: 0,
    })

    await supabaseAdmin
      .from('enquiries')
      .update({
        lead_score: object.score,
        lead_score_rationale: object.rationale,
        lead_score_signals: object.signals,
        lead_scored_at: new Date().toISOString(),
        lead_score_model: chatbot.llm_model,
      })
      .eq('id', enquiryId)

    return object
  } catch (err) {
    console.error('scoreEnquiry failed', {
      enquiryId,
      error: err instanceof Error ? err.message : err,
    })
    return null
  }
}
