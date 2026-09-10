export interface Profile {
  id: string
  full_name: string | null
  email: string | null
  company_name: string | null
  role: 'admin' | 'user'
  plan: 'free' | 'pro' | 'enterprise'
  message_count: number
  message_limit: number
  billing_cycle: 'monthly' | 'yearly'
  billing_period_start: string | null
  stripe_customer_id: string | null // Future Iteration
  avatar_url: string | null
  is_active: boolean
  last_login_at: string | null
  created_at: string
}

export interface Payment {
  id: string
  user_id: string
  amount: number
  currency: string
  plan_requested: 'pro' | 'enterprise'
  billing_cycle: 'monthly' | 'yearly'
  proof_url: string
  proof_file_name: string | null
  reference_number: string | null
  status: 'pending' | 'approved' | 'rejected'
  admin_notes: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  period_start: string | null
  period_end: string | null
  created_at: string
}

export interface LLMProviderModel {
  id: string
  name: string
  input_cost_per_1m: number
  output_cost_per_1m: number
}

export interface LLMProvider {
  id: string
  name: string
  display_name: string
  models: LLMProviderModel[]
  platform_api_key: string | null
  is_enabled: boolean
  created_at: string
  updated_at: string
}

export interface QuickAction {
  label: string
  icon?: string
  prompt: string
}

export interface Chatbot {
  id: string
  user_id: string
  name: string
  domain: string
  personality_prompt: string
  welcome_message: string
  skills: string[]
  quick_actions: QuickAction[]
  llm_provider: string
  llm_model: string
  api_key: string
  primary_color: string
  widget_position: 'bottom-right' | 'bottom-left'
  active: boolean
  created_at: string
  updated_at: string
}

export interface ChatbotTool {
  id: string
  chatbot_id: string
  name: string
  description: string
  parameters: Record<string, string>
  webhook_url: string | null
  is_enabled: boolean
  created_at: string
}

export interface EnquiryFormField {
  name: string
  label: string
  type: 'string' | 'email' | 'phone' | 'number' | 'textarea' | 'select' | 'date'
  required?: boolean
  options?: string[]
}

export interface EnquiryForm {
  id: string
  chatbot_id: string
  name: string
  display_name: string
  description: string
  fields: EnquiryFormField[]
  webhook_url: string | null
  success_message: string
  is_enabled: boolean
  created_at: string
}

export type PipelineStage =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'proposal'
  | 'won'
  | 'lost'

export type EnquiryPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface Enquiry {
  id: string
  enquiry_form_id: string | null
  chatbot_id: string
  conversation_id: string | null
  form_name: string
  data: Record<string, unknown>
  visitor_id: string | null
  visitor_ip: string | null
  webhook_status: 'none' | 'pending' | 'sent' | 'failed'
  webhook_response_code: number | null
  is_read: boolean
  created_at: string
  // Funnel / pipeline fields (migration 007)
  pipeline_stage: PipelineStage
  priority: EnquiryPriority
  deal_value: number | null
  next_action_at: string | null
  stage_changed_at: string
  lost_reason: string | null
  tags: string[]
}

export type EnquiryActivityType =
  | 'note'
  | 'stage_change'
  | 'priority_change'
  | 'value_change'
  | 'next_action'
  | 'task_created'
  | 'task_completed'
  | 'read_status'
  | 'system'

export interface EnquiryActivity {
  id: string
  enquiry_id: string
  type: EnquiryActivityType
  content: string
  metadata: Record<string, unknown>
  created_by: string | null
  created_at: string
}

export interface EnquiryTask {
  id: string
  enquiry_id: string
  title: string
  due_at: string | null
  is_done: boolean
  completed_at: string | null
  created_by: string | null
  created_at: string
}

export interface ApiConnectionParameter {
  name: string
  type: 'string' | 'number' | 'boolean'
  description: string
  required: boolean
}

export interface ApiConnection {
  id: string
  chatbot_id: string
  name: string
  description: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  url: string
  headers: Record<string, string>
  request_body_template: Record<string, unknown> | null
  parameters: ApiConnectionParameter[]
  response_path: string | null
  timeout_ms: number
  is_enabled: boolean
  /** Guidance for the assistant on how to present this connection's results. */
  card_instructions: string
  cta_type: 'none' | 'form' | 'link'
  cta_label: string
  cta_form_id: string | null
  /** May contain {field} placeholders resolved per card, e.g. /tours/{slug} */
  cta_url: string | null
  created_at: string
}

export interface KnowledgeDocument {
  id: string
  chatbot_id: string
  file_name: string
  file_url: string
  file_size: number | null
  mime_type: string | null
  status: 'pending' | 'processing' | 'ready' | 'error'
  error_message: string | null
  created_at: string
}

export interface Conversation {
  id: string
  chatbot_id: string
  visitor_id: string
  visitor_name: string | null
  visitor_email: string | null
  status: 'active' | 'resolved' | 'archived'
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  conversation_id: string
  role: 'user' | 'assistant' | 'tool'
  content: string
  tool_name: string | null
  tool_data: Record<string, unknown> | null
  created_at: string
}
