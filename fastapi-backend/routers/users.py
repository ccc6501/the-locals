"""
User management routes
"""

from fastapi import APIRouter, Depends, HTTPException, status, Body
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session
from typing import List, Optional

from database import get_db
from models import User, Device, Notification
from schemas import (
    UserResponse, UserCreate, UserUpdate,
    UserProfileResponse, UserProfileUpdate, UserProfileCreate,
    UserPermissionResponse, UserPresenceResponse
)
from auth_utils import get_current_active_user, require_admin, require_moderator, get_password_hash
from auth.current_user import get_current_user

router = APIRouter()


@router.get("/me", response_model=UserResponse)
async def get_me(db: Session = Depends(get_db)):
    """
    Get current user information.
    For Phase 4A, always returns Chance (no auth yet).
    """
    current_user = get_current_user(db)
    return current_user


@router.get("/admin/summary")
async def get_user_summary(db: Session = Depends(get_db)):
    """
    Get user summary for ChatOps console.
    No authentication required.
    """
    from datetime import datetime, timedelta
    
    # Get all users
    all_users = db.query(User).all()
    total_users = len(all_users)
    
    # Count active users (logged in within last 24 hours)
    active_count = 0
    for user in all_users:
        latest_device = db.query(Device).filter(
            Device.user_id == user.id,
            Device.is_active == True
        ).order_by(Device.last_active.desc()).first()
        
        if latest_device and latest_device.last_active:
            time_diff = datetime.utcnow() - latest_device.last_active
            if time_diff < timedelta(hours=24):
                active_count += 1
    
    # Count admins
    admin_count = db.query(User).filter(User.role == "admin").count()
    
    # Get first 4 users with details
    user_list = []
    for user in all_users[:4]:
        # Check if active
        latest_device = db.query(Device).filter(
            Device.user_id == user.id,
            Device.is_active == True
        ).order_by(Device.last_active.desc()).first()
        
        is_active = False
        if latest_device and latest_device.last_active:
            time_diff = datetime.utcnow() - latest_device.last_active
            is_active = time_diff < timedelta(hours=24)
        
        user_list.append({
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "active": is_active
        })
    
    return {
        "total": total_users,
        "active": active_count,
        "admins": admin_count,
        "users": user_list
    }

@router.get("/public/count")
async def get_public_user_count(db: Session = Depends(get_db)):
    """Unauthenticated lightweight user count for drawer (no PII)."""
    total = db.query(User).count()
    return {"total": total}


@router.get("", response_model=List[UserResponse], response_model_by_alias=True)
async def get_users(
    db: Session = Depends(get_db)
):
    """Get all users with device information"""
    from datetime import datetime, timedelta
    
    # Phase 4A: Use hardcoded current user (no auth required for now)
    current_user = get_current_user(db)
    
    users = db.query(User).all()
    
    # Enrich each user with latest device info
    enriched_users = []
    for user in users:
        # Get latest active device
        latest_device = db.query(Device).filter(
            Device.user_id == user.id,
            Device.is_active == True
        ).order_by(Device.last_active.desc()).first()
        
        # Determine status based on last activity (online if active within last 5 minutes)
        status = "offline"
        if latest_device and latest_device.last_active:
            time_diff = datetime.utcnow() - latest_device.last_active
            if time_diff < timedelta(minutes=5):
                status = "online"
            elif time_diff < timedelta(hours=1):
                status = "away"
        
        user_dict = {
            'id': user.id,
            'name': user.name,
            'handle': user.handle,
            'email': user.email,
            'role': user.role,
            'status': status,  # Dynamic status based on activity
            'devices': user.devices,
            'aiUsage': user.ai_usage,
            'storageUsed': user.storage_used,
            'created_at': user.created_at,
            'lastIp': latest_device.ip_address if latest_device else None,
            'lastDevice': latest_device.device_name if latest_device else None,
            'lastActive': latest_device.last_active.isoformat() if latest_device and latest_device.last_active else None
        }
        enriched_users.append(user_dict)
    
    return enriched_users


@router.get("/{user_id}", response_model=UserResponse, response_model_by_alias=True)
async def get_user(
    user_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get single user by ID"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return user


@router.post("", response_model=UserResponse, response_model_by_alias=True)
async def create_user(
    user_data: UserCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Create new user (admin only)"""
    # Check if email already exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Generate handle if not provided
    if user_data.handle:
        handle = user_data.handle if user_data.handle.startswith('@') else f"@{user_data.handle}"
    else:
        # Auto-generate from name or email
        base_handle = user_data.name.lower().replace(' ', '_') if user_data.name else user_data.email.split('@')[0]
        handle = f"@{base_handle}"
    
    # Check if handle already exists and make it unique
    existing_handle = db.query(User).filter(User.handle == handle).first()
    if existing_handle:
        # Add number suffix to make it unique
        counter = 1
        while db.query(User).filter(User.handle == f"{handle}{counter}").first():
            counter += 1
        handle = f"{handle}{counter}"
    
    # Create user
    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        name=user_data.name,
        handle=handle,
        email=user_data.email,
        hashed_password=hashed_password,
        role=user_data.role,
        status="offline"
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return new_user


@router.put("/{user_id}", response_model=UserResponse, response_model_by_alias=True)
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update user (admin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Update fields if provided
    if user_data.name is not None:
        user.name = user_data.name
    if user_data.email is not None:
        user.email = user_data.email
    if user_data.role is not None:
        user.role = user_data.role
    
    db.commit()
    db.refresh(user)
    
    return user


@router.delete("/{user_id}")
async def delete_user(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Delete user (admin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Don't allow deleting yourself
    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account"
        )
    
    db.delete(user)
    db.commit()
    
    return {"message": "User deleted successfully"}


@router.patch("/{user_id}/suspend")
async def suspend_user(
    user_id: int,
    current_user: User = Depends(require_moderator),
    db: Session = Depends(get_db)
):
    """Suspend user (admin/moderator only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    user.status = "suspended"
    db.commit()
    
    return {"message": "User suspended successfully"}


@router.patch("/{user_id}/activate")
async def activate_user(
    user_id: int,
    current_user: User = Depends(require_moderator),
    db: Session = Depends(get_db)
):
    """Activate suspended user (admin/moderator only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    user.status = "offline"
    db.commit()
    
    return {"message": "User activated successfully"}


@router.patch("/profile/password")
async def change_password(
    passwords: dict = Body(...),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Change own password"""
    from auth_utils import verify_password
    
    current_password = passwords.get("current_password")
    new_password = passwords.get("new_password")
    
    if not current_password or not new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Both current_password and new_password are required"
        )
    
    # Verify current password
    if not verify_password(current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect"
        )
    
    # Update password
    current_user.hashed_password = get_password_hash(new_password)
    db.commit()
    
    return {"message": "Password changed successfully"}


@router.patch("/profile", response_model=UserResponse, response_model_by_alias=True)
async def update_own_profile(
    profile_data: dict = Body(...),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update own profile (name and handle only)"""
    name = profile_data.get("name")
    handle = profile_data.get("handle")
    
    if name is not None:
        current_user.name = name
    
    if handle is not None:
        # Ensure handle starts with @
        new_handle = handle if handle.startswith('@') else f"@{handle}"
        
        # Check if handle is already taken by another user
        existing = db.query(User).filter(
            User.handle == new_handle,
            User.id != current_user.id
        ).first()
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Handle already taken"
            )
        
        current_user.handle = new_handle
    
    db.commit()
    db.refresh(current_user)
    
    return current_user


@router.post("/{user_id}/ping")
async def ping_user(
    user_id: int,
    message: dict = Body(...),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Send a notification/ping to a user (admin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    ping_message = message.get("message", "Admin notification")
    
    # Create notification
    notification = Notification(
        user_id=user_id,
        type="ping",
        title=f"Ping from {current_user.name}",
        message=ping_message,
        from_user_id=current_user.id
    )
    db.add(notification)
    db.commit()
    
    return {
        "message": f"Ping sent to {user.name}",
        "user_id": user_id,
        "content": ping_message
    }


@router.get("/notifications/my", response_model=List)
async def get_my_notifications(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get notifications for current user"""
    from schemas import NotificationResponse
    
    notifications = db.query(Notification).filter(
        Notification.user_id == current_user.id
    ).order_by(Notification.created_at.desc()).all()
    
    return notifications


@router.patch("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Mark notification as read"""
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    ).first()
    
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )
    
    notification.read = True
    db.commit()
    
    return {"message": "Notification marked as read"}


# ========================================
# Multi-User Profile & Permission Routes
# ========================================

@router.get("/profile/me", response_model=UserProfileResponse)
async def get_my_profile(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get full profile for current user"""
    return current_user


@router.patch("/profile/me", response_model=UserProfileResponse)
async def update_my_profile(
    profile_data: UserProfileUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update current user's profile (display name, handle, avatar, etc.)"""
    
    # Update display name
    if profile_data.display_name is not None:
        current_user.display_name = profile_data.display_name
    
    # Update handle (must be unique)
    if profile_data.handle is not None:
        new_handle = profile_data.handle if profile_data.handle.startswith('@') else f"@{profile_data.handle}"
        
        existing = db.query(User).filter(
            User.handle == new_handle,
            User.id != current_user.id
        ).first()
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Handle already taken"
            )
        
        current_user.handle = new_handle
    
    # Update initials
    if profile_data.initials is not None:
        current_user.initials = profile_data.initials
    
    # Update avatar
    if profile_data.avatar_url is not None:
        current_user.avatar_url = profile_data.avatar_url
    
    # Update color
    if profile_data.color is not None:
        current_user.color = profile_data.color
    
    # Update preferences
    if profile_data.preferences is not None:
        import json
        current_user.preferences = json.dumps(profile_data.preferences)
    
    db.commit()
    db.refresh(current_user)
    
    return current_user


@router.post("/profile/create-child", response_model=UserProfileResponse)
async def create_child_profile(
    profile_data: UserProfileCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a child profile under current user (for families)"""
    
    # Ensure handle is unique
    handle = profile_data.handle if profile_data.handle.startswith('@') else f"@{profile_data.handle}"
    existing = db.query(User).filter(User.handle == handle).first()
    if existing:
        # Auto-increment
        counter = 1
        while db.query(User).filter(User.handle == f"{handle}{counter}").first():
            counter += 1
        handle = f"{handle}{counter}"
    
    # Create child user
    import json
    new_user = User(
        name=profile_data.display_name,
        display_name=profile_data.display_name,
        handle=handle,
        email=f"{handle}@child.local",  # Synthetic email
        hashed_password="",  # No login for children
        initials=profile_data.initials,
        avatar_url=profile_data.avatar_url,
        color=profile_data.color or "#3B82F6",
        role="child",
        is_bot=False,
        status="offline",
        preferences=json.dumps(profile_data.preferences) if profile_data.preferences else "{}"
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return new_user


@router.get("/{user_id}/permissions", response_model=List[UserPermissionResponse])
async def get_user_permissions(
    user_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all permissions for a user (self, admin, or owner only)"""
    
    # Check access
    if current_user.id != user_id and current_user.role not in ["admin", "owner"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view permissions"
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Owner has all permissions
    if user.role == "owner":
        return [{
            "id": 0,
            "user_id": user_id,
            "permission": "*",
            "granted_by": None,
            "granted_at": user.created_at
        }]
    
    permissions = db.query(UserPermission).filter(UserPermission.user_id == user_id).all()
    return permissions


@router.post("/{user_id}/permissions/{permission}")
async def add_user_permission(
    user_id: int,
    permission: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Add a permission to a user (admin only)"""
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check if permission already exists
    existing = db.query(UserPermission).filter(
        UserPermission.user_id == user_id,
        UserPermission.permission == permission
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Permission already granted"
        )
    
    # Create permission
    new_permission = UserPermission(
        user_id=user_id,
        permission=permission,
        granted_by=current_user.id
    )
    
    db.add(new_permission)
    db.commit()
    db.refresh(new_permission)
    
    return {"message": f"Permission '{permission}' granted to user {user_id}"}


@router.delete("/{user_id}/permissions/{permission}")
async def remove_user_permission(
    user_id: int,
    permission: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Remove a permission from a user (admin only)"""
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Cannot remove permissions from owner
    if user.role == "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot modify owner permissions"
        )
    
    permission_record = db.query(UserPermission).filter(
        UserPermission.user_id == user_id,
        UserPermission.permission == permission
    ).first()
    
    if not permission_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Permission not found"
        )
    
    db.delete(permission_record)
    db.commit()
    
    return {"message": f"Permission '{permission}' removed from user {user_id}"}


@router.get("/{user_id}/presence", response_model=UserPresenceResponse)
async def get_user_presence(
    user_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get online presence status for a user"""
    from datetime import datetime, timedelta
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Get active devices
    active_devices = db.query(Device).filter(
        Device.user_id == user_id,
        Device.is_active == True
    ).all()
    
    # Determine online status based on last_active_at
    status = "offline"
    if user.last_active_at:
        time_diff = datetime.utcnow() - user.last_active_at
        if time_diff < timedelta(minutes=5):
            status = "online"
        elif time_diff < timedelta(hours=1):
            status = "away"
    
    return {
        "user_id": user_id,
        "status": status,
        "last_active_at": user.last_active_at,
        "active_devices": len(active_devices)
    }


@router.post("/{user_id}/activity")
async def update_user_activity(
    user_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update last_active_at timestamp (called by clients periodically)"""
    
    # Only allow updating own activity
    if current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Can only update own activity"
        )
    
    from datetime import datetime
    current_user.last_active_at = datetime.utcnow()
    db.commit()
    
    return {"message": "Activity updated"}


@router.get("/{user_id}/devices", response_model=List)
async def get_user_devices(
    user_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all devices linked to a user"""
    
    # Check access
    if current_user.id != user_id and current_user.role not in ["admin", "owner"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view devices"
        )
    
    devices = db.query(Device).filter(Device.user_id == user_id).all()
    return devices


@router.post("/{user_id}/link-device")
async def link_device_to_user(
    user_id: int,
    device_data: dict = Body(...),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Link a Tailscale device to a user (admin only)"""
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    device_id = device_data.get("device_id")
    hostname = device_data.get("hostname")
    is_primary = device_data.get("is_primary", False)
    
    if not device_id or not hostname:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="device_id and hostname are required"
        )
    
    # Check if device already linked to another user
    existing = db.query(Device).filter(Device.device_id == device_id).first()
    if existing and existing.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Device already linked to another user"
        )
    
    if existing:
        # Update existing device
        existing.hostname = hostname
        existing.is_primary = is_primary
        device = existing
    else:
        # Create new device
        device = Device(
            user_id=user_id,
            device_id=device_id,
            hostname=hostname,
            is_primary=is_primary,
            device_name=hostname,
            ip_address="",
            is_active=True
        )
        db.add(device)
    
    db.commit()
    db.refresh(device)
    
    return {"message": f"Device {hostname} linked to user {user_id}", "device": device}
