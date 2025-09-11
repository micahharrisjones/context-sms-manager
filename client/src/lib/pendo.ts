// Pendo Analytics Integration
// Application ID: 0eccd063-f33a-46ee-b460-d959ff2d0d20

interface PendoVisitor {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  [key: string]: any; // Allow additional custom properties
}

interface PendoAccount {
  id: string;
  accountName?: string;
  payingStatus?: string;
  planType?: string;
  [key: string]: any; // Allow additional custom properties
}

interface PendoOptions {
  visitor: PendoVisitor;
  account?: PendoAccount;
}

interface PendoAgent {
  initialize: (options: PendoOptions) => void;
  identify: (options: PendoOptions) => void;
  track: (eventName: string, metadata?: Record<string, any>) => void;
  isReady: () => boolean;
  pageLoad: (url?: string) => void;
  clearVisitor?: () => void;
  updateOptions: (options: Partial<PendoOptions>) => void;
  _q: any[];
}

declare global {
  interface Window {
    pendo: PendoAgent;
  }
}

const MAX_RETRY_ATTEMPTS = 10;
const RETRY_DELAY_MS = 100;
const MAX_WAIT_TIME_MS = 5000;

class PendoService {
  private static instance: PendoService;
  private initialized = false;
  private currentUser: any = null;
  private initializationPromise: Promise<void> | null = null;

  public static getInstance(): PendoService {
    if (!PendoService.instance) {
      PendoService.instance = new PendoService();
    }
    return PendoService.instance;
  }

  private constructor() {
    // Pendo script is now loaded via HTML head, no need for dynamic loading
  }

  private async waitForPendo(): Promise<boolean> {
    return new Promise((resolve) => {
      let attempts = 0;
      const startTime = Date.now();
      
      const checkPendo = () => {
        attempts++;
        
        // Check if max time elapsed
        if (Date.now() - startTime > MAX_WAIT_TIME_MS) {
          console.warn('Pendo failed to load within timeout period');
          resolve(false);
          return;
        }
        
        // Check if max attempts reached
        if (attempts > MAX_RETRY_ATTEMPTS) {
          console.warn('Pendo failed to load after maximum retry attempts');
          resolve(false);
          return;
        }
        
        // Check if Pendo is available and ready
        if (window.pendo && typeof window.pendo.initialize === 'function') {
          try {
            // Additional check to see if agent is ready
            if (window.pendo.isReady && window.pendo.isReady()) {
              resolve(true);
              return;
            }
          } catch (error) {
            console.warn('Error checking Pendo readiness:', error);
          }
        }
        
        // Retry after delay
        setTimeout(checkPendo, RETRY_DELAY_MS);
      };
      
      checkPendo();
    });
  }

  private createPendoOptions(user: any): PendoOptions {
    return {
      visitor: {
        id: user.id.toString(),
        email: user.email || undefined,
        firstName: user.displayName?.split(' ')[0] || undefined,
        lastName: user.displayName?.split(' ').slice(1).join(' ') || undefined,
        phoneNumber: user.phoneNumber || undefined,
        // Add custom properties
        hasDisplayName: !!user.displayName,
        hasEmail: !!user.email,
        accountCreatedAt: user.createdAt || new Date().toISOString(),
      },
      account: {
        id: 'context-app',
        accountName: 'Context SMS Platform',
        payingStatus: 'active', // This could be dynamic based on user subscription
        planType: 'standard', // This could be dynamic
      }
    };
  }

  public async initialize(user: any): Promise<boolean> {
    // Prevent multiple simultaneous initializations
    if (this.initializationPromise) {
      return this.initializationPromise.then(() => this.initialized);
    }
    
    // If already initialized with same user, just identify
    if (this.initialized && this.currentUser?.id === user.id) {
      return this.identifyUser(user);
    }
    
    this.initializationPromise = this.performInitialization(user);
    return this.initializationPromise.then(() => this.initialized);
  }
  
  private async performInitialization(user: any): Promise<void> {
    try {
      const pendoReady = await this.waitForPendo();
      
      if (!pendoReady) {
        console.error('Pendo failed to load properly');
        return;
      }
      
      const pendoOptions = this.createPendoOptions(user);
      
      if (this.initialized) {
        // If already initialized but with different user, identify the new user
        window.pendo.identify(pendoOptions);
        console.log('Pendo user switched to:', user.id);
      } else {
        // First time initialization
        window.pendo.initialize(pendoOptions);
        this.initialized = true;
        console.log('Pendo initialized for user:', user.id);
      }
      
      this.currentUser = user;
      
      // Track page load for SPA
      this.pageLoad();
      
    } catch (error) {
      console.error('Pendo initialization failed:', error);
    } finally {
      this.initializationPromise = null;
    }
  }

  public async identifyUser(user: any): Promise<boolean> {
    try {
      const pendoReady = await this.waitForPendo();
      
      if (!pendoReady) {
        console.warn('Pendo not available for user identification');
        return false;
      }
      
      const pendoOptions = this.createPendoOptions(user);
      window.pendo.identify(pendoOptions);
      this.currentUser = user;
      
      console.log('Pendo user identified:', user.id);
      return true;
      
    } catch (error) {
      console.error('Pendo user identification failed:', error);
      return false;
    }
  }

  public async track(eventName: string, metadata?: Record<string, any>): Promise<boolean> {
    try {
      const pendoReady = await this.waitForPendo();
      
      if (!pendoReady) {
        console.warn('Pendo not available for tracking event:', eventName);
        return false;
      }
      
      const enrichedMetadata = {
        ...metadata,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userId: this.currentUser?.id,
      };
      
      window.pendo.track(eventName, enrichedMetadata);
      console.log('Pendo event tracked:', eventName, enrichedMetadata);
      return true;
      
    } catch (error) {
      console.error('Pendo event tracking failed:', error);
      return false;
    }
  }
  
  public pageLoad(url?: string): void {
    try {
      if (!window.pendo || typeof window.pendo.pageLoad !== 'function') {
        console.warn('Pendo pageLoad not available');
        return;
      }
      
      window.pendo.pageLoad(url || window.location.href);
      console.log('Pendo page load tracked:', url || window.location.href);
      
    } catch (error) {
      console.error('Pendo pageLoad failed:', error);
    }
  }
  
  public async clearVisitor(): Promise<void> {
    try {
      const pendoReady = await this.waitForPendo();
      
      if (!pendoReady) {
        console.warn('Pendo not available for clearing visitor');
        return;
      }
      
      if (window.pendo.clearVisitor && typeof window.pendo.clearVisitor === 'function') {
        window.pendo.clearVisitor();
      }
      
      this.currentUser = null;
      console.log('Pendo visitor cleared');
      
    } catch (error) {
      console.error('Pendo visitor clear failed:', error);
    }
  }
  
  public reset(): void {
    // Clear visitor data and reset state
    this.clearVisitor();
    this.initialized = false;
    this.currentUser = null;
    this.initializationPromise = null;
    console.log('Pendo session reset');
  }
  
  public isInitialized(): boolean {
    return this.initialized;
  }
  
  public getCurrentUser(): any {
    return this.currentUser;
  }
}

export const pendo = PendoService.getInstance();

// Export types for use in other modules
export type { PendoVisitor, PendoAccount, PendoOptions };