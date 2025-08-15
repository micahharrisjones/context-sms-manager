# Context SMS Signup Guide

## How SMS Signup Works

Context offers **completely frictionless signup via SMS** - no forms, no verification codes, no app downloads required. Here's how it works:

### For New Users

1. **Just text our number**: +1 (612) 208-7851
2. **Include hashtags** to organize your message (e.g., "#movies", "#recipes", "#work")
3. **Account created automatically** - we'll create your account in the background
4. **Get welcome message** with instructions and tips
5. **Access web dashboard** by logging in with your phone number

### Example First Messages

```
"Check out this amazing recipe #recipes https://example.com/recipe"
```

```
"Meeting notes from today #work Remember to follow up on the Johnson proposal"
```

```
"Found this great movie #entertainment https://imdb.com/title/tt123456"
```

## What Happens Next

1. **Automatic Account Creation**: We create a user account linked to your phone number
2. **Welcome SMS**: You'll receive a welcome message explaining how Context works
3. **Message Organization**: Your message is automatically categorized using the hashtags
4. **Web Access**: Visit the web app and log in with your phone number to see all your messages

## Key Features

### Rich Link Previews
- **Social Media**: Instagram, Pinterest, Twitter/X, Reddit, Facebook, YouTube, TikTok
- **Movies**: IMDB links get movie posters, ratings, and details
- **General URLs**: Automatic title and description extraction

### Smart Organization
- **Hashtag Inheritance**: URLs without hashtags inherit tags from recent messages
- **Clean Interface**: Hashtag-only messages are hidden from the UI but still used for categorization
- **Multi-board Support**: Messages can belong to multiple categories

### Collaboration
- **Shared Boards**: Invite others to specific hashtag categories
- **Real-time Notifications**: Get notified instantly when someone adds to your shared boards
- **SMS Alerts**: Receive text messages when new content is added to boards you're following

## User Experience

### Immediate Benefits
- ✅ **No app installation required**
- ✅ **Works on any phone** (smartphone or basic phone)
- ✅ **Instant account creation**
- ✅ **Immediate message organization**
- ✅ **Rich content previews**

### Long-term Value
- 📱 **All messages searchable** via web interface
- 🔗 **Beautiful link previews** for shared content
- 👥 **Collaborative boards** with team members
- 🔔 **Real-time notifications** across devices
- 📊 **Personal knowledge base** built from SMS history

## Technical Implementation

### Webhook Processing
- Twilio webhook receives incoming SMS
- Automatic user account creation for new phone numbers
- Message parsing and hashtag extraction
- Real-time WebSocket notifications to web users

### Security & Privacy
- Phone number-based authentication (no passwords)
- User-scoped message storage (only see your own messages)
- Secure session management
- Board-level permissions for sharing

### Smart Features
- **Tag Inheritance**: URLs inherit hashtags from recent messages (within 5 minutes)
- **iOS Message Splitting**: Handles when iOS breaks long messages into parts
- **Duplicate Prevention**: Smart handling of multi-part messages
- **Media Support**: Images and files sent via SMS are preserved

## Getting Started

1. **Text +1 (612) 208-7851** with any message containing hashtags
2. **Receive welcome message** with detailed instructions
3. **Visit web dashboard** and log in with your phone number
4. **Start organizing** your digital life via SMS!

No credit card, no email, no verification codes - just text and start organizing!