# Authentication Setup Complete

## Database Initialized
- ✅ Database: `admin_panel.db`
- ✅ 2 Users: Chance (owner), The Local (AI bot)
- ✅ 4 Rooms: #general, #network, #storage, #admin

## Login Credentials

**Email:** `admin@thelocal.build`  
**Password:** `admin123`

## Auth Token (30-day expiry)

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbkB0aGVsb2NhbC5idWlsZCIsImV4cCI6MTc2Njk1MDgxOH0.AQHcwq-u6UUBkZnKD_u_4YmfaJeNO8LOC32MLkdHeo0
```

## Frontend Setup

### Option 1: Browser Console (Quick Test)
Open browser console (F12) and run:
```javascript
localStorage.setItem('chatops_token', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbkB0aGVsb2NhbC5idWlsZCIsImV4cCI6MTc2Njk1MDgxOH0.AQHcwq-u6UUBkZnKD_u_4YmfaJeNO8LOC32MLkdHeo0');
location.reload();
```

### Option 2: Login Flow (Proper)
1. Navigate to login page (if implemented)
2. Use email: `admin@thelocal.build`
3. Use password: `admin123`

## Backend
- **Port:** 8000 (fallback: 8001, 8002)
- **Running:** `python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload`

## For Remote Users
Each remote user will need to:
1. Create account via `/api/auth/register` endpoint
2. Login via `/api/auth/login` to get their own token
3. Token stored in `localStorage` as `chatops_token`

## Permissions
- **Owner** (Chance): Full access to all rooms and admin functions
- **Admin** (AI Bot): Can manage rooms and users
- **Member**: Default role for new users
- **Child**: Restricted permissions (set via user management)
- **Guest**: Read-only access (configurable)

## Room Access
Users automatically get access to:
- System rooms (if added as members)
- Rooms they create
- Rooms they're invited to

## Next Steps
1. Refresh browser with token in localStorage
2. Rooms should now load from `/api/rooms`
3. Create new rooms via Create Room button
4. Implement login/register UI for remote users
