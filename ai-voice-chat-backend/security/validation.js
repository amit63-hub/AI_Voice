const Joi = require('joi');
const validator = require('validator');

class ValidationSchemas {
  // User authentication schemas
  static register = Joi.object({
    email: Joi.string()
      .email()
      .required()
      .messages({
        'string.email': 'Please provide a valid email address',
        'any.required': 'Email is required'
      }),
    password: Joi.string()
      .min(8)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .required()
      .messages({
        'string.min': 'Password must be at least 8 characters long',
        'string.pattern.base': 'Password must contain uppercase, lowercase, number, and special character',
        'any.required': 'Password is required'
      }),
    name: Joi.string()
      .min(2)
      .max(50)
      .pattern(/^[a-zA-Z\s'-]+$/)
      .required()
      .messages({
        'string.min': 'Name must be at least 2 characters long',
        'string.max': 'Name cannot exceed 50 characters',
        'string.pattern.base': 'Name can only contain letters, spaces, hyphens, and apostrophes',
        'any.required': 'Name is required'
      })
  });

  static login = Joi.object({
    email: Joi.string()
      .email()
      .required()
      .messages({
        'string.email': 'Please provide a valid email address',
        'any.required': 'Email is required'
      }),
    password: Joi.string()
      .required()
      .messages({
        'any.required': 'Password is required'
      })
  });

  static changePassword = Joi.object({
    currentPassword: Joi.string()
      .required()
      .messages({
        'any.required': 'Current password is required'
      }),
    newPassword: Joi.string()
      .min(8)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .required()
      .messages({
        'string.min': 'New password must be at least 8 characters long',
        'string.pattern.base': 'New password must contain uppercase, lowercase, number, and special character',
        'any.required': 'New password is required'
      }),
    confirmPassword: Joi.string()
      .valid(Joi.ref('newPassword'))
      .required()
      .messages({
        'any.only': 'Passwords do not match',
        'any.required': 'Password confirmation is required'
      })
  });

  // Chat schemas
  static chatMessage = Joi.object({
    message: Joi.string()
      .min(1)
      .max(4000)
      .required()
      .messages({
        'string.min': 'Message cannot be empty',
        'string.max': 'Message cannot exceed 4000 characters',
        'any.required': 'Message is required'
      }),
    conversationId: Joi.string()
      .uuid()
      .optional()
      .messages({
        'string.uuid': 'Invalid conversation ID format'
      })
  });

  // Conversation schemas
  static createConversation = Joi.object({
    title: Joi.string()
      .min(1)
      .max(100)
      .optional()
      .messages({
        'string.min': 'Title cannot be empty',
        'string.max': 'Title cannot exceed 100 characters'
      })
  });

  // User profile schemas
  static updateProfile = Joi.object({
    name: Joi.string()
      .min(2)
      .max(50)
      .pattern(/^[a-zA-Z\s'-]+$/)
      .optional()
      .messages({
        'string.min': 'Name must be at least 2 characters long',
        'string.max': 'Name cannot exceed 50 characters',
        'string.pattern.base': 'Name can only contain letters, spaces, hyphens, and apostrophes'
      }),
    email: Joi.string()
      .email()
      .optional()
      .messages({
        'string.email': 'Please provide a valid email address'
      })
  });

  static updatePreferences = Joi.object({
    personality: Joi.string()
      .valid('helpful', 'professional', 'casual', 'creative')
      .optional(),
    language: Joi.string()
      .valid('en', 'hi', 'bilingual')
      .optional(),
    responseStyle: Joi.string()
      .valid('brief', 'detailed', 'technical')
      .optional(),
    theme: Joi.string()
      .valid('light', 'dark', 'auto')
      .optional(),
    notifications: Joi.boolean()
      .optional()
  });

  // Lead schemas
  static createLead = Joi.object({
    name: Joi.string()
      .min(2)
      .max(100)
      .required()
      .messages({
        'string.min': 'Name must be at least 2 characters long',
        'string.max': 'Name cannot exceed 100 characters',
        'any.required': 'Name is required'
      }),
    contact: Joi.string()
      .required()
      .custom((value, helpers) => {
        const isValidEmail = validator.isEmail(value);
        const isValidPhone = validator.isMobilePhone(value, 'any', { strictMode: false });
        
        if (!isValidEmail && !isValidPhone) {
          return helpers.error('custom.contact');
        }
        
        return value;
      })
      .messages({
        'custom.contact': 'Contact must be a valid email address or phone number',
        'any.required': 'Contact is required'
      }),
    intent: Joi.string()
      .max(500)
      .optional()
      .messages({
        'string.max': 'Intent cannot exceed 500 characters'
      }),
    source: Joi.string()
      .max(50)
      .optional()
      .messages({
        'string.max': 'Source cannot exceed 50 characters'
      })
  });

  // Billing schemas
  static createSubscription = Joi.object({
    planId: Joi.string()
      .valid('free', 'basic', 'pro', 'enterprise')
      .required()
      .messages({
        'any.only': 'Invalid plan selected',
        'any.required': 'Plan is required'
      })
  });

  // Voice schemas
  static voiceSettings = Joi.object({
    language: Joi.string()
      .valid('en', 'hi', 'es', 'fr', 'de')
      .optional(),
    voice: Joi.string()
      .valid('alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer')
      .optional(),
    speed: Joi.number()
      .min(0.25)
      .max(4.0)
      .optional(),
    pitch: Joi.number()
      .min(0.5)
      .max(2.0)
      .optional()
  });

  // File upload schemas
  static fileUpload = Joi.object({
    file: Joi.object()
      .required()
      .messages({
        'any.required': 'File is required'
      }),
    description: Joi.string()
      .max(500)
      .optional()
      .messages({
        'string.max': 'Description cannot exceed 500 characters'
      })
  });

  // API key schemas
  static createApiKey = Joi.object({
    name: Joi.string()
      .min(2)
      .max(50)
      .required()
      .messages({
        'string.min': 'API key name must be at least 2 characters long',
        'string.max': 'API key name cannot exceed 50 characters',
        'any.required': 'API key name is required'
      }),
    permissions: Joi.array()
      .items(Joi.string().valid('read', 'write', 'admin'))
      .min(1)
      .required()
      .messages({
        'array.min': 'At least one permission is required',
        'any.required': 'Permissions are required'
      }),
    expiresAt: Joi.date()
      .min('now')
      .optional()
      .messages({
        'date.min': 'Expiration date cannot be in the past'
      })
  });

  // Search schemas
  static searchQuery = Joi.object({
    query: Joi.string()
      .min(1)
      .max(100)
      .required()
      .messages({
        'string.min': 'Search query cannot be empty',
        'string.max': 'Search query cannot exceed 100 characters',
        'any.required': 'Search query is required'
      }),
    type: Joi.string()
      .valid('all', 'conversations', 'messages', 'memories')
      .optional(),
    limit: Joi.number()
      .min(1)
      .max(100)
      .optional()
      .messages({
        'number.min': 'Limit must be at least 1',
        'number.max': 'Limit cannot exceed 100'
      }),
    offset: Joi.number()
      .min(0)
      .optional()
      .messages({
        'number.min': 'Offset cannot be negative'
      })
  });

  // Pagination schemas
  static pagination = Joi.object({
    page: Joi.number()
      .min(1)
      .optional()
      .messages({
        'number.min': 'Page must be at least 1'
      }),
    limit: Joi.number()
      .min(1)
      .max(100)
      .optional()
      .messages({
        'number.min': 'Limit must be at least 1',
        'number.max': 'Limit cannot exceed 100'
      }),
    sortBy: Joi.string()
      .optional(),
    sortOrder: Joi.string()
      .valid('asc', 'desc')
      .optional()
  });

  // UUID validation
  static uuid = Joi.string()
    .uuid()
    .required()
    .messages({
      'string.uuid': 'Invalid UUID format',
      'any.required': 'ID is required'
    });

  // Date range schemas
  static dateRange = Joi.object({
    startDate: Joi.date()
      .optional(),
    endDate: Joi.date()
      .min(Joi.ref('startDate'))
      .optional()
      .messages({
        'date.min': 'End date must be after start date'
      })
  });

  // Bulk operations
  static bulkOperation = Joi.object({
    items: Joi.array()
      .min(1)
      .max(100)
      .required()
      .messages({
        'array.min': 'At least one item is required',
        'array.max': 'Cannot process more than 100 items at once',
        'any.required': 'Items are required'
      }),
    operation: Joi.string()
      .valid('delete', 'update', 'archive')
      .required()
      .messages({
        'any.only': 'Invalid operation',
        'any.required': 'Operation is required'
      })
  });
}

class CustomValidators {
  // Validate email with additional checks
  static validateEmail(email) {
    if (!validator.isEmail(email)) {
      return false;
    }

    // Additional checks
    const emailParts = email.split('@');
    if (emailParts.length !== 2) {
      return false;
    }

    const domain = emailParts[1];
    
    // Block common disposable email domains
    const disposableDomains = [
      '10minutemail.com',
      'tempmail.org',
      'guerrillamail.com',
      'mailinator.com'
    ];

    return !disposableDomains.includes(domain.toLowerCase());
  }

  // Validate password strength
  static validatePasswordStrength(password) {
    const checks = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      numbers: /\d/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
      noCommonPatterns: !/(.)\1{2,}/.test(password), // No 3+ repeated characters
      noSequences: !/(012|123|234|345|456|567|678|789|890|abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)/i.test(password)
    };

    const passedChecks = Object.values(checks).filter(Boolean).length;
    const strength = passedChecks / Object.keys(checks).length;

    return {
      score: strength,
      checks,
      isStrong: strength >= 0.7
    };
  }

  // Validate phone number internationally
  static validatePhoneNumber(phone) {
    return validator.isMobilePhone(phone, 'any', { strictMode: false });
  }

  // Validate URL
  static validateUrl(url) {
    return validator.isURL(url, {
      protocols: ['http', 'https'],
      require_protocol: true,
      require_valid_protocol: true
    });
  }

  // Validate JSON
  static validateJSON(jsonString) {
    try {
      JSON.parse(jsonString);
      return true;
    } catch {
      return false;
    }
  }

  // Validate file type
  static validateFileType(file, allowedTypes) {
    if (!file || !file.mimetype) {
      return false;
    }

    return allowedTypes.includes(file.mimetype);
  }

  // Validate file size
  static validateFileSize(file, maxSizeBytes) {
    if (!file || !file.size) {
      return false;
    }

    return file.size <= maxSizeBytes;
  }

  // Validate image dimensions
  static validateImageDimensions(file, minWidth, maxWidth, minHeight, maxHeight) {
    return new Promise((resolve) => {
      if (!file || !file.type.startsWith('image/')) {
        resolve(false);
        return;
      }

      const img = new Image();
      img.onload = () => {
        const widthValid = img.width >= minWidth && img.width <= maxWidth;
        const heightValid = img.height >= minHeight && img.height <= maxHeight;
        resolve(widthValid && heightValid);
      };
      img.onerror = () => resolve(false);
      img.src = URL.createObjectURL(file);
    });
  }

  // Sanitize HTML content
  static sanitizeHTML(html) {
    const { JSDOM } = require('jsdom');
    const dom = new JSDOM();
    const sanitizer = dom.window.sanitizer;
    
    return sanitizer.sanitizeFor('div', html);
  }

  // Validate timezone
  static validateTimezone(timezone) {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
      return true;
    } catch {
      return false;
    }
  }

  // Validate hex color
  static validateHexColor(color) {
    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
  }

  // Validate semantic version
  static validateVersion(version) {
    return /^\d+\.\d+\.\d+(-[a-zA-Z0-9]+)?$/.test(version);
  }
}

module.exports = { 
  ValidationSchemas, 
  CustomValidators 
};
