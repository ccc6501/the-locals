"""
API Connections routes - Tailscale, OpenAI, Ollama
"""  # pyright: ignore

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import json
import subprocess
import os
from dotenv import load_dotenv

from database import get_db
from models import User, Connection
from schemas import TailscaleConfig, OpenAIConfig, OllamaConfig, ConnectionsResponse
from auth_utils import get_current_active_user, require_admin

# AI imports
import openai
from openai import OpenAI
import httpx

load_dotenv()

router = APIRouter()


@router.get("", response_model=ConnectionsResponse)
async def get_connections(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all API connections configuration"""
    # Get or create connections
    tailscale = db.query(Connection).filter(Connection.service == "tailscale").first()
    openai_conn = db.query(Connection).filter(Connection.service == "openai").first()
    ollama = db.query(Connection).filter(Connection.service == "ollama").first()
    
    # Default configs
    tailscale_config = {
        "enabled": False,
        "authKey": "",
        "hostname": "",
        "status": "disconnected"
    }
    
    openai_config = {
        "enabled": False,
        "apiKey": "",
        "model": "gpt-4o-mini",
        "status": "unconfigured"
    }
    
    ollama_config = {
        "enabled": False,
        "endpoint": "http://localhost:11434",
        "model": "gemma:2b",
        "status": "unconfigured"
    }
    
    # Load existing configs
    if tailscale and tailscale.config:
        tailscale_data = json.loads(tailscale.config)
        tailscale_config.update({
            "enabled": tailscale.enabled,
            "authKey": tailscale_data.get("authKey", ""),
            "hostname": tailscale_data.get("hostname", ""),
            "status": tailscale.status
        })
    
    if openai_conn and openai_conn.config:
        openai_data = json.loads(openai_conn.config)
        openai_config.update({
            "enabled": openai_conn.enabled,
            "apiKey": openai_data.get("apiKey", ""),
            "model": openai_data.get("model", "gpt-4o-mini"),
            "status": openai_conn.status
        })
    
    if ollama and ollama.config:
        ollama_data = json.loads(ollama.config)
        # When running in Docker, localhost refers to the container itself.
        # Use host.docker.internal to reach services on the host machine (Docker Desktop on Windows/Mac).
        default_endpoint = "http://host.docker.internal:11434"
        ollama_config.update({
            "enabled": ollama.enabled,
            "endpoint": ollama_data.get("endpoint", default_endpoint),
            "model": ollama_data.get("model", "llama2"),
            "status": ollama.status
        })
    
    return {
        "tailscale": tailscale_config,
        "openai": openai_config,
        "ollama": ollama_config
    }


@router.put("/tailscale")
async def update_tailscale(
    config: TailscaleConfig,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update Tailscale configuration"""
    conn = db.query(Connection).filter(Connection.service == "tailscale").first()
    
    if not conn:
        conn = Connection(service="tailscale")
        db.add(conn)
    
    conn.enabled = config.enabled
    conn.config = json.dumps({
        "authKey": config.authKey,
        "hostname": config.hostname
    })
    conn.status = "configured" if config.enabled else "unconfigured"
    
    db.commit()
    
    return {"message": "Tailscale configuration updated"}


@router.post("/tailscale/test")
async def test_tailscale(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Test Tailscale connection"""
    conn = db.query(Connection).filter(Connection.service == "tailscale").first()
    
    if not conn or not conn.enabled:
        return {
            "status": "unconfigured",
            "message": "Tailscale is not configured. Please enable and configure it first."
        }
    
    try:
        # First attempt JSON status for richer info
        json_status = subprocess.run(
            ["tailscale", "status", "--json"],
            capture_output=True,
            text=True,
            timeout=5
        )
        if json_status.returncode == 0 and json_status.stdout.strip():
            try:
                data = json.loads(json_status.stdout)
                self_node = data.get("Self", {})
                ips = self_node.get("TailscaleIPs", [])
                hostname = self_node.get("HostName") or self_node.get("DNSName")
                conn.status = "connected"
                db.commit()
                return {
                    "status": "connected",
                    "message": "Tailscale is running",
                    "hostname": hostname,
                    "ips": ips,
                    "peerCount": len(data.get("Peer", {}))
                }
            except Exception:
                pass  # Fallback to plain status below if JSON parse fails

        # Fallback plain status
        result = subprocess.run(
            ["tailscale", "status"],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            conn.status = "connected"
            db.commit()
            return {"status": "connected", "message": "Tailscale is running", "raw": result.stdout}
        else:
            # Distinguish daemon not running vs other errors
            stderr_lower = (result.stderr or "").lower()
            if "tailscaled" in stderr_lower or "not running" in stderr_lower:
                conn.status = "disconnected"
                db.commit()
                return {
                    "status": "disconnected",
                    "message": "tailscaled daemon not running. Ensure container has NET_ADMIN capability and entrypoint started tailscaled (TAILSCALE_ENABLED=true)."
                }
            conn.status = "error"
            db.commit()
            return {"status": "error", "message": f"Unexpected Tailscale status failure: {result.stderr.strip() or result.stdout.strip()}"}
    except FileNotFoundError:
        conn.status = "error"
        db.commit()
        return {"status": "error", "message": "Tailscale is not installed"}
    except Exception as e:
        conn.status = "error"
        db.commit()
        return {"status": "error", "message": f"Error testing Tailscale: {str(e)}"}


@router.put("/openai")
async def update_openai(
    config: OpenAIConfig,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update OpenAI configuration"""
    conn = db.query(Connection).filter(Connection.service == "openai").first()
    
    if not conn:
        conn = Connection(service="openai")
        db.add(conn)
    
    conn.enabled = config.enabled
    conn.config = json.dumps({
        "apiKey": config.apiKey,
        "model": config.model
    })
    conn.status = "configured" if config.enabled else "unconfigured"
    
    db.commit()
    
    return {"message": "OpenAI configuration updated"}


@router.post("/openai/test")
async def test_openai(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Test OpenAI connection"""
    conn = db.query(Connection).filter(Connection.service == "openai").first()
    
    if not conn or not conn.enabled:
        return {
            "status": "unconfigured",
            "message": "OpenAI is not configured. Please enable and configure it first."
        }
    
    try:
        config_data = json.loads(conn.config) if conn.config else {}
        api_key = (config_data.get("apiKey") or os.getenv("OPENAI_API_KEY") or "").strip()
        model = config_data.get("model", "gpt-4o-mini")

        if not api_key:
            conn.status = "error"
            db.commit()
            return {
                "status": "error",
                "message": "OpenAI API key is not set. Enter it in Connections > OpenAI and click 'Save All Connection Settings', or set OPENAI_API_KEY in the backend."
            }
        # Set key in multiple compatible ways to handle different OpenAI SDK versions
        os.environ["OPENAI_API_KEY"] = api_key
        try:
            # Older SDKs
            openai.api_key = api_key  # type: ignore[attr-defined]
        except Exception:
            pass

        client = OpenAI(api_key=api_key)
        env_priority = os.getenv("OPENAI_MODEL_PRIORITY", "gpt-4o-mini,gpt-4o,gpt-4.1-mini,gpt-4.1,gpt-3.5-turbo")
        fallbacks = [model] + [m.strip() for m in env_priority.split(',') if m.strip()]
        tried = []
        last_err = None
        # Grab model list (non-fatal)
        available_models = set()
        try:
            for mdl in client.models.list().data:
                if hasattr(mdl, 'id'):
                    available_models.add(mdl.id)
        except Exception as e:
            print(f"[openai] models.list failed (non-fatal): {e}")
        for m in fallbacks:
            if m in tried:
                continue
            tried.append(m)
            try:
                if available_models and m not in available_models:
                    raise Exception(f"Model '{m}' not available to this key")
                response = client.chat.completions.create(
                    model=m,
                    messages=[{"role": "user", "content": "Say 'test successful' if you receive this."}],
                    max_tokens=10
                )
                conn.status = "connected"
                db.commit()
                used_model = m if m == model else f"{m} (fallback)"
                return {
                    "status": "connected",
                    "message": "OpenAI connection successful",
                    "model": used_model,
                    "response": response.choices[0].message.content
                }
            except Exception as e:
                last_err = e
                err_lower = str(e).lower()
                if any(k in err_lower for k in ["incorrect api key", "invalid api key"]):
                    conn.status = "error"
                    db.commit()
                    return {"status": "error", "message": f"API key rejected: {str(e)}"}
                if any(k in err_lower for k in ["rate limit", "quota", "billing"]):
                    conn.status = "error"
                    db.commit()
                    return {"status": "error", "message": f"Quota/billing issue: {str(e)}"}
                # For model not found/unavailable, continue to next fallback
                if ("model" in err_lower and "not" in err_lower and "found" in err_lower) or ("model" in err_lower and "not" in err_lower and "exist" in err_lower) or ("model" in err_lower and "not" in err_lower and "available" in err_lower):
                    continue
                # Other errors: try next until exhausted
                continue
        conn.status = "error"
        db.commit()
        return {"status": "error", "message": f"OpenAI connection failed after fallbacks: {repr(last_err)}", "tried": tried}
    except Exception as e:
        conn.status = "error"
        db.commit()
        return {"status": "error", "message": f"OpenAI connection failed: {str(e)}"}


@router.put("/ollama")
async def update_ollama(
    config: OllamaConfig,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update Ollama configuration"""
    conn = db.query(Connection).filter(Connection.service == "ollama").first()
    
    if not conn:
        conn = Connection(service="ollama")
        db.add(conn)
    
    conn.enabled = config.enabled
    conn.config = json.dumps({
        "endpoint": config.endpoint,
        "model": config.model
    })
    conn.status = "configured" if config.enabled else "unconfigured"
    
    db.commit()
    
    return {"message": "Ollama configuration updated"}


@router.post("/ollama/test")
async def test_ollama(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Test Ollama connection"""
    conn = db.query(Connection).filter(Connection.service == "ollama").first()
    
    if not conn or not conn.enabled:
        return {
            "status": "unconfigured",
            "message": "Ollama is not configured. Please enable and configure it first."
        }
    
    try:
        config_data = json.loads(conn.config)
        endpoint = config_data.get("endpoint", "http://localhost:11434")
        model = config_data.get("model", "gemma:2b")
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{endpoint}/api/generate",
                json={
                    "model": model,
                    "prompt": "Say 'test successful' if you receive this.",
                    "stream": False
                },
                timeout=30.0
            )
            
            if response.status_code == 200:
                conn.status = "connected"
                db.commit()
                
                data = response.json()
                return {
                    "status": "connected",
                    "message": "Ollama connection successful",
                    "response": data.get("response", "")
                }
            else:
                conn.status = "error"
                db.commit()
                error_detail = ""
                try:
                    error_detail = response.json()
                except:
                    error_detail = response.text
                return {
                    "status": "error", 
                    "message": f"Ollama returned status {response.status_code}. Model: {model}. Error: {error_detail}"
                }
    except httpx.TimeoutException:
        conn.status = "error"
        db.commit()
        return {"status": "error", "message": "Ollama connection timeout - is Ollama running?"}
    except Exception as e:
        conn.status = "error"
        db.commit()
        return {"status": "error", "message": f"Ollama connection failed: {str(e)}"}
