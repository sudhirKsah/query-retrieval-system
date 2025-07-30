const axios = require('axios');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const { simpleParser } = require('mailparser');
const logger = require('../utils/logger');
const config = require('../utils/config');

class DocumentService {
  constructor() {
    this.supportedTypes = ['pdf', 'docx', 'doc', 'eml', 'msg'];
  }

  /**
   * Download document from URL
   * @param {string} url - Document URL
   * @returns {Promise<Buffer>} Document buffer
   */
  async downloadDocument(url) {
    try {
      logger.info('Downloading document', { url: url.substring(0, 100) + '...' });
      
      const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'arraybuffer',
        timeout: 30000, // 30 seconds timeout
        maxContentLength: 100 * 1024 * 1024, // 100MB max file size
        headers: {
          'User-Agent': 'LLM-Query-Retrieval-System/1.0.0'
        }
      });

      if (response.status !== 200) {
        throw new Error(`Failed to download document: HTTP ${response.status}`);
      }

      const buffer = Buffer.from(response.data);
      logger.info('Document downloaded successfully', { 
        size: buffer.length,
        contentType: response.headers['content-type']
      });

      return buffer;
    } catch (error) {
      logger.error('Error downloading document:', {
        url: url.substring(0, 100) + '...',
        error: error.message
      });
      
      const docError = new Error(`Failed to download document: ${error.message}`);
      docError.code = 'DOCUMENT_PROCESSING_ERROR';
      throw docError;
    }
  }

  /**
   * Detect document type from URL or content
   * @param {string} url - Document URL
   * @param {Buffer} buffer - Document buffer
   * @returns {string} Document type
   */
  detectDocumentType(url, buffer) {
    // Check URL extension first
    const urlLower = url.toLowerCase();
    if (urlLower.includes('.pdf')) return 'pdf';
    if (urlLower.includes('.docx')) return 'docx';
    if (urlLower.includes('.doc')) return 'doc';
    if (urlLower.includes('.eml')) return 'eml';
    if (urlLower.includes('.msg')) return 'msg';

    // Check magic bytes
    const magicBytes = buffer.slice(0, 8);
    const magicHex = magicBytes.toString('hex').toUpperCase();

    if (magicHex.startsWith('255044462D')) return 'pdf'; // %PDF-
    if (magicHex.startsWith('504B0304') || magicHex.startsWith('504B0506')) return 'docx'; // ZIP signature (DOCX)
    if (magicHex.startsWith('D0CF11E0')) return 'doc'; // OLE signature (DOC)

    // Default to PDF if uncertain
    return 'pdf';
  }

  /**
   * Parse PDF document
   * @param {Buffer} buffer - PDF buffer
   * @returns {Promise<Object>} Parsed content
   */
  async parsePDF(buffer) {
    try {
      logger.debug('Parsing PDF document');
      
      const data = await pdf(buffer, {
        max: 0, // No page limit
        version: 'v1.10.100'
      });

      const result = {
        text: data.text,
        metadata: {
          pages: data.numpages,
          info: data.info || {},
          version: data.version
        }
      };

      logger.info('PDF parsed successfully', {
        pages: result.metadata.pages,
        textLength: result.text.length
      });

      return result;
    } catch (error) {
      logger.error('Error parsing PDF:', error);
      const docError = new Error(`Failed to parse PDF: ${error.message}`);
      docError.code = 'DOCUMENT_PROCESSING_ERROR';
      throw docError;
    }
  }

  /**
   * Parse DOCX document
   * @param {Buffer} buffer - DOCX buffer
   * @returns {Promise<Object>} Parsed content
   */
  async parseDOCX(buffer) {
    try {
      logger.debug('Parsing DOCX document');
      
      const result = await mammoth.extractRawText({ buffer });
      
      const parsedResult = {
        text: result.value,
        metadata: {
          messages: result.messages || []
        }
      };

      logger.info('DOCX parsed successfully', {
        textLength: parsedResult.text.length,
        warnings: result.messages.length
      });

      return parsedResult;
    } catch (error) {
      logger.error('Error parsing DOCX:', error);
      const docError = new Error(`Failed to parse DOCX: ${error.message}`);
      docError.code = 'DOCUMENT_PROCESSING_ERROR';
      throw docError;
    }
  }

  /**
   * Parse email document
   * @param {Buffer} buffer - Email buffer
   * @returns {Promise<Object>} Parsed content
   */
  async parseEmail(buffer) {
    try {
      logger.debug('Parsing email document');
      
      const parsed = await simpleParser(buffer);
      
      const emailText = [
        `Subject: ${parsed.subject || 'No Subject'}`,
        `From: ${parsed.from?.text || 'Unknown'}`,
        `To: ${parsed.to?.text || 'Unknown'}`,
        `Date: ${parsed.date || 'Unknown'}`,
        '',
        parsed.text || parsed.html || 'No content'
      ].join('\n');

      const result = {
        text: emailText,
        metadata: {
          subject: parsed.subject,
          from: parsed.from,
          to: parsed.to,
          date: parsed.date,
          attachments: parsed.attachments?.length || 0
        }
      };

      logger.info('Email parsed successfully', {
        subject: result.metadata.subject,
        textLength: result.text.length,
        attachments: result.metadata.attachments
      });

      return result;
    } catch (error) {
      logger.error('Error parsing email:', error);
      const docError = new Error(`Failed to parse email: ${error.message}`);
      docError.code = 'DOCUMENT_PROCESSING_ERROR';
      throw docError;
    }
  }

  /**
   * Process document from URL
   * @param {string} url - Document URL
   * @returns {Promise<Object>} Processed document content
   */
  async processDocument(url) {
    try {
      logger.info('Starting document processing', { url: url.substring(0, 100) + '...' });
      
      // Download document
      const buffer = await this.downloadDocument(url);
      
      // Detect document type
      const docType = this.detectDocumentType(url, buffer);
      logger.info('Document type detected', { type: docType });

      // Parse based on type
      let parsedContent;
      switch (docType) {
        case 'pdf':
          parsedContent = await this.parsePDF(buffer);
          break;
        case 'docx':
        case 'doc':
          parsedContent = await this.parseDOCX(buffer);
          break;
        case 'eml':
        case 'msg':
          parsedContent = await this.parseEmail(buffer);
          break;
        default:
          throw new Error(`Unsupported document type: ${docType}`);
      }

      // Clean and validate text
      const cleanedText = this.cleanText(parsedContent.text);
      
      if (!cleanedText || cleanedText.length < 10) {
        throw new Error('Document appears to be empty or contains no readable text');
      }

      const result = {
        text: cleanedText,
        metadata: {
          ...parsedContent.metadata,
          type: docType,
          url: url,
          processedAt: new Date().toISOString(),
          size: buffer.length
        }
      };

      logger.info('Document processing completed', {
        type: docType,
        textLength: result.text.length,
        size: buffer.length
      });

      return result;
    } catch (error) {
      logger.error('Document processing failed:', error);
      
      if (error.code === 'DOCUMENT_PROCESSING_ERROR') {
        throw error;
      }
      
      const docError = new Error(`Document processing failed: ${error.message}`);
      docError.code = 'DOCUMENT_PROCESSING_ERROR';
      throw docError;
    }
  }

  /**
   * Clean and normalize text content
   * @param {string} text - Raw text
   * @returns {string} Cleaned text
   */
  cleanText(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }

    return text
      // Remove excessive whitespace
      .replace(/\s+/g, ' ')
      // Remove control characters
      .replace(/[\x00-\x1F\x7F]/g, '')
      // Remove excessive line breaks
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      // Trim
      .trim();
  }

  /**
   * Chunk text into smaller segments for embedding
   * @param {string} text - Document text
   * @param {number} chunkSize - Size of each chunk
   * @param {number} overlap - Overlap between chunks
   * @returns {Array<Object>} Text chunks with metadata
   */
  chunkText(text, chunkSize = config.CHUNK_SIZE, overlap = config.CHUNK_OVERLAP) {
    const chunks = [];
    const words = text.split(/\s+/);
    
    for (let i = 0; i < words.length; i += chunkSize - overlap) {
      const chunk = words.slice(i, i + chunkSize).join(' ');
      
      if (chunk.trim().length > 0) {
        chunks.push({
          text: chunk.trim(),
          startIndex: i,
          endIndex: Math.min(i + chunkSize, words.length),
          chunkId: chunks.length,
          wordCount: chunk.trim().split(/\s+/).length
        });
      }
    }

    logger.info('Text chunked successfully', {
      totalWords: words.length,
      chunks: chunks.length,
      avgChunkSize: chunks.reduce((sum, chunk) => sum + chunk.wordCount, 0) / chunks.length
    });

    return chunks;
  }
}

module.exports = DocumentService;