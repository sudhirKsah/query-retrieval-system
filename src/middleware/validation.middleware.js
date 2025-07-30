const { body, validationResult } = require('express-validator');
const logger = require('../utils/logger');

/**
 * Validation rules for hackrx/run endpoint
 */
const validateHackrxRun = [
  body('documents')
    .isString()
    .withMessage('Documents must be a string URL')
    .isURL()
    .withMessage('Documents must be a valid URL')
    .custom((value) => {
      // Check if URL points to supported file types
      const supportedExtensions = ['.pdf', '.docx', '.doc'];
      const hasValidExtension = supportedExtensions.some(ext => 
        value.toLowerCase().includes(ext) || 
        value.includes('blob.core.windows.net') // Azure blob storage
      );
      
      if (!hasValidExtension) {
        throw new Error('Document URL must point to a PDF, DOCX, or DOC file');
      }
      return true;
    }),
    
  body('questions')
    .isArray()
    .withMessage('Questions must be an array')
    .notEmpty()
    .withMessage('Questions array cannot be empty')
    .custom((questions) => {
      if (questions.length > 50) {
        throw new Error('Maximum 50 questions allowed per request');
      }
      
      questions.forEach((question, index) => {
        if (typeof question !== 'string') {
          throw new Error(`Question at index ${index} must be a string`);
        }
        if (question.trim().length === 0) {
          throw new Error(`Question at index ${index} cannot be empty`);
        }
        if (question.length > 1000) {
          throw new Error(`Question at index ${index} exceeds maximum length of 1000 characters`);
        }
      });
      
      return true;
    })
];

/**
 * Middleware to handle validation errors
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorDetails = errors.array().map(error => ({
      field: error.path,
      message: error.msg,
      value: error.value
    }));
    
    logger.warn('Validation failed', {
      url: req.url,
      method: req.method,
      ip: req.ip,
      errors: errorDetails
    });
    
    return res.status(400).json({
      error: 'Validation Error',
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: errorDetails
    });
  }
  
  next();
};

module.exports = {
  validateHackrxRun,
  handleValidationErrors
};