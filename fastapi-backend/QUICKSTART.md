# Quick Start Guide - FastAPI Backend

## 🚀 Quick Start (3 Steps)

### Step 1: Install Dependencies

```powershell
# Create virtual environment
python -m venv venv

# Activate virtual environment
.\venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### Step 2: Setup Environment

```powershell
# Copy example environment file
copy .env.example .env

# Edit .env and add your API keys (optional for basic testing)
notepad .env
```

**Minimum required in `.env`:**

```env
SECRET_KEY=change-this-to-a-random-secret-key-in-production
```

### Step 3: Initialize & Run

```powershell
# Initialize database with sample data
python init_db.py

# Run the server
python main.py
```

**Server will start at:**

- API: <http://localhost:8000>
- Interactive Docs: <http://localhost:8000/docs>
- Alternative Docs: <http://localhost:8000/redoc>

## 🔑 Default Login

```
Email: admin@example.com
Password: admin123
```

## ✅ Quick Test

1. Visit <http://localhost:8000/docs>
2. Click "Authorize" button
3. Login using POST /api/auth/login
4. Copy the access_token from response
5. Click "Authorize" again and paste token as: `Bearer YOUR_TOKEN`
6. Try any endpoint!

## 🧪 Testing AI Features

### Test OpenAI (if you have API key)

1. Add to `.env`:

   ```env
   OPENAI_API_KEY=sk-your-key-here
   ```

2. In the app:
   - Go to Connections tab
   - Enable OpenAI
   - Add your API key
   - Click "Test Connection"

3. Create AI chat thread and send messages!

### Test Ollama (local AI)

1. Install Ollama: <https://ollama.ai/download>
2. Pull a model: `ollama pull llama2`
3. In the app:
   - Go to Connections tab
   - Enable Ollama
   - Endpoint: `http://localhost:11434`
   - Model: `llama2`
   - Click "Test Connection"

4. Create AI chat thread and chat locally!

## ☁️ Testing Cloud Storage

### AWS S3

1. Add to `.env`:

   ```env
   AWS_ACCESS_KEY_ID=your-key
   AWS_SECRET_ACCESS_KEY=your-secret
   AWS_REGION=us-east-1
   AWS_BUCKET_NAME=your-bucket
   ```

2. Configure in Cloud Storage tab
3. Upload/download files

## 🌐 Connect Frontend

Update your React frontend configuration:

```javascript
// frontend/.env or config
REACT_APP_API_URL=http://localhost:8000/api
REACT_APP_WS_URL=ws://localhost:8000/ws
```

## 📋 Common Commands

```powershell
# Activate virtual environment
.\venv\Scripts\activate

# Run server
python main.py

# Run with auto-reload
uvicorn main:app --reload

# Initialize database
python init_db.py

# Create backup
# (Use POST /api/system/backup endpoint)

# View logs
# Check console output or use GET /api/system/logs
```

## 🐛 Troubleshooting

### "Module not found" errors

```powershell
pip install -r requirements.txt --force-reinstall
```

### "Database locked" error

```powershell
# Stop the server and delete database
del admin_panel.db
python init_db.py
```

### Port 8000 already in use

```powershell
# Change port
uvicorn main:app --port 8001
```

### Cannot connect to OpenAI

- Check API key is correct
- Check internet connection
- Verify billing on OpenAI account

### Cannot connect to Ollama

```powershell
# Check if Ollama is running
ollama list

# Start Ollama (if needed)
ollama serve
```

## 📚 Next Steps

1. ✅ Explore API docs: <http://localhost:8000/docs>
2. ✅ Connect your frontend
3. ✅ Configure AI services (OpenAI or Ollama)
4. ✅ Setup cloud storage (optional)
5. ✅ Configure Tailscale (optional)
6. ✅ Customize settings in the UI

## 🔐 Production Checklist

Before deploying to production:

- [ ] Change `SECRET_KEY` to a random string
- [ ] Use PostgreSQL instead of SQLite
- [ ] Enable HTTPS
- [ ] Set proper CORS origins
- [ ] Use environment variables for all secrets
- [ ] Enable rate limiting
- [ ] Setup automated backups
- [ ] Configure logging
- [ ] Use a process manager (systemd, supervisor)
- [ ] Setup monitoring

## 💡 Tips

- Use the interactive API docs to test endpoints
- Check console logs for debugging
- Enable DEBUG_MODE in settings for verbose logging
- Create backups regularly via /api/system/backup
- Monitor system health via /api/system/health

---

**Need help?** Check README.md for detailed documentation!
