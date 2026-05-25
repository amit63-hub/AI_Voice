# AI Voice Chat SaaS Platform

## 🚀 Production-Ready AI SaaS Platform

Enterprise-grade AI Voice & Chat Assistant Platform with:

- 💬 Real-time AI Chat (OpenAI GPT-4o)
- 🎤 Voice Input/Output (Web Speech API)
- 👥 User Authentication (JWT)
- 💳 Subscription Plans (Free/Pro/Premium)
- 📊 Dashboard & Analytics
- 📈 Lead Capture System
- 🔒 Rate Limiting & Usage Tracking

---

## 📁 Project Structure

```text
ai-voice-chat-backend/
├── server.js                 # Express backend with all APIs
├── database.js               # SQLite database with sql.js
├── package.json              # Dependencies
├── .env                     # Environment variables
├── .gitignore
├── frontend/                 # Next.js frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx     # Auth redirect
│   │   │   ├── login/page.tsx # Login/Register UI
│   │   │   ├── chat/page.tsx  # Chat interface with voice
│   │   │   └── dashboard/page.tsx # Dashboard & analytics
│   │   └── lib/
│   │       ├── api.ts        # API client
│   │       ├── auth-context.tsx # Auth context
│   │       └── voice.ts      # Speech recognition & TTS
│   └── .env.local           # Frontend env
└── docs/                    # Documentation
```

---

## 🔧 Setup Instructions

### Backend Setup

```bash
cd ai-voice-chat-backend
npm install
# Set your OpenAI API key in .env
echo "OPENAI_API_KEY=sk-proj-xxxxx" > .env
npm start
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

---

## 🌐 API Endpoints

### Auth

- `POST /auth/register` - Register new user
- `POST /auth/login` - Login user
- `GET /auth/me` - Get current user info

### Chat

- `POST /chat` - Send message to AI

### Subscriptions

- `GET /plans` - Get available plans
- `POST /subscribe` - Upgrade plan

### Analytics

- `GET /usage` - Get API usage stats
- `GET /dashboard/stats` - Dashboard data
- `GET /leads` - Get leads list

---

## 💰 Subscription Plans

| Plan   | Price   | Messages/Day | Voice | Model        |
|--------|---------|--------------|-------|--------------|
| Free   | ₹0      | 20           | ❌    | gpt-4o-mini  |
| Pro    | ₹499    | 500          | ✅    | gpt-4o-mini  |
| Premium| ₹1499   | Unlimited    | ✅    | gpt-4o       |

---

## 🚀 Deployment

### Backend (Render/Railway)

1. Connect GitHub repo
2. Set environment variables:
   - `OPENAI_API_KEY`
   - `JWT_SECRET`
   - `PORT=4000`
3. Deploy

### Frontend (Vercel)

1. Connect GitHub repo
2. Set environment variable:
   - `NEXT_PUBLIC_API_URL=https://your-backend-url.com`
3. Deploy

---

## 🧪 Testing

```bash
# Test all endpoints
node test-all.js

# Health check
curl http://localhost:4000/health

# Register user
curl -X POST http://localhost:4000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@test.com","password":"pass123"}'
```

---

## 📱 Features

- ✅ **Authentication** - JWT-based auth with secure tokens
- ✅ **Rate Limiting** - Per-plan message limits
- ✅ **Voice Support** - Speech-to-text & text-to-speech
- ✅ **Multi-language** - English & Hinglish support
- ✅ **Real-time Chat** - Instant AI responses
- ✅ **Dashboard** - Usage analytics & insights
- ✅ **Lead Capture** - Business lead generation
- ✅ **Responsive UI** - Mobile-first design
- ✅ **Dark Theme** - Modern dark interface
- ✅ **Error Handling** - Graceful error management  

---

## 🔒 Security Features

- JWT authentication with expiration
- Rate limiting per subscription plan
- Input validation with Joi
- CORS protection
- Helmet security headers
- SQL injection prevention

---

## 📊 Tech Stack

**Backend:**

- Node.js + Express
- SQLite (sql.js)
- OpenAI API
- JWT authentication
- Helmet security

**Frontend:**

- Next.js 16
- TypeScript
- Tailwind CSS
- React Context
- Web Speech API

---

## 🎯 Business Model

- **Free Tier**: 20 messages/day, no voice
- **Pro Tier**: ₹499/month, 500 messages/day + voice
- **Premium Tier**: ₹1499/month, unlimited + GPT-4o

---

## 📈 Monetization

1. **Subscription Revenue** - Monthly recurring revenue
2. **Lead Generation** - Capture business leads
3. **API Usage** - Track and limit usage
4. **Upsell Path** - Free → Pro → Premium

---

Built with ❤️ for scalable AI SaaS business
