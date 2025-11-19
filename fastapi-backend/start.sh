#!/bin/bash
set -e

# Start Tailscale daemon if enabled
if [ "${TAILSCALE_ENABLED}" = "true" ]; then
  echo "[start.sh] Tailscale enabled. Starting tailscaled (userspace networking)..."
  mkdir -p /var/lib/tailscale
  mkdir -p /var/run/tailscale
  tailscaled_args="--state=/var/lib/tailscale/tailscaled.state --socket=/var/run/tailscale/tailscaled.sock --tun=userspace-networking"
  # Launch tailscaled in background with userspace tun to avoid kernel module/device issues
  /usr/sbin/tailscaled ${tailscaled_args} &
  TS_PID=$!
  # Wait up to ~10s for socket
  for i in $(seq 1 20); do
    if [ -S /var/run/tailscale/tailscaled.sock ]; then
      break
    fi
    sleep 0.5
  done
  if [ ! -S /var/run/tailscale/tailscaled.sock ]; then
    echo "[start.sh] tailscaled socket not created; continuing without Tailscale."
  elif [ -n "${TAILSCALE_AUTHKEY}" ] && [[ ${TAILSCALE_AUTHKEY} == tskey-* ]]; then
    echo "[start.sh] Bringing interface up..."
    tailscale up --authkey=${TAILSCALE_AUTHKEY} --hostname=${TAILSCALE_HOSTNAME:-backend-node} --accept-routes --ssh || echo "[start.sh] tailscale up failed (auth key maybe invalid)."
  else
    echo "[start.sh] Skipping tailscale up (no valid auth key provided)."
  fi
else
  echo "[start.sh] TAILSCALE_ENABLED not true; skipping tailscaled startup."
fi

# Run application
exec uvicorn main:app --host 0.0.0.0 --port 8000 --log-level info
