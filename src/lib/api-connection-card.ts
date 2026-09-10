import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * http(s) only. A CTA URL is opened in the visitor's browser, so `javascript:`
 * and `data:` must never survive validation. Deliberately a regex rather than
 * `z.string().url()` so `{field}` placeholders stay legal.
 */
const ctaUrlSchema = z
  .string()
  .max(2000)
  .refine((v) => /^https?:\/\//i.test(v), 'Must start with http:// or https://')

/** Card-display fields shared by the create and update schemas. */
export const cardDisplayFields = {
  card_instructions: z.string().max(2000).optional(),
  cta_type: z.enum(['none', 'form', 'link']).optional(),
  cta_label: z.string().max(60).optional(),
  cta_form_id: z.string().uuid().nullable().optional(),
  cta_url: ctaUrlSchema.nullable().optional(),
}

export interface CtaShape {
  cta_type?: 'none' | 'form' | 'link'
  cta_form_id?: string | null
  cta_url?: string | null
}

/** Mirror of the DB CHECK constraint, so the user gets a readable message first. */
export function ctaTargetIssue(v: CtaShape): string | null {
  if (v.cta_type === 'form' && !v.cta_form_id) return 'Choose a form for the CTA button'
  if (v.cta_type === 'link' && !v.cta_url) return 'Enter a link for the CTA button'
  return null
}

/**
 * A CTA form must belong to the same chatbot. Without this a user could point
 * one chatbot's card at another tenant's enquiry form.
 */
export async function ctaFormBelongsToChatbot(
  supabase: SupabaseClient,
  chatbotId: string,
  formId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('enquiry_forms')
    .select('id')
    .eq('id', formId)
    .eq('chatbot_id', chatbotId)
    .maybeSingle()
  return Boolean(data)
}

/** Normalise so a CTA switched back to "none" cannot leave a stale target behind. */
export function normaliseCta<T extends CtaShape>(v: T): T {
  if (v.cta_type === 'none') return { ...v, cta_form_id: null, cta_url: null }
  if (v.cta_type === 'form') return { ...v, cta_url: null }
  if (v.cta_type === 'link') return { ...v, cta_form_id: null }
  return v
}
