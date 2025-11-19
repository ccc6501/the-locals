"""
System monitoring and management routes
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import psutil
import os
import subprocess
from datetime import datetime, timedelta

from database import get_db
from models import User, SystemLog
from schemas import SystemHealthResponse, SystemLogResponse
from auth_utils import get_current_active_user, require_admin

router = APIRouter()


def get_uptime() -> str:
    """Get system uptime"""
    uptime_seconds = int((datetime.now() - datetime.fromtimestamp(psutil.boot_time())).total_seconds())
    days = uptime_seconds // 86400
    hours = (uptime_seconds % 86400) // 3600
    minutes = (uptime_seconds % 3600) // 60
    return f"{days}d {hours}h {minutes}m"


def get_db_size() -> str:
    """Get database file size"""
    try:
        db_path = "admin_panel.db"
        if os.path.exists(db_path):
            size_bytes = os.path.getsize(db_path)
            size_gb = size_bytes / (1024 ** 3)
            return f"{size_gb:.2f} GB"
        return "0 GB"
    except:
        return "Unknown"


@router.get("/health", response_model=SystemHealthResponse)
async def get_system_health(
    current_user: User = Depends(get_current_active_user)
):
    """Get system health metrics"""
    # CPU usage
    cpu_percent = psutil.cpu_percent(interval=1)
    
    # Memory usage
    memory = psutil.virtual_memory()
    memory_percent = memory.percent
    
    # Disk usage
    disk = psutil.disk_usage('/')
    disk_percent = disk.percent
    
    # Network status
    network_status = "Connected"
    try:
        import socket
        socket.create_connection(("8.8.8.8", 53), timeout=3)
    except:
        network_status = "Disconnected"
    
    return {
        "cpu": cpu_percent,
        "memory": memory_percent,
        "disk": disk_percent,
        "uptime": get_uptime(),
        "dbSize": get_db_size(),
        "lastBackup": "3h ago",  # You can implement actual backup tracking
        "networkStatus": network_status,
        "latency": "45ms"  # You can implement actual latency measurement
    }


@router.get("/logs", response_model=List[SystemLogResponse])
async def get_system_logs(
    limit: int = 100,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get system logs (admin only)"""
    logs = db.query(SystemLog).order_by(SystemLog.timestamp.desc()).limit(limit).all()
    return logs


@router.post("/restart")
async def restart_services(
    current_user: User = Depends(require_admin)
):
    """Restart services (admin only)"""
    # In production, this would restart the actual services
    # For now, just return a success message
    
    # You could use systemd or similar:
    # subprocess.run(["systemctl", "restart", "admin-panel"])
    
    return {
        "message": "Services restart initiated",
        "status": "pending"
    }


@router.post("/backup")
async def create_backup(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Create database backup (admin only)"""
    try:
        # Create backup directory if it doesn't exist
        backup_dir = "backups"
        os.makedirs(backup_dir, exist_ok=True)
        
        # Generate backup filename with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_file = f"{backup_dir}/admin_panel_backup_{timestamp}.db"
        
        # Copy database file
        db_path = "admin_panel.db"
        if os.path.exists(db_path):
            import shutil
            shutil.copy2(db_path, backup_file)
            
            # Log the backup
            log = SystemLog(
                level="info",
                message=f"Database backup created: {backup_file}"
            )
            db.add(log)
            db.commit()
            
            return {
                "message": "Backup created successfully",
                "filename": backup_file,
                "timestamp": timestamp
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Database file not found"
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Backup failed: {str(e)}"
        )


@router.get("/metrics")
async def get_detailed_metrics(
    current_user: User = Depends(require_admin)
):
    """Get detailed system metrics (admin only)"""
    cpu_count = psutil.cpu_count()
    cpu_freq = psutil.cpu_freq()
    
    memory = psutil.virtual_memory()
    swap = psutil.swap_memory()
    
    disk = psutil.disk_usage('/')
    
    network_io = psutil.net_io_counters()
    
    return {
        "cpu": {
            "count": cpu_count,
            "frequency": f"{cpu_freq.current:.0f} MHz" if cpu_freq else "Unknown",
            "usage": psutil.cpu_percent(interval=1)
        },
        "memory": {
            "total": f"{memory.total / (1024**3):.2f} GB",
            "available": f"{memory.available / (1024**3):.2f} GB",
            "used": f"{memory.used / (1024**3):.2f} GB",
            "percent": memory.percent
        },
        "swap": {
            "total": f"{swap.total / (1024**3):.2f} GB",
            "used": f"{swap.used / (1024**3):.2f} GB",
            "percent": swap.percent
        },
        "disk": {
            "total": f"{disk.total / (1024**3):.2f} GB",
            "used": f"{disk.used / (1024**3):.2f} GB",
            "free": f"{disk.free / (1024**3):.2f} GB",
            "percent": disk.percent
        },
        "network": {
            "bytes_sent": f"{network_io.bytes_sent / (1024**2):.2f} MB",
            "bytes_recv": f"{network_io.bytes_recv / (1024**2):.2f} MB"
        },
        "uptime": get_uptime()
    }
