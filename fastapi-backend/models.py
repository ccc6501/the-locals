"""
Database models for the admin panel
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Float, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class User(Base):
    """User model - represents a person (not a device)"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    handle = Column(String(50), unique=True, nullable=False, index=True)  # @chance, @dad
    display_name = Column(String(100), nullable=False)  # "Chance", "Dad"
    name = Column(String(100), nullable=True)  # Legacy - kept for backward compat
    email = Column(String(100), unique=True, nullable=True, index=True)  # Optional now
    hashed_password = Column(String(255), nullable=True)  # Optional for local auth
    
    # Visual identity
    initials = Column(String(5), nullable=True)  # "CC", "D"
    avatar_url = Column(String(500), nullable=True)
    color = Column(String(20), default="#8b5cf6")  # for chat bubbles
    
    # Role & permissions
    role = Column(String(20), default="member")  # owner, admin, member, child, guest
    is_bot = Column(Boolean, default=False)  # TRUE for "The Local" AI
    
    # Status & activity
    status = Column(String(20), default="offline")  # online, offline, away
    last_active_at = Column(DateTime, nullable=True)
    
    # Legacy fields
    devices = Column(Integer, default=0)
    ai_usage = Column(Integer, default=0)
    storage_used = Column(Float, default=0.0)
    
    # Preferences (JSON)
    preferences = Column(JSON, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    threads = relationship("Thread", back_populates="user", cascade="all, delete-orphan")
    messages = relationship("Message", back_populates="user", cascade="all, delete-orphan")
    user_devices = relationship("Device", back_populates="user", cascade="all, delete-orphan")
    permissions = relationship("UserPermission", back_populates="user", cascade="all, delete-orphan")
    room_memberships = relationship("RoomMember", back_populates="user", cascade="all, delete-orphan")
    created_rooms = relationship("Room", back_populates="creator", foreign_keys="Room.created_by")


class Device(Base):
    """Device tracking model - links devices to users"""
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    device_id = Column(String(100), unique=True, index=True)  # Tailscale device ID
    device_name = Column(String(100))  # e.g., "Chrome on Windows", "Safari on iPad"
    device_type = Column(String(50))  # desktop, mobile, tablet
    hostname = Column(String(100))  # Tailscale hostname
    ip_address = Column(String(50))
    user_agent = Column(String(500))
    is_primary = Column(Boolean, default=False)
    last_active = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    first_seen = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    
    # Relationships
    user = relationship("User", back_populates="user_devices")


class UserPermission(Base):
    """User permissions - what actions a user can perform"""
    __tablename__ = "user_permissions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    permission = Column(String(100), nullable=False)  # e.g., 'manage_rooms', 'restart_services'
    
    # Relationships
    user = relationship("User", back_populates="permissions")


class Room(Base):
    """Room model - conversation spaces with AI config"""
    __tablename__ = "rooms"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String(100), unique=True, nullable=False, index=True)  # 'general', 'network'
    name = Column(String(100), nullable=False)  # "General", "Network Ops"
    description = Column(Text, nullable=True)
    type = Column(String(20), default="group")  # system, dm, group
    icon = Column(String(50), nullable=True)  # emoji or icon name
    color = Column(String(20), default="#8b5cf6")
    is_system = Column(Boolean, default=False)  # can't be deleted
    
    # AI Configuration (JSON)
    ai_config = Column(JSON, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Relationships
    creator = relationship("User", back_populates="created_rooms", foreign_keys=[created_by])
    members = relationship("RoomMember", back_populates="room", cascade="all, delete-orphan")
    room_messages = relationship("Message", back_populates="room", cascade="all, delete-orphan")


class RoomMember(Base):
    """Room membership - which users have access to which rooms"""
    __tablename__ = "room_members"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role = Column(String(20), default="member")  # owner, admin, member
    joined_at = Column(DateTime, default=datetime.utcnow)
    last_read_at = Column(DateTime, nullable=True)  # for unread counts
    notifications = Column(String(20), default="all")  # all, mentions, none
    
    # Relationships
    room = relationship("Room", back_populates="members")
    user = relationship("User", back_populates="room_memberships")


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

    # Relationships
    user = relationship("User", back_populates="threads")
    messages = relationship("Message", back_populates="thread", cascade="all, delete-orphan")


class Message(Base):
    """Chat message model - belongs to a room and user"""
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=True)  # New: room context
    thread_id = Column(Integer, ForeignKey("threads.id"), nullable=True)  # Legacy - kept for migration
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    sender = Column(String(100), nullable=False)  # Legacy field
    text = Column(Text, nullable=False)
    role = Column(String(20), default="user")  # user, assistant
    metadata = Column(JSON, nullable=True)  # attachments, reactions, etc.
    timestamp = Column(DateTime, default=datetime.utcnow)

    # Relationships
    room = relationship("Room", back_populates="room_messages")
    thread = relationship("Thread", back_populates="messages")
    user = relationship("User", back_populates="messages")


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
