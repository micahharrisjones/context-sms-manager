import mixpanel from 'mixpanel-browser';

// Initialize Mixpanel
const MIXPANEL_TOKEN = import.meta.env.VITE_MIXPANEL_TOKEN;

if (MIXPANEL_TOKEN) {
  mixpanel.init(MIXPANEL_TOKEN, {
    debug: import.meta.env.DEV, // Enable debug mode in development
    track_pageview: true,
    persistence: 'localStorage',
  });
} else {
  console.warn('Mixpanel token not found. Analytics will not be tracked.');
}

// Hash phone number for privacy (client-side)
const hashPhoneNumber = async (phoneNumber: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(phoneNumber);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// Wrapper functions for cleaner usage
export const analytics = {
  // Track events
  track: (eventName: string, properties?: Record<string, any>) => {
    if (MIXPANEL_TOKEN) {
      mixpanel.track(eventName, properties);
    }
  },

  // Identify users
  identify: (userId: string) => {
    if (MIXPANEL_TOKEN) {
      mixpanel.identify(userId);
    }
  },

  // Set user properties with phone hashing
  setUserProperties: async (properties: Record<string, any>) => {
    if (MIXPANEL_TOKEN) {
      const sanitizedProperties = { ...properties };
      if (sanitizedProperties.phone_number && typeof sanitizedProperties.phone_number === 'string') {
        // Keep last 4 digits separate and hash the full number
        const phoneNumber = sanitizedProperties.phone_number;
        if (phoneNumber.length > 4) {
          sanitizedProperties.phone_last4 = phoneNumber.slice(-4);
          sanitizedProperties.phone_number = await hashPhoneNumber(phoneNumber);
        }
      }
      mixpanel.people.set(sanitizedProperties);
    }
  },

  // Track page views
  trackPageView: (pageName: string, properties?: Record<string, any>) => {
    if (MIXPANEL_TOKEN) {
      mixpanel.track('Page View', {
        page: pageName,
        ...properties
      });
    }
  },

  // Reset user (for logout)
  reset: () => {
    if (MIXPANEL_TOKEN) {
      mixpanel.reset();
    }
  }
};

export default analytics;