const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const validator = require('validator');
const { AuthService } = require('../saas/auth');

class SecurityMiddleware {
  constructor() {
    this.authService = new AuthService();
  }

  // Enhanced security headers
  helmetConfig() {
    return helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "https:"],
          scriptSrc: ["'self'"],
          connectSrc: ["'self'", "wss:", "https:"],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          manifestSrc: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" }
    });
  }

  // Rate limiting with different tiers
  createRateLimiters() {
    return {
      // General API rate limiting
      api: rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 1000, // Limit each IP to 1000 requests per windowMs
        message: {
          error: 'Too many requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: '15 minutes'
        },
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => {
          return req.user ? `user_${req.user.id}` : req.ip;
        }
      }),

      // Strict rate limiting for auth endpoints
      auth: rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 5, // Limit each IP to 5 auth requests per windowMs
        message: {
          error: 'Too many authentication attempts',
          message: 'Please try again later.',
          retryAfter: '15 minutes'
        },
        skipSuccessfulRequests: true,
        keyGenerator: (req) => req.ip
      }),

      // Chat-specific rate limiting
      chat: rateLimit({
        windowMs: 60 * 1000, // 1 minute
        max: 60, // 60 messages per minute
        message: {
          error: 'Chat rate limit exceeded',
          message: 'Please slow down your messages.',
          retryAfter: '1 minute'
        },
        keyGenerator: (req) => {
          return req.user ? `user_${req.user.id}` : req.ip;
        }
      }),

      // Voice-specific rate limiting
      voice: rateLimit({
        windowMs: 60 * 1000, // 1 minute
        max: 30, // 30 voice requests per minute
        message: {
          error: 'Voice rate limit exceeded',
          message: 'Please wait before making another voice request.',
          retryAfter: '1 minute'
        },
        keyGenerator: (req) => {
          return req.user ? `user_${req.user.id}` : req.ip;
        }
      }),

      // File upload rate limiting
      upload: rateLimit({
        windowMs: 60 * 1000, // 1 minute
        max: 10, // 10 uploads per minute
        message: {
          error: 'Upload rate limit exceeded',
          message: 'Please wait before uploading another file.',
          retryAfter: '1 minute'
        },
        keyGenerator: (req) => {
          return req.user ? `user_${req.user.id}` : req.ip;
        }
      })
    };
  }

  // Input validation middleware
  validateInput(schema) {
    return (req, res, next) => {
      try {
        const { error, value } = schema.validate(req.body);
        
        if (error) {
          return res.status(400).json({
            error: 'Validation error',
            message: 'Invalid input data',
            details: error.details.map(detail => ({
              field: detail.path.join('.'),
              message: detail.message
            }))
          });
        }

        req.validatedBody = value;
        next();
      } catch (err) {
        console.error('Validation middleware error:', err);
        res.status(500).json({
          error: 'Internal server error',
          message: 'Validation failed'
        });
      }
    };
  }

  // Sanitize input data
  sanitizeInput(req, res, next) {
    try {
      if (req.body) {
        req.body = this.sanitizeObject(req.body);
      }
      
      if (req.query) {
        req.query = this.sanitizeObject(req.query);
      }
      
      if (req.params) {
        req.params = this.sanitizeObject(req.params);
      }
      
      next();
    } catch (error) {
      console.error('Input sanitization error:', error);
      res.status(400).json({
        error: 'Invalid input',
        message: 'Input contains invalid characters'
      });
    }
  }

  sanitizeObject(obj) {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    const sanitized = {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        // Remove potentially dangerous characters
        sanitized[key] = validator.escape(value.trim());
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map(item => 
          typeof item === 'string' ? validator.escape(item.trim()) : item
        );
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }

  // CORS configuration
  corsConfig() {
    return {
      origin: (origin, callback) => {
        const allowedOrigins = [
          process.env.FRONTEND_URL,
          'http://localhost:3000',
          'http://localhost:8000'
        ].filter(Boolean);

        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'Cache-Control',
        'Pragma'
      ],
      exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
      maxAge: 86400 // 24 hours
    };
  }

  // Request logging for security
  securityLogger(req, res, next) {
    const startTime = Date.now();
    
    // Log request details
    console.log(`Security Log: ${req.method} ${req.path} - IP: ${req.ip} - User: ${req.user?.id || 'anonymous'}`);
    
    // Log response
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      console.log(`Security Log: ${req.method} ${req.path} - Status: ${res.statusCode} - Duration: ${duration}ms`);
      
      // Log suspicious activities
      if (res.statusCode >= 400) {
        console.warn(`Security Warning: ${req.method} ${req.path} returned ${res.statusCode} for IP: ${req.ip}`);
      }
    });
    
    next();
  }

  // IP blocking middleware
  ipBlocker() {
    const blockedIPs = new Set(); // Would load from database
    
    return (req, res, next) => {
      if (blockedIPs.has(req.ip)) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Access denied'
        });
      }
      
      next();
    };
  }

  // Bot detection
  botDetector(req, res, next) {
    const userAgent = req.get('User-Agent') || '';
    
    // Simple bot detection patterns
    const botPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /curl/i,
      /wget/i
    ];
    
    const isBot = botPatterns.some(pattern => pattern.test(userAgent));
    
    if (isBot && req.path.startsWith('/api/')) {
      console.warn(`Bot detected: ${userAgent} accessing ${req.path}`);
      
      // Allow some bot traffic for health checks
      if (!req.path.includes('/health')) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Bot access not allowed'
        });
      }
    }
    
    next();
  }

  // File upload security
  fileUploadSecurity() {
    return {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
        files: 5 // Maximum 5 files
      },
      fileFilter: (req, file, cb) => {
        // Allowed file types
        const allowedTypes = [
          'image/jpeg',
          'image/png',
          'image/gif',
          'text/plain',
          'application/pdf',
          'application/json'
        ];
        
        if (!allowedTypes.includes(file.mimetype)) {
          return cb(new Error('File type not allowed'), false);
        }
        
        // Check file extension
        const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.txt', '.pdf', '.json'];
        const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
        
        if (!allowedExtensions.includes(fileExtension)) {
          return cb(new Error('File extension not allowed'), false);
        }
        
        cb(null, true);
      },
      // Virus scanning would go here
      onFileUploadStart: (file) => {
        console.log(`File upload started: ${file.originalname}`);
      },
      onFileUploadComplete: (file) => {
        console.log(`File upload completed: ${file.originalname}`);
      }
    };
  }

  // SQL injection protection
  sqlInjectionProtection(req, res, next) {
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi,
      /(--|\/\*|\*\/|;|'|"/gi,
      /\b(OR|AND)\s+\d+\s*=\s*\d+/gi,
      /\b(OR|AND)\s+\w+\s*=\s*\w+/gi
    ];

    const checkForSQLInjection = (obj) => {
      for (const value of Object.values(obj)) {
        if (typeof value === 'string') {
          for (const pattern of sqlPatterns) {
            if (pattern.test(value)) {
              console.warn(`SQL injection attempt detected: ${value}`);
              return true;
            }
          }
        }
      }
      return false;
    };

    if (checkForSQLInjection(req.body) || 
        checkForSQLInjection(req.query) || 
        checkForSQLInjection(req.params)) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Invalid input detected'
      });
    }

    next();
  }

  // XSS protection
  xssProtection(req, res, next) {
    const xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<img[^>]*src[^>]*javascript:/gi
    ];

    const checkForXSS = (obj) => {
      for (const value of Object.values(obj)) {
        if (typeof value === 'string') {
          for (const pattern of xssPatterns) {
            if (pattern.test(value)) {
              console.warn(`XSS attempt detected: ${value}`);
              return true;
            }
          }
        }
      }
      return false;
    };

    if (checkForXSS(req.body) || 
        checkForXSS(req.query) || 
        checkForXSS(req.params)) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Invalid input detected'
      });
    }

    next();
  }

  // Authentication middleware with enhanced security
  authenticateEnhanced() {
    return async (req, res, next) => {
      try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'Access token required'
          });
        }

        // Verify token
        const user = await this.authService.verifyToken(token);
        
        // Check if user is active
        if (user.subscriptionStatus !== 'active') {
          return res.status(403).json({
            error: 'Account inactive',
            message: 'Your account is not active'
          });
        }

        req.user = user;
        next();

      } catch (error) {
        console.error('Authentication error:', error);
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Invalid or expired token'
        });
      }
    };
  }

  // API key validation for external integrations
  validateApiKey(req, res, next) {
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'API key required'
      });
    }

    // Validate API key (would check against database)
    if (!apiKey.startsWith('ak_') || apiKey.length !== 40) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid API key'
      });
    }

    req.apiKey = apiKey;
    next();
  }

  // Comprehensive security middleware
  applySecurity(app) {
    // Apply security headers
    app.use(this.helmetConfig());
    
    // Apply CORS
    const cors = require('cors');
    app.use(cors(this.corsConfig()));
    
    // Apply rate limiting
    const limiters = this.createRateLimiters();
    app.use('/api/auth', limiters.auth);
    app.use('/api/chat', limiters.chat);
    app.use('/api/voice', limiters.voice);
    app.use('/api/upload', limiters.upload);
    app.use('/api/', limiters.api);
    
    // Apply input validation and sanitization
    app.use(this.sanitizeInput);
    app.use(this.sqlInjectionProtection);
    app.use(this.xssProtection);
    
    // Apply security logging
    app.use(this.securityLogger);
    
    // Apply bot detection
    app.use(this.botDetector);
    
    // Apply IP blocking
    app.use(this.ipBlocker());
    
    console.log('Security middleware applied successfully');
  }
}

module.exports = { SecurityMiddleware };
