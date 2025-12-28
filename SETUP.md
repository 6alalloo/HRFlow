# HRFlow Setup Guide

## Quick Start

### For Daily Development (Recommended)
```bash
# Start infrastructure services only
docker-compose up -d postgres n8n cv-parser tunnel

# Run backend & frontend locally (hot reload)
npm run dev
```

**Access:**
- Frontend: http://localhost:5173 (Vite dev server)
- Backend: http://localhost:4000
- n8n: http://localhost:5678
- Public URL: https://hrflowautomation.serveousercontent.com

### For Deployment / Submission
```bash
# Start everything in Docker
docker-compose up -d
```

**Access:**
- Frontend: http://localhost (port 80, served by Nginx)
- Backend: http://localhost:4000
- n8n: http://localhost:5678
- Public URL: https://hrflowautomation.serveousercontent.com

---

## Environment Configuration

### Two Separate Environments

**Backend `.env` (backend/.env)**
- Used for: Local `npm run dev`
- Connects to: Local PostgreSQL + Dockerized n8n
- Database: `postgresql://postgres:Talal.37766471!@localhost:5432/HRFlow`
- n8n: `http://localhost:5678`

**Root `.env` (.env)**
- Used for: docker-compose reference only
- Not loaded by backend when in Docker (Docker env vars override)

**Docker containers use:**
- Database: `postgresql://hrflow:hrflow123@postgres:5432/HRFlow` (hardcoded in docker-compose.yml)
- n8n: `http://n8n:5678` (Docker service name)

### Why Two Different Databases?

You have **two separate PostgreSQL instances**:
1. **Local PostgreSQL** (not Docker) - for `npm run dev`
   - User: `postgres`, Password: `Talal.37766471!`
   - Used by backend when running locally

2. **Docker PostgreSQL** (in container) - for `docker-compose up`
   - User: `hrflow`, Password: `hrflow123`
   - Used by backend when running in Docker

Both have the same data structure (tables, schema) but are separate databases.

---

## Default Credentials

**Admin User:**
- Email: `admin@hrflow.local`
- Password: `admin123`

**Operator User:**
- Email: `operator@hrflow.local`
- Password: `operator123`

**n8n:**
- Username: `admin`
- Password: `admin123`

---

## File Structure

```
HRFlow/
├── .env                      # Root env (for docker-compose reference)
├── backend/
│   ├── .env                  # Backend env (for local npm run dev)
│   └── ...
├── frontend/
│   └── ...
├── docker-compose.yml        # Single consolidated compose file
└── SETUP.md                  # This file
```

---

## Common Commands

### Development
```bash
# Start just the infrastructure
docker-compose up -d postgres n8n cv-parser tunnel

# Run backend+frontend locally
npm run dev

# Stop infrastructure when done
docker-compose stop
```

### Docker Full Stack
```bash
# Start everything
docker-compose up -d

# View logs
docker-compose logs -f

# Stop everything
docker-compose down

# Reset database (WARNING: deletes all data)
docker-compose down -v
```

### Debugging
```bash
# Check service status
docker-compose ps

# View specific service logs
docker logs hrflow-backend --tail 50
docker logs hrflow-n8n --tail 50
docker logs hrflow-tunnel --tail 50

# Execute commands in container
docker exec -it hrflow-backend sh
```

---

## Troubleshooting

### "Cannot find module 'winston'" error in Docker
```bash
docker exec hrflow-backend npm install
docker-compose restart backend
```

### Backend can't connect to database
- **In Docker**: Check that postgres container is healthy: `docker ps`
- **Local npm run dev**: Check that local PostgreSQL is running on port 5432

### Tunnel not working
- Check logs: `docker logs hrflow-tunnel --tail 20`
- Should see: "Forwarding HTTP traffic from https://hrflowautomation.serveousercontent.com"

### Port conflicts
- Make sure no other services are using ports: 80, 4000, 5432, 5678, 8000

---

## Notes

- The `.gitattributes` file ensures shell scripts always use LF line endings (prevents Windows CRLF issues)
- The `backend/.env` file is **excluded** from Docker mounts - Docker uses environment variables from `docker-compose.yml`
- Tunnel service creates a persistent SSH tunnel to Serveo for public internet access
