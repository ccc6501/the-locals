# fastapi-backend/routers/rooms.py

from datetime import datetime
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
    """
    thread = db.query(Thread).filter(Thread.id == thread_id).first()
    if not thread:
        return
    
    # Check how many members exist for this room
    member_count = db.query(RoomMember).filter(RoomMember.thread_id == thread_id).count()
    current_user = get_current_user(db)
    
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
    Self-heals membership for legacy rooms with no members.
    """
    current_user = get_current_user(db)
    
    # Ensure at least one room exists
    get_or_create_default_room(db)
    
    # Get all rooms to check for orphaned ones
    all_rooms = db.query(Thread).all()
    
    # Self-heal: ensure membership for rooms with zero members
    for room in all_rooms:
        member_count = db.query(RoomMember).filter(RoomMember.thread_id == room.id).count()
        if member_count == 0:
            ensure_membership_for_current_user(db, room.id)
    
    # Now return only rooms where current user is a member
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

    # Update room's updated_at
    thread = db.query(Thread).filter(Thread.id == room_id).first()
    if thread:
        thread.updated_at = now

    db.commit()
    db.refresh(message)
    return message


@router.get("/api/rooms/{room_id}/members", response_model=List[RoomMemberOut])
def get_room_members(room_id: int, db: Session = Depends(get_db)):
    """
    Get all members of a room with their user information.
    Requires membership in the room.
    """
    # Self-heal membership if needed
    ensure_membership_for_current_user(db, room_id)
    
    # Require membership to view member list
    current_user = get_current_user(db)
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


# ========================================
# Phase 6: Room Settings
# ========================================

class RoomSettingsUpdate(BaseModel):
    ai_enabled: Optional[bool] = None
    notifications_enabled: Optional[bool] = None


@router.patch("/api/rooms/{room_id}/settings")
def update_room_settings(
    room_id: int,
    settings: RoomSettingsUpdate,
    db: Session = Depends(get_db)
):
    """
    Update room settings (AI enabled, notifications).
    Only room owner or admin can update settings.
    """
    current_user = get_current_user(db)
    
    # Get room
    room = db.query(Thread).filter(Thread.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    # Check if user is owner or admin of the room
    membership = get_membership(db, current_user.id, room_id)
    if not membership or membership.role not in ("owner", "admin"):
        raise HTTPException(
            status_code=403,
            detail="Only room owners and admins can update settings"
        )
    
    # Update settings
    if settings.ai_enabled is not None:
        room.ai_enabled = settings.ai_enabled
    if settings.notifications_enabled is not None:
        room.notifications_enabled = settings.notifications_enabled
    
    room.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(room)
    
    return {
        "id": room.id,
        "name": room.name,
        "ai_enabled": room.ai_enabled,
        "notifications_enabled": room.notifications_enabled,
    }


@router.delete("/api/rooms/{room_id}")
def delete_room(
    room_id: int,
    db: Session = Depends(get_db)
):
    """
    Delete a room. Only the room owner can delete.
    This will cascade delete all messages and memberships.
    """
    current_user = get_current_user(db)
    
    # Get room
    room = db.query(Thread).filter(Thread.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    # Check if user is the owner
    membership = get_membership(db, current_user.id, room_id)
    if not membership or membership.role != "owner":
        raise HTTPException(
            status_code=403,
            detail="Only the room owner can delete the room"
        )
    
    # Delete the room (cascades to messages and memberships)
    db.delete(room)
    db.commit()
    
    return {"message": f"Room '{room.name}' deleted successfully", "room_id": room_id}

