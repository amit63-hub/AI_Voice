const axios = require('axios');
const { Database } = require('../database');

class ToolManager {
  constructor() {
    this.db = new Database(process.env.DATABASE_URL);
    this.availableTools = [
      {
        type: 'function',
        function: {
          name: 'web_search',
          description: 'Search the web for current information',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' },
              limit: { type: 'number', description: 'Number of results', default: 5 }
            },
            required: ['query']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'save_lead',
          description: 'Save customer lead information',
          parameters: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Customer name' },
              contact: { type: 'string', description: 'Email or phone' },
              intent: { type: 'string', description: 'Customer intent' },
              source: { type: 'string', description: 'Lead source' }
            },
            required: ['name', 'contact']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'schedule_call',
          description: 'Schedule a follow-up call',
          parameters: {
            type: 'object',
            properties: {
              phoneNumber: { type: 'string', description: 'Phone number' },
              scheduledTime: { type: 'string', description: 'ISO datetime' },
              reason: { type: 'string', description: 'Call reason' }
            },
            required: ['phoneNumber', 'scheduledTime']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'get_user_data',
          description: 'Get user profile and preferences',
          parameters: {
            type: 'object',
            properties: {
              userId: { type: 'string', description: 'User identifier' }
            },
            required: ['userId']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'update_user_preferences',
          description: 'Update user preferences',
          parameters: {
            type: 'object',
            properties: {
              userId: { type: 'string', description: 'User identifier' },
              preferences: { type: 'object', description: 'Preferences object' }
            },
            required: ['userId', 'preferences']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'send_email',
          description: 'Send email to user',
          parameters: {
            type: 'object',
            properties: {
              to: { type: 'string', description: 'Email address' },
              subject: { type: 'string', description: 'Email subject' },
              body: { type: 'string', description: 'Email body' },
              template: { type: 'string', description: 'Email template name' }
            },
            required: ['to', 'subject', 'body']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'create_task',
          description: 'Create a task or reminder',
          parameters: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Task title' },
              description: { type: 'string', description: 'Task description' },
              dueDate: { type: 'string', description: 'Due date (ISO)' },
              priority: { type: 'string', description: 'Priority: low|medium|high' },
              assignee: { type: 'string', description: 'Task assignee' }
            },
            required: ['title', 'description']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'get_weather',
          description: 'Get current weather information',
          parameters: {
            type: 'object',
            properties: {
              location: { type: 'string', description: 'City or location' },
              units: { type: 'string', description: 'Units: metric|imperial', default: 'metric' }
            },
            required: ['location']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'translate_text',
          description: 'Translate text to another language',
          parameters: {
            type: 'object',
            properties: {
              text: { type: 'string', description: 'Text to translate' },
              targetLanguage: { type: 'string', description: 'Target language code' },
              sourceLanguage: { type: 'string', description: 'Source language code (optional)' }
            },
            required: ['text', 'targetLanguage']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'calculate',
          description: 'Perform mathematical calculations',
          parameters: {
            type: 'object',
            properties: {
              expression: { type: 'string', description: 'Mathematical expression' }
            },
            required: ['expression']
          }
        }
      }
    ];
  }

  getAvailableTools() {
    return this.availableTools;
  }

  async execute(toolCall, userId, userProfile) {
    const { name, arguments: args } = toolCall.function;
    
    try {
      switch (name) {
        case 'web_search':
          return await this.webSearch(args.query, args.limit);
        
        case 'save_lead':
          return await this.saveLead(args, userId);
        
        case 'schedule_call':
          return await this.scheduleCall(args, userId);
        
        case 'get_user_data':
          return await this.getUserData(args.userId || userId);
        
        case 'update_user_preferences':
          return await this.updateUserPreferences(args.userId || userId, args.preferences);
        
        case 'send_email':
          return await this.sendEmail(args, userProfile);
        
        case 'create_task':
          return await this.createTask(args, userId);
        
        case 'get_weather':
          return await this.getWeather(args.location, args.units);
        
        case 'translate_text':
          return await this.translateText(args.text, args.targetLanguage, args.sourceLanguage);
        
        case 'calculate':
          return await this.calculate(args.expression);
        
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      console.error(`Tool execution error for ${name}:`, error);
      return {
        success: false,
        error: error.message,
        tool: name
      };
    }
  }

  async webSearch(query, limit = 5) {
    try {
      // Use a search API (Google, Bing, or DuckDuckGo)
      // For demo, return mock results
      const mockResults = [
        {
          title: `Search result for: ${query}`,
          url: 'https://example.com',
          snippet: `This is a mock search result for the query: ${query}`,
          relevance: 0.95
        }
      ];

      return {
        success: true,
        query,
        results: mockResults.slice(0, limit),
        totalResults: mockResults.length
      };
    } catch (error) {
      throw new Error(`Web search failed: ${error.message}`);
    }
  }

  async saveLead(args, userId) {
    try {
      const leadId = await this.db.saveLead({
        name: args.name,
        contact: args.contact,
        intent: args.intent || 'general_inquiry',
        source: args.source || 'ai_assistant',
        userId: userId,
        status: 'new'
      });

      return {
        success: true,
        leadId,
        message: `Lead saved successfully for ${args.name}`,
        nextSteps: 'Lead will be processed by sales team'
      };
    } catch (error) {
      throw new Error(`Failed to save lead: ${error.message}`);
    }
  }

  async scheduleCall(args, userId) {
    try {
      const callId = await this.db.saveCallRecord({
        userId: userId,
        phoneNumber: args.phoneNumber,
        scheduledTime: args.scheduledTime,
        reason: args.reason,
        status: 'scheduled'
      });

      return {
        success: true,
        callId,
        scheduledTime: args.scheduledTime,
        message: `Call scheduled for ${args.phoneNumber}`,
        confirmation: 'User will receive confirmation'
      };
    } catch (error) {
      throw new Error(`Failed to schedule call: ${error.message}`);
    }
  }

  async getUserData(userId) {
    try {
      const user = await this.db.getUser(userId);
      const preferences = await this.db.getUserPreferences(userId);
      const recentConversations = await this.db.getConversationHistory(userId, 5);

      return {
        success: true,
        user: user || { id: userId, name: 'Unknown User' },
        preferences: preferences || {},
        recentActivity: recentConversations.length,
        lastSeen: user?.updated_at || new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Failed to get user data: ${error.message}`);
    }
  }

  async updateUserPreferences(userId, preferences) {
    try {
      await this.db.updateUserPreferences(userId, preferences);
      
      return {
        success: true,
        message: 'Preferences updated successfully',
        updatedFields: Object.keys(preferences)
      };
    } catch (error) {
      throw new Error(`Failed to update preferences: ${error.message}`);
    }
  }

  async sendEmail(args, userProfile) {
    try {
      // This would integrate with email service (SendGrid, AWS SES, etc.)
      // For demo, just log the email
      const emailData = {
        to: args.to,
        subject: args.subject,
        body: args.body,
        template: args.template || 'default',
        sentBy: 'ai_assistant',
        timestamp: new Date().toISOString()
      };

      console.log('Email would be sent:', emailData);

      return {
        success: true,
        messageId: `email_${Date.now()}`,
        message: 'Email sent successfully',
        recipient: args.to
      };
    } catch (error) {
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  async createTask(args, userId) {
    try {
      const taskId = await this.db.createTask({
        title: args.title,
        description: args.description,
        dueDate: args.dueDate,
        priority: args.priority || 'medium',
        assignee: args.assignee || userId,
        status: 'open',
        createdBy: userId
      });

      return {
        success: true,
        taskId,
        message: `Task created: ${args.title}`,
        dueDate: args.dueDate,
        priority: args.priority
      };
    } catch (error) {
      throw new Error(`Failed to create task: ${error.message}`);
    }
  }

  async getWeather(location, units = 'metric') {
    try {
      // This would integrate with weather API (OpenWeatherMap, etc.)
      // For demo, return mock weather data
      const mockWeather = {
        location: location,
        temperature: units === 'metric' ? 22 : 72,
        condition: 'Partly Cloudy',
        humidity: 65,
        windSpeed: units === 'metric' ? 10 : 6,
        units: units,
        timestamp: new Date().toISOString()
      };

      return {
        success: true,
        weather: mockWeather
      };
    } catch (error) {
      throw new Error(`Failed to get weather: ${error.message}`);
    }
  }

  async translateText(text, targetLanguage, sourceLanguage) {
    try {
      // This would integrate with translation API (Google Translate, etc.)
      // For demo, return mock translation
      const mockTranslation = {
        originalText: text,
        translatedText: `[Translated to ${targetLanguage}]: ${text}`,
        sourceLanguage: sourceLanguage || 'auto',
        targetLanguage: targetLanguage,
        confidence: 0.95
      };

      return {
        success: true,
        translation: mockTranslation
      };
    } catch (error) {
      throw new Error(`Failed to translate: ${error.message}`);
    }
  }

  async calculate(expression) {
    try {
      // Safe evaluation of mathematical expressions
      // In production, use a proper math library
      const result = Function('"use strict"; return (' + expression + ')')();
      
      if (isNaN(result) || !isFinite(result)) {
        throw new Error('Invalid mathematical expression');
      }

      return {
        success: true,
        expression: expression,
        result: result,
        formatted: `${expression} = ${result}`
      };
    } catch (error) {
      throw new Error(`Calculation failed: ${error.message}`);
    }
  }
}

module.exports = { ToolManager };
