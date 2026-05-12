const { OpenAI } = require('openai');
const { Database } = require('../database');

class AIAgent {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.db = new Database(process.env.DATABASE_URL);
    this.memory = new MemoryManager(this.db);
    this.tools = new ToolManager();
  }

  async processMessage(userId, message, context = {}) {
    try {
      // 1. Load user profile and memory
      const userProfile = await this.getUserProfile(userId);
      const shortTermMemory = await this.memory.getShortTerm(userId);
      const longTermMemory = await this.memory.getLongTerm(userId);
      
      // 2. Detect intent
      const intent = await this.detectIntent(message, userProfile);
      
      // 3. Build context-aware prompt
      const systemPrompt = this.buildSystemPrompt(userProfile, intent, context);
      
      // 4. Prepare messages with memory
      const messages = [
        { role: 'system', content: systemPrompt },
        ...shortTermMemory,
        ...longTermMemory.slice(-5), // Last 5 long-term memories
        { role: 'user', content: message }
      ];

      // 5. Call AI with tool usage
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages,
        tools: this.tools.getAvailableTools(),
        tool_choice: 'auto',
        max_tokens: 1000,
        temperature: 0.7,
      });

      const assistantMessage = response.choices[0].message;
      
      // 6. Handle tool calls
      if (assistantMessage.tool_calls) {
        const toolResults = await this.executeToolCalls(
          assistantMessage.tool_calls, 
          userId, 
          userProfile
        );
        
        // Continue conversation with tool results
        const followUpResponse = await this.openai.chat.completions.create({
          model: 'gpt-4-turbo-preview',
          messages: [
            ...messages,
            assistantMessage,
            ...toolResults
          ],
          max_tokens: 1000,
          temperature: 0.7,
        });
        
        return this.formatResponse(followUpResponse.choices[0].message.content, intent);
      }

      // 7. Store in memory
      await this.memory.storeShortTerm(userId, 'user', message);
      await this.memory.storeShortTerm(userId, 'assistant', assistantMessage.content);
      
      // 8. Update user profile based on interaction
      await this.updateUserProfile(userId, message, assistantMessage.content);

      return this.formatResponse(assistantMessage.content, intent);

    } catch (error) {
      console.error('AI Agent Error:', error);
      return this.getFallbackResponse(intent);
    }
  }

  async detectIntent(message, userProfile) {
    const intentPrompt = `
Analyze the user message and classify intent. Return JSON:

{
  "intent": "chat|support|lead|task|information",
  "confidence": 0.0-1.0,
  "entities": [],
  "urgency": "low|medium|high",
  "sentiment": "positive|neutral|negative"
}

Message: "${message}"
User Profile: ${JSON.stringify(userProfile)}
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: intentPrompt }],
        response_format: { type: 'json_object' },
        max_tokens: 200,
        temperature: 0.1,
      });
      
      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      return { intent: 'chat', confidence: 0.5, entities: [], urgency: 'medium', sentiment: 'neutral' };
    }
  }

  buildSystemPrompt(userProfile, intent, context) {
    const basePrompt = `You are an advanced AI assistant with memory, reasoning, and tool capabilities.

USER PROFILE:
${JSON.stringify(userProfile, null, 2)}

CURRENT INTENT: ${intent.intent} (confidence: ${intent.confidence})
URGENCY: ${intent.urgency}
SENTIMENT: ${intent.sentiment}

CONTEXT: ${JSON.stringify(context)}

CAPABILITIES:
- Memory: You remember past conversations and user preferences
- Tools: You can call APIs, search web, access database
- Reasoning: Multi-step thinking and problem solving
- Personalization: Adapt responses based on user profile

GUIDELINES:
- Be conversational and natural
- Use memory to personalize responses
- Proactively use tools when helpful
- Ask follow-up questions to clarify needs
- Maintain consistent personality based on user preferences`;

    // Add personality based on user profile
    if (userProfile.preferences?.personality) {
      return basePrompt + `\n\nPERSONALITY: ${userProfile.preferences.personality}`;
    }

    return basePrompt;
  }

  async executeToolCalls(toolCalls, userId, userProfile) {
    const results = [];
    
    for (const toolCall of toolCalls) {
      try {
        const result = await this.tools.execute(toolCall.function, userId, userProfile);
        results.push({
          tool_call_id: toolCall.id,
          role: 'tool',
          content: JSON.stringify(result)
        });
      } catch (error) {
        results.push({
          tool_call_id: toolCall.id,
          role: 'tool',
          content: JSON.stringify({ error: error.message })
        });
      }
    }
    
    return results;
  }

  async getUserProfile(userId) {
    try {
      const profile = await this.db.getUser(userId);
      return profile || {
        id: userId,
        name: 'User',
        preferences: {
          personality: 'helpful_assistant',
          language: 'english',
          responseStyle: 'detailed'
        },
        stats: {
          messageCount: 0,
          lastSeen: new Date().toISOString(),
          joinDate: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Error getting user profile:', error);
      return this.getDefaultProfile(userId);
    }
  }

  async updateUserProfile(userId, userMessage, aiResponse) {
    try {
      // Extract preferences and patterns
      const preferences = await this.extractPreferences(userMessage, aiResponse);
      
      await this.db.updateUser(userId, {
        preferences,
        stats: {
          messageCount: await this.getMessageCount(userId) + 1,
          lastSeen: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error updating user profile:', error);
    }
  }

  async extractPreferences(userMessage, aiResponse) {
    const extractPrompt = `
Analyze this conversation and extract user preferences. Return JSON:

{
  "personality": "formal|casual|friendly|professional",
  "language": "english|hindi|bilingual",
  "responseStyle": "brief|detailed|technical",
  "topics": ["topic1", "topic2"],
  "communicationStyle": "direct|empathetic|analytical"
}

User: "${userMessage}"
AI: "${aiResponse}"
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: extractPrompt }],
        response_format: { type: 'json_object' },
        max_tokens: 200,
        temperature: 0.1,
      });
      
      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      return {};
    }
  }

  formatResponse(content, intent) {
    return {
      content,
      intent: intent.intent,
      confidence: intent.confidence,
      timestamp: new Date().toISOString(),
      metadata: {
        urgency: intent.urgency,
        sentiment: intent.sentiment,
        entities: intent.entities
      }
    };
  }

  getFallbackResponse(intent) {
    const fallbacks = {
      chat: "I'm here to help! Could you please rephrase that?",
      support: "I apologize for the technical issue. Our team has been notified.",
      lead: "I'd be happy to help! Let me connect you with the right information.",
      task: "Let me help you with that task. Could you provide more details?",
      information: "I'm having trouble accessing that information right now. Please try again."
    };

    return {
      content: fallbacks[intent.intent] || fallbacks.chat,
      intent: intent.intent,
      confidence: 0.3,
      timestamp: new Date().toISOString(),
      fallback: true
    };
  }

  async getMessageCount(userId) {
    try {
      const history = await this.db.getConversationHistory(userId);
      return history.length;
    } catch (error) {
      return 0;
    }
  }

  getDefaultProfile(userId) {
    return {
      id: userId,
      name: 'User',
      preferences: {
        personality: 'helpful_assistant',
        language: 'english',
        responseStyle: 'detailed'
      },
      stats: {
        messageCount: 0,
        lastSeen: new Date().toISOString(),
        joinDate: new Date().toISOString()
      }
    };
  }
}

module.exports = { AIAgent };
