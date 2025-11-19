# 🚀 Complete Admin Panel - FastAPI Backend

## 📦 What's Included

A **production-ready FastAPI backend** with complete integration for:

✅ **Authentication & Authorization** (JWT with role-based access)  
✅ **User Management** (Full CRUD with suspend/activate)  
✅ **AI Chat System** (OpenAI + Ollama support)  
✅ **Invite System** (Generate and manage invite codes)  
✅ **API Connections** (Tailscale, OpenAI, Ollama)  
✅ **Cloud Storage** (AWS S3, Google Cloud, Azure)  
✅ **System Monitoring** (Real-time CPU, Memory, Disk metrics)  
✅ **WebSocket Support** (Real-time updates and chat)  
✅ **Settings Management** (Configurable system settings)  
✅ **Automatic Backups** (Database backup functionality)

## 🗂️ Project Structure

```
fastapi-backend/
├── main.py                  # FastAPI app entry point
├── database.py              # Database configuration
├── models.py                # SQLAlchemy models
├── schemas.py               # Pydantic request/response schemas
├── auth_utils.py            # JWT authentication utilities
├── websocket_manager.py     # WebSocket connection manager
├── init_db.py              # Database initialization script
├── requirements.txt         # Python dependencies
├── .env.example            # Environment variables template
├── .gitignore              # Git ignore rules
├── README.md               # Full documentation
├── QUICKSTART.md           # Quick start guide
├── setup.ps1               # Windows setup script
└── routers/                # API route modules
    ├── auth.py             # Authentication endpoints
    ├── users.py            # User management
    ├── chat.py             # Chat and AI integration
    ├── invites.py          # Invite system
    ├── connections.py      # API connections (Tailscale, OpenAI, Ollama)
    ├── storage.py          # Cloud storage (S3, GCS, Azure)
    ├── settings.py         # Settings management
    └── system.py           # System monitoring and health
```

## ⚡ Quick Start

### Option 1: Automated Setup (Windows)

```powershell
# Run the setup script
.\setup.ps1
```

This will:

- Create virtual environment
- Install all dependencies
- Generate secure SECRET_KEY
- Initialize database with sample data
- Optionally start the server

### Option 2: Manual Setup

```powershell
# 1. Create and activate virtual environment
python -m venv venv
.\venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Setup environment
copy .env.example .env
# Edit .env and add your SECRET_KEY

# 4. Initialize database
python init_db.py

# 5. Run server
python main.py
```

## 🌐 Access Points

- **API Server**: <http://localhost:8000>
- **Interactive Docs**: <http://localhost:8000/docs> (Swagger UI)
- **Alternative Docs**: <http://localhost:8000/redoc> (ReDoc)
- **WebSocket**: ws://localhost:8000/ws

## 🔑 Default Credentials

```
Email: admin@example.com
Password: admin123
```

**⚠️ Change these in production!**

## 📡 API Endpoints Summary

### Authentication

- `POST /api/auth/login` - Login and get JWT token
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/profile` - Get current user profile
- `POST /api/auth/register` - Register new user

### Users (Admin)

- `GET /api/users` - List all users
- `POST /api/users` - Create user
- `PUT /api/users/{id}` - Update user
- `DELETE /api/users/{id}` - Delete user
- `PATCH /api/users/{id}/suspend` - Suspend user
- `PATCH /api/users/{id}/activate` - Activate user

### Chat

- `GET /api/chat/threads` - List threads
- `POST /api/chat/threads` - Create thread
- `POST /api/chat/threads/{id}/messages` - Send message (with AI response)
- `DELETE /api/chat/threads/{id}` - Delete thread

### Invites (Admin)

- `GET /api/invites` - List invites
- `POST /api/invites` - Create invite
- `PATCH /api/invites/{id}/revoke` - Revoke invite

### Connections (Admin)

- `GET /api/connections` - Get all connections config
- `PUT /api/connections/openai` - Configure OpenAI
- `POST /api/connections/openai/test` - Test OpenAI
- `PUT /api/connections/ollama` - Configure Ollama
- `POST /api/connections/ollama/test` - Test Ollama
- `PUT /api/connections/tailscale` - Configure Tailscale

### Cloud Storage

- `GET /api/storage/config` - Get storage config
- `GET /api/storage/files` - List files
- `POST /api/storage/upload` - Upload file
- `DELETE /api/storage/files/{id}` - Delete file

### System (Admin)

- `GET /api/system/health` - System health metrics
- `GET /api/system/metrics` - Detailed metrics
- `POST /api/system/backup` - Create backup
- `GET /api/system/logs` - Get logs

## 🤖 AI Integration

### OpenAI Setup

1. Get API key from <https://platform.openai.com/>
2. Add to `.env`:

   ```env
   OPENAI_API_KEY=sk-proj-...
   ```

3. Configure in app (Connections tab)
4. Test connection

### Ollama Setup (Local AI)

1. Install: <https://ollama.ai/>
2. Pull model: `ollama pull llama2`
3. Configure endpoint: `http://localhost:11434`
4. Test connection

## ☁️ Cloud Storage Setup

### AWS S3

```env
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_BUCKET_NAME=your-bucket
AWS_REGION=us-east-1
```

### Google Cloud Storage

```env
GCS_BUCKET_NAME=your-bucket
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

### Azure Blob Storage

```env
AZURE_STORAGE_CONNECTION_STRING=your-connection-string
AZURE_CONTAINER_NAME=your-container
```

## 🔌 Frontend Integration

Update your React frontend:

```javascript
// .env or config
REACT_APP_API_URL=http://localhost:8000/api
REACT_APP_WS_URL=ws://localhost:8000/ws
```

## 📋 Environment Variables

Required:

- `SECRET_KEY` - JWT secret (auto-generated by setup.ps1)

Optional:

- `OPENAI_API_KEY` - For OpenAI integration
- `AWS_ACCESS_KEY_ID` - For S3 storage
- `AWS_SECRET_ACCESS_KEY` - For S3 storage
- `TAILSCALE_AUTH_KEY` - For Tailscale VPN

See `.env.example` for complete list.

## 🧪 Testing the API

### Using Swagger UI

1. Go to <http://localhost:8000/docs>
2. Click "Authorize" button
3. Login via POST /api/auth/login
4. Copy `access_token` from response
5. Enter: `Bearer YOUR_TOKEN`
6. Try any endpoint!

### Using curl

```bash
# Login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}'

# Get users (with token)
curl http://localhost:8000/api/users \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🔒 Security Features

- **Bcrypt password hashing**
- **JWT token authentication**
- **Role-based access control** (Admin, Moderator, User)
- **Secure password storage** (never stored in plain text)
- **Token expiration** (7 days default)
- **CORS protection** (configurable origins)
- **Input validation** (Pydantic schemas)

## 🛠️ Database

### Default: SQLite

- File: `admin_panel.db`
- Perfect for development and small deployments
- No setup required

### Production: PostgreSQL (Recommended)

```env
DATABASE_URL=postgresql://user:password@localhost/admin_panel
```

All migrations happen automatically via SQLAlchemy.

## 📊 System Monitoring

Real-time metrics available:

- CPU usage (%)
- Memory usage (%)
- Disk usage (%)
- System uptime
- Database size
- Network status
- Active connections

Access via: `GET /api/system/health`

## 🔄 WebSocket Events

Connect: `ws://localhost:8000/ws?token=JWT_TOKEN`

Events:

- `new_message` - New chat message
- `user_status_changed` - User online/offline
- `notification` - System notification
- `user_disconnected` - User disconnected

## 📦 Dependencies

Core:

- FastAPI 0.109.0
- Uvicorn (ASGI server)
- SQLAlchemy (ORM)
- Pydantic (validation)

Auth:

- python-jose (JWT)
- passlib (password hashing)

AI:

- openai (OpenAI API)
- httpx (Ollama API)

Cloud:

- boto3 (AWS S3)
- google-cloud-storage
- azure-storage-blob

Monitoring:

- psutil (system metrics)

## 🚀 Production Deployment

### Using Gunicorn

```bash
pip install gunicorn
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
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

[Service]
WorkingDirectory=/path/to/fastapi-backend
ExecStart=/path/to/venv/bin/uvicorn main:app --host 0.0.0.0

[Install]
WantedBy=multi-user.target
```

## ✅ Production Checklist

- [ ] Change SECRET_KEY to random value
- [ ] Use PostgreSQL instead of SQLite
- [ ] Enable HTTPS/TLS
- [ ] Configure CORS for production domain
- [ ] Use environment variables for all secrets
- [ ] Enable rate limiting
- [ ] Setup automated backups
- [ ] Configure logging
- [ ] Use process manager (systemd/supervisor)
- [ ] Setup monitoring and alerts

## 📚 Documentation

- `README.md` - Full documentation
- `QUICKSTART.md` - Quick start guide
- Swagger UI: <http://localhost:8000/docs>
- ReDoc: <http://localhost:8000/redoc>

## 🐛 Troubleshooting

See QUICKSTART.md for common issues and solutions.

## 📄 License

This backend is provided as-is for the Admin Panel project.

---

## 🎉 You're All Set

Your FastAPI backend is ready to power your admin panel frontend!

**Start the server:**

```powershell
python main.py
```

**Explore the API:**
<http://localhost:8000/docs>

**Need help?** Check README.md or QUICKSTART.md

---

Made with ❤️ using FastAPI
