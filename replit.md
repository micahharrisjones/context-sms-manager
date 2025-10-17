# Aside - Personal Information Management System

### Overview
Aside is an SMS management platform designed for persistent message storage and seamless communication across multiple devices. Its core purpose is to intelligently organize messages and provide advanced integration capabilities, including rich social media embeds, real-time shared boards, and an AI-powered hybrid categorization system. The business vision is to provide a user-friendly, SMS-first solution for saving and organizing information from anywhere, accessible via a web dashboard at textaside.app, with ambitions to expand AI-driven personalization and content understanding.

### User Preferences
- **Design**: #b95827 primary color (orange), #263d57 secondary (dark blue), #fff2ea background, Aside branding, mobile-responsive
- **Layout**: Logo in sidebar (far left), search bar and logout button positioned directly under shared boards section within scrollable area
- **Functionality**: No message input form - messages only via SMS webhooks
- **Storage**: Persistent PostgreSQL database for message retention
- **Integration**: Twilio for reliable SMS webhook handling

### System Architecture
The system utilizes a modern web architecture with a TypeScript React frontend (Vite) and a Node.js Express backend. Data persistence is managed by a PostgreSQL database with Drizzle ORM and pgvector for semantic search. Real-time features are powered by WebSockets. The platform integrates with Twilio for SMS processing, supporting incoming messages via webhooks and outgoing notifications. Key architectural decisions include an "SMS-first" onboarding flow and a content-aware conversational AI that analyzes saved messages. UI/UX design emphasizes a clean, mobile-optimized experience with a warm color scheme and consistent branding. Features include multi-user authentication with phone number verification and magic link tokens, user-scoped message storage, smart hashtag inheritance, comprehensive social media and general URL link previews (Instagram, Pinterest, X/Twitter, Reddit, Facebook, YouTube, TikTok, IMDB), shared board functionality with real-time notifications, and message editing/renaming. An admin dashboard provides management capabilities. The system also includes a Squarespace integration API for professional website signups with instant SMS welcome messages. AI integration uses OpenAI text-embedding-3-small for vector embeddings and hybrid search (70% semantic + 30% keyword), and DeepSeek for hybrid categorization and daily affirmations. A homescreen search bar serves as the primary web discovery interface, complemented by SMS search functionality.

### External Dependencies
- **Twilio**: For SMS integration, handling incoming webhooks and sending outgoing messages.
- **PostgreSQL with pgvector**: Primary database for persistent storage and vector similarity search.
- **OpenAI**: text-embedding-3-small model for generating 1536-dimensional vector embeddings for semantic search.
- **DeepSeek AI**: Used for intelligent message categorization and generating personalized daily affirmations.
- **Microlink.io**: Primary service for generating rich link previews and handling bot protection on e-commerce sites.
- **TMDB API**: Integrated for enhanced IMDB link previews.
- **Social Media Platforms (Instagram, Pinterest, X/Twitter, Reddit, Facebook, YouTube, TikTok)**: Integrated for rich iframe embeds and link preview parsing.