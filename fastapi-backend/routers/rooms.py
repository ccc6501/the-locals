# fastapi-backend/routers/rooms.py

from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import Thread, Message, User, RoomMember
from auth.current_user import get_current_user
from auth.room_permissions import (
    get_membership,
    require_membership,
    can_add_members,
)

router = APIRouter()


# ---------- Pydantic schemas ----------

class RoomOut(BaseModel):
    id: int
    name: str
    type: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    ai_enabled: Optional[bool] = True  # Phase 6
    notifications_enabled: Optional[bool] = True  # Phase 6
    self_destruct_at: Optional[datetime] = None  # Phase 6B
    total_messages: Optional[int] = 0  # Phase 6B
    total_ai_requests: Optional[int] = 0  # Phase 6B
    last_activity_at: Optional[datetime] = None  # Phase 6B

    class Config:
        from_attributes = True


class MessageOut(BaseModel):
    id: int
    thread_id: int
    user_id: Optional[int] = None
    sender: str
    text: str
    timestamp: datetime

    class Config:
        from_attributes = True


class RoomCreateRequest(BaseModel):
    name: str
    type: Optional[str] = "room"


class MessageCreateRequest(BaseModel):
    text: str


class RoomMemberOut(BaseModel):
    """Room member with user information"""
    user_id: int
    name: str
    handle: str
    role: str
    joined_at: datetime

    class Config:
        from_attributes = True


class AddMemberRequest(BaseModel):
    user_id: int


class RoomUpdateRequest(BaseModel):
    """Phase 6B: Update room name and settings"""
    name: Optional[str] = None
    ai_enabled: Optional[bool] = None
    notifications_enabled: Optional[bool] = None
    self_destruct_at: Optional[datetime] = None


class SelfDestructRequest(BaseModel):
    """Phase 6B: Set self-destruct timer"""
    duration: str  # "7d", "30d", "90d", "never"


# ---------- Helpers ----------

def get_default_user(db: Session) -> User:
    user = db.query(User).filter(User.handle == "chance").first()
    if user:
        return user

    user = db.query(User).filter(User.id == 1).first()
    if user:
        return user

    raise HTTPException(
        status_code=500,
        detail="No default user found (handle='chance' or id=1).",
    )


def get_or_create_default_room(db: Session) -> Thread:
    # Try to find a 'General' room first
    room = (
        db.query(Thread)
        .filter(Thread.name == "General", Thread.type == "room")
        .first()
    )
    if room:
        return room

    # If any thread exists, just return the most recently updated one
    room = db.query(Thread).order_by(Thread.updated_at.desc()).first()
    if room:
        return room

    # Otherwise create a brand new default room
    now = datetime.utcnow()
    room = Thread(
        name="General",
        type="room",
        created_at=now,
        updated_at=now,
    )
    db.add(room)
    db.commit()
    db.refresh(room)
    return room


def ensure_membership_for_current_user(db: Session, thread_id: int):
    """
    Self-heal membership for legacy rooms.
    If a room has zero members, add current user as owner.
    If a room has members but current user is missing, add current user as member.
    
    Phase 6B: Global admins are NOT auto-added to rooms (privacy protection).
    """
    thread = db.query(Thread).filter(Thread.id == thread_id).first()
    if not thread:
        return
    
    # Check how many members exist for this room
    member_count = db.query(RoomMember).filter(RoomMember.thread_id == thread_id).count()
    current_user = get_current_user(db)
    
    # Phase 6B: Do NOT auto-add global admins to rooms (they can manage but not see messages)
    if current_user.role == "admin":
        return
    
    # Check if current user is already a member
    existing_membership = get_membership(db, current_user.id, thread_id)
    
    if member_count == 0:
        # Room has no members - claim it as owner
        now = datetime.utcnow()
        membership = RoomMember(
            thread_id=thread_id,
            user_id=current_user.id,
            role="owner",
            created_at=now,
        )
        db.add(membership)
        db.commit()
    elif existing_membership is None:
        # Room has members but current user is not one - add as regular member
        now = datetime.utcnow()
        membership = RoomMember(
            thread_id=thread_id,
            user_id=current_user.id,
            role="member",
            created_at=now,
        )
        db.add(membership)
        db.commit()


# ---------- Routes ----------

@router.get("/api/rooms", response_model=List[RoomOut])
def list_rooms(db: Session = Depends(get_db)):
    """
    Return rooms where the current user is a member.
    Phase 6B: All users (including admins) only see rooms they're members of in main chat UI.
    Self-heals membership for legacy rooms with no members.
    """
    current_user = get_current_user(db)
    
    # Ensure at least one room exists
    get_or_create_default_room(db)
    
    # Get all rooms to check for orphaned ones
    all_rooms = db.query(Thread).all()
    
    # Self-heal: ensure membership for rooms with zero members
    # Skip for admins to prevent auto-joining all orphaned rooms
    if current_user.role != "admin":
        for room in all_rooms:
            member_count = db.query(RoomMember).filter(RoomMember.thread_id == room.id).count()
            if member_count == 0:
                ensure_membership_for_current_user(db, room.id)
    
    # Return only rooms where current user is a member
    user_room_ids = (
        db.query(RoomMember.thread_id)
        .filter(RoomMember.user_id == current_user.id)
        .all()
    )
    room_ids = [r[0] for r in user_room_ids]
    
    rooms = (
        db.query(Thread)
        .filter(Thread.id.in_(room_ids))
        .order_by(Thread.updated_at.desc())
        .all()
    )
    return rooms


@router.get("/api/admin/rooms/all", response_model=List[RoomOut])
def list_all_rooms_admin(db: Session = Depends(get_db)):
    """
    Phase 6B: Admin-only endpoint to list ALL rooms for management.
    Returns all rooms regardless of membership for lifecycle management.
    Does NOT grant message access - only for settings/metrics/cleanup.
    """
    current_user = get_current_user(db)
    
    # Require global admin role
    if current_user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Only global administrators can access all rooms"
        )
    
    # Return all rooms sorted by last updated
    rooms = (
        db.query(Thread)
        .order_by(Thread.updated_at.desc())
        .all()
    )
    return rooms


@router.post("/api/rooms", response_model=RoomOut)
def create_room(payload: RoomCreateRequest, db: Session = Depends(get_db)):
    """
    Create a new room (Thread) with the given name and optional type.
    Automatically adds the current user as owner.
    """
    name = (payload.name or "").strip()
    room_type = (payload.type or "room").strip()

    if not name:
        raise HTTPException(status_code=400, detail="Room name is required.")

    # Optional: prevent exact duplicates
    existing = (
        db.query(Thread)
        .filter(Thread.name == name, Thread.type == room_type)
        .first()
    )
    if existing:
        return existing

    now = datetime.utcnow()
    room = Thread(
        name=name,
        type=room_type,
        created_at=now,
        updated_at=now,
    )
    db.add(room)
    db.commit()
    db.refresh(room)
    
    # Auto-create membership for the current user as owner
    current_user = get_current_user(db)
    membership = RoomMember(
        thread_id=room.id,
        user_id=current_user.id,
        role="owner",
        created_at=now,
    )
    db.add(membership)
    db.commit()
    
    return room


@router.get(
    "/api/rooms/{room_id}/messages",
    response_model=List[MessageOut],
)
def get_room_messages(
    room_id: int,
    limit: int = 50,
    before: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """
    Return messages for a room ordered oldest->newest.
    Supports simple 'before id' pagination.
    Requires membership in the room.
    """
    # Self-heal membership if needed
    ensure_membership_for_current_user(db, room_id)
    
    # Require membership to view messages
    current_user = get_current_user(db)
    require_membership(db, current_user, room_id)
    
    query = db.query(Message).filter(Message.thread_id == room_id)

    if before is not None:
        query = query.filter(Message.id < before)

    messages = (
        query.order_by(Message.timestamp.asc())
        .limit(min(max(limit, 1), 100))
        .all()
    )
    return messages


@router.post(
    "/api/rooms/{room_id}/messages",
    response_model=MessageOut,
)
def create_room_message(
    room_id: int,
    payload: MessageCreateRequest,
    db: Session = Depends(get_db),
):
    """
    Create a new *user* message in the given room.
    Requires membership in the room.
    """
    # Self-heal membership if needed
    ensure_membership_for_current_user(db, room_id)
    
    # Require membership to send messages
    current_user = get_current_user(db)
    require_membership(db, current_user, room_id)
    
    text = (payload.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Message text is required.")

    user = get_default_user(db)

    now = datetime.utcnow()
    message = Message(
        thread_id=room_id,
        user_id=user.id,
        sender="CC",  # Chance / current user tag
        text=text,
        timestamp=now,
    )
    db.add(message)

    # Phase 6B: Update room metrics and activity
    thread = db.query(Thread).filter(Thread.id == room_id).first()
    if thread:
        thread.updated_at = now
        thread.last_activity_at = now
        thread.total_messages = (thread.total_messages or 0) + 1

    db.commit()
    db.refresh(message)
    return message


@router.get("/api/rooms/{room_id}/members", response_model=List[RoomMemberOut])
def get_room_members(room_id: int, db: Session = Depends(get_db)):
    """
    Get all members of a room with their user information.
    Requires membership in the room (or global admin).
    Phase 6B: Global admins can view members without being added to room.
    """
    current_user = get_current_user(db)
    is_global_admin = current_user.role == "admin"
    
    # Only self-heal membership for non-admins
    if not is_global_admin:
        ensure_membership_for_current_user(db, room_id)
        require_membership(db, current_user, room_id)
    
    # Verify room exists
    room = db.query(Thread).filter(Thread.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    # Get all memberships for this room
    memberships = (
        db.query(RoomMember)
        .filter(RoomMember.thread_id == room_id)
        .all()
    )
    
    # Build response with user info
    result = []
    for membership in memberships:
        user = db.query(User).filter(User.id == membership.user_id).first()
        if user:
            result.append({
                "user_id": user.id,
                "name": user.name,
                "handle": user.handle,
                "role": membership.role,
                "joined_at": membership.created_at,
            })
    
    return result


@router.post("/api/rooms/{room_id}/members", response_model=RoomMemberOut)
def add_room_member(room_id: int, payload: AddMemberRequest, db: Session = Depends(get_db)):
    """
    Add a user to a room as a member.
    Requires owner or admin role to add members.
    """
    user_id = payload.user_id
    
    # Get current user and verify they're a member
    current_user = get_current_user(db)
    membership = get_membership(db, current_user.id, room_id)
    
    if membership is None:
        raise HTTPException(status_code=403, detail="Not a member of this room")
    
    # Only owners and admins can add members
    if not can_add_members(membership):
        raise HTTPException(
            status_code=403,
            detail="Only owners/admins can add members to this room"
        )
    
    # Verify room exists
    room = db.query(Thread).filter(Thread.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    # Verify user exists
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if already a member
    existing = (
        db.query(RoomMember)
        .filter(RoomMember.thread_id == room_id, RoomMember.user_id == user_id)
        .first()
    )
    if existing:
        # Return existing membership info
        return {
            "user_id": user.id,
            "name": user.name,
            "handle": user.handle,
            "role": existing.role,
            "joined_at": existing.created_at,
        }
    
    # Create new membership with default role "member"
    now = datetime.utcnow()
    new_membership = RoomMember(
        thread_id=room_id,
        user_id=user_id,
        role="member",  # Default role
        created_at=now,
    )
    db.add(new_membership)
    db.commit()
    db.refresh(new_membership)
    
    return {
        "user_id": user.id,
        "name": user.name,
        "handle": user.handle,
        "role": new_membership.role,
        "joined_at": new_membership.created_at,
    }


# ========== PHASE 6 & 6B: ROOM SETTINGS & ADVANCED MANAGEMENT ==========

@router.patch("/api/rooms/{room_id}", response_model=RoomOut)
def update_room(
    room_id: int,
    request: RoomUpdateRequest,
    db: Session = Depends(get_db),
):
    """Phase 6B: Update room name and settings (owner/room admin/global admin)"""
    current_user = get_current_user(db)
    
    # Get room
    room = db.query(Thread).filter(Thread.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    # Check permissions: global admin OR room owner/admin
    is_global_admin = current_user.role == "admin"
    membership = get_membership(db, current_user.id, room_id)
    is_room_admin = membership and membership.role in ["owner", "admin"]
    
    if not is_global_admin and not is_room_admin:
        raise HTTPException(status_code=403, detail="Only global admins or room owners/admins can update room settings")
    
    # Update fields if provided
    now = datetime.utcnow()
    if request.name is not None and request.name.strip():
        room.name = request.name.strip()
    if request.ai_enabled is not None:
        room.ai_enabled = request.ai_enabled
    if request.notifications_enabled is not None:
        room.notifications_enabled = request.notifications_enabled
    if request.self_destruct_at is not None:
        room.self_destruct_at = request.self_destruct_at
    
    room.updated_at = now
    db.commit()
    db.refresh(room)
    
    return room


@router.post("/api/rooms/{room_id}/self-destruct")
def set_self_destruct(
    room_id: int,
    request: SelfDestructRequest,
    db: Session = Depends(get_db),
):
    """Phase 6B: Set self-destruct timer (room owner/admin OR global admin)"""
    current_user = get_current_user(db)
    
    # Get room
    room = db.query(Thread).filter(Thread.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    # Check permissions: global admin OR room owner/admin
    is_global_admin = current_user.role == "admin"
    membership = get_membership(db, current_user.id, room_id)
    is_room_admin = membership and membership.role in ["owner", "admin"]
    
    if not is_global_admin and not is_room_admin:
        raise HTTPException(status_code=403, detail="Only global admins or room owners/admins can set self-destruct timer")
    
    # Calculate expiration based on duration
    now = datetime.utcnow()
    if request.duration == "never":
        room.self_destruct_at = None
    elif request.duration == "7d":
        room.self_destruct_at = now + timedelta(days=7)
    elif request.duration == "30d":
        room.self_destruct_at = now + timedelta(days=30)
    elif request.duration == "90d":
        room.self_destruct_at = now + timedelta(days=90)
    else:
        raise HTTPException(status_code=400, detail="Invalid duration. Use '7d', '30d', '90d', or 'never'")
    
    room.updated_at = now
    db.commit()
    db.refresh(room)
    
    return {
        "success": True,
        "self_destruct_at": room.self_destruct_at,
        "duration": request.duration,
    }


@router.get("/api/rooms/{room_id}/metrics")
def get_room_metrics(
    room_id: int,
    db: Session = Depends(get_db),
):
    """Phase 6B: Get room metrics (permission-aware)"""
    current_user = get_current_user(db)
    
    # Get room
    room = db.query(Thread).filter(Thread.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    # Check membership
    membership = get_membership(db, current_user.id, room_id)
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this room")
    
    # Get member count
    member_count = db.query(RoomMember).filter(RoomMember.thread_id == room_id).count()
    
    # Calculate time until self-destruct
    time_remaining = None
    if room.self_destruct_at:
        delta = room.self_destruct_at - datetime.utcnow()
        if delta.total_seconds() > 0:
            days = delta.days
            hours = delta.seconds // 3600
            minutes = (delta.seconds % 3600) // 60
            time_remaining = {
                "days": days,
                "hours": hours,
                "minutes": minutes,
                "total_seconds": int(delta.total_seconds()),
            }
    
    return {
        "room_id": room.id,
        "room_name": room.name,
        "created_at": room.created_at,
        "total_messages": room.total_messages,
        "total_ai_requests": room.total_ai_requests,
        "member_count": member_count,
        "last_activity_at": room.last_activity_at,
        "self_destruct_at": room.self_destruct_at,
        "time_remaining": time_remaining,
        "ai_enabled": room.ai_enabled,
        "notifications_enabled": room.notifications_enabled,
    }


@router.delete("/api/rooms/{room_id}")
def delete_room(
    room_id: int,
    db: Session = Depends(get_db),
):
    """Phase 6B: Delete room (room owner OR global admin)"""
    current_user = get_current_user(db)
    
    # Get room
    room = db.query(Thread).filter(Thread.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    # Check permissions: global admin OR room owner
    is_global_admin = current_user.role == "admin"
    membership = get_membership(db, current_user.id, room_id)
    is_owner = membership and membership.role == "owner"
    
    if not is_global_admin and not is_owner:
        raise HTTPException(status_code=403, detail="Only global admins or room owner can delete the room")
    
    # Delete room (CASCADE will handle messages and memberships)
    db.delete(room)
    db.commit()
    
    return {"success": True, "message": f"Room '{room.name}' deleted successfully"}
