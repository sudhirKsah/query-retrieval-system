const logger = require('../utils/logger');

/**
 * Global error handler middleware
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const errorHandler = (err, req, res, next) => {
  logger.error('Global error handler:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Handle validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      code: 'VALIDATION_ERROR',
      message: err.message,
      details: err.errors || []
    });
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Authentication Error',
      code: 'AUTH_ERROR',
      message: 'Invalid token'
    });
  }

  // Handle file processing errors
  if (err.code === 'DOCUMENT_PROCESSING_ERROR') {
    return res.status(422).json({
      error: 'Document Processing Error',
      code: 'DOCUMENT_PROCESSING_ERROR',
      message: err.message
    });
  }

  // Handle vector database errors
  if (err.code === 'VECTOR_DB_ERROR') {
    return res.status(503).json({
      error: 'Vector Database Error',
      code: 'VECTOR_DB_ERROR',
      message: 'Failed to process embeddings'
    });
  }

  // Handle LLM API errors
  if (err.code === 'LLM_API_ERROR') {
    return res.status(503).json({
      error: 'LLM API Error',
      code: 'LLM_API_ERROR',
      message: 'Failed to process LLM request'
    });
  }

  // Handle rate limiting
  if (err.status === 429) {
    return res.status(429).json({
      error: 'Rate Limit Exceeded',
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later'
    });
  }

  // Default server error
  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    code: 'INTERNAL_SERVER_ERROR',
    message: process.env.NODE_ENV === 'production' 
      ? 'Something went wrong on our end' 
      : err.message
  });
};

/**
 * 404 Not Found handler
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const notFoundHandler = (req, res) => {
  logger.warn('Route not found', {
    url: req.url,
    method: req.method,
    ip: req.ip
  });

  res.status(404).json({
    error: 'Not Found',
    code: 'ROUTE_NOT_FOUND',
    message: `Route ${req.method} ${req.url} not found`
  });
};

module.exports = {
  errorHandler,
  notFoundHandler
};