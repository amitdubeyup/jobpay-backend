import { BadRequestException, Injectable } from '@nestjs/common';
import { plainToClass } from 'class-transformer';
import { ValidationError, validate } from 'class-validator';
import * as Joi from 'joi';

@Injectable()
export class ValidationService {
  /**
   * Enhanced input validation with sanitization
   */
  async validateAndSanitize<T extends object>(dto: new () => T, data: unknown): Promise<T> {
    // Convert plain object to class instance
    const instance = plainToClass(dto, data);

    // Validate using class-validator
    const errors = await validate(instance);

    if (errors.length > 0) {
      const errorMessages = this.formatValidationErrors(errors);
      throw new BadRequestException({
        message: 'Validation failed',
        errors: errorMessages,
      });
    }

    return instance;
  }

  /**
   * Joi schema validation for complex scenarios
   */
  validateWithJoi<T>(schema: Joi.ObjectSchema<T>, data: unknown): T {
    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });

    if (error) {
      throw new BadRequestException({
        message: 'Schema validation failed',
        errors: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
        })),
      });
    }

    return value;
  }

  /**
   * Sanitize input to prevent XSS and injection attacks
   */
  sanitizeInput(input: unknown): unknown {
    if (typeof input === 'string') {
      return this.sanitizeString(input);
    }

    if (Array.isArray(input)) {
      return input.map(item => this.sanitizeInput(item));
    }

    if (typeof input === 'object' && input !== null) {
      const sanitized: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(input)) {
        sanitized[this.sanitizeString(key)] = this.sanitizeInput(value);
      }
      return sanitized;
    }

    return input;
  }

  /**
   * Sanitize individual string
   */
  private sanitizeString(str: string): string {
    if (typeof str !== 'string') return str;

    // Remove potentially dangerous characters
    return str
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .replace(/&lt;script&gt;/gi, '') // Remove encoded script tags
      .replace(/&lt;\/script&gt;/gi, '')
      .replace(/&#x3C;script&#x3E;/gi, '') // Remove hex encoded script tags
      .replace(/&#x3C;&#x2F;script&#x3E;/gi, '')
      .trim();
  }

  /**
   * Validate file upload
   */
  validateFileUpload(
    file: {
      size?: number;
      mimetype?: string;
      originalname?: string;
    },
    options: {
      maxSize?: number;
      allowedTypes?: string[];
      allowedExtensions?: string[];
    } = {},
  ): void {
    const {
      maxSize = 10 * 1024 * 1024, // 10MB default
      allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
      allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.pdf'],
    } = options;

    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Check file size
    if (file.size && file.size > maxSize) {
      throw new BadRequestException(`File size exceeds limit of ${maxSize} bytes`);
    }

    // Check file type
    if (file.mimetype && !allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(`File type ${file.mimetype} is not allowed`);
    }

    // Check file extension
    if (file.originalname) {
      const extension = file.originalname.toLowerCase().split('.').pop();
      if (extension && !allowedExtensions.includes(`.${extension}`)) {
        throw new BadRequestException(`File extension .${extension} is not allowed`);
      }
    }

    // Check for malicious filenames
    const maliciousPatterns = [
      /\.\./, // Directory traversal
      /^\.ht/, // .htaccess files
      /\.php$/i, // PHP files
      /\.jsp$/i, // JSP files
      /\.asp$/i, // ASP files
      /\.sh$/i, // Shell scripts
      /\.bat$/i, // Batch files
      /\.exe$/i, // Executables
    ];

    if (file.originalname && maliciousPatterns.some(pattern => pattern.test(file.originalname!))) {
      throw new BadRequestException('Filename contains potentially malicious content');
    }
  }

  /**
   * Validate pagination parameters
   */
  validatePagination(page?: number, limit?: number): { page: number; limit: number } {
    const validatedPage = Math.max(1, Math.floor(page || 1));
    const validatedLimit = Math.min(100, Math.max(1, Math.floor(limit || 10))); // Max 100 items per page

    return { page: validatedPage, limit: validatedLimit };
  }

  /**
   * Validate email format with enhanced checks
   */
  validateEmail(email: string): boolean {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    if (!emailRegex.test(email)) {
      return false;
    }

    // Check for common disposable email domains
    const disposableDomains = [
      '10minutemail.com',
      'tempmail.org',
      'guerrillamail.com',
      'mailinator.com',
      'throwaway.email',
    ];

    const domain = email.split('@')[1].toLowerCase();
    if (disposableDomains.includes(domain)) {
      throw new BadRequestException('Disposable email addresses are not allowed');
    }

    return true;
  }

  /**
   * Validate password strength
   */
  validatePassword(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (password.length > 128) {
      errors.push('Password must not exceed 128 characters');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    // Check for common weak passwords
    const commonPasswords = [
      'password',
      '123456',
      '123456789',
      'qwerty',
      'abc123',
      'password123',
      'admin',
      'letmein',
    ];

    if (commonPasswords.includes(password.toLowerCase())) {
      errors.push('Password is too common and easily guessable');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Format validation errors for client response
   */
  private formatValidationErrors(errors: ValidationError[]): Record<string, unknown>[] {
    return errors.map(error => ({
      field: error.property,
      value: error.value,
      constraints: error.constraints,
      children: error.children?.length ? this.formatValidationErrors(error.children) : undefined,
    }));
  }

  /**
   * Validate SQL injection patterns
   */
  containsSqlInjection(input: string): boolean {
    const sqlInjectionPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
      /('|(--)|;|\||[*]|%)/,
      /((%3D)|(=))[^\n]*((%27)|'|(--)|(%3B)|;)/i,
      /((%27)|')((%6F)|o|(%4F))((%72)|r|(%52))/i,
      /exec(\s|\+)+(s|x)p\w+/i,
    ];

    return sqlInjectionPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Validate NoSQL injection patterns
   */
  containsNoSqlInjection(input: unknown): boolean {
    if (typeof input === 'object' && input !== null) {
      const str = JSON.stringify(input);
      const nosqlPatterns = [
        /\$where/i,
        /\$regex/i,
        /\$ne/i,
        /\$gt/i,
        /\$lt/i,
        /\$or/i,
        /\$and/i,
        /javascript/i,
      ];

      return nosqlPatterns.some(pattern => pattern.test(str));
    }

    return false;
  }
}
