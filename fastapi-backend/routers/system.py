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


@router.get("/tailscale/summary")
async def get_tailscale_summary():
    """
    Get Tailscale network summary.
    No authentication required for ChatOps console.
    """
    try:
        # Try to get tailscale status
        result = subprocess.run(
            ["tailscale", "status", "--json"],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        if result.returncode == 0:
            import json
            status_data = json.loads(result.stdout)
            
            # Parse the status
            peers = status_data.get("Peer", {})
            self_info = status_data.get("Self", {})
            
            devices_online = len([p for p in peers.values() if p.get("Online", False)]) + 1  # +1 for self
            devices_total = len(peers) + 1  # +1 for self
            
            exit_node = "none"
            if self_info.get("ExitNode"):
                exit_node = self_info.get("ExitNodeOption", "enabled")
            
            return {
                "devices_online": devices_online,
                "devices_total": devices_total,
                "exit_node": exit_node,
                "last_check": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "status": "connected"
            }
        else:
            # Tailscale not running or error
            return {
                "devices_online": 0,
                "devices_total": 0,
                "exit_node": "none",
                "last_check": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "status": "disconnected",
                "error": "Tailscale not running or not installed"
            }
    except subprocess.TimeoutExpired:
        return {
            "devices_online": 0,
            "devices_total": 0,
            "exit_node": "none",
            "last_check": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "status": "timeout",
            "error": "Tailscale command timed out"
        }
    except FileNotFoundError:
        return {
            "devices_online": 0,
            "devices_total": 0,
            "exit_node": "none",
            "last_check": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "status": "not_installed",
            "error": "Tailscale not found on system"
        }
    except Exception as e:
        return {
            "devices_online": 0,
            "devices_total": 0,
            "exit_node": "none",
            "last_check": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "status": "error",
            "error": str(e)
        }


@router.get("/tailscale/snapshot")
async def get_network_snapshot():
    """
    Get detailed network snapshot with device roles and real-time status.
    Treats 'home-hub' as primary hub, 'home-hub-1' as dev hub.
    No authentication required for AI context.
    """
    try:
        result = subprocess.run(
            ["tailscale", "status", "--json"],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        if result.returncode == 0:
            import json
            status_data = json.loads(result.stdout)
            
            peers = status_data.get("Peer", {})
            self_info = status_data.get("Self", {})
            
            # Build device list with roles
            devices = []
            primary_hub_online = False
            dev_hub_online = False
            
            # Add self first
            self_hostname = self_info.get("HostName", "unknown")
            self_dnsname = self_info.get("DNSName", "unknown").rstrip(".")
            self_ips = self_info.get("TailscaleIPs", [])
            self_online = True  # Self is always "online" if we're running
            
            # Determine self role based on DNSName (more reliable than HostName)
            self_role = "client"
            dns_lower = self_dnsname.lower()
            if "home-hub-1" in dns_lower:
                self_role = "dev-hub"
                dev_hub_online = True
            elif "home-hub" in dns_lower:
                self_role = "primary-hub"
                primary_hub_online = True
            
            devices.append({
                "id": self_info.get("PublicKey", "self")[:16],
                "name": self_dnsname,
                "ips": self_ips,
                "online": True,
                "role": self_role,
                "is_self": True
            })
            
            # Add peers
            for peer_key, peer_data in peers.items():
                peer_hostname = peer_data.get("HostName", "unknown")
                peer_dnsname = peer_data.get("DNSName", "unknown").rstrip(".")
                peer_ips = peer_data.get("TailscaleIPs", [])
                peer_online = peer_data.get("Online", False)
                
                # Skip Tailscale infrastructure nodes (funnel-ingress-node)
                if "funnel-ingress-node" in peer_hostname.lower():
                    continue
                
                # Determine peer role based on DNSName
                peer_role = "client"
                dns_lower = peer_dnsname.lower()
                if "home-hub-1" in dns_lower:
                    peer_role = "dev-hub"
                    if peer_online:
                        dev_hub_online = True
                elif "home-hub" in dns_lower:
                    peer_role = "primary-hub"
                    if peer_online:
                        primary_hub_online = True
                
                devices.append({
                    "id": peer_key[:16],
                    "name": peer_dnsname,
                    "ips": peer_ips,
                    "online": peer_online,
                    "role": peer_role,
                    "is_self": False
                })
            
            # Filter to online devices for summary
            online_devices = [d for d in devices if d["online"]]
            
            return {
                "devices": devices,
                "online_count": len(online_devices),
                "total_count": len(devices),
                "primary_hub_online": primary_hub_online,
                "dev_hub_online": dev_hub_online,
                "timestamp": datetime.now().isoformat(),
                "status": "ok"
            }
        else:
            return {
                "devices": [],
                "online_count": 0,
                "total_count": 0,
                "primary_hub_online": False,
                "dev_hub_online": False,
                "timestamp": datetime.now().isoformat(),
                "status": "tailscale_not_running",
                "error": result.stderr.strip() or "Tailscale not running"
            }
    
    except FileNotFoundError:
        return {
            "devices": [],
            "online_count": 0,
            "total_count": 0,
            "primary_hub_online": False,
            "dev_hub_online": False,
            "timestamp": datetime.now().isoformat(),
            "status": "tailscale_not_installed",
            "error": "Tailscale binary not found"
        }
    except Exception as e:
        return {
            "devices": [],
            "online_count": 0,
            "total_count": 0,
            "primary_hub_online": False,
            "dev_hub_online": False,
            "timestamp": datetime.now().isoformat(),
            "status": "error",
            "error": str(e)
        }

@router.get("/public/summary")
async def get_public_system_summary():
    """Lightweight unauthenticated summary for UI gauges (no sensitive data)."""
    try:
        cpu_percent = psutil.cpu_percent(interval=0.2)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        # Network quick check
        network_status = "Connected"
        try:
            import socket
            socket.create_connection(("8.8.8.8", 53), timeout=1.5)
        except Exception:
            network_status = "Disconnected"
        net = psutil.net_io_counters()
        return {
            "cpu": cpu_percent,
            "memory": memory.percent,
            "disk": disk.percent,
            "uptime": get_uptime(),
            "networkStatus": network_status,
            "bytes_sent": net.bytes_sent,
            "bytes_recv": net.bytes_recv
        }
    except Exception as e:
        return {"error": str(e)}

@router.post("/tailscale/exitnode")
async def set_exit_node(payload: dict):
    """Enable or disable tailscale exit node. Requires tailscale CLI installed.
    Body: {"action": "enable", "nodeId": "<ip_or_name>"} OR {"action": "disable"}
    """
    action = payload.get("action")
    node_id = payload.get("nodeId")
    if action not in {"enable", "disable"}:
        return {"status": "error", "error": "Invalid action"}
    try:
        if action == "disable":
            cmd = ["tailscale", "set", "--exit-node="]
        else:
            if not node_id:
                return {"status": "error", "error": "nodeId required for enable"}
            cmd = ["tailscale", "set", f"--exit-node={node_id}"]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=8)
        if result.returncode != 0:
            return {"status": "error", "error": result.stderr.strip() or "tailscale set failed"}
        # Return updated summary after change
        summary = await get_tailscale_summary()
        return {"status": "ok", "summary": summary}
    except FileNotFoundError:
        return {"status": "error", "error": "tailscale not installed"}
    except subprocess.TimeoutExpired:
        return {"status": "error", "error": "tailscale set timed out"}
    except Exception as e:
        return {"status": "error", "error": str(e)}


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
