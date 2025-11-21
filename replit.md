# Aside - Personal Information Management System

### Overview
Aside is an SMS management platform for persistent message storage and seamless multi-device communication. It intelligently organizes messages and offers advanced integrations like social media embeds, real-time shared boards, and an AI-powered hybrid categorization system. The vision is an SMS-first solution for saving and organizing information, accessible via a web dashboard, with future plans for AI-driven personalization and content understanding.

### User Preferences
- **Design**: #b95827 primary color (orange), #263d57 secondary (dark blue), #fff2ea background, Aside branding, mobile-responsive
- **Layout**: Logo in sidebar (far left), search bar and logout button positioned directly under shared boards section within scrollable area
- **Functionality**: No message input form - messages only via SMS webhooks
- **Storage**: Persistent PostgreSQL database for message retention
- **Integration**: Twilio for reliable SMS webhook handling

### System Architecture
The system uses a TypeScript React frontend (Vite) and a Node.js Express backend. Data is stored in PostgreSQL with Drizzle ORM and pgvector for semantic search. Real-time features are powered by WebSockets. Twilio handles SMS processing (incoming via webhooks, outgoing notifications). Key architectural decisions include an "SMS-first" onboarding and a content-aware conversational AI that analyzes saved messages. The UI/UX is clean, mobile-optimized, with a warm color scheme. Features include multi-user authentication with phone verification and magic links, user-scoped message storage, smart hashtag inheritance, comprehensive social media and general URL link previews (Instagram, Pinterest, X/Twitter, Reddit, Facebook, YouTube, TikTok, IMDB via official widgets/embeds), shared board functionality with real-time notifications, and message editing/renaming. An admin dashboard provides management. Squarespace integration API supports professional website signups with instant SMS welcome messages. AI integration includes: "Hey Aside" conversational AI trigger for explicit SMS queries using OpenAI GPT-4o-mini for intent classification (search, summarize, recommend, analyze, login), OpenAI text-embedding-3-small for vector embeddings and keyword-first hybrid search (tries keyword matching first, falls back to 70% semantic + 30% keyword if <3 results for predictable, reliable results), and DeepSeek for hybrid categorization and daily affirmations. DIY URL shortener system (/s/:code pattern) with domain allowlisting (textaside.app only) for secure, compact "View all" links in SMS search results; search page supports ?q= URL parameter for pre-populated queries.

### External Dependencies
- **Twilio**: For SMS integration, handling incoming webhooks and sending outgoing messages.
- **PostgreSQL with pgvector**: Primary database for persistent storage and vector similarity search.
- **OpenAI**: text-embedding-3-small for 1536-dimensional vector embeddings, and GPT-4o-mini for "Hey Aside" conversational AI.
- **DeepSeek AI**: Used for intelligent message categorization and personalized daily affirmations.
- **Microlink.io**: Primary service for rich link previews and bot protection.
- **TMDB API**: Integrated for enhanced IMDB link previews.
- **Social Media Platforms (Instagram, Pinterest, X/Twitter, Reddit, Facebook, YouTube, TikTok)**: Integrated for rich iframe embeds and link preview parsing.
- **Pendo**: Analytics platform for tracking user behavior and engagement across SMS and web platforms.

### Pendo Analytics Implementation

**Status**: Fully implemented and ready for testing (November 21, 2025)

**Purpose**: Track SMS activity metadata in Pendo visitor profiles to accurately measure user engagement across both SMS and web platforms. Without this, SMS-only users appear "inactive" even if they send 50+ messages per month.

**Implementation Components**:

1. **Real-Time SMS Updates** (server/routes.ts ~line 4956)
   - After each SMS webhook, automatically updates Pendo visitor profile
   - Calculates 20+ metadata fields including SMS activity, engagement level, platform preference
   - Non-blocking async execution to avoid slowing down SMS processing

2. **Daily Cron Job** (server/routes.ts ~line 5433)
   - Runs every day at midnight (0 0 * * *)
   - Updates `daysSinceLastSms` for all users
   - Keeps "last activity" metrics fresh in Pendo

3. **Profile Service** (server/pendo-profile-service.ts)
   - `PendoProfileService`: Centralized service for building visitor metadata
   - Helper functions: `getSMSActivityStats()`, `calculateEngagementLevel()`, `calculatePlatformPreference()`
   - Generates 20+ visitor profile fields for Pendo segmentation

4. **Visitor Profile Fields Sent to Pendo**:
   - **Basic**: phone, firstName, lastName
   - **Signup**: signupDate, signupMethod, daysSinceSignup
   - **SMS Activity**: lastSmsDate, totalSmsMessages, smsMessagesLast7Days, smsMessagesLast30Days, daysSinceLastSms
   - **Web Activity**: daysSinceLastWebVisit
   - **Platform**: primaryPlatform (sms/web/balanced), smsActivityPercentage
   - **Engagement**: engagementLevel (power_user/active/casual/dormant)
   - **Content**: totalBoards, privateBoardCount, sharedBoardCount, hasSharedBoards, hasCreatedBoard, hasJoinedSharedBoard
   - **System**: profileLastUpdated

**Testing & Verification**:

1. **Test Single User** (Admin Panel or API):
   ```
   POST /api/admin/test-pendo-profile
   { "phoneNumber": "+1234567890" }
   ```
   Returns the full metadata being sent to Pendo + success status

2. **Backfill All Users**:
   ```
   POST /api/admin/backfill-pendo-metadata
   ```
   Populates Pendo with historical data for all existing users

3. **Manual Trigger Daily Update**:
   ```
   POST /api/admin/update-sms-activity
   ```
   Updates `daysSinceLastSms` for all users (normally runs via cron)

4. **Real-Time Testing**:
   - Send a test SMS to Twilio number
   - Check logs for `[Pendo]` messages showing profile update
   - Verify Pendo dashboard shows updated visitor profile within 30 seconds

5. **Log Verification**:
   - Look for `✅ [Pendo] Visitor profile updated successfully` in server logs
   - `📊 [Pendo] Built metadata with X fields` shows data generation
   - `📤 Sending Pendo identify for...` shows API call being made
   - `❌ [Pendo]` indicates errors that need investigation

**Pendo Dashboard Verification**:
- Go to Pendo → Visitors → Search for phone number
- Check "Visitor Details" → "Properties" section
- Confirm all SMS metadata fields are populated
- Verify `smsMessagesLast30Days`, `engagementLevel`, `primaryPlatform` match expected values

**Environment Variables Required**:
- `PENDO_TRACK_SECRET_KEY`: Pendo integration key for server-side tracking (already configured)

**Critical Files**:
- `server/pendo-service.ts`: Pendo API integration, identifyVisitor method
- `server/pendo-profile-service.ts`: Metadata calculation logic
- `server/routes.ts`: SMS webhook integration, admin endpoints, cron job

### Automated Testing

**Status**: Fully implemented (November 21, 2025)

**Purpose**: Comprehensive automated testing for all backend API endpoints to ensure reliability, catch regressions early, and maintain code quality.

**Testing Framework**: Vitest + Supertest for fast, modern API testing with TypeScript support

**Test Coverage**:

1. **Authentication Tests** (`server/tests/auth.test.ts`)
   - User registration and verification flow
   - Session management
   - Login/logout functionality
   - Phone number validation
   - Error handling for invalid inputs

2. **Messages Tests** (`server/tests/messages.test.ts`)
   - Fetching user messages
   - Filtering by tags and boards
   - Message updates and deletion
   - Tag retrieval
   - Authentication requirements

3. **Boards Tests** (`server/tests/boards.test.ts`)
   - Board creation and management
   - Joining and leaving shared boards
   - Board ownership validation
   - Input validation
   - Authorization checks

4. **Admin Tests** (`server/tests/admin.test.ts`)
   - User statistics
   - User management
   - Pendo analytics backfill
   - SMS activity updates
   - Post enrichment
   - Feedback and sweepstakes management

**Running Tests**:
```bash
# Run all tests
npx vitest run

# Watch mode (auto-rerun on changes)
npx vitest watch

# Interactive UI dashboard
npx vitest --ui

# Coverage report
npx vitest run --coverage

# Run specific test file
npx vitest run server/tests/auth.test.ts
```

**Test Utilities** (`server/tests/helpers.ts`):
- `generateRandomPhone()`: Creates unique phone numbers for test users
- `loginUser()`: Authenticates a test user and returns session cookie
- `createAuthenticatedAgent()`: Creates authenticated request agent
- Test user fixtures for common scenarios

**Configuration**: 
- `vitest.config.ts`: Main test configuration
- `server/tests/setup.ts`: Global test setup and teardown
- `server/tests/test-app.ts`: Test Express app factory

**Critical Files**:
- `vitest.config.ts`: Test framework configuration
- `server/tests/test-app.ts`: Express app setup for testing
- `server/tests/helpers.ts`: Shared test utilities
- `server/tests/*.test.ts`: Test suites for each API domain