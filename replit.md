# Context - Personal Information Management System

## Project Overview
A robust SMS management platform that enables persistent message storage and seamless communication across multiple devices, with intelligent message organization and advanced integration capabilities.

## Current Status
- **Phase**: Deployed to production with Reserved VM
- **Last Updated**: August 14, 2025 (4:50 AM)
- **Status**: Live deployment at contxt.life, fully operational on Reserved VM
- **Repository**: https://github.com/micahharrisjones/context-sms-manager
- **Production URL**: https://contxt.life
- **SMS Webhook**: https://contxt.life/api/webhook/twilio (configured in Twilio)

## Architecture
- **Frontend**: TypeScript React with mobile-responsive design
- **Backend**: Node.js Express server
- **Database**: PostgreSQL with Drizzle ORM
- **Real-time**: WebSocket connections
- **SMS Integration**: Twilio (migrating from ClickSend)
- **Features**: Rich social media embeds (Instagram, Pinterest, X/Twitter, Reddit, Facebook, YouTube, TikTok)

## Recent Changes
- ✅ Implemented complete MVP with React frontend and Express backend
- ✅ Migrated from in-memory to PostgreSQL persistent storage
- ✅ Added Instagram and Pinterest link preview functionality
- ✅ Created mobile-responsive design with Context branding (#ed2024 primary color)
- ✅ Switched from ClickSend to Twilio SMS integration
- ✅ Successfully tested Twilio webhook integration with real phone number
- ✅ Implemented smart hashtag inheritance for iOS message splitting
- ✅ Added hashtag-only message filtering for clean UI
- ✅ Enhanced mobile experience with persistent logo and auto-closing menu
- ✅ **Implemented multi-user authentication system with phone number verification**
- ✅ **Added user-scoped message storage and API endpoints**
- ✅ **Created login screen and authentication flow**
- ✅ **Fixed phone number normalization issues for consistent user account matching**
- ✅ **Resolved message association problems between webhook and authenticated users**
- ✅ **Enhanced logout functionality with proper error handling**
- ✅ **Cleaned up duplicate user accounts and consolidated message storage**
- ✅ **Added comprehensive delete functionality with X buttons and confirmation modals**
- ✅ **Implemented user-specific WebSocket notifications to prevent cross-user toast spam**
- ✅ **Added tag deletion feature with bulk message removal**
- ✅ **Enhanced UI with hover-to-reveal delete buttons on messages and sidebar tags**
- ✅ **Fixed tag deletion to include hashtag-only messages - tags can now be deleted even when they only contain hidden categorization messages**
- ✅ **Enhanced social media previews to show actual embedded content instead of basic links**
- ✅ **Added comprehensive social media support: Instagram, Pinterest, X/Twitter, Reddit, Facebook, YouTube, and TikTok with rich iframe embeds**
- ✅ **Implemented real-time shared board notifications - all board members are instantly notified when messages with matching hashtags are received**
- ✅ **Enhanced WebSocket system to support multi-user broadcasts for collaborative shared board functionality**
- ✅ **Added IMDB link preview support with golden styling and movie database information**
- ✅ **Implemented board member viewing functionality - users can see phone numbers, roles, join dates, and activity of all shared board members**
- ✅ **Created BoardMembersModal with formatted phone number display and member management interface**
- ✅ **Successfully deployed complete project to GitHub with comprehensive documentation and professional README**
- ✅ **Configured custom domain contxt.life for professional production deployment**
- ✅ **Deployed Context to Reserved VM with 24/7 availability at https://contxt.life**
- ✅ **Updated Twilio webhook to production endpoint for live SMS processing**
- ✅ **Implemented message editing functionality - users can edit message content and move messages between boards by adding/removing hashtags**
- ✅ **Added shared board deletion feature - board owners can permanently delete shared boards with proper confirmation dialogs**
- ✅ **Implemented SMS notification system - board members receive text messages when new content is added to shared boards**
- ✅ **Integrated TMDB API for enhanced IMDB link previews with movie posters, titles, ratings, and release years**
- ✅ **Simplified authentication system - removed verification codes for easier testing, now supports direct phone number login**
- ✅ **Migrated from Autoscale to Reserved VM deployment for better cost efficiency and 24/7 reliability**
- ✅ **Added "Private Boards" section header above personal hashtags for consistent labeling with Shared Boards**
- ✅ **Implemented masonry layout for dynamic message display with Pinterest-style arrangement**
- ✅ **Enhanced real-time message updates with improved WebSocket invalidation and fallback polling**
- ✅ **Improved WebSocket connection stability and removed connectivity toast notifications for cleaner UX**

## User Preferences
- **Design**: #ed2024 primary color, Context branding, mobile-responsive
- **Layout**: Logo in sidebar (far left), search bar and logout button positioned directly under shared boards section within scrollable area
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