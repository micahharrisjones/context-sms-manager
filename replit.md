# Context - Personal Information Management System

### Overview
Context is a robust SMS management platform designed to enable persistent message storage and seamless communication across multiple devices. Its core purpose is to intelligently organize messages and provide advanced integration capabilities. The platform includes a comprehensive set of features such as rich social media embeds, real-time shared boards, and an AI-powered hybrid categorization system. The business vision is to provide a user-friendly, SMS-first solution for saving and organizing information from anywhere, accessible via a web dashboard, with ambitions to expand AI-driven personalization and content understanding.

### User Preferences
- **Design**: #ed2024 primary color, Context branding, mobile-responsive
- **Layout**: Logo in sidebar (far left), search bar and logout button positioned directly under shared boards section within scrollable area
- **Functionality**: No message input form - messages only via SMS webhooks
- **Storage**: Persistent PostgreSQL database for message retention
- **Integration**: Twilio for reliable SMS webhook handling

### System Architecture
The system employs a modern web architecture with a TypeScript React frontend (Vite) and a Node.js Express backend. Data persistence is managed by a PostgreSQL database utilizing Drizzle ORM. Real-time features are powered by WebSocket connections. The platform integrates with Twilio for SMS processing, supporting incoming messages via webhooks and outgoing notifications. A key architectural decision is the "SMS-first" onboarding flow and a content-aware conversational AI that analyzes saved messages for personalized responses. UI/UX design emphasizes a clean, mobile-optimized experience with a warm color scheme (#fff3ea background, #e3cac0 borders) and consistent branding using the Context sunburst logo. Key features include multi-user authentication with phone number verification, user-scoped message storage, smart hashtag inheritance for message organization, comprehensive social media and general URL link previews (Instagram, Pinterest, X/Twitter, Reddit, Facebook, YouTube, TikTok, IMDB), shared board functionality with real-time notifications, and message editing/renaming. The system also includes an admin dashboard for authorized users with management capabilities. AI integration includes DeepSeek for hybrid categorization and daily affirmations.

### External Dependencies
- **Twilio**: For SMS integration, handling incoming webhooks and sending outgoing messages.
- **PostgreSQL**: Primary database for persistent storage.
- **DeepSeek AI**: Used for intelligent message categorization and generating personalized daily affirmations.
- **TMDB API**: Integrated for enhanced IMDB link previews, fetching movie posters, titles, ratings, and release years.
- **Social Media Platforms (Instagram, Pinterest, X/Twitter, Reddit, Facebook, YouTube, TikTok)**: Integrated for rich iframe embeds and link preview parsing.