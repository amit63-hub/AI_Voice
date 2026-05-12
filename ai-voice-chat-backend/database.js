const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

class Database {
  constructor(databaseUrl) {
    this.dbPath = databaseUrl ? databaseUrl.replace('file:', '') : path.join(__dirname, 'dev.db');
    this.db = null;
    this.ready = this.init();
  }

  async init() {
    try {
      const SQL = await initSqlJs();
      
      // Try to load existing database file
      if (fs.existsSync(this.dbPath)) {
        const fileBuffer = fs.readFileSync(this.dbPath);
        this.db = new SQL.Database(fileBuffer);
      } else {
        this.db = new SQL.Database();
      }
      
      console.log('Connected to SQLite database (sql.js)');
      this.createTables();
    } catch (error) {
      console.error('Database initialization error:', error);
    }
  }

  save() {
    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(this.dbPath, buffer);
    } catch (error) {
      console.error('Database save error:', error);
    }
  }

  createTables() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT,
        email TEXT,
        phone TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        sender TEXT NOT NULL,
        message TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS leads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        contact TEXT NOT NULL,
        intent TEXT,
        source TEXT DEFAULT 'manual',
        status TEXT DEFAULT 'new',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS calls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        phone_number TEXT NOT NULL,
        status TEXT DEFAULT 'requested',
        direction TEXT DEFAULT 'outbound',
        duration INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        plan TEXT DEFAULT 'free',
        status TEXT DEFAULT 'active',
        stripe_session_id TEXT,
        current_period_start DATETIME,
        current_period_end DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS api_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        model TEXT,
        tokens_used INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `);

    this.save();
  }

  // User operations
  async getUser(userId) {
    await this.ready;
    const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
    stmt.bind([userId]);
    let row = null;
    if (stmt.step()) {
      const values = stmt.get();
      const columns = stmt.getColumnNames();
      row = {};
      columns.forEach((col, i) => { row[col] = values[i]; });
    }
    stmt.free();
    return row;
  }

  async createUser(userData) {
    await this.ready;
    const { id, name, email, phone } = userData;
    this.db.run('INSERT INTO users (id, name, email, phone) VALUES (?, ?, ?, ?)', [id, name, email, phone]);
    this.save();
    const result = this.db.exec('SELECT last_insert_rowid() as id');
    const lastId = result.length > 0 ? result[0].values[0][0] : id;
    return { id: lastId };
  }

  // Conversation operations
  async saveMessage(userId, sender, message) {
    await this.ready;
    this.db.run('INSERT INTO conversations (user_id, sender, message) VALUES (?, ?, ?)', [userId, sender, message]);
    this.save();
    const result = this.db.exec('SELECT last_insert_rowid() as id');
    const lastId = result.length > 0 ? result[0].values[0][0] : null;
    return { id: lastId };
  }

  async getConversationHistory(userId, limit = 50) {
    await this.ready;
    const stmt = this.db.prepare(`
      SELECT * FROM conversations 
      WHERE user_id = ? 
      ORDER BY timestamp ASC 
      LIMIT ?
    `);
    stmt.bind([userId, limit]);
    const rows = [];
    while (stmt.step()) {
      const values = stmt.get();
      const columns = stmt.getColumnNames();
      const row = {};
      columns.forEach((col, i) => { row[col] = values[i]; });
      rows.push(row);
    }
    stmt.free();
    return rows;
  }

  // Lead operations
  async saveLead(leadData) {
    await this.ready;
    const { name, contact, intent, source, status } = leadData;
    this.db.run(`
      INSERT INTO leads (name, contact, intent, source, status) 
      VALUES (?, ?, ?, ?, ?)
    `, [name, contact, intent, source, status]);
    this.save();
    const result = this.db.exec('SELECT last_insert_rowid() as id');
    const lastId = result.length > 0 ? result[0].values[0][0] : null;
    return { id: lastId };
  }

  async getLeads(status = null) {
    await this.ready;
    let query = 'SELECT * FROM leads';
    let params = [];
    
    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY created_at DESC';
    
    const stmt = this.db.prepare(query);
    if (params.length > 0) stmt.bind(params);
    const rows = [];
    while (stmt.step()) {
      const values = stmt.get();
      const columns = stmt.getColumnNames();
      const row = {};
      columns.forEach((col, i) => { row[col] = values[i]; });
      rows.push(row);
    }
    stmt.free();
    return rows;
  }

  async updateLeadStatus(leadId, status) {
    await this.ready;
    this.db.run('UPDATE leads SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, leadId]);
    this.save();
    const result = this.db.exec('SELECT changes()');
    const changes = result.length > 0 ? result[0].values[0][0] : 0;
    return { changes };
  }

  // Call operations
  async saveCallRecord(userId, phoneNumber, status, direction = 'outbound') {
    await this.ready;
    this.db.run(`
      INSERT INTO calls (user_id, phone_number, status, direction) 
      VALUES (?, ?, ?, ?)
    `, [userId, phoneNumber, status, direction]);
    this.save();
    const result = this.db.exec('SELECT last_insert_rowid() as id');
    const lastId = result.length > 0 ? result[0].values[0][0] : null;
    return { id: lastId };
  }

  async updateCallStatus(callId, status, duration = null) {
    await this.ready;
    let query = 'UPDATE calls SET status = ?';
    let params = [status];
    
    if (duration !== null) {
      query += ', duration = ?, completed_at = CURRENT_TIMESTAMP';
      params.push(duration);
    }
    
    query += ' WHERE id = ?';
    params.push(callId);
    
    this.db.run(query, params);
    this.save();
    const result = this.db.exec('SELECT changes()');
    const changes = result.length > 0 ? result[0].values[0][0] : 0;
    return { changes };
  }

  async getCallRecords(userId = null) {
    await this.ready;
    let query = 'SELECT * FROM calls';
    let params = [];
    
    if (userId) {
      query += ' WHERE user_id = ?';
      params.push(userId);
    }
    
    query += ' ORDER BY created_at DESC';
    
    const stmt = this.db.prepare(query);
    if (params.length > 0) stmt.bind(params);
    const rows = [];
    while (stmt.step()) {
      const values = stmt.get();
      const columns = stmt.getColumnNames();
      const row = {};
      columns.forEach((col, i) => { row[col] = values[i]; });
      rows.push(row);
    }
    stmt.free();
    return rows;
  }

  // Health check
  async healthCheck() {
    await this.ready;
    this.db.exec('SELECT 1 as test');
    return { status: 'healthy', timestamp: new Date().toISOString() };
  }

  // Subscription operations
  async getSubscription(userId) {
    await this.ready;
    const stmt = this.db.prepare('SELECT * FROM subscriptions WHERE user_id = ? AND status = ? ORDER BY created_at DESC LIMIT 1');
    stmt.bind([userId, 'active']);
    let row = null;
    if (stmt.step()) {
      const values = stmt.get();
      const columns = stmt.getColumnNames();
      row = {};
      columns.forEach((col, i) => { row[col] = values[i]; });
    }
    stmt.free();
    return row || { plan: 'free', status: 'active' };
  }

  async createSubscription(userId, plan, stripeSessionId = null) {
    await this.ready;
    const now = new Date().toISOString();
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    this.db.run(
      'INSERT INTO subscriptions (user_id, plan, status, stripe_session_id, current_period_start, current_period_end) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, plan, 'active', stripeSessionId, now, periodEnd]
    );
    this.save();
    return { plan, status: 'active', current_period_end: periodEnd };
  }

  async updateSubscription(userId, plan) {
    await this.ready;
    this.db.run('UPDATE subscriptions SET plan = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND status = ?', [plan, userId, 'active']);
    this.save();
    return { plan };
  }

  // API usage tracking
  async trackApiUsage(userId, endpoint, model = null, tokensUsed = 0) {
    await this.ready;
    this.db.run('INSERT INTO api_usage (user_id, endpoint, model, tokens_used) VALUES (?, ?, ?, ?)', [userId, endpoint, model, tokensUsed]);
    this.save();
  }

  async getApiUsage(userId, days = 30) {
    await this.ready;
    const stmt = this.db.prepare(`
      SELECT date(created_at) as date, endpoint, model, SUM(tokens_used) as total_tokens, COUNT(*) as request_count
      FROM api_usage 
      WHERE user_id = ? AND created_at >= datetime('now', '-' || ? || ' days')
      GROUP BY date(created_at), endpoint
      ORDER BY date DESC
    `);
    stmt.bind([userId, days]);
    const rows = [];
    while (stmt.step()) {
      const values = stmt.get();
      const columns = stmt.getColumnNames();
      const row = {};
      columns.forEach((col, i) => { row[col] = values[i]; });
      rows.push(row);
    }
    stmt.free();
    return rows;
  }

  async getMessageCount(userId, days = 1) {
    await this.ready;
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM conversations 
      WHERE user_id = ? AND sender = 'user' AND timestamp >= datetime('now', '-' || ? || ' days')
    `);
    stmt.bind([userId, days]);
    let count = 0;
    if (stmt.step()) {
      count = stmt.get()[0];
    }
    stmt.free();
    return count;
  }

  // Session operations
  async createSession(sessionId, userId, token, expiresAt) {
    await this.ready;
    this.db.run('INSERT OR REPLACE INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)', [sessionId, userId, token, expiresAt]);
    this.save();
    return { id: sessionId, userId, expiresAt };
  }

  async getSession(sessionId) {
    await this.ready;
    const stmt = this.db.prepare('SELECT * FROM sessions WHERE id = ? AND expires_at > datetime("now")');
    stmt.bind([sessionId]);
    let row = null;
    if (stmt.step()) {
      const values = stmt.get();
      const columns = stmt.getColumnNames();
      row = {};
      columns.forEach((col, i) => { row[col] = values[i]; });
    }
    stmt.free();
    return row;
  }

  async deleteSession(sessionId) {
    await this.ready;
    this.db.run('DELETE FROM sessions WHERE id = ?', [sessionId]);
    this.save();
  }

  // Analytics
  async getDashboardStats() {
    await this.ready;
    const stats = {};

    const usersResult = this.db.exec('SELECT COUNT(*) as count FROM users');
    stats.totalUsers = usersResult.length > 0 ? usersResult[0].values[0][0] : 0;

    const leadsResult = this.db.exec('SELECT COUNT(*) as count FROM leads');
    stats.totalLeads = leadsResult.length > 0 ? leadsResult[0].values[0][0] : 0;

    const convosResult = this.db.exec("SELECT COUNT(*) as count FROM conversations WHERE timestamp >= datetime('now', '-1 day')");
    stats.todayMessages = convosResult.length > 0 ? convosResult[0].values[0][0] : 0;

    const proResult = this.db.exec("SELECT COUNT(*) as count FROM subscriptions WHERE plan != 'free' AND status = 'active'");
    stats.proUsers = proResult.length > 0 ? proResult[0].values[0][0] : 0;

    return stats;
  }

  async close() {
    if (this.db) {
      this.save();
      this.db.close();
    }
  }
}

module.exports = { Database };
