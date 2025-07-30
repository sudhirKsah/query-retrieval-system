// const { GoogleGenerativeAI } = require('@google/generative-ai');
// const logger = require('../utils/logger');
// const config = require('../utils/config');

// class LLMService {
//   constructor() {
//     if (!config.GOOGLE_API_KEY) {
//       throw new Error('Google API key is required for LLM service');
//     }
    
//     this.genAI = new GoogleGenerativeAI(config.GOOGLE_API_KEY);
//     this.model = this.genAI.getGenerativeModel({ 
//       model: 'gemini-2.0-flash',
//       generationConfig: {
//         temperature: config.LLM_TEMPERATURE,
//         maxOutputTokens: config.LLM_MAX_TOKENS,
//         topP: 0.95,
//         topK: config.LLM_TOP_K
//       }
//     });
//   }

//   /**
//    * Generate answer for a question using relevant context
//    * @param {string} question - User question
//    * @param {Array<Object>} relevantChunks - Relevant document chunks
//    * @param {Object} documentMetadata - Document metadata
//    * @returns {Promise<Object>} Generated answer with explanation
//    */
//   async generateAnswer(question, relevantChunks, documentMetadata) {
//     try {
//       if (!question || typeof question !== 'string') {
//         throw new Error('Invalid question provided');
//       }

//       if (!Array.isArray(relevantChunks) || relevantChunks.length === 0) {
//         return {
//           answer: "I couldn't find relevant information in the document to answer this question.",
//           confidence: 0,
//           sources: [],
//           reasoning: "No relevant context found in the document."
//         };
//       }

//       logger.debug('Generating answer with LLM', {
//         questionLength: question.length,
//         relevantChunks: relevantChunks.length,
//         documentType: documentMetadata?.type
//       });

//       // Prepare context from relevant chunks
//       const context = this.prepareContext(relevantChunks, documentMetadata);
      
//       // Create prompt
//       const prompt = this.createAnswerPrompt(question, context, documentMetadata);
      
//       // Generate response
//       const startTime = Date.now();
//       const result = await this.model.generateContent(prompt);
//       const endTime = Date.now();
      
//       const response = result.response;
//       const generatedText = response.text();
      
//       // Parse structured response
//       const parsedAnswer = this.parseStructuredResponse(generatedText);
      
//       // Add metadata to response
//       const finalAnswer = {
//         ...parsedAnswer,
//         sources: this.extractSources(relevantChunks),
//         processingTime: endTime - startTime,
//         tokensUsed: this.estimateTokens(prompt + generatedText),
//         documentInfo: {
//           type: documentMetadata?.type,
//           pages: documentMetadata?.pages,
//           size: documentMetadata?.size
//         }
//       };

//       logger.info('Answer generated successfully', {
//         questionLength: question.length,
//         answerLength: finalAnswer.answer.length,
//         confidence: finalAnswer.confidence,
//         sources: finalAnswer.sources.length,
//         processingTime: finalAnswer.processingTime
//       });

//       return finalAnswer;
//     } catch (error) {
//       logger.error('Error generating answer:', {
//         error: error.message,
//         question: question?.substring(0, 100)
//       });
      
//       const llmError = new Error(`Failed to generate answer: ${error.message}`);
//       llmError.code = 'LLM_API_ERROR';
//       throw llmError;
//     }
//   }

//   /**
//    * Process multiple questions in batch
//    * @param {Array<string>} questions - Array of questions
//    * @param {Array<Object>} documentChunks - Document chunks with embeddings
//    * @param {Object} documentMetadata - Document metadata
//    * @returns {Promise<Array<Object>>} Array of answers
//    */
//   async processQuestions(questions, documentChunks, documentMetadata) {
//     try {
//       if (!Array.isArray(questions) || questions.length === 0) {
//         throw new Error('Invalid questions array provided');
//       }

//       logger.info('Processing batch questions', {
//         totalQuestions: questions.length,
//         totalChunks: documentChunks?.length
//       });

//       const answers = [];
//       const startTime = Date.now();

//       // Process questions sequentially to manage rate limits and token usage
//       for (let i = 0; i < questions.length; i++) {
//         const question = questions[i];
        
//         try {
//           logger.debug('Processing question', {
//             questionIndex: i + 1,
//             totalQuestions: questions.length,
//             question: question.substring(0, 100) + '...'
//           });

//           // Find relevant chunks for this specific question
//           const relevantChunks = await this.findRelevantChunks(question, documentChunks);
          
//           // Generate answer
//           const answer = await this.generateAnswer(question, relevantChunks, documentMetadata);
          
//           answers.push({
//             question,
//             ...answer,
//             questionIndex: i
//           });

//           // Add small delay between questions to respect rate limits
//           if (i < questions.length - 1) {
//             await this.delay(100);
//           }
//         } catch (questionError) {
//           logger.error('Error processing individual question:', {
//             questionIndex: i,
//             error: questionError.message
//           });
          
//           // Add error response for failed question
//           answers.push({
//             question,
//             answer: "I encountered an error while processing this question. Please try again.",
//             confidence: 0,
//             sources: [],
//             reasoning: `Processing error: ${questionError.message}`,
//             error: true,
//             questionIndex: i
//           });
//         }
//       }

//       const endTime = Date.now();
//       const totalProcessingTime = endTime - startTime;

//       logger.info('Batch question processing completed', {
//         totalQuestions: questions.length,
//         successfulAnswers: answers.filter(a => !a.error).length,
//         failedAnswers: answers.filter(a => a.error).length,
//         totalProcessingTime,
//         avgTimePerQuestion: totalProcessingTime / questions.length
//       });

//       return answers;
//     } catch (error) {
//       logger.error('Batch question processing failed:', error);
      
//       const llmError = new Error(`Batch processing failed: ${error.message}`);
//       llmError.code = 'LLM_API_ERROR';
//       throw llmError;
//     }
//   }

//   /**
//    * Find relevant chunks for a specific question
//    * @param {string} question - Question to find relevant chunks for
//    * @param {Array<Object>} documentChunks - All document chunks
//    * @returns {Promise<Array<Object>>} Relevant chunks
//    */
//   async findRelevantChunks(question, documentChunks) {
//     try {
//       // This is a simplified relevance scoring based on keyword matching
//       // In production, you would use the embedding service to find semantic similarity
//       const questionLower = question.toLowerCase();
//       const keywords = questionLower.split(/\s+/).filter(word => word.length > 3);
      
//       const scoredChunks = documentChunks.map(chunk => {
//         const chunkLower = chunk.text.toLowerCase();
//         let score = 0;
        
//         // Simple keyword matching score
//         keywords.forEach(keyword => {
//           const matches = (chunkLower.match(new RegExp(keyword, 'g')) || []).length;
//           score += matches;
//         });
        
//         // Normalize by chunk length
//         score = score / (chunk.text.length / 1000);
        
//         return {
//           ...chunk,
//           relevanceScore: score
//         };
//       });
      
//       // Return top relevant chunks
//       return scoredChunks
//         .sort((a, b) => b.relevanceScore - a.relevanceScore)
//         .slice(0, config.LLM_TOP_K)
//         .filter(chunk => chunk.relevanceScore > 0);
//     } catch (error) {
//       logger.error('Error finding relevant chunks:', error);
//       return documentChunks.slice(0, config.LLM_TOP_K);
//     }
//   }

//   /**
//    * Prepare context from relevant chunks
//    * @param {Array<Object>} relevantChunks - Relevant document chunks
//    * @param {Object} documentMetadata - Document metadata
//    * @returns {string} Formatted context
//    */
//   prepareContext(relevantChunks, documentMetadata) {
//     const contextParts = [
//       `Document Type: ${documentMetadata?.type || 'Unknown'}`,
//       `Document Source: ${documentMetadata?.url?.substring(0, 50) || 'Unknown'}...`,
//       '',
//       'Relevant Content:'
//     ];

//     relevantChunks.forEach((chunk, index) => {
//       contextParts.push(`\n--- Section ${index + 1} ---`);
//       contextParts.push(chunk.text);
      
//       if (chunk.relevanceScore) {
//         contextParts.push(`(Relevance: ${chunk.relevanceScore.toFixed(2)})`);
//       }
//     });

//     return contextParts.join('\n');
//   }

//   /**
//    * Create prompt for answer generation
//    * @param {string} question - User question
//    * @param {string} context - Document context
//    * @param {Object} documentMetadata - Document metadata
//    * @returns {string} Formatted prompt
//    */
//   createAnswerPrompt(question, context, documentMetadata) {
//     return `You are an expert document analyst specializing in insurance, legal, HR, and compliance domains. Your task is to provide accurate, detailed answers based on the provided document content.

// INSTRUCTIONS:
// 1. Answer the question using ONLY the information provided in the context
// 2. Be specific and detailed in your response
// 3. Include relevant conditions, limitations, or exceptions
// 4. If the information is not available in the context, clearly state this
// 5. Provide your confidence level (0-100%)
// 6. Explain your reasoning process

// RESPONSE FORMAT:
// Your response must be in this exact JSON format:
// {
//   "answer": "Your detailed answer here",
//   "confidence": 85,
//   "reasoning": "Explanation of how you arrived at this answer"
// }

// CONTEXT:
// ${context}

// QUESTION: ${question}

// RESPONSE:`;
//   }

//   /**
//    * Parse structured response from LLM
//    * @param {string} generatedText - Raw LLM response
//    * @returns {Object} Parsed response object
//    */
//   parseStructuredResponse(generatedText) {
//     try {
//       // Try to extract JSON from the response
//       const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
      
//       if (jsonMatch) {
//         const jsonStr = jsonMatch[0];
//         const parsed = JSON.parse(jsonStr);
        
//         return {
//           answer: parsed.answer || generatedText,
//           confidence: Math.min(Math.max(parsed.confidence || 50, 0), 100),
//           reasoning: parsed.reasoning || 'Analysis based on document content'
//         };
//       }
      
//       // Fallback to plain text response
//       return {
//         answer: generatedText,
//         confidence: 70,
//         reasoning: 'Plain text response from document analysis'
//       };
//     } catch (error) {
//       logger.warn('Failed to parse structured response, using plain text:', error.message);
      
//       return {
//         answer: generatedText,
//         confidence: 60,
//         reasoning: 'Fallback response due to parsing error'
//       };
//     }
//   }

//   /**
//    * Extract source information from chunks
//    * @param {Array<Object>} relevantChunks - Relevant chunks used for answer
//    * @returns {Array<Object>} Source information
//    */
//   extractSources(relevantChunks) {
//     return relevantChunks.map((chunk, index) => ({
//       id: chunk.chunkId || index,
//       text: chunk.text.substring(0, 200) + '...',
//       startIndex: chunk.startIndex,
//       endIndex: chunk.endIndex,
//       relevanceScore: chunk.relevanceScore || chunk.similarity || 0
//     }));
//   }

//   /**
//    * Estimate token usage (rough approximation)
//    * @param {string} text - Text to estimate tokens for
//    * @returns {number} Estimated token count
//    */
//   estimateTokens(text) {
//     // Rough estimation: ~4 characters per token for English text
//     return Math.ceil(text.length / 4);
//   }

//   /**
//    * Delay execution
//    * @param {number} ms - Milliseconds to delay
//    * @returns {Promise<void>}
//    */
//   delay(ms) {
//     return new Promise(resolve => setTimeout(resolve, ms));
//   }

//   /**
//    * Validate question format and content
//    * @param {string} question - Question to validate
//    * @returns {boolean} True if valid
//    */
//   isValidQuestion(question) {
//     return typeof question === 'string' && 
//            question.trim().length >= 5 && 
//            question.length <= 1000;
//   }
// }

// module.exports = LLMService;























const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../utils/logger');
const config = require('../utils/config');

class LLMService {
  constructor() {
    if (!config.GOOGLE_API_KEY) {
      throw new Error('Google API key is required for LLM service');
    }
    
    this.genAI = new GoogleGenerativeAI(config.GOOGLE_API_KEY);
    this.model = this.genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: config.LLM_TEMPERATURE,
        maxOutputTokens: config.LLM_MAX_TOKENS,
        topP: 0.95,
        topK: config.LLM_TOP_K
      }
    });
  }

  /**
   * Generate answer for a question using relevant context
   * @param {string} question - User question
   * @param {Array<Object>} relevantChunks - Relevant document chunks
   * @param {Object} documentMetadata - Document metadata
   * @returns {Promise<Object>} Generated answer with explanation
   */
  async generateAnswer(question, relevantChunks, documentMetadata) {
    try {
      if (!question || typeof question !== 'string') {
        throw new Error('Invalid question provided');
      }

      if (!Array.isArray(relevantChunks) || relevantChunks.length === 0) {
        return {
          answer: "I couldn't find relevant information in the document to answer this question.",
          confidence: 0,
          sources: [],
          reasoning: "No relevant context found in the document."
        };
      }

      logger.debug('Generating answer with LLM', {
        questionLength: question.length,
        relevantChunks: relevantChunks.length,
        documentType: documentMetadata?.type
      });

      // Prepare context from relevant chunks
      const context = this.prepareContext(relevantChunks, documentMetadata);
      
      // Create prompt
      const prompt = this.createAnswerPrompt(question, context, documentMetadata);
      
      // Generate response
      const startTime = Date.now();
      const result = await this.model.generateContent(prompt);
      const endTime = Date.now();
      
      const response = result.response;
      const generatedText = response.text();
      
      // Parse structured response
      const parsedAnswer = this.parseStructuredResponse(generatedText);
      
      // Add metadata to response
      const finalAnswer = {
        ...parsedAnswer,
        sources: this.extractSources(relevantChunks),
        processingTime: endTime - startTime,
        tokensUsed: this.estimateTokens(prompt + generatedText),
        documentInfo: {
          type: documentMetadata?.type,
          pages: documentMetadata?.pages,
          size: documentMetadata?.size
        }
      };

      logger.info('Answer generated successfully', {
        questionLength: question.length,
        answerLength: finalAnswer.answer.length,
        confidence: finalAnswer.confidence,
        sources: finalAnswer.sources.length,
        processingTime: finalAnswer.processingTime
      });

      return finalAnswer;
    } catch (error) {
      logger.error('Error generating answer:', {
        error: error.message,
        question: question?.substring(0, 100)
      });
      
      const llmError = new Error(`Failed to generate answer: ${error.message}`);
      llmError.code = 'LLM_API_ERROR';
      throw llmError;
    }
  }

  /**
   * Process multiple questions in batch
   * @param {Array<string>} questions - Array of questions
   * @param {Array<Object>} documentChunks - Document chunks with embeddings
   * @param {Object} documentMetadata - Document metadata
   * @returns {Promise<Array<Object>>} Array of answers
   */
  async processQuestions(questions, documentChunks, documentMetadata) {
    try {
      if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error('Invalid questions array provided');
      }

      logger.info('Processing batch questions', {
        totalQuestions: questions.length,
        totalChunks: documentChunks?.length
      });

      const answers = [];
      const startTime = Date.now();

      // Process questions sequentially to manage rate limits and token usage
      for (let i = 0; i < questions.length; i++) {
        const question = questions[i];
        
        try {
          logger.debug('Processing question', {
            questionIndex: i + 1,
            totalQuestions: questions.length,
            question: question.substring(0, 100) + '...'
          });

          // Find relevant chunks for this specific question
          const relevantChunks = await this.findRelevantChunks(question, documentChunks);
          
          // Generate answer
          const answer = await this.generateAnswer(question, relevantChunks, documentMetadata);
          
          answers.push({
            question,
            ...answer,
            questionIndex: i
          });

          // Add small delay between questions to respect rate limits
          if (i < questions.length - 1) {
            await this.delay(100);
          }
        } catch (questionError) {
          logger.error('Error processing individual question:', {
            questionIndex: i,
            error: questionError.message
          });
          
          // Add error response for failed question
          answers.push({
            question,
            answer: "I encountered an error while processing this question. Please try again.",
            confidence: 0,
            sources: [],
            reasoning: `Processing error: ${questionError.message}`,
            error: true,
            questionIndex: i
          });
        }
      }

      const endTime = Date.now();
      const totalProcessingTime = endTime - startTime;

      logger.info('Batch question processing completed', {
        totalQuestions: questions.length,
        successfulAnswers: answers.filter(a => !a.error).length,
        failedAnswers: answers.filter(a => a.error).length,
        totalProcessingTime,
        avgTimePerQuestion: totalProcessingTime / questions.length
      });

      return answers;
    } catch (error) {
      logger.error('Batch question processing failed:', error);
      
      const llmError = new Error(`Batch processing failed: ${error.message}`);
      llmError.code = 'LLM_API_ERROR';
      throw llmError;
    }
  }

  /**
   * Find relevant chunks for a specific question
   * @param {string} question - Question to find relevant chunks for
   * @param {Array<Object>} documentChunks - All document chunks
   * @returns {Promise<Array<Object>>} Relevant chunks
   */
  async findRelevantChunks(question, documentChunks) {
    try {
      logger.warn('Using deprecated findRelevantChunks method - should use vector database search instead');
      
      // Simplified relevance scoring based on keyword matching (fallback only)
      const questionLower = question.toLowerCase();
      const keywords = questionLower.split(/\s+/).filter(word => word.length > 3);
      
      const scoredChunks = documentChunks.map(chunk => {
        const chunkLower = chunk.text.toLowerCase();
        let score = 0;
        
        // Simple keyword matching score
        keywords.forEach(keyword => {
          const matches = (chunkLower.match(new RegExp(keyword, 'g')) || []).length;
          score += matches;
        });
        
        // Normalize by chunk length
        score = score / (chunk.text.length / 1000);
        
        return {
          ...chunk,
          relevanceScore: score
        };
      });
      
      // Return top relevant chunks
      return scoredChunks
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, config.LLM_TOP_K)
        .filter(chunk => chunk.relevanceScore > 0)
        .map(chunk => ({
          ...chunk,
          source: 'keyword_matching_fallback'
        }));
    } catch (error) {
      logger.error('Error finding relevant chunks:', error);
      return documentChunks.slice(0, config.LLM_TOP_K).map(chunk => ({
        ...chunk,
        source: 'error_fallback'
      }));
    }
  }

  /**
   * Prepare context from relevant chunks
   * @param {Array<Object>} relevantChunks - Relevant document chunks
   * @param {Object} documentMetadata - Document metadata
   * @returns {string} Formatted context
   */
  prepareContext(relevantChunks, documentMetadata) {
    const contextParts = [
      `Document Type: ${documentMetadata?.type || 'Unknown'}`,
      `Document Source: ${documentMetadata?.url?.substring(0, 50) || 'Unknown'}...`,
      '',
      'Relevant Content:'
    ];

    relevantChunks.forEach((chunk, index) => {
      contextParts.push(`\n--- Section ${index + 1} ---`);
      contextParts.push(chunk.text);
      
      if (chunk.relevanceScore) {
        contextParts.push(`(Relevance: ${chunk.relevanceScore.toFixed(2)})`);
      }
    });

    return contextParts.join('\n');
  }

  /**
   * Create prompt for answer generation
   * @param {string} question - User question
   * @param {string} context - Document context
   * @param {Object} documentMetadata - Document metadata
   * @returns {string} Formatted prompt
   */
  createAnswerPrompt(question, context, documentMetadata) {
    return `You are an expert document analyst specializing in insurance, legal, HR, and compliance domains. Your task is to provide accurate, detailed answers based on the provided document content.

INSTRUCTIONS:
1. Answer the question using ONLY the information provided in the context
2. Be specific and detailed in your response
3. Include relevant conditions, limitations, or exceptions
4. If the information is not available in the context, clearly state this
5. Provide your confidence level (0-100%)
6. Explain your reasoning process

RESPONSE FORMAT:
Your response must be in this exact JSON format:
{
  "answer": "Your detailed answer here",
  "confidence": 85,
  "reasoning": "Explanation of how you arrived at this answer"
}

CONTEXT:
${context}

QUESTION: ${question}

RESPONSE:`;
  }

  /**
   * Parse structured response from LLM
   * @param {string} generatedText - Raw LLM response
   * @returns {Object} Parsed response object
   */
  parseStructuredResponse(generatedText) {
    try {
      // Try to extract JSON from the response
      const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const jsonStr = jsonMatch[0];
        const parsed = JSON.parse(jsonStr);
        
        return {
          answer: parsed.answer || generatedText,
          confidence: Math.min(Math.max(parsed.confidence || 50, 0), 100),
          reasoning: parsed.reasoning || 'Analysis based on document content'
        };
      }
      
      // Fallback to plain text response
      return {
        answer: generatedText,
        confidence: 70,
        reasoning: 'Plain text response from document analysis'
      };
    } catch (error) {
      logger.warn('Failed to parse structured response, using plain text:', error.message);
      
      return {
        answer: generatedText,
        confidence: 60,
        reasoning: 'Fallback response due to parsing error'
      };
    }
  }

  /**
   * Extract source information from chunks
   * @param {Array<Object>} relevantChunks - Relevant chunks used for answer
   * @returns {Array<Object>} Source information
   */
  extractSources(relevantChunks) {
    return relevantChunks.map((chunk, index) => ({
      id: chunk.chunkId || index,
      text: chunk.text.substring(0, 200) + '...',
      startIndex: chunk.startIndex,
      endIndex: chunk.endIndex,
      relevanceScore: chunk.relevanceScore || chunk.similarity || 0,
      searchMethod: chunk.source || 'unknown'
    }));
  }

  /**
   * Estimate token usage (rough approximation)
   * @param {string} text - Text to estimate tokens for
   * @returns {number} Estimated token count
   */
  estimateTokens(text) {
    // Rough estimation: ~4 characters per token for English text
    return Math.ceil(text.length / 4);
  }

  /**
   * Delay execution
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate question format and content
   * @param {string} question - Question to validate
   * @returns {boolean} True if valid
   */
  isValidQuestion(question) {
    return typeof question === 'string' && 
           question.trim().length >= 5 && 
           question.length <= 1000;
  }
}

module.exports = LLMService;