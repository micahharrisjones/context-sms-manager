# Aside - Personal Information Management System

### Overview
Aside is a robust SMS management platform designed to enable persistent message storage and seamless communication across multiple devices. Its core purpose is to intelligently organize messages and provide advanced integration capabilities. The platform includes a comprehensive set of features such as rich social media embeds, real-time shared boards, and an AI-powered hybrid categorization system. The business vision is to provide a user-friendly, SMS-first solution for saving and organizing information from anywhere, accessible via a web dashboard at textaside.app, with ambitions to expand AI-driven personalization and content understanding.

### User Preferences
- **Design**: #b95827 primary color (orange), #263d57 secondary (dark blue), #fff2ea background, Aside branding, mobile-responsive
- **Layout**: Logo in sidebar (far left), search bar and logout button positioned directly under shared boards section within scrollable area
- **Functionality**: No message input form - messages only via SMS webhooks
- **Storage**: Persistent PostgreSQL database for message retention
- **Integration**: Twilio for reliable SMS webhook handling

### System Architecture
The system employs a modern web architecture with a TypeScript React frontend (Vite) and a Node.js Express backend. Data persistence is managed by a PostgreSQL database utilizing Drizzle ORM. Real-time features are powered by WebSocket connections. The platform integrates with Twilio for SMS processing, supporting incoming messages via webhooks and outgoing notifications. A key architectural decision is the "SMS-first" onboarding flow and a content-aware conversational AI that analyzes saved messages for personalized responses. UI/UX design emphasizes a clean, mobile-optimized experience with a warm color scheme (#fff2ea background, #e3cac0 borders) and consistent branding using the Aside logo. Key features include multi-user authentication with phone number verification and secure magic link tokens (30-minute expiry, one-time use), user-scoped message storage, smart hashtag inheritance for message organization, comprehensive social media and general URL link previews (Instagram, Pinterest, X/Twitter, Reddit, Facebook, YouTube, TikTok, IMDB), shared board functionality with real-time notifications, and message editing/renaming. The system also includes an admin dashboard for authorized users with management capabilities, and a Squarespace integration API endpoint (/api/signup) that enables professional website signups with instant SMS welcome messages for seamless user acquisition. AI integration includes DeepSeek for hybrid categorization and daily affirmations.

### Recent Changes
- **Fixed invite link domain issue**: Invite links now correctly use textaside.app domain instead of Replit workspace domain (workspace.micahhj.repl.co). Updated InviteService.getInviteUrl() to always return https://textaside.app/join/{code} (October 2025)
- **Implemented SMS invite system (Phase 1 MVP)**: Users can now invite friends to Aside via SMS. Text "invite" to receive a shareable link with unique invite code. Landing page at /join/{code} collects phone number and sends opt-in SMS. Reply "YES" to complete signup and track conversion. Features: automatic invite code generation, idempotent YES handler, phone validation, conversion tracking with referral fields in users table, 1-hour pending signup expiry. Database includes invites table tracking code, type (sms_link/web/qr), conversions, and referral tracking. Comprehensive Pendo analytics with 6 funnel events (Command Sent, Link Sent, Landing Viewed, Phone Submitted, Opt-In Sent, Conversion Completed) (October 2025)
- **Integrated Microlink.io for all link previews**: Replaced Pinterest-specific workarounds with unified Microlink.io API solution for all link previews. Microlink handles all platforms (Pinterest, X/Twitter, Reddit, e-commerce sites) with consistent, high-quality previews. Flow: cache check → Microlink API (primary, works without API key on free tier) → direct fetch fallback (OG tags/JSON-LD/oEmbed). Free tier: 250 requests/day, no signup required (October 2025)
- **Enhanced link preview support for e-commerce sites**: Added comprehensive JSON-LD structured data parsing to og-service.ts with fully recursive traversal. This enables rich previews for e-commerce product pages (Home Depot, etc.) that use JSON-LD instead of Open Graph meta tags. The parser handles deeply nested structures (@graph, mainEntity, ListItem.item) and supports multiple image field names (url, contentUrl, thumbnailUrl) with circular reference protection (October 2025)
- **Disabled shared board SMS notifications**: All SMS notifications for shared board additions have been disabled to prevent duplicate/unwanted alerts. Board members still receive real-time in-app notifications via WebSocket (October 2025)
- **Fixed duplicate notifications for rapid/split messages**: Implemented 10-second notification debouncing to prevent duplicate SMS when Twilio splits long messages into multiple webhooks. Messages from the same user to the same board are now batched and sent as one combined notification (October 2025)
- **Fixed board link 404 in notifications**: Corrected SMS notification URLs from `/board/{name}` to `/shared/{name}` to match actual routing (October 2025)
- **Fixed SMS notification duplication bug**: Added phone number normalization to E.164 format (`normalizePhoneNumber()` function) for deduplication logic to prevent duplicate SMS when phone numbers are stored in different formats (e.g., +15551234567, 15551234567, 555-123-4567). Both global cache and per-request tracking now use normalized phone numbers for consistent comparison (October 2025)
- **HTML entity decoding in Open Graph previews**: Added `decodeHtmlEntities()` function to properly display special characters (apostrophes, quotes, ampersands) in link preview titles, descriptions, and site names (October 2025)
- **SMS notification deduplication improvement**: Simplified cache key from `phoneNumber:boardId:messageHash` to `phoneNumber:messageHash` to prevent duplicate notifications when users are members of multiple boards (October 2025)
- **Added admin access**: Phone number 3182081034 now has full admin privileges alongside 6155848598
- **Domain migration to textaside.app**: Switched primary domain from contxt.life to textaside.app across all services (October 2025)
  - Updated Twilio webhook URL to use textaside.app
  - Updated README.md with new branding and domain references
  - All magic links, shared board invitations, and admin notifications now use textaside.app
- **Complete rebranding from Context to Aside**: Updated all branding, logos, colors (#b95827 primary, #263d57 secondary, #fff2ea background), domain (textaside.app), and UI text throughout the application
- **Implemented secure magic link authentication**: Replaced insecure phone-based auto-login with cryptographic token system featuring 30-minute expiry, one-time use enforcement, and rate limiting (5 tokens/hour per user)
- **Fixed hashtag cross-contamination bug**: Messages with different hashtags sent quickly (within 5 seconds) no longer incorrectly merge tags - preserves proper message organization
- **Fixed admin panel type imports**: Updated AdminPage.tsx to use proper OnboardingMessage types from shared schema instead of local interface definitions
- **Resolved onboarding message field mismatches**: Fixed OnboardingService to use correct database field names (isActive/content vs enabled/message)

### External Dependencies
- **Twilio**: For SMS integration, handling incoming webhooks and sending outgoing messages.
- **PostgreSQL**: Primary database for persistent storage.
- **DeepSeek AI**: Used for intelligent message categorization and generating personalized daily affirmations.
- **Microlink.io**: Primary service for generating rich link previews, handles bot protection on e-commerce sites (Home Depot, Amazon, etc.). Requires MICROLINK_API_KEY.
- **TMDB API**: Integrated for enhanced IMDB link previews, fetching movie posters, titles, ratings, and release years.
- **Social Media Platforms (Instagram, Pinterest, X/Twitter, Reddit, Facebook, YouTube, TikTok)**: Integrated for rich iframe embeds and link preview parsing.
