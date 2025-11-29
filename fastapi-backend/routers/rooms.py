"""
Persistent rooms (threads) and messages API
Phase 1: Backend persistent storage for chat rooms using Thread and Message models
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

from database import get_db
from models import User, Thread, Message

router = APIRouter()


# ============================================
# Response Models
# ============================================

class RoomResponse(BaseModel):
    """Room (Thread) response model"""
    id: int
    name: str
    type: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class MessageResponse(BaseModel):
    """Message response model"""
    id: int
    thread_id: int
    user_id: Optional[int]
    sender: str
    text: str
    timestamp: datetime
    
    class Config:
        from_attributes = True


class CreateMessageRequest(BaseModel):
    """Request body for creating a message"""
    text: str


# ============================================
# Helper Functions
# ============================================

def get_default_user(db: Session) -> User:
    """
    Get the default user (Chance) for Phase 1.
    Tries to find user with handle='chance', falls back to user id=1
    """
    # Try to find user with handle 'chance'
    user = db.query(User).filter(User.handle == "chance").first()
    
    if not user:
        # Fallback to user id=1
        user = db.query(User).filter(User.id == 1).first()
    
    if not user:
        raise HTTPException(
            status_code=500,
            detail="No default user found. Please create a user with handle 'chance' or id=1"
        )
    
    return user


# ============================================
# Room (Thread) Endpoints
# ============================================

@router.get("/api/rooms", response_model=List[RoomResponse])
def list_rooms(db: Session = Depends(get_db)):
    """
    Get all rooms (threads) from the database.
    For Phase 1, returns all threads of type 'room'.
    """
    # Query all threads of type 'room'
    # You can filter by type if needed: .filter(Thread.type == "room")
    threads = db.query(Thread).order_by(Thread.updated_at.desc()).all()
    
    return threads


@router.get("/api/rooms/{room_id}/messages", response_model=List[MessageResponse])
def get_room_messages(
    room_id: int,
    limit: int = Query(50, ge=1, le=100),
    before: Optional[int] = Query(None, description="Message ID to fetch messages before"),
    db: Session = Depends(get_db)
):
    """
    Get messages for a specific room (thread).
    Messages are returned in ascending order (oldest first).
    
    Args:
        room_id: The thread ID
        limit: Maximum number of messages to return (default 50, max 100)
        before: Optional message ID to fetch messages before (for pagination)
    """
    # Verify the room exists
    room = db.query(Thread).filter(Thread.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail=f"Room {room_id} not found")
    
    # Build query for messages
    query = db.query(Message).filter(Message.thread_id == room_id)
    
    # Apply before filter for pagination
    if before is not None:
        query = query.filter(Message.id < before)
    
    # Order by timestamp/id ascending (oldest first) and limit
    messages = query.order_by(Message.timestamp.asc(), Message.id.asc()).limit(limit).all()
    
    return messages


@router.post("/api/rooms/{room_id}/messages", response_model=MessageResponse)
def create_room_message(
    room_id: int,
    request: CreateMessageRequest,
    db: Session = Depends(get_db)
):
    """
    Create a new message in a room (thread).
    
    For Phase 1, uses a hardcoded user (Chance) from the database.
    """
    # Verify the room exists
    room = db.query(Thread).filter(Thread.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail=f"Room {room_id} not found")
    
    # Get the default user (Chance)
    user = get_default_user(db)
    
    # Create the message
    message = Message(
        thread_id=room_id,
        user_id=user.id,
        sender="CC",  # Chance's initials
        text=request.text.strip(),
        timestamp=datetime.utcnow()
    )
    
    db.add(message)
    db.commit()
    db.refresh(message)
    
    # Update the thread's updated_at timestamp
    room.updated_at = datetime.utcnow()
    db.commit()
    
    return message
