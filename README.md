# Aside - Personal Information Management System

## Claude Code / hosting migration

The current migration handoff is [docs/CLAUDE_CODE_HANDOFF.md](docs/CLAUDE_CODE_HANDOFF.md).
Read it before starting external development or moving production. It includes
safe setup, API dependencies, pending portability work, data transfer and rollback.
Also see [CLAUDE.md](CLAUDE.md), [the API inventory](docs/API_CONNECTIONS.md),
and [.env.example](.env.example). **Preparing these files has not migrated the
live app.** No destination host or cutover has been approved.

A robust SMS and social media content management platform that enables intelligent message categorization, rich media preview, and seamless cross-platform communication with real-time collaboration features.

## 🚀 Features

### Core Functionality
- **SMS Message Management**: Webhook-based message ingestion from SMS providers
- **Smart Categorization**: Automatic hashtag extraction and message organization
- **Rich Social Media Previews**: Embedded content from Instagram, Pinterest, X/Twitter, Reddit, Facebook, YouTube, TikTok, and IMDB
- **Real-time Updates**: WebSocket-powered live message updates
- **Multi-user Authentication**: Phone number-based user verification with secure magic link tokens

### Collaboration Features
- **Shared Boards**: Create collaborative message boards organized by hashtags
- **Member Management**: Invite users to specific boards and view member details
- **Real-time Notifications**: Instant alerts when new messages match shared board hashtags
- **Board Member Viewing**: See phone numbers, roles, join dates, and activity status

### Smart Organization
- **Hashtag Inheritance**: iOS message splitting support with automatic tag propagation
- **Clean Interface**: Hidden hashtag-only messages for categorization without UI clutter
- **Tag Management**: Delete tags with bulk message removal
- **Link Preview Integration**: Social media URLs automatically inherit hashtags from recent messages

### AI-Powered Features
- **Saved-content retrieval**: OpenAI-assisted extraction, embeddings, keyword/semantic search and cited answers from saved content.
- **Older-library indexing**: An optional post-login scan with real progress, indexed/unindexed counts and reasons; photo opt-in and usage limits remain in place.

## 🛠 Technology Stack

- **Frontend**: TypeScript React with Vite, mobile-responsive design
- **Backend**: Node.js Express server
- **Database**: PostgreSQL with Drizzle ORM
- **Real-time**: WebSocket connections
- **SMS Integration**: Twilio webhook handling
- **AI Integration**: OpenAI for saved-content indexing, retrieval and SMS assistance
- **UI Framework**: Tailwind CSS with shadcn/ui components
- **Authentication**: Express sessions with phone number verification and magic link tokens

## 🏗 Architecture

```
├── client/                    # React frontend
│   ├── src/
│   │   ├── components/        # UI components
│   │   │   ├── auth/         # Authentication components
│   │   │   ├── messages/     # Message display and management
│   │   │   ├── shared-boards/ # Collaboration features
│   │   │   └── ui/           # shadcn/ui components
│   │   ├── hooks/            # Custom React hooks
│   │   ├── lib/              # Utilities and API client
│   │   └── pages/            # Route components
├── server/                   # Express backend
│   ├── routes.ts            # API endpoints and webhooks
│   ├── storage.ts           # Database operations
│   ├── websocket.ts         # Real-time connections
│   ├── auth.ts              # Authentication logic
│   └── db.ts                # Database configuration
└── shared/                  # Shared types and schemas
    └── schema.ts            # Drizzle database schema
```

## 🚀 Getting Started

### Prerequisites
- A compatible Node runtime; the observed workspace baseline is 20.20.0. Validate a supported LTS before a new production deployment.
- A disposable Neon-compatible PostgreSQL development database with `pgvector`.
- Isolated provider resources for live integration checks; do not begin with production messaging or AI credentials.

### Environment Variables
Use [.env.example](.env.example), which contains names and blank values only.
Keep real values in an ignored local file or the host's secret manager.
The npm scripts do not automatically load `.env.local`. Follow the
[explicit environment-loading instructions](docs/CLAUDE_CODE_HANDOFF.md#2-reproduce-development-safely).
Preserve the effective existing encryption key for a production restore.

### Installation

## 🌐 Live Demo

Aside is live at: **https://textaside.app**

Try it out by sending SMS messages with hashtags to see the intelligent categorization and social media preview features in action.

## 🚀 Local Development

1. Clone the repository:
```bash
git clone https://github.com/micahharrisjones/context-sms-manager.git
cd context-sms-manager
```

2. Install dependencies:
```bash
npm ci
```

3. Create `.env.local` from `.env.example` and configure only isolated
development resources. Follow the handoff for the database driver, `vector`
extension and schema setup. **Never run `db:push` against production as an
automatic setup step.**

4. Start the development server:
```bash
node --env-file=.env.local --import tsx server/index.ts
```

The current server listens on port 5000 and starts indexing/scheduled work
automatically. Do not start it against production or a production data copy
without reviewed background-work controls.

## 📱 Usage

### SMS Integration
1. Configure Twilio webhook to point to `/api/webhook/twilio`
2. Send SMS messages with hashtags (e.g., "#movies Check out this film!")
3. Messages automatically appear in the web interface organized by hashtags

### Shared Boards
1. Create a shared board for a specific hashtag
2. Invite other users by phone number
3. All members receive real-time notifications when new messages with matching hashtags arrive
4. View board members and their activity through the member management interface

### Social Media Integration
Send SMS messages containing social media links and they'll automatically display rich previews:
- Instagram posts and reels
- Pinterest pins
- Twitter/X posts
- Reddit threads
- Facebook posts
- YouTube videos
- TikTok videos
- IMDB movie pages

## 🎨 Design

Aside features a clean, mobile-responsive design with:
- **Primary Color**: #b95827 (warm orange)
- **Secondary Color**: #263d57 (dark blue)
- **Background**: #fff2ea (soft cream)
- **Mobile-first**: Optimized for phone, tablet, and desktop
- **Real-time UI**: Instant updates without page refreshes
- **Modern Aesthetic**: Subtle drop shadows instead of borders for a clean look

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/login` - Phone number verification
- `POST /api/auth/logout` - End user session
- `GET /api/auth/session` - Check authentication status

### Messages
- `GET /api/messages` - Retrieve user messages
- `DELETE /api/messages/:id` - Delete specific message
- `DELETE /api/tags/:tag` - Delete tag and associated messages

### Shared Boards
- `GET /api/shared-boards` - List user's shared boards
- `POST /api/shared-boards` - Create new shared board
- `POST /api/shared-boards/:boardName/invite` - Invite user to board
- `GET /api/shared-boards/:boardName/members` - View board members
- `GET /api/shared-boards/:boardName/messages` - Get board messages

### Webhooks
- `POST /api/webhook/twilio` - Twilio SMS webhook endpoint

## 🔄 Real-time Features

Aside uses WebSocket connections to provide:
- Live message updates across all connected devices
- Real-time shared board notifications
- Instant UI updates for collaborative features
- User-specific notification filtering

## 📄 License

The package metadata declares the MIT license.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 🙏 Acknowledgments

- Built with modern web technologies and best practices
- Designed for real-world SMS and social media integration
- Optimized for collaborative information management

---

**Aside** - Making personal information management seamless and collaborative.
