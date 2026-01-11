import { Test, TestingModule } from '@nestjs/testing';
import { ValidationService } from './validation.service';
import { BadRequestException } from '@nestjs/common';

describe('ValidationService', () => {
  let service: ValidationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ValidationService],
    }).compile();

    service = module.get<ValidationService>(ValidationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sanitizeInput', () => {
    it('should remove script tags from input', () => {
      const maliciousInput = '<script>alert("xss")</script>Hello World';
      const result = service.sanitizeInput(maliciousInput);

      expect(result).toBe('Hello World');
      expect(result).not.toContain('<script>');
    });

    it('should handle nested script tags', () => {
      const maliciousInput = '<script><script>alert("xss")</script></script>';
      const result = service.sanitizeInput(maliciousInput);

      expect(result).not.toContain('alert("xss")');
      expect(result).not.toContain('<script>alert("xss")</script>');
    });

    it('should remove javascript protocols', () => {
      const maliciousInput = 'javascript:alert("xss")';
      const result = service.sanitizeInput(maliciousInput);

      expect(result).not.toContain('javascript:');
    });

    it('should handle arrays', () => {
      const arrayInput = ['<script>alert(1)</script>', 'safe text', 'javascript:void(0)'];
      const result = service.sanitizeInput(arrayInput) as string[];

      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toBe('');
      expect(result[1]).toBe('safe text');
      expect(result[2]).not.toContain('javascript:');
    });

    it('should handle objects', () => {
      const objectInput = {
        name: '<script>alert("xss")</script>John',
        description: 'javascript:alert("test")',
        safe: 'This is safe content',
      };

      const result = service.sanitizeInput(objectInput) as Record<string, string>;

      expect(result.name).toBe('John');
      expect(result.description).not.toContain('javascript:');
      expect(result.safe).toBe('This is safe content');
    });

    it('should handle empty and null inputs', () => {
      expect(service.sanitizeInput('')).toBe('');
      expect(service.sanitizeInput(null)).toBe(null);
      expect(service.sanitizeInput(undefined)).toBe(undefined);
    });
  });

  describe('validateFileUpload', () => {
    it('should validate allowed file types', () => {
      const allowedFile = {
        originalname: 'document.pdf',
        mimetype: 'application/pdf',
        size: 1024 * 1024, // 1MB
      };

      expect(() => {
        service.validateFileUpload(allowedFile);
      }).not.toThrow();
    });

    it('should reject oversized files', () => {
      const oversizedFile = {
        originalname: 'large-document.pdf',
        mimetype: 'application/pdf',
        size: 20 * 1024 * 1024, // 20MB
      };

      expect(() => {
        service.validateFileUpload(oversizedFile);
      }).toThrow(BadRequestException);
    });

    it('should reject disallowed file types', () => {
      const dangerousFile = {
        originalname: 'virus.exe',
        mimetype: 'application/x-msdownload',
        size: 1024,
      };

      expect(() => {
        service.validateFileUpload(dangerousFile);
      }).toThrow(BadRequestException);
    });

    it('should reject malicious filenames', () => {
      const maliciousFiles = [
        {
          originalname: '../../../etc/passwd',
          mimetype: 'text/plain',
          size: 1024,
        },
        {
          originalname: 'shell.sh',
          mimetype: 'text/plain',
          size: 1024,
        },
        {
          originalname: 'script.php',
          mimetype: 'text/plain',
          size: 1024,
        },
      ];

      for (const file of maliciousFiles) {
        expect(() => {
          service.validateFileUpload(file);
        }).toThrow(BadRequestException);
      }
    });

    it('should throw error when no file provided', () => {
      expect(() => {
        service.validateFileUpload(
          null as unknown as { size?: number; mimetype?: string; originalname?: string },
        );
      }).toThrow(BadRequestException);
    });

    it('should respect custom options', () => {
      const file = {
        originalname: 'image.jpg',
        mimetype: 'image/jpeg',
        size: 2 * 1024 * 1024, // 2MB
      };

      // Should pass with default options
      expect(() => {
        service.validateFileUpload(file);
      }).not.toThrow();

      // Should fail with smaller size limit
      expect(() => {
        service.validateFileUpload(file, { maxSize: 1024 * 1024 }); // 1MB
      }).toThrow(BadRequestException);
    });
  });

  describe('validatePagination', () => {
    it('should validate and normalize pagination parameters', () => {
      const result = service.validatePagination(2, 20);

      expect(result.page).toBe(2);
      expect(result.limit).toBe(20);
    });

    it('should handle invalid page numbers', () => {
      const result = service.validatePagination(-1, 10);

      expect(result.page).toBe(1); // Should default to 1
      expect(result.limit).toBe(10);
    });

    it('should handle undefined parameters', () => {
      const result = service.validatePagination();

      expect(result.page).toBeGreaterThanOrEqual(1);
      expect(result.limit).toBeGreaterThan(0);
    });

    it('should handle floating point numbers', () => {
      const result = service.validatePagination(2.7, 15.9);

      expect(result.page).toBe(2); // Should floor the value
      expect(Number.isInteger(result.page)).toBe(true);
    });

    it('should enforce maximum limit', () => {
      const result = service.validatePagination(1, 200);

      expect(result.limit).toBe(100); // Should cap at 100
    });
  });

  describe('validateEmail', () => {
    it('should validate correct email formats', () => {
      const validEmails = ['test@example.com', 'user.name@domain.co.uk', 'test+label@gmail.com'];

      for (const email of validEmails) {
        const result = service.validateEmail(email);
        expect(result).toBe(true);
      }
    });

    it('should reject invalid email formats', () => {
      const invalidEmails = ['invalid-email', '@domain.com', 'test@', 'test@.com', ''];

      for (const email of invalidEmails) {
        const result = service.validateEmail(email);
        expect(result).toBe(false);
      }
    });

    it('should reject disposable email domains', () => {
      const disposableEmails = [
        'test@10minutemail.com',
        'user@tempmail.org',
        'fake@guerrillamail.com',
      ];

      for (const email of disposableEmails) {
        expect(() => {
          service.validateEmail(email);
        }).toThrow(BadRequestException);
      }
    });

    it('should allow legitimate email domains', () => {
      const legitimateEmails = ['test@gmail.com', 'user@yahoo.com', 'contact@company.com'];

      for (const email of legitimateEmails) {
        const result = service.validateEmail(email);
        expect(result).toBe(true);
      }
    });
  });

  describe('validatePassword', () => {
    it('should validate strong passwords', () => {
      const strongPassword = 'MyStr0ngP@ssw0rd!';
      const result = service.validatePassword(strongPassword);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject weak passwords', () => {
      const weakPasswords = ['password', '123456', 'qwerty', 'abc123', '', 'short'];

      for (const password of weakPasswords) {
        const result = service.validatePassword(password);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });

    it('should check for common passwords', () => {
      const commonPasswords = ['password123', 'admin', 'letmein', '123456789'];

      for (const password of commonPasswords) {
        const result = service.validatePassword(password);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Password is too common and easily guessable');
      }
    });

    it('should enforce length requirements', () => {
      const shortPassword = 'Abc1!';
      const result = service.validatePassword(shortPassword);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    it('should enforce character requirements', () => {
      const testCases = [
        { password: 'alllowercase123!', missing: 'uppercase' },
        { password: 'ALLUPPERCASE123!', missing: 'lowercase' },
        { password: 'NoNumbers!', missing: 'number' },
        { password: 'NoSpecialChars123', missing: 'special' },
      ];

      for (const testCase of testCases) {
        const result = service.validatePassword(testCase.password);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });
  });

  describe('containsSqlInjection', () => {
    it('should detect common SQL injection patterns', () => {
      const sqlInjectionAttempts = [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "admin' --",
        "1' UNION SELECT * FROM users --",
        'SELECT * FROM users',
        'INSERT INTO users VALUES',
      ];

      for (const attempt of sqlInjectionAttempts) {
        const result = service.containsSqlInjection(attempt);
        expect(result).toBe(true);
      }
    });

    it('should allow legitimate input', () => {
      const legitimateInputs = [
        'john.doe@example.com',
        'Regular user input',
        'Product name with numbers 123',
        'Normal text without SQL keywords',
      ];

      for (const input of legitimateInputs) {
        const result = service.containsSqlInjection(input);
        expect(result).toBe(false);
      }
    });
  });

  describe('containsNoSqlInjection', () => {
    it('should detect NoSQL injection patterns', () => {
      const noSqlInjectionAttempts = [
        { $gt: '' },
        { $ne: null },
        { $where: 'this.password == this.username' },
        { $regex: '.*' },
        { $or: [{ username: 'admin' }] },
      ];

      for (const attempt of noSqlInjectionAttempts) {
        const result = service.containsNoSqlInjection(attempt);
        expect(result).toBe(true);
      }
    });

    it('should allow legitimate objects', () => {
      const legitimateObjects = [
        { name: 'John', age: 30 },
        { search: 'product name' },
        { filter: 'category' },
        null,
        undefined,
        'string input',
      ];

      for (const input of legitimateObjects) {
        const result = service.containsNoSqlInjection(input);
        if (input === null || input === undefined || typeof input === 'string') {
          expect(result).toBe(false);
        } else {
          expect(result).toBe(false);
        }
      }
    });
  });
});
