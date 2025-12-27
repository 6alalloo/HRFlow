# Persistent Tunnel Setup (Docker)

This guide explains how to add a persistent SSH tunnel to your Docker stack using `serveo.net` and `autossh`. This allows your local backend to be reachable from the internet (e.g., by Google Forms) continuously, even across restarts.

## 1. Update `docker-compose.yml`

Add the following `tunnel` service to your `docker-compose.yml` file. It should be at the same indentation level as your other services (like `backend`, `postgres`, etc.).

```yaml
# Persistent SSH Tunnel (Exposes backend to public internet)
tunnel:
  image: alpine:latest
  container_name: hrflow-tunnel
  # Installs autossh and opens up a reverse tunnel
  # -M 0: Monitor port (0 = disabled, rely on shell exit)
  # -o ServerAliveInterval=30: Send keepalive every 30s
  # -R 80:backend:4000: Forward public Serveo port 80 -> internal 'backend' service port 4000
  command: /bin/sh -c "apk add --no-cache openssh-client autossh && autossh -M 0 -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -o StrictHostKeyChecking=no -R 80:backend:4000 serveo.net"
  restart: always
  depends_on:
    backend:
      condition: service_healthy
```

## 2. Apply Changes

Run the following command to start the new service:

```bash
docker-compose up -d tunnel
```

## 3. Get Your Public URL

Since Serveo assigns a random URL (unless you specify a subdomain), you need to check the logs to see what URL was assigned.

```bash
docker logs hrflow-tunnel
```

Look for a line like:
`Forwarding HTTP traffic from https://abcd-1234.serveousercontent.com`

## 4. Custom Subdomain (Already Configured)

This project uses the registered subdomain `hrflowautomation`, which resolves to:
`https://hrflowautomation.serveousercontent.com`

The SSH key in the Docker volume `tunnel_ssh` is registered with Serveo. If you need to reset, get the public key:

```bash
docker exec hrflow-tunnel cat /root/.ssh/id_rsa.pub
```

Then re-register it at [serveo.net](https://serveo.net/).
