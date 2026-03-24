## Overview
Replace the current Intercom integration with WhatsApp-based "Chat with Us" on the dashboard and redesign the upload/recording layout.

## Requirements

### 1. Remove Intercom Integration
- Remove or disable `IntercomProvider.tsx` (`src/components/IntercomProvider.tsx`)
- Remove Intercom script loading (`widget.intercom.io/widget/efoxc8ye`)
- Remove all `IntercomContext` usage from dashboard (`src/pages/dashboard/[[...slug]].tsx`)
- Remove Intercom-related API routes (`/api/intercom-identity`)
- Cancel Intercom subscription (manual step)

### 2. Replace with WhatsApp "Chat with Us"
- Update the "Chat with us" button in `MobileAccountScreen.tsx` to redirect to WhatsApp
- Use the existing `WhatsappCta` component (`src/components/WhatsappCta.tsx`) or create a floating WhatsApp button
- Pre-fill WhatsApp message with user context (e.g., user email, plan name)
- Add floating WhatsApp chat button on desktop dashboard (bottom-right corner, replacing Intercom launcher)

### 3. WhatsApp-Slack Integration
- Connect WhatsApp conversations to a Slack channel
- Implement status tracking for conversations: open, pending, resolved
- Use the existing WhatsApp admin infrastructure (`/admin/whatsapp`)
- Add Slack webhook notifications when new WhatsApp messages arrive

### 4. Redesign Dashboard Upload/Recording Layout
- Redesign the layout for uploading and recording audio on the dashboard
- Improve the file upload UX (drag-and-drop area, progress indicators)
- Improve the recording interface layout

## Existing Code Context
- `IntercomProvider.tsx` - Full Intercom integration to remove
- `WhatsappCta.tsx` - Existing WhatsApp redirect component
- `MobileAccountScreen.tsx` - Has "Chat with us" button
- `/admin/whatsapp/` - Full WhatsApp admin panel with inbox, chat, templates
- `MobileTabBar.tsx`, `MobileChatView.tsx` - WhatsApp mobile components

## Technical Notes
- The existing WhatsApp admin tool at `/admin/whatsapp` already has WebSocket support, conversation management, and template messaging
- The `BusinessWhatsappNumber` constant is defined in `src/admin/whatsapp/api/consts.ts`