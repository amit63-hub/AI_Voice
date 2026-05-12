const winston = require('winston');
const path = require('path');

class MonitoringLogger {
  constructor() {
    this.logger = this.createLogger();
    this.metrics = new Map();
    this.alerts = [];
  }

  createLogger() {
    // Define log format
    const logFormat = winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        return JSON.stringify({
          timestamp,
          level,
          message,
          ...meta
        });
      })
    );

    // Create logger with multiple transports
    const logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: logFormat,
      defaultMeta: { service: 'ai-chat-saas' },
      transports: [
        // Console transport for development
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        }),

        // File transport for error logs
        new winston.transports.File({
          filename: path.join(process.cwd(), 'logs', 'error.log'),
          level: 'error',
          maxsize: 10485760, // 10MB
          maxFiles: 5,
          tailable: true
        }),

        // File transport for combined logs
        new winston.transports.File({
          filename: path.join(process.cwd(), 'logs', 'combined.log'),
          maxsize: 10485760, // 10MB
          maxFiles: 10,
          tailable: true
        }),

        // File transport for audit logs
        new winston.transports.File({
          filename: path.join(process.cwd(), 'logs', 'audit.log'),
          level: 'info',
          maxsize: 10485760, // 10MB
          maxFiles: 30,
          tailable: true,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          )
        })
      ],

      // Exception handling
      exceptionHandlers: [
        new winston.transports.File({
          filename: path.join(process.cwd(), 'logs', 'exceptions.log')
        })
      ],

      // Rejection handling
      rejectionHandlers: [
        new winston.transports.File({
          filename: path.join(process.cwd(), 'logs', 'rejections.log')
        })
      ]
    });

    return logger;
  }

  // Structured logging methods
  logRequest(req, res, responseTime) {
    const logData = {
      type: 'request',
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      responseTime: responseTime,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      userId: req.user?.id || 'anonymous',
      timestamp: new Date().toISOString()
    };

    if (res.statusCode >= 400) {
      this.logger.error('HTTP Error', logData);
    } else {
      this.logger.info('HTTP Request', logData);
    }

    // Update metrics
    this.updateMetric('requests', 1);
    this.updateMetric('responseTime', responseTime);
    
    if (res.statusCode >= 400) {
      this.updateMetric('errors', 1);
    }
  }

  logAuth(event, userId, details = {}) {
    const logData = {
      type: 'auth',
      event: event, // login, logout, register, password_change
      userId: userId,
      ip: details.ip,
      userAgent: details.userAgent,
      timestamp: new Date().toISOString(),
      success: details.success !== false
    };

    this.logger.info('Authentication Event', logData);
    
    // Audit log for security events
    if (event === 'login' || event === 'register') {
      this.logger.info('Security Audit', {
        ...logData,
        category: 'authentication'
      });
    }
  }

  logAIRequest(userId, prompt, response, tokensUsed, responseTime, cost = 0) {
    const logData = {
      type: 'ai_request',
      userId: userId,
      promptLength: prompt.length,
      responseLength: response.length,
      tokensUsed: tokensUsed,
      responseTime: responseTime,
      cost: cost,
      timestamp: new Date().toISOString()
    };

    this.logger.info('AI Request', logData);
    
    // Update metrics
    this.updateMetric('aiRequests', 1);
    this.updateMetric('tokensUsed', tokensUsed);
    this.updateMetric('aiCost', cost);
  }

  logVoiceSession(sessionId, userId, duration, events = []) {
    const logData = {
      type: 'voice_session',
      sessionId: sessionId,
      userId: userId,
      duration: duration,
      events: events,
      timestamp: new Date().toISOString()
    };

    this.logger.info('Voice Session', logData);
    
    // Update metrics
    this.updateMetric('voiceSessions', 1);
    this.updateMetric('voiceMinutes', duration / 60);
  }

  logDatabase(query, duration, error = null) {
    const logData = {
      type: 'database',
      query: query.substring(0, 200), // Truncate long queries
      duration: duration,
      error: error ? error.message : null,
      timestamp: new Date().toISOString()
    };

    if (error) {
      this.logger.error('Database Error', logData);
      this.updateMetric('dbErrors', 1);
    } else {
      this.logger.debug('Database Query', logData);
      this.updateMetric('dbQueries', 1);
      this.updateMetric('dbQueryTime', duration);
    }
  }

  logBusinessEvent(event, userId, data = {}) {
    const logData = {
      type: 'business_event',
      event: event, // subscription_upgrade, payment_completed, lead_created
      userId: userId,
      data: data,
      timestamp: new Date().toISOString()
    };

    this.logger.info('Business Event', logData);
    
    // Business metrics
    this.updateMetric(`business_${event}`, 1);
  }

  logSecurity(event, severity, details = {}) {
    const logData = {
      type: 'security',
      event: event, // brute_force_attempt, suspicious_activity, data_breach
      severity: severity, // low, medium, high, critical
      details: details,
      timestamp: new Date().toISOString()
    };

    this.logger.warn('Security Event', logData);
    
    // Security metrics
    this.updateMetric(`security_${event}`, 1);
    
    // Trigger alerts for high severity events
    if (severity === 'high' || severity === 'critical') {
      this.triggerAlert({
        type: 'security',
        event: event,
        severity: severity,
        details: details
      });
    }
  }

  logPerformance(metric, value, threshold = null) {
    const logData = {
      type: 'performance',
      metric: metric,
      value: value,
      threshold: threshold,
      timestamp: new Date().toISOString()
    };

    if (threshold && value > threshold) {
      this.logger.warn('Performance Issue', logData);
      this.triggerAlert({
        type: 'performance',
        metric: metric,
        value: value,
        threshold: threshold
      });
    } else {
      this.logger.debug('Performance Metric', logData);
    }

    this.updateMetric(metric, value);
  }

  logError(error, context = {}) {
    const logData = {
      type: 'error',
      message: error.message,
      stack: error.stack,
      context: context,
      timestamp: new Date().toISOString()
    };

    this.logger.error('Application Error', logData);
    this.updateMetric('errors', 1);
  }

  // Metrics management
  updateMetric(name, value) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, {
        count: 0,
        sum: 0,
        min: value,
        max: value,
        average: 0
      });
    }

    const metric = this.metrics.get(name);
    metric.count++;
    metric.sum += value;
    metric.min = Math.min(metric.min, value);
    metric.max = Math.max(metric.max, value);
    metric.average = metric.sum / metric.count;
  }

  getMetrics() {
    const metrics = {};
    for (const [name, data] of this.metrics.entries()) {
      metrics[name] = {
        count: data.count,
        sum: data.sum,
        min: data.min,
        max: data.max,
        average: data.average
      };
    }
    return metrics;
  }

  resetMetrics() {
    this.metrics.clear();
  }

  // Alert management
  triggerAlert(alert) {
    this.alerts.push({
      ...alert,
      id: Date.now(),
      timestamp: new Date().toISOString()
    });

    // Log alert
    this.logger.error('Alert Triggered', alert);

    // Send notifications (would integrate with notification service)
    this.sendNotification(alert);

    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }
  }

  getAlerts(severity = null) {
    if (severity) {
      return this.alerts.filter(alert => alert.severity === severity);
    }
    return this.alerts;
  }

  clearAlerts() {
    this.alerts = [];
  }

  async sendNotification(alert) {
    // Would integrate with Slack, email, PagerDuty, etc.
    console.log('Notification sent:', alert);
  }

  // Health check
  async healthCheck() {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      metrics: this.getMetrics(),
      alerts: this.getAlerts('high').concat(this.getAlerts('critical'))
    };

    // Check for critical issues
    if (health.alerts.length > 0) {
      health.status = 'degraded';
    }

    // Check memory usage
    const memoryUsage = health.memory.heapUsed / health.memory.heapTotal;
    if (memoryUsage > 0.9) {
      health.status = 'unhealthy';
      health.memory = {
        ...health.memory,
        usage: memoryUsage,
        status: 'critical'
      };
    }

    return health;
  }

  // Cleanup old logs
  cleanupLogs() {
    const fs = require('fs');
    const logsDir = path.join(process.cwd(), 'logs');
    
    if (fs.existsSync(logsDir)) {
      const files = fs.readdirSync(logsDir);
      const now = Date.now();
      const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days

      files.forEach(file => {
        const filePath = path.join(logsDir, file);
        const stats = fs.statSync(filePath);
        
        if (now - stats.mtime.getTime() > maxAge) {
          fs.unlinkSync(filePath);
          this.logger.info('Cleaned up old log file', { file });
        }
      });
    }
  }

  // Export metrics for monitoring systems
  exportMetrics(format = 'prometheus') {
    const metrics = this.getMetrics();
    
    if (format === 'prometheus') {
      let prometheus = '';
      
      for (const [name, data] of Object.entries(metrics)) {
        prometheus += `# HELP ${name} ${name} metrics\n`;
        prometheus += `# TYPE ${name} counter\n`;
        prometheus += `${name}_count ${data.count}\n`;
        prometheus += `${name}_sum ${data.sum}\n`;
        prometheus += `${name}_average ${data.average}\n`;
        prometheus += `${name}_min ${data.min}\n`;
        prometheus += `${name}_max ${data.max}\n\n`;
      }
      
      return prometheus;
    }
    
    return metrics;
  }
}

// Express middleware for request logging
const requestLogger = (logger) => {
  return (req, res, next) => {
    const startTime = Date.now();
    
    res.on('finish', () => {
      const responseTime = Date.now() - startTime;
      logger.logRequest(req, res, responseTime);
    });
    
    next();
  };
};

// Error logging middleware
const errorLogger = (logger) => {
  return (error, req, res, next) => {
    logger.logError(error, {
      method: req.method,
      url: req.originalUrl,
      userId: req.user?.id,
      ip: req.ip
    });
    
    next(error);
  };
};

module.exports = { 
  MonitoringLogger, 
  requestLogger, 
  errorLogger 
};
