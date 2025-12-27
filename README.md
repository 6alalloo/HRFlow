# HRFlow - Visual Workflow Automation for HR

HRFlow is a visual workflow automation platform that provides a drag-and-drop interface to build HR workflows. It compiles workflows to n8n format and executes them through the n8n workflow engine.

## Quick Start

### Prerequisites
- Docker and Docker Compose installed
- Git installed

### Running the Application

```bash
# Clone the repository
git clone <your-repo-url>
cd HRFlow

# Start all services (development mode)
docker-compose up -d

# Check status
docker ps

# View logs
docker-compose logs -f
```

The application will be available at:
- **Frontend**: [http://localhost](http://localhost)
- **Backend API**: [http://localhost:4000](http://localhost:4000)
- **n8n Workflow Editor**: [http://localhost:5678](http://localhost:5678) (admin/admin123)
- **CV Parser**: [http://localhost:8000](http://localhost:8000)

## Docker Configuration

This project uses multiple Docker Compose files for different environments:

### Files

| File | Purpose | Usage |
|------|---------|-------|
| `docker-compose.yml` | Base configuration (shared) | Automatically loaded |
| `docker-compose.override.yml` | Development overrides | Automatically loaded |
| `docker-compose.prod.yml` | Production overrides | Use explicitly |

### Running Different Environments

#### Development (Default)
```bash
# These are equivalent - docker-compose.override.yml is auto-loaded
docker-compose up
docker-compose -f docker-compose.yml -f docker-compose.override.yml up
```

**Development features**:
- Hot reload for backend (source code mounted as volume)
- PostgreSQL port exposed (5432) for local database access
- All ports exposed for debugging
- `NODE_ENV=development`

#### Production Testing
```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up
```

**Production features**:
- No source code volumes (uses built images only)
- PostgreSQL port not exposed externally
- Auto-restart on failure
- `NODE_ENV=production`
- Uses `prisma migrate deploy` instead of `db push`

## Common Commands

### Starting/Stopping
```bash
# Start services in background
docker-compose up -d

# Stop services (keeps data)
docker-compose down

# Restart services
docker-compose restart
```

### Database Management
```bash
# Reset database (DESTRUCTIVE - deletes all data)
docker-compose down -v
docker-compose up -d

# View PostgreSQL logs
docker logs -f hrflow-postgres

# Connect to PostgreSQL
docker exec -it hrflow-postgres psql -U hrflow -d HRFlow
```

### Viewing Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker logs -f hrflow-backend
docker logs -f hrflow-n8n
docker logs -f hrflow-postgres
docker logs -f hrflow-cv-parser
docker logs -f hrflow-frontend
```

### Checking Status
```bash
# List running containers
docker ps

# Check health status
docker ps --format "table {{.Names}}\t{{.Status}}"
```

## Troubleshooting

### Database Errors
If you see `database "hrflow" does not exist`:

```bash
# Reset volumes and start fresh
docker-compose down -v
docker-compose up -d
```

This happens when Docker volumes have stale/corrupted data. The `-v` flag removes volumes, allowing the init script to run again.

### Container Not Starting
```bash
# Check logs for the specific service
docker logs hrflow-backend

# Check if dependent services are healthy
docker ps

# Rebuild images if Dockerfile changed
docker-compose up -d --build
```

### Port Conflicts
If ports 80, 4000, 5432, 5678, or 8000 are already in use:

```bash
# Find what's using the port (Windows)
netstat -ano | findstr :4000

# Edit docker-compose.override.yml to change port mappings
# Example: Change "4000:4000" to "4001:4000"
```

## Development Workflow

### Making Code Changes

**Backend changes**: Hot reload is enabled - save your files and the server restarts automatically.

**Frontend changes**: The frontend uses nginx in production mode. For hot reload during frontend development, run Vite locally:
```bash
cd frontend
npm run dev
# Access at http://localhost:5173
```

### Database Schema Changes

```bash
# Create a migration
cd backend
npx prisma migrate dev --name your_migration_name

# Backend container will auto-apply migrations on next startup
docker-compose restart backend
```

### Adding Environment Variables

1. Edit `backend/.env` (create from `.env.example` if needed)
2. Update `docker-compose.yml` or `docker-compose.override.yml` to pass the variable
3. Restart the service: `docker-compose restart backend`

## Architecture

- **Frontend**: React + Vite + ReactFlow (visual editor)
- **Backend**: Express + TypeScript + Prisma
- **Database**: PostgreSQL with two databases:
  - `HRFlow` - Application data
  - `n8n` - n8n workflow engine data
- **Workflow Engine**: n8n (executes compiled workflows)
- **CV Parser**: FastAPI + Python (parses resumes)

## Project Structure

```
HRFlow/
├── backend/               # Express API
├── frontend/             # React UI
├── cv-parser/            # CV parsing service
├── docker/               # Docker initialization scripts
├── docker-compose.yml    # Base Docker config
├── docker-compose.override.yml  # Dev overrides
├── docker-compose.prod.yml      # Prod overrides
└── CLAUDE.md            # Development documentation
```

## Moving to Another PC

1. **Commit your code** (volumes are not committed):
```bash
git add .
git commit -m "Your changes"
git push
```

2. **On new PC**:
```bash
git clone <your-repo-url>
cd HRFlow
docker-compose up -d
```

The database will initialize automatically from the init script.

## Environment Variables

Create `backend/.env` with these variables:
```bash
DATABASE_URL="postgresql://hrflow:hrflow123@postgres:5432/HRFlow?schema=Core"
N8N_BASE_URL=http://n8n:5678
N8N_API_KEY=your_n8n_api_key
N8N_POSTGRES_CREDENTIAL_ID=credential_id_from_n8n
N8N_SMTP_CREDENTIAL_ID=credential_id_from_n8n
JWT_SECRET=your-secret-key
```

## License

[Your License Here]

## Contributing

[Your Contributing Guidelines Here]
