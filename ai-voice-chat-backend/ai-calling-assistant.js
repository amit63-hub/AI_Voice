/**
 * AI Calling Assistant Module
 * Handles outbound calls, call queues, and AI-powered voice interactions
 */

class AICallingAssistant {
  constructor(database, openai) {
    this.db = database;
    this.openai = openai;
    this.activeCalls = new Map();
    this.callQueue = [];
    this.maxConcurrentCalls = 5;
  }

  /**
   * Create a new outbound call
   */
  async createCall(userId, phoneNumber, script, priority = 'normal') {
    try {
      const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const call = {
        id: callId,
        userId,
        phoneNumber,
        script,
        status: 'queued',
        priority,
        createdAt: new Date().toISOString(),
        startedAt: null,
        endedAt: null,
        duration: 0,
        transcript: [],
        aiResponses: [],
        recordingUrl: null
      };

      // Add to database
      await this.db.createCall(call);
      
      // Add to queue
      this.callQueue.push(call);
      this.sortQueue();
      
      // Process queue
      this.processQueue();

      return call;
    } catch (error) {
      console.error('Error creating call:', error);
      throw error;
    }
  }

  /**
   * Sort queue by priority
   */
  sortQueue() {
    const priorityOrder = { 'high': 0, 'normal': 1, 'low': 2 };
    this.callQueue.sort((a, b) => {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  /**
   * Process call queue
   */
  async processQueue() {
    if (this.activeCalls.size >= this.maxConcurrentCalls || this.callQueue.length === 0) {
      return;
    }

    const call = this.callQueue.shift();
    if (!call) return;

    this.activeCalls.set(call.id, call);
    await this.updateCallStatus(call.id, 'in-progress');
    
    // Start the call
    this.startCall(call);
  }

  /**
   * Start a call
   */
  async startCall(call) {
    try {
      call.startedAt = new Date().toISOString();
      await this.updateCallStatus(call.id, 'in-progress');

      // Simulate call initiation (in production, integrate with Twilio/Plivo)
      console.log(`Starting call to ${call.phoneNumber} with script: ${call.script}`);

      // AI-powered conversation flow
      await this.runAIConversation(call);

    } catch (error) {
      console.error('Error starting call:', error);
      await this.updateCallStatus(call.id, 'failed');
      this.activeCalls.delete(call.id);
      this.processQueue();
    }
  }

  /**
   * Run AI-powered conversation
   */
  async runAIConversation(call) {
    try {
      let conversationHistory = [
        {
          role: 'system',
          content: `You are a professional calling assistant. Your task is: ${call.script}
          
Rules:
- Be polite and professional
- Speak clearly and concisely
- Ask relevant questions
- Take notes of important information
- End the call politely when objective is achieved`
        }
      ];

      let completed = false;
      let maxTurns = 10;
      let turnCount = 0;

      while (!completed && turnCount < maxTurns) {
        turnCount++;

        // Generate AI response
        const completion = await this.openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: conversationHistory,
          max_tokens: 200,
          temperature: 0.7
        });

        const aiResponse = completion.choices[0].message.content;
        
        // Add to call transcript
        call.transcript.push({
          role: 'assistant',
          content: aiResponse,
          timestamp: new Date().toISOString()
        });

        call.aiResponses.push(aiResponse);

        // Simulate user response (in production, this would be actual voice input)
        const userResponse = await this.simulateUserResponse(aiResponse, call.script);
        
        if (userResponse === 'CALL_COMPLETE') {
          completed = true;
          break;
        }

        conversationHistory.push({
          role: 'assistant',
          content: aiResponse
        });

        conversationHistory.push({
          role: 'user',
          content: userResponse
        });

        call.transcript.push({
          role: 'user',
          content: userResponse,
          timestamp: new Date().toISOString()
        });

        // Small delay between turns
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // End call
      await this.endCall(call.id, 'completed');

    } catch (error) {
      console.error('Error in AI conversation:', error);
      await this.endCall(call.id, 'failed');
    }
  }

  /**
   * Simulate user response (for demo purposes)
   * In production, this would be actual voice-to-text from the call
   */
  async simulateUserResponse(aiResponse, script) {
    // Simple simulation based on script
    const responses = [
      'Yes, I am interested.',
      'Can you tell me more?',
      'That sounds good.',
      'I need to think about it.',
      'CALL_COMPLETE'
    ];
    
    // Return a response based on context
    if (aiResponse.toLowerCase().includes('thank') || aiResponse.toLowerCase().includes('goodbye')) {
      return 'CALL_COMPLETE';
    }
    
    return responses[Math.floor(Math.random() * (responses.length - 1))];
  }

  /**
   * End a call
   */
  async endCall(callId, status) {
    try {
      const call = this.activeCalls.get(callId);
      if (!call) return;

      call.endedAt = new Date().toISOString();
      call.status = status;
      call.duration = Math.floor((new Date(call.endedAt) - new Date(call.startedAt)) / 1000);

      // Update database
      await this.db.updateCall(callId, {
        status: call.status,
        endedAt: call.endedAt,
        duration: call.duration,
        transcript: JSON.stringify(call.transcript)
      });

      this.activeCalls.delete(callId);
      
      // Process next call in queue
      this.processQueue();

      return call;
    } catch (error) {
      console.error('Error ending call:', error);
      throw error;
    }
  }

  /**
   * Update call status
   */
  async updateCallStatus(callId, status) {
    try {
      await this.db.updateCall(callId, { status });
    } catch (error) {
      console.error('Error updating call status:', error);
    }
  }

  /**
   * Get call details
   */
  async getCall(callId) {
    try {
      return await this.db.getCall(callId);
    } catch (error) {
      console.error('Error getting call:', error);
      throw error;
    }
  }

  /**
   * Get all calls for a user
   */
  async getUserCalls(userId) {
    try {
      return await this.db.getCallsByUserId(userId);
    } catch (error) {
      console.error('Error getting user calls:', error);
      throw error;
    }
  }

  /**
   * Get active calls
   */
  getActiveCalls() {
    return Array.from(this.activeCalls.values());
  }

  /**
   * Get queue status
   */
  getQueueStatus() {
    return {
      activeCalls: this.activeCalls.size,
      queuedCalls: this.callQueue.length,
      maxConcurrentCalls: this.maxConcurrentCalls
    };
  }

  /**
   * Cancel a queued call
   */
  async cancelCall(callId) {
    try {
      const queueIndex = this.callQueue.findIndex(c => c.id === callId);
      if (queueIndex > -1) {
        const call = this.callQueue.splice(queueIndex, 1)[0];
        await this.updateCallStatus(callId, 'cancelled');
        return call;
      }
      
      // If call is active, end it
      if (this.activeCalls.has(callId)) {
        return await this.endCall(callId, 'cancelled');
      }

      throw new Error('Call not found');
    } catch (error) {
      console.error('Error cancelling call:', error);
      throw error;
    }
  }

  /**
   * Generate call script using AI
   */
  async generateScript(objective, tone = 'professional', language = 'english') {
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert at creating calling scripts. Generate a professional, effective calling script based on the objective.
            
Tone: ${tone}
Language: ${language}

The script should:
- Be concise and clear
- Include key talking points
- Have a natural flow
- Include objection handling
- End with a clear call to action`
          },
          {
            role: 'user',
            content: `Objective: ${objective}`
          }
        ],
        max_tokens: 500,
        temperature: 0.7
      });

      return completion.choices[0].message.content;
    } catch (error) {
      console.error('Error generating script:', error);
      throw error;
    }
  }

  /**
   * Get call analytics
   */
  async getCallAnalytics(userId, period = '30d') {
    try {
      const calls = await this.getUserCalls(userId);
      
      // Filter by period
      const days = parseInt(period) || 30;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      const filteredCalls = calls.filter(call => 
        new Date(call.createdAt) >= cutoffDate
      );

      const analytics = {
        totalCalls: filteredCalls.length,
        completedCalls: filteredCalls.filter(c => c.status === 'completed').length,
        failedCalls: filteredCalls.filter(c => c.status === 'failed').length,
        cancelledCalls: filteredCalls.filter(c => c.status === 'cancelled').length,
        averageDuration: filteredCalls.reduce((sum, c) => sum + (c.duration || 0), 0) / (filteredCalls.length || 1),
        callsByStatus: {},
        callsByDay: {}
      };

      // Group by status
      filteredCalls.forEach(call => {
        analytics.callsByStatus[call.status] = (analytics.callsByStatus[call.status] || 0) + 1;
        
        const day = new Date(call.createdAt).toISOString().split('T')[0];
        analytics.callsByDay[day] = (analytics.callsByDay[day] || 0) + 1;
      });

      return analytics;
    } catch (error) {
      console.error('Error getting call analytics:', error);
      throw error;
    }
  }
}

module.exports = AICallingAssistant;
