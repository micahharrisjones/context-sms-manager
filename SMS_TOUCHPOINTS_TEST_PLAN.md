# SMS Touchpoints Testing Plan

## Overview
This document provides end-to-end testing instructions for all SMS touchpoint messaging updates implemented per the Aside SMS User Touchpoints spreadsheet (November 2025 v1.1).

## Configuration Requirements

### Required Environment Variables
```
S3_ASSET_BASE_URL=https://your-cloudfront-domain.cloudfront.net
# OR
S3_ASSET_BASE_URL=https://your-bucket.s3.us-east-1.amazonaws.com

# Existing variables (should already be set)
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET=...
```

### AWS Infrastructure Required
1. **S3 Bucket Policy**: Public read access on `assets/*` prefix
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadForAssets",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::your-bucket-name/assets/*"
    }
  ]
}
```

2. **Optional**: CloudFront distribution for better performance and caching

## Test Cases

### 1. QR Code Request (Task 1 & 5)
**Trigger**: Text "QR", "QR code", "send QR code", or "QR please" to Aside number

**Expected Behavior**:
- System detects QR keyword (substring match)
- Sends MMS with QR code image (no text message)
- Uses permanent S3 URL if `S3_ASSET_BASE_URL` configured
- Falls back to 7-day signed URL with warning log if not configured
- Pendo event tracked: `QR_Code_Requested`

**Verification**:
- [ ] Receive MMS with QR code PNG
- [ ] No accompanying text message
- [ ] Check logs for permanent URL generation (or fallback warning)
- [ ] Verify MMS arrives within 10 seconds

---

### 2. Welcome Message (Task 2)
**Trigger**: New user completes phone verification

**Expected Message**:
```
Welcome to Aside! 🎉 Your personal SMS assistant for saving anything worth remembering.

Just text us:
• Content + #tag to save it
• #tag to view saved items
• Hey Aside + any question to search with AI

Got feedback or ideas? We'd love to hear from you: textaside.app/feedback

Ready to explore? Here's your dashboard: [magic_link]
```

**Verification**:
- [ ] Feedback link included: `textaside.app/feedback`
- [ ] Magic link generated and included
- [ ] Exact wording matches spreadsheet
- [ ] Message arrives within 30 seconds of verification

---

### 3. Verification Code (Task 3)
**Trigger**: User requests login via phone number

**Expected Message**:
```
You're so close! Your Aside verification code is: [6-digit-code]. This code expires in 10 minutes. Don't share this code with anyone, promise?
```

**Verification**:
- [ ] Single-line format (no extra blank lines)
- [ ] 6-digit verification code included
- [ ] Exact wording matches spreadsheet
- [ ] Code expires after 10 minutes
- [ ] Message arrives within 10 seconds

---

### 4. SMS Invite Workflow (Task 4)
**Trigger**: User texts "invite" or "invite friend"

**Expected Behavior**:
- Message 1 (immediate):
```
Perfect! We're creating your personalized invite link...
```

- Message 2 (500ms delay):
```
Share Aside with friends: textaside.app/i/[invite_code]

Your friend gets access, you help us grow. Win-win! ✨
```

**Verification**:
- [ ] Two separate SMS messages received
- [ ] 500ms delay between messages
- [ ] Invite code is unique and trackable
- [ ] Link format: `textaside.app/i/[code]`
- [ ] Pendo event tracked: invite link sent

---

### 5. Shared Board Invitation - Existing Users (Task 6)
**Trigger**: User A invites User B to shared board #recipes

**Expected Message** (to User B if they're an existing Aside user):
```
[FirstName LastName] invited you to collaborate on #recipes!

You're all set - just text us with #recipes to start adding and viewing posts together.

View the board now: [magic_link_to_board]
```

**Verification**:
- [ ] Inviter's full name included
- [ ] Board name (#recipes) mentioned twice
- [ ] Magic link directs to specific board
- [ ] Only sent if invitee is existing user
- [ ] Message arrives within 10 seconds

---

### 6. General Help Request (Task 7)
**Trigger**: User texts "help", "how does this work", or similar

**Expected Message**:
```
Hey! Here's how Aside works:

💡 Save anything: Text us content + #hashtag
📂 Find it later: Text us the #hashtag
🔍 AI search: "Hey Aside, find my pasta recipes"
👥 Share boards: Collaborate on hashtags with friends

Need more? Text "Hey Aside" + your question, or visit textaside.app

What would you like to save first?
```

**Verification**:
- [ ] Exact wording matches spreadsheet
- [ ] Friendly, brand-aligned tone
- [ ] Includes textaside.app link
- [ ] Message arrives within 10 seconds

---

### 7. "Hey Aside" Specific Help Questions (Task 8)
**Trigger**: User texts "Hey Aside, how do I create a board?" or similar specific questions

**Supported Questions**:
1. "How does Aside work?"
2. "How do I create a board/tag?"
3. "How do I invite friends?"
4. "What is my dashboard link?"
5. "How do I search?"
6. "Can I edit messages?"
7. "How do I delete?"
8. "What are shared boards?"
9. "Is my data private?"
10. "Can I use Aside on desktop?"
11. General help fallback

**Example Response** (for "What is my dashboard link?"):
```
Your personal Aside dashboard: [magic_link]

Access all your saved content, search with AI, and manage shared boards - right from your browser!
```

**Verification**:
- [ ] Intent correctly classified by AI
- [ ] Deterministic template response (not AI-generated)
- [ ] Dynamic data inserted correctly (magic links, board lists, etc.)
- [ ] Fallback to general help for unmatched questions

---

### 8. Feedback Reminders (Task 9)
**Trigger**: Admin calls `/api/admin/send-feedback-reminders` endpoint

**Expected Behavior**:
- Finds users at 1, 3, and 6-month anniversaries (±3 day window)
- Only sends to "active" users (sent/received message in last 30 days)
- Doesn't resend to users who already received that milestone reminder

**Expected Messages**:

1-Month:
```
🎉 It's our one-month anniversary! Time flies, right?

Got feedback, ideas, or things we could do better? We'd love to hear from you: textaside.app/feedback
```

3-Month:
```
🎉 It's our three-month anniversary! Can you believe it?

Got feedback, ideas, or things we could do better? We'd love to hear from you: textaside.app/feedback
```

6-Month:
```
🎉 It's our six-month anniversary! Remember when we first met?

Got feedback, ideas, or things we could do better? We'd love to hear from you: textaside.app/feedback
```

**Verification**:
- [ ] Admin endpoint requires admin authentication
- [ ] Only sends to eligible users (date window, activity, not already sent)
- [ ] 1.1-second delay between sends (Twilio rate limiting)
- [ ] Timestamps recorded in database after sending
- [ ] Returns summary with sent/failed counts
- [ ] Exact wording matches spreadsheet

**Manual Test**:
```bash
# As admin user
curl -X POST https://your-app.replit.dev/api/admin/send-feedback-reminders \
  -H "Cookie: connect.sid=your_admin_session_cookie"
```

---

## Logging & Monitoring

### Key Log Messages to Watch
- `[S3] ⚠️ WARNING: S3_ASSET_BASE_URL not configured!` - Permanent URL fallback active
- `📷 Detected QR code request` - QR keyword matched
- `Generated QR code URL` - URL generated successfully
- `Sent QR code MMS` - MMS sent
- `Detected help request` - Help system triggered
- `Sent help response` - Help message delivered
- `📅 Admin triggering feedback reminder job` - Feedback job started
- `✅ Feedback reminder job completed` - Feedback job finished

### Pendo Events to Verify
1. `QR_Code_Requested` - When QR code is sent
2. `invite_link_sent` - When invite URL is sent
3. Standard message tracking events

---

## Configuration Validation

### Check S3_ASSET_BASE_URL Setup
```bash
# 1. Verify environment variable is set
echo $S3_ASSET_BASE_URL

# 2. Check bucket policy allows public read on assets/*
aws s3api get-bucket-policy --bucket your-bucket-name

# 3. Test direct access to QR code
curl -I $S3_ASSET_BASE_URL/assets/aside-qr-code.png
# Should return HTTP 200, not 403
```

### Verify Database Schema
```sql
-- Check users table has feedback reminder columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND column_name LIKE 'feedback_reminder%';

-- Expected:
-- feedback_reminder_1_month | timestamp without time zone
-- feedback_reminder_3_months | timestamp without time zone  
-- feedback_reminder_6_months | timestamp without time zone
```

---

## Rollback Plan

If any touchpoint fails in production:

### Immediate Actions
1. Check workflow logs for errors
2. Verify Twilio balance and credentials
3. Check S3 configuration and permissions
4. Review database connection

### Emergency Disable
If a specific touchpoint is causing issues:

1. **QR Code**: Comment out lines 1095-1131 in `server/routes.ts`
2. **Feedback Reminders**: Stop calling admin endpoint
3. **Help System**: Comment out lines 1133-1150 in `server/routes.ts`

---

## Success Criteria

All touchpoints are considered successfully tested when:

- [ ] All 8 test cases pass end-to-end
- [ ] Messages match spreadsheet exactly (word-for-word)
- [ ] Timing requirements met (<10s for most, <30s for welcome)
- [ ] Pendo events tracked correctly
- [ ] S3_ASSET_BASE_URL configured and working (no fallback warnings)
- [ ] Database schema updated with feedback reminder columns
- [ ] Admin endpoint requires authentication
- [ ] Logs show expected behavior for each touchpoint
- [ ] No errors in workflow logs

---

## Notes for DevOps

1. **S3_ASSET_BASE_URL**: Must be set before production deployment
2. **Bucket Policy**: Apply public read on `assets/*` before go-live
3. **Monitoring**: Set up alerts for:
   - S3_ASSET_BASE_URL fallback warnings
   - Failed SMS sends
   - Feedback reminder job failures
4. **Cron Job** (future): Schedule `/api/admin/send-feedback-reminders` to run daily

---

## Additional Resources

- SMS Touchpoints Spreadsheet: `attached_assets/Aside - SMS User Touchpoints - November_2025_v1_1762820913759.csv`
- Feedback Reminder Service: `server/feedback-reminder-service.ts`
- S3 Asset URL Helper: `server/s3-service.ts` (`getPublicAssetUrl()`)
- Main Webhook Handler: `server/routes.ts` (lines 900-1200)
