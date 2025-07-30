const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('express-async-errors');

const config = require('./utils/config');
const logger = require('./utils/logger');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const authMiddleware = require('./middleware/auth.middleware');
const apiRoutes = require('./routes/api.routes');

class Application {
  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  setupMiddleware() {
    // Security and performance middleware
    this.app.use(helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false
    }));
    
    this.app.use(cors({
      origin: config.CORS_ORIGINS,
      credentials: true
    }));
    
    this.app.use(compression());
    
    // Rate limiting
    const limiter = rateLimit({
      windowMs: config.RATE_LIMIT_WINDOW_MS,
      max: config.RATE_LIMIT_MAX_REQUESTS,
      message: {
        error: 'Too many requests from this IP, please try again later.',
        code: 'RATE_LIMIT_EXCEEDED'
      }
    });
    
    this.app.use('/api/', limiter);
    
    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Request logging
    this.app.use((req, res, next) => {
      logger.info('Request received', {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      next();
    });
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0'
      });
    });

    // API routes
    this.app.use('/api/v1', authMiddleware, apiRoutes);
  }

  setupErrorHandling() {
    this.app.use(notFoundHandler);
    this.app.use(errorHandler);
  }

  start() {
    const port = config.PORT;
    
    this.app.listen(port, () => {
      logger.info(`Server running on port ${port}`, {
        environment: config.NODE_ENV,
        port
      });
    });

    // Graceful shutdown
    process.on('SIGTERM', this.gracefulShutdown);
    process.on('SIGINT', this.gracefulShutdown);
  }

  gracefulShutdown = (signal) => {
    logger.info(`Received ${signal}, shutting down gracefully`);
    process.exit(0);
  }
}

// Start the application
const app = new Application();
app.start();

module.exports = app;