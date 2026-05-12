class MemoryManager {
  constructor(database) {
    this.db = database;
    this.shortTermLimit = 20; // Last 20 messages
    this.longTermLimit = 100; // Important memories
  }

  async storeShortTerm(userId, sender, message, metadata = {}) {
    try {
      // Store in conversation table (as before)
      await this.db.saveMessage(userId, sender, message);
      
      // Also store in enhanced memory table
      await this.db.storeMemory({
        userId,
        type: 'short_term',
        content: message,
        sender,
        metadata,
        timestamp: new Date().toISOString(),
        importance: 0.5 // Default importance for short-term
      });
    } catch (error) {
      console.error('Error storing short-term memory:', error);
    }
  }

  async storeLongTerm(userId, content, type = 'preference', importance = 0.8) {
    try {
      await this.db.storeMemory({
        userId,
        type: 'long_term',
        content,
        memoryType: type, // preference, fact, pattern, goal
        importance,
        timestamp: new Date().toISOString(),
        embedding: await this.generateEmbedding(content)
      });
    } catch (error) {
      console.error('Error storing long-term memory:', error);
    }
  }

  async getShortTerm(userId, limit = this.shortTermLimit) {
    try {
      const memories = await this.db.getMemories(userId, 'short_term', limit);
      return memories.map(mem => ({
        role: mem.sender === 'user' ? 'user' : 'assistant',
        content: mem.content,
        timestamp: mem.timestamp
      }));
    } catch (error) {
      console.error('Error getting short-term memory:', error);
      return [];
    }
  }

  async getLongTerm(userId, limit = this.longTermLimit) {
    try {
      const memories = await this.db.getMemories(userId, 'long_term', limit);
      return memories.map(mem => ({
        content: mem.content,
        type: mem.memoryType,
        importance: mem.importance,
        timestamp: mem.timestamp
      }));
    } catch (error) {
      console.error('Error getting long-term memory:', error);
      return [];
    }
  }

  async searchMemory(userId, query, type = 'all') {
    try {
      // Generate embedding for query
      const queryEmbedding = await this.generateEmbedding(query);
      
      // Search using vector similarity
      const results = await this.db.searchMemories(userId, queryEmbedding, type);
      
      return results.map(mem => ({
        content: mem.content,
        type: mem.type,
        memoryType: mem.memoryType,
        similarity: mem.similarity,
        timestamp: mem.timestamp
      }));
    } catch (error) {
      console.error('Error searching memory:', error);
      return [];
    }
  }

  async extractAndStoreImportantInfo(userId, message, sender) {
    try {
      // Use AI to extract important information
      const extraction = await this.extractImportantInfo(message);
      
      if (extraction.important) {
        for (const info of extraction.information) {
          await this.storeLongTerm(
            userId, 
            info.content, 
            info.type, 
            info.importance
          );
        }
      }
    } catch (error) {
      console.error('Error extracting important info:', error);
    }
  }

  async extractImportantInfo(message) {
    // This would use OpenAI to extract important information
    // For now, return placeholder
    return {
      important: false,
      information: []
    };
  }

  async generateEmbedding(text) {
    // Placeholder - would use OpenAI embeddings API
    // Return dummy embedding for now
    return new Array(1536).fill(0).map(() => Math.random() - 0.5);
  }

  async consolidateMemories(userId) {
    try {
      // Get old short-term memories
      const oldMemories = await this.db.getOldShortTermMemories(userId, 30);
      
      for (const memory of oldMemories) {
        // Check if should be promoted to long-term
        const shouldPromote = await this.evaluateMemoryImportance(memory);
        
        if (shouldPromote) {
          await this.storeLongTerm(
            userId,
            memory.content,
            'conversation_memory',
            0.6
          );
        }
        
        // Remove from short-term
        await this.db.deleteMemory(memory.id);
      }
    } catch (error) {
      console.error('Error consolidating memories:', error);
    }
  }

  async evaluateMemoryImportance(memory) {
    // Use AI to evaluate if memory should be kept long-term
    const evaluationPrompt = `
Evaluate this conversation memory for long-term storage:

Memory: "${memory.content}"
Sender: ${memory.sender}
Age: ${Date.now() - new Date(memory.timestamp).getTime()}ms ago

Return JSON:
{
  "important": true/false,
  "reason": "reason for decision",
  "category": "personal|preference|fact|event|other",
  "importance": 0.0-1.0
}
`;

    try {
      // This would call OpenAI API
      // For now, return false
      return false;
    } catch (error) {
      return false;
    }
  }

  async getUserPreferences(userId) {
    try {
      const preferences = await this.db.getMemories(userId, 'long_term', 50);
      return preferences
        .filter(mem => mem.memoryType === 'preference')
        .reduce((acc, mem) => {
          try {
            const pref = JSON.parse(mem.content);
            return { ...acc, ...pref };
          } catch {
            return acc;
          }
        }, {});
    } catch (error) {
      console.error('Error getting user preferences:', error);
      return {};
    }
  }

  async updateUserPreferences(userId, newPreferences) {
    try {
      await this.storeLongTerm(
        userId,
        JSON.stringify(newPreferences),
        'preference',
        0.9
      );
    } catch (error) {
      console.error('Error updating user preferences:', error);
    }
  }

  async getConversationSummary(userId, days = 7) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      const conversations = await this.db.getConversationsSince(userId, startDate);
      
      // Use AI to summarize conversations
      const summaryPrompt = `
Summarize these conversations into key insights:

${conversations.map(conv => `${conv.sender}: ${conv.content}`).join('\n')}

Return JSON:
{
  "summary": "brief summary",
  "topics": ["topic1", "topic2"],
  "sentiment": "positive|neutral|negative",
  "patterns": ["pattern1", "pattern2"],
  "actionItems": ["item1", "item2"]
}
`;

      // This would call OpenAI API
      // For now, return placeholder
      return {
        summary: "Recent conversations show user engagement",
        topics: [],
        sentiment: "neutral",
        patterns: [],
        actionItems: []
      };
    } catch (error) {
      console.error('Error getting conversation summary:', error);
      return null;
    }
  }

  async cleanupOldMemories(userId) {
    try {
      // Remove old short-term memories
      await this.db.cleanupOldMemories(userId, 'short_term', 60); // 60 days
      
      // Remove low-importance long-term memories
      await this.db.cleanupLowImportanceMemories(userId, 0.3); // Below 0.3 importance
    } catch (error) {
      console.error('Error cleaning up memories:', error);
    }
  }
}

module.exports = { MemoryManager };
