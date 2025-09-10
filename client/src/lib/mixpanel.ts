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

  // Set user properties
  setUserProperties: (properties: Record<string, any>) => {
    if (MIXPANEL_TOKEN) {
      mixpanel.people.set(properties);
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