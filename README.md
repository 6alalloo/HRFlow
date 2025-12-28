# HRFlow

A visual workflow automation platform for HR processes. Build workflows with a drag-and-drop interface that compile to and execute via n8n.

## How It Works

HRFlow acts as a meta-workflow engine:

1. **Design** - Create workflows visually using the drag-and-drop builder
2. **Compile** - HRFlow translates your visual workflow into n8n format
3. **Execute** - n8n handles the actual workflow execution
4. **Track** - Monitor execution status and results in HRFlow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   HRFlow    │────▶│  Compiler   │────▶│     n8n     │
│  (Visual)   │     │             │     │  (Execute)  │
└─────────────┘     └─────────────┘     └─────────────┘
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | React, TypeScript, ReactFlow, Tailwind CSS |
| Backend | Express, TypeScript, Prisma |
| Database | PostgreSQL |
| Workflow Engine | n8n |
| CV Parser | FastAPI, Python |
| Containerization | Docker, Docker Compose |

---

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (required)
- [Git](https://git-scm.com/) (required)

---

## Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd HRFlow
```

### 2. Set Up Environment


```bash
cp .env.example .env
```

The `.env.example` file comes pre-configured with n8n credentials from the included backup. No changes needed for local development.

### 3. Restore n8n Backup

This restores the pre-configured n8n setup (user account, credentials, API key):

**Windows (PowerShell):**
```powershell
# Start PostgreSQL first
docker-compose up -d postgres

# Wait for PostgreSQL to be ready (about 10 seconds)
Start-Sleep -Seconds 10

# Restore n8n database
Get-Content n8n-database.sql | docker exec -i hrflow-postgres psql -U hrflow -d n8n

# Restore n8n volume
docker run --rm -v hrflow_n8n_data:/data -v ${PWD}:/backup alpine sh -c "cd /data && tar xzf /backup/n8n-backup.tar.gz"
```

**macOS/Linux:**
```bash
# Start PostgreSQL first
docker-compose up -d postgres

# Wait for PostgreSQL to be ready
sleep 10

# Restore n8n database
cat n8n-database.sql | docker exec -i hrflow-postgres psql -U hrflow -d n8n

# Restore n8n volume
docker run --rm -v hrflow_n8n_data:/data -v "$(pwd)":/backup alpine sh -c "cd /data && tar xzf /backup/n8n-backup.tar.gz"
```

### 4. Start All Services

```bash
docker-compose up -d
```

### 5. Access the Application

| Service | URL | Description |
|---------|-----|-------------|
| **HRFlow** | http://localhost:3000 | Main application |
| **Backend API** | http://localhost:4000 | REST API |
| **n8n** | http://localhost:5678 | Workflow engine UI |

---

## Environment Variables

All values in `.env.example` are pre-configured to work with the included n8n backup.

| Variable | Description | Default |
|----------|-------------|---------|
| `N8N_API_KEY` | n8n API key for workflow management | Pre-configured |
| `N8N_POSTGRES_CREDENTIAL_ID` | n8n credential for database nodes | Pre-configured |
| `N8N_SMTP_CREDENTIAL_ID` | n8n credential for email nodes | Pre-configured |
| `JWT_SECRET` | Secret for JWT authentication | Change in production |
| `DEFAULT_EMAIL_SENDER` | Default sender for email workflows | `noreply@hrflow.local` |
| `DEFAULT_EMAIL_RECIPIENT` | Default recipient for demo workflows | `demo@example.com` |

---

## Creating a Fresh n8n Backup (For Maintainers)

If you make changes to n8n (new credentials, updated API key, etc.), create a new backup:

**Windows (PowerShell):**
```powershell
# Backup n8n database
docker exec hrflow-postgres pg_dump -U hrflow -d n8n > n8n-database.sql

# Backup n8n volume
docker run --rm -v hrflow_n8n_data:/data -v ${PWD}:/backup alpine tar czf /backup/n8n-backup.tar.gz -C /data .
```

**macOS/Linux:**
```bash
# Backup n8n database
docker exec hrflow-postgres pg_dump -U hrflow -d n8n > n8n-database.sql

# Backup n8n volume
MSYS_NO_PATHCONV=1 docker run --rm -v hrflow_n8n_data:/data -v "$(pwd)":/backup alpine tar czf /backup/n8n-backup.tar.gz -C /data .
```

Then update `.env.example` with any new credential IDs or API keys, and commit both backup files.

---

## Troubleshooting

### Container Won't Start

Check container logs:
```bash
docker logs hrflow-backend
docker logs hrflow-frontend
docker logs hrflow-n8n
```

### "Cannot find module" Error

Rebuild the container:
```bash
docker-compose build --no-cache <service-name>
docker-compose up -d
```

### n8n Credentials Not Working

The n8n backup may not have been restored. Re-run step 3 from Quick Start.

### Database Connection Issues

Reset the database:
```bash
docker-compose down -v
docker-compose up -d
```

**Warning:** This deletes all data including workflows and executions.

### Check Service Health

```bash
docker-compose ps
```

All services should show as "healthy" or "running".

---

## Default Credentials

### HRFlow Application

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@hrflow.local` | `admin123` |
| Operator | `operator@hrflow.local` | `operator123` |

### n8n (from backup)

| Field | Value |
|-------|-------|
| Email | `admin@hrflow.local` |
| Password | `admin123` |

---

## Project Structure

```
HRFlow/
├── backend/          # Express API server
│   ├── src/
│   │   ├── services/
│   │   │   ├── n8nCompiler.ts    # Compiles HRFlow → n8n
│   │   │   └── executionService.ts
│   │   └── ...
│   └── prisma/       # Database schema
├── frontend/         # React application
│   └── src/
│       └── pages/
│           └── Workflows/
│               └── workflowBuilderPage.tsx  # Visual editor
├── cv-parser/        # FastAPI CV parsing service
├── docker/           # Docker configuration files
├── n8n-backup.tar.gz # n8n volume backup
├── n8n-database.sql  # n8n database backup
└── docker-compose.yml
```
