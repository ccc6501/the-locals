# FastAPI Backend for Admin Panel

Complete production-ready FastAPI backend server with OpenAI, Ollama, Tailscale, and Cloud Storage integration.

## 🚀 Features

### Authentication & Authorization

- **JWT-based authentication** with bcrypt password hashing
- **Role-based access control** (Admin, Moderator, User)
- Secure token management with expiration
- User registration and login endpoints

### User Management

- Full CRUD operations for users
- User status management (Online, Offline, Suspended)
- Role assignment and permissions
- Usage tracking (AI calls, storage, devices)

### Chat System with AI Integration

- Multi-threaded conversations (AI, Group, DM)
- **OpenAI integration** (GPT-4, GPT-4o-mini, etc.)
- **Ollama integration** for local AI models
- Real-time messaging via WebSockets
- Message history and thread management

### Invite System

- Generate unique invite codes
- Track usage and limits
- Revoke and manage invites
- Auto-expiration support

### API Connections

- **Tailscale VPN** configuration and testing
- **OpenAI** API key management and testing
- **Ollama** endpoint configuration and testing
- Connection status monitoring

### Cloud Storage

- **AWS S3** support
- **Google Cloud Storage** support
- **Azure Blob Storage** support
- File upload, download, and deletion
- File browsing and navigation
- Storage quota tracking per user

### System Management

- **Real-time system monitoring** (CPU, Memory, Disk)
- System health metrics
- Database backup functionality
- System logs tracking
- Service restart capabilities

### WebSocket Support

- Real-time chat updates
- User status broadcasts
- System notifications
- Live connection management

## 📁 Project Structure

```
fastapi-backend/
├── main.py                 # FastAPI application entry point
├── database.py             # Database configuration
├── models.py               # SQLAlchemy models
├── schemas.py              # Pydantic schemas
├── auth_utils.py           # Authentication utilities
├── websocket_manager.py    # WebSocket connection manager
├── requirements.txt        # Python dependencies
├── .env.example           # Environment variables template
├── README.md              # This file
└── routers/               # API route modules
    ├── auth.py            # Authentication routes
    ├── users.py           # User management routes
    ├── chat.py            # Chat and AI routes
    ├── invites.py         # Invite system routes
    ├── connections.py     # API connections routes
    ├── storage.py         # Cloud storage routes
    ├── settings.py        # Settings routes
    └── system.py          # System monitoring routes
```

## 🛠️ Installation

### Prerequisites

- Python 3.9 or higher
- pip or poetry
- SQLite (default) or PostgreSQL

### 1. Clone or Navigate to Directory

```bash
cd fastapi-backend
```

### 2. Create Virtual Environment

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# Linux/Mac
python3 -m venv venv
source venv/bin/activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure Environment Variables

```bash
# Copy example environment file
copy .env.example .env  # Windows
cp .env.example .env    # Linux/Mac

# Edit .env and add your credentials
```

**Required environment variables:**

```env
SECRET_KEY=your-secret-key-here-change-in-production
OPENAI_API_KEY=sk-your-openai-api-key
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
```

### 5. Initialize Database

The database will be created automatically on first run with SQLite. For PostgreSQL:

```bash
# Update DATABASE_URL in .env
DATABASE_URL=postgresql://user:password@localhost/admin_panel

# Run the application (tables will be created automatically)
```

### 6. Run the Server

```bash
# Development mode (with auto-reload)
python main.py

# Or with uvicorn directly
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Server will start at: **<http://localhost:8000>**

API Documentation: **<http://localhost:8000/docs>**

## 📚 API Endpoints

### Authentication

```
POST   /api/auth/login       # User login
POST   /api/auth/logout      # User logout
GET    /api/auth/profile     # Get current user profile
POST   /api/auth/register    # Register new user
```

### Users

```
GET    /api/users            # List all users
GET    /api/users/{id}       # Get user by ID
POST   /api/users            # Create user (admin)
PUT    /api/users/{id}       # Update user (admin)
DELETE /api/users/{id}       # Delete user (admin)
PATCH  /api/users/{id}/suspend   # Suspend user (admin)
PATCH  /api/users/{id}/activate  # Activate user (admin)
```

### Chat

```
GET    /api/chat/threads                  # List all threads
POST   /api/chat/threads                  # Create thread
GET    /api/chat/threads/{id}/messages    # Get messages
POST   /api/chat/threads/{id}/messages    # Send message
DELETE /api/chat/threads/{id}             # Delete thread
```

### Invites

```
GET    /api/invites          # List all invites
POST   /api/invites          # Create invite (admin)
PATCH  /api/invites/{id}/revoke  # Revoke invite (admin)
DELETE /api/invites/{id}     # Delete invite (admin)
```

### Connections

```
GET    /api/connections              # Get all connections
PUT    /api/connections/tailscale    # Update Tailscale config
POST   /api/connections/tailscale/test  # Test Tailscale
PUT    /api/connections/openai       # Update OpenAI config
POST   /api/connections/openai/test  # Test OpenAI
PUT    /api/connections/ollama       # Update Ollama config
POST   /api/connections/ollama/test  # Test Ollama
```

### Cloud Storage

```
GET    /api/storage/config           # Get storage config
PUT    /api/storage/config           # Update storage config
GET    /api/storage/files?path=/     # List files
POST   /api/storage/upload           # Upload file
GET    /api/storage/download/{id}    # Download file
DELETE /api/storage/files/{id}       # Delete file
```

### Settings

```
GET    /api/settings                # Get settings
PUT    /api/settings                # Update settings (admin)
POST   /api/settings/notifications/send  # Send notification (admin)
```

### System

```
GET    /api/system/health           # Get system health metrics
GET    /api/system/logs             # Get system logs (admin)
POST   /api/system/restart          # Restart services (admin)
POST   /api/system/backup           # Create backup (admin)
GET    /api/system/metrics          # Get detailed metrics (admin)
```

### WebSocket

```
WS     /ws?token={jwt_token}        # WebSocket connection
```

## 🔐 Authentication

All protected endpoints require a Bearer token:

```javascript
// 1. Login to get token
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password"
}

// Response:
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer"
}

// 2. Use token in subsequent requests
Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGc...
```

## 💾 Database Schema

### Users

- id, name, handle, email, hashed_password
- role (admin/moderator/user)
- status (online/offline/suspended)
- devices, ai_usage, storage_used
- created_at, updated_at

### Threads

- id, type (ai/group/dm), name, avatar
- user_id, created_at, updated_at

### Messages

- id, thread_id, user_id, sender, text
- timestamp

### Invites

- id, code, uses, max_uses, status
- created_at, created_by

### Connections

- id, service, enabled, config (JSON), status

### Settings

- id, key, value

## 🤖 AI Integration

### OpenAI Setup

1. Get API key from <https://platform.openai.com/>
2. Add to `.env`: `OPENAI_API_KEY=sk-...`
3. Configure in UI: Connections → OpenAI
4. Test connection

### Ollama Setup

1. Install Ollama: <https://ollama.ai/>
2. Pull a model: `ollama pull llama2`
3. Configure endpoint in UI (default: <http://localhost:11434>)
4. Test connection

## ☁️ Cloud Storage Setup

### AWS S3

```env
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_REGION=us-east-1
AWS_BUCKET_NAME=your-bucket
```

### Google Cloud Storage

```env
GCS_BUCKET_NAME=your-bucket
GCS_PROJECT_ID=your-project
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

### Azure Blob Storage

```env
AZURE_STORAGE_CONNECTION_STRING=your-connection-string
AZURE_CONTAINER_NAME=your-container
```

## 🔌 WebSocket Usage

```javascript
// Connect to WebSocket
const ws = new WebSocket('ws://localhost:8000/ws?token=YOUR_JWT_TOKEN');

// Listen for messages
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};

// Send message
ws.send(JSON.stringify({
  type: 'message',
  data: { threadId: 1, message: 'Hello!' }
}));
```

## 🧪 Testing

### Using API Documentation

Visit <http://localhost:8000/docs> for interactive API testing

### Using curl

```bash
# Login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}'

# Get users (with token)
curl -X GET http://localhost:8000/api/users \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Create Admin User

```bash
# First, register a user via API or run this Python script:
python -c "
from database import SessionLocal
from models import User
from auth_utils import get_password_hash

db = SessionLocal()
admin = User(
    name='Admin',
    handle='@admin',
    email='admin@example.com',
    hashed_password=get_password_hash('admin123'),
    role='admin',
    status='offline'
)
db.add(admin)
db.commit()
print('Admin user created!')
"
```

## 📊 System Monitoring

The system tracks:

- CPU usage percentage
- Memory usage percentage
- Disk usage percentage
- System uptime
- Database size
- Network connectivity
- Service health status

Access via: `GET /api/system/health`

## 🔒 Security Best Practices

1. **Change SECRET_KEY** in production
2. **Use HTTPS** in production
3. **Store sensitive data** in environment variables, not code
4. **Enable CORS** only for trusted domains
5. **Implement rate limiting** for API endpoints
6. **Regular backups** of database
7. **Monitor system logs** for suspicious activity

## 🚀 Production Deployment

### Using Gunicorn

```bash
pip install gunicorn

gunicorn main:app \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000
```

### Using Docker

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Using systemd

```ini
[Unit]
Description=Admin Panel API
After=network.target

[Service]
User=www-data
WorkingDirectory=/path/to/fastapi-backend
Environment="PATH=/path/to/venv/bin"
ExecStart=/path/to/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000

[Install]
WantedBy=multi-user.target
```

## 📝 Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | Database connection string | No (defaults to SQLite) |
| `SECRET_KEY` | JWT secret key | Yes |
| `OPENAI_API_KEY` | OpenAI API key | For AI features |
| `OLLAMA_ENDPOINT` | Ollama server URL | For Ollama AI |
| `AWS_ACCESS_KEY_ID` | AWS access key | For S3 storage |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | For S3 storage |
| `TAILSCALE_AUTH_KEY` | Tailscale auth key | For VPN features |

## 🤝 Frontend Integration

Update your React frontend's API configuration:

```javascript
// In your React app
const API_BASE_URL = 'http://localhost:8000/api';
const WS_URL = 'ws://localhost:8000/ws';
```

## 📖 Additional Documentation

- FastAPI Docs: <https://fastapi.tiangolo.com/>
- SQLAlchemy: <https://www.sqlalchemy.org/>
- OpenAI API: <https://platform.openai.com/docs>
- Ollama: <https://ollama.ai/>

## 🐛 Troubleshooting

### Import Errors

```bash
# Reinstall dependencies
pip install -r requirements.txt --force-reinstall
```

### Database Errors

```bash
# Delete and recreate database
rm admin_panel.db
python main.py  # Will recreate tables
```

### Port Already in Use

```bash
# Change port in main.py or use:
uvicorn main:app --port 8001
```

## 📄 License

This backend server is provided as-is for the Admin Panel project.

## 🎉 Ready to Go

Your FastAPI backend is now ready to serve your admin panel frontend!

1. ✅ Authentication system
2. ✅ User management
3. ✅ AI chat integration (OpenAI + Ollama)
4. ✅ Cloud storage (S3/GCS/Azure)
5. ✅ Real-time WebSockets
6. ✅ System monitoring
7. ✅ Complete API documentation

Visit <http://localhost:8000/docs> to explore the API! 🚀
