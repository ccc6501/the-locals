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
