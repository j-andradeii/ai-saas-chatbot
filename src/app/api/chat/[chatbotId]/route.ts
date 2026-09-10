import { NextResponse } from 'next/server'
import { streamText, stepCountIs } from 'ai'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { chatRatelimit } from '@/lib/ratelimit'
import { getModelForChatbot } from '@/lib/ai/provider'
import { getChatbotTools } from '@/lib/ai/tools'
import { searchSimilarChunks } from '@/lib/rag'
import { isBillingExpired, PLAN_LIMITS, type BillingCycle } from '@/lib/billing'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Expose-Headers': 'X-Conversation-Id',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  const { chatbotId } = await params

  try {
    // Rate limit by IP or visitor ID
    const ip = request.headers.get('x-forwarded-for') ?? 'anonymous'
    const { success: withinLimit } = await chatRatelimit.limit(ip)
    if (!withinLimit) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: corsHeaders }
      )
    }

    // Fetch chatbot
    const { data: chatbot, error: chatbotError } = await supabaseAdmin
      .from('chatbots')
      .select('*')
      .eq('id', chatbotId)
      .eq('active', true)
      .single()

    if (chatbotError || !chatbot) {
      return NextResponse.json(
        { error: 'Chatbot not found or inactive' },
        { status: 404, headers: corsHeaders }
      )
    }

    // Domain validation
    const origin = request.headers.get('origin') ?? ''
    if (chatbot.domain && origin) {
      const allowedDomain = chatbot.domain.replace(/^https?:\/\//, '').replace(/\/$/, '')
      const requestDomain = origin.replace(/^https?:\/\//, '').replace(/\/$/, '')
      if (allowedDomain && requestDomain && allowedDomain !== requestDomain) {
        return NextResponse.json(
          { error: 'Domain not allowed' },
          { status: 403, headers: corsHeaders }
        )
      }
    }

    // Usage check: fetch owner profile and verify message limit + active status
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('message_count, message_limit, is_active, plan, billing_period_start, billing_cycle')
      .eq('id', chatbot.user_id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Chatbot owner profile not found' },
        { status: 500, headers: corsHeaders }
      )
    }

    if (!profile.is_active) {
      return NextResponse.json(
        { error: 'Account suspended' },
        { status: 403, headers: corsHeaders }
      )
    }

    // Billing period expiry check: downgrade to free if expired
    if (
      profile.plan !== 'free' &&
      profile.billing_period_start &&
      isBillingExpired(profile.billing_period_start, profile.billing_cycle as BillingCycle)
    ) {
      await supabaseAdmin
        .from('profiles')
        .update({
          plan: 'free',
          message_limit: PLAN_LIMITS.free.messages,
          message_count: 0,
        })
        .eq('id', chatbot.user_id)

      return NextResponse.json(
        { error: 'Your billing period has expired. Please renew your plan.' },
        { status: 402, headers: corsHeaders }
      )
    }

    if (profile.message_count >= profile.message_limit) {
      return NextResponse.json(
        { error: 'Message limit reached. Please upgrade your plan.' },
        { status: 402, headers: corsHeaders }
      )
    }

    // Parse the request body
    const body = await request.json()
    const { messages, conversationId, visitorId } = body as {
      messages: Array<{ role: 'user' | 'assistant'; content: string }>
      conversationId?: string
      visitorId?: string
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400, headers: corsHeaders }
      )
    }

    // Get or create conversation
    let activeConversationId = conversationId

    if (!activeConversationId) {
      const { data: conversation, error: convError } = await supabaseAdmin
        .from('conversations')
        .insert({
          chatbot_id: chatbotId,
          visitor_id: visitorId || `anon-${Date.now()}`,
        })
        .select('id')
        .single()

      if (convError || !conversation) {
        return NextResponse.json(
          { error: 'Failed to create conversation' },
          { status: 500, headers: corsHeaders }
        )
      }

      activeConversationId = conversation.id
    }

    // Save the user's latest message
    const lastUserMessage = messages[messages.length - 1]
    if (lastUserMessage && lastUserMessage.role === 'user') {
      await supabaseAdmin.from('messages').insert({
        conversation_id: activeConversationId,
        role: 'user',
        content: lastUserMessage.content,
      })
    }

    // Get the AI model
    const model = await getModelForChatbot(chatbot)

    // Fetch tools for this chatbot
    const visitorIp = request.headers.get('x-forwarded-for') ?? undefined
    const { tools, enquiryFormNames, apiConnectionNames, apiCardData, apiCardInstructions } =
      await getChatbotTools(chatbotId, {
      conversationId: activeConversationId!,
      visitorId,
      visitorIp,
    })
    const hasTools = Object.keys(tools).length > 0

    // Build system prompt: personality + skills + RAG
    let systemPrompt = chatbot.personality_prompt || ''

    // Inject skills into system prompt
    if (chatbot.skills && chatbot.skills.length > 0) {
      const skillLabels: Record<string, string> = {
        answer_faqs: 'answering FAQs',
        book_appointment: 'booking appointments',
        product_recommendations: 'recommending products',
        technical_support: 'providing technical support',
        order_tracking: 'tracking orders',
        general_enquiry: 'handling general enquiries',
      }
      const skillList = chatbot.skills.map((s: string) => skillLabels[s] || s).join(', ')
      systemPrompt += `\n\nYou can help with: ${skillList}.`
    }
    if (lastUserMessage && lastUserMessage.role === 'user') {
      const ragChunks = await searchSimilarChunks(
        lastUserMessage.content,
        chatbotId,
        5,
        chatbot.llm_provider
      )
      if (ragChunks.length > 0) {
        const context = ragChunks.map(c => c.content).join('\n\n---\n\n')
        systemPrompt += `\n\n## Knowledge Base\nUse the following reference material to answer the user's question. Base your response on this information when relevant. If the answer is not in the reference material, you may use your general knowledge but let the user know.\n\n${context}`
      }
    }

    // Inject enquiry form tool instructions into system prompt
    if (enquiryFormNames.size > 0) {
      const formNames = Array.from(enquiryFormNames).join(', ')
      systemPrompt += `\n\n## Enquiry Forms — MANDATORY TOOL USE\nYou have these enquiry form tools: ${formNames}.\n\nRULES (you MUST follow ALL of these):\n1. When the user mentions: contact, enquiry, form, get in touch, submit details, reach out, message us, or anything about filling in information — you MUST call the ${formNames} tool.\n2. NEVER describe form fields in your text. NEVER write field names, labels, or placeholders as text.\n3. Your ONLY text response should be a single brief sentence like "Here's the form:" — then CALL THE TOOL.\n4. Pre-fill any fields you already know from the conversation (name, email, etc.).\n5. The form will render automatically from the tool call. You do NOT need to describe it.`
    }

    // Inject API connection tool instructions into system prompt
    if (apiConnectionNames.size > 0) {
      const apiNames = Array.from(apiConnectionNames).join(', ')
      systemPrompt += `\n\n## API Connections — Live Data\nYou have these data-fetching tools: ${apiNames}.\nWhen the user asks for live data (bookings, stats, account info, etc.), use the relevant tool.\n\nRULES:\n1. After calling an API tool, provide ONLY a brief 1-2 sentence intro.\n2. Do NOT list individual data items — they display as visual cards automatically.\n3. If many items, mention the count.\n4. If the API call fails, explain the error.`
    }

    // Per-connection presentation guidance set by the chatbot owner.
    if (apiCardInstructions.length > 0) {
      const guidance = apiCardInstructions
        .map((c) => `- ${c.connectionName}: ${c.instructions}`)
        .join('\n')
      systemPrompt += `\n\n## How to present each data source\nThe owner of this chatbot has specified how results should be presented. Follow these when writing your accompanying message and when deciding which details to call out:\n${guidance}`
    }

    // Ensure messages start with a user message (some LLM providers reject assistant-first conversations)
    const llmMessages = messages
      .map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))
    // Drop leading assistant messages (e.g. widget welcome message)
    while (llmMessages.length > 0 && llmMessages[0].role === 'assistant') {
      llmMessages.shift()
    }

    // Detect if user is likely asking for a form — force tool calling
    const lastMsg = llmMessages[llmMessages.length - 1]?.content?.toLowerCase() || ''
    const formKeywords = ['form', 'enquiry', 'contact', 'get in touch', 'submit', 'reach out', 'details', 'generate']
    const likelyWantsForm = enquiryFormNames.size > 0 && formKeywords.some(kw => lastMsg.includes(kw))

    // Stream the response
    const result = streamText({
      model,
      system: systemPrompt || undefined,
      messages: llmMessages,
      ...(hasTools ? {
        tools,
        stopWhen: stepCountIs(likelyWantsForm ? 1 : 3),
        ...(likelyWantsForm ? { toolChoice: 'required' as const } : {}),
      } : {}),
      async onFinish({ text, steps }) {
        // Save the assistant's response
        await supabaseAdmin.from('messages').insert({
          conversation_id: activeConversationId,
          role: 'assistant',
          content: text,
        })

        // Save tool call messages from steps
        if (steps) {
          for (const step of steps) {
            if (step.toolCalls) {
              for (const tc of step.toolCalls) {
                // AI SDK v6 uses 'input' property on typed tool calls
                const toolData = ('input' in tc ? tc.input : undefined) as Record<string, unknown> | undefined
                await supabaseAdmin.from('messages').insert({
                  conversation_id: activeConversationId,
                  role: 'tool',
                  content: JSON.stringify(toolData ?? {}),
                  tool_name: tc.toolName,
                  tool_data: toolData ?? {},
                })
              }
            }
          }
        }

        // Update conversation's updated_at
        await supabaseAdmin
          .from('conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', activeConversationId)

        // Increment message count on profile
        await supabaseAdmin
          .from('profiles')
          .update({ message_count: profile.message_count + 1 })
          .eq('id', chatbot.user_id)
      },
    })

    // Custom stream: pipe text deltas and capture AI-generated form definitions from tool results
    const encoder = new TextEncoder()
    const generatedForms: Record<string, unknown>[] = []
    const seenFormIds = new Set<string>()

    let sentText = false
    let streamError: unknown = null

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const part of result.fullStream) {
            if (part.type === 'text-delta') {
              sentText = true
              controller.enqueue(encoder.encode(part.text))
            } else if (part.type === 'error') {
              // streamText never throws -- provider failures (a retired model
              // id, a rejected API key, a safety block) arrive as a stream part.
              // Ignoring them closed the stream with zero bytes, so the request
              // returned 200 with an empty body and the widget rendered its
              // "could not generate a response" fallback, with nothing logged.
              streamError = part.error
              console.error('LLM stream error', {
                chatbotId,
                provider: chatbot.llm_provider,
                model: chatbot.llm_model,
                error: part.error instanceof Error ? part.error.message : part.error,
              })
            } else if (part.type === 'tool-result') {
              // AI SDK tool generated the form — capture the output (dedupe by form id)
              if (enquiryFormNames.has(part.toolName)) {
                const formOutput = part.output as Record<string, unknown>
                const formId = formOutput?.id as string
                if (formOutput && formOutput._form && !seenFormIds.has(formId)) {
                  seenFormIds.add(formId)
                  generatedForms.push(formOutput)
                }
              }
            }
          }

          // Append AI-generated form markers after the text stream
          for (const formDef of generatedForms) {
            const marker = `\n__FORM__${JSON.stringify(formDef)}__ENDFORM__`
            controller.enqueue(encoder.encode(marker))
          }

          // Append API data card markers (from tool execute store, not part.output)
          for (const cardDef of apiCardData) {
            const marker = `\n__APIDATA__${JSON.stringify(cardDef)}__ENDAPIDATA__`
            controller.enqueue(encoder.encode(marker))
          }

          if (streamError && !sentText) {
            controller.enqueue(
              encoder.encode(
                "Sorry, I'm having trouble reaching the AI model right now. Please try again in a moment."
              )
            )
          }

          controller.close()
        } catch (err) {
          controller.error(err)
        }
      },
    })

    const streamHeaders = new Headers({
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Conversation-Id': activeConversationId!,
      ...corsHeaders,
    })

    return new Response(stream, {
      status: 200,
      headers: streamHeaders,
    })
  } catch (error) {
    console.error('Chat API error:', error)
    const message =
      error instanceof Error ? error.message : 'Internal server error'
    // Surface provider config errors clearly
    const isConfigError =
      message.includes('No API key configured') ||
      message.includes('is currently disabled')
    return NextResponse.json(
      { error: isConfigError ? message : 'Internal server error' },
      { status: 500, headers: corsHeaders }
    )
  }
}
