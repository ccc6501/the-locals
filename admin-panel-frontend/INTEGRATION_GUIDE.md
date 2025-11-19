# React + FastAPI Integration Guide

## 🔌 Connecting Frontend to Backend

### Step 1: Backend Setup

```powershell
# Navigate to backend directory
cd fastapi-backend

# Run the automated setup
.\setup.ps1

# Or manual setup:
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python init_db.py
python main.py
```

Backend will run at: **<http://localhost:8000>**

### Step 2: Frontend Setup

```powershell
# Navigate to frontend directory
cd admin-panel-frontend

# Install dependencies
npm install
# or
yarn install

# Create environment file
copy .env.example .env
```

**Edit `.env`:**

```env
REACT_APP_API_URL=http://localhost:8000/api
REACT_APP_WS_URL=ws://localhost:8000/ws
```

### Step 3: Update Your Component

Replace your current AdminPanel import with the connected version:

```javascript
// Before
import AdminPanel from './admin-panel-production';

// After
import AdminPanel from './AdminPanelConnected';
// or use the API client directly in your existing component
import api from './api/apiClient';
```

### Step 4: Run Both Servers

**Terminal 1 - Backend:**

```powershell
cd fastapi-backend
.\venv\Scripts\activate
python main.py
```

**Terminal 2 - Frontend:**

```powershell
cd admin-panel-frontend
npm start
# or
yarn start
```

## 📁 File Structure

```
project/
├── fastapi-backend/          # Backend server
│   ├── main.py
│   ├── routers/
│   ├── models.py
│   ├── init_db.py
│   └── ...
│
└── admin-panel-frontend/     # React frontend
    ├── src/
    │   ├── api/
    │   │   └── apiClient.js  # ✨ API integration layer
    │   ├── AdminPanelConnected.jsx  # ✨ Connected component
    │   └── admin-panel-production.jsx  # Original mock version
    ├── .env  # API URL configuration
    └── package.json
```

## 🔑 API Client Usage

### Authentication

```javascript
import api from './api/apiClient';

// Login
try {
  await api.auth.login('admin@example.com', 'admin123');
  // Token is automatically stored and used for subsequent requests
} catch (error) {
  console.error('Login failed:', error);
}

// Logout
await api.auth.logout();
```

### Users

```javascript
// Get all users
const users = await api.users.getAll();

// Create user
await api.users.create({
  name: 'John Doe',
  handle: '@john',
  email: 'john@example.com',
  password: 'password123',
  role: 'user'
});

// Update user
await api.users.update(userId, {
  name: 'John Updated',
  role: 'moderator'
});

// Delete user
await api.users.delete(userId);

// Suspend user
await api.users.suspend(userId);
```

### Chat

```javascript
// Get all threads
const threads = await api.chat.getThreads();

// Create AI thread
const thread = await api.chat.createThread({
  type: 'ai',
  name: 'AI Assistant',
  avatar: 'bot'
});

// Send message (gets AI response automatically)
const response = await api.chat.sendMessage(threadId, 'Hello AI!');
```

### Connections

```javascript
// Get all connections
const connections = await api.connections.getAll();

// Configure OpenAI
await api.connections.updateOpenAI({
  enabled: true,
  apiKey: 'sk-...',
  model: 'gpt-4o-mini'
});

// Test OpenAI connection
const result = await api.connections.testOpenAI();
console.log(result.message); // "OpenAI connection successful"

// Configure Ollama
await api.connections.updateOllama({
  enabled: true,
  endpoint: 'http://localhost:11434',
  model: 'llama2'
});

// Test Ollama
const ollamaResult = await api.connections.testOllama();
```

### Cloud Storage

```javascript
// Get storage config
const config = await api.storage.getConfig();

// List files
const files = await api.storage.listFiles('/documents');

// Upload file
const fileInput = document.querySelector('input[type="file"]');
const file = fileInput.files[0];
await api.storage.uploadFile(file, '/uploads');

// Delete file
await api.storage.deleteFile(fileId);
```

### Settings

```javascript
// Get settings
const settings = await api.settings.get();

// Update settings
await api.settings.update({
  allowRegistration: false,
  aiRateLimit: 200,
  storagePerUser: 100
});

// Send notification
await api.settings.sendNotification(
  'Server maintenance in 10 minutes',
  'all'  // or 'admins'
);
```

### System

```javascript
// Get system health
const health = await api.system.getHealth();
console.log(health.cpu, health.memory, health.disk);

// Get detailed metrics
const metrics = await api.system.getMetrics();

// Create backup
await api.system.backup();

// Get logs
const logs = await api.system.getLogs(50);
```

## 🔄 WebSocket Integration

```javascript
import { WebSocketManager } from './api/apiClient';

const wsManager = new WebSocketManager();

// Connect
wsManager.connect((data) => {
  const { type, data: payload } = data;
  
  switch (type) {
    case 'new_message':
      console.log('New message:', payload);
      break;
    case 'user_status_changed':
      console.log('User status changed:', payload);
      break;
    case 'notification':
      console.log('Notification:', payload);
      break;
  }
});

// Send message
wsManager.send('message', {
  threadId: 1,
  text: 'Hello!'
});

// Disconnect
wsManager.disconnect();
```

## ✅ Integration Checklist

### Backend

- [ ] Backend running on port 8000
- [ ] Database initialized with `python init_db.py`
- [ ] Can access <http://localhost:8000/docs>
- [ ] Admin user created (<admin@example.com> / admin123)
- [ ] CORS configured for frontend URL

### Frontend

- [ ] Frontend running on port 3000 (or your port)
- [ ] `.env` file configured with API URLs
- [ ] `apiClient.js` imported correctly
- [ ] Can login with admin credentials
- [ ] API calls working (check browser Network tab)

## 🐛 Troubleshooting

### CORS Errors

```python
# In backend main.py, ensure CORS origins include your frontend URL:
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Add your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 401 Unauthorized

- Token might be expired (default 7 days)
- Login again to get new token
- Check browser console for token issues

### Connection Refused

- Ensure backend is running on port 8000
- Check firewall settings
- Verify `REACT_APP_API_URL` in `.env`

### WebSocket Not Connecting

- Ensure backend WebSocket endpoint is running
- Check browser console for WebSocket errors
- Verify token is being sent: `ws://localhost:8000/ws?token=YOUR_TOKEN`

## 🚀 Production Deployment

### Backend

```bash
# Use production WSGI server
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000

# Or with uvicorn
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

### Frontend

```bash
# Build for production
npm run build

# Serve with nginx, Apache, or static hosting
```

### Environment Variables

**Backend `.env` (production):**

```env
DATABASE_URL=postgresql://user:pass@host/db
SECRET_KEY=<random-64-char-string>
OPENAI_API_KEY=sk-...
AWS_ACCESS_KEY_ID=...
CORS_ORIGINS=https://yourdomain.com
```

**Frontend `.env.production`:**

```env
REACT_APP_API_URL=https://api.yourdomain.com/api
REACT_APP_WS_URL=wss://api.yourdomain.com/ws
```

## 📊 Testing Integration

### Quick Test Script

```javascript
// test-api.js
import api from './api/apiClient';

async function testAPI() {
  try {
    // Login
    console.log('Logging in...');
    await api.auth.login('admin@example.com', 'admin123');
    console.log('✅ Login successful');
    
    // Get users
    console.log('Fetching users...');
    const users = await api.users.getAll();
    console.log('✅ Users:', users.length);
    
    // Get system health
    console.log('Checking system health...');
    const health = await api.system.getHealth();
    console.log('✅ Health:', health);
    
    console.log('All tests passed! 🎉');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testAPI();
```

## 🎯 Next Steps

1. **Test the connection** - Login and verify data loads
2. **Configure AI** - Set up OpenAI or Ollama for chat
3. **Setup storage** - Configure S3/GCS/Azure if needed
4. **Customize UI** - Modify frontend to match your brand
5. **Add features** - Extend API and UI as needed

## 📚 Resources

- **Backend API Docs**: <http://localhost:8000/docs>
- **Frontend**: <http://localhost:3000>
- **WebSocket**: ws://localhost:8000/ws

---

**Your admin panel is now fully connected!** 🚀

Test with: `admin@example.com` / `admin123`
