# Multi-User + Multi-Room Implementation Spec

## Overview

Transform **The Local** from a single-user, single-room AI assistant into a full **iMessage + Discord + Admin Console** experience for Tailnet households.

**Current State:**

- 1 user (you)
- 1 big room (main chat)
- 1 AI (The Local) with global context

**Target State:**

- Multiple users (family members, guests, bots)
- Multiple rooms (system, family, personal, DMs)
- Per-room AI personality + tools
- Role-based permissions

---

## 1. User System

### Database Schema

**New Table: `users`**

```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    handle TEXT UNIQUE NOT NULL,              -- @chance, @dad, @kiddo
    display_name TEXT NOT NULL,               -- "Chance", "Dad", "Kiddo"
    initials TEXT,                            -- "CC", "D", "K"
    avatar_url TEXT,                          -- optional profile pic
    color TEXT DEFAULT '#8b5cf6',             -- for chat bubbles
    role TEXT DEFAULT 'member',               -- owner, admin, member, child, guest
    is_bot BOOLEAN DEFAULT FALSE,             -- TRUE for "The Local" AI
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_active_at TIMESTAMP,
    preferences JSON                          -- user settings, theme, etc.
);
```

**New Table: `user_permissions`**

```sql
CREATE TABLE user_permissions (
    user_id INTEGER NOT NULL,
    permission TEXT NOT NULL,                 -- e.g., 'manage_rooms', 'restart_servers'
    FOREIGN KEY (user_id) REFERENCES users(id),
    PRIMARY KEY (user_id, permission)
);
```

**New Table: `user_devices`** (optional - device→user association)

```sql
CREATE TABLE user_devices (
    device_id TEXT NOT NULL,                  -- Tailscale device ID or hostname
    user_id INTEGER NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    last_seen_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    PRIMARY KEY (device_id, user_id)
);
```

### Permission Types

**System Permissions:**

- `manage_rooms` - create/delete/edit rooms
- `manage_users` - invite/remove users, change roles
- `restart_services` - restart backend, frontend, system services
- `modify_config` - edit config files, environment variables
- `access_storage` - browse/upload/download D:\ files
- `view_logs` - system logs, error logs
- `run_automation` - trigger scripts, scheduled tasks
- `manage_network` - Tailscale admin, device management

**Default Role Permissions:**

```json
{
  "owner": ["*"],  // all permissions
  "admin": ["manage_rooms", "view_logs", "access_storage", "run_automation"],
  "member": ["access_storage"],
  "child": [],  // chat only, no system access
  "guest": []   // read-only in allowed rooms
}
```

### API Endpoints

**New Routes: `routers/users.py`**

```python
# User management
GET    /api/users                    # List all users (admin only)
POST   /api/users                    # Create user (admin only)
GET    /api/users/me                 # Get current user
GET    /api/users/{id}               # Get user by ID
PATCH  /api/users/{id}               # Update user
DELETE /api/users/{id}               # Delete user (owner only)

# Permissions
GET    /api/users/{id}/permissions   # Get user permissions
POST   /api/users/{id}/permissions   # Add permission (admin only)
DELETE /api/users/{id}/permissions/{perm}  # Remove permission

# Presence
GET    /api/users/{id}/presence      # User online status
POST   /api/users/{id}/activity      # Update last active timestamp

# Device association
GET    /api/users/{id}/devices       # User's devices
POST   /api/users/{id}/devices       # Link device to user
```

### Frontend Changes

**New Component: `UserProfileSwitcher.jsx`**

```jsx
// Simple dropdown in header
- Shows current user avatar + name
- Click to see all users
- Switch user (store in localStorage + context)
- "Add User" option (if admin)
```

**New Component: `UserAvatar.jsx`**

```jsx
// Reusable avatar component
- Shows initials or avatar image
- Color-coded by user
- Size variants (xs, sm, md, lg)
- Online indicator (optional)
```

**Update: Message Bubbles**

```jsx
// Every message shows:
- UserAvatar
- Display name or handle
- Timestamp
- Role badge (if admin/owner)
- Bot indicator (if AI)
```

---

## 2. Room System

### Database Schema

**New Table: `rooms`**

```sql
CREATE TABLE rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,                -- 'general', 'network', 'family'
    name TEXT NOT NULL,                       -- "General", "Network Ops"
    description TEXT,
    type TEXT DEFAULT 'group',                -- system, dm, group
    icon TEXT,                                -- emoji or icon name
    color TEXT DEFAULT '#8b5cf6',
    is_system BOOLEAN DEFAULT FALSE,          -- can't be deleted
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    ai_config JSON,                           -- per-room AI settings
    FOREIGN KEY (created_by) REFERENCES users(id)
);
```

**New Table: `room_members`**

```sql
CREATE TABLE room_members (
    room_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role TEXT DEFAULT 'member',               -- owner, admin, member
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_read_at TIMESTAMP,                   -- for unread counts
    notifications TEXT DEFAULT 'all',          -- all, mentions, none
    FOREIGN KEY (room_id) REFERENCES rooms(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    PRIMARY KEY (room_id, user_id)
);
```

**Update Table: `messages`** (add room/user context)

```sql
-- Add new columns to existing messages table:
ALTER TABLE messages ADD COLUMN room_id INTEGER REFERENCES rooms(id);
ALTER TABLE messages ADD COLUMN user_id INTEGER REFERENCES users(id);

-- Or create new table if starting fresh:
CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    role TEXT NOT NULL,                       -- 'user' or 'assistant'
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSON,                            -- attachments, reactions, etc.
    FOREIGN KEY (room_id) REFERENCES rooms(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### AI Configuration per Room

**Room AI Config Schema:**

```json
{
  "assistant_name": "The Local",
  "assistant_persona": "helpful network admin",
  "model": "gpt-4o-mini",
  "temperature": 0.7,
  "safety_level": "standard",  // strict, standard, relaxed
  "allowed_tools": [
    "network_status",
    "storage_browse",
    "system_metrics"
  ],
  "disabled_tools": [
    "restart_services",
    "modify_config"
  ],
  "system_prompt_override": null,  // custom prompt for this room
  "context_sources": [
    "network_snapshot",
    "system_summary",
    "room_history"
  ]
}
```

**Example Room Configs:**

**#general (Main hangout)**

```json
{
  "assistant_name": "The Local",
  "assistant_persona": "friendly household AI assistant",
  "safety_level": "standard",
  "allowed_tools": ["network_status", "storage_browse", "system_metrics"],
  "disabled_tools": ["restart_services", "modify_config"]
}
```

**#network (Network ops)**

```json
{
  "assistant_name": "NetOps AI",
  "assistant_persona": "technical network engineer",
  "safety_level": "relaxed",
  "allowed_tools": ["*"],  // all tools
  "disabled_tools": []
}
```

**#kiddo-room (Kid-safe)**

```json
{
  "assistant_name": "Buddy",
  "assistant_persona": "friendly, patient, and kid-appropriate assistant",
  "safety_level": "strict",
  "allowed_tools": [],  // no system tools
  "disabled_tools": ["*"],
  "system_prompt_override": "You are a helpful, friendly assistant for kids. Keep answers simple, positive, and age-appropriate. Never discuss system administration or technical operations."
}
```

### API Endpoints

**New Routes: `routers/rooms.py`**

```python
# Room management
GET    /api/rooms                    # List user's accessible rooms
POST   /api/rooms                    # Create room (requires permission)
GET    /api/rooms/{id}               # Get room details
PATCH  /api/rooms/{id}               # Update room (admin/owner)
DELETE /api/rooms/{id}               # Delete room (owner only, not system rooms)

# Room membership
GET    /api/rooms/{id}/members       # List room members
POST   /api/rooms/{id}/members       # Add member (admin)
DELETE /api/rooms/{id}/members/{userId}  # Remove member
PATCH  /api/rooms/{id}/members/{userId}  # Update member role

# Room messages
GET    /api/rooms/{id}/messages      # Get room chat history
POST   /api/rooms/{id}/messages      # Send message to room
PATCH  /api/rooms/{id}/read          # Mark room as read

# Room AI config
GET    /api/rooms/{id}/ai-config     # Get room's AI settings
PATCH  /api/rooms/{id}/ai-config     # Update AI settings (admin)
```

### Frontend Changes

**New Component: `RoomList.jsx`**

```jsx
// Left sidebar (or drawer on mobile)
- List of user's rooms
- Grouped by type (System, Personal, DMs)
- Shows room icon, name, unread count
- Last message snippet
- Active room highlight
- "Create Room" button (if permitted)
```

**New Component: `RoomHeader.jsx`**

```jsx
// Top of chat area
- Room icon + name
- Room description
- Member avatars (first 3-5)
- Room settings icon (if admin)
- AI assistant indicator ("The Local" vs "NetOps AI")
```

**New Component: `CreateRoomModal.jsx`**

```jsx
// Room creation wizard
- Name, slug, icon, color
- Select members
- Choose AI personality preset
- Set permissions
```

**Update: `ChatOpsConsoleStable.jsx`**

```jsx
// Add room context
const [currentRoom, setCurrentRoom] = useState(null);
const [rooms, setRooms] = useState([]);

// Load rooms on mount
useEffect(() => {
  loadRooms();
}, []);

// Switch room
const switchRoom = (roomId) => {
  setCurrentRoom(rooms.find(r => r.id === roomId));
  loadRoomMessages(roomId);
};
```

---

## 3. Integration: Users + Rooms + AI

### Chat Flow

**Every message now has context:**

```javascript
{
  "roomId": 5,              // which room
  "userId": 2,              // which user sent it
  "content": "restart home-hub",
  "timestamp": "2025-11-28T14:30:00Z"
}
```

**Backend processing:**

```python
# In chat endpoint
async def send_message(
    room_id: int,
    message: str,
    current_user: User = Depends(get_current_user)
):
    # 1. Get room
    room = get_room(room_id)
    
    # 2. Check membership
    if not is_room_member(current_user.id, room_id):
        raise HTTPException(403, "Not a member of this room")
    
    # 3. Build AI context with room + user awareness
    context = await build_ai_context(
        room=room,
        user=current_user,
        message=message
    )
    
    # 4. Check permissions for requested action
    if requires_permission(message, room):
        if not has_permission(current_user, required_perm):
            return {
                "role": "assistant",
                "content": f"Sorry {current_user.display_name}, you don't have permission to {action}. Ask an admin."
            }
    
    # 5. Call AI with enhanced context
    response = await call_ai(
        message=message,
        context=context,
        room_config=room.ai_config,
        user=current_user
    )
    
    # 6. Save both messages to room history
    save_message(room_id, current_user.id, message, role="user")
    save_message(room_id, AI_USER_ID, response, role="assistant")
    
    return response
```

### AI Context Builder Enhancement

**Updated `_build_ai_context()`:**

```python
async def _build_ai_context(room: Room, user: User, message: str):
    context_parts = []
    
    # 1. Room context
    context_parts.append(f"ROOM: {room.name}")
    context_parts.append(f"Room Type: {room.type}")
    context_parts.append(f"AI Assistant: {room.ai_config['assistant_name']}")
    
    # 2. User context
    context_parts.append(f"USER: {user.display_name} (@{user.handle})")
    context_parts.append(f"Role: {user.role}")
    context_parts.append(f"Permissions: {', '.join(get_user_permissions(user.id))}")
    
    # 3. Room members context
    members = get_room_members(room.id)
    context_parts.append(f"Room Members: {', '.join([m.display_name for m in members])}")
    
    # 4. System context (if allowed by room config)
    if "network_snapshot" in room.ai_config['context_sources']:
        network = await get_network_snapshot()
        context_parts.append(f"NETWORK: {network['online_count']} devices online")
    
    if "system_summary" in room.ai_config['context_sources']:
        system = await get_system_summary()
        context_parts.append(f"SYSTEM: CPU {system['cpu_percent']}%, Memory {system['memory_percent']}%")
    
    # 5. Recent room history (last 5 messages)
    if "room_history" in room.ai_config['context_sources']:
        history = get_room_messages(room.id, limit=5)
        context_parts.append("RECENT MESSAGES:")
        for msg in history:
            sender = get_user(msg.user_id)
            context_parts.append(f"  {sender.display_name}: {msg.content}")
    
    return "\n".join(context_parts)
```

### System Prompt Enhancement

**Enhanced system prompt:**

```python
system_prompt = f"""You are {room.ai_config['assistant_name']}, {room.ai_config['assistant_persona']}.

You are currently in the "{room.name}" room with {len(room.members)} members.
You are talking to {user.display_name} (role: {user.role}).

PERMISSIONS AND TOOLS:
- You have access to these tools: {', '.join(room.ai_config['allowed_tools'])}
- These tools are DISABLED in this room: {', '.join(room.ai_config['disabled_tools'])}
- {user.display_name} has these permissions: {', '.join(user.permissions)}

IMPORTANT RULES:
1. If asked to perform an action requiring a disabled tool or a permission the user lacks, politely refuse and explain why.
2. Always address users by their display name.
3. Keep conversation appropriate for this room's safety level: {room.ai_config['safety_level']}.
4. Reference room history when relevant, but don't mix up conversations from other rooms.

{context}

When asked about the network, always use the real device data above. Never make up device counts or names.
"""
```

---

## 4. Default Room Setup

### System Rooms (created on first run)

**1. #general** (Main hangout)

- **Members:** All users by default
- **AI:** The Local (friendly, helpful)
- **Tools:** network_status, storage_browse, system_metrics
- **Icon:** 🏠
- **Color:** #8b5cf6 (violet)

**2. #network** (Network operations)

- **Members:** owner, admin roles only
- **AI:** NetOps AI (technical network engineer)
- **Tools:** All tools enabled
- **Icon:** 🌐
- **Color:** #3b82f6 (blue)

**3. #storage** (File management)

- **Members:** owner, admin, member roles
- **AI:** The Local (storage assistant)
- **Tools:** storage_browse, storage_upload, storage_download
- **Icon:** 💾
- **Color:** #10b981 (green)

**4. #admin** (System administration)

- **Members:** owner role only
- **AI:** AdminBot (technical, full access)
- **Tools:** All tools enabled
- **Icon:** ⚙️
- **Color:** #ef4444 (red)

---

## 5. Implementation Checklist

### Phase 1: Database & Models

- [ ] Create `users` table with schema above
- [ ] Create `user_permissions` table
- [ ] Create `rooms` table
- [ ] Create `room_members` table
- [ ] Update `messages` table with `room_id` and `user_id`
- [ ] Create SQLAlchemy models for all new tables
- [ ] Create Pydantic schemas for API requests/responses

### Phase 2: Backend API

- [ ] Implement `routers/users.py` with all user endpoints
- [ ] Implement `routers/rooms.py` with all room endpoints
- [ ] Update `routers/chat.py` to accept `room_id` and `user_id`
- [ ] Enhance `_build_ai_context()` with room + user awareness
- [ ] Update system prompts to include room/user context
- [ ] Add permission checks to all tool-using endpoints
- [ ] Create migration script to set up default users and rooms

### Phase 3: Frontend Components

- [ ] Create `UserAvatar.jsx` component
- [ ] Create `UserProfileSwitcher.jsx` component
- [ ] Create `RoomList.jsx` component
- [ ] Create `RoomHeader.jsx` component
- [ ] Create `CreateRoomModal.jsx` component
- [ ] Update message bubbles to show user avatar + name
- [ ] Add room context to `ChatOpsConsoleStable.jsx`
- [ ] Add room switching logic
- [ ] Add unread message indicators

### Phase 4: State Management

- [ ] Add `currentUser` to React context
- [ ] Add `currentRoom` to React context
- [ ] Add `rooms` array to state
- [ ] Persist current user in localStorage
- [ ] Load user on app start
- [ ] Load rooms on app start

### Phase 5: Polish & UX

- [ ] User onboarding flow (first-time setup)
- [ ] Room creation wizard
- [ ] User settings panel (change name, avatar, color)
- [ ] Room settings panel (edit AI config, members)
- [ ] Presence indicators (who's online)
- [ ] Typing indicators per room
- [ ] @mentions in messages
- [ ] Unread count badges

---

## 6. Migration Strategy

### For Existing Messages

**Option 1: Assign all to default room + owner user**

```sql
-- Create owner user
INSERT INTO users (handle, display_name, role, is_bot) 
VALUES ('@owner', 'Owner', 'owner', 0);

-- Create general room
INSERT INTO rooms (slug, name, type, is_system, created_by)
VALUES ('general', 'General', 'system', 1, 1);

-- Update existing messages
UPDATE messages 
SET room_id = 1, user_id = 1 
WHERE room_id IS NULL;
```

**Option 2: Fresh start (archive old messages)**

```sql
-- Rename old messages table
ALTER TABLE messages RENAME TO messages_archive;

-- Create new messages table with room/user columns
CREATE TABLE messages (...);
```

### First-Run Setup

**Auto-create on first backend start:**

1. Create default owner user (prompt for name/handle)
2. Create "The Local" AI bot user
3. Create 4 system rooms (#general, #network, #storage, #admin)
4. Add owner to all rooms
5. Set default room configs

---

## 7. Future Enhancements

### Nice-to-Haves (post-MVP)

- [ ] Room invites via share links
- [ ] Private DMs between users
- [ ] Message reactions (emoji)
- [ ] File attachments in messages
- [ ] Voice messages
- [ ] @mentions with notifications
- [ ] Room-specific automations (cron triggers)
- [ ] AI assistant "handoff" between rooms
- [ ] Guest access with time-limited tokens
- [ ] Audit log for admin actions
- [ ] Room templates (quick setup for common use cases)

### Advanced Features

- [ ] Voice chat integration
- [ ] Screen sharing (for admin support)
- [ ] Tailscale ACL sync (auto-create users from Tailnet)
- [ ] Multi-home-hub support (distributed family)
- [ ] Backup/restore rooms and messages
- [ ] Export room history to Markdown
- [ ] AI memory per room (long-term context)

---

## 8. Security Considerations

### Authentication

- Since this is Tailnet-bound and local, keep auth lightweight
- Options:
  - **Device trust:** auto-login based on Tailscale device ID
  - **PIN per user:** simple 4-digit PIN for profile switching
  - **Optional password:** for owner/admin roles

### Authorization

- Always check room membership before showing messages
- Always check user permissions before allowing tool use
- Log all permission-denied attempts (audit trail)

### Data Privacy

- Keep all data local (SQLite on home-hub)
- No external cloud services (unless explicitly configured)
- Room messages never leave Tailnet
- User data encrypted at rest (optional)

---

## 9. Testing Plan

### Unit Tests

- [ ] User model CRUD
- [ ] Room model CRUD
- [ ] Permission checking logic
- [ ] AI context builder with room/user params
- [ ] Message scoping by room

### Integration Tests

- [ ] Create user → create room → send message flow
- [ ] Permission denial (child user trying to restart server)
- [ ] Room membership enforcement
- [ ] AI response varies by room config

### E2E Tests

- [ ] Full user journey: login → switch room → chat → upload file
- [ ] Multi-user scenario: owner creates room, adds child user, child sends message
- [ ] AI tool restriction: #kiddo-room blocks dangerous commands

---

## 10. API Examples

### Create User

```http
POST /api/users
{
  "handle": "kiddo",
  "display_name": "Kiddo",
  "initials": "K",
  "color": "#f59e0b",
  "role": "child"
}
```

### Create Room

```http
POST /api/rooms
{
  "slug": "family-hangout",
  "name": "Family Hangout",
  "description": "Our main family chat room",
  "type": "group",
  "icon": "👨‍👩‍👧‍👦",
  "color": "#8b5cf6",
  "ai_config": {
    "assistant_name": "The Local",
    "assistant_persona": "friendly household AI",
    "allowed_tools": ["network_status"],
    "safety_level": "standard"
  }
}
```

### Send Message to Room

```http
POST /api/rooms/5/messages
{
  "content": "What's the network status?",
  "user_id": 2
}

Response:
{
  "id": 123,
  "room_id": 5,
  "user_id": 3,  // AI user ID
  "role": "assistant",
  "content": "Network looks good! 4 of 5 devices online: home-hub (primary), home-hub-1 (dev), chance's iPhone, iPad.",
  "timestamp": "2025-11-28T14:30:05Z"
}
```

---

## Summary

This spec provides Copilot with everything needed to transform **The Local** into a multi-user, multi-room AI assistant:

1. **User system** with roles, permissions, and presence
2. **Room system** with per-room AI configs and membership
3. **Enhanced AI context** that understands user + room + permissions
4. **Clean separation** between system rooms, family rooms, and DMs
5. **Safety-first** approach with kid-safe rooms and permission checks

The architecture is designed to be:

- ✅ **Backward compatible** (can migrate existing messages)
- ✅ **Privacy-preserving** (all data stays local)
- ✅ **Family-friendly** (kid-safe modes, parental controls)
- ✅ **Extensible** (easy to add new room types, AI personas, tools)

Ready for Copilot to implement! 🚀
