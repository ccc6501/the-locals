"""
Settings and Notifications routes
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import json

from database import get_db
from models import User, Settings, Notification
from schemas import SettingsUpdate, SettingsResponse, NotificationSend
from auth_utils import get_current_active_user, require_admin

router = APIRouter()


def get_setting(db: Session, key: str, default=None):
    """Get a setting value"""
    setting = db.query(Settings).filter(Settings.key == key).first()
    if setting:
        try:
            return json.loads(setting.value)
        except:
            return setting.value
    return default


def set_setting(db: Session, key: str, value):
    """Set a setting value"""
    setting = db.query(Settings).filter(Settings.key == key).first()
    if not setting:
        setting = Settings(key=key)
        db.add(setting)
    
    setting.value = json.dumps(value) if not isinstance(value, str) else value
    db.commit()


@router.get("", response_model=SettingsResponse)
async def get_settings(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all settings"""
    return {
        "allowRegistration": get_setting(db, "allowRegistration", True),
        "requireEmailVerification": get_setting(db, "requireEmailVerification", True),
        "aiRateLimit": get_setting(db, "aiRateLimit", 100),
        "storagePerUser": get_setting(db, "storagePerUser", 50),
        "maxDevicesPerUser": get_setting(db, "maxDevicesPerUser", 5)
    }


@router.put("")
async def update_settings(
    settings: SettingsUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update settings (admin only)"""
    if settings.allowRegistration is not None:
        set_setting(db, "allowRegistration", settings.allowRegistration)
    
    if settings.requireEmailVerification is not None:
        set_setting(db, "requireEmailVerification", settings.requireEmailVerification)
    
    if settings.aiRateLimit is not None:
        set_setting(db, "aiRateLimit", settings.aiRateLimit)
    
    if settings.storagePerUser is not None:
        set_setting(db, "storagePerUser", settings.storagePerUser)
    
    if settings.maxDevicesPerUser is not None:
        set_setting(db, "maxDevicesPerUser", settings.maxDevicesPerUser)
    
    if settings.systemInstructions is not None:
        set_setting(db, "systemInstructions", settings.systemInstructions)
    
    if settings.maintenanceMode is not None:
        set_setting(db, "maintenanceMode", settings.maintenanceMode)
    
    if settings.debugMode is not None:
        set_setting(db, "debugMode", settings.debugMode)
    
    if settings.autoBackup is not None:
        set_setting(db, "autoBackup", settings.autoBackup)
    
    return {"message": "Settings updated successfully"}


@router.post("/notifications/send")
async def send_notification(
    notification: NotificationSend,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Send notification to users (admin only)"""
    # Determine target users
    if notification.target == "all":
        users = db.query(User).filter(User.status != "suspended").all()
    elif notification.target == "admins":
        users = db.query(User).filter(
            User.role.in_(["admin", "moderator"]),
            User.status != "suspended"
        ).all()
    else:
        # Specific user by ID
        try:
            user_id = int(notification.target)
            users = [db.query(User).filter(User.id == user_id).first()]
            if not users[0]:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="User not found"
                )
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid target format"
            )
    
    # Create notifications for all target users
    notifications_created = 0
    for user in users:
        if user:
            notif = Notification(
                user_id=user.id,
                type="announcement",
                title="System Announcement",
                message=notification.message,
                from_user_id=current_user.id
            )
            db.add(notif)
            notifications_created += 1
    
    db.commit()
    
    return {
        "message": f"Notification sent to {notifications_created} user(s)",
        "target": notification.target,
        "content": notification.message
    }
