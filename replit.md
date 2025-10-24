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
The system uses a TypeScript React frontend (Vite) and a Node.js Express backend. Data is stored in PostgreSQL with Drizzle ORM and pgvector for semantic search. Real-time features are powered by WebSockets. Twilio handles SMS processing (incoming via webhooks, outgoing notifications). Key architectural decisions include an "SMS-first" onboarding and a content-aware conversational AI that analyzes saved messages. The UI/UX is clean, mobile-optimized, with a warm color scheme. Features include multi-user authentication with phone verification and magic links, user-scoped message storage, smart hashtag inheritance, comprehensive social media and general URL link previews (Instagram, Pinterest, X/Twitter, Reddit, Facebook, YouTube, TikTok, IMDB via official widgets/embeds), shared board functionality with real-time notifications, and message editing/renaming. An admin dashboard provides management. Squarespace integration API supports professional website signups with instant SMS welcome messages. AI integration includes: "Hey Aside" conversational AI trigger for explicit SMS queries using OpenAI GPT-4o-mini for intent classification (search, summarize, recommend, analyze, login), OpenAI text-embedding-3-small for vector embeddings and hybrid search (70% semantic + 30% keyword), and DeepSeek for hybrid categorization and daily affirmations.

### External Dependencies
- **Twilio**: For SMS integration, handling incoming webhooks and sending outgoing messages.
- **PostgreSQL with pgvector**: Primary database for persistent storage and vector similarity search.
- **OpenAI**: text-embedding-3-small for 1536-dimensional vector embeddings, and GPT-4o-mini for "Hey Aside" conversational AI.
- **DeepSeek AI**: Used for intelligent message categorization and personalized daily affirmations.
- **Microlink.io**: Primary service for rich link previews and bot protection.
- **TMDB API**: Integrated for enhanced IMDB link previews.
- **Social Media Platforms (Instagram, Pinterest, X/Twitter, Reddit, Facebook, YouTube, TikTok)**: Integrated for rich iframe embeds and link preview parsing.