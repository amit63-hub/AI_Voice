require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { Database } = require('./database');
const { OpenAI } = require('openai');
const { execSync } = require('child_process');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret123';
const JWT_EXPIRY = '7d';

// Subscription plan limits
const PLAN_LIMITS = {
  free: { messagesPerDay: 20, model: 'gpt-4o-mini', voice: false },
  pro: { messagesPerDay: 500, model: 'gpt-4o-mini', voice: true },
  premium: { messagesPerDay: Infinity, model: 'gpt-4o', voice: true }
};

// Auto-kill any process using our port before starting
function killPortProcess(port) {
  try {
    const result = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, { encoding: 'utf8' }).trim();
    if (result) {
      const lines = result.split('\n').filter(l => l.trim());
      const pids = new Set();
      lines.forEach(line => {
        const parts = line.trim().split(/\s+/);
        const pid = parseInt(parts[parts.length - 1]);
        if (pid && pid !== process.pid) pids.add(pid);
      });
      pids.forEach(pid => {
        try {
          process.kill(pid, 'SIGKILL');
          console.log(`Killed stale process PID ${pid} on port ${port}`);
        } catch (e) {
          // Process may have already exited
        }
      });
      if (pids.size > 0) {
        // Wait for port to be freed
        const start = Date.now();
        while (Date.now() - start < 3000) {
          try {
            const check = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, { encoding: 'utf8' }).trim();
            if (!check) break;
          } catch (e) { break; }
        }
      }
    }
  } catch (e) {
    // No process on this port — good
  }
}

killPortProcess(PORT);

// Initialize database
const db = new Database(process.env.DATABASE_URL);

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request timing middleware
app.use((req, res, next) => {
  req.startTime = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - req.startTime;
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
  });
  next();
});

// Auth middleware — optional for public endpoints, required for protected
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized — token required' });
  }
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    req.userPlan = decoded.plan || 'free';
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Rate limit check based on plan
async function checkRateLimit(req, res, next) {
  const userId = req.userId;
  const plan = req.userPlan || 'free';
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
  
  const todayCount = await db.getMessageCount(userId, 1);
  if (todayCount >= limits.messagesPerDay) {
    return res.status(429).json({ 
      error: 'Rate limit exceeded', 
      plan,
      limit: limits.messagesPerDay,
      used: todayCount,
      upgrade: 'Upgrade your plan for more messages'
    });
  }
  next();
}

// System prompt for AI brain — Enterprise-Grade AI Voice & Chat Assistant
const AI_SYSTEM_PROMPT = `You are an enterprise-grade AI Voice and Chat Assistant embedded inside a website, application, or business system.

You act as a highly trained human customer support, sales, and assistant representative.

-----------------------------------
SYSTEM CONTEXT (EMBEDDABLE PRODUCT)
-----------------------------------

- You are deployed inside a website/app as a widget or assistant
- Users interact via:
   1. Chat (text)
   2. Voice (microphone)
   3. Phone calls (incoming/outgoing)

- You are connected to backend systems for:
   - AI processing
   - Voice processing (STT/TTS)
   - Call handling (telephony API)
   - Data storage (users, leads, conversations)

-----------------------------------
IDENTITY & PERSONALITY
-----------------------------------

- Act as a real human assistant
- Never mention being an AI
- Be polite, confident, and helpful
- Maintain a natural conversational tone
- Sound like a real person in voice (warm, clear, human-like)

-----------------------------------
PRIMARY OBJECTIVES
-----------------------------------

- Understand user intent quickly
- Provide accurate and useful responses
- Collect important user information when needed
- Guide user toward meaningful actions
- Improve business outcomes (leads, conversions, support)

-----------------------------------
CONVERSATION ENGINE (STATE CONTROL)
-----------------------------------

Follow structured flow:

1. Greeting
2. Intent Detection
3. Clarification
4. Qualification (ask relevant questions)
5. Data Capture
6. Confirmation
7. Solution / Action
8. Conversion / Next Step
9. Closing

Do not skip steps unnecessarily.

-----------------------------------
SMART MEMORY SYSTEM
-----------------------------------

- Remember:
   - Name
   - Contact details
   - Past conversations
   - Preferences

- Use memory naturally without repeating questions
- Maintain context across sessions

-----------------------------------
TOOL EXECUTION SYSTEM
-----------------------------------

Trigger backend actions when required:

- capture_lead(name, contact, intent, score)
- schedule_call(time)
- trigger_outbound_call(phone)
- send_followup(contact)
- save_conversation(summary)
- tag_analytics(intent, outcome)

Rules:
- Always confirm data before triggering
- Never expose system tools to user
- Trigger at correct stage only

-----------------------------------
LEAD INTELLIGENCE (SCORING)
-----------------------------------

Classify users:

- High intent → ready to act
- Medium → interested
- Low → exploring

Behavior:
- High → guide toward conversion
- Medium → explain benefits
- Low → provide information

-----------------------------------
EMOTION AI
-----------------------------------

Detect user tone:

- Angry → calm, empathetic
- Confused → simplify
- Happy → match tone
- Urgent → respond quickly

-----------------------------------
MULTI-LANGUAGE ENGINE
-----------------------------------

- Detect Hindi / English / Hinglish
- Respond in same language
- Keep communication natural and clear

-----------------------------------
MULTI-CHANNEL SYNC
-----------------------------------

- Maintain same context across:
   chat ↔ voice ↔ calls
- Do not lose conversation flow

-----------------------------------
VOICE & CALL INTELLIGENCE
-----------------------------------

- Speak in short, natural sentences
- Use pauses like a human
- Avoid robotic tone
- Handle interruptions smoothly

Incoming Call:
"Hello, thank you for calling. How can I help you today?"

Outgoing Call:
"Hi, I'm calling regarding your recent request…"

-----------------------------------
VOICE PIPELINE
-----------------------------------

User speech
→ Speech-to-Text (STT)
→ AI processing
→ Text-to-Speech (TTS)
→ Audio output

Ensure:
- Low latency
- Smooth playback
- Natural voice

-----------------------------------
AUTO FOLLOW-UP SYSTEM
-----------------------------------

Offer:
- Callback
- WhatsApp message
- Email

Trigger only after confirmation

-----------------------------------
ANALYTICS & TRACKING
-----------------------------------

Track internally:

- User intent
- Lead score
- Conversation outcome

Use data to improve future interactions

-----------------------------------
USER CONTACT & OUTREACH
-----------------------------------

- If user provides contact:
   → Store it
   → Offer follow-up
   → Trigger call or message if approved

-----------------------------------
SELF-IMPROVEMENT BEHAVIOR
-----------------------------------

- Learn from past interactions
- Improve response quality over time
- Adapt to user patterns
- Optimize clarity and efficiency

-----------------------------------
ERROR & EDGE CASE HANDLING
-----------------------------------

- If unclear → ask again
- If invalid → request correction
- If user is rude → remain calm
- If unsupported → suggest alternative

-----------------------------------
PERFORMANCE RULES
-----------------------------------

- Keep responses fast
- Keep answers concise
- Maintain smooth flow
- Avoid long delays

-----------------------------------
FRONTEND AWARENESS
-----------------------------------

- Responses appear in chat UI
- Voice responses play as audio
- Keep messages short and readable

-----------------------------------
BACKEND AWARENESS
-----------------------------------

- Maintain session via userId
- Use conversation history
- Ensure consistency across requests

-----------------------------------
SECURITY & TRUST
-----------------------------------

- Do not share sensitive data
- Do not make false promises
- Stay within professional limits

-----------------------------------
FINAL GOAL
-----------------------------------

Deliver a premium, human-like AI assistant experience that:

- Feels like talking to a real person
- Works smoothly on any website/app
- Captures leads and drives actions
- Helps businesses grow
- Can be embedded and reused easily by any company`;

// Routes
app.get('/health', (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  const aiMode = (!apiKey || apiKey === 'your_openai_api_key_here') ? 'demo' : 'openai';
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    aiMode
  });
});

// POST /chat - Main chat endpoint
app.post('/chat', async (req, res) => {
  try {
    const { userId, message } = req.body;
    
    if (!userId || !message) {
      return res.status(400).json({ 
        error: 'Missing required fields: userId and message' 
      });
    }

    // Load conversation history
    const history = await db.getConversationHistory(userId);
    
    // Prepare messages for OpenAI
    const messages = [
      { role: 'system', content: AI_SYSTEM_PROMPT },
      ...history.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.message
      })),
      { role: 'user', content: message }
    ];

    // Get AI response
    let aiResponse;
    
    // Check if using demo mode
    if (process.env.OPENAI_API_KEY === 'demo_mode' || process.env.OPENAI_API_KEY === 'your_openai_api_key_here') {
      // Demo mode responses
      const demoResponses = [
        "Hello! I'm your AI assistant. How can I help you today?",
        "That's interesting! Tell me more about that.",
        "I understand your concern. Let me help you with that.",
        "Great question! Here's what I think...",
        "I'm here to assist you. What would you like to know?",
        "Thanks for sharing! How can I support you further?"
      ];
      aiResponse = demoResponses[Math.floor(Math.random() * demoResponses.length)];
    } else {
      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages,
          max_tokens: 500,
          temperature: 0.7,
        });
        aiResponse = completion.choices[0].message.content;
      } catch (apiError) {
        // Fallback to demo mode if API quota exhausted or other error
        console.error('OpenAI API error:', apiError.message);
        if (apiError.status === 429 || apiError.status === 402 || apiError.code === 'insufficient_quota') {
          console.warn('OpenAI quota exhausted — falling back to demo mode');
        }
        const demoResponses = [
          "Hello! I'm your AI assistant. How can I help you today?",
          "That's interesting! Tell me more about that.",
          "I understand your concern. Let me help you with that.",
          "Great question! Here's what I think...",
          "I'm here to assist you. What would you like to know?",
          "Thanks for sharing! How can I support you further?"
        ];
        aiResponse = demoResponses[Math.floor(Math.random() * demoResponses.length)];
      }
    }

    // Save conversation
    await db.saveMessage(userId, 'user', message);
    await db.saveMessage(userId, 'assistant', aiResponse);

    res.json({
      response: aiResponse,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to process chat message'
    });
  }
});

// POST /call - Trigger outbound call
app.post('/call', async (req, res) => {
  try {
    const { phoneNumber, userId } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({ 
        error: 'Missing required field: phoneNumber' 
      });
    }

    // TODO: Integrate with voice service (Twilio, etc.)
    // For now, just log the call request
    console.log(`Call requested for phone: ${phoneNumber}, user: ${userId || 'anonymous'}`);
    
    // Save call record
    await db.saveCallRecord(userId || 'anonymous', phoneNumber, 'requested');

    res.json({
      status: 'call_requested',
      phoneNumber,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Call error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to initiate call'
    });
  }
});

// POST /voice-webhook - Handle voice input/output
app.post('/voice-webhook', async (req, res) => {
  try {
    const { 
      CallSid, 
      From, 
      To, 
      SpeechResult, 
      Direction 
    } = req.body;

    // Handle incoming voice data
    if (SpeechResult && Direction === 'inbound') {
      // Convert speech to text is already done by voice service
      const userId = From; // Use phone number as user ID for voice calls
      
      // Process through AI
      const history = await db.getConversationHistory(userId);
      const messages = [
        { role: 'system', content: AI_SYSTEM_PROMPT },
        ...history.map(msg => ({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.message
        })),
        { role: 'user', content: SpeechResult }
      ];

      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages,
        max_tokens: 300,
        temperature: 0.7,
      });

      const aiResponse = completion.choices[0].message.content;

      // Save conversation
      await db.saveMessage(userId, 'user', SpeechResult);
      await db.saveMessage(userId, 'assistant', aiResponse);

      // TODO: Convert text to speech and play response
      // For now, return the text response
      res.json({
        action: 'respond',
        response: aiResponse,
        textToSpeak: aiResponse
      });
    } else {
      res.json({ status: 'received' });
    }

  } catch (error) {
    console.error('Voice webhook error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to process voice webhook'
    });
  }
});

// POST /lead - Save lead data
app.post('/lead', async (req, res) => {
  try {
    const { name, contact, intent, source } = req.body;
    
    if (!name || !contact) {
      return res.status(400).json({ 
        error: 'Missing required fields: name and contact' 
      });
    }

    // Validate contact (email or phone)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
    
    if (!emailRegex.test(contact) && !phoneRegex.test(contact)) {
      return res.status(400).json({ 
        error: 'Invalid contact format. Must be valid email or phone number' 
      });
    }

    // Save lead
    const leadId = await db.saveLead({
      name,
      contact,
      intent: intent || 'general_inquiry',
      source: source || 'manual',
      status: 'new'
    });

    res.json({
      success: true,
      leadId,
      message: 'Lead saved successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Lead save error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to save lead'
    });
  }
});

// ==========================================
// AUTH ENDPOINTS
// ==========================================

// POST /auth/register
app.post('/auth/register', async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const userId = 'user_' + crypto.randomBytes(8).toString('hex');
    
    // Check if user exists
    const existing = await db.getUser(userId);
    if (existing) {
      return res.status(409).json({ error: 'User already exists' });
    }

    await db.createUser({ id: userId, name: name || email.split('@')[0], email, phone: phone || '' });
    
    // Create free subscription
    await db.createSubscription(userId, 'free');
    
    // Generate JWT
    const token = jwt.sign({ userId, plan: 'free' }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
    
    res.json({
      success: true,
      userId,
      token,
      plan: 'free',
      message: 'Registration successful'
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/login
app.post('/auth/login', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    // Find user by email — simple lookup
    const stmt = db.db.prepare('SELECT * FROM users WHERE email = ?');
    stmt.bind([email]);
    let user = null;
    if (stmt.step()) {
      const values = stmt.get();
      const columns = stmt.getColumnNames();
      user = {};
      columns.forEach((col, i) => { user[col] = values[i]; });
    }
    stmt.free();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const subscription = await db.getSubscription(user.id);
    const plan = subscription.plan || 'free';
    
    const token = jwt.sign({ userId: user.id, plan }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
    
    res.json({
      success: true,
      userId: user.id,
      name: user.name,
      token,
      plan
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /auth/me — get current user info
app.get('/auth/me', authMiddleware, async (req, res) => {
  try {
    const user = await db.getUser(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const subscription = await db.getSubscription(req.userId);
    const todayCount = await db.getMessageCount(req.userId, 1);
    const limits = PLAN_LIMITS[subscription.plan] || PLAN_LIMITS.free;
    
    res.json({
      userId: user.id,
      name: user.name,
      email: user.email,
      plan: subscription.plan,
      usage: { today: todayCount, limit: limits.messagesPerDay === Infinity ? 'unlimited' : limits.messagesPerDay },
      voice: limits.voice
    });
  } catch (error) {
    console.error('Me error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==========================================
// SUBSCRIPTION ENDPOINTS
// ==========================================

// GET /plans — list available plans
app.get('/plans', (req, res) => {
  res.json({
    plans: [
      { id: 'free', name: 'Free', price: 0, messagesPerDay: 20, voice: false, model: 'gpt-4o-mini' },
      { id: 'pro', name: 'Pro', price: 499, messagesPerDay: 500, voice: true, model: 'gpt-4o-mini', currency: 'INR' },
      { id: 'premium', name: 'Premium', price: 1499, messagesPerDay: 'unlimited', voice: true, model: 'gpt-4o', currency: 'INR' }
    ]
  });
});

// POST /subscribe — upgrade plan
app.post('/subscribe', authMiddleware, async (req, res) => {
  try {
    const { plan } = req.body;
    if (!plan || !PLAN_LIMITS[plan]) {
      return res.status(400).json({ error: 'Invalid plan. Choose: free, pro, premium' });
    }

    const current = await db.getSubscription(req.userId);
    if (current.plan === plan) {
      return res.status(400).json({ error: 'Already on this plan' });
    }

    // In production: integrate Stripe/Razorpay checkout here
    // For now: direct plan update
    if (current.plan === 'free') {
      await db.createSubscription(req.userId, plan, 'demo_session_' + Date.now());
    } else {
      await db.updateSubscription(req.userId, plan);
    }

    const token = jwt.sign({ userId: req.userId, plan }, JWT_SECRET, { expiresIn: JWT_EXPIRY });

    res.json({
      success: true,
      plan,
      limits: PLAN_LIMITS[plan],
      token,
      message: `Upgraded to ${plan} plan`
    });
  } catch (error) {
    console.error('Subscribe error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==========================================
// USAGE & ANALYTICS ENDPOINTS
// ==========================================

// GET /usage — get API usage stats
app.get('/usage', authMiddleware, async (req, res) => {
  try {
    const usage = await db.getApiUsage(req.userId, 30);
    const todayCount = await db.getMessageCount(req.userId, 1);
    const subscription = await db.getSubscription(req.userId);
    const limits = PLAN_LIMITS[subscription.plan] || PLAN_LIMITS.free;

    res.json({
      plan: subscription.plan,
      today: { messages: todayCount, limit: limits.messagesPerDay === Infinity ? 'unlimited' : limits.messagesPerDay },
      last30Days: usage
    });
  } catch (error) {
    console.error('Usage error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /dashboard/stats — admin dashboard stats
app.get('/dashboard/stats', authMiddleware, async (req, res) => {
  try {
    const stats = await db.getDashboardStats();
    const leads = await db.getLeads();
    res.json({ stats, recentLeads: leads.slice(0, 10) });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /leads — list leads
app.get('/leads', authMiddleware, async (req, res) => {
  try {
    const { status } = req.query;
    const leads = await db.getLeads(status);
    res.json({ leads, count: leads.length });
  } catch (error) {
    console.error('Leads error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: 'Endpoint not found'
  });
});

// Graceful shutdown
function gracefulShutdown(signal) {
  console.log(`\n${signal} received — shutting down gracefully...`);
  server.close(() => {
    console.log('HTTP server closed');
    db.close().then(() => {
      console.log('Database connection closed');
      process.exit(0);
    }).catch(() => {
      process.exit(0);
    });
  });
  // Force exit after 5s if graceful shutdown hangs
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 5000);
}

// Start server with dynamic port fallback
function startServer(port) {
  const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Health check: http://localhost:${port}/health`);
    console.log(`PID: ${process.pid}`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      if (port < PORT + 10) {
        console.warn(`Port ${port} in use — trying port ${port + 1}...`);
        startServer(port + 1);
      } else {
        console.error(`Ports ${PORT}-${port} all in use. Free a port and try again.`);
        process.exit(1);
      }
    } else {
      throw error;
    }
  });

  // Graceful shutdown handlers
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  return server;
}

const server = startServer(PORT);

module.exports = app;

