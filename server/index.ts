import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Configure session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'context-app-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true in production with HTTPS
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  }
}));

// Extend session type to include userId
declare module 'express-session' {
  interface SessionData {
    userId?: number;
  }
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    log("Starting application...");
    
    // Register routes and get the server
    const server = await registerRoutes(app);
    log("Routes registered successfully");

    // Enhanced error handling middleware
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      log(`Error handled: ${status} - ${message}`);
      
      // Don't throw the error in production to prevent crashes
      if (app.get("env") === "development") {
        log("Development mode: throwing error for debugging");
        throw err;
      } else {
        log("Production mode: error logged but not thrown to prevent crash");
      }
      
      res.status(status).json({ message });
    });

    // Setup Vite in development or serve static files in production
    if (app.get("env") === "development") {
      log("Setting up Vite for development...");
      await setupVite(app, server);
      log("Vite setup complete");
    } else {
      log("Setting up static file serving for production...");
      serveStatic(app);
      log("Static file serving setup complete");
    }

    // ALWAYS serve the app on port 5000
    // this serves both the API and the client
    const port = 5000;
    const host = "0.0.0.0";
    
    log(`Attempting to start server on ${host}:${port}...`);
    
    server.listen({
      port,
      host,
      reusePort: true,
    }, () => {
      log(`✓ Server successfully started and listening on ${host}:${port}`);
      log(`✓ Environment: ${app.get("env") || "production"}`);
      log(`✓ Health check available at: http://${host}:${port}/api/health`);
    });

    // Handle server errors
    server.on('error', (error: any) => {
      log(`Server error: ${error.message}`);
      if (error.code === 'EADDRINUSE') {
        log(`Port ${port} is already in use. Retrying in 5 seconds...`);
        setTimeout(() => {
          server.close(() => {
            server.listen({ port, host, reusePort: true });
          });
        }, 5000);
      }
    });

  } catch (error) {
    log(`Critical startup error: ${error instanceof Error ? error.message : String(error)}`);
    log("Stack trace:", error instanceof Error ? error.stack : "No stack trace available");
    
    // In production, attempt graceful degradation instead of immediate exit
    if (process.env.NODE_ENV === "production") {
      log("Production mode: attempting to continue with limited functionality...");
      
      // Set up a minimal health check server
      app.get('/api/health', (req, res) => {
        res.status(503).json({ 
          status: "DEGRADED", 
          error: "Startup error occurred",
          timestamp: new Date().toISOString()
        });
      });
      
      const port = 5000;
      app.listen(port, "0.0.0.0", () => {
        log(`Minimal server started on port ${port} with degraded functionality`);
      });
    } else {
      log("Development mode: exiting due to startup error");
      process.exit(1);
    }
  }
})();
