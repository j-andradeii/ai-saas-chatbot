import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const chatbotId = searchParams.get('chatbotId')

  // Get user's chatbot IDs
  const { data: chatbots } = await supabase
    .from('chatbots')
    .select('id')
    .eq('user_id', user.id)

  if (!chatbots || chatbots.length === 0) {
    return new Response('', {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="enquiries.csv"',
      },
    })
  }

  const chatbotIds = chatbots.map((c: { id: string }) => c.id)

  let query = supabase
    .from('enquiries')
    .select('*')
    .in('chatbot_id', chatbotIds)
    .order('created_at', { ascending: false })

  if (chatbotId) {
    query = query.eq('chatbot_id', chatbotId)
  }

  const { data: enquiries } = await query.limit(1000)

  if (!enquiries || enquiries.length === 0) {
    return new Response('No data', {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="enquiries.csv"',
      },
    })
  }

  // Collect all data keys across all enquiries
  const allKeys = new Set<string>()
  for (const e of enquiries) {
    if (e.data && typeof e.data === 'object') {
      for (const key of Object.keys(e.data as Record<string, unknown>)) {
        allKeys.add(key)
      }
    }
  }
  const dataKeys = Array.from(allKeys).sort()

  // Build CSV
  const headers = ['id', 'form_name', 'chatbot_id', 'created_at', 'is_read', 'lead_score', ...dataKeys]
  const rows = enquiries.map((e) => {
    const data = (e.data || {}) as Record<string, unknown>
    return headers.map((h) => {
      if (h === 'id') return e.id
      if (h === 'form_name') return e.form_name
      if (h === 'chatbot_id') return e.chatbot_id
      if (h === 'created_at') return e.created_at
      if (h === 'is_read') return String(e.is_read)
      const val = data[h]
      if (val === null || val === undefined) return ''
      const str = String(val)
      // Escape CSV value
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    })
  })

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="enquiries.csv"',
    },
  })
}
