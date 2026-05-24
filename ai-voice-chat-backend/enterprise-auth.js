const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const SamlStrategy = require('passport-saml').Strategy;
const jwt = require('jsonwebtoken');

class EnterpriseAuth {
  constructor(db) {
    this.db = db;
    this.passport = passport;
    this.setupStrategies();
  }

  setupStrategies() {
    // Google OAuth
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
      this.passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback'
      }, async (accessToken, refreshToken, profile, done) => {
        try {
          let user = await this.db.getUserByEmail(profile.emails[0].value);
          
          if (!user) {
            user = await this.db.createUser({
              name: profile.displayName,
              email: profile.emails[0].value,
              plan: 'free',
              authProvider: 'google',
              authProviderId: profile.id
            });
          } else {
            // Update auth provider info
            await this.db.updateUser(user.userId, {
              authProvider: 'google',
              authProviderId: profile.id
            });
          }
          
          done(null, user);
        } catch (error) {
          done(error);
        }
      }));
    }

    // SAML for enterprise SSO
    if (process.env.SAML_ENTRY_POINT && process.env.SAML_ISSUER) {
      this.passport.use(new SamlStrategy({
        entryPoint: process.env.SAML_ENTRY_POINT,
        issuer: process.env.SAML_ISSUER,
        cert: process.env.SAML_CERT
      }, async (profile, done) => {
        try {
          let user = await this.db.getUserByEmail(profile.nameID);
          
          if (!user) {
            user = await this.db.createUser({
              name: profile.displayName || profile.nameID,
              email: profile.nameID,
              plan: 'enterprise',
              authProvider: 'saml',
              authProviderId: profile.nameID
            });
          }
          
          done(null, user);
        } catch (error) {
          done(error);
        }
      }));
    }
  }

  // Role-Based Access Control (RBAC)
  async checkPermission(userId, permission, resource) {
    const user = await this.db.getUser(userId);
    const role = user.role || 'user';

    const permissions = {
      admin: ['*'], // All permissions
      manager: ['read', 'write', 'delete', 'manage_users'],
      user: ['read', 'write'],
      guest: ['read']
    };

    const userPermissions = permissions[role] || permissions.user;

    if (userPermissions.includes('*')) return true;
    if (userPermissions.includes(permission)) return true;
    if (userPermissions.includes(`${permission}:${resource}`)) return true;

    return false;
  }

  // Audit logging
  async logAudit(userId, action, resource, details = {}) {
    try {
      await this.db.insert('audit_logs', {
        userId,
        action,
        resource,
        details: JSON.stringify(details),
        timestamp: new Date().toISOString(),
        ipAddress: details.ipAddress || null,
        userAgent: details.userAgent || null
      });
    } catch (error) {
      console.error('Audit log error:', error);
    }
  }

  // Get audit logs for user
  async getAuditLogs(userId, limit = 100) {
    try {
      const logs = await this.db.all(
        'SELECT * FROM audit_logs WHERE userId = ? ORDER BY timestamp DESC LIMIT ?',
        [userId, limit]
      );
      return logs.map(log => ({
        ...log,
        details: JSON.parse(log.details || '{}')
      }));
    } catch (error) {
      console.error('Get audit logs error:', error);
      return [];
    }
  }

  // Enterprise features
  async enableEnterpriseFeatures(userId) {
    const user = await this.db.getUser(userId);
    
    const enterpriseFeatures = {
      sso: true,
      auditLogs: true,
      apiAccess: true,
      customModels: true,
      prioritySupport: true,
      sla: '99.9%',
      dataRetention: '7 years',
      compliance: ['SOC2', 'HIPAA', 'GDPR']
    };

    await this.db.updateUser(userId, {
      role: 'admin',
      plan: 'enterprise',
      features: JSON.stringify(enterpriseFeatures)
    });

    return enterpriseFeatures;
  }

  // API key management for enterprise
  async generateApiKey(userId, name = 'API Key') {
    const apiKey = `sk_ent_${this.generateRandomString(32)}`;
    
    await this.db.insert('api_keys', {
      userId,
      name,
      keyHash: this.hashApiKey(apiKey),
      createdAt: new Date().toISOString(),
      lastUsed: null,
      status: 'active'
    });

    return { apiKey, name };
  }

  async validateApiKey(apiKey) {
    const keyHash = this.hashApiKey(apiKey);
    
    const keyRecord = await this.db.get(
      'SELECT * FROM api_keys WHERE keyHash = ? AND status = ?',
      [keyHash, 'active']
    );

    if (!keyRecord) return null;

    // Update last used
    await this.db.run(
      'UPDATE api_keys SET lastUsed = ? WHERE id = ?',
      [new Date().toISOString(), keyRecord.id]
    );

    return await this.db.getUser(keyRecord.userId);
  }

  async revokeApiKey(userId, keyId) {
    await this.db.run(
      'UPDATE api_keys SET status = ? WHERE id = ? AND userId = ?',
      ['revoked', keyId, userId]
    );
  }

  async listApiKeys(userId) {
    const keys = await this.db.all(
      'SELECT id, name, createdAt, lastUsed, status FROM api_keys WHERE userId = ?',
      [userId]
    );
    return keys;
  }

  // Webhook management for enterprise
  async createWebhook(userId, url, events = ['message.sent', 'user.created']) {
    const webhookId = `wh_${this.generateRandomString(16)}`;
    
    await this.db.insert('webhooks', {
      webhookId,
      userId,
      url,
      events: JSON.stringify(events),
      secret: this.generateRandomString(32),
      status: 'active',
      createdAt: new Date().toISOString()
    });

    return { webhookId, url, events };
  }

  async triggerWebhook(userId, event, data) {
    const webhooks = await this.db.all(
      'SELECT * FROM webhooks WHERE userId = ? AND status = ?',
      [userId, 'active']
    );

    for (const webhook of webhooks) {
      const events = JSON.parse(webhook.events);
      if (events.includes(event)) {
        await this.sendWebhook(webhook, event, data);
      }
    }
  }

  async sendWebhook(webhook, event, data) {
    const axios = require('axios');
    const crypto = require('crypto');

    const signature = crypto
      .createHmac('sha256', webhook.secret)
      .update(JSON.stringify(data))
      .digest('hex');

    try {
      await axios.post(webhook.url, {
        event,
        data,
        signature,
        timestamp: Date.now()
      }, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature
        }
      });
    } catch (error) {
      console.error('Webhook delivery failed:', error);
    }
  }

  // Helper functions
  generateRandomString(length) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  hashApiKey(apiKey) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(apiKey).digest('hex');
  }

  // Initialize enterprise database tables
  async initEnterpriseTables() {
    const tables = [
      `CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT,
        action TEXT,
        resource TEXT,
        details TEXT,
        timestamp TEXT,
        ipAddress TEXT,
        userAgent TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS api_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT,
        name TEXT,
        keyHash TEXT,
        createdAt TEXT,
        lastUsed TEXT,
        status TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS webhooks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        webhookId TEXT,
        userId TEXT,
        url TEXT,
        events TEXT,
        secret TEXT,
        status TEXT,
        createdAt TEXT
      )`
    ];

    for (const sql of tables) {
      await this.db.run(sql);
    }
  }
}

module.exports = { EnterpriseAuth };
