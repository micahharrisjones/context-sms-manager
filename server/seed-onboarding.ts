import { db } from './db';
import { onboardingMessages } from '@shared/schema';
import { eq } from 'drizzle-orm';

const ONBOARDING_MESSAGES = [
  {
    step: 'welcome',
    title: 'Welcome Message',
    content: `👋 Welcome to Context! This is your space to save any text by sending it here.

Let's try it — send me a text right now, anything you want.`,
    isActive: 'true'
  },
  {
    step: 'first_text',
    title: 'First Text Response', 
    content: `✅ Saved! This text is now in your private space — only you can see it.

Next, let's organize. Try sending a text with a hashtag, like:
#quotes To be, or not to be`,
    isActive: 'true'
  },
  {
    step: 'first_hashtag',
    title: 'First Hashtag Response',
    content: `✨ Perfect! You just created your first board: {firstTag}.
Every time you add #{firstTag} to a text, it'll land there automatically.

Now let's try saving a link — maybe a recipe, an Instagram post, or a movie review. Just paste any link here.`,
    isActive: 'true'
  },
  {
    step: 'first_link',
    title: 'First Link Response',
    content: `🔗 Got it — your link's been saved!
Now let's go see all your texts organized in one place.

👉 {dashboardUrl}`,
    isActive: 'true'
  },
  {
    step: 'completion',
    title: 'Completion Message',
    content: `🎉 You're all set! From now on, just text me anything — links, reminders, ideas — and it'll be saved to your account.

If you ever get stuck or have a question, just text #support followed by your question — I'll help you out.

Welcome to Context — your texts, organized.`,
    isActive: 'true'
  }
];

export async function seedOnboardingMessages(): Promise<void> {
  console.log('Starting onboarding messages seeding...');
  
  try {
    for (const message of ONBOARDING_MESSAGES) {
      // Check if message already exists
      const existing = await db
        .select()
        .from(onboardingMessages)
        .where(eq(onboardingMessages.step, message.step))
        .limit(1);
      
      if (existing.length === 0) {
        // Insert new message
        await db.insert(onboardingMessages).values({
          step: message.step,
          title: message.title,
          content: message.content,
          isActive: message.isActive,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        console.log(`✅ Seeded onboarding message: ${message.step}`);
      } else {
        console.log(`⏭️  Onboarding message already exists: ${message.step}`);
      }
    }
    
    console.log('✨ Onboarding messages seeding completed successfully');
  } catch (error) {
    console.error('❌ Error seeding onboarding messages:', error);
    throw error;
  }
}

// If this file is run directly, execute seeding
if (import.meta.url === `file://${process.argv[1]}`) {
  seedOnboardingMessages()
    .then(() => {
      console.log('Seeding completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seeding failed:', error);
      process.exit(1);
    });
}