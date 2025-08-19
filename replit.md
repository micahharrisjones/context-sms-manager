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
- ✅ **Fixed search functionality - now properly parses URL parameters and displays search results**
- ✅ **Removed login confirmation toast for streamlined authentication experience**
- ✅ **Added comprehensive SMS signup documentation and welcome messaging system**
- ✅ **Enhanced login screen with SMS signup instructions and clickable Context phone number (+1 458-218-8508)**
- ✅ **Updated app design with Context sunburst logo and warm #fff3ea background throughout**
- ✅ **Changed all lines and hover states from light gray to warm #e3cac0 color for cohesive design**
- ✅ **Streamlined login screen by removing unnecessary text for ultra-clean mobile-optimized design**
- ✅ **Applied warm color consistency to cards, sidebar, and mobile menu with #e3cac0 borders throughout**
- ✅ **Updated all hover states throughout the application to use warm #e3cac0 color instead of light gray**
- ✅ **Implemented automatic welcome SMS for new users with onboarding instructions**
- ✅ **Fixed SMS signup system - relaxed Account SID validation to allow legitimate messages while maintaining security**
- ✅ **Enhanced phone number formatting for Twilio E164 compliance in welcome SMS delivery**
- ✅ **Resolved Twilio outbound message failures by implementing comprehensive test number validation**
- ✅ **Added smart filtering to prevent SMS attempts to invalid test numbers (555) while maintaining full functionality**
- ✅ **Enhanced phone number validation to detect and prevent SMS attempts to landlines and unreachable carriers (Error 30006)**
- ✅ **Implemented comprehensive problematic number detection including toll-free, premium services, and service numbers**
- ✅ **Created comprehensive admin dashboard with phone number-based access control restricted to authorized users**
- ✅ **Built admin interface with user management, statistics overview, and bulk deletion capabilities**
- ✅ **Fixed modal functionality issues - corrected shared board creation button to open proper modal instead of private board modal**
- ✅ **Applied consistent warm color scheme (#fff3ea background, #e3cac0 borders) to all modals for design consistency**
- ✅ **Enhanced modal descriptions to clearly differentiate between private boards (personal hashtag categories) and shared boards (collaborative spaces)**
- ✅ **Updated favicon and social media sharing metadata using the Context sunburst logo for professional branding**
- ✅ **Added comprehensive Open Graph, Twitter Card, and PWA manifest for enhanced social sharing and mobile app experience**
- ✅ **Fixed mobile viewport issues - removed maximum-scale restriction and added viewport-fit=cover for better mobile browser compatibility**
- ✅ **Implemented comprehensive mobile CSS fixes including 100dvh units, safe area insets for notched devices, and scroll-to-top functionality**
- ✅ **Enhanced mobile login experience to prevent logo cutoff and viewport positioning issues on iOS Safari and other mobile browsers**
- ✅ **Optimized admin dashboard for mobile devices - changed stats cards to 2-column layout and improved user table responsiveness**
- ✅ **Enhanced admin dashboard mobile UX with responsive table columns, improved button sizes, and mobile-friendly bulk actions layout**
- ✅ **Fixed mobile scroll/framing issues post-login with comprehensive viewport handling, scroll restoration, and iOS Safari compatibility**
- ✅ **Updated social sharing image with custom-designed PNG featuring perfect warm cream background and Context sunburst logo**
- ✅ **Added prominent taglines to login screen: "Text it, tag it, find it later." and "Save anything from anywhere, with just a text."**
- ✅ **Implemented comprehensive Open Graph link preview system - displays rich previews with images, titles, and descriptions for general website URLs not covered by social media embeds**
- ✅ **CRITICAL BUG FIX: Fixed shared board message deletion issue - private board deletion no longer affects shared board messages with same hashtag**
- ✅ **Enhanced welcome SMS for new users - now includes https://contxt.life URL for easy dashboard access**
- ✅ **Updated welcome message with improved copy emphasizing hashtag organization and "Save anything from anywhere, with just a text" tagline**
- ✅ **Overhauled board tagging system to use proper slug format (lowercase, hyphenated) eliminating naming conflicts like "Toyota Parts List" → #toyota-parts-list**
- ✅ **Made edit and delete icons permanently visible on message cards to improve discoverability for users**
- ✅ **Implemented comprehensive board renaming functionality - users can now rename both shared boards and private boards (hashtags) with proper validation and conflict prevention**
- ✅ **Integrated DeepSeek AI-powered hybrid categorization system - automatically categorizes messages without hashtags while preserving manual hashtag control**
- ✅ **Added personalized auto-login URLs in welcome messages - new users can click directly into their account without manual login**
- ✅ **Fixed iPhone UI spacing issues between "owner" text and action buttons in shared boards section**
- ✅ **Implemented account deletion feature with confirmation modal - users can permanently delete their accounts via Delete Account button near logout**
- ✅ **RESOLVED: Fixed account deletion 500 errors by implementing comprehensive error handling in database storage layer - account deletion now works perfectly**

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