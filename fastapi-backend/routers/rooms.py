# fastapi-backend/routers/rooms.py

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import Thread, Message, User, RoomMember
from auth.current_user import get_current_user

router = APIRouter()


# ---------- Pydantic schemas ----------

class RoomOut(BaseModel):
    id: int
    name: str
    type: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

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


# ---------- Routes ----------

@router.get("/api/rooms", response_model=List[RoomOut])
def list_rooms(db: Session = Depends(get_db)):
    """
    Return all rooms (Threads). Guarantees at least one default room exists.
    """
    # Ensure at least one room exists
    get_or_create_default_room(db)

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
    """
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
    """
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
    """
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
    """
    user_id = payload.user_id
    
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
    
    # Create new membership
    now = datetime.utcnow()
    membership = RoomMember(
        thread_id=room_id,
        user_id=user_id,
        role="member",
        created_at=now,
    )
    db.add(membership)
    db.commit()
    db.refresh(membership)
    
    return {
        "user_id": user.id,
        "name": user.name,
        "handle": user.handle,
        "role": membership.role,
        "joined_at": membership.created_at,
    }
