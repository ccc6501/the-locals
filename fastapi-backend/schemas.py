"""
Pydantic schemas for request/response validation
"""

from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional, List
from datetime import datetime


# ============================================
# User Schemas
# ============================================

class UserBase(BaseModel):
    name: str
    email: EmailStr
    role: str = "user"


class UserCreate(UserBase):
    password: str
    handle: Optional[str] = None  # Auto-generated if not provided


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[str] = None


class UserResponse(BaseModel):
    id: int
    name: str
    handle: str
    email: EmailStr
    role: str
    status: str
    devices: int
    aiUsage: int = Field(serialization_alias='aiUsage', validation_alias='ai_usage')
    storageUsed: float = Field(serialization_alias='storageUsed', validation_alias='storage_used')
    created_at: datetime
    lastIp: Optional[str] = None
    lastDevice: Optional[str] = None
    lastActive: Optional[str] = None

    model_config = {
        "from_attributes": True,
        "populate_by_name": True
    }


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    email: Optional[str] = None


# ============================================
# Invite Schemas
# ============================================

class InviteCreate(BaseModel):
    max_uses: int = 5


class InviteResponse(BaseModel):
    id: int
    code: str
    uses: int
    max_uses: int = Field(serialization_alias="maxUses")
    status: str
    created_at: datetime = Field(serialization_alias="createdAt")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# ============================================
# Chat Schemas
# ============================================

class MessageCreate(BaseModel):
    text: str
    threadId: Optional[int] = None


class MessageResponse(BaseModel):
    id: int
    sender: str
    text: str
    timestamp: datetime

    class Config:
        from_attributes = True


class ThreadCreate(BaseModel):
    type: str  # ai, group, dm
    name: str
    avatar: Optional[str] = None
    user_id: Optional[int] = None


class ThreadResponse(BaseModel):
    id: int
    type: str
    name: str
    avatar: Optional[str]
    lastMessage: Optional[str] = None
    unread: int = 0
    timestamp: datetime
    messages: List[MessageResponse] = []

    class Config:
        from_attributes = True


# ============================================
# Connection Schemas
# ============================================

class TailscaleConfig(BaseModel):
    enabled: bool
    authKey: Optional[str] = None
    hostname: Optional[str] = None


class OpenAIConfig(BaseModel):
    enabled: bool
    apiKey: Optional[str] = None
    model: str = "gpt-4o-mini"


class OllamaConfig(BaseModel):
    enabled: bool
    endpoint: str = "http://localhost:11434"
    model: str = "llama2"


class ConnectionsResponse(BaseModel):
    tailscale: dict
    openai: dict
    ollama: dict


# ============================================
# Cloud Storage Schemas
# ============================================

class CloudStorageConfigUpdate(BaseModel):
    provider: str
    bucket: str
    region: Optional[str] = None
    accessKey: Optional[str] = None
    secretKey: Optional[str] = None


class FileResponse(BaseModel):
    id: Optional[int] = None
    name: str
    type: str
    size: str
    modified: str


# ============================================
# Settings Schemas
# ============================================

class SettingsUpdate(BaseModel):
    allowRegistration: Optional[bool] = None
    requireEmailVerification: Optional[bool] = None
    aiRateLimit: Optional[int] = None
    storagePerUser: Optional[int] = None
    maxDevicesPerUser: Optional[int] = None
    systemInstructions: Optional[str] = None
    maintenanceMode: Optional[bool] = None
    debugMode: Optional[bool] = None
    autoBackup: Optional[bool] = None


class SettingsResponse(BaseModel):
    allowRegistration: bool
    requireEmailVerification: bool
    aiRateLimit: int
    storagePerUser: int
    maxDevicesPerUser: int


class NotificationSend(BaseModel):
    message: str
    target: str = "all"  # all, admins, specific user


# ============================================
# System Schemas
# ============================================

class SystemHealthResponse(BaseModel):
    cpu: float
    memory: float
    disk: float
    uptime: str
    dbSize: str
    lastBackup: str
    networkStatus: str
    latency: str


class SystemLogResponse(BaseModel):
    id: int
    level: str
    message: str
    timestamp: datetime

    class Config:
        from_attributes = True


# ============================================
# Notification Schemas
# ============================================

class NotificationResponse(BaseModel):
    id: int
    type: str
    title: Optional[str] = None
    message: str
    read: bool
    created_at: datetime = Field(alias="createdAt", serialization_alias="createdAt")
    from_user_id: Optional[int] = Field(alias="fromUserId", serialization_alias="fromUserId", default=None)

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# ============================================
# Multi-User Schemas
# ============================================

class UserProfileCreate(BaseModel):
    """Create a new user profile"""
    handle: str
    display_name: str
    initials: Optional[str] = None
    color: Optional[str] = "#8b5cf6"
    role: Optional[str] = "member"
    email: Optional[EmailStr] = None
    password: Optional[str] = None


class UserProfileUpdate(BaseModel):
    """Update user profile"""
    display_name: Optional[str] = None
    initials: Optional[str] = None
    avatar_url: Optional[str] = None
    color: Optional[str] = None
    status: Optional[str] = None
    preferences: Optional[dict] = None


class UserProfileResponse(BaseModel):
    """User profile response"""
    id: int
    handle: str
    display_name: str
    initials: Optional[str] = None
    avatar_url: Optional[str] = None
    color: str
    role: str
    is_bot: bool
    status: str
    last_active_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserPermissionResponse(BaseModel):
    """User permission"""
    permission: str

    model_config = ConfigDict(from_attributes=True)


class UserPresenceResponse(BaseModel):
    """User presence/online status"""
    user_id: int
    online: bool
    last_active_at: Optional[datetime] = None
    active_devices: int


# ============================================
# Room Schemas
# ============================================

class RoomAIConfig(BaseModel):
    """AI configuration for a room"""
    assistant_name: str = "The Local"
    assistant_persona: str = "helpful AI assistant"
    model: str = "gpt-4o-mini"
    temperature: float = 0.7
    safety_level: str = "standard"  # strict, standard, relaxed
    allowed_tools: List[str] = []
    disabled_tools: List[str] = []
    system_prompt_override: Optional[str] = None
    context_sources: List[str] = ["network_snapshot", "system_summary", "room_history"]


class RoomCreate(BaseModel):
    """Create a new room"""
    slug: str
    name: str
    description: Optional[str] = None
    type: str = "group"  # system, dm, group
    icon: Optional[str] = None
    color: str = "#8b5cf6"
    ai_config: Optional[RoomAIConfig] = None
    member_ids: Optional[List[int]] = []  # Initial members


class RoomUpdate(BaseModel):
    """Update room details"""
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    ai_config: Optional[RoomAIConfig] = None


class RoomMemberResponse(BaseModel):
    """Room member details"""
    user_id: int
    handle: str
    display_name: str
    avatar_url: Optional[str] = None
    color: str
    role: str  # owner, admin, member
    joined_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RoomResponse(BaseModel):
    """Room response"""
    id: int
    slug: str
    name: str
    description: Optional[str] = None
    type: str
    icon: Optional[str] = None
    color: str
    is_system: bool
    ai_config: Optional[dict] = None
    created_at: datetime
    created_by: Optional[int] = None
    member_count: Optional[int] = None
    unread_count: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class RoomMessageCreate(BaseModel):
    """Send a message to a room"""
    content: str
    metadata: Optional[dict] = None


class RoomMessageResponse(BaseModel):
    """Room message response"""
    id: int
    room_id: int
    user_id: Optional[int] = None
    sender_handle: Optional[str] = None
    sender_name: Optional[str] = None
    sender_avatar: Optional[str] = None
    sender_color: Optional[str] = None
    role: str  # user, assistant
    text: str
    metadata: Optional[dict] = None
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)


class RoomMemberAdd(BaseModel):
    """Add member to room"""
    user_id: int
    role: str = "member"


class RoomMemberUpdate(BaseModel):
    """Update room member role"""
    role: str
