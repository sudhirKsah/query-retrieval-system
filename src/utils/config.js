require('dotenv').config();

const config = {
  // Server
  PORT: process.env.PORT || 8000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Security
  BEARER_TOKEN: process.env.BEARER_TOKEN || 'f4709bfa4126e928ebed3f07baca9d6b7e9ae189bca52ba4d2791d5d335b5566',
  
  // CORS
  CORS_ORIGINS: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['*'],
  
  // LLM APIs
  GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  
  // Vector Database
  PINECONE_API_KEY: process.env.PINECONE_API_KEY,
  PINECONE_ENVIRONMENT: process.env.PINECONE_ENVIRONMENT,
  PINECONE_INDEX_NAME: process.env.PINECONE_INDEX_NAME || 'document-embeddings',
  
  // Database
  DATABASE_URL: process.env.DATABASE_URL,
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  
  // Document Processing
  MAX_FILE_SIZE: process.env.MAX_FILE_SIZE || '50MB',
  CHUNK_SIZE: parseInt(process.env.CHUNK_SIZE) || 1000,
  CHUNK_OVERLAP: parseInt(process.env.CHUNK_OVERLAP) || 200,
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  
  // Embeddings
  EMBEDDING_DIMENSIONS: 768, // gemini // OpenAI ada-002 dimensions = 1536
  SIMILARITY_THRESHOLD: 0.6,
  
  // LLM Settings
  LLM_TEMPERATURE: 0.1,
  LLM_MAX_TOKENS: 2000,
  LLM_TOP_K: 7,
  
  // Validation
  validateRequired() {
    const required = [
      'GOOGLE_API_KEY',
      'PINECONE_API_KEY',
      'PINECONE_ENVIRONMENT'
    ];
    
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
  }
};

// Validate configuration on startup
if (config.NODE_ENV === 'production') {
  config.validateRequired();
}

module.exports = config;