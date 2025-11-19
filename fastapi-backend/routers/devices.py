"""
Device management routes
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from database import get_db
from models import User, Device
from auth_utils import get_current_active_user, require_admin

router = APIRouter()


@router.get("/my-devices")
async def get_my_devices(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get current user's devices"""
    devices = db.query(Device).filter(Device.user_id == current_user.id).all()
    
    return [{
        "id": d.id,
        "deviceName": d.device_name,
        "deviceType": d.device_type,
        "ipAddress": d.ip_address,
        "lastActive": d.last_active.isoformat() if d.last_active else None,
        "firstSeen": d.first_seen.isoformat() if d.first_seen else None,
        "isActive": d.is_active
    } for d in devices]


@router.get("/user/{user_id}/devices")
async def get_user_devices(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get devices for a specific user (admin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    devices = db.query(Device).filter(Device.user_id == user_id).all()
    
    return [{
        "id": d.id,
        "deviceName": d.device_name,
        "deviceType": d.device_type,
        "ipAddress": d.ip_address,
        "lastActive": d.last_active.isoformat() if d.last_active else None,
        "firstSeen": d.first_seen.isoformat() if d.first_seen else None,
        "isActive": d.is_active
    } for d in devices]


@router.delete("/device/{device_id}")
async def remove_device(
    device_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Remove a device (user can only remove their own devices)"""
    device = db.query(Device).filter(Device.id == device_id).first()
    
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found"
        )
    
    # Check if user owns this device or is admin
    if device.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to remove this device"
        )
    
    db.delete(device)
    db.commit()
    
    # Update user's device count
    user = db.query(User).filter(User.id == device.user_id).first()
    if user:
        active_count = db.query(Device).filter(
            Device.user_id == user.id,
            Device.is_active == True
        ).count()
        user.devices = active_count
        db.commit()
    
    return {"message": "Device removed successfully"}


@router.patch("/device/{device_id}/deactivate")
async def deactivate_device(
    device_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Deactivate a device"""
    device = db.query(Device).filter(Device.id == device_id).first()
    
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found"
        )
    
    # Check if user owns this device or is admin
    if device.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to deactivate this device"
        )
    
    device.is_active = False
    db.commit()
    
    # Update user's device count
    user = db.query(User).filter(User.id == device.user_id).first()
    if user:
        active_count = db.query(Device).filter(
            Device.user_id == user.id,
            Device.is_active == True
        ).count()
        user.devices = active_count
        db.commit()
    
    return {"message": "Device deactivated successfully"}
