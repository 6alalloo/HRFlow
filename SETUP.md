# Setup Guide

This setup guide intentionally uses placeholders and local-only instructions. It does not ship reusable credentials, public tunnels, or backup restores.

## Prerequisites

- Docker Desktop
- Node.js and npm
- a PostgreSQL instance for local development if you are not using the containerized one
- an n8n instance you control if you want to exercise workflow integration

## Environment Files

Create a root `.env` from `.env.example` and replace every placeholder value before starting the stack.

Recommended minimum variables:

- `N8N_API_KEY`
- `N8N_POSTGRES_CREDENTIAL_ID`
- `N8N_SMTP_CREDENTIAL_ID`
- `JWT_SECRET`

Do not commit populated `.env` files or exported runtime backups.

## Development Workflow

### Run infrastructure with Docker

```bash
docker-compose up -d
```

### Run backend and frontend locally

```bash
npm run dev
```

Default local endpoints:

- frontend: `http://localhost:5173`
- backend: `http://localhost:4000`
- n8n: `http://localhost:5678`

Adjust ports and service credentials to match your local setup.

## Operational Notes

- The backend reads its environment from local configuration, not from committed secrets.
- n8n credentials and API keys must be provisioned in your own environment.
- Runtime uploads under `backend/uploads/` are treated as local artifacts and should not be committed.

## Troubleshooting

### Services fail to start

- check `docker-compose ps`
- inspect container logs with `docker logs <container-name>`
- confirm your `.env` values are present and valid

### Backend cannot authenticate requests

- confirm `JWT_SECRET` is set
- ensure you are sending `Authorization: Bearer <token>`

### n8n integration errors

- verify the n8n base URL is reachable from the backend
- verify the API key and credential identifiers match your own n8n instance
