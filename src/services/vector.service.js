// const { Pinecone } = require('@pinecone-database/pinecone');
// const logger = require('../utils/logger');
// const config = require('../utils/config');

// class VectorService {
//   constructor() {
//     if (!config.PINECONE_API_KEY || !config.PINECONE_ENVIRONMENT) {
//       throw new Error('Pinecone API key and environment are required');
//     }

//     this.pinecone = new Pinecone({
//       apiKey: config.PINECONE_API_KEY,
//       // environment: config.PINECONE_ENVIRONMENT
//     });
    
//     this.indexName = config.PINECONE_INDEX_NAME;
//     this.index = null;
//     this.initialized = false;
//   }

//   /**
//    * Initialize Pinecone index
//    * @returns {Promise<void>}
//    */
//   async initialize() {
//     try {
//       if (this.initialized) {
//         return;
//       }

//       logger.info('Initializing Pinecone vector database', {
//         indexName: this.indexName,
//         environment: config.PINECONE_ENVIRONMENT
//       });

//       // Get or create index
//       const indexList = await this.pinecone.listIndexes();
//       const indexExists = indexList.indexes?.some(idx => idx.name === this.indexName);

//       if (!indexExists) {
//         logger.info('Creating new Pinecone index', { indexName: this.indexName });
        
//         await this.pinecone.createIndex({
//           name: this.indexName,
//           dimension: config.EMBEDDING_DIMENSIONS,
//           metric: 'cosine',
//           spec: {
//             serverless: {
//               cloud: 'aws',
//               region: 'us-east-1'
//             }
//           }
//         });

//         // Wait for index to be ready
//         await this.waitForIndexReady();
//       }

//       this.index = this.pinecone.index(this.indexName);
//       this.initialized = true;

//       logger.info('Pinecone vector database initialized successfully');
//     } catch (error) {
//       logger.error('Failed to initialize Pinecone:', error);
      
//       const vectorError = new Error(`Vector database initialization failed: ${error.message}`);
//       vectorError.code = 'VECTOR_DB_ERROR';
//       throw vectorError;
//     }
//   }

//   /**
//    * Wait for Pinecone index to be ready
//    * @param {number} maxWaitTime - Maximum wait time in milliseconds
//    * @returns {Promise<void>}
//    */
//   async waitForIndexReady(maxWaitTime = 60000) {
//     const startTime = Date.now();
    
//     while (Date.now() - startTime < maxWaitTime) {
//       try {
//         const indexDescription = await this.pinecone.describeIndex(this.indexName);
        
//         if (indexDescription.status?.ready) {
//           logger.info('Pinecone index is ready');
//           return;
//         }
        
//         logger.debug('Waiting for Pinecone index to be ready...');
//         await this.delay(2000);
//       } catch (error) {
//         logger.debug('Error checking index status:', error.message);
//         await this.delay(2000);
//       }
//     }
    
//     throw new Error('Timeout waiting for Pinecone index to be ready');
//   }

//   /**
//    * Upsert vectors to Pinecone
//    * @param {Array<Object>} vectors - Vectors with id, values, and metadata
//    * @param {string} namespace - Namespace for the vectors
//    * @returns {Promise<void>}
//    */
//   async upsertVectors(vectors, namespace = 'default') {
//     try {
//       await this.initialize();
      
//       if (!Array.isArray(vectors) || vectors.length === 0) {
//         throw new Error('Invalid vectors array provided');
//       }

//       logger.info('Upserting vectors to Pinecone', {
//         vectorCount: vectors.length,
//         namespace,
//         indexName: this.indexName
//       });

//       // Validate vector format
//       const validatedVectors = vectors.map((vector, index) => {
//         if (!vector.id || !vector.values || !Array.isArray(vector.values)) {
//           throw new Error(`Invalid vector format at index ${index}`);
//         }

//         return {
//           id: String(vector.id),
//           values: vector.values,
//           metadata: vector.metadata || {}
//         };
//       });

//       // Upsert in batches to avoid size limits
//       const batchSize = 100;
//       for (let i = 0; i < validatedVectors.length; i += batchSize) {
//         const batch = validatedVectors.slice(i, i + batchSize);
        
//         await this.index.namespace(namespace).upsert(batch);
        
//         logger.debug('Vector batch upserted', {
//           batchIndex: Math.floor(i / batchSize) + 1,
//           batchSize: batch.length
//         });
//       }

//       logger.info('Vectors upserted successfully', {
//         totalVectors: vectors.length,
//         namespace
//       });
//     } catch (error) {
//       logger.error('Error upserting vectors:', error);
      
//       const vectorError = new Error(`Failed to upsert vectors: ${error.message}`);
//       vectorError.code = 'VECTOR_DB_ERROR';
//       throw vectorError;
//     }
//   }

//   /**
//    * Query vectors from Pinecone
//    * @param {Array<number>} queryVector - Query embedding vector
//    * @param {Object} options - Query options
//    * @returns {Promise<Array<Object>>} Similar vectors with scores
//    */
//   async queryVectors(queryVector, options = {}) {
//     try {
//       await this.initialize();

//       const {
//         topK = config.LLM_TOP_K,
//         namespace = 'default',
//         includeMetadata = true,
//         includeValues = false,
//         filter = null
//       } = options;

//       if (!Array.isArray(queryVector) || queryVector.length === 0) {
//         throw new Error('Invalid query vector provided');
//       }

//       logger.debug('Querying vectors from Pinecone', {
//         vectorDimensions: queryVector.length,
//         topK,
//         namespace,
//         hasFilter: !!filter
//       });

//       const queryRequest = {
//         vector: queryVector,
//         topK,
//         includeMetadata,
//         includeValues
//       };

//       if (filter) {
//         queryRequest.filter = filter;
//       }

//       const queryResponse = await this.index.namespace(namespace).query(queryRequest);
      
//       const results = queryResponse.matches || [];
      
//       logger.info('Vector query completed', {
//         resultsFound: results.length,
//         topScore: results[0]?.score || 0,
//         namespace
//       });

//       return results.map(match => ({
//         id: match.id,
//         score: match.score,
//         metadata: match.metadata || {},
//         values: match.values || []
//       }));
//     } catch (error) {
//       logger.error('Error querying vectors:', error);
      
//       const vectorError = new Error(`Failed to query vectors: ${error.message}`);
//       vectorError.code = 'VECTOR_DB_ERROR';
//       throw vectorError;
//     }
//   }

//   /**
//    * Delete vectors from namespace
//    * @param {Array<string>} ids - Vector IDs to delete
//    * @param {string} namespace - Namespace to delete from
//    * @returns {Promise<void>}
//    */
//   async deleteVectors(ids, namespace = 'default') {
//     try {
//       await this.initialize();

//       if (!Array.isArray(ids) || ids.length === 0) {
//         throw new Error('Invalid IDs array provided');
//       }

//       logger.info('Deleting vectors from Pinecone', {
//         vectorCount: ids.length,
//         namespace
//       });

//       await this.index.namespace(namespace).deleteMany(ids);

//       logger.info('Vectors deleted successfully', {
//         deletedCount: ids.length,
//         namespace
//       });
//     } catch (error) {
//       logger.error('Error deleting vectors:', error);
      
//       const vectorError = new Error(`Failed to delete vectors: ${error.message}`);
//       vectorError.code = 'VECTOR_DB_ERROR';
//       throw vectorError;
//     }
//   }

//   /**
//    * Delete entire namespace
//    * @param {string} namespace - Namespace to delete
//    * @returns {Promise<void>}
//    */
//   async deleteNamespace(namespace) {
//     try {
//       await this.initialize();

//       logger.warn('Deleting entire namespace', { namespace });

//       await this.index.namespace(namespace).deleteAll();

//       logger.warn('Namespace deleted successfully', { namespace });
//     } catch (error) {
//       logger.error('Error deleting namespace:', error);
      
//       const vectorError = new Error(`Failed to delete namespace: ${error.message}`);
//       vectorError.code = 'VECTOR_DB_ERROR';
//       throw vectorError;
//     }
//   }

//   /**
//    * Get index statistics
//    * @param {string} namespace - Namespace to get stats for
//    * @returns {Promise<Object>} Index statistics
//    */
//   async getIndexStats(namespace = 'default') {
//     try {
//       await this.initialize();

//       const stats = await this.index.describeIndexStats();
      
//       return {
//         totalVectors: stats.totalVectorCount || 0,
//         namespaces: stats.namespaces || {},
//         dimension: stats.dimension || 0,
//         indexFullness: stats.indexFullness || 0
//       };
//     } catch (error) {
//       logger.error('Error getting index stats:', error);
//       return {
//         totalVectors: 0,
//         namespaces: {},
//         dimension: 0,
//         indexFullness: 0
//       };
//     }
//   }

//   /**
//    * Generate unique vector ID
//    * @param {string} prefix - ID prefix
//    * @returns {string} Unique ID
//    */
//   generateVectorId(prefix = 'vec') {
//     const timestamp = Date.now();
//     const random = Math.random().toString(36).substring(2, 15);
//     return `${prefix}_${timestamp}_${random}`;
//   }

//   /**
//    * Delay execution
//    * @param {number} ms - Milliseconds to delay
//    * @returns {Promise<void>}
//    */
//   delay(ms) {
//     return new Promise(resolve => setTimeout(resolve, ms));
//   }
// }

// module.exports = VectorService;














const { Pinecone } = require('@pinecone-database/pinecone');
const logger = require('../utils/logger');
const config = require('../utils/config');

class VectorService {
  constructor() {
    if (!config.PINECONE_API_KEY || !config.PINECONE_ENVIRONMENT) {
      throw new Error('Pinecone API key and environment are required');
    }

    this.pinecone = new Pinecone({
      apiKey: config.PINECONE_API_KEY,
      // environment: config.PINECONE_ENVIRONMENT
    });
    
    this.indexName = config.PINECONE_INDEX_NAME;
    this.index = null;
    this.initialized = false;
  }

  /**
   * Initialize Pinecone index
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      if (this.initialized) {
        return;
      }

      logger.info('Initializing Pinecone vector database', {
        indexName: this.indexName,
        environment: config.PINECONE_ENVIRONMENT
      });

      // Get or create index
      const indexList = await this.pinecone.listIndexes();
      const indexExists = indexList.indexes?.some(idx => idx.name === this.indexName);

      if (!indexExists) {
        logger.info('Creating new Pinecone index', { indexName: this.indexName });
        
        await this.pinecone.createIndex({
          name: this.indexName,
          dimension: config.EMBEDDING_DIMENSIONS,
          metric: 'cosine',
          spec: {
            serverless: {
              cloud: 'aws',
              region: 'us-east-1'
            }
          }
        });

        // Wait for index to be ready
        await this.waitForIndexReady();
      }

      this.index = this.pinecone.index(this.indexName);
      this.initialized = true;

      logger.info('Pinecone vector database initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Pinecone:', error);
      
      const vectorError = new Error(`Vector database initialization failed: ${error.message}`);
      vectorError.code = 'VECTOR_DB_ERROR';
      throw vectorError;
    }
  }

  /**
   * Wait for Pinecone index to be ready
   * @param {number} maxWaitTime - Maximum wait time in milliseconds
   * @returns {Promise<void>}
   */
  async waitForIndexReady(maxWaitTime = 60000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        const indexDescription = await this.pinecone.describeIndex(this.indexName);
        
        if (indexDescription.status?.ready) {
          logger.info('Pinecone index is ready');
          return;
        }
        
        logger.debug('Waiting for Pinecone index to be ready...');
        await this.delay(2000);
      } catch (error) {
        logger.debug('Error checking index status:', error.message);
        await this.delay(2000);
      }
    }
    
    throw new Error('Timeout waiting for Pinecone index to be ready');
  }

  /**
   * Upsert vectors to Pinecone
   * @param {Array<Object>} vectors - Vectors with id, values, and metadata
   * @param {string} namespace - Namespace for the vectors
   * @returns {Promise<void>}
   */
  async upsertVectors(vectors, namespace = 'default') {
    try {
      await this.initialize();
      
      if (!Array.isArray(vectors) || vectors.length === 0) {
        throw new Error('Invalid vectors array provided');
      }

      logger.info('Upserting vectors to Pinecone', {
        vectorCount: vectors.length,
        namespace,
        indexName: this.indexName
      });

      // Validate vector format
      const validatedVectors = vectors.map((vector, index) => {
        if (!vector.id || !vector.values || !Array.isArray(vector.values)) {
          throw new Error(`Invalid vector format at index ${index}`);
        }

        return {
          id: String(vector.id),
          values: vector.values,
          metadata: vector.metadata || {}
        };
      });

      // Upsert in batches to avoid size limits
      const batchSize = 100;
      for (let i = 0; i < validatedVectors.length; i += batchSize) {
        const batch = validatedVectors.slice(i, i + batchSize);
        
        await this.index.namespace(namespace).upsert(batch);
        
        logger.debug('Vector batch upserted', {
          batchIndex: Math.floor(i / batchSize) + 1,
          batchSize: batch.length
        });
      }

      logger.info('Vectors upserted successfully', {
        totalVectors: vectors.length,
        namespace
      });
    } catch (error) {
      logger.error('Error upserting vectors:', error);
      
      const vectorError = new Error(`Failed to upsert vectors: ${error.message}`);
      vectorError.code = 'VECTOR_DB_ERROR';
      throw vectorError;
    }
  }

  /**
   * Query vectors from Pinecone
   * @param {Array<number>} queryVector - Query embedding vector
   * @param {Object} options - Query options
   * @returns {Promise<Array<Object>>} Similar vectors with scores
   */
  async queryVectors(queryVector, options = {}) {
    try {
      await this.initialize();

      const {
        topK = config.LLM_TOP_K,
        namespace = 'default',
        includeMetadata = true,
        includeValues = false,
        filter = null
      } = options;

      if (!Array.isArray(queryVector) || queryVector.length === 0) {
        throw new Error('Invalid query vector provided');
      }

      logger.debug('Querying vectors from Pinecone', {
        vectorDimensions: queryVector.length,
        topK,
        namespace,
        hasFilter: !!filter
      });

      const queryRequest = {
        vector: queryVector,
        topK,
        includeMetadata,
        includeValues
      };

      if (filter) {
        queryRequest.filter = filter;
      }

      const queryResponse = await this.index.namespace(namespace).query(queryRequest);
      
      const results = queryResponse.matches || [];
      
      logger.info('Vector query completed', {
        resultsFound: results.length,
        topScore: results[0]?.score || 0,
        namespace,
        belowThreshold: results.filter(r => r.score < config.SIMILARITY_THRESHOLD).length
      });

      return results.map(match => ({
        id: match.id,
        score: match.score,
        metadata: match.metadata || {},
        values: match.values || []
      }));
    } catch (error) {
      logger.error('Error querying vectors:', error);
      
      const vectorError = new Error(`Failed to query vectors: ${error.message}`);
      vectorError.code = 'VECTOR_DB_ERROR';
      throw vectorError;
    }
  }

  /**
   * Delete vectors from namespace
   * @param {Array<string>} ids - Vector IDs to delete
   * @param {string} namespace - Namespace to delete from
   * @returns {Promise<void>}
   */
  async deleteVectors(ids, namespace = 'default') {
    try {
      await this.initialize();

      if (!Array.isArray(ids) || ids.length === 0) {
        throw new Error('Invalid IDs array provided');
      }

      logger.info('Deleting vectors from Pinecone', {
        vectorCount: ids.length,
        namespace
      });

      await this.index.namespace(namespace).deleteMany(ids);

      logger.info('Vectors deleted successfully', {
        deletedCount: ids.length,
        namespace
      });
    } catch (error) {
      logger.error('Error deleting vectors:', error);
      
      const vectorError = new Error(`Failed to delete vectors: ${error.message}`);
      vectorError.code = 'VECTOR_DB_ERROR';
      throw vectorError;
    }
  }

  /**
   * Delete entire namespace
   * @param {string} namespace - Namespace to delete
   * @returns {Promise<void>}
   */
  async deleteNamespace(namespace) {
    try {
      await this.initialize();

      logger.warn('Deleting entire namespace', { namespace });

      await this.index.namespace(namespace).deleteAll();

      logger.warn('Namespace deleted successfully', { namespace });
    } catch (error) {
      logger.error('Error deleting namespace:', error);
      
      const vectorError = new Error(`Failed to delete namespace: ${error.message}`);
      vectorError.code = 'VECTOR_DB_ERROR';
      throw vectorError;
    }
  }

  /**
   * Get index statistics
   * @param {string} namespace - Namespace to get stats for
   * @returns {Promise<Object>} Index statistics
   */
  async getIndexStats(namespace = 'default') {
    try {
      await this.initialize();

      const stats = await this.index.describeIndexStats();
      
      return {
        totalVectors: stats.totalVectorCount || 0,
        namespaces: stats.namespaces || {},
        dimension: stats.dimension || 0,
        indexFullness: stats.indexFullness || 0
      };
    } catch (error) {
      logger.error('Error getting index stats:', error);
      return {
        totalVectors: 0,
        namespaces: {},
        dimension: 0,
        indexFullness: 0
      };
    }
  }

  /**
   * Generate unique vector ID
   * @param {string} prefix - ID prefix
   * @returns {string} Unique ID
   */
  generateVectorId(prefix = 'vec') {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `${prefix}_${timestamp}_${random}`;
  }

  /**
   * Delay execution
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = VectorService;