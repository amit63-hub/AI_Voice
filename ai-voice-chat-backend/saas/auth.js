const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { ProductionDatabase } = require('../production/database-prod');

class AuthService {
  constructor() {
    this.db = new ProductionDatabase();
    this.jwtSecret = process.env.JWT_SECRET;
    this.jwtExpiry = process.env.JWT_EXPIRY || '7d';
    this.saltRounds = 12;
  }

  async register(userData) {
    try {
      const { email, password, name } = userData;

      // Validate input
      if (!email || !password || !name) {
        throw new Error('Email, password, and name are required');
      }

      // Check if user already exists
      const existingUser = await this.db.getUserByEmail(email);
      if (existingUser) {
        throw new Error('User with this email already exists');
      }

      // Validate password strength
      if (!this.validatePassword(password)) {
        throw new Error('Password must be at least 8 characters long and contain uppercase, lowercase, and numbers');
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, this.saltRounds);

      // Create user
      const user = await this.db.createUser({
        email,
        passwordHash,
        name,
        preferences: {
          language: 'en',
          theme: 'light',
          notifications: true
        }
      });

      // Generate JWT token
      const token = this.generateToken(user);

      // Return user data without password hash
      const { password_hash, ...userWithoutPassword } = user;

      return {
        success: true,
        user: userWithoutPassword,
        token
      };

    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  async login(credentials) {
    try {
      const { email, password } = credentials;

      if (!email || !password) {
        throw new Error('Email and password are required');
      }

      // Find user by email
      const user = await this.db.getUserByEmail(email);
      if (!user) {
        throw new Error('Invalid email or password');
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        throw new Error('Invalid email or password');
      }

      // Check if user is active
      if (user.subscription_status !== 'active') {
        throw new Error('Account is not active. Please check your subscription.');
      }

      // Generate JWT token
      const token = this.generateToken(user);

      // Update last login
      await this.db.updateUser(user.id, {
        last_login: new Date().toISOString()
      });

      // Return user data without password hash
      const { password_hash, ...userWithoutPassword } = user;

      return {
        success: true,
        user: userWithoutPassword,
        token
      };

    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  async refreshToken(token) {
    try {
      if (!token) {
        throw new Error('Token is required');
      }

      // Verify existing token
      const decoded = jwt.verify(token, this.jwtSecret);
      
      // Get fresh user data
      const user = await this.db.getUser(decoded.id);
      if (!user) {
        throw new Error('User not found');
      }

      // Generate new token
      const newToken = this.generateToken(user);

      return {
        success: true,
        token: newToken
      };

    } catch (error) {
      console.error('Token refresh error:', error);
      throw new Error('Invalid or expired token');
    }
  }

  async changePassword(userId, currentPassword, newPassword) {
    try {
      if (!currentPassword || !newPassword) {
        throw new Error('Current password and new password are required');
      }

      // Get user
      const user = await this.db.getUser(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isValidPassword) {
        throw new Error('Current password is incorrect');
      }

      // Validate new password
      if (!this.validatePassword(newPassword)) {
        throw new Error('New password must be at least 8 characters long and contain uppercase, lowercase, and numbers');
      }

      // Hash new password
      const newPasswordHash = await bcrypt.hash(newPassword, this.saltRounds);

      // Update password
      await this.db.updateUser(userId, {
        password_hash: newPasswordHash,
        password_changed_at: new Date().toISOString()
      });

      return {
        success: true,
        message: 'Password changed successfully'
      };

    } catch (error) {
      console.error('Change password error:', error);
      throw error;
    }
  }

  async requestPasswordReset(email) {
    try {
      if (!email) {
        throw new Error('Email is required');
      }

      const user = await this.db.getUserByEmail(email);
      if (!user) {
        // Don't reveal if email exists or not
        return {
          success: true,
          message: 'If an account with that email exists, a password reset link has been sent'
        };
      }

      // Generate reset token
      const resetToken = this.generateResetToken(user.id);
      
      // Store reset token (would need a password_resets table)
      // For now, just log it
      console.log(`Password reset token for ${email}: ${resetToken}`);

      // Send email (would integrate with email service)
      // await this.sendPasswordResetEmail(email, resetToken);

      return {
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent'
      };

    } catch (error) {
      console.error('Password reset request error:', error);
      throw error;
    }
  }

  async resetPassword(token, newPassword) {
    try {
      if (!token || !newPassword) {
        throw new Error('Reset token and new password are required');
      }

      // Verify reset token
      const decoded = jwt.verify(token, this.jwtSecret);
      if (decoded.type !== 'password_reset') {
        throw new Error('Invalid reset token');
      }

      // Get user
      const user = await this.db.getUser(decoded.id);
      if (!user) {
        throw new Error('User not found');
      }

      // Validate new password
      if (!this.validatePassword(newPassword)) {
        throw new Error('Password must be at least 8 characters long and contain uppercase, lowercase, and numbers');
      }

      // Hash new password
      const passwordHash = await bcrypt.hash(newPassword, this.saltRounds);

      // Update password
      await this.db.updateUser(user.id, {
        password_hash: passwordHash,
        password_changed_at: new Date().toISOString()
      });

      return {
        success: true,
        message: 'Password reset successfully'
      };

    } catch (error) {
      console.error('Password reset error:', error);
      throw new Error('Invalid or expired reset token');
    }
  }

  generateToken(user) {
    const payload = {
      id: user.id,
      email: user.email,
      subscriptionPlan: user.subscription_plan,
      iat: Math.floor(Date.now() / 1000)
    };

    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiry,
      issuer: 'ai-chat-saas',
      audience: 'ai-chat-client'
    });
  }

  generateResetToken(userId) {
    const payload = {
      id: userId,
      type: 'password_reset',
      iat: Math.floor(Date.now() / 1000)
    };

    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: '1h',
      issuer: 'ai-chat-saas'
    });
  }

  validatePassword(password) {
    // At least 8 characters, uppercase, lowercase, and numbers
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
    return passwordRegex.test(password);
  }

  async verifyToken(token) {
    try {
      const decoded = jwt.verify(token, this.jwtSecret);
      
      // Get fresh user data
      const user = await this.db.getUser(decoded.id);
      if (!user) {
        throw new Error('User not found');
      }

      return {
        id: user.id,
        email: user.email,
        subscriptionPlan: user.subscription_plan,
        subscriptionStatus: user.subscription_status
      };

    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  // Middleware for Express
  authenticate() {
    return async (req, res, next) => {
      try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'Access token required'
          });
        }

        const user = await this.verifyToken(token);
        req.user = user;
        next();

      } catch (error) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Invalid or expired token'
        });
      }
    };
  }

  // Optional: Subscription check middleware
  requireSubscription(minPlan = 'free') {
    return async (req, res, next) => {
      try {
        const user = req.user;

        if (!user) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'Authentication required'
          });
        }

        // Check subscription status
        if (user.subscriptionStatus !== 'active') {
          return res.status(403).json({
            error: 'Subscription inactive',
            message: 'Your subscription is not active'
          });
        }

        // Check plan level (if needed)
        const planLevels = { free: 0, basic: 1, pro: 2, enterprise: 3 };
        const userLevel = planLevels[user.subscriptionPlan] || 0;
        const requiredLevel = planLevels[minPlan] || 0;

        if (userLevel < requiredLevel) {
          return res.status(403).json({
            error: 'Insufficient plan',
            message: `This feature requires a ${minPlan} plan or higher`
          });
        }

        next();

      } catch (error) {
        return res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to verify subscription'
        });
      }
    };
  }
}

module.exports = { AuthService };
