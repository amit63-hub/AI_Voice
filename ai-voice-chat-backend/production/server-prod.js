require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const morgan = require('morgan');
const { AIAgent } = require('../ai-system/agent');
const { ProductionDatabase } = require('./database-prod');
const { VoiceServer } = require('../voice-system/voice-server');

class ProductionServer {
  constructor() {
    this.app = express();
    this.db = new ProductionDatabase();
    this.aiAgent = new AIAgent();
    this.voiceServer = new VoiceServer();
    this.port = process.env.PORT || 4000;
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  setupMiddleware() {
    // Security
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "https:"],
          scriptSrc: ["'self'"],
          connectSrc: ["'self'", "wss:", "https:"],
        },
      },
    }));

    // CORS
    this.app.use(cors({
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }));

    // Compression
    this.app.use(compression());

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: process.env.NODE_ENV === 'production' ? 100 : 1000, // Limit each IP
      message: {
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.'
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use('/api/', limiter);

    // Logging
    this.app.use(morgan('combined'));

    // Request timing
    this.app.use((req, res, next) => {
      req.startTime = Date.now();
      next();
    });
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', async (req, res) => {
      try {
        const dbHealth = await this.db.healthCheck();
        res.json({
          status: 'ok',
          timestamp: new Date().toISOString(),
          database: dbHealth,
          uptime: process.uptime(),
          memory: process.memoryUsage()
        });
      } catch (error) {
        res.status(500).json({
          status: 'error',
          message: 'Health check failed',
          timestamp: new Date().toISOString()
        });
      }
    });

    // API Routes
    this.app.use('/api', this.createApiRouter());
    
    // Serve static files for production
    if (process.env.NODE_ENV === 'production') {
      this.app.use(express.static('public'));
    }

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Not found',
        message: 'Endpoint not found',
        path: req.originalUrl
      });
    });
  }

  createApiRouter() {
    const router = express.Router();

    // Authentication middleware
    const authenticateToken = async (req, res, next) => {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];

      if (!token) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Access token required'
        });
      }

      try {
        // Verify JWT token (implement JWT verification)
        const user = await this.verifyToken(token);
        req.user = user;
        next();
      } catch (error) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Invalid or expired token'
        });
      }
    };

    // Chat endpoint
    router.post('/chat', authenticateToken, async (req, res) => {
      const startTime = req.startTime;
      
      try {
        const { message, conversationId } = req.body;
        const userId = req.user.id;

        if (!message) {
          return res.status(400).json({
            error: 'Bad request',
            message: 'Message is required'
          });
        }

        // Check user's API limits
        const user = await this.db.getUser(userId);
        if (user.api_usage_count >= user.api_usage_limit) {
          return res.status(429).json({
            error: 'Rate limit exceeded',
            message: 'API usage limit exceeded. Please upgrade your plan.'
          });
        }

        // Get or create conversation
        let conversation;
        if (conversationId) {
          conversation = await this.db.getConversation(conversationId);
        } else {
          conversation = await this.db.createConversation(userId, 'New Chat');
        }

        // Save user message
        await this.db.saveMessage(conversation.id, 'user', message);

        // Process with AI
        const aiResponse = await this.aiAgent.processMessage(userId, message, {
          conversationId: conversation.id,
          mode: 'chat'
        });

        // Save AI response
        await this.db.saveMessage(conversation.id, 'assistant', aiResponse.content, {
          intent: aiResponse.intent,
          confidence: aiResponse.confidence
        });

        // Track API usage
        const responseTime = Date.now() - startTime;
        await this.db.trackApiUsage({
          userId,
          endpoint: '/api/chat',
          method: 'POST',
          statusCode: 200,
          responseTime,
          tokensUsed: aiResponse.tokensUsed || 0,
          cost: aiResponse.cost || 0
        });

        res.json({
          success: true,
          response: aiResponse.content,
          conversationId: conversation.id,
          metadata: {
            intent: aiResponse.intent,
            confidence: aiResponse.confidence,
            responseTime
          }
        });

      } catch (error) {
        console.error('Chat error:', error);
        
        // Track error usage
        const responseTime = Date.now() - startTime;
        await this.db.trackApiUsage({
          userId: req.user.id,
          endpoint: '/api/chat',
          method: 'POST',
          statusCode: 500,
          responseTime
        });

        res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to process chat message'
        });
      }
    });

    // Get conversations
    router.get('/conversations', authenticateToken, async (req, res) => {
      try {
        const { limit = 20, offset = 0 } = req.query;
        const conversations = await this.db.getConversations(
          req.user.id,
          parseInt(limit),
          parseInt(offset)
        );

        res.json({
          success: true,
          conversations,
          pagination: {
            limit: parseInt(limit),
            offset: parseInt(offset),
            total: conversations.length
          }
        });
      } catch (error) {
        console.error('Get conversations error:', error);
        res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to fetch conversations'
        });
      }
    });

    // Get conversation messages
    router.get('/conversations/:id/messages', authenticateToken, async (req, res) => {
      try {
        const { id } = req.params;
        const { limit = 100 } = req.query;

        // Verify conversation belongs to user
        const conversation = await this.db.getConversation(id);
        if (!conversation || conversation.user_id !== req.user.id) {
          return res.status(404).json({
            error: 'Not found',
            message: 'Conversation not found'
          });
        }

        const messages = await this.db.getMessages(id, parseInt(limit));

        res.json({
          success: true,
          messages
        });
      } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to fetch messages'
        });
      }
    });

    // User profile
    router.get('/profile', authenticateToken, async (req, res) => {
      try {
        const user = await this.db.getUser(req.user.id);
        if (!user) {
          return res.status(404).json({
            error: 'Not found',
            message: 'User not found'
          });
        }

        res.json({
          success: true,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            subscriptionPlan: user.subscription_plan,
            apiUsage: {
              used: user.api_usage_count,
              limit: user.api_usage_limit,
              remaining: user.api_usage_limit - user.api_usage_count
            },
            preferences: user.preferences
          }
        });
      } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to fetch profile'
        });
      }
    });

    // Update user preferences
    router.put('/preferences', authenticateToken, async (req, res) => {
      try {
        const { preferences } = req.body;
        
        const updatedUser = await this.db.updateUser(req.user.id, {
          preferences: preferences
        });

        res.json({
          success: true,
          preferences: updatedUser.preferences
        });
      } catch (error) {
        console.error('Update preferences error:', error);
        res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to update preferences'
        });
      }
    });

    // Memory operations
    router.get('/memories', authenticateToken, async (req, res) => {
      try {
        const { type, limit = 50 } = req.query;
        const memories = await this.db.getMemories(req.user.id, type, parseInt(limit));

        res.json({
          success: true,
          memories
        });
      } catch (error) {
        console.error('Get memories error:', error);
        res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to fetch memories'
        });
      }
    });

    // API usage statistics
    router.get('/usage', authenticateToken, async (req, res) => {
      try {
        const { days = 30 } = req.query;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days));

        // This would require additional database queries
        // For now, return basic usage info
        const user = await this.db.getUser(req.user.id);

        res.json({
          success: true,
          usage: {
            totalRequests: user.api_usage_count,
            limit: user.api_usage_limit,
            remaining: user.api_usage_limit - user.api_usage_count,
            plan: user.subscription_plan,
            period: `Last ${days} days`
          }
        });
      } catch (error) {
        console.error('Get usage error:', error);
        res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to fetch usage statistics'
        });
      }
    });

    return router;
  }

  setupErrorHandling() {
    // Global error handler
    this.app.use((error, req, res, next) => {
      console.error('Unhandled error:', error);
      
      // Track error usage
      if (req.user) {
        this.db.trackApiUsage({
          userId: req.user.id,
          endpoint: req.path,
          method: req.method,
          statusCode: 500,
          responseTime: Date.now() - req.startTime
        }).catch(console.error);
      }

      res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'production' 
          ? 'Something went wrong' 
          : error.message
      });
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      process.exit(1);
    });
  }

  async verifyToken(token) {
    // Implement JWT verification
    // This is a placeholder - implement proper JWT verification
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      return decoded;
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  async start() {
    try {
      // Connect to database
      await this.db.connect();
      
      // Start voice server
      this.voiceServer.start(4001);
      
      // Start HTTP server
      this.app.listen(this.port, () => {
        console.log(`Production server running on port ${this.port}`);
        console.log(`Environment: ${process.env.NODE_ENV}`);
        console.log(`Voice server on port: 4001`);
      });
      
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  async stop() {
    console.log('Shutting down server...');
    
    this.voiceServer.stop();
    await this.db.close();
    
    process.exit(0);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received');
  const server = new ProductionServer();
  await server.stop();
});

process.on('SIGINT', async () => {
  console.log('SIGINT received');
  const server = new ProductionServer();
  await server.stop();
});

// Start server
if (require.main === module) {
  const server = new ProductionServer();
  server.start();
}

module.exports = { ProductionServer };
