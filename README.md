# BankFlow Fork Baseline

This repository is the starting point for a BankFlow-style case management and workflow platform derived from HRFlow.

At this stage, the repo should be treated as a development baseline rather than a production-ready banking product. The immediate goal is to harden the fork, remove HR-specific assumptions, and prepare the platform for banking case orchestration.

## Current Focus

- secure the fork and remove leaked runtime artifacts
- replace HR-specific documentation and examples
- reset domain language toward case flows, cases, tasks, approvals, and teams
- preserve reusable platform pieces while redesigning the product direction

## Repository Layout

- `backend/`: Express and TypeScript API, Prisma schema, runtime services
- `frontend/`: React, TypeScript, and React Flow authoring interface
- `cv-parser/`: legacy auxiliary service retained from the source repo and subject to later scope review
- `docker-compose.yml`: local multi-service development stack
- `BANKFLOW_*.md`: planning documents for the fork strategy, product shape, and backlog

## Local Setup

1. Copy `.env.example` to `.env`.
2. Replace every placeholder value with environment-specific credentials.
3. Start the services you need with Docker Compose.
4. Run `npm run dev` from the repo root for local backend and frontend development.

See `SETUP.md` for the cleaned development notes.

## Security Notes

- The repo no longer assumes bundled credentials or restorable backup state.
- Runtime uploads and environment-specific backups should stay out of version control.
- Treat any remaining HRFlow artifacts as migration residue until they are deliberately removed or repurposed.

## Planning Documents

The active fork planning currently lives in:

- `BANKFLOW_KEEP_REMOVE_REPURPOSE.md`
- `BANKFLOW_PRD.md`
- `BANKFLOW_TDD.md`
- `BANKFLOW_IMPLEMENTATION_BACKLOG.md`

These documents define the intended transition from HR workflow automation toward BankFlow case operations.
