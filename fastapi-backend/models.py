"""
Database models for the admin panel
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Float
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class User(Base):
    """User model"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    handle = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(20), default="user")  # admin, moderator, user
    status = Column(String(20), default="offline")  # online, offline, suspended
    devices = Column(Integer, default=0)
    ai_usage = Column(Integer, default=0)
    storage_used = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    threads = relationship("Thread", back_populates="user", cascade="all, delete-orphan")
    messages = relationship("Message", back_populates="user", cascade="all, delete-orphan")
    user_devices = relationship("Device", back_populates="user", cascade="all, delete-orphan")
    memberships = relationship("RoomMember", back_populates="user", cascade="all, delete-orphan")


class Device(Base):
    """Device tracking model"""
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    device_name = Column(String(100))  # e.g., "Chrome on Windows", "Safari on iPad"
    device_type = Column(String(50))  # desktop, mobile, tablet
    ip_address = Column(String(50))
    user_agent = Column(String(500))
    last_active = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    first_seen = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    
    # Relationships
    user = relationship("User", back_populates="user_devices")


class Invite(Base):
    """Invite code model"""
    __tablename__ = "invites"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False, index=True)
    uses = Column(Integer, default=0)
    max_uses = Column(Integer, default=5)
    status = Column(String(20), default="active")  # active, expired, revoked
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)


class Thread(Base):
    """Chat thread model"""
    __tablename__ = "threads"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(String(20), nullable=False)  # ai, group, dm
    name = Column(String(100), nullable=False)
    avatar = Column(String(50))
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Phase 6: Room settings
    ai_enabled = Column(Boolean, default=True)  # Allow AI responses in this room
    notifications_enabled = Column(Boolean, default=True)  # Enable notifications for room activity
    
    # Phase 6B: Advanced room management
    self_destruct_at = Column(DateTime, nullable=True)  # When to auto-delete this room
    total_messages = Column(Integer, default=0)  # Total message count
    total_ai_requests = Column(Integer, default=0)  # Total AI requests in this room
    last_activity_at = Column(DateTime, default=datetime.utcnow)  # Last message timestamp

    # Relationships
    user = relationship("User", back_populates="threads")
    messages = relationship("Message", back_populates="thread", cascade="all, delete-orphan")
    members = relationship("RoomMember", back_populates="thread", cascade="all, delete-orphan")


class Message(Base):
    """Chat message model"""
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    thread_id = Column(Integer, ForeignKey("threads.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    sender = Column(String(100), nullable=False)
    text = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)

    # Relationships
    thread = relationship("Thread", back_populates="messages")
    user = relationship("User", back_populates="messages")


class RoomMember(Base):
    """Room membership model - links users to threads/rooms"""
    __tablename__ = "room_members"

    id = Column(Integer, primary_key=True, index=True)
    thread_id = Column(Integer, ForeignKey("threads.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(20), default="member")  # owner, admin, member
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    thread = relationship("Thread", back_populates="members")
    user = relationship("User", back_populates="memberships")


class Connection(Base):
    """API Connections configuration"""
    __tablename__ = "connections"

    id = Column(Integer, primary_key=True, index=True)
    service = Column(String(50), unique=True, nullable=False)  # tailscale, openai, ollama
    enabled = Column(Boolean, default=False)
    config = Column(Text)  # JSON string of configuration
    status = Column(String(50), default="unconfigured")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class CloudStorageConfig(Base):
    """Cloud storage configuration"""
    __tablename__ = "cloud_storage_config"

    id = Column(Integer, primary_key=True, index=True)
    provider = Column(String(20), nullable=False)  # s3, gcs, azure
    bucket = Column(String(100))
    region = Column(String(50))
    access_key = Column(String(255))
    secret_key = Column(String(255))
    endpoint = Column(String(255))
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class StorageFile(Base):
    """Cloud storage file metadata"""
    __tablename__ = "storage_files"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    path = Column(String(500), nullable=False)
    type = Column(String(20))  # file, folder
    size = Column(String(50))
    modified = Column(DateTime, default=datetime.utcnow)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)


class Settings(Base):
    """System settings"""
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, nullable=False)
    value = Column(Text)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class SystemLog(Base):
    """System logs"""
    __tablename__ = "system_logs"

    id = Column(Integer, primary_key=True, index=True)
    level = Column(String(20))  # info, warning, error
    message = Column(Text)
    timestamp = Column(DateTime, default=datetime.utcnow)


class Notification(Base):
    """User notifications"""
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    type = Column(String(50))  # ping, announcement, system
    title = Column(String(200))
    message = Column(Text, nullable=False)
    read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    from_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
