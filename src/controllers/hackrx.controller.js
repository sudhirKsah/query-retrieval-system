// const DocumentService = require('../services/document.service');
// const EmbeddingService = require('../services/embedding.service');
// const VectorService = require('../services/vector.service');
// const LLMService = require('../services/llm.service');
// const logger = require('../utils/logger');

// class HackrxController {
//   constructor() {
//     this.documentService = new DocumentService();
//     this.embeddingService = new EmbeddingService();
//     this.vectorService = new VectorService();
//     this.llmService = new LLMService();
//   }

//   /**
//    * Main endpoint for processing documents and answering questions
//    * POST /hackrx/run
//    */
//   async run(req, res) {
//     const startTime = Date.now();
//     const requestId = this.generateRequestId();
    
//     try {
//       const { documents: documentUrl, questions } = req.body;
      
//       logger.info('HackRX run request started', {
//         requestId,
//         documentUrl: documentUrl.substring(0, 100) + '...',
//         questionCount: questions.length,
//         ip: req.ip
//       });

//       // Step 1: Process Document
//       logger.info('Step 1: Processing document', { requestId });
//       const processedDocument = await this.documentService.processDocument(documentUrl);
      
//       // Step 2: Chunk Document
//       logger.info('Step 2: Chunking document', { requestId });
//       const documentChunks = this.documentService.chunkText(
//         processedDocument.text,
//         1000, // chunk size
//         200   // overlap
//       );

//       // Step 3: Generate Embeddings for Chunks
//       logger.info('Step 3: Generating embeddings for document chunks', { 
//         requestId,
//         chunkCount: documentChunks.length 
//       });
      
//       const chunkTexts = documentChunks.map(chunk => chunk.text);
//       const chunkEmbeddings = await this.embeddingService.generateBatchEmbeddings(chunkTexts);
      
//       // Combine chunks with their embeddings
//       const chunksWithEmbeddings = documentChunks.map((chunk, index) => ({
//         ...chunk,
//         embedding: chunkEmbeddings[index]
//       })).filter(chunk => chunk.embedding); // Filter out chunks without embeddings

//       // Step 4: Store in Vector Database (optional - for persistence)
//       const namespace = this.generateNamespace(requestId);
      
//       try {
//         logger.info('Step 4: Storing vectors in database', { 
//           requestId,
//           namespace,
//           vectorCount: chunksWithEmbeddings.length 
//         });
        
//         const vectors = chunksWithEmbeddings.map(chunk => ({
//           id: this.vectorService.generateVectorId('chunk'),
//           values: chunk.embedding,
//           metadata: {
//             text: chunk.text,
//             chunkId: chunk.chunkId,
//             startIndex: chunk.startIndex,
//             endIndex: chunk.endIndex,
//             wordCount: chunk.wordCount,
//             documentUrl: documentUrl.substring(0, 100),
//             requestId,
//             createdAt: new Date().toISOString()
//           }
//         }));

//         await this.vectorService.upsertVectors(vectors, namespace);
//       } catch (vectorError) {
//         logger.warn('Vector storage failed, continuing with in-memory processing', {
//           requestId,
//           error: vectorError.message
//         });
//       }

//       // Step 5: Process Questions
//       logger.info('Step 5: Processing questions with LLM', { 
//         requestId,
//         questionCount: questions.length 
//       });
      
//       const answers = await this.processQuestionsWithSemanticSearch(
//         questions,
//         chunksWithEmbeddings,
//         processedDocument.metadata
//       );

//       // Step 6: Clean up vector database (optional)
//       try {
//         await this.vectorService.deleteNamespace(namespace);
//         logger.debug('Temporary namespace cleaned up', { requestId, namespace });
//       } catch (cleanupError) {
//         logger.warn('Cleanup failed (non-critical)', {
//           requestId,
//           error: cleanupError.message
//         });
//       }

//       // Step 7: Prepare Response
//       const endTime = Date.now();
//       const processingTime = endTime - startTime;

//       const response = {
//         answers: answers.map(answer => answer.answer),
//         metadata: {
//           requestId,
//           processingTime,
//           documentInfo: {
//             type: processedDocument.metadata.type,
//             size: processedDocument.metadata.size,
//             chunks: chunksWithEmbeddings.length,
//             textLength: processedDocument.text.length
//           },
//           questionCount: questions.length,
//           avgConfidence: this.calculateAverageConfidence(answers),
//           timestamp: new Date().toISOString()
//         }
//       };

//       logger.info('HackRX run request completed successfully', {
//         requestId,
//         processingTime,
//         questionCount: questions.length,
//         avgConfidence: response.metadata.avgConfidence
//       });

//       res.json(response);
//     } catch (error) {
//       const endTime = Date.now();
//       const processingTime = endTime - startTime;
      
//       logger.error('HackRX run request failed', {
//         requestId,
//         error: error.message,
//         stack: error.stack,
//         processingTime,
//         ip: req.ip
//       });

//       // Return appropriate error response
//       const statusCode = this.getErrorStatusCode(error);
      
//       res.status(statusCode).json({
//         error: 'Request Processing Failed',
//         code: error.code || 'PROCESSING_ERROR',
//         message: error.message,
//         requestId,
//         processingTime,
//         timestamp: new Date().toISOString()
//       });
//     }
//   }

//   /**
//    * Process questions using semantic search on document chunks
//    * @param {Array<string>} questions - Questions to process
//    * @param {Array<Object>} chunksWithEmbeddings - Document chunks with embeddings
//    * @param {Object} documentMetadata - Document metadata
//    * @returns {Promise<Array<Object>>} Processed answers
//    */
//   async processQuestionsWithSemanticSearch(questions, chunksWithEmbeddings, documentMetadata) {
//     const answers = [];
    
//     for (let i = 0; i < questions.length; i++) {
//       const question = questions[i];
      
//       try {
//         logger.debug('Processing question with semantic search', {
//           questionIndex: i + 1,
//           totalQuestions: questions.length,
//           question: question.substring(0, 100) + '...'
//         });

//         // Generate embedding for the question
//         const questionEmbedding = await this.embeddingService.generateEmbedding(question);
        
//         // Find most similar chunks using cosine similarity
//         // const similarChunks = this.embeddingService.findSimilar(
//         //   questionEmbedding,
//         //   chunksWithEmbeddings,
//         //   5 // top 5 most relevant chunks
//         // );

//         const similarChunks = await this.vectorService.queryVectors(questionEmbedding, {
//           namespace:'default',
//           topK: 10, // Increase to retrieve more chunks
//           includeMetadata: true
//         });

//         // Generate answer using LLM
//         const answer = await this.llmService.generateAnswer(
//           question,
//           similarChunks,
//           documentMetadata
//         );

//         answers.push({
//           ...answer,
//           questionIndex: i,
//           question
//         });

//         // Small delay between questions
//         if (i < questions.length - 1) {
//           await this.delay(50);
//         }
//       } catch (questionError) {
//         logger.error('Error processing individual question', {
//           questionIndex: i,
//           question: question.substring(0, 100),
//           error: questionError.message
//         });

//         answers.push({
//           answer: "I encountered an error while processing this question. Please try again.",
//           confidence: 0,
//           sources: [],
//           reasoning: `Processing error: ${questionError.message}`,
//           error: true,
//           questionIndex: i,
//           question
//         });
//       }
//     }

//     return answers;
//   }

//   /**
//    * Calculate average confidence across all answers
//    * @param {Array<Object>} answers - Array of answer objects
//    * @returns {number} Average confidence score
//    */
//   calculateAverageConfidence(answers) {
//     if (!answers || answers.length === 0) return 0;
    
//     const validAnswers = answers.filter(answer => !answer.error && answer.confidence);
//     if (validAnswers.length === 0) return 0;
    
//     const totalConfidence = validAnswers.reduce((sum, answer) => sum + answer.confidence, 0);
//     return Math.round(totalConfidence / validAnswers.length);
//   }

//   /**
//    * Generate unique request ID
//    * @returns {string} Unique request ID
//    */
//   generateRequestId() {
//     const timestamp = Date.now();
//     const random = Math.random().toString(36).substring(2, 15);
//     return `hackrx_${timestamp}_${random}`;
//   }

//   /**
//    * Generate namespace for vector storage
//    * @param {string} requestId - Request ID
//    * @returns {string} Namespace
//    */
//   generateNamespace(requestId) {
//     return `temp_${requestId}`;
//   }

//   /**
//    * Get appropriate HTTP status code for error
//    * @param {Error} error - Error object
//    * @returns {number} HTTP status code
//    */
//   getErrorStatusCode(error) {
//     switch (error.code) {
//       case 'DOCUMENT_PROCESSING_ERROR':
//         return 422; // Unprocessable Entity
//       case 'VECTOR_DB_ERROR':
//         return 503; // Service Unavailable
//       case 'LLM_API_ERROR':
//         return 503; // Service Unavailable
//       case 'EMBEDDING_ERROR':
//         return 503; // Service Unavailable
//       case 'VALIDATION_ERROR':
//         return 400; // Bad Request
//       default:
//         return 500; // Internal Server Error
//     }
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

// module.exports = HackrxController;























const DocumentService = require('../services/document.service');
const EmbeddingService = require('../services/embedding.service');
const VectorService = require('../services/vector.service');
const LLMService = require('../services/llm.service');
const logger = require('../utils/logger');
const config = require('../utils/config');

class HackrxController {
  constructor() {
    this.documentService = new DocumentService();
    this.embeddingService = new EmbeddingService();
    this.vectorService = new VectorService();
    this.llmService = new LLMService();
  }

  /**
   * Main endpoint for processing documents and answering questions
   * POST /hackrx/run
   */
  async run(req, res) {
    const startTime = Date.now();
    const requestId = this.generateRequestId();
    
    try {
      const { documents: documentUrl, questions } = req.body;
      
      logger.info('HackRX run request started', {
        requestId,
        documentUrl: documentUrl.substring(0, 100) + '...',
        questionCount: questions.length,
        ip: req.ip
      });

      // Step 1: Process Document
      logger.info('Step 1: Processing document', { requestId });
      const processedDocument = await this.documentService.processDocument(documentUrl);
      
      // Step 2: Chunk Document
      logger.info('Step 2: Chunking document', { requestId });
      const documentChunks = this.documentService.chunkText(
        processedDocument.text,
        1000, // chunk size
        200   // overlap
      );

      // Step 3: Generate Embeddings for Chunks
      logger.info('Step 3: Generating embeddings for document chunks', { 
        requestId,
        chunkCount: documentChunks.length 
      });
      
      const chunkTexts = documentChunks.map(chunk => chunk.text);
      const chunkEmbeddings = await this.embeddingService.generateBatchEmbeddings(chunkTexts);
      
      // Combine chunks with their embeddings
      const chunksWithEmbeddings = documentChunks.map((chunk, index) => ({
        ...chunk,
        embedding: chunkEmbeddings[index]
      })).filter(chunk => chunk.embedding); // Filter out chunks without embeddings

      // Step 4: Store in Vector Database (optional - for persistence)
      const namespace = this.generateNamespace(requestId);
      
      try {
        logger.info('Step 4: Storing vectors in database', { 
          requestId,
          namespace,
          vectorCount: chunksWithEmbeddings.length 
        });
        
        const vectors = chunksWithEmbeddings.map(chunk => ({
          id: this.vectorService.generateVectorId('chunk'),
          values: chunk.embedding,
          metadata: {
            text: chunk.text,
            chunkId: chunk.chunkId,
            startIndex: chunk.startIndex,
            endIndex: chunk.endIndex,
            wordCount: chunk.wordCount,
            documentUrl: documentUrl.substring(0, 100),
            requestId,
            createdAt: new Date().toISOString()
          }
        }));

        await this.vectorService.upsertVectors(vectors, namespace);
      } catch (vectorError) {
        logger.warn('Vector storage failed, continuing with in-memory processing', {
          requestId,
          error: vectorError.message
        });
      }

      // Step 5: Process Questions
      logger.info('Step 5: Processing questions with LLM', { 
        requestId,
        questionCount: questions.length 
      });
      
      const answers = await this.processQuestionsWithSemanticSearch(
        questions,
        chunksWithEmbeddings,
        processedDocument.metadata,
        namespace
      );

      // Step 6: Clean up vector database (optional)
      try {
        await this.vectorService.deleteNamespace(namespace);
        logger.debug('Temporary namespace cleaned up', { requestId, namespace });
      } catch (cleanupError) {
        logger.warn('Cleanup failed (non-critical)', {
          requestId,
          error: cleanupError.message
        });
      }

      // Step 7: Prepare Response
      const endTime = Date.now();
      const processingTime = endTime - startTime;

      const response = {
        answers: answers.map(answer => answer.answer),
        metadata: {
          requestId,
          processingTime,
          documentInfo: {
            type: processedDocument.metadata.type,
            size: processedDocument.metadata.size,
            chunks: chunksWithEmbeddings.length,
            textLength: processedDocument.text.length
          },
          questionCount: questions.length,
          avgConfidence: this.calculateAverageConfidence(answers),
          timestamp: new Date().toISOString()
        }
      };

      logger.info('HackRX run request completed successfully', {
        requestId,
        processingTime,
        questionCount: questions.length,
        avgConfidence: response.metadata.avgConfidence
      });

      res.json(response);
    } catch (error) {
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      logger.error('HackRX run request failed', {
        requestId,
        error: error.message,
        stack: error.stack,
        processingTime,
        ip: req.ip
      });

      // Return appropriate error response
      const statusCode = this.getErrorStatusCode(error);
      
      res.status(statusCode).json({
        error: 'Request Processing Failed',
        code: error.code || 'PROCESSING_ERROR',
        message: error.message,
        requestId,
        processingTime,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Process questions using semantic search on document chunks
   * @param {Array<string>} questions - Questions to process
   * @param {Array<Object>} chunksWithEmbeddings - Document chunks with embeddings (fallback)
   * @param {Object} documentMetadata - Document metadata
   * @param {string} namespace - Vector database namespace
   * @returns {Promise<Array<Object>>} Processed answers
   */
  async processQuestionsWithSemanticSearch(questions, chunksWithEmbeddings, documentMetadata, namespace) {
    const answers = [];
    
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      
      try {
        logger.debug('Processing question with semantic search', {
          questionIndex: i + 1,
          totalQuestions: questions.length,
          question: question.substring(0, 100) + '...'
        });

        // Generate embedding for the question
        const questionEmbedding = await this.embeddingService.generateEmbedding(question);
        
        // Find most similar chunks using vector database first, then fallback to in-memory
        const similarChunks = await this.findRelevantChunksWithVectorDB(
          questionEmbedding,
          chunksWithEmbeddings,
          namespace,
          5 // top 5 most relevant chunks
        );

        // Generate answer using LLM
        const answer = await this.llmService.generateAnswer(
          question,
          similarChunks,
          documentMetadata
        );

        answers.push({
          ...answer,
          questionIndex: i,
          question
        });

        // Small delay between questions
        if (i < questions.length - 1) {
          await this.delay(50);
        }
      } catch (questionError) {
        logger.error('Error processing individual question', {
          questionIndex: i,
          question: question.substring(0, 100),
          error: questionError.message
        });

        answers.push({
          answer: "I encountered an error while processing this question. Please try again.",
          confidence: 0,
          sources: [],
          reasoning: `Processing error: ${questionError.message}`,
          error: true,
          questionIndex: i,
          question
        });
      }
    }

    return answers;
  }

  /**
   * Find relevant chunks using vector database with fallback to in-memory search
   * @param {Array<number>} questionEmbedding - Question embedding vector
   * @param {Array<Object>} chunksWithEmbeddings - Fallback chunks with embeddings
   * @param {string} namespace - Vector database namespace
   * @param {number} topK - Number of top results to return
   * @returns {Promise<Array<Object>>} Relevant chunks with similarity scores
   */
  async findRelevantChunksWithVectorDB(questionEmbedding, chunksWithEmbeddings, namespace, topK = 5) {
    try {
      logger.debug('Searching for relevant chunks using vector database', {
        namespace,
        topK,
        embeddingDimensions: questionEmbedding.length
      });

      // Primary: Use vector database for semantic search
      const vectorResults = await this.vectorService.queryVectors(questionEmbedding, {
        topK: topK * 2, // Get more results to filter better
        namespace,
        includeMetadata: true,
        includeValues: false
      });

      if (vectorResults && vectorResults.length > 0) {
        logger.info('Vector database search successful', {
          resultsFound: vectorResults.length,
          topScore: vectorResults[0]?.score || 0,
          namespace
        });

        // Convert vector results to the expected format
        const relevantChunks = vectorResults
          .filter(result => result.score >= config.SIMILARITY_THRESHOLD)
          .slice(0, topK)
          .map(result => ({
            text: result.metadata.text,
            chunkId: result.metadata.chunkId,
            startIndex: result.metadata.startIndex,
            endIndex: result.metadata.endIndex,
            wordCount: result.metadata.wordCount,
            similarity: result.score,
            relevanceScore: result.score,
            source: 'vector_db'
          }));

        if (relevantChunks.length > 0) {
          logger.debug('Using vector database results', {
            chunksReturned: relevantChunks.length,
            avgSimilarity: relevantChunks.reduce((sum, chunk) => sum + chunk.similarity, 0) / relevantChunks.length
          });
          return relevantChunks;
        }
      }

      logger.warn('Vector database search failed or returned no results, falling back to in-memory search', {
        namespace,
        vectorResultsCount: vectorResults?.length || 0
      });

      // Fallback: Use in-memory cosine similarity
      const fallbackChunks = this.embeddingService.findSimilar(
        questionEmbedding,
        chunksWithEmbeddings,
        topK
      );

      // Mark fallback results
      const markedFallbackChunks = fallbackChunks.map(chunk => ({
        ...chunk,
        source: 'in_memory_fallback'
      }));

      logger.info('Using in-memory fallback search', {
        chunksReturned: markedFallbackChunks.length,
        avgSimilarity: markedFallbackChunks.length > 0 
          ? markedFallbackChunks.reduce((sum, chunk) => sum + chunk.similarity, 0) / markedFallbackChunks.length 
          : 0
      });

      return markedFallbackChunks;
    } catch (error) {
      logger.error('Error in vector search with fallback:', {
        error: error.message,
        namespace
      });

      // Final fallback to in-memory search
      const fallbackChunks = this.embeddingService.findSimilar(
        questionEmbedding,
        chunksWithEmbeddings,
        topK
      );

      return fallbackChunks.map(chunk => ({
        ...chunk,
        source: 'error_fallback'
      }));
    }
  }

  /**
   * Calculate average confidence across all answers
   * @param {Array<Object>} answers - Array of answer objects
   * @returns {number} Average confidence score
   */
  calculateAverageConfidence(answers) {
    if (!answers || answers.length === 0) return 0;
    
    const validAnswers = answers.filter(answer => !answer.error && answer.confidence);
    if (validAnswers.length === 0) return 0;
    
    const totalConfidence = validAnswers.reduce((sum, answer) => sum + answer.confidence, 0);
    return Math.round(totalConfidence / validAnswers.length);
  }

  /**
   * Generate unique request ID
   * @returns {string} Unique request ID
   */
  generateRequestId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `hackrx_${timestamp}_${random}`;
  }

  /**
   * Generate namespace for vector storage
   * @param {string} requestId - Request ID
   * @returns {string} Namespace
   */
  generateNamespace(requestId) {
    return `temp_${requestId}`;
  }

  /**
   * Get appropriate HTTP status code for error
   * @param {Error} error - Error object
   * @returns {number} HTTP status code
   */
  getErrorStatusCode(error) {
    switch (error.code) {
      case 'DOCUMENT_PROCESSING_ERROR':
        return 422; // Unprocessable Entity
      case 'VECTOR_DB_ERROR':
        return 503; // Service Unavailable
      case 'LLM_API_ERROR':
        return 503; // Service Unavailable
      case 'EMBEDDING_ERROR':
        return 503; // Service Unavailable
      case 'VALIDATION_ERROR':
        return 400; // Bad Request
      default:
        return 500; // Internal Server Error
    }
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

module.exports = HackrxController;