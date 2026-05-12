const { Pool } = require('pg');
const Redis = require('redis');

class ProductionDatabase {
  constructor() {
    this.pool = null;
    this.redis = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      // PostgreSQL connection
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        max: 20, // Maximum number of clients
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

      // Redis connection (if available)
      if (process.env.REDIS_URL) {
        this.redis = Redis.createClient({
          url: process.env.REDIS_URL,
          retry_strategy: (options) => {
            if (options.error && options.error.code === 'ECONNREFUSED') {
              return new Error('Redis server refused connection');
            }
            if (options.total_retry_time > 1000 * 60 * 60) {
              return new Error('Retry time exhausted');
            }
            if (options.attempt > 10) {
              return undefined;
            }
            return Math.min(options.attempt * 100, 3000);
          }
        });

        await this.redis.connect();
      }

      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();

      this.isConnected = true;
      console.log('Production database connected successfully');
      
      // Run migrations
      await this.runMigrations();
      
    } catch (error) {
      console.error('Database connection error:', error);
      throw error;
    }
  }

  async runMigrations() {
    try {
      const migrations = [
        // Users table
        `CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email VARCHAR(255) UNIQUE NOT NULL,
          name VARCHAR(255) NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          subscription_plan VARCHAR(50) DEFAULT 'free',
          subscription_status VARCHAR(50) DEFAULT 'active',
          api_usage_count INTEGER DEFAULT 0,
          api_usage_limit INTEGER DEFAULT 1000,
          preferences JSONB DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )`,
        
        // Conversations table
        `CREATE TABLE IF NOT EXISTS conversations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          title VARCHAR(255),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )`,
        
        // Messages table
        `CREATE TABLE IF NOT EXISTS messages (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
          role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
          content TEXT NOT NULL,
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )`,
        
        // Memory table
        `CREATE TABLE IF NOT EXISTS memories (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          type VARCHAR(50) NOT NULL CHECK (type IN ('short_term', 'long_term')),
          content TEXT NOT NULL,
          memory_type VARCHAR(50),
          importance FLOAT DEFAULT 0.5,
          embedding VECTOR(1536), -- For pgvector
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )`,
        
        // Leads table
        `CREATE TABLE IF NOT EXISTS leads (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          contact VARCHAR(255) NOT NULL,
          intent VARCHAR(255),
          source VARCHAR(100) DEFAULT 'ai_assistant',
          status VARCHAR(50) DEFAULT 'new',
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )`,
        
        // API usage tracking
        `CREATE TABLE IF NOT EXISTS api_usage (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          endpoint VARCHAR(255) NOT NULL,
          method VARCHAR(10) NOT NULL,
          status_code INTEGER NOT NULL,
          response_time INTEGER, -- in milliseconds
          tokens_used INTEGER DEFAULT 0,
          cost DECIMAL(10, 6) DEFAULT 0.000000,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )`,
        
        // Subscriptions table
        `CREATE TABLE IF NOT EXISTS subscriptions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          plan VARCHAR(50) NOT NULL,
          status VARCHAR(50) NOT NULL,
          stripe_subscription_id VARCHAR(255),
          current_period_start TIMESTAMP WITH TIME ZONE,
          current_period_end TIMESTAMP WITH TIME ZONE,
          cancel_at_period_end BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )`,
        
        // Create indexes
        `CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id)`,
        `CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id)`,
        `CREATE INDEX IF NOT EXISTS idx_memories_user_id ON memories(user_id)`,
        `CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type)`,
        `CREATE INDEX IF NOT EXISTS idx_leads_user_id ON leads(user_id)`,
        `CREATE INDEX IF NOT EXISTS idx_api_usage_user_id ON api_usage(user_id)`,
        `CREATE INDEX IF NOT EXISTS idx_api_usage_created_at ON api_usage(created_at)`,
        `CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id)`
      ];

      const client = await this.pool.connect();
      
      for (const migration of migrations) {
        await client.query(migration);
      }
      
      client.release();
      console.log('Database migrations completed');
      
    } catch (error) {
      console.error('Migration error:', error);
      throw error;
    }
  }

  // User operations
  async createUser(userData) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        INSERT INTO users (email, name, password_hash, preferences)
        VALUES ($1, $2, $3, $4)
        RETURNING id, email, name, subscription_plan, created_at
      `, [userData.email, userData.name, userData.passwordHash, userData.preferences || {}]);
      
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async getUser(userId) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT id, email, name, subscription_plan, subscription_status, 
               api_usage_count, api_usage_limit, preferences, created_at
        FROM users WHERE id = $1
      `, [userId]);
      
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async getUserByEmail(email) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT id, email, name, password_hash, subscription_plan, subscription_status,
               api_usage_count, api_usage_limit, preferences, created_at
        FROM users WHERE email = $1
      `, [email]);
      
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async updateUser(userId, updates) {
    const client = await this.pool.connect();
    try {
      const setClause = Object.keys(updates).map((key, index) => `${key} = $${index + 2}`).join(', ');
      const values = Object.values(updates);
      
      const result = await client.query(`
        UPDATE users 
        SET ${setClause}, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `, [userId, ...values]);
      
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  // Conversation operations
  async createConversation(userId, title = null) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        INSERT INTO conversations (user_id, title)
        VALUES ($1, $2)
        RETURNING *
      `, [userId, title]);
      
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async getConversations(userId, limit = 50, offset = 0) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT c.*, COUNT(m.id) as message_count
        FROM conversations c
        LEFT JOIN messages m ON c.id = m.conversation_id
        WHERE c.user_id = $1
        GROUP BY c.id
        ORDER BY c.updated_at DESC
        LIMIT $2 OFFSET $3
      `, [userId, limit, offset]);
      
      return result.rows;
    } finally {
      client.release();
    }
  }

  async saveMessage(conversationId, role, content, metadata = {}) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        INSERT INTO messages (conversation_id, role, content, metadata)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [conversationId, role, content, metadata]);
      
      // Update conversation timestamp
      await client.query(`
        UPDATE conversations 
        SET updated_at = NOW()
        WHERE id = $1
      `, [conversationId]);
      
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async getMessages(conversationId, limit = 100) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT * FROM messages
        WHERE conversation_id = $1
        ORDER BY created_at ASC
        LIMIT $2
      `, [conversationId, limit]);
      
      return result.rows;
    } finally {
      client.release();
    }
  }

  // Memory operations
  async storeMemory(memoryData) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        INSERT INTO memories (user_id, type, content, memory_type, importance, embedding, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [
        memoryData.userId,
        memoryData.type,
        memoryData.content,
        memoryData.memoryType,
        memoryData.importance,
        memoryData.embedding,
        memoryData.metadata || {}
      ]);
      
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async getMemories(userId, type = null, limit = 50) {
    const client = await this.pool.connect();
    try {
      let query = `
        SELECT * FROM memories
        WHERE user_id = $1
      `;
      const params = [userId];
      
      if (type) {
        query += ` AND type = $2 ORDER BY created_at DESC LIMIT $3`;
        params.push(type, limit);
      } else {
        query += ` ORDER BY created_at DESC LIMIT $2`;
        params.push(limit);
      }
      
      const result = await client.query(query, params);
      return result.rows;
    } finally {
      client.release();
    }
  }

  // API usage tracking
  async trackApiUsage(usageData) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        INSERT INTO api_usage (user_id, endpoint, method, status_code, response_time, tokens_used, cost)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [
        usageData.userId,
        usageData.endpoint,
        usageData.method,
        usageData.statusCode,
        usageData.responseTime,
        usageData.tokensUsed || 0,
        usageData.cost || 0
      ]);
      
      // Update user usage count
      await client.query(`
        UPDATE users 
        SET api_usage_count = api_usage_count + 1
        WHERE id = $1
      `, [usageData.userId]);
      
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  // Redis operations (caching)
  async cacheGet(key) {
    if (!this.redis) return null;
    try {
      return await this.redis.get(key);
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  }

  async cacheSet(key, value, ttl = 3600) {
    if (!this.redis) return;
    try {
      await this.redis.setEx(key, ttl, JSON.stringify(value));
    } catch (error) {
      console.error('Redis set error:', error);
    }
  }

  async cacheDelete(key) {
    if (!this.redis) return;
    try {
      await this.redis.del(key);
    } catch (error) {
      console.error('Redis delete error:', error);
    }
  }

  // Health check
  async healthCheck() {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      
      const redisStatus = this.redis ? 'connected' : 'disconnected';
      
      return {
        status: 'healthy',
        postgresql: 'connected',
        redis: redisStatus,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
    }
    if (this.redis) {
      await this.redis.quit();
    }
    this.isConnected = false;
  }
}

module.exports = { ProductionDatabase };
