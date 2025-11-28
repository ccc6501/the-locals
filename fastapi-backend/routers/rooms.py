"""
Room management routes for multi-user chat
"""

from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from database import get_db
from models import User, Room, RoomMember, Message
from schemas import (
    RoomResponse, RoomCreate, RoomUpdate,
    RoomMemberResponse, RoomMemberAdd, RoomMemberUpdate,
    RoomMessageResponse, RoomMessageCreate
)
from auth_utils import get_current_active_user

router = APIRouter()


# ========================================
# Room Management
# ========================================

@router.get("", response_model=List[RoomResponse])
async def list_rooms(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List all rooms the current user has access to"""
    
    # Get room IDs user is a member of
    memberships = db.query(RoomMember).filter(RoomMember.user_id == current_user.id).all()
    room_ids = [m.room_id for m in memberships]
    
    # Get rooms
    rooms = db.query(Room).filter(Room.id.in_(room_ids)).all()
    
    return rooms


@router.get("/system", response_model=List[RoomResponse])
async def list_system_rooms(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List all system rooms"""
    
    rooms = db.query(Room).filter(Room.is_system == True).all()
    
    return rooms


@router.post("", response_model=RoomResponse)
async def create_room(
    room_data: RoomCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new room"""
    
    # Check if user has permission to create rooms
    from models import UserPermission
    if current_user.role not in ["owner", "admin"]:
        has_permission = db.query(UserPermission).filter(
            UserPermission.user_id == current_user.id,
            UserPermission.permission == "manage_rooms"
        ).first()
        
        if not has_permission:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to create rooms"
            )
    
    # Generate slug from name if not provided
    import re
    if room_data.slug:
        slug = room_data.slug
    else:
        slug = re.sub(r'[^a-z0-9-]', '', room_data.name.lower().replace(' ', '-'))
    
    # Ensure slug is unique
    existing = db.query(Room).filter(Room.slug == slug).first()
    if existing:
        counter = 1
        while db.query(Room).filter(Room.slug == f"{slug}-{counter}").first():
            counter += 1
        slug = f"{slug}-{counter}"
    
    # Create room
    import json
    new_room = Room(
        slug=slug,
        name=room_data.name,
        type=room_data.type,
        icon=room_data.icon,
        color=room_data.color or "#6B7280",
        created_by=current_user.id,
        is_system=False,
        ai_config=json.dumps(room_data.ai_config.dict()) if room_data.ai_config else "{}"
    )
    
    db.add(new_room)
    db.commit()
    db.refresh(new_room)
    
    # Add creator as owner
    membership = RoomMember(
        room_id=new_room.id,
        user_id=current_user.id,
        role="owner"
    )
    db.add(membership)
    db.commit()
    
    return new_room


@router.get("/{room_id}", response_model=RoomResponse)
async def get_room(
    room_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get room details"""
    
    # Check if user has access to this room
    membership = db.query(RoomMember).filter(
        RoomMember.room_id == room_id,
        RoomMember.user_id == current_user.id
    ).first()
    
    if not membership and current_user.role not in ["owner", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this room"
        )
    
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found"
        )
    
    return room


@router.patch("/{room_id}", response_model=RoomResponse)
async def update_room(
    room_id: int,
    room_data: RoomUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update room details (owner/admin only)"""
    
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found"
        )
    
    # Check if user is room owner or admin
    membership = db.query(RoomMember).filter(
        RoomMember.room_id == room_id,
        RoomMember.user_id == current_user.id
    ).first()
    
    if (not membership or membership.role not in ["owner", "admin"]) and current_user.role not in ["owner", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to modify this room"
        )
    
    # Update fields
    if room_data.name is not None:
        room.name = room_data.name
    
    if room_data.icon is not None:
        room.icon = room_data.icon
    
    if room_data.color is not None:
        room.color = room_data.color
    
    if room_data.ai_config is not None:
        import json
        room.ai_config = json.dumps(room_data.ai_config.dict())
    
    db.commit()
    db.refresh(room)
    
    return room


@router.delete("/{room_id}")
async def delete_room(
    room_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a room (owner only)"""
    
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found"
        )
    
    # Cannot delete system rooms
    if room.is_system:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot delete system rooms"
        )
    
    # Check if user is room owner or global owner
    membership = db.query(RoomMember).filter(
        RoomMember.room_id == room_id,
        RoomMember.user_id == current_user.id
    ).first()
    
    if (not membership or membership.role != "owner") and current_user.role != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this room"
        )
    
    # Delete room (cascade will handle members and messages)
    db.delete(room)
    db.commit()
    
    return {"message": "Room deleted successfully"}


# ========================================
# Room Membership
# ========================================

@router.get("/{room_id}/members", response_model=List[RoomMemberResponse])
async def list_room_members(
    room_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List all members in a room"""
    
    # Check if user has access to this room
    membership = db.query(RoomMember).filter(
        RoomMember.room_id == room_id,
        RoomMember.user_id == current_user.id
    ).first()
    
    if not membership and current_user.role not in ["owner", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this room"
        )
    
    members = db.query(RoomMember).filter(RoomMember.room_id == room_id).all()
    
    return members


@router.post("/{room_id}/members", response_model=RoomMemberResponse)
async def add_room_member(
    room_id: int,
    member_data: RoomMemberAdd,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Add a user to a room"""
    
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found"
        )
    
    # Check if current user can add members (owner/admin of room or global admin)
    current_membership = db.query(RoomMember).filter(
        RoomMember.room_id == room_id,
        RoomMember.user_id == current_user.id
    ).first()
    
    if (not current_membership or current_membership.role not in ["owner", "admin"]) and current_user.role not in ["owner", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to add members to this room"
        )
    
    # Check if user to add exists
    user = db.query(User).filter(User.id == member_data.user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check if already a member
    existing = db.query(RoomMember).filter(
        RoomMember.room_id == room_id,
        RoomMember.user_id == member_data.user_id
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already a member of this room"
        )
    
    # Add member
    new_member = RoomMember(
        room_id=room_id,
        user_id=member_data.user_id,
        role=member_data.role or "member"
    )
    
    db.add(new_member)
    db.commit()
    db.refresh(new_member)
    
    return new_member


@router.patch("/{room_id}/members/{user_id}", response_model=RoomMemberResponse)
async def update_room_member(
    room_id: int,
    user_id: int,
    member_data: RoomMemberUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update a member's role in a room"""
    
    # Check if current user can modify members (owner of room or global owner)
    current_membership = db.query(RoomMember).filter(
        RoomMember.room_id == room_id,
        RoomMember.user_id == current_user.id
    ).first()
    
    if (not current_membership or current_membership.role != "owner") and current_user.role != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to modify members in this room"
        )
    
    # Get member
    member = db.query(RoomMember).filter(
        RoomMember.room_id == room_id,
        RoomMember.user_id == user_id
    ).first()
    
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found"
        )
    
    # Update role
    if member_data.role is not None:
        member.role = member_data.role
    
    # Update last_read_at
    if member_data.last_read_at is not None:
        member.last_read_at = member_data.last_read_at
    
    db.commit()
    db.refresh(member)
    
    return member


@router.delete("/{room_id}/members/{user_id}")
async def remove_room_member(
    room_id: int,
    user_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Remove a user from a room"""
    
    # Check if current user can remove members (owner/admin of room or global admin or self)
    current_membership = db.query(RoomMember).filter(
        RoomMember.room_id == room_id,
        RoomMember.user_id == current_user.id
    ).first()
    
    is_self = current_user.id == user_id
    is_room_admin = current_membership and current_membership.role in ["owner", "admin"]
    is_global_admin = current_user.role in ["owner", "admin"]
    
    if not (is_self or is_room_admin or is_global_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to remove members from this room"
        )
    
    # Get member
    member = db.query(RoomMember).filter(
        RoomMember.room_id == room_id,
        RoomMember.user_id == user_id
    ).first()
    
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found"
        )
    
    # Cannot remove last owner
    if member.role == "owner":
        owner_count = db.query(RoomMember).filter(
            RoomMember.room_id == room_id,
            RoomMember.role == "owner"
        ).count()
        
        if owner_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove the last owner of a room"
            )
    
    db.delete(member)
    db.commit()
    
    return {"message": "Member removed successfully"}


# ========================================
# Room Messages
# ========================================

@router.get("/{room_id}/messages", response_model=List[RoomMessageResponse])
async def get_room_messages(
    room_id: int,
    limit: int = 50,
    before: Optional[int] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get messages in a room with pagination"""
    
    # Check if user has access to this room
    membership = db.query(RoomMember).filter(
        RoomMember.room_id == room_id,
        RoomMember.user_id == current_user.id
    ).first()
    
    if not membership and current_user.role not in ["owner", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this room"
        )
    
    # Build query
    query = db.query(Message).filter(Message.room_id == room_id)
    
    if before:
        query = query.filter(Message.id < before)
    
    messages = query.order_by(Message.created_at.desc()).limit(limit).all()
    
    # Reverse to show oldest first
    messages.reverse()
    
    return messages


@router.post("/{room_id}/messages", response_model=RoomMessageResponse)
async def send_room_message(
    room_id: int,
    message_data: RoomMessageCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Send a message to a room"""
    
    # Check if user has access to this room
    membership = db.query(RoomMember).filter(
        RoomMember.room_id == room_id,
        RoomMember.user_id == current_user.id
    ).first()
    
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to send messages to this room"
        )
    
    # Create message
    import json
    new_message = Message(
        room_id=room_id,
        user_id=current_user.id,
        role=message_data.role,
        content=message_data.content,
        metadata=json.dumps(message_data.metadata) if message_data.metadata else None
    )
    
    db.add(new_message)
    db.commit()
    db.refresh(new_message)
    
    return new_message


@router.patch("/{room_id}/read")
async def mark_room_as_read(
    room_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Mark all messages in a room as read"""
    
    # Get membership
    membership = db.query(RoomMember).filter(
        RoomMember.room_id == room_id,
        RoomMember.user_id == current_user.id
    ).first()
    
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this room"
        )
    
    # Update last_read_at to now
    membership.last_read_at = datetime.utcnow()
    db.commit()
    
    return {"message": "Room marked as read"}


@router.get("/{room_id}/unread-count")
async def get_unread_count(
    room_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get count of unread messages in a room"""
    
    # Get membership
    membership = db.query(RoomMember).filter(
        RoomMember.room_id == room_id,
        RoomMember.user_id == current_user.id
    ).first()
    
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this room"
        )
    
    # Count messages since last_read_at
    if membership.last_read_at:
        unread_count = db.query(Message).filter(
            Message.room_id == room_id,
            Message.created_at > membership.last_read_at,
            Message.user_id != current_user.id  # Don't count own messages
        ).count()
    else:
        # Never read, count all messages
        unread_count = db.query(Message).filter(
            Message.room_id == room_id,
            Message.user_id != current_user.id
        ).count()
    
    return {"unread_count": unread_count}
