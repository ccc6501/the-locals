#!/usr/bin/env python3
"""
Quick test of the network snapshot endpoint logic
"""
import subprocess
import json
from datetime import datetime

def get_network_snapshot():
    """Test the network snapshot logic"""
    try:
        result = subprocess.run(
            ["tailscale", "status", "--json"],
            capture_output=True,
            text=True,
            check=True
        )
        
        status_data = json.loads(result.stdout)
        
        # Extract device info
        devices = []
        
        # Add self
        self_info = status_data.get("Self", {})
        self_dnsname = self_info.get("DNSName", "").rstrip(".")
        dns_lower = self_dnsname.lower()
        
        # Determine self role based on DNSName
        self_role = "client"
        if "home-hub-1" in dns_lower:
            self_role = "dev-hub"
        elif "home-hub" in dns_lower:
            self_role = "primary-hub"
        
        self_device = {
            "id": self_info.get("ID", "unknown"),
            "name": self_dnsname,
            "ips": self_info.get("TailscaleIPs", []),
            "online": self_info.get("Online", True),
            "role": self_role,
            "is_self": True
        }
        devices.append(self_device)
        
        # Add peers
        for peer_key, peer in status_data.get("Peer", {}).items():
            peer_hostname = peer.get("HostName", "").lower()
            peer_dnsname = peer.get("DNSName", "").rstrip(".")
            
            # Skip Tailscale funnel infrastructure nodes
            if "funnel-ingress-node" in peer_hostname:
                continue
            
            dns_lower = peer_dnsname.lower()
            
            # Determine role based on DNSName
            if "home-hub-1" in dns_lower:
                role = "dev-hub"
            elif "home-hub" in dns_lower:
                role = "primary-hub"
            else:
                role = "client"
            
            device = {
                "id": peer.get("ID", "unknown"),
                "name": peer_dnsname,
                "ips": peer.get("TailscaleIPs", []),
                "online": peer.get("Online", False),
                "role": role,
                "is_self": False
            }
            devices.append(device)
        
        # Filter online devices
        online_devices = [d for d in devices if d["online"]]
        
        # Check hub status
        primary_hub_online = any(d["role"] == "primary-hub" and d["online"] for d in devices)
        dev_hub_online = any(d["role"] == "dev-hub" and d["online"] for d in devices)
        
        snapshot = {
            "devices": online_devices,
            "online_count": len(online_devices),
            "total_count": len(devices),
            "primary_hub_online": primary_hub_online,
            "dev_hub_online": dev_hub_online,
            "timestamp": datetime.now().isoformat()
        }
        
        return snapshot
        
    except Exception as e:
        print(f"Error: {e}")
        return None

if __name__ == "__main__":
    print("Testing network snapshot endpoint logic...")
    print("=" * 60)
    
    snapshot = get_network_snapshot()
    
    if snapshot:
        print(f"\n✅ SUCCESS - Network Snapshot Generated:")
        print(f"\nOnline Devices: {snapshot['online_count']} of {snapshot['total_count']}")
        print(f"Primary Hub Online: {snapshot['primary_hub_online']}")
        print(f"Dev Hub Online: {snapshot['dev_hub_online']}")
        print(f"\nDevices:")
        
        for device in snapshot["devices"]:
            self_marker = " (SELF)" if device["is_self"] else ""
            print(f"  - {device['name']}: {device['role']}{self_marker}")
            print(f"    IPs: {', '.join(device['ips'][:2])}")
        
        print(f"\nTimestamp: {snapshot['timestamp']}")
    else:
        print("\n❌ FAILED - Could not generate snapshot")
