# Context - Personal Information Management System

## Project Overview
A robust SMS management platform that enables persistent message storage and seamless communication across multiple devices, with intelligent message organization and advanced integration capabilities.

## Current Status
- **Phase**: Production-ready MVP with database persistence
- **Last Updated**: January 13, 2025
- **Status**: Switching from ClickSend to Twilio for SMS webhook integration

## Architecture
- **Frontend**: TypeScript React with mobile-responsive design
- **Backend**: Node.js Express server
- **Database**: PostgreSQL with Drizzle ORM
- **Real-time**: WebSocket connections
- **SMS Integration**: Twilio (migrating from ClickSend)
- **Features**: Social media link previews (Instagram, Pinterest)

## Recent Changes
- ✅ Implemented complete MVP with React frontend and Express backend
- ✅ Migrated from in-memory to PostgreSQL persistent storage
- ✅ Added Instagram and Pinterest link preview functionality
- ✅ Created mobile-responsive design with Context branding (#ed2024 primary color)
- ✅ Confirmed ClickSend webhook validation issues across multiple AI platforms
- ✅ Switched from ClickSend to Twilio SMS integration
- ✅ Updated webhook schema and validation for Twilio format
- ✅ Added multiple webhook endpoints for flexibility
- ✅ **Successfully tested Twilio webhook integration**
- ✅ **Confirmed real-time message processing and WebSocket updates**

## User Preferences
- **Design**: #ed2024 primary color, Context branding, mobile-responsive
- **Functionality**: No message input form - messages only via SMS webhooks
- **Storage**: Persistent PostgreSQL database for message retention
- **Integration**: Twilio for reliable SMS webhook handling

## Technical Stack
- TypeScript React frontend (Vite)
- Node.js Express backend
- PostgreSQL database
- Drizzle ORM for database management
- WebSocket real-time updates
- Twilio SMS API integration
- Social media link preview parsing

## Key Files
- `server/routes.ts` - API endpoints and webhook handling
- `server/storage.ts` - Database operations and storage interface
- `server/websocket.ts` - Real-time WebSocket connections
- `shared/schema.ts` - Database schema and types
- `client/src/components/messages/` - Message display components

## Webhook Endpoints
- `/api/webhook/sms` - Primary SMS webhook endpoint
- `/webhook/sms` - Alternate SMS webhook endpoint 
- `/api/webhook/twilio` - Twilio-specific webhook endpoint
- `/webhook/twilio` - Twilio-specific alternate endpoint

## Next Steps
1. ✅ **Tested and confirmed Twilio webhook integration working**
2. ✅ **Implemented smart hashtag inheritance for iOS message splitting**
3. Test social media link previews with Instagram/Pinterest URLs
4. Deploy to production environment

## Smart Categorization Features
- **Hashtag extraction**: Automatic detection of #hashtags in SMS messages
- **iOS message splitting support**: When iOS separates messages, URLs inherit hashtags from recent messages (within 5 minutes) from the same sender
- **Tag inheritance**: Link preview messages automatically get categorized with hashtags from preceding text messages
- **Clean interface**: Hashtag-only messages are hidden from the UI but still used for categorization, providing a cleaner content-focused experience