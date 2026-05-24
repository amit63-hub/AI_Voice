const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { Database } = require('./database');
const { MultiModelAI } = require('./multi-model-ai');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
  }
});

const db = new Database();
const ai = new MultiModelAI();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret123';

// Authentication middleware for WebSocket
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await db.getUser(decoded.userId);
    
    if (!user) {
      return next(new Error('User not found'));
    }

    socket.user = user;
    next();
  } catch (error) {
    next(new Error('Authentication error'));
  }
});

// WebSocket connection handler
io.on('connection', async (socket) => {
  console.log(`User connected: ${socket.user.userId}`);
  
  // Join user's personal room
  socket.join(`user:${socket.user.userId}`);

  // Handle chat messages
  socket.on('chat:send', async (data) => {
    try {
      const { message, model = 'gpt-4o-mini', stream = false } = data;
      
      // Check rate limit
      const usage = await db.getUsage(socket.user.userId);
      const planLimits = {
        free: 20,
        pro: 500,
        premium: Infinity
      };
      
      if (usage.today >= planLimits[socket.user.plan]) {
        socket.emit('chat:error', { error: 'Daily message limit exceeded' });
        return;
      }

      // Save user message
      await db.saveMessage(socket.user.userId, 'user', message, model);

      if (stream) {
        // Streaming response
        const messages = [{ role: 'user', content: message }];
        const systemPrompt = await getSystemPrompt(socket.user.userId);
        
        for await (const chunk of ai.streamGenerate(model, messages, systemPrompt)) {
          if (chunk.type === 'content') {
            socket.emit('chat:stream', { content: chunk.content, model: chunk.model });
          } else if (chunk.type === 'done') {
            // Save assistant message
            await db.saveMessage(socket.user.userId, 'assistant', chunk.fullContent || '', model);
            socket.emit('chat:done', { finishReason: chunk.finishReason });
          }
        }
      } else {
        // Non-streaming response
        const messages = [{ role: 'user', content: message }];
        const systemPrompt = await getSystemPrompt(socket.user.userId);
        
        const response = await ai.generate(model, messages, systemPrompt);
        
        // Save assistant message
        await db.saveMessage(socket.user.userId, 'assistant', response.content, model);
        
        socket.emit('chat:response', {
          content: response.content,
          model: response.model,
          provider: response.provider,
          usage: response.usage
        });
      }

      // Update usage
      await db.incrementUsage(socket.user.userId);
      
    } catch (error) {
      console.error('Chat error:', error);
      socket.emit('chat:error', { error: error.message });
    }
  });

  // Handle typing indicator
  socket.on('chat:typing', (isTyping) => {
    socket.to(`user:${socket.user.userId}`).emit('chat:typing', { isTyping });
  });

  // Handle voice input
  socket.on('voice:transcript', async (data) => {
    try {
      const { transcript } = data;
      
      // Process transcript as chat message
      const messages = [{ role: 'user', content: transcript }];
      const systemPrompt = await getSystemPrompt(socket.user.userId);
      
      const response = await ai.generate('gpt-4o-mini', messages, systemPrompt);
      
      // Save messages
      await db.saveMessage(socket.user.userId, 'user', transcript, 'gpt-4o-mini');
      await db.saveMessage(socket.user.userId, 'assistant', response.content, 'gpt-4o-mini');
      
      socket.emit('voice:response', {
        content: response.content,
        speak: socket.user.plan !== 'free' // Voice enabled for Pro+
      });
      
      await db.incrementUsage(socket.user.userId);
      
    } catch (error) {
      console.error('Voice error:', error);
      socket.emit('voice:error', { error: error.message });
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.user.userId}`);
  });
});

// Get system prompt based on user preferences
async function getSystemPrompt(userId) {
  const user = await db.getUser(userId);
  
  const basePrompt = `You are an advanced AI assistant for an AI Voice Chat SaaS platform. You are helpful, intelligent, and can communicate in both English and Hinglish (Hindi + English mix).

Your capabilities:
- Answer questions accurately and helpfully
- Provide code examples when requested
- Explain complex concepts simply
- Be conversational and engaging
- Support multiple languages (English, Hindi, Hinglish)
- Maintain context of the conversation

Current user plan: ${user.plan}
User preferences: ${user.preferences || 'Default'}`;

  return basePrompt;
}

// REST API endpoints for WebSocket info
app.get('/ws/info', (req, res) => {
  res.json({
    connected: io.engine.clientsCount,
    features: {
      streaming: true,
      voice: true,
      typing: true,
      realtime: true
    }
  });
});

const PORT = process.env.WS_PORT || 4001;
server.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`);
});

module.exports = { io, server };
