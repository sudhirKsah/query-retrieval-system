const config = require('../utils/config');
const logger = require('../utils/logger');

/**
 * Bearer token authentication middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      logger.warn('Authentication failed: No authorization header', {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
        message: 'Authorization header is required'
      });
    }

    const token = authHeader.split(' ')[1]; // Extract token from "Bearer <token>"
    
    if (!token || authHeader.split(' ')[0] !== 'Bearer') {
      logger.warn('Authentication failed: Invalid authorization format', {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      return res.status(401).json({
        error: 'Invalid authentication format',
        code: 'INVALID_AUTH_FORMAT',
        message: 'Authorization header must be in format: Bearer <token>'
      });
    }

    if (token !== config.BEARER_TOKEN) {
      logger.warn('Authentication failed: Invalid token', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        providedToken: token.substring(0, 10) + '...' // Log only first 10 chars for security
      });
      
      return res.status(401).json({
        error: 'Invalid authentication token',
        code: 'INVALID_TOKEN',
        message: 'The provided authentication token is invalid'
      });
    }

    logger.debug('Authentication successful', {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    next();
  } catch (error) {
    logger.error('Authentication middleware error:', error);
    
    return res.status(500).json({
      error: 'Authentication processing error',
      code: 'AUTH_PROCESSING_ERROR',
      message: 'An error occurred while processing authentication'
    });
  }
};

module.exports = authMiddleware;