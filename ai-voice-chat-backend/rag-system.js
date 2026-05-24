const { Pinecone } = require('@pinecone-database/pinecone');
const { OpenAI } = require('openai');

class RAGSystem {
  constructor() {
    // Initialize Pinecone for vector storage
    this.pinecone = process.env.PINECONE_API_KEY 
      ? new Pinecone({ apiKey: process.env.PINECONE_API_KEY })
      : null;
    
    this.indexName = process.env.PINECONE_INDEX || 'ai-chat-knowledge';
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.embeddingModel = 'text-embedding-3-small';
  }

  // Initialize Pinecone index
  async initIndex() {
    if (!this.pinecone) return null;
    
    try {
      const existingIndexes = await this.pinecone.listIndexes();
      const indexExists = existingIndexes.indexes?.some(i => i.name === this.indexName);
      
      if (!indexExists) {
        await this.pinecone.createIndex({
          name: this.indexName,
          dimension: 1536,
          metric: 'cosine',
          spec: {
            serverless: {
              cloud: 'aws',
              region: 'us-east-1'
            }
          }
        });
        console.log(`Created Pinecone index: ${this.indexName}`);
      }
      
      return this.pinecone.index(this.indexName);
    } catch (error) {
      console.error('Pinecone init error:', error);
      return null;
    }
  }

  // Add document to knowledge base
  async addDocument(userId, content, metadata = {}) {
    try {
      const index = await this.initIndex();
      if (!index) return null;

      // Generate embedding
      const embedding = await this.generateEmbedding(content);
      
      // Store in Pinecone
      await index.upsert([{
        id: `${userId}-${Date.now()}`,
        values: embedding,
        metadata: {
          userId,
          content,
          ...metadata,
          timestamp: new Date().toISOString()
        }
      }]);

      return { success: true, id: `${userId}-${Date.now()}` };
    } catch (error) {
      console.error('Add document error:', error);
      return { success: false, error: error.message };
    }
  }

  // Search knowledge base
  async search(userId, query, topK = 5) {
    try {
      const index = await this.initIndex();
      if (!index) return [];

      const queryEmbedding = await this.generateEmbedding(query);
      
      const results = await index.query({
        vector: queryEmbedding,
        filter: { userId },
        topK,
        includeMetadata: true
      });

      return results.matches?.map(match => ({
        content: match.metadata.content,
        score: match.score,
        metadata: match.metadata
      })) || [];
    } catch (error) {
      console.error('Search error:', error);
      return [];
    }
  }

  // Generate embedding
  async generateEmbedding(text) {
    const response = await this.openai.embeddings.create({
      model: this.embeddingModel,
      input: text
    });
    return response.data[0].embedding;
  }

  // RAG-enhanced chat
  async ragChat(userId, query, systemPrompt, model = 'gpt-4o-mini') {
    try {
      // Search knowledge base
      const contextDocs = await this.search(userId, query, 3);
      
      // Build context
      const context = contextDocs.length > 0
        ? `\n\nRelevant context from your knowledge base:\n${contextDocs.map((doc, i) => 
            `[${i + 1}] ${doc.content}`
          ).join('\n\n')}`
        : '';

      // Enhanced system prompt
      const enhancedPrompt = `${systemPrompt}${context}\n\nUse the provided context to give more accurate and personalized responses. If the context doesn't contain relevant information, answer based on your general knowledge.`;

      // Generate response
      const response = await this.openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: enhancedPrompt },
          { role: 'user', content: query }
        ],
        temperature: 0.7
      });

      return {
        content: response.choices[0].message.content,
        contextUsed: contextDocs.length,
        sources: contextDocs.map(doc => doc.metadata.title || 'Document')
      };
    } catch (error) {
      console.error('RAG chat error:', error);
      throw error;
    }
  }

  // Delete user's knowledge base
  async deleteUserKnowledge(userId) {
    try {
      const index = await this.initIndex();
      if (!index) return { success: false };

      await index.delete({ filter: { userId } });
      return { success: true };
    } catch (error) {
      console.error('Delete knowledge error:', error);
      return { success: false, error: error.message };
    }
  }

  // Get knowledge base stats
  async getKnowledgeStats(userId) {
    try {
      const index = await this.initIndex();
      if (!index) return { totalDocs: 0 };

      // Pinecone doesn't have a direct count, so we'd need to query and count
      // For now, return placeholder
      return { totalDocs: 0, lastUpdated: new Date().toISOString() };
    } catch (error) {
      console.error('Stats error:', error);
      return { totalDocs: 0 };
    }
  }
}

module.exports = { RAGSystem };
