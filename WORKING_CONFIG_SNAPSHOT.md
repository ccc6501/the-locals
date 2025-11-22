# ChatOps Working Configuration Snapshot

**Date**: November 22, 2025  
**Status**: ✅ Fully Operational

## System Architecture

### Backend (FastAPI)

- **File**: `fastapi-backend/main.py`
- **Port**: 8000
- **Host**: 0.0.0.0 (all interfaces)
- **Auto-restart**: Yes (via uvicorn reload)
- **Database**: SQLite (`admin_panel.db`)
- **In-memory**: Group chat messages (ROOMS, MESSAGES in `chat_routes.py`)

### Frontend (React + Vite)

- **File**: `admin-panel-frontend/src/ChatOpsConsole.jsx`
- **Port**: 5173
- **Host**: 0.0.0.0 (all interfaces)
- **Build**: Vite 5.4.21
- **Styling**: Tailwind CSS

### Tailscale Configuration

- **Device**: home-hub (DESKTOP-U3ILOR2)
- **Tailscale IP**: 100.88.23.90
- **DNS Name**: home-hub.taimen-godzilla.ts.net
- **Tailnet**: taimen-godzilla.ts.net
- **Funnel**: <https://home-hub.taimen-godzilla.ts.net> → port 8000
- **Connected Devices**:
  - chance (iPhone): 100.112.252.35
  - ipad: 100.126.159.45
  - ipad-air-gen-4: 100.116.248.38
  - home-hub-1 (Linux): 100.96.169.36

## API Endpoints

### Group Chat (Working)

```
GET  /chat/rooms
GET  /chat/rooms/{room_id}/messages?since_id={id}&limit={num}
POST /chat/rooms/{room_id}/messages
```

### AI Chat (Working)

```
POST /api/chat/chat
```

### System

```
GET  /api/health
GET  /api/system/tailscale/summary
```

### Connections

```
GET  /api/connections
POST /api/connections/tailscale/test
```

## Current Frontend Configuration

### API Base URL Detection

```javascript
const getApiBase = () => {
    const hostname = window.location.hostname;
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
        return `http://${hostname}:8000`;
    }
    return "http://localhost:8000";
};
```

### Current Features

- ✅ Group chat with rooms
- ✅ Real-time polling (3-second interval)
- ✅ Color-coded users
- ✅ Active users display
- ✅ AI provider status banner
- ✅ OpenAI and Ollama support
- ✅ Settings panel (collapsible)
- ✅ Bug log panel
- ✅ Tailnet status chip

### Current Defaults

- **Provider**: OpenAI
- **OpenAI Model**: gpt-4o-mini
- **Ollama URL**: <http://localhost:11434>
- **Ollama Model**: gemma:2b
- **Temperature**: 0.70
- **Polling**: 3000ms

## Data Models

### ChatRoom

```python
{
    "id": str,
    "name": str,
    "description": str
}
```

### ChatMessage

```python
{
    "id": int,
    "room_id": str,
    "user_id": str,
    "user_name": str,
    "role": "user" | "assistant",
    "content": str,
    "created_at": datetime,
    "model": str,
    "lazlo_mode": bool
}
```

## Files State

### Core Files (DO NOT MODIFY - WORKING)

1. `fastapi-backend/main.py` - Backend entry point
2. `fastapi-backend/chat_routes.py` - Group chat endpoints
3. `fastapi-backend/routers/chat.py` - AI chat endpoint
4. `fastapi-backend/routers/system.py` - Tailscale status
5. `admin-panel-frontend/src/ChatOpsConsole.jsx` - Main UI
6. `admin-panel-frontend/src/ChatRoomList.jsx` - Room selector
7. `start_all.ps1` - Service launcher

### Configuration Files

1. `admin-panel-frontend/package.json` - Scripts: "original" (port 5173), "dev" (port 5180)
2. `fastapi-backend/requirements.txt` - Python dependencies

## Access URLs

### Local

- Frontend: <http://localhost:5173>
- Backend: <http://localhost:8000>
- Docs: <http://localhost:8000/docs>

### Tailscale (iPhone/iPad)

- Frontend: <http://100.88.23.90:5173>
- Frontend: <http://home-hub.taimen-godzilla.ts.net:5173>
- Backend: <http://100.88.23.90:8000>
- Backend: <http://home-hub.taimen-godzilla.ts.net:8000>

### Public (Funnel)

- Backend: <https://home-hub.taimen-godzilla.ts.net>

## Known Working Test Commands

```powershell
# Test backend health
curl.exe http://localhost:8000/api/health

# Test chat rooms
curl.exe http://localhost:8000/chat/rooms

# Test chat messages
curl.exe http://localhost:8000/chat/rooms/general/messages

# Test via Tailscale
curl.exe http://100.88.23.90:8000/chat/rooms

# Check services running
netstat -ano | findstr "8000 5173" | findstr LISTENING

# Restart services
.\start_all.ps1
```

## Issues to Fix (Next Phase)

1. **Chat scroll**: Does not anchor to bottom, grows forever
2. **Mobile keyboard**: Input box doesn't adjust with keyboard
3. **Ollama default**: Should be glm4:latest instead of gemma:2b
4. **Header space**: Too much wasted space
5. **Rooms concept**: Unclear purpose, may need simplification

## Dependencies

### Backend

- fastapi
- uvicorn
- sqlalchemy
- python-multipart
- python-jose
- passlib
- bcrypt
- openai
- httpx
- psutil
- python-dotenv

### Frontend

- react: ^18.3.1
- react-dom: ^18.3.1
- lucide-react: ^0.263.1
- vite: ^5.4.21
- tailwindcss: ^3.4.17
- postcss: ^8.4.49
- autoprefixer: ^10.4.20

## Environment Variables

### Backend (.env)

- OPENAI_API_KEY (optional - user provides via UI)
- DATABASE_URL (default: sqlite:///./admin_panel.db)

### Frontend

- No environment variables needed (auto-detects API base)

---
**This snapshot represents a fully working, tested configuration.**  
**All features verified on localhost and via Tailscale remote access.**
