const { OpenAI } = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');

class MultiModelAI {
  constructor() {
    // Initialize OpenAI
    this.openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
    
    // Initialize Anthropic Claude
    this.anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;
    
    // Initialize Google Gemini
    this.gemini = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
  }

  // Get available models
  getAvailableModels() {
    const models = [];
    
    if (this.openai) {
      models.push(
        { id: 'gpt-4o', provider: 'openai', name: 'GPT-4o', maxTokens: 128000 },
        { id: 'gpt-4o-mini', provider: 'openai', name: 'GPT-4o Mini', maxTokens: 128000 },
        { id: 'gpt-4-turbo', provider: 'openai', name: 'GPT-4 Turbo', maxTokens: 128000 },
        { id: 'gpt-3.5-turbo', provider: 'openai', name: 'GPT-3.5 Turbo', maxTokens: 16385 }
      );
    }
    
    if (this.anthropic) {
      models.push(
        { id: 'claude-3-5-sonnet-20241022', provider: 'anthropic', name: 'Claude 3.5 Sonnet', maxTokens: 200000 },
        { id: 'claude-3-opus-20240229', provider: 'anthropic', name: 'Claude 3 Opus', maxTokens: 200000 },
        { id: 'claude-3-sonnet-20240229', provider: 'anthropic', name: 'Claude 3 Sonnet', maxTokens: 200000 }
      );
    }
    
    if (this.gemini) {
      models.push(
        { id: 'gemini-1.5-pro', provider: 'google', name: 'Gemini 1.5 Pro', maxTokens: 1000000 },
        { id: 'gemini-1.5-flash', provider: 'google', name: 'Gemini 1.5 Flash', maxTokens: 1000000 },
        { id: 'gemini-pro', provider: 'google', name: 'Gemini Pro', maxTokens: 32768 }
      );
    }
    
    return models;
  }

  // Generate response with specified model
  async generate(modelId, messages, systemPrompt, options = {}) {
    const modelInfo = this.getAvailableModels().find(m => m.id === modelId);
    
    if (!modelInfo) {
      throw new Error(`Model ${modelId} not available or not configured`);
    }

    try {
      switch (modelInfo.provider) {
        case 'openai':
          return await this.generateOpenAI(modelId, messages, systemPrompt, options);
        case 'anthropic':
          return await this.generateAnthropic(modelId, messages, systemPrompt, options);
        case 'google':
          return await this.generateGemini(modelId, messages, systemPrompt, options);
        default:
          throw new Error(`Unsupported provider: ${modelInfo.provider}`);
      }
    } catch (error) {
      console.error(`Error generating with ${modelId}:`, error.message);
      
      // Fallback to demo mode if API fails
      if (error.message.includes('401') || error.message.includes('402') || error.message.includes('429')) {
        return this.generateDemoResponse(messages);
      }
      
      throw error;
    }
  }

  // OpenAI generation
  async generateOpenAI(model, messages, systemPrompt, options) {
    if (!this.openai) throw new Error('OpenAI not configured');
    
    const response = await this.openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 2000,
      stream: options.stream || false
    });

    return {
      content: response.choices[0].message.content,
      model,
      provider: 'openai',
      usage: response.usage,
      finishReason: response.choices[0].finish_reason
    };
  }

  // Anthropic Claude generation
  async generateAnthropic(model, messages, systemPrompt, options) {
    if (!this.anthropic) throw new Error('Anthropic not configured');
    
    // Convert messages to Claude format
    const claudeMessages = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content
    }));

    const response = await this.anthropic.messages.create({
      model,
      max_tokens: options.maxTokens || 2000,
      system: systemPrompt,
      messages: claudeMessages,
      temperature: options.temperature || 0.7
    });

    return {
      content: response.content[0].text,
      model,
      provider: 'anthropic',
      usage: {
        prompt_tokens: response.usage.input_tokens,
        completion_tokens: response.usage.output_tokens,
        total_tokens: response.usage.input_tokens + response.usage.output_tokens
      },
      finishReason: response.stop_reason
    };
  }

  // Google Gemini generation
  async generateGemini(model, messages, systemPrompt, options) {
    if (!this.gemini) throw new Error('Gemini not configured');
    
    const geminiModel = this.gemini.getGenerativeModel({ model });
    
    // Combine system prompt with messages
    const fullPrompt = `${systemPrompt}\n\n` + messages.map(m => 
      `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${m.content}`
    ).join('\n\n');

    const response = await geminiModel.generateContent(fullPrompt);
    
    return {
      content: response.response.text(),
      model,
      provider: 'google',
      usage: {
        prompt_tokens: response.response.usageMetadata?.promptTokenCount || 0,
        completion_tokens: response.response.usageMetadata?.candidatesTokenCount || 0,
        total_tokens: response.response.usageMetadata?.totalTokenCount || 0
      },
      finishReason: response.response.candidates[0].finishReason
    };
  }

  // Demo fallback response
  generateDemoResponse(messages) {
    const lastMessage = messages[messages.length - 1]?.content || '';
    
    const responses = [
      "That's an interesting question! Let me help you with that.",
      "I understand what you're asking. Here's what I think...",
      "Great point! Here's my perspective on this.",
      "I can definitely help with that. Let me explain...",
      "That's a thoughtful question. Here's my response..."
    ];
    
    return {
      content: responses[Math.floor(Math.random() * responses.length)] + " (Demo Mode - Configure API key for real AI responses)",
      model: 'demo',
      provider: 'demo',
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      finishReason: 'demo'
    };
  }

  // Stream response (for real-time typing effect)
  async *streamGenerate(modelId, messages, systemPrompt, options = {}) {
    const modelInfo = this.getAvailableModels().find(m => m.id === modelId);
    
    if (!modelInfo) {
      throw new Error(`Model ${modelId} not available`);
    }

    if (modelInfo.provider === 'openai' && this.openai) {
      const stream = await this.openai.chat.completions.create({
        model: modelId,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 2000,
        stream: true
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield { type: 'content', content, model: modelId, provider: 'openai' };
        }
        if (chunk.choices[0]?.finish_reason) {
          yield { type: 'done', finishReason: chunk.choices[0].finish_reason };
        }
      }
    } else {
      // Non-streaming fallback
      const response = await this.generate(modelId, messages, systemPrompt, options);
      yield { type: 'content', content: response.content, model: modelId, provider: response.provider };
      yield { type: 'done', finishReason: response.finishReason };
    }
  }
}

module.exports = { MultiModelAI };
