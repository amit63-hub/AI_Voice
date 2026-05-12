const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const cors = require('cors');
const { OpenAI } = require('openai');
const { AIAgent } = require('../ai-system/agent');

class VoiceServer {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.wss = new WebSocket.Server({ server: this.server });
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.aiAgent = new AIAgent();
    this.activeSessions = new Map(); // userId -> session data
    
    this.setupMiddleware();
    this.setupWebSocket();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.raw({ type: 'audio/webm', limit: '50mb' }));
  }

  setupWebSocket() {
    this.wss.on('connection', (ws, req) => {
      const sessionId = this.generateSessionId();
      const userId = req.url.split('userId=')[1] || `anon_${sessionId}`;
      
      console.log(`Voice session connected: ${sessionId} for user: ${userId}`);
      
      const session = {
        id: sessionId,
        userId: userId,
        ws: ws,
        isListening: false,
        isSpeaking: false,
        conversationHistory: [],
        voiceSettings: {
          language: 'en',
          voice: 'alloy',
          speed: 1.0,
          pitch: 1.0
        }
      };
      
      this.activeSessions.set(sessionId, session);
      
      // Send welcome message
      this.sendToClient(ws, {
        type: 'welcome',
        sessionId: sessionId,
        message: 'Voice session established'
      });
      
      ws.on('message', async (data) => {
        await this.handleMessage(sessionId, data);
      });
      
      ws.on('close', () => {
        console.log(`Voice session disconnected: ${sessionId}`);
        this.activeSessions.delete(sessionId);
      });
      
      ws.on('error', (error) => {
        console.error(`WebSocket error for session ${sessionId}:`, error);
      });
    });
  }

  async handleMessage(sessionId, data) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;
    
    try {
      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'start_listening':
          await this.startListening(session);
          break;
          
        case 'stop_listening':
          await this.stopListening(session);
          break;
          
        case 'audio_data':
          await this.processAudioData(session, message.audioData);
          break;
          
        case 'interrupt':
          await this.handleInterrupt(session);
          break;
          
        case 'update_settings':
          await this.updateVoiceSettings(session, message.settings);
          break;
          
        case 'ping':
          this.sendToClient(session.ws, { type: 'pong' });
          break;
          
        default:
          console.log(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error('Error handling message:', error);
      this.sendToClient(session.ws, {
        type: 'error',
        message: 'Failed to process message'
      });
    }
  }

  async startListening(session) {
    if (session.isListening) return;
    
    session.isListening = true;
    session.isSpeaking = false;
    
    this.sendToClient(session.ws, {
      type: 'listening_started',
      message: 'Voice recognition started'
    });
    
    // Start voice activity detection
    this.startVoiceActivityDetection(session);
  }

  async stopListening(session) {
    if (!session.isListening) return;
    
    session.isListening = false;
    
    this.sendToClient(session.ws, {
      type: 'listening_stopped',
      message: 'Voice recognition stopped'
    });
  }

  async processAudioData(session, audioData) {
    if (!session.isListening) return;
    
    try {
      // Convert audio data to text using OpenAI Whisper
      const transcription = await this.transcribeAudio(audioData);
      
      if (transcription.text.trim()) {
        this.sendToClient(session.ws, {
          type: 'transcription',
          text: transcription.text,
          confidence: transcription.confidence || 0.8
        });
        
        // Process with AI
        await this.processVoiceInput(session, transcription.text);
      }
    } catch (error) {
      console.error('Error processing audio data:', error);
      this.sendToClient(session.ws, {
        type: 'error',
        message: 'Failed to process audio'
      });
    }
  }

  async transcribeAudio(audioData) {
    try {
      // Create a readable stream from the audio data
      const audioBuffer = Buffer.from(audioData, 'base64');
      
      const transcription = await this.openai.audio.transcriptions.create({
        model: 'whisper-1',
        file: new File([audioBuffer], 'audio.webm', { type: 'audio/webm' }),
        language: 'en',
        response_format: 'verbose_json'
      });
      
      return {
        text: transcription.text,
        confidence: transcription.avg_confidence || 0.8,
        duration: transcription.duration
      };
    } catch (error) {
      console.error('Transcription error:', error);
      return { text: '', confidence: 0 };
    }
  }

  async processVoiceInput(session, text) {
    try {
      this.sendToClient(session.ws, {
        type: 'processing',
        message: 'Processing your request...'
      });
      
      // Process with AI agent
      const response = await this.aiAgent.processMessage(
        session.userId,
        text,
        { mode: 'voice', sessionId: session.id }
      );
      
      // Store in conversation history
      session.conversationHistory.push({
        role: 'user',
        content: text,
        timestamp: new Date().toISOString()
      });
      
      session.conversationHistory.push({
        role: 'assistant',
        content: response.content,
        timestamp: new Date().toISOString(),
        intent: response.intent
      });
      
      // Convert response to speech
      await this.speakResponse(session, response.content);
      
    } catch (error) {
      console.error('Error processing voice input:', error);
      this.sendToClient(session.ws, {
        type: 'error',
        message: 'Failed to process voice input'
      });
    }
  }

  async speakResponse(session, text) {
    try {
      session.isSpeaking = true;
      
      this.sendToClient(session.ws, {
        type: 'speaking_started',
        text: text
      });
      
      // Generate speech using OpenAI TTS
      const audioBuffer = await this.generateSpeech(text, session.voiceSettings);
      
      // Send audio data in chunks for streaming
      await this.streamAudioData(session, audioBuffer);
      
      session.isSpeaking = false;
      
      this.sendToClient(session.ws, {
        type: 'speaking_finished',
        message: 'Response completed'
      });
      
    } catch (error) {
      console.error('Error generating speech:', error);
      session.isSpeaking = false;
      this.sendToClient(session.ws, {
        type: 'error',
        message: 'Failed to generate speech'
      });
    }
  }

  async generateSpeech(text, voiceSettings) {
    try {
      const mp3 = await this.openai.audio.speech.create({
        model: 'tts-1',
        voice: voiceSettings.voice || 'alloy',
        input: text,
        speed: voiceSettings.speed || 1.0,
        response_format: 'mp3'
      });
      
      return Buffer.from(await mp3.arrayBuffer());
    } catch (error) {
      console.error('Speech generation error:', error);
      throw error;
    }
  }

  async streamAudioData(session, audioBuffer) {
    const chunkSize = 1024 * 8; // 8KB chunks
    let offset = 0;
    
    while (offset < audioBuffer.length) {
      if (!session.isSpeaking) {
        // Handle interruption
        this.sendToClient(session.ws, {
          type: 'speech_interrupted',
          message: 'Speech interrupted'
        });
        break;
      }
      
      const chunk = audioBuffer.slice(offset, offset + chunkSize);
      const base64Chunk = chunk.toString('base64');
      
      this.sendToClient(session.ws, {
        type: 'audio_chunk',
        audioData: base64Chunk,
        isFinal: offset + chunkSize >= audioBuffer.length
      });
      
      offset += chunkSize;
      
      // Small delay to simulate real-time streaming
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  async handleInterrupt(session) {
    if (session.isSpeaking) {
      session.isSpeaking = false;
      this.sendToClient(session.ws, {
        type: 'speech_interrupted',
        message: 'Speech interrupted'
      });
    }
  }

  async updateVoiceSettings(session, settings) {
    session.voiceSettings = { ...session.voiceSettings, ...settings };
    
    this.sendToClient(session.ws, {
      type: 'settings_updated',
      settings: session.voiceSettings
    });
  }

  startVoiceActivityDetection(session) {
    // Simple VAD implementation
    // In production, use a proper VAD library
    const vadInterval = setInterval(() => {
      if (!session.isListening) {
        clearInterval(vadInterval);
        return;
      }
      
      // Send VAD status to client
      this.sendToClient(session.ws, {
        type: 'vad_status',
        isSpeaking: false, // Would be determined by actual VAD
        energy: 0.1
      });
    }, 100);
  }

  sendToClient(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  generateSessionId() {
    return `voice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  setupRoutes() {
    // Health check
    this.app.get('/voice/health', (req, res) => {
      res.json({
        status: 'healthy',
        activeSessions: this.activeSessions.size,
        timestamp: new Date().toISOString()
      });
    });
    
    // Get session info
    this.app.get('/voice/session/:sessionId', (req, res) => {
      const session = this.activeSessions.get(req.params.sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      res.json({
        sessionId: session.id,
        userId: session.userId,
        isListening: session.isListening,
        isSpeaking: session.isSpeaking,
        conversationLength: session.conversationHistory.length
      });
    });
  }

  start(port = 4001) {
    this.server.listen(port, () => {
      console.log(`Voice server running on port ${port}`);
      console.log(`WebSocket endpoint: ws://localhost:${port}`);
    });
  }

  stop() {
    this.wss.close();
    this.server.close();
  }
}

module.exports = { VoiceServer };
