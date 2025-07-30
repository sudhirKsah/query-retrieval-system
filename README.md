# LLM-Powered Intelligent Query-Retrieval System

A production-ready backend system that processes documents (PDF, DOCX, email) and answers questions using advanced semantic search and LLM capabilities. Built for insurance, legal, HR, and compliance domains.

## 🚀 Features

- **Multi-format Document Processing**: PDF, DOCX, DOC, and email support
- **Semantic Search**: Vector embeddings with Pinecone integration
- **LLM-Powered Answers**: Contextual responses using Google Gemini
- **Explainable AI**: Detailed reasoning and source traceability
- **Production Ready**: Comprehensive logging, error handling, rate limiting
- **Modular Architecture**: Clean, extensible, and testable codebase

## 🏗️ System Architecture

```
Document URL → Document Parser → Text Chunking → Embedding Generation 
     ↓
Vector Storage → Semantic Search → LLM Processing → JSON Response
```

## 📋 API Documentation

### Base URL
```
http://localhost:8000/api/v1
```

### Authentication
```
Authorization: Bearer ********
```

### Main Endpoint

#### POST `/hackrx/run`
Process documents and answer questions.

**Request Body:**
```json
{
    "documents": "https://example.com/document.pdf",
    "questions": [
        "What is the grace period for premium payment?",
        "Does this policy cover maternity expenses?"
    ]
}
```

**Response:**
```json
{
    "answers": [
        "A grace period of thirty days is provided...",
        "Yes, the policy covers maternity expenses..."
    ],
    "metadata": {
        "requestId": "hackrx_1234567890_abc123",
        "processingTime": 5420,
        "documentInfo": {
            "type": "pdf",
            "size": 1048576,
            "chunks": 45,
            "textLength": 125000
        },
        "questionCount": 2,
        "avgConfidence": 85,
        "timestamp": "2024-01-15T10:30:00.000Z"
    }
}
```

## 🛠️ Installation & Setup

### Prerequisites
- Node.js >= 18.0.0
- Google API Key (for Gemini)
- Pinecone Account
- PostgreSQL Database

### Environment Variables
Create a `.env` file:

```env
# Server Configuration
PORT=8000
NODE_ENV=development

# API Security
BEARER_TOKEN=f4709bfa4126e928ebed3f07baca9d6b7e9ae189bca52ba4d2791d5d335b5566

# LLM Configuration
GOOGLE_API_KEY=your_gemini_api_key_here

# Vector Database
PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_ENVIRONMENT=your_pinecone_environment
PINECONE_INDEX_NAME=document-embeddings

# Optional: Database
DATABASE_URL=your_postgres_url_here
```

### Installation
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Start production server
npm start

# Run tests
npm test

# Run linting
npm run lint
```

## 📊 Performance Metrics

- **Accuracy**: Semantic search with 85%+ relevance scores
- **Token Efficiency**: Optimized prompts and chunking strategies
- **Latency**: < 10 seconds for complex multi-question requests
- **Throughput**: Handles 100+ requests per 15-minute window

## 🏛️ Architecture Components

### Services
- **DocumentService**: Multi-format document parsing and processing
- **EmbeddingService**: Vector generation using Google Gemini embeddings
- **VectorService**: Pinecone integration for semantic search
- **LLMService**: Answer generation with explainable reasoning

### Controllers
- **HackrxController**: Main request processing orchestration

### Middleware
- **Authentication**: Bearer token validation
- **Validation**: Request schema validation
- **Error Handling**: Comprehensive error management
- **Rate Limiting**: API usage protection

## 🔧 Configuration

### Document Processing
```javascript
CHUNK_SIZE=1000          // Words per chunk
CHUNK_OVERLAP=200        // Overlap between chunks
MAX_FILE_SIZE=50MB       // Maximum document size
```

### LLM Settings
```javascript
LLM_TEMPERATURE=0.1      // Response creativity (0-1)
LLM_MAX_TOKENS=2000      // Maximum response length
LLM_TOP_K=7             // Top similar chunks to use
SIMILARITY_THRESHOLD=0.6 // Minimum similarity score
```

## 📝 Supported Document Types

- **PDF**: Full text extraction with metadata
- **DOCX/DOC**: Microsoft Word documents
- **Email**: EML and MSG format support
- **Remote URLs**: Direct document download

## 🚦 API Rate Limits

- **Window**: 15 minutes
- **Requests**: 100 per window per IP
- **Document Size**: 50MB maximum
- **Questions**: 50 per request maximum

## 🔍 Monitoring & Logging

### Log Levels
- **Error**: Critical failures and exceptions
- **Warn**: Non-critical issues and fallbacks
- **Info**: Request processing and business logic
- **Debug**: Detailed execution flow (development only)

### Log Files
- `logs/error.log`: Error-level logs only
- `logs/combined.log`: All log levels
- Console output in development mode

## 🧪 Testing

```bash
# Run all tests
npm test

# Test with sample request
curl -X POST http://localhost:8000/api/v1/hackrx/run \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer fe******************************" \
  -d '{
    "documents": "https://example.com/policy.pdf",
    "questions": ["What is covered under this policy?"]
  }'
```

## 🔒 Security Features

- Bearer token authentication
- Request validation and sanitization
- Rate limiting by IP address
- Input size restrictions
- Secure error handling (no sensitive data exposure)

## 📈 Scalability Considerations

- **Horizontal Scaling**: Stateless design for load balancing
- **Caching**: Redis integration for frequently accessed data
- **Batch Processing**: Efficient embedding generation
- **Resource Management**: Memory and token usage optimization

## 🚨 Error Handling

The system provides detailed error responses with appropriate HTTP status codes:

- `400`: Validation errors
- `401`: Authentication failures
- `422`: Document processing errors
- `429`: Rate limit exceeded
- `503`: External service failures
- `500`: Internal server errors
