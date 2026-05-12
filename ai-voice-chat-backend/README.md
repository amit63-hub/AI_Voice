# AI Voice & Chat Backend

A reliable, scalable backend system for AI-powered voice and chat interactions.

## Features

- **Real-time Chat**: AI-powered conversations with conversation history
- **Voice Support**: Speech-to-text and text-to-speech integration
- **Lead Management**: Capture and manage customer leads
- **Call Management**: Outbound call initiation and tracking
- **SQLite Database**: Simple, reliable data storage
- **Security**: API protection and validation

## API Endpoints

### POST /chat
Process chat messages with AI integration.

**Request:**
```json
{
  "userId": "user123",
  "message": "Hello, I need help with..."
}
```

**Response:**
```json
{
  "response": "AI response message",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### POST /call
Trigger outbound calls.

**Request:**
```json
{
  "phoneNumber": "+1234567890",
  "userId": "user123"
}
```

### POST /voice-webhook
Handle voice input/output from voice services.

### POST /lead
Save lead data.

**Request:**
```json
{
  "name": "John Doe",
  "contact": "john@example.com",
  "intent": "product_inquiry",
  "source": "website"
}
```

## Setup

1. **Install dependencies:**
```bash
npm install
```

2. **Configure environment:**
Copy `.env` file and update:
- `OPENAI_API_KEY`: Your OpenAI API key
- `JWT_SECRET`: Secret for JWT tokens
- `DATABASE_URL`: SQLite database path

3. **Start server:**
```bash
npm run dev
# or
npm start
```

## Database Schema

### Users
- `id`: Unique user identifier
- `name`, `email`, `phone`: User contact info

### Conversations
- `user_id`: Link to user
- `sender`: 'user' or 'assistant'
- `message`: Message content
- `timestamp`: Message time

### Leads
- `name`, `contact`: Lead information
- `intent`: Lead purpose
- `status`: Lead status (new, contacted, converted)

### Calls
- `user_id`: Link to user
- `phone_number`: Call destination
- `status`: Call status
- `duration`: Call length in seconds

## Security

- Helmet.js for security headers
- CORS enabled for cross-origin requests
- Input validation on all endpoints
- Environment variable protection

## Voice Integration

The system supports voice services through webhooks:
- Speech-to-text processing
- AI response generation
- Text-to-speech output
- Call state management

## AI Integration

Uses OpenAI GPT-3.5-turbo with:
- Custom system prompt for customer support
- Conversation history context
- Tool calling capabilities
- Multi-language support

## Performance

- Async processing for all operations
- SQLite for fast data access
- Connection pooling ready
- Error handling and retries

## Development

- `npm run dev`: Start with nodemon
- `npm test`: Run tests
- Health check: `GET /health`

## Deployment

1. Set production environment variables
2. Install production dependencies
3. Start server with PM2 or similar
4. Configure reverse proxy (nginx)
5. Set up SSL certificates

## License

MIT
