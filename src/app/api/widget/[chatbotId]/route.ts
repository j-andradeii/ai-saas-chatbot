import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  const { chatbotId } = await params

  if (!chatbotId) {
    return new NextResponse('// Missing chatbot ID', {
      status: 400,
      headers: { 'Content-Type': 'application/javascript' },
    })
  }

  const { data: chatbot, error } = await supabaseAdmin
    .from('chatbots')
    .select('id, name, primary_color, widget_position, welcome_message, active, quick_actions')
    .eq('id', chatbotId)
    .single()

  if (error || !chatbot) {
    return new NextResponse('// Chatbot not found', {
      status: 404,
      headers: { 'Content-Type': 'application/javascript' },
    })
  }

  if (!chatbot.active) {
    return new NextResponse('// Chatbot is inactive', {
      status: 403,
      headers: { 'Content-Type': 'application/javascript' },
    })
  }

  const primaryColor = chatbot.primary_color || '#2563eb'
  const position = chatbot.widget_position || 'bottom-right'
  const welcomeMessage = (chatbot.welcome_message || 'Hi! How can I help you today?').replace(/'/g, "\\'").replace(/\n/g, '\\n')
  const chatbotName = (chatbot.name || 'Chat Assistant').replace(/'/g, "\\'")

  const quickActions = Array.isArray(chatbot.quick_actions) ? chatbot.quick_actions : []
  const quickActionsJson = JSON.stringify(quickActions)

  const posRight = position === 'bottom-right' ? '20px' : 'auto'
  const posLeft = position === 'bottom-left' ? '20px' : 'auto'

  const widgetJs = `(function() {
  'use strict';

  if (document.getElementById('aichatbot-widget-container')) return;

  var CHATBOT_ID = '${chatbotId}';
  var PRIMARY_COLOR = '${primaryColor}';
  var WELCOME_MESSAGE = '${welcomeMessage}';
  var CHATBOT_NAME = '${chatbotName}';
  var API_BASE = (document.currentScript && document.currentScript.src)
    ? new URL(document.currentScript.src).origin
    : window.location.origin;

  var isOpen = false;
  var messages = [{ role: 'assistant', content: WELCOME_MESSAGE }];
  var visitorId = 'visitor_' + Math.random().toString(36).substring(2, 15);
  var conversationId = null;
  var quickActions = ${quickActionsJson};

  // Color helpers
  function hexToRgb(hex) {
    var r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    return r + ',' + g + ',' + b;
  }
  var RGB = hexToRgb(PRIMARY_COLOR);

  // Styles
  var style = document.createElement('style');
  style.textContent = [
    '#aichatbot-widget-container { margin: 0; padding: 0; }',
    '#aichatbot-widget-container, #aichatbot-widget-container * { box-sizing: border-box; font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif; -webkit-font-smoothing: antialiased; }',

    /* Toggle FAB */
    '#aichatbot-toggle { position: fixed; bottom: 20px; right: ${posRight}; left: ${posLeft}; width: 60px; height: 60px; border-radius: 50%; background: ' + PRIMARY_COLOR + '; color: #fff; border: none; cursor: pointer; box-shadow: 0 4px 14px rgba(' + RGB + ',0.4), 0 2px 6px rgba(0,0,0,0.08); display: flex; align-items: center; justify-content: center; z-index: 999998; transition: transform 0.25s cubic-bezier(0.4,0,0.2,1), box-shadow 0.25s ease; }',
    '#aichatbot-toggle:hover { transform: scale(1.08); box-shadow: 0 6px 20px rgba(' + RGB + ',0.5), 0 4px 10px rgba(0,0,0,0.1); }',
    '#aichatbot-toggle:active { transform: scale(0.95); }',
    '#aichatbot-toggle svg { width: 26px; height: 26px; transition: transform 0.3s ease; }',
    '#aichatbot-toggle.open svg { transform: rotate(90deg) scale(0); }',

    /* Close icon (X) shown when open */
    '#aichatbot-toggle .aichatbot-close-icon { position: absolute; width: 26px; height: 26px; opacity: 0; transform: rotate(-90deg) scale(0); transition: all 0.3s ease; }',
    '#aichatbot-toggle.open .aichatbot-close-icon { opacity: 1; transform: rotate(0) scale(1); }',

    /* Chat window */
    '#aichatbot-window { position: fixed; bottom: 92px; right: ${posRight}; left: ${posLeft}; width: 400px; max-width: calc(100vw - 32px); height: 560px; max-height: calc(100vh - 120px); border-radius: 16px; background: #ffffff; box-shadow: 0 12px 40px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.06); display: flex; flex-direction: column; overflow: hidden; z-index: 999999; opacity: 0; transform: translateY(16px) scale(0.96); pointer-events: none; transition: opacity 0.25s cubic-bezier(0.4,0,0.2,1), transform 0.25s cubic-bezier(0.4,0,0.2,1); }',
    '#aichatbot-window.open { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }',

    /* Header */
    '#aichatbot-header { background: ' + PRIMARY_COLOR + '; color: #fff; padding: 18px 20px; font-size: 15px; font-weight: 600; display: flex; align-items: center; gap: 10px; min-height: 56px; letter-spacing: -0.01em; }',
    '#aichatbot-header-avatar { width: 32px; height: 32px; border-radius: 50%; background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }',
    '#aichatbot-header-avatar svg { width: 18px; height: 18px; }',
    '#aichatbot-header-info { flex: 1; display: flex; flex-direction: column; }',
    '#aichatbot-header-name { font-size: 15px; font-weight: 600; line-height: 1.2; }',
    '#aichatbot-header-status { font-size: 11px; font-weight: 400; opacity: 0.8; display: flex; align-items: center; gap: 4px; }',
    '#aichatbot-header-status::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: #4ade80; display: inline-block; }',

    /* Messages area */
    '#aichatbot-messages { flex: 1; overflow-y: auto; padding: 20px 20px; display: flex; flex-direction: column; gap: 8px; background: #f9fafb; scroll-behavior: smooth; }',
    '#aichatbot-messages::-webkit-scrollbar { width: 4px; }',
    '#aichatbot-messages::-webkit-scrollbar-track { background: transparent; }',
    '#aichatbot-messages::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 4px; }',
    '#aichatbot-messages::-webkit-scrollbar-thumb:hover { background: #9ca3af; }',

    /* Message row */
    '.aichatbot-row { display: flex; align-items: flex-start; gap: 8px; max-width: 100%; }',
    '.aichatbot-row.user { flex-direction: row-reverse; }',
    '.aichatbot-row.assistant { flex-direction: row; flex-wrap: wrap; }',
    '.aichatbot-row.assistant .aichatbot-form-container { margin-left: 38px; width: calc(100% - 38px); }',
    '.aichatbot-row.assistant .aichatbot-form-success { margin-left: 38px; width: calc(100% - 38px); }',

    /* Bot avatar in messages */
    '.aichatbot-avatar { width: 30px; height: 30px; border-radius: 50%; background: ' + PRIMARY_COLOR + '; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px; }',
    '.aichatbot-avatar svg { width: 15px; height: 15px; color: #fff; }',

    /* Message bubbles */
    '.aichatbot-msg { max-width: 80%; padding: 11px 16px; font-size: 14px; line-height: 1.55; overflow-wrap: break-word; word-break: break-word; white-space: pre-wrap; }',
    '.aichatbot-msg.user { background: ' + PRIMARY_COLOR + '; color: #fff; border-radius: 16px 16px 4px 16px; box-shadow: 0 2px 6px rgba(' + RGB + ',0.25); }',
    '.aichatbot-msg.assistant { background: #ffffff; color: #1f2937; border-radius: 16px 16px 16px 4px; border: 1px solid #e8eaed; box-shadow: 0 1px 4px rgba(0,0,0,0.06); }',

    /* Thinking dots */
    '.aichatbot-thinking-row { display: flex; align-items: flex-end; gap: 8px; }',
    '.aichatbot-thinking { background: #ffffff; border-radius: 16px 16px 16px 4px; padding: 12px 16px; display: flex; gap: 5px; align-items: center; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }',
    '.aichatbot-thinking span { width: 7px; height: 7px; border-radius: 50%; background: #9ca3af; animation: aichatbot-bounce 1.4s infinite ease-in-out both; }',
    '.aichatbot-thinking span:nth-child(1) { animation-delay: -0.32s; }',
    '.aichatbot-thinking span:nth-child(2) { animation-delay: -0.16s; }',
    '@keyframes aichatbot-bounce { 0%, 80%, 100% { transform: scale(0.4); opacity: 0.4; } 40% { transform: scale(1); opacity: 1; } }',

    /* Quick actions */
    '#aichatbot-quick-actions { display: flex; flex-wrap: wrap; gap: 8px; padding: 0 16px 12px; background: #f9fafb; }',
    '.aichatbot-quick-btn { background: #ffffff; border: 1px solid #e5e7eb; color: #374151; border-radius: 20px; padding: 8px 18px; font-size: 13px; cursor: pointer; transition: all 0.25s ease; font-weight: 500; line-height: 1.3; }',
    '.aichatbot-quick-btn:hover { background: ' + PRIMARY_COLOR + '; color: #fff; border-color: ' + PRIMARY_COLOR + '; box-shadow: 0 2px 8px rgba(' + RGB + ',0.25); }',

    /* Input area */
    '#aichatbot-input-area { display: flex; align-items: center; padding: 12px 12px 14px; border-top: 1px solid #f0f0f0; gap: 8px; background: #ffffff; }',
    '#aichatbot-input { flex: 1; border: 1.5px solid #e5e7eb; border-radius: 24px; padding: 10px 16px; font-size: 14px; line-height: 1.4; outline: none; background: #f9fafb; color: #111827; transition: border-color 0.2s ease, box-shadow 0.2s ease; resize: none; min-height: 42px; max-height: 100px; overflow-y: auto; }',
    '#aichatbot-input::placeholder { color: #9ca3af; }',
    '#aichatbot-input:focus { border-color: ' + PRIMARY_COLOR + '; box-shadow: 0 0 0 3px rgba(' + RGB + ',0.1); background: #ffffff; }',
    '#aichatbot-send { width: 40px; height: 40px; background: ' + PRIMARY_COLOR + '; color: #fff; border: none; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.2s ease; }',
    '#aichatbot-send:hover { box-shadow: 0 2px 8px rgba(' + RGB + ',0.35); transform: scale(1.05); }',
    '#aichatbot-send:active { transform: scale(0.95); }',
    '#aichatbot-send:disabled { opacity: 0.4; cursor: not-allowed; transform: none; box-shadow: none; }',
    '#aichatbot-send svg { width: 18px; height: 18px; }',

    /* Powered-by footer */
    '#aichatbot-footer { text-align: center; padding: 6px 12px 8px; font-size: 11px; color: #9ca3af; background: #ffffff; }',

    /* Enquiry forms — modern card */
    '.aichatbot-form-container { background: #ffffff; border-radius: 16px; padding: 0; margin: 10px 0 4px; max-width: 100%; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06); border: 1px solid #edf0f3; }',
    '.aichatbot-form-header { background: linear-gradient(135deg, ' + PRIMARY_COLOR + ' 0%, ' + PRIMARY_COLOR + 'cc 100%); padding: 16px 20px; display: flex; align-items: center; gap: 10px; }',
    '.aichatbot-form-header svg { width: 17px; height: 17px; color: #fff; flex-shrink: 0; opacity: 0.9; }',
    '.aichatbot-form-title { font-size: 14.5px; font-weight: 600; color: #ffffff; line-height: 1.3; letter-spacing: 0.01em; }',
    '.aichatbot-form-body { padding: 20px 20px 16px; }',
    '.aichatbot-form-group { margin-bottom: 16px; }',
    '.aichatbot-form-group:last-of-type { margin-bottom: 20px; }',
    '.aichatbot-form-label { display: flex; align-items: center; gap: 3px; font-size: 12.5px; font-weight: 600; color: #374151; margin-bottom: 7px; letter-spacing: 0.01em; }',
    '.aichatbot-required { color: #ef4444; font-size: 12px; margin-left: 1px; }',
    '.aichatbot-form-input, .aichatbot-form-textarea, .aichatbot-form-select { width: 100%; padding: 11px 14px; font-size: 14px; line-height: 1.5; border: 1.5px solid #dde1e6; border-radius: 10px; outline: none; background: #f8f9fb; color: #111827; transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease; font-family: inherit; -webkit-appearance: none; }',
    '.aichatbot-form-input::placeholder, .aichatbot-form-textarea::placeholder { color: #a0a7b3; }',
    '.aichatbot-form-input:focus, .aichatbot-form-textarea:focus, .aichatbot-form-select:focus { border-color: ' + PRIMARY_COLOR + '; box-shadow: 0 0 0 3px rgba(' + RGB + ',0.12); background: #fff; }',
    '.aichatbot-form-input.prefilled, .aichatbot-form-textarea.prefilled, .aichatbot-form-select.prefilled { background: rgba(' + RGB + ',0.04); border-color: rgba(' + RGB + ',0.35); }',
    '.aichatbot-form-textarea { min-height: 76px; resize: vertical; }',
    '.aichatbot-form-select { padding-right: 32px; cursor: pointer; }',
    '.aichatbot-form-error { font-size: 11px; color: #dc2626; margin-top: 4px; }',
    '.aichatbot-form-submit { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 13px 20px; font-size: 14.5px; font-weight: 600; color: #fff; background: linear-gradient(135deg, ' + PRIMARY_COLOR + ' 0%, ' + PRIMARY_COLOR + 'cc 100%); border: none; border-radius: 10px; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 2px 8px rgba(' + RGB + ',0.3); letter-spacing: 0.01em; }',
    '.aichatbot-form-submit:hover { box-shadow: 0 4px 16px rgba(' + RGB + ',0.45); transform: translateY(-1px); }',
    '.aichatbot-form-submit:active { transform: translateY(0); box-shadow: 0 2px 6px rgba(' + RGB + ',0.3); }',
    '.aichatbot-form-submit:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }',
    '.aichatbot-form-submit svg { width: 15px; height: 15px; }',
    '.aichatbot-form-success { padding: 14px 18px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 14px; color: #15803d; font-size: 13px; font-weight: 500; margin: 10px 0 4px; display: flex; align-items: center; gap: 8px; }',
    '.aichatbot-form-success svg { width: 18px; height: 18px; flex-shrink: 0; color: #22c55e; }',

    /* API data cards */
    '.aichatbot-row.assistant .aichatbot-apidata-container { margin-left: 38px; width: calc(100% - 38px); }',
    '.aichatbot-apidata-container { margin: 10px 0 4px; max-width: 100%; }',
    '.aichatbot-apidata-header { background: linear-gradient(135deg, ' + PRIMARY_COLOR + ' 0%, ' + PRIMARY_COLOR + 'cc 100%); padding: 14px 18px; border-radius: 14px 14px 0 0; display: flex; align-items: center; gap: 10px; }',
    '.aichatbot-apidata-header svg { width: 17px; height: 17px; color: #fff; flex-shrink: 0; opacity: 0.9; }',
    '.aichatbot-apidata-title { font-size: 14px; font-weight: 600; color: #ffffff; line-height: 1.3; flex: 1; }',
    '.aichatbot-apidata-count { font-size: 11px; font-weight: 600; color: ' + PRIMARY_COLOR + '; background: rgba(255,255,255,0.9); padding: 2px 9px; border-radius: 10px; }',
    '.aichatbot-apidata-grid { display: flex; gap: 10px; padding: 12px; overflow-x: auto; scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; background: #f4f5f7; border-radius: 0 0 14px 14px; border: 1px solid #edf0f3; border-top: none; }',
    '.aichatbot-apidata-grid::-webkit-scrollbar { height: 4px; }',
    '.aichatbot-apidata-grid::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 4px; }',
    '.aichatbot-apicard { min-width: 232px; max-width: 264px; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06); border: 1px solid #edf0f3; flex-shrink: 0; scroll-snap-align: start; display: flex; flex-direction: column; }',
    '.aichatbot-apicard-media { width: 100%; aspect-ratio: 16 / 9; background: #f1f3f5; overflow: hidden; flex-shrink: 0; }',
    '.aichatbot-apicard-img { width: 100%; height: 100%; object-fit: cover; display: block; }',
    '.aichatbot-apicard-body { padding: 11px 13px 12px; min-width: 0; }',
    '.aichatbot-apicard-title { font-size: 13.5px; font-weight: 600; color: #111827; margin-bottom: 7px; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }',
    '.aichatbot-apicard-fields { display: flex; flex-direction: column; gap: 4px; }',
    '.aichatbot-apicard-field { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; min-width: 0; }',
    '.aichatbot-apicard-field.stacked { flex-direction: column; align-items: stretch; gap: 1px; }',
    '.aichatbot-apicard-label { font-size: 9.5px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.04em; white-space: nowrap; flex-shrink: 0; }',
    '.aichatbot-apicard-value { font-size: 12.5px; color: #374151; line-height: 1.4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: right; min-width: 0; }',
    '.aichatbot-apicard-field.stacked .aichatbot-apicard-value { text-align: left; white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }',
    '.aichatbot-apicard-cta { display: block; width: 100%; margin-top: 10px; padding: 8px 10px; font-family: inherit; font-size: 12.5px; font-weight: 600; line-height: 1.3; color: #fff; background: ' + PRIMARY_COLOR + '; border: none; border-radius: 8px; cursor: pointer; text-align: center; transition: filter 0.15s ease, transform 0.1s ease; }',
    '.aichatbot-apicard-cta:hover { filter: brightness(1.08); }',
    '.aichatbot-apicard-cta:active { transform: translateY(1px); }',
    '.aichatbot-apicard-cta:focus-visible { outline: 2px solid ' + PRIMARY_COLOR + '; outline-offset: 2px; }',
    '.aichatbot-badge { display: inline-block; padding: 2px 8px; border-radius: 8px; font-size: 11px; font-weight: 600; line-height: 1.4; }',
    '.aichatbot-badge-green { background: #dcfce7; color: #166534; }',
    '.aichatbot-badge-yellow { background: #fef9c3; color: #854d0e; }',
    '.aichatbot-badge-red { background: #fee2e2; color: #991b1b; }',
    '.aichatbot-badge-blue { background: #dbeafe; color: #1e40af; }',
    '.aichatbot-badge-gray { background: #f3f4f6; color: #4b5563; }',
    '.aichatbot-apicard-detail { background: #ffffff; border-radius: 0 0 14px 14px; border: 1px solid #edf0f3; border-top: none; overflow: hidden; }',
    '.aichatbot-apicard-detail .aichatbot-apicard-body { padding: 14px 16px; }',
    '.aichatbot-apicard-detail .aichatbot-apicard-media { aspect-ratio: 2 / 1; }',
    '.aichatbot-apicard-detail .aichatbot-apicard-fields { gap: 7px; }',
    '.aichatbot-apicard-detail .aichatbot-apicard-title { font-size: 15px; margin-bottom: 9px; }',
    '.aichatbot-apidata-empty { padding: 20px; text-align: center; color: #9ca3af; font-size: 13px; background: #f4f5f7; border-radius: 0 0 14px 14px; border: 1px solid #edf0f3; border-top: none; }',
    '.aichatbot-apidata-more { min-width: 140px; max-width: 140px; background: #f9fafb; border-radius: 12px; padding: 14px 16px; border: 1px dashed #d1d5db; flex-shrink: 0; scroll-snap-align: start; display: flex; align-items: center; justify-content: center; font-size: 12px; color: #6b7280; text-align: center; }',

    /* Mobile responsive */
    '@media (max-width: 480px) {',
    '  #aichatbot-window { width: 100vw; height: 100vh; max-height: 100vh; bottom: 0; right: 0; left: 0; border-radius: 0; }',
    '  #aichatbot-toggle.open { display: none; }',
    '  #aichatbot-header { padding: 16px; }',
    '}'
  ].join('\\n');
  document.head.appendChild(style);

  // SVG icons
  var ICON_CHAT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
  var ICON_CLOSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
  var ICON_SEND = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path></svg>';
  var ICON_BOT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><line x1="12" y1="7" x2="12" y2="11"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>';

  // Container
  var container = document.createElement('div');
  container.id = 'aichatbot-widget-container';

  // Toggle button
  var toggle = document.createElement('button');
  toggle.id = 'aichatbot-toggle';
  toggle.innerHTML = ICON_CHAT + '<span class="aichatbot-close-icon">' + ICON_CLOSE + '</span>';
  toggle.setAttribute('aria-label', 'Open chat');

  // Chat window
  var win = document.createElement('div');
  win.id = 'aichatbot-window';

  // Header with avatar and status
  var header = document.createElement('div');
  header.id = 'aichatbot-header';
  header.innerHTML = '<div id="aichatbot-header-avatar">' + ICON_BOT + '</div><div id="aichatbot-header-info"><div id="aichatbot-header-name">' + CHATBOT_NAME + '</div><div id="aichatbot-header-status">Online</div></div>';

  var messagesEl = document.createElement('div');
  messagesEl.id = 'aichatbot-messages';

  var inputArea = document.createElement('div');
  inputArea.id = 'aichatbot-input-area';

  // Textarea for multiline input
  var input = document.createElement('textarea');
  input.id = 'aichatbot-input';
  input.rows = 1;
  input.placeholder = 'Type a message\\u2026';
  input.setAttribute('autocomplete', 'off');

  // Auto-resize textarea
  function autoResize() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 100) + 'px';
  }
  input.addEventListener('input', autoResize);

  var sendBtn = document.createElement('button');
  sendBtn.id = 'aichatbot-send';
  sendBtn.innerHTML = ICON_SEND;

  inputArea.appendChild(input);
  inputArea.appendChild(sendBtn);

  // Quick actions area
  var quickActionsEl = document.createElement('div');
  quickActionsEl.id = 'aichatbot-quick-actions';
  function renderQuickActions() {
    quickActionsEl.innerHTML = '';
    if (quickActions.length > 0) {
      quickActions.forEach(function(action) {
        var btn = document.createElement('button');
        btn.className = 'aichatbot-quick-btn';
        btn.textContent = action.label;
        btn.addEventListener('click', function() {
          input.value = action.prompt;
          autoResize();
          sendMessage();
        });
        quickActionsEl.appendChild(btn);
      });
    }
  }

  // Footer
  var footer = document.createElement('div');
  footer.id = 'aichatbot-footer';

  win.appendChild(header);
  win.appendChild(messagesEl);
  win.appendChild(quickActionsEl);
  win.appendChild(inputArea);
  win.appendChild(footer);

  container.appendChild(toggle);
  container.appendChild(win);
  document.body.appendChild(container);

  var isThinking = false;

  function createAvatar() {
    var av = document.createElement('div');
    av.className = 'aichatbot-avatar';
    av.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><line x1="12" y1="7" x2="12" y2="11"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>';
    return av;
  }

  var ICON_FORM = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>';
  var ICON_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
  var ICON_ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>';
  var ICON_DATA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>';

  function renderForm(formDef, parentRow) {
    var container = document.createElement('div');
    container.className = 'aichatbot-form-container';

    // Form header with icon and title
    var header = document.createElement('div');
    header.className = 'aichatbot-form-header';
    header.innerHTML = ICON_FORM;
    var title = document.createElement('div');
    title.className = 'aichatbot-form-title';
    title.textContent = formDef.display_name;
    header.appendChild(title);
    container.appendChild(header);

    // Form body
    var body = document.createElement('div');
    body.className = 'aichatbot-form-body';

    var form = document.createElement('form');
    form.setAttribute('novalidate', '');
    form.setAttribute('autocomplete', 'off');

    var fieldCount = formDef.fields ? formDef.fields.length : 0;
    formDef.fields.forEach(function(field, idx) {
      var group = document.createElement('div');
      group.className = 'aichatbot-form-group';

      var label = document.createElement('label');
      label.className = 'aichatbot-form-label';
      label.textContent = field.label;
      if (field.required) {
        var req = document.createElement('span');
        req.className = 'aichatbot-required';
        req.textContent = '*';
        label.appendChild(req);
      }
      group.appendChild(label);

      var el;
      if (field.type === 'textarea') {
        el = document.createElement('textarea');
        el.className = 'aichatbot-form-textarea';
        if (field.placeholder) el.placeholder = field.placeholder;
      } else if (field.type === 'select') {
        el = document.createElement('select');
        el.className = 'aichatbot-form-select';
        var emptyOpt = document.createElement('option');
        emptyOpt.value = '';
        emptyOpt.textContent = 'Select ' + field.label.toLowerCase() + '\u2026';
        el.appendChild(emptyOpt);
        (field.options || []).forEach(function(opt) {
          var o = document.createElement('option');
          o.value = opt;
          o.textContent = opt;
          el.appendChild(o);
        });
      } else {
        el = document.createElement('input');
        el.className = 'aichatbot-form-input';
        var typeMap = { string: 'text', email: 'email', phone: 'tel', number: 'number', date: 'date' };
        el.type = typeMap[field.type] || 'text';
        if (field.placeholder) el.placeholder = field.placeholder;
      }
      el.name = field.name;
      if (field.required) el.required = true;

      // Pre-fill with AI-extracted values from the conversation
      var isPrefilled = formDef.prefill && formDef.prefill[field.name] != null && String(formDef.prefill[field.name]) !== '';
      if (isPrefilled) {
        el.value = String(formDef.prefill[field.name]);
        el.classList.add('prefilled');
      }

      group.appendChild(el);

      var errorEl = document.createElement('div');
      errorEl.className = 'aichatbot-form-error';
      errorEl.style.display = 'none';
      group.appendChild(errorEl);

      form.appendChild(group);
    });

    var submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'aichatbot-form-submit';
    submitBtn.innerHTML = 'Submit ' + ICON_ARROW;
    form.appendChild(submitBtn);

    form.addEventListener('submit', function(e) {
      e.preventDefault();
      handleFormSubmit(formDef, form, submitBtn, container);
    });

    body.appendChild(form);
    container.appendChild(body);
    // Insert into the message wrapper so it flows inside the assistant bubble area
    parentRow.appendChild(container);
  }

  async function handleFormSubmit(formDef, formEl, submitBtn, containerEl) {
    // Clear previous errors
    formEl.querySelectorAll('.aichatbot-form-error').forEach(function(el) {
      el.style.display = 'none';
      el.textContent = '';
    });

    // Collect data
    var data = {};
    var hasError = false;
    formDef.fields.forEach(function(field) {
      var el = formEl.querySelector('[name="' + field.name + '"]');
      var val = el ? el.value.trim() : '';
      if (field.required && !val) {
        hasError = true;
        var errEl = el.parentNode.querySelector('.aichatbot-form-error');
        errEl.textContent = field.label + ' is required';
        errEl.style.display = 'block';
        return;
      }
      if (val && field.type === 'email' && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(val)) {
        hasError = true;
        var errEl = el.parentNode.querySelector('.aichatbot-form-error');
        errEl.textContent = 'Invalid email address';
        errEl.style.display = 'block';
        return;
      }
      if (field.type === 'number' && val) {
        data[field.name] = Number(val);
      } else {
        data[field.name] = val;
      }
    });

    if (hasError) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    try {
      var res = await fetch(API_BASE + '/api/enquiries/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatbotId: CHATBOT_ID,
          formId: formDef.id,
          data: data,
          conversationId: conversationId,
          visitorId: visitorId
        })
      });

      var result = await res.json();

      if (res.ok && result.success) {
        // Replace form with success message
        containerEl.innerHTML = ICON_CHECK + '<span>' + (result.message || formDef.success_message) + '</span>';
        containerEl.className = 'aichatbot-form-success';
        // Mark the message so form won't re-render
        messages.forEach(function(m) { if (m.formDefs) m.formSubmitted = true; });
      } else if (result.errors) {
        // Show field-level errors from server
        Object.keys(result.errors).forEach(function(name) {
          var el = formEl.querySelector('[name="' + name + '"]');
          if (el) {
            var errEl = el.parentNode.querySelector('.aichatbot-form-error');
            errEl.textContent = result.errors[name];
            errEl.style.display = 'block';
          }
        });
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit';
      } else {
        submitBtn.textContent = result.error || 'Submission failed';
        setTimeout(function() { submitBtn.disabled = false; submitBtn.textContent = 'Submit'; }, 2000);
      }
    } catch (err) {
      submitBtn.textContent = 'Network error';
      setTimeout(function() { submitBtn.disabled = false; submitBtn.textContent = 'Submit'; }, 2000);
    }
  }

  // --- API Data Card helpers ---
  function humanizeLabel(str) {
    return String(str)
      .replace(/[_-]+/g, ' ')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/\\s+/g, ' ')
      .trim()
      .replace(/\\b\\w/g, function(c) { return c.toUpperCase(); });
  }

  /** Strip HTML tags and decode entities. Many CMS fields arrive as raw markup. */
  function stripHtml(str) {
    var t = String(str);
    if (t.indexOf('<') === -1 && t.indexOf('&') === -1) return t;
    t = t.replace(/<(script|style)[^>]*>[\\s\\S]*?<\\/\\1>/gi, ' ').replace(/<[^>]*>/g, ' ');
    // textarea decodes entities without ever being attached to the document
    var decoder = document.createElement('textarea');
    decoder.innerHTML = t;
    return decoder.value.replace(/\\s+/g, ' ').trim();
  }

  var TITLE_FIELDS = ['name', 'title', 'event_name', 'subject', 'heading', 'label', 'display_name', 'full_name'];
  function detectTitleField(obj) {
    for (var i = 0; i < TITLE_FIELDS.length; i++) {
      if (obj[TITLE_FIELDS[i]] && typeof obj[TITLE_FIELDS[i]] === 'string') return TITLE_FIELDS[i];
    }
    return null;
  }

  // --- image detection ---
  var IMAGE_KEY_RE = /^(image|img|thumbnail|thumb|photo|picture|avatar|icon|cover|banner|logo|featuredimage|imageurl|photourl|coverimage|mainimage)s?$/i;
  var IMAGE_EXT_RE = /\\.(jpe?g|png|gif|webp|avif|svg)(\\?|#|$)/i;
  var GALLERY_KEY_RE = /^(gallery|images|photos|pictures|media)$/i;

  function isHttpUrl(v) {
    return typeof v === 'string' && /^https?:\\/\\//i.test(v) && !/\\s/.test(v);
  }
  function normKey(k) { return String(k).replace(/[_\\-\\s]/g, '').toLowerCase(); }
  function isImageKey(k) { return IMAGE_KEY_RE.test(normKey(k)); }
  function looksLikeImage(k, v) {
    if (!isHttpUrl(v)) return false;
    return isImageKey(k) || IMAGE_EXT_RE.test(v);
  }
  /** Pull a URL out of a gallery entry, which may be a string or an object. */
  function urlFromEntry(e) {
    if (isHttpUrl(e)) return e;
    if (e && typeof e === 'object') {
      var cand = e.url || e.src || e.image || e.thumbnail || e.href;
      if (isHttpUrl(cand)) return cand;
    }
    return null;
  }
  /** Find the best single thumbnail for an item, and every key it consumed. */
  function findImage(obj) {
    var keys = Object.keys(obj), i, v, u;
    for (i = 0; i < keys.length; i++) {
      if (isImageKey(keys[i]) && isHttpUrl(obj[keys[i]])) return { url: obj[keys[i]], keys: [keys[i]] };
    }
    for (i = 0; i < keys.length; i++) {
      if (looksLikeImage(keys[i], obj[keys[i]])) return { url: obj[keys[i]], keys: [keys[i]] };
    }
    for (i = 0; i < keys.length; i++) {
      v = obj[keys[i]];
      if (Array.isArray(v) && v.length && (GALLERY_KEY_RE.test(normKey(keys[i])) || isImageKey(keys[i]))) {
        u = urlFromEntry(v[0]);
        if (u) return { url: u, keys: [keys[i]] };
      }
    }
    return null;
  }

  function isStatusField(key) { return /status|state|publish_status/.test(key); }
  function isDateField(key) { return /date|_at$|_on$|start|end|created|updated|scheduled/.test(key); }

  function statusBadgeClass(val) {
    var v = String(val).toLowerCase();
    if (/active|published|approved|open|confirmed|success/.test(v)) return 'aichatbot-badge-green';
    if (/pending|draft|review|waiting/.test(v)) return 'aichatbot-badge-yellow';
    if (/failed|error|rejected|cancelled|closed|expired/.test(v)) return 'aichatbot-badge-red';
    if (/inactive|unpublished|disabled|archived/.test(v)) return 'aichatbot-badge-gray';
    return 'aichatbot-badge-blue';
  }

  function formatDate(val) {
    try { var d = new Date(val); if (isNaN(d.getTime())) return String(val); return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); } catch(e) { return String(val); }
  }

  var SKIP_KEYS = ['id', '_apiData', '_truncated', '_message', 'connectionName', 'connectionDescription', 'success'];
  // Plumbing a visitor never needs to read.
  var NOISE_KEYS = ['slug', 'uuid', 'guid', '__v', '_id', 'sortorder', 'position', 'ordering', 'rank', 'externalid', 'parentid'];
  var MAX_FIELDS = 4;
  /** Values longer than this get their own clamped line instead of an inline row. */
  var LONG_TEXT = 48;

  function extractDisplayFields(obj, consumedKeys) {
    var fields = [];
    var keys = Object.keys(obj);
    for (var i = 0; i < keys.length && fields.length < MAX_FIELDS; i++) {
      var k = keys[i];
      if (SKIP_KEYS.indexOf(k) !== -1) continue;
      if (NOISE_KEYS.indexOf(normKey(k)) !== -1) continue;
      if (consumedKeys && consumedKeys.indexOf(k) !== -1) continue;
      var v = obj[k];
      if (v === null || v === undefined) continue;
      // Drop empties rather than rendering "0 items" / blank rows
      if (Array.isArray(v)) { if (v.length === 0) continue; v = v.length + (v.length === 1 ? ' item' : ' items'); }
      else if (typeof v === 'object') continue;
      else if (typeof v === 'string') { v = stripHtml(v); if (!v) continue; }
      // A leftover image URL is noise once the thumbnail is showing
      if (isHttpUrl(v) && (isImageKey(k) || IMAGE_EXT_RE.test(v))) continue;

      var type = 'text';
      if (isStatusField(k)) type = 'status';
      else if (isDateField(k)) type = 'date';
      else if (typeof v === 'number') type = 'number';
      else if (typeof v === 'string' && v.length > LONG_TEXT) type = 'longtext';
      fields.push({ key: k, value: v, type: type });
    }
    return fields;
  }

  function createFieldElement(label, value, type) {
    var field = document.createElement('div');
    var stacked = (type === 'longtext');
    field.className = 'aichatbot-apicard-field' + (stacked ? ' stacked' : '');
    var lbl = document.createElement('div');
    lbl.className = 'aichatbot-apicard-label';
    lbl.textContent = humanizeLabel(label);
    field.appendChild(lbl);
    var val = document.createElement('div');
    val.className = 'aichatbot-apicard-value' + (stacked ? ' clamp' : '');
    if (type === 'status') {
      var badge = document.createElement('span');
      badge.className = 'aichatbot-badge ' + statusBadgeClass(value);
      badge.textContent = humanizeLabel(String(value));
      val.appendChild(badge);
    } else if (type === 'date') {
      val.textContent = formatDate(value);
    } else if (type === 'number') {
      val.textContent = typeof value === 'number' ? value.toLocaleString() : String(value);
    } else {
      val.textContent = String(value);
      if (stacked) val.title = String(value);
    }
    field.appendChild(val);
    return field;
  }

  /** Thumbnail that removes itself if the URL 404s, rather than leaving a broken frame. */
  function createCardMedia(url, altText) {
    var wrap = document.createElement('div');
    wrap.className = 'aichatbot-apicard-media';
    var img = document.createElement('img');
    img.className = 'aichatbot-apicard-img';
    img.alt = altText || '';
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    img.onerror = function() { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); };
    img.src = url;
    wrap.appendChild(img);
    return wrap;
  }

  /** Resolve {field} / {a.b} placeholders in a CTA link from the card's own item. */
  function interpolateCardUrl(tpl, item) {
    return String(tpl).replace(/\\{([\\w.]+)\\}/g, function(_m, path) {
      var v = path.split('.').reduce(function(o, k) { return (o == null) ? undefined : o[k]; }, item);
      return v == null ? '' : encodeURIComponent(String(v));
    });
  }

  /** CTA button for a card. Returns null when the connection has no CTA configured. */
  function createCardCta(cta, item, titleText) {
    if (!cta || (cta.type !== 'form' && cta.type !== 'link')) return null;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'aichatbot-apicard-cta';
    btn.textContent = cta.label || (cta.type === 'form' ? 'Enquire' : 'View details');

    if (cta.type === 'link') {
      if (!cta.url) return null;
      var href = interpolateCardUrl(cta.url, item);
      // Re-check after interpolation: never open anything but http(s).
      if (!/^https?:\\/\\//i.test(href)) return null;
      btn.addEventListener('click', function() {
        window.open(href, '_blank', 'noopener,noreferrer');
      });
      return btn;
    }

    // Form CTA: ask the assistant to raise the named form, carrying the item as context.
    btn.addEventListener('click', function() {
      var formLabel = cta.formDisplayName || cta.formName || 'enquiry';
      input.value = titleText
        ? 'Please open the ' + formLabel + ' form for "' + titleText + '".'
        : 'Please open the ' + formLabel + ' form.';
      autoResize();
      sendMessage();
    });
    return btn;
  }

  function createDataCard(item, cta) {
    var card = document.createElement('div');
    card.className = 'aichatbot-apicard';
    var titleKey = detectTitleField(item);
    var titleText = titleKey ? String(item[titleKey]) : '';
    var img = findImage(item);
    var consumed = (img ? img.keys : []).concat(titleKey ? [titleKey] : []);

    if (img) card.appendChild(createCardMedia(img.url, titleText));

    var body = document.createElement('div');
    body.className = 'aichatbot-apicard-body';
    if (titleKey) {
      var titleEl = document.createElement('div');
      titleEl.className = 'aichatbot-apicard-title';
      titleEl.textContent = titleText;
      titleEl.title = titleText;
      body.appendChild(titleEl);
    }
    var fieldsContainer = document.createElement('div');
    fieldsContainer.className = 'aichatbot-apicard-fields';
    extractDisplayFields(item, consumed).forEach(function(f) {
      fieldsContainer.appendChild(createFieldElement(f.key, f.value, f.type));
    });
    body.appendChild(fieldsContainer);
    var ctaBtn = createCardCta(cta, item, titleText);
    if (ctaBtn) body.appendChild(ctaBtn);
    card.appendChild(body);
    return card;
  }

  /** Try to unwrap { data: [...] } or { results: [...] } style wrappers */
  function unwrapData(data) {
    if (Array.isArray(data)) return { items: data, isArray: true };
    if (data && typeof data === 'object') {
      // Look for a nested array property (common API patterns: data, results, items, records, events)
      var arrayKeys = ['data', 'results', 'items', 'records', 'events', 'rows', 'entries', 'list'];
      var keys = Object.keys(data);
      for (var i = 0; i < arrayKeys.length; i++) {
        if (Array.isArray(data[arrayKeys[i]])) return { items: data[arrayKeys[i]], isArray: true };
      }
      // Fallback: find the first array property
      for (var j = 0; j < keys.length; j++) {
        if (Array.isArray(data[keys[j]]) && data[keys[j]].length > 0) return { items: data[keys[j]], isArray: true };
      }
      // No nested array found — treat as single object
      return { items: [data], isArray: false };
    }
    return { items: [], isArray: false };
  }

  function renderApiCards(apiDataDef, parentRow) {
    var wrapper = document.createElement('div');
    wrapper.className = 'aichatbot-apidata-container';

    var headerEl = document.createElement('div');
    headerEl.className = 'aichatbot-apidata-header';
    headerEl.innerHTML = ICON_DATA;
    var titleEl = document.createElement('div');
    titleEl.className = 'aichatbot-apidata-title';
    titleEl.textContent = humanizeLabel(apiDataDef.connectionName || 'Results');
    headerEl.appendChild(titleEl);

    var unwrapped = unwrapData(apiDataDef.data);
    var items = unwrapped.items;
    var isArray = unwrapped.isArray;

    // Filter out truncation markers for counting
    var realItems = items.filter(function(it) { return !(it && it._truncated); });
    var truncatedItem = items.filter(function(it) { return it && it._truncated; })[0];

    if (realItems.length > 0) {
      var countBadge = document.createElement('span');
      countBadge.className = 'aichatbot-apidata-count';
      countBadge.textContent = realItems.length + (realItems.length === 1 ? ' item' : ' items');
      headerEl.appendChild(countBadge);
    }

    wrapper.appendChild(headerEl);

    if (realItems.length === 0) {
      var emptyEl = document.createElement('div');
      emptyEl.className = 'aichatbot-apidata-empty';
      emptyEl.textContent = 'No data available';
      wrapper.appendChild(emptyEl);
    } else if (realItems.length === 1 && !isArray) {
      // Single non-array object — detail card layout
      var detail = document.createElement('div');
      detail.className = 'aichatbot-apicard-detail';
      var only = realItems[0];
      var titleKey = detectTitleField(only);
      var titleText = titleKey ? String(only[titleKey]) : '';
      var detailImg = findImage(only);
      var detailConsumed = (detailImg ? detailImg.keys : []).concat(titleKey ? [titleKey] : []);

      if (detailImg) detail.appendChild(createCardMedia(detailImg.url, titleText));

      var detailBody = document.createElement('div');
      detailBody.className = 'aichatbot-apicard-body';
      if (titleKey) {
        var cardTitle = document.createElement('div');
        cardTitle.className = 'aichatbot-apicard-title';
        cardTitle.textContent = titleText;
        detailBody.appendChild(cardTitle);
      }
      var fieldsContainer = document.createElement('div');
      fieldsContainer.className = 'aichatbot-apicard-fields';
      extractDisplayFields(only, detailConsumed).forEach(function(f) {
        fieldsContainer.appendChild(createFieldElement(f.key, f.value, f.type));
      });
      detailBody.appendChild(fieldsContainer);
      var detailCta = createCardCta(apiDataDef.cta, only, titleText);
      if (detailCta) detailBody.appendChild(detailCta);
      detail.appendChild(detailBody);
      wrapper.appendChild(detail);
    } else {
      // Array items — horizontal scroll grid (one card per item)
      var grid = document.createElement('div');
      grid.className = 'aichatbot-apidata-grid';
      realItems.forEach(function(item) {
        grid.appendChild(createDataCard(item, apiDataDef.cta));
      });
      if (truncatedItem) {
        var moreCard = document.createElement('div');
        moreCard.className = 'aichatbot-apidata-more';
        moreCard.textContent = truncatedItem._message || 'More items available';
        grid.appendChild(moreCard);
      }
      wrapper.appendChild(grid);
    }

    parentRow.appendChild(wrapper);
  }

  function renderMessages() {
    messagesEl.innerHTML = '';
    messages.forEach(function(msg) {
      var row = document.createElement('div');
      row.className = 'aichatbot-row ' + msg.role;

      if (msg.role === 'assistant') {
        row.appendChild(createAvatar());
      }

      var bubble = document.createElement('div');
      bubble.className = 'aichatbot-msg ' + msg.role;
      bubble.textContent = msg.content;
      row.appendChild(bubble);

      messagesEl.appendChild(row);

      // Render enquiry forms inline after assistant bubble
      if (msg.role === 'assistant' && msg.formDefs && !msg.formSubmitted) {
        msg.formDefs.forEach(function(fd) {
          renderForm(fd, row);
        });
      }

      // Render API data cards inline after assistant bubble
      if (msg.role === 'assistant' && msg.apiDataDefs) {
        msg.apiDataDefs.forEach(function(ad) {
          renderApiCards(ad, row);
        });
      }
    });
    if (isThinking) {
      var thinkRow = document.createElement('div');
      thinkRow.className = 'aichatbot-thinking-row';
      thinkRow.appendChild(createAvatar());
      var thinkDiv = document.createElement('div');
      thinkDiv.className = 'aichatbot-thinking';
      thinkDiv.innerHTML = '<span></span><span></span><span></span>';
      thinkRow.appendChild(thinkDiv);
      messagesEl.appendChild(thinkRow);
    }
    messagesEl.scrollTop = messagesEl.scrollHeight;
    renderQuickActions();
  }

  renderMessages();

  toggle.addEventListener('click', function() {
    isOpen = !isOpen;
    if (isOpen) {
      win.classList.add('open');
      toggle.classList.add('open');
      setTimeout(function() { input.focus(); }, 300);
    } else {
      win.classList.remove('open');
      toggle.classList.remove('open');
    }
  });

  async function sendMessage() {
    var text = input.value.trim();
    if (!text) return;

    messages.push({ role: 'user', content: text });
    input.value = '';
    input.style.height = 'auto';
    isThinking = true;
    renderMessages();

    sendBtn.disabled = true;
    input.disabled = true;

    try {
      var payload = {
        messages: messages.slice(-20),
        visitorId: visitorId
      };
      if (conversationId) payload.conversationId = conversationId;

      var res = await fetch(API_BASE + '/api/chat/' + CHATBOT_ID, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      // Capture conversation ID from response headers
      var respConvId = res.headers.get('X-Conversation-Id');
      if (respConvId) conversationId = respConvId;

      if (!res.ok) {
        var errText = '';
        try { var errJson = await res.json(); errText = errJson.error || ''; } catch(e) {}
        isThinking = false;
        messages.push({ role: 'assistant', content: errText || 'Sorry, something went wrong. Please try again.' });
        renderMessages();
        return;
      }

      isThinking = false;

      // Try streaming first, fall back to reading full text
      var assistantMsg = { role: 'assistant', content: '' };
      messages.push(assistantMsg);

      var streamed = false;
      if (res.body && typeof res.body.getReader === 'function') {
        try {
          var reader = res.body.getReader();
          var decoder = new TextDecoder();
          var chunkCount = 0;
          while (true) {
            var readResult = await reader.read();
            if (readResult.done) {

              break;
            }
            var chunk = decoder.decode(readResult.value, { stream: true });
            chunkCount++;
            assistantMsg.content += chunk;
            streamed = true;
            renderMessages();
          }
        } catch (streamErr) {
          console.warn('[Widget] Stream reading failed:', streamErr, 'Content so far:', assistantMsg.content.length);
        }
      }

      // Fallback: if stream produced nothing, clone and read as text
      if (!assistantMsg.content && !streamed) {
        try {
          var fullText = await res.text();
          assistantMsg.content = fullText;
        } catch(e) {
          // body already consumed by stream attempt — nothing more we can do
        }
      }

      if (!assistantMsg.content) {
        assistantMsg.content = 'Sorry, I could not generate a response.';
      }

      // Detect and parse __FORM__...__ENDFORM__ markers
      var formRegex = /__FORM__([\\s\\S]*?)__ENDFORM__/g;
      var formMatch;
      var formDefs = [];
      while ((formMatch = formRegex.exec(assistantMsg.content)) !== null) {
        try { formDefs.push(JSON.parse(formMatch[1])); } catch(e) { console.warn('Form JSON parse error:', e); }
      }

      if (formDefs.length > 0) {
        // Strip markers from displayed text
        assistantMsg.content = assistantMsg.content.replace(/__FORM__[\\s\\S]*?__ENDFORM__/g, '').trim();
        if (!assistantMsg.content) assistantMsg.content = 'Please fill in the form below.';
        assistantMsg.formDefs = formDefs;
        assistantMsg.formSubmitted = false;
      }

      // Detect and parse __APIDATA__...__ENDAPIDATA__ markers
      var apiDataRegex = /__APIDATA__([\\s\\S]*?)__ENDAPIDATA__/g;
      var apiDataMatch;
      var apiDataDefs = [];
      while ((apiDataMatch = apiDataRegex.exec(assistantMsg.content)) !== null) {
        try { apiDataDefs.push(JSON.parse(apiDataMatch[1])); } catch(e) { console.warn('API data JSON parse error:', e); }
      }

      if (apiDataDefs.length > 0) {
        assistantMsg.content = assistantMsg.content.replace(/__APIDATA__[\\s\\S]*?__ENDAPIDATA__/g, '').trim();
        if (!assistantMsg.content) assistantMsg.content = 'Here are the results:';
        assistantMsg.apiDataDefs = apiDataDefs;
      }

      renderMessages();
    } catch (err) {
      isThinking = false;
      messages.push({ role: 'assistant', content: 'Network error. Please check your connection and try again.' });
      renderMessages();
    } finally {
      sendBtn.disabled = false;
      input.disabled = false;
      input.focus();
    }
  }

  sendBtn.addEventListener('click', sendMessage);
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
})();`

  return new NextResponse(widgetJs, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  })
}
