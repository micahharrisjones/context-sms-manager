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
1. Test Twilio webhook integration with real SMS messages
2. Verify message processing and social media link previews
3. Monitor webhook logs for any issues
4. Deploy to production with Twilio configuration