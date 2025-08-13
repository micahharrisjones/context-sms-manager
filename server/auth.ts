import { Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { log } from "./vite";

// Generate a 6-digit verification code
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// SMS code verification middleware
export function generateTwilioResponse(message: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Message>${message}</Message>
    </Response>`;
}

// Phone number authentication service
export class AuthService {
  // Send verification code via SMS (using Twilio webhook response)
  static async initializeVerification(phoneNumber: string): Promise<string> {
    try {
      // Clean phone number (remove any formatting)
      const cleanPhoneNumber = phoneNumber.replace(/\D/g, '');
      
      // Generate 6-digit code
      const verificationCode = generateVerificationCode();
      
      // Create auth session (expires in 10 minutes)
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      
      await storage.createAuthSession({
        phoneNumber: cleanPhoneNumber,
        verificationCode,
        expiresAt,
        verified: "false"
      });
      
      log(`Generated verification code ${verificationCode} for phone ${cleanPhoneNumber}`);
      
      // Return the verification code to send via SMS
      return verificationCode;
    } catch (error) {
      log("Error initializing verification:", error);
      throw error;
    }
  }
  
  // Verify code and authenticate user
  static async verifyAndAuthenticate(phoneNumber: string, code: string): Promise<{ success: boolean; user?: any; message: string }> {
    try {
      const cleanPhoneNumber = phoneNumber.replace(/\D/g, '');
      
      // Check if verification code is valid
      const session = await storage.getValidAuthSession(cleanPhoneNumber, code);
      
      if (!session) {
        return {
          success: false,
          message: "Invalid or expired verification code"
        };
      }
      
      // Mark session as verified
      await storage.markSessionAsVerified(session.id);
      
      // Get or create user
      let user = await storage.getUserByPhoneNumber(cleanPhoneNumber);
      
      if (!user) {
        // Create new user
        user = await storage.createUser({
          phoneNumber: cleanPhoneNumber,
          displayName: `User ${cleanPhoneNumber.slice(-4)}` // Default display name
        });
        log(`Created new user for phone ${cleanPhoneNumber}`);
      } else {
        // Update last login
        await storage.updateUserLastLogin(user.id);
        log(`Updated last login for user ${user.id}`);
      }
      
      return {
        success: true,
        user,
        message: "Authentication successful"
      };
    } catch (error) {
      log("Error verifying authentication:", error);
      return {
        success: false,
        message: "Authentication error"
      };
    }
  }
}

// Middleware to check if user is authenticated
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.session?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    // Add userId to request for easy access
    req.userId = userId;
    next();
  } catch (error) {
    log("Auth middleware error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Extend Express Request type to include userId
declare global {
  namespace Express {
    interface Request {
      userId?: number;
    }
  }
}