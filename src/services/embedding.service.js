const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../utils/logger');
const config = require('../utils/config');

class EmbeddingService {
  constructor() {
    if (!config.GOOGLE_API_KEY) {
      throw new Error('Google API key is required for embedding generation');
    }
    
    this.genAI = new GoogleGenerativeAI(config.GOOGLE_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: 'embedding-001' });
    this.batchSize = 10; // Process embeddings in batches
  }

  /**
   * Generate embedding for a single text
   * @param {string} text - Text to embed
   * @returns {Promise<Array<number>>} Embedding vector
   */
  async generateEmbedding(text) {
    try {
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        throw new Error('Invalid text provided for embedding');
      }

      // Truncate text if too long (Gemini has token limits)
      const truncatedText = text.length > 8000 ? text.substring(0, 8000) + '...' : text;
      
      logger.debug('Generating embedding for text', {
        textLength: text.length,
        truncatedLength: truncatedText.length
      });

      const result = await this.model.embedContent(truncatedText);
      const embedding = result.embedding.values;

      if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
        throw new Error('Invalid embedding response from API');
      }

      logger.debug('Embedding generated successfully', {
        dimensions: embedding.length,
        textLength: truncatedText.length
      });

      return embedding;
    } catch (error) {
      logger.error('Error generating embedding:', {
        error: error.message,
        textLength: text?.length
      });
      
      const embeddingError = new Error(`Failed to generate embedding: ${error.message}`);
      embeddingError.code = 'EMBEDDING_ERROR';
      throw embeddingError;
    }
  }

  /**
   * Generate embeddings for multiple texts in batches
   * @param {Array<string>} texts - Array of texts to embed
   * @returns {Promise<Array<Array<number>>>} Array of embedding vectors
   */
  async generateBatchEmbeddings(texts) {
    try {
      if (!Array.isArray(texts) || texts.length === 0) {
        throw new Error('Invalid texts array provided');
      }

      logger.info('Generating batch embeddings', {
        totalTexts: texts.length,
        batchSize: this.batchSize
      });

      const embeddings = [];
      const startTime = Date.now();

      // Process in batches to avoid rate limits
      for (let i = 0; i < texts.length; i += this.batchSize) {
        const batch = texts.slice(i, i + this.batchSize);
        const batchPromises = batch.map(text => this.generateEmbedding(text));
        
        try {
          const batchResults = await Promise.all(batchPromises);
          embeddings.push(...batchResults);
          
          logger.debug('Batch processed', {
            batchIndex: Math.floor(i / this.batchSize) + 1,
            batchSize: batch.length,
            totalProcessed: embeddings.length
          });
          
          // Add small delay between batches to respect rate limits
          if (i + this.batchSize < texts.length) {
            await this.delay(100);
          }
        } catch (batchError) {
          logger.error('Batch processing failed:', {
            batchIndex: Math.floor(i / this.batchSize) + 1,
            error: batchError.message
          });
          
          // Try individual processing for failed batch
          const individualResults = [];
          for (const text of batch) {
            try {
              const embedding = await this.generateEmbedding(text);
              individualResults.push(embedding);
              await this.delay(50);
            } catch (individualError) {
              logger.error('Individual embedding failed:', {
                error: individualError.message,
                textLength: text.length
              });
              // Push null for failed embeddings - will be filtered out later
              individualResults.push(null);
            }
          }
          embeddings.push(...individualResults);
        }
      }

      // Filter out null embeddings
      const validEmbeddings = embeddings.filter(emb => emb !== null);
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;

      logger.info('Batch embedding generation completed', {
        totalTexts: texts.length,
        successfulEmbeddings: validEmbeddings.length,
        failedEmbeddings: texts.length - validEmbeddings.length,
        processingTimeMs: processingTime,
        avgTimePerEmbedding: processingTime / validEmbeddings.length
      });

      return validEmbeddings;
    } catch (error) {
      logger.error('Batch embedding generation failed:', error);
      
      const embeddingError = new Error(`Batch embedding generation failed: ${error.message}`);
      embeddingError.code = 'EMBEDDING_ERROR';
      throw embeddingError;
    }
  }

  /**
   * Calculate cosine similarity between two embeddings
   * @param {Array<number>} embedding1 - First embedding vector
   * @param {Array<number>} embedding2 - Second embedding vector
   * @returns {number} Similarity score between -1 and 1
   */
  calculateCosineSimilarity(embedding1, embedding2) {
    try {
      if (!Array.isArray(embedding1) || !Array.isArray(embedding2)) {
        throw new Error('Embeddings must be arrays');
      }

      if (embedding1.length !== embedding2.length) {
        throw new Error('Embeddings must have the same dimensions');
      }

      let dotProduct = 0;
      let norm1 = 0;
      let norm2 = 0;

      for (let i = 0; i < embedding1.length; i++) {
        dotProduct += embedding1[i] * embedding2[i];
        norm1 += embedding1[i] * embedding1[i];
        norm2 += embedding2[i] * embedding2[i];
      }

      norm1 = Math.sqrt(norm1);
      norm2 = Math.sqrt(norm2);

      if (norm1 === 0 || norm2 === 0) {
        return 0;
      }

      return dotProduct / (norm1 * norm2);
    } catch (error) {
      logger.error('Error calculating cosine similarity:', error);
      return 0;
    }
  }

  /**
   * Find most similar embeddings to query
   * @param {Array<number>} queryEmbedding - Query embedding vector
   * @param {Array<Object>} candidates - Candidate embeddings with metadata
   * @param {number} topK - Number of top results to return
   * @returns {Array<Object>} Top similar results with scores
   */
  findSimilar(queryEmbedding, candidates, topK = config.LLM_TOP_K) {
    try {
      const similarities = candidates.map((candidate, index) => {
        const similarity = this.calculateCosineSimilarity(queryEmbedding, candidate.embedding);
        
        return {
          ...candidate,
          similarity,
          index
        };
      });

      // Sort by similarity (highest first) and take top K
      const topResults = similarities
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK)
        .filter(result => result.similarity > config.SIMILARITY_THRESHOLD);

      logger.debug('Similarity search completed', {
        totalCandidates: candidates.length,
        topK,
        resultsReturned: topResults.length,
        topSimilarity: topResults[0]?.similarity || 0
      });

      return topResults;
    } catch (error) {
      logger.error('Error finding similar embeddings:', error);
      return [];
    }
  }

  /**
   * Delay execution for rate limiting
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate embedding vector
   * @param {Array<number>} embedding - Embedding vector to validate
   * @returns {boolean} True if valid
   */
  isValidEmbedding(embedding) {
    return Array.isArray(embedding) && 
           embedding.length > 0 && 
           embedding.every(val => typeof val === 'number' && !isNaN(val));
  }
}

module.exports = EmbeddingService;