## Overview
Develop an AI agent to streamline admin processes, handle customer conversations on WhatsApp and Facebook, and automate sales workflows.

## Requirements

### 1. Chat & Messaging
- [ ] Respond to chats on WhatsApp (extend existing `/admin/whatsapp` infrastructure)
- [ ] Respond to chats on Facebook Messenger
- [ ] Comprehensive product knowledge base about GovClerkMinutes
- [ ] Close sales through WhatsApp conversations
- [ ] Inform customers when issues are transferred to a human agent

### 2. Integrations
- [ ] Integrate with dialer via API (extend existing Twilio setup in `/admin/contacts`)
- [ ] Link to `support@govclerkminutes.com`
- [ ] Generate and track payment links
- [ ] Connect to CRM for lead tracking

### 3. Reporting & Escalation
- [ ] Provide daily reports on: sales, follow-ups, scheduled demos
- [ ] Handle 90% of issues independently
- [ ] Escalate complex issues to `cliff@govclerkminutes.com`
- [ ] Inform customers when issues are transferred to a human agent

### 4. Access Control
- [ ] WhatsApp access restricted to:
  - `cliff@govclerkminutes.com`
  - `sales@govclerkminutes.com`
  - `support@govclerkminutes.com`
- [ ] Consider creating `admin@govclerkminutes.com` if needed

## Existing Code Context
- `src/admin/whatsapp/` — WhatsApp conversation infrastructure with WebSocket support
- `src/pages/admin/whatsapp/index.tsx` — WhatsApp admin page with inbox, chat, templates, calling
- `src/pages/admin/contacts/index.tsx` — Twilio dialer integration (already working)
- `src/components/admin/whatsapp/` — Chat UI components (MobileChatView, ConversationCard, MobileTabBar, etc.)
- `platform/sophon/` — Backend API server (Node.js/Bun)
- `platform/server/` — Rust backend server

## Technical Notes
- Use the existing WhatsApp Business API infrastructure in `/admin/whatsapp`
- Extend the Sophon server for AI agent endpoints
- Consider using OpenAI/Anthropic API for the AI agent's language model
- Payment links can use Stripe (if already integrated) or a custom solution
- The existing Twilio integration in `/admin/contacts` provides the dialer foundation
- Facebook Messenger integration will need a new Meta App setup with webhook handlers
