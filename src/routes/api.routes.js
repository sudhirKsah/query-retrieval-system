const express = require('express');
const { validateHackrxRun, handleValidationErrors } = require('../middleware/validation.middleware');
const HackrxController = require('../controllers/hackrx.controller');
const logger = require('../utils/logger');

const router = express.Router();
const hackrxController = new HackrxController();

/**
 * POST /hackrx/run
 * Main endpoint for document processing and question answering
 */
router.post('/hackrx/run', 
  validateHackrxRun,
  handleValidationErrors,
  async (req, res, next) => {
    try {
      await hackrxController.run(req, res);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /health
 * Health check endpoint for the API
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'llm-query-retrieval-api',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development'
  });
});

/**
 * GET /status
 * Detailed status endpoint with service dependencies
 */
router.get('/status', async (req, res) => {
  const status = {
    api: 'operational',
    database: 'unknown',
    vectorDb: 'unknown',
    llm: 'unknown',
    timestamp: new Date().toISOString()
  };

  try {
    // Check Vector Database
    const vectorService = new (require('../services/vector.service'))();
    await vectorService.initialize();
    const stats = await vectorService.getIndexStats();
    
    status.vectorDb = 'operational';
    status.vectorDbStats = stats;
  } catch (error) {
    status.vectorDb = 'error';
    status.vectorDbError = error.message;
  }

  try {
    // Check LLM Service
    const llmService = new (require('../services/llm.service'))();
    const testResponse = await llmService.generateAnswer(
      'Test question',
      [{ text: 'Test context', chunkId: 0 }],
      { type: 'test' }
    );
    
    status.llm = testResponse ? 'operational' : 'error';
  } catch (error) {
    status.llm = 'error';
    status.llmError = error.message;
  }

  const overallStatus = Object.values(status)
    .filter(val => typeof val === 'string' && ['operational', 'error', 'unknown'].includes(val))
    .every(val => val === 'operational') ? 'healthy' : 'degraded';

  res.status(overallStatus === 'healthy' ? 200 : 503).json({
    status: overallStatus,
    services: status
  });
});

/**
 * Error handling for API routes
 */
router.use((error, req, res, next) => {
  logger.error('API route error:', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip
  });

  res.status(error.status || 500).json({
    error: 'API Error',
    message: error.message,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;