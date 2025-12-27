# HRFlow Implementation Report

## Technical Documentation for Workflow Automation Platform

---

## Table of Contents

1. [Development Environment and Tools](#1-development-environment-and-tools)
2. [Backend Implementation](#2-backend-implementation)
3. [Frontend Implementation](#3-frontend-implementation)
4. [Workflow Compilation to n8n](#4-workflow-compilation-to-n8n)
5. [Execution Engine Integration](#5-execution-engine-integration)
6. [CV Parser Integration](#6-cv-parser-integration)
7. [Error Handling and Validation](#7-error-handling-and-validation)

---

## 1. Development Environment and Tools

### 1.1 Technology Stack Overview

HRFlow employs a modern full-stack architecture designed for maintainability, type safety, and developer productivity. The system comprises five containerized microservices orchestrated via Docker Compose.

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| **Frontend** | React | 19.2.0 | User interface and workflow builder |
| **Frontend Build** | Vite | 7.2.4 | Fast development server and bundler |
| **Backend** | Express.js | 5.1.0 | REST API server |
| **Language** | TypeScript | 5.9.3 | Type-safe JavaScript for both ends |
| **Database** | PostgreSQL | 15 | Relational data storage |
| **ORM** | Prisma | 6.15.0 | Type-safe database access |
| **Workflow Engine** | n8n | Latest | Workflow execution delegation |
| **CV Parser** | Python/FastAPI | 3.11 | Resume parsing microservice |
| **Containerization** | Docker Compose | 3.8 | Service orchestration |

**Critical Reflection**: The decision to use TypeScript across both frontend and backend was driven by the need for type safety in a complex domain model involving workflows, nodes, edges, and executions. This choice proved valuable during development as compile-time type checking caught numerous potential runtime errors, particularly in the n8n compiler where precise data structures are essential. An alternative approach using JavaScript with JSDoc annotations was considered but rejected due to weaker enforcement of type contracts at module boundaries.

---

### 1.2 Docker Containerization Setup

The application is containerized using Docker Compose, enabling consistent development and production environments. The base configuration defines five services with health checks and dependency management.

**File: `docker-compose.yml`**

```yaml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    container_name: hrflow-postgres
    environment:
      POSTGRES_USER: hrflow
      POSTGRES_PASSWORD: hrflow123
      POSTGRES_DB: HRFlow
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./docker/init-db.sql:/docker-entrypoint-initdb.d/init-db.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U hrflow"]
      interval: 10s
      timeout: 5s
      retries: 5

  # n8n Workflow Engine
  n8n:
    image: n8nio/n8n:latest
    container_name: hrflow-n8n
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=admin
      - N8N_BASIC_AUTH_PASSWORD=admin123
      - DB_TYPE=postgresdb
      - DB_POSTGRESDB_HOST=postgres
      - DB_POSTGRESDB_DATABASE=n8n
    depends_on:
      postgres:
        condition: service_healthy

  # CV Parser Service
  cv-parser:
    build:
      context: ./cv-parser
      dockerfile: Dockerfile
    container_name: hrflow-cv-parser
    ports:
      - "8000:8000"

  # Backend API
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: hrflow-backend
    environment:
      - DATABASE_URL=postgresql://hrflow:hrflow123@postgres:5432/HRFlow?schema=Core
      - N8N_BASE_URL=http://n8n:5678
      - CV_PARSER_URL=http://cv-parser:8000
    ports:
      - "4000:4000"
    depends_on:
      postgres:
        condition: service_healthy
      n8n:
        condition: service_healthy

  # Frontend
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: hrflow-frontend
    ports:
      - "80:80"
    depends_on:
      backend:
        condition: service_healthy

volumes:
  postgres_data:
  n8n_data:
```

**Critical Reflection**: Health checks with dependency conditions ensure services start in the correct order. The `service_healthy` condition prevents the backend from starting before PostgreSQL and n8n are fully operational. This approach was chosen over simple `depends_on` ordering because it provides runtime verification rather than merely startup ordering. An alternative approach using init containers or startup scripts was considered but rejected as Docker Compose's built-in health check mechanism proved sufficient and more maintainable.

> **[INSERT SCREENSHOT: Docker Desktop showing all five containers (hrflow-postgres, hrflow-n8n, hrflow-cv-parser, hrflow-backend, hrflow-frontend) running with healthy status]**

---

### 1.3 Backend Dependencies

The backend utilizes a carefully selected set of npm packages for API development, database access, authentication, and external integrations.

**File: `backend/package.json`**

```json
{
  "dependencies": {
    "@prisma/client": "^6.15.0",
    "axios": "^1.13.2",
    "bcryptjs": "^3.0.3",
    "cors": "^2.8.5",
    "dotenv": "^17.2.3",
    "express": "^5.1.0",
    "jsonwebtoken": "^9.0.3",
    "multer": "^2.0.2",
    "winston": "^3.19.0"
  },
  "devDependencies": {
    "@types/express": "^5.0.5",
    "@types/jsonwebtoken": "^9.0.10",
    "prisma": "^6.15.0",
    "ts-node-dev": "^2.0.0",
    "typescript": "^5.9.3"
  },
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/server.ts",
    "seed": "ts-node prisma/seed.ts"
  }
}
```

| Package | Purpose |
|---------|---------|
| `@prisma/client` | Type-safe ORM for PostgreSQL database operations |
| `express` | HTTP server framework with middleware support |
| `jsonwebtoken` | JWT token generation and verification for authentication |
| `bcryptjs` | Password hashing using bcrypt algorithm |
| `axios` | HTTP client for CV parser microservice communication |
| `multer` | Multipart form-data parsing for file uploads |
| `winston` | Structured logging with configurable transports |
| `ts-node-dev` | TypeScript execution with hot-reload for development |

---

### 1.4 Frontend Dependencies

The frontend leverages React 19 with a modern build toolchain and specialized libraries for the visual workflow builder.

**File: `frontend/package.json`**

```json
{
  "dependencies": {
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "react-router-dom": "^7.10.1",
    "reactflow": "^11.11.4",
    "dagre": "^0.8.5",
    "framer-motion": "^12.23.26",
    "tailwindcss": "^4.1.18",
    "react-datepicker": "^9.1.0",
    "sonner": "^2.0.7",
    "react-icons": "^5.5.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^5.1.1",
    "vite": "^7.2.4",
    "typescript": "~5.9.3",
    "eslint": "^9.39.1"
  },
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build"
  }
}
```

| Package | Purpose |
|---------|---------|
| `reactflow` | Canvas-based node/edge graph visualization library |
| `dagre` | Directed acyclic graph layout algorithm for auto-positioning |
| `framer-motion` | Animation library for smooth UI transitions |
| `tailwindcss` | Utility-first CSS framework for rapid styling |
| `react-datepicker` | Date selection component for workflow scheduling |
| `sonner` | Toast notification system for user feedback |
| `vite` | Next-generation frontend build tool with HMR |

**Critical Reflection**: ReactFlow was chosen over alternatives like JointJS or GoJS due to its React-native implementation and extensive customization capabilities. The library's node/edge abstraction maps directly to HRFlow's workflow graph model. Dagre provides automatic left-to-right layout for newly created workflows, improving the user experience when building complex automations. An alternative approach using a custom canvas implementation with HTML5 Canvas API was considered but rejected due to the significant development effort required to match ReactFlow's feature set.

---

### 1.5 TypeScript Configuration

TypeScript is configured for strict type checking across both backend and frontend codebases.

**File: `backend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2019",
    "module": "commonjs",
    "moduleResolution": "node",
    "rootDir": "src",
    "outDir": "dist",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

Key configuration choices:
- **`strict: true`**: Enables all strict type-checking options including `noImplicitAny`, `strictNullChecks`, and `strictFunctionTypes`
- **`target: ES2019`**: Targets Node.js 12+ runtime features
- **`module: commonjs`**: Uses CommonJS module system for Express.js compatibility

---

### 1.6 Environment Configuration

Environment variables are validated at startup through a centralized configuration module, ensuring the application fails fast with clear error messages if required variables are missing.

**File: `backend/src/config/appConfig.ts`**

```typescript
interface AppConfig {
  server: { port: number; nodeEnv: string };
  database: { url: string };
  jwt: { secret: string; expiresIn: string | number };
  n8n: {
    baseUrl: string;
    apiKey: string;
    webhookBaseUrl: string;
    postgresCredentialId: string;
    smtpCredentialId: string;
  };
  cvParser: { url: string };
  email: { defaultSender: string; defaultRecipient: string };
}

function validateConfig(): AppConfig {
  const required = ['DATABASE_URL', 'JWT_SECRET', 'N8N_API_KEY'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      `Check the .env file and ensure all required variables are set.`
    );
  }

  return {
    server: {
      port: parseInt(process.env.PORT || '4000', 10),
      nodeEnv: process.env.NODE_ENV || 'development'
    },
    database: { url: process.env.DATABASE_URL! },
    jwt: {
      secret: process.env.JWT_SECRET!,
      expiresIn: process.env.JWT_EXPIRES_IN || '24h'
    },
    n8n: {
      baseUrl: process.env.N8N_BASE_URL || 'http://localhost:5678',
      apiKey: process.env.N8N_API_KEY!,
      // ... additional configuration
    },
    // ... remaining configuration
  };
}

export const config = validateConfig();
```

**Critical Reflection**: The fail-fast validation pattern was implemented after encountering issues during initial development where missing environment variables caused cryptic runtime errors deep in the application. By validating at startup, developers receive immediate feedback about configuration issues. The alternative of lazy validation (checking variables when first accessed) was rejected because it delays error discovery until the specific code path is executed, potentially in production.

---

## 2. Backend Implementation

### 2.1 Application Architecture

The backend follows a layered architecture pattern separating concerns across routes, controllers, and services.

**File: `backend/src/app.ts`**

```typescript
import express from "express";
import cors from "cors";
import routes from "./routes";
import webhookRoutes from "./routes/webhookRoutes";
import { requestIdMiddleware } from "./middleware/requestIdMiddleware";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

const app = express();

// Middleware configuration
app.use(cors());
app.use(express.json());
app.use(requestIdMiddleware);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "HRFlow backend" });
});

// External webhooks (no /api prefix for clean URLs)
app.use("/webhooks", webhookRoutes);

// API routes under /api prefix
app.use("/api", routes);

// Error handlers (must be last in middleware chain)
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
```

The middleware chain processes requests in the following order:
1. **CORS**: Enables cross-origin requests from the frontend
2. **JSON Parser**: Parses JSON request bodies
3. **Request ID**: Attaches unique identifier for request tracing
4. **Routes**: Handles business logic
5. **Error Handlers**: Catches and formats all errors

> **[INSERT SCREENSHOT: Terminal showing backend startup logs with "HRFlow backend started on port 4000" message]**

---

### 2.2 Database Schema (Prisma ORM)

The database schema defines the core entities for workflow management, execution tracking, and HR data.

**File: `backend/prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Workflow definitions and metadata
model workflows {
  id              Int       @id @default(autoincrement())
  owner_user_id   Int?
  name            String    @db.VarChar
  description     String?   @db.VarChar
  is_active       Boolean   @default(true)
  version         Int       @default(1)
  archived_at     DateTime? @db.Timestamptz(6)
  created_at      DateTime  @default(now()) @db.Timestamptz(6)
  updated_at      DateTime  @default(now()) @db.Timestamptz(6)

  // n8n integration fields
  n8n_workflow_id  String? @unique @db.VarChar
  n8n_webhook_path String? @db.VarChar

  workflow_nodes workflow_nodes[]
  workflow_edges workflow_edges[]
  executions     executions[]
  users          users?           @relation(fields: [owner_user_id], references: [id])
}

// Workflow graph nodes
model workflow_nodes {
  id          Int     @id @default(autoincrement())
  workflow_id Int
  kind        String  @db.VarChar    // trigger, http, email, database, etc.
  name        String? @db.VarChar
  config_json String  @default("{}") @db.Text
  pos_x       Int     @default(0)
  pos_y       Int     @default(0)

  workflows       workflows        @relation(fields: [workflow_id], references: [id], onDelete: Cascade)
  execution_steps execution_steps[]

  @@unique([workflow_id, id])
  @@index([workflow_id])
}

// Workflow graph edges (connections between nodes)
model workflow_edges {
  id             Int     @id @default(autoincrement())
  workflow_id    Int
  from_node_id   Int
  to_node_id     Int
  condition_json String  @default("{}") @db.Text
  label          String? @db.VarChar
  priority       Int?    @default(0)

  workflows workflows @relation(fields: [workflow_id], references: [id], onDelete: Cascade)

  @@index([workflow_id])
  @@index([from_node_id])
  @@index([to_node_id])
}

// Execution history and results
model executions {
  id            Int       @id @default(autoincrement())
  workflow_id   Int?
  trigger_type  String    @db.VarChar    // manual, google_form, scheduled
  status        String    @db.VarChar    // running, completed, failed, engine_error
  run_context   String?   @db.VarChar    // JSON with n8n result
  started_at    DateTime  @default(now()) @db.Timestamptz(6)
  finished_at   DateTime? @db.Timestamptz(6)
  duration_ms   Int?
  error_message String?   @db.VarChar

  n8n_execution_id String? @unique @db.VarChar

  workflows       workflows?        @relation(fields: [workflow_id], references: [id])
  execution_steps execution_steps[]

  @@index([workflow_id])
}

// Per-node execution tracking
model execution_steps {
  id           Int       @id @default(autoincrement())
  execution_id Int
  node_id      Int?
  status       String    @db.VarChar
  input_json   String    @default("{}") @db.VarChar
  output_json  String    @default("{}") @db.VarChar
  logs         String?   @db.VarChar
  started_at   DateTime  @default(now()) @db.Timestamptz(6)
  finished_at  DateTime? @db.Timestamptz(6)

  executions     executions      @relation(fields: [execution_id], references: [id], onDelete: Cascade)
  workflow_nodes workflow_nodes? @relation(fields: [node_id], references: [id])

  @@index([execution_id])
}
```

**Key Schema Design Decisions**:

1. **Workflow-Node-Edge Graph Model**: The schema represents workflows as directed graphs with `workflow_nodes` and `workflow_edges` tables. This enables flexible workflow topologies including sequential, parallel, and conditional branching patterns.

2. **n8n Integration Fields**: The `n8n_workflow_id` and `n8n_webhook_path` fields on the `workflows` table maintain the link between HRFlow's visual representation and n8n's execution engine.

3. **Cascade Deletes**: Deleting a workflow cascades to nodes and edges, maintaining referential integrity automatically.

4. **Execution Tracking**: The `executions` and `execution_steps` tables provide granular visibility into workflow execution, storing per-node input/output data for debugging.

**Critical Reflection**: The decision to store node configuration as JSON (`config_json`) rather than normalized columns was driven by the need to support diverse node types with varying configuration schemas. While this reduces query efficiency for specific config fields, it provides flexibility for adding new node types without schema migrations. An alternative relational approach with separate config tables per node type was considered but rejected due to the complexity of managing 10+ configuration schemas.

> **[INSERT SCREENSHOT: Prisma Studio showing the workflows, workflow_nodes, and workflow_edges tables with sample data]**

---

### 2.3 API Route Structure

The API follows RESTful conventions with resource-based routing.

**API Endpoints Summary**:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/workflows` | List all workflows |
| POST | `/api/workflows` | Create new workflow |
| GET | `/api/workflows/:id` | Get workflow by ID |
| PATCH | `/api/workflows/:id` | Update workflow metadata |
| DELETE | `/api/workflows/:id` | Delete workflow |
| GET | `/api/workflows/:id/graph` | Get complete workflow graph |
| POST | `/api/workflows/:id/nodes` | Create node in workflow |
| PUT | `/api/workflows/:id/nodes/:nodeId` | Update node |
| DELETE | `/api/workflows/:id/nodes/:nodeId` | Delete node |
| POST | `/api/workflows/:id/edges` | Create edge between nodes |
| DELETE | `/api/workflows/:id/edges/:edgeId` | Delete edge |
| POST | `/api/workflows/:id/execute` | Execute workflow |
| GET | `/api/executions` | List all executions |
| GET | `/api/executions/:id` | Get execution details |

---

## 3. Frontend Implementation

### 3.1 React Application Structure

The frontend is organized into a modular structure separating pages, components, API clients, and shared utilities.

```
frontend/src/
├── main.tsx                    # Application entry point
├── App.tsx                     # Root component with routing
├── config/appConfig.ts         # Environment configuration
├── contexts/
│   └── AuthContext.tsx         # Authentication state management
├── pages/
│   ├── Workflows/
│   │   ├── workflowListPage.tsx
│   │   └── workflowBuilderPage.tsx  # Visual workflow editor
│   └── Executions/
│       ├── executionListPage.tsx
│       └── executionDetailPage.tsx
├── components/
│   ├── HRFlowNode.tsx          # Custom ReactFlow node
│   └── builder/
│       ├── ConfigPanel.tsx     # Node configuration forms
│       ├── NodePicker.tsx      # Node type selection modal
│       └── SmartField.tsx      # Variable/custom input toggle
├── api/
│   ├── workflows.ts            # Workflow API client
│   └── executions.ts           # Execution API client
└── layout/
    ├── appLayout.tsx           # Main layout wrapper
    └── sidebar.tsx             # Navigation sidebar
```

---

### 3.2 Workflow Builder (Visual Editor)

The workflow builder is the core user interface, enabling visual creation and editing of automation workflows through a drag-and-drop canvas.

**File: `frontend/src/pages/Workflows/workflowBuilderPage.tsx`** (Lines 1-100)

```typescript
import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as dagre from 'dagre';
import ReactFlow, {
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  ReactFlowProvider,
  useReactFlow,
  getBezierPath,
  BaseEdge,
} from 'reactflow';

import PremiumNode from '../../components/builder/PremiumNode';
import GhostNode from '../../components/builder/GhostNode';
import ConfigPanel from '../../components/builder/ConfigPanel';
import NodePicker from '../../components/builder/NodePicker';

// Builder state type definition
type BuilderState = {
  workflowId: number | null;
  workflowMeta?: WorkflowGraphMeta;
  nodes: WorkflowGraphNode[];
  edges: WorkflowGraphEdge[];
};

// Custom animated edge with traveling particle
const CustomEdge = ({
  sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, style = {}, markerEnd,
}: EdgeProps) => {
  const [edgePath] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  });

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      {/* Animated particle traveling along edge */}
      <circle r="4" fill="#38bdf8">
        <animateMotion dur="2s" repeatCount="indefinite" path={edgePath} />
      </circle>
    </>
  );
};

// Node type registry
const nodeTypesMap = {
  hrflow: PremiumNode,  // Real workflow nodes
  ghost: GhostNode,     // Placeholder "+" nodes
};

const edgeTypes = {
  custom: CustomEdge,
  suggested: SuggestedEdge,
};
```

**Three-Panel Layout Architecture**:

1. **Left Sidebar**: Navigation and branding (shared with other pages)
2. **Central Canvas**: ReactFlow graph editor with custom nodes and animated edges
3. **Right Panel**: ConfigPanel for editing selected node configuration

**Critical Reflection**: The animated edge particle effect was implemented to provide visual feedback about data flow direction, making it easier for users to understand workflow execution order. This subtle UX enhancement was added after user testing revealed confusion about which direction data flows through the workflow. An alternative approach using arrow markers alone was insufficient for complex workflows with crossing edges.

> **[INSERT SCREENSHOT: Workflow builder interface showing a workflow with Trigger -> CV Parser -> Condition -> Email nodes connected with animated edges, ConfigPanel open on the right]**

---

### 3.3 Dagre Auto-Layout Algorithm

New workflows are automatically laid out using the Dagre library for directed graph positioning.

**File: `frontend/src/pages/Workflows/workflowBuilderPage.tsx`** (Lines 185-200)

```typescript
const nodeWidth = 240;
const nodeHeight = 100;

const getLayoutedElements = (nodes: RFNode<WorkflowNodeData>[], edges: Edge[]) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: 'LR', nodesep: 50, ranksep: 100 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  return nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });
};
```

The layout algorithm uses:
- **`rankdir: 'LR'`**: Left-to-right flow direction
- **`nodesep: 50`**: 50px minimum vertical spacing between nodes
- **`ranksep: 100`**: 100px minimum horizontal spacing between columns

---

### 3.4 Custom Node Component

Each workflow node is rendered using a custom React component that displays node type, ID, name, and configuration preview.

**File: `frontend/src/components/HRFlowNode.tsx`**

```typescript
import React, { useMemo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";

export type HRFlowNodeData = {
  backendId: number;
  name: string | null;
  kind: string;
  config?: Record<string, unknown>;
};

const HRFlowNode: React.FC<NodeProps<HRFlowNodeData>> = ({ data, selected }) => {
  const { hasConfig, configPreview, configLen } = useMemo(() => {
    if (!data.config || Object.keys(data.config).length === 0) {
      return { hasConfig: false, configPreview: "", configLen: 0 };
    }
    const str = JSON.stringify(data.config);
    return {
      hasConfig: true,
      configPreview: str.slice(0, 60),
      configLen: str.length,
    };
  }, [data.config]);

  return (
    <div
      style={{
        borderRadius: "0.85rem",
        backgroundColor: "rgba(15,23,42,0.95)",
        border: selected ? "2px solid #3b82f6" : "1px solid rgba(148,163,184,0.5)",
        boxShadow: selected
          ? "0 0 0 1px rgba(59,130,246,0.7), 0 18px 35px rgba(15,23,42,0.9)"
          : "0 10px 25px rgba(15,23,42,0.9)",
        padding: "0.5rem 0.75rem",
        minWidth: 180,
      }}
    >
      <div className="d-flex justify-content-between align-items-center mb-1">
        <span style={{ fontSize: "0.65rem" }}>{data.kind}</span>
        <span className="badge bg-primary">#{data.backendId}</span>
      </div>

      <div className="fw-semibold">
        {data.name || "Untitled node"}
      </div>

      {hasConfig && (
        <code style={{ fontSize: "0.7rem" }}>
          {configPreview}{configLen > 60 ? "…" : ""}
        </code>
      )}

      {/* Input handle (left side, cyan) */}
      <Handle
        type="target"
        position={Position.Left}
        style={{
          width: 10, height: 10,
          border: "2px solid #38bdf8",
          backgroundColor: "#0f172a",
        }}
      />

      {/* Output handle (right side, purple) */}
      <Handle
        type="source"
        position={Position.Right}
        style={{
          width: 10, height: 10,
          border: "2px solid #a855f7",
          backgroundColor: "#0f172a",
        }}
      />
    </div>
  );
};

export default HRFlowNode;
```

**Visual Design Elements**:
- **Selection State**: Blue border and enhanced shadow when selected
- **Config Preview**: Shows first 60 characters of JSON config with ellipsis
- **Handle Colors**: Cyan for inputs (target), purple for outputs (source)

> **[INSERT SCREENSHOT: Close-up of an Email node showing the node type badge, ID badge, name, config preview, and colored connection handles]**

---

### 3.5 Node Configuration Panel

The ConfigPanel component provides node-type-specific configuration forms in a slide-out panel.

**File: `frontend/src/components/builder/ConfigPanel.tsx`** (Lines 1-100)

```typescript
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { LuX, LuSave, LuTrash2, LuPlus, LuMinus } from 'react-icons/lu';
import DatePicker from 'react-datepicker';

type ConfigPanelProps = {
  isOpen: boolean;
  node: WorkflowNode | null;
  workflowId: number;
  onClose: () => void;
  onUpdate: (id: number, update: { config?: Record<string, unknown>; name?: string }) => void;
  onDelete: (id: number) => void;
};

// Type-safe accessor helpers
const getString = (config: Record<string, unknown>, key: string, fallback = ''): string => {
  const val = config[key];
  return typeof val === 'string' ? val : fallback;
};

const getKeyValueArray = (config: Record<string, unknown>, key: string): KeyValuePair[] => {
  const val = config[key];
  return Array.isArray(val) ? val as KeyValuePair[] : [];
};

// Reusable form field component
const FormField: React.FC<{ label: string; children: React.ReactNode; hint?: string }> =
  ({ label, children, hint }) => (
    <div className="space-y-1">
      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
        {label}
      </label>
      {children}
      {hint && <p className="text-[10px] text-slate-500">{hint}</p>}
    </div>
  );

// Text input with optional icon
const TextInput: React.FC<{
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
}> = ({ value, onChange, placeholder, icon }) => (
  <div className="relative">
    {icon && (
      <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500">
        {icon}
      </div>
    )}
    <input
      type="text"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full bg-navy-950 border border-white/10 rounded-lg px-2.5 py-1.5
                  text-sm text-white focus:border-cyan-glow focus:outline-none ${icon ? 'pl-8' : ''}`}
    />
  </div>
);
```

**Supported Node Types and Configuration Fields**:

| Node Type | Configuration Fields |
|-----------|---------------------|
| **Trigger** | name, email, department, role, startDate, managerEmail |
| **HTTP Request** | method, url, headers[], body |
| **Email** | to, subject, body, cc, bcc |
| **Database** | operation, table, fields[], whereClause |
| **Condition** | field, operator, value |
| **CV Parser** | fileId, extractFields[] |
| **Variable** | variableName, value |
| **DateTime** | operation, value, unit, format, outputField |
| **Logger** | message, level |

> **[INSERT SCREENSHOT: ConfigPanel open showing the HTTP Request node configuration with method dropdown, URL field, headers key-value pairs, and body textarea]**

---

## 4. Workflow Compilation to n8n

### 4.1 Compilation Architecture Overview

The n8nCompiler service is the core translation layer that transforms HRFlow's simplified workflow graph into n8n-compatible workflow JSON. This enables HRFlow to delegate actual workflow execution to n8n while maintaining a user-friendly visual editor.

**File: `backend/src/services/n8nCompiler.ts`** (Lines 1-60)

```typescript
/**
 * HRFlow to n8n Workflow Compiler
 *
 * Transforms HRFlow's simplified workflow graph into n8n-compatible workflow JSON.
 * Each HRFlow node type (trigger, http, email, etc.) is compiled into corresponding n8n nodes.
 */

import type { WorkflowNodeKind } from "./workflowService";
import { config } from "../config/appConfig";
import {
  N8N_POSTGRES_CREDENTIAL_ID,
  N8N_SMTP_CREDENTIAL_ID,
} from "../config/n8nConfig";

type HRFlowNode = {
  id: number;
  kind: string;
  name: string | null;
  config: Record<string, unknown>;
  posX: number;
  posY: number;
};

type HRFlowEdge = {
  id: number;
  fromNodeId: number;
  toNodeId: number;
  priority: number;
  label?: string | null;
  condition?: Record<string, unknown> | null;
};

type CompileInput = {
  hrflowWorkflowId: number;
  workflowName: string;
  webhookPath: string;
  nodes: HRFlowNode[];
  edges: HRFlowEdge[];
  userId?: number;
};

type N8nCompiled = {
  nodes: any[];
  connections: Record<string, any>;
};
```

**Compilation Pipeline**:

1. **URL Validation**: Check all HTTP URLs against domain allow-list
2. **Node Ordering**: Topological sort to determine execution order
3. **Webhook Setup**: Create unique webhook trigger for the workflow
4. **Node Mapping**: Translate each HRFlow node to n8n equivalent
5. **Connection Building**: Map edges to n8n connection format

---

### 4.2 Node Type Mapping

Each HRFlow node type maps to specific n8n node types with configured parameters.

**File: `backend/src/services/n8nCompiler.ts`** (Lines 367-450)

```typescript
function mapHrflowNodeToN8n(n: HRFlowNode, position: [number, number]) {
  const kind = safeString(n.kind).toLowerCase() as WorkflowNodeKind;
  const name = stableNodeName(n);
  const cfg = safeRecord(n.config);

  switch (kind) {
    case "trigger": {
      // Compiles to n8n Set node that normalizes employee data from webhook payload
      return {
        id: `hrflow_node_${n.id}`,
        name,
        type: "n8n-nodes-base.set",
        typeVersion: 3.4,
        position,
        parameters: {
          mode: "manual",
          duplicateItem: false,
          assignments: {
            assignments: [
              {
                id: `trigger_name_${n.id}`,
                name: "employee.name",
                value: "={{ $json.body?.employee?.name || '' }}",
                type: "string",
              },
              {
                id: `trigger_email_${n.id}`,
                name: "employee.email",
                value: "={{ $json.body?.employee?.email || '' }}",
                type: "string",
              },
              // ... additional employee fields
              {
                id: `trigger_ts_${n.id}`,
                name: "_hrflow.triggeredAt",
                value: "={{ $now.toISO() }}",
                type: "string",
              },
            ],
          },
          includeOtherFields: true,
        },
      };
    }
    // ... other node types
  }
}
```

**Complete Node Type Mapping Table**:

| HRFlow Type | n8n Node Type | n8n Version | Key Parameters |
|-------------|---------------|-------------|----------------|
| `trigger` | `n8n-nodes-base.set` | 3.4 | Normalizes webhook payload to employee object |
| `http` | `n8n-nodes-base.httpRequest` | 4 | method, url, headerParametersUi, sendBody |
| `email` | `n8n-nodes-base.emailSend` | 2.1 | fromEmail, toEmail, subject, html |
| `database` | `n8n-nodes-base.postgres` | 2.6 | operation, query, credentials |
| `logger` | `n8n-nodes-base.set` | 3.4 | Attaches log metadata to data stream |
| `cv_parse` | `n8n-nodes-base.set` | 3.4 | Marks CV parsed (actual parsing pre-processed) |
| `variable` | `n8n-nodes-base.set` | 3.4 | Assigns variable value |
| `datetime` | `n8n-nodes-base.set` | 3.4 | DateTime expressions with Luxon |
| `condition` | Edge routing | N/A | Routes to true/false branches |
| (unknown) | `n8n-nodes-base.noOp` | 1 | Fallback to prevent failures |

---

### 4.3 HTTP Request Node Compilation

The HTTP node compilation handles method, URL, headers, and body configuration.

**File: `backend/src/services/n8nCompiler.ts`** (Lines 450-487)

```typescript
case "http": {
  const url = safeString(cfg.url, "https://httpbin.org/anything");
  const method = safeString(cfg.method, "GET").toUpperCase();

  // Parse headers from various formats (JSON object or key:value text)
  const headersObj = parseKeyValueText(cfg.headers);
  const bodyObj = parseJsonObjectOrEmpty(cfg.bodyTemplate);

  return {
    id: `hrflow_node_${n.id}`,
    name,
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 4,
    position,
    parameters: {
      method,
      url,
      headerParametersUi: {
        parameter: Object.entries(headersObj).map(([k, v]) => ({
          name: k,
          value: typeof v === "string" ? v : JSON.stringify(v),
        })),
      },
      ...(method !== "GET"
        ? {
            sendBody: true,
            bodyParametersUi: {
              parameter: Object.entries(bodyObj).map(([k, v]) => ({
                name: k,
                value: typeof v === "string" ? v : JSON.stringify(v),
              })),
            },
          }
        : {}),
    },
  };
}
```

---

### 4.4 Database Node Compilation (CTE Pattern)

The database node uses a Common Table Expression (CTE) pattern for atomic user/employee record creation.

**File: `backend/src/services/n8nCompiler.ts`** (Lines 543-626)

```typescript
case "database": {
  const customQuery = safeString(cfg.query, "").trim();

  // Default query uses CTE for atomic upsert operation
  const defaultQuery = `
    WITH role_pick AS (
      SELECT id FROM "Core".roles WHERE lower(name) = 'employee' LIMIT 1
    ),
    upsert_user AS (
      INSERT INTO "Core".users (email, password_hash, full_name, role_id, is_active)
      VALUES (
        '={{ $json.employee.email }}',
        'TEMP_PASSWORD_HASH',
        '={{ $json.employee.name }}',
        COALESCE((SELECT id FROM role_pick), 1),
        true
      )
      ON CONFLICT (email) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        is_active = true
      RETURNING id
    ),
    ins_employee AS (
      INSERT INTO "Core".employees (user_id, hire_date, is_active)
      SELECT upsert_user.id, CURRENT_DATE, true
      FROM upsert_user
      WHERE NOT EXISTS (
        SELECT 1 FROM "Core".employees e WHERE e.user_id = upsert_user.id
      )
      RETURNING id
    )
    SELECT
      (SELECT id FROM upsert_user) AS user_id,
      (SELECT id FROM ins_employee) AS employee_id;
  `;

  const query = customQuery.length > 0 ? customQuery : defaultQuery;

  return {
    id: `hrflow_node_${n.id}`,
    name,
    type: "n8n-nodes-base.postgres",
    typeVersion: 2.6,
    position,
    parameters: {
      operation: "executeQuery",
      query,
    },
    credentials: {
      postgres: {
        id: N8N_POSTGRES_CREDENTIAL_ID,
        name: N8N_POSTGRES_CREDENTIAL_NAME,
      },
    },
  };
}
```

**Critical Reflection**: The CTE (Common Table Expression) pattern was chosen to ensure atomicity of the user and employee record creation within a single database transaction. This prevents orphaned records that could occur with separate INSERT statements if the workflow fails midway. An alternative approach using multiple sequential nodes was considered but rejected due to the complexity of handling partial failures and rollbacks.

---

### 4.5 Email Node Compilation

The email node uses n8n expression syntax for dynamic content.

**File: `backend/src/services/n8nCompiler.ts`** (Lines 628-681)

```typescript
case "email": {
  if (!N8N_SMTP_CREDENTIAL_ID.trim()) {
    throw new Error("Missing SMTP credential env vars for n8n compiler.");
  }

  // Normalize recipient email to n8n expression syntax
  let toEmail = safeString(cfg.to, "").trim();
  if (!toEmail || toEmail.includes("$json.employee.email")) {
    toEmail = '={{$node["HRFlow Webhook Trigger"].json.body.employee.email}}';
  }

  const subject = '=Welcome to HRFlow, {{$node["HRFlow Webhook Trigger"].json.body.employee.name}}!';

  // Email body with n8n expression interpolation (prefix "=" for evaluation)
  const html =
    '=Hi {{$node["HRFlow Webhook Trigger"].json.body.employee.name}},<br/><br/>' +
    'Welcome to the <b>{{$node["HRFlow Webhook Trigger"].json.body.employee.department}}</b> department!<br/>' +
    'We're excited to have you join as a <b>{{$node["HRFlow Webhook Trigger"].json.body.employee.role}}</b>.<br/><br/>' +
    'Best regards,<br/><b>HRFlow Team</b>';

  return {
    id: `hrflow_node_${n.id}`,
    name,
    type: "n8n-nodes-base.emailSend",
    typeVersion: 2.1,
    position,
    parameters: {
      fromEmail: config.email.defaultSender,
      toEmail,
      subject,
      emailFormat: "html",
      html,
    },
    credentials: {
      smtp: {
        id: N8N_SMTP_CREDENTIAL_ID,
        name: N8N_SMTP_CREDENTIAL_NAME,
      },
    },
  };
}
```

---

### 4.6 Connection Building Algorithm

The connection building algorithm maps HRFlow edges to n8n's connection format, with special handling for condition nodes.

**File: `backend/src/services/n8nCompiler.ts`** (Lines 282-338)

```typescript
function connect(
  fromName: string,
  toName: string,
  connections: Record<string, any>,
  outputIndex = 0
) {
  connections[fromName] = connections[fromName] ?? { main: [] };
  connections[fromName].main[outputIndex] = connections[fromName].main[outputIndex] ?? [];
  connections[fromName].main[outputIndex].push({
    node: toName,
    type: "main",
    index: 0,
  });
}

function connectConditionNode(
  fromNode: HRFlowNode,
  outgoingEdges: HRFlowEdge[],
  byId: Map<number, HRFlowNode>,
  connections: Record<string, any>
) {
  const fromName = stableNodeName(fromNode);
  const outs = [...outgoingEdges];

  // Separate edges by label (true/false branches)
  const trueEdges = outs.filter((e) => (e.label ?? "").toLowerCase().includes("true"));
  const falseEdges = outs.filter((e) => (e.label ?? "").toLowerCase().includes("false"));

  // True branch uses outputIndex 0, False branch uses outputIndex 1
  for (const e of trueEdges) {
    const to = byId.get(e.toNodeId);
    if (to) connect(fromName, stableNodeName(to), connections, 0);
  }
  for (const e of falseEdges) {
    const to = byId.get(e.toNodeId);
    if (to) connect(fromName, stableNodeName(to), connections, 1);
  }
}
```

---

### 4.7 Topological Sorting

Nodes are ordered using a depth-first traversal to ensure correct execution order.

**File: `backend/src/services/n8nCompiler.ts`** (Lines 250-280)

```typescript
function buildReachableOrder(nodes: HRFlowNode[], edges: HRFlowEdge[]): HRFlowNode[] {
  if (nodes.length === 0) return [];

  const byId = new Map(nodes.map((n) => [n.id, n] as const));
  const outgoing = groupOutgoing(edges);
  const start = pickStartNode(nodes, edges);
  if (!start) return [];

  const order: HRFlowNode[] = [];
  const visited = new Set<number>();
  const stack: number[] = [start.id];

  while (stack.length) {
    const id = stack.pop()!;
    if (visited.has(id)) continue;
    visited.add(id);

    const node = byId.get(id);
    if (node) order.push(node);

    // Push children in reverse order so first child is processed first
    const outs = outgoing.get(id) ?? [];
    for (let i = outs.length - 1; i >= 0; i--) {
      stack.push(outs[i].toNodeId);
    }
  }

  // Add any unreachable nodes at the end
  for (const n of nodes) {
    if (!visited.has(n.id)) order.push(n);
  }

  return order;
}
```

> **[INSERT SCREENSHOT: n8n workflow editor showing a compiled HRFlow workflow with Webhook Trigger, Set nodes, PostgreSQL node, and Email Send node connected]**

---

## 5. Execution Engine Integration

### 5.1 Execution Lifecycle Overview

The execution service orchestrates the complete workflow execution lifecycle from compilation to result tracking.

**Execution Flow Diagram**:

```
User clicks "Run"
       ↓
┌──────────────────────┐
│ 1. Validate Workflow │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│ 2. Pre-process CV    │
│    Parser Nodes      │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│ 3. Create Execution  │
│    Record (running)  │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│ 4. Compile to n8n    │
│    (n8nCompiler)     │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│ 5. Upsert Workflow   │
│    in n8n            │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│ 6. Activate Workflow │
│    (register webhook)│
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│ 7. Trigger via       │
│    Webhook POST      │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│ 8. Update Execution  │
│    Status & Steps    │
└──────────────────────┘
```

---

### 5.2 Execute Workflow Function

**File: `backend/src/services/executionService.ts`** (Lines 224-420)

```typescript
/**
 * Execute a workflow by compiling it to n8n and triggering via webhook.
 * Orchestrates the complete execution flow including CV parsing, compilation,
 * n8n activation, webhook trigger, and execution tracking.
 */
export async function executeWorkflow(params: ExecuteWorkflowInput) {
  const { workflowId, triggerType, input } = params;

  // Step 1: Validate workflow exists
  let workflow = await prisma.workflows.findUnique({
    where: { id: workflowId },
  });
  if (!workflow) throw makeCodedError("Workflow not found", "WORKFLOW_NOT_FOUND");

  // Step 2: Auto-activate inactive workflows for better UX
  if (!workflow.is_active) {
    workflow = await prisma.workflows.update({
      where: { id: workflowId },
      data: { is_active: true },
    });
  }

  // Step 3: Load nodes and edges
  const [nodesRaw, edgesRaw] = await Promise.all([
    prisma.workflow_nodes.findMany({ where: { workflow_id: workflowId } }),
    prisma.workflow_edges.findMany({ where: { workflow_id: workflowId } }),
  ]);

  if (nodesRaw.length === 0) {
    throw makeCodedError("Workflow has no nodes", "WORKFLOW_HAS_NO_NODES");
  }

  // Step 4: Pre-process CV parser nodes before n8n execution
  const cvParserResults = new Map<number, CVParseResult>();
  for (const node of nodesRaw) {
    if (node.kind === "cv_parser" || node.kind === "cv_parse") {
      const config = safeParseJson<Record<string, unknown>>(node.config_json, {});
      const fileId = config.fileId as string | undefined;
      if (fileId) {
        const result = await parseCV(fileId);
        cvParserResults.set(node.id, result);
      }
    }
  }

  // Step 5: Create execution record with "running" status
  const execution = await prisma.executions.create({
    data: {
      workflow_id: workflowId,
      trigger_type: triggerType || "manual",
      status: "running",
      run_context: JSON.stringify({ input, engine: { n8n: null } }),
      started_at: new Date(),
    },
  });

  const webhookPath = `/webhook/hrflow-${workflowId}-execute`;
  const webhookUrl = `${getWebhookBaseUrl()}${webhookPath}`;

  let n8nResult: unknown | null = null;
  let finalStatus: "completed" | "engine_error" | "failed" = "failed";

  try {
    // Step 6: Compile HRFlow graph to n8n workflow JSON
    const compiled = await compileToN8n({
      hrflowWorkflowId: workflowId,
      workflowName: workflow.name,
      webhookPath,
      nodes: nodesRaw.map((n) => ({
        id: n.id,
        kind: n.kind,
        name: n.name ?? null,
        config: safeParseJson(n.config_json, {}),
        posX: n.pos_x,
        posY: n.pos_y,
      })),
      edges: edgesRaw.map((e) => ({
        id: e.id,
        fromNodeId: e.from_node_id,
        toNodeId: e.to_node_id,
        priority: e.priority ?? 0,
        label: e.label ?? null,
      })),
    });

    // Step 7: Upsert workflow in n8n (idempotent by name)
    const n8nName = `HRFlow: ${workflow.name} (#${workflowId})`;
    const upsert = await upsertN8nWorkflow({
      name: n8nName,
      nodes: compiled.nodes,
      connections: compiled.connections,
    });

    // Step 8: Activate workflow in n8n (registers webhook)
    await activateN8nWorkflow(upsert.id);

    // Step 9: Trigger execution via webhook POST
    const body = buildDemoExecuteBody(input, triggerConfig);
    n8nResult = await callN8nExecute(webhookUrl, body);

    finalStatus = "completed";
  } catch (err: unknown) {
    const code = getErrorCode(err);
    if (code === "N8N_UNREACHABLE" || code === "N8N_HTTP_ERROR") {
      finalStatus = "engine_error";
    } else {
      finalStatus = "failed";
    }
    errorMessage = getErrorMessage(err);
  }

  // Step 10: Update execution status and create step records
  await prisma.executions.update({
    where: { id: execution.id },
    data: {
      status: finalStatus,
      finished_at: new Date(),
      duration_ms: Date.now() - startTime.getTime(),
      error_message: errorMessage,
    },
  });

  // Step 11: Create execution_steps for each node
  const stepsData = nodesRaw.map((node, index) => ({
    execution_id: execution.id,
    node_id: node.id,
    status: finalStatus === "completed" ? "completed" : "skipped",
    input_json: JSON.stringify(stepInput),
    output_json: JSON.stringify(stepOutput),
    logs: logMessage,
  }));

  await prisma.execution_steps.createMany({ data: stepsData });

  return { execution, steps, n8nResult };
}
```

---

### 5.3 n8n REST API Client

The n8nService module provides functions for interacting with n8n's REST API.

**File: `backend/src/services/n8nService.ts`** (Lines 147-200)

```typescript
/**
 * Create or update a workflow in n8n by workflow name (idempotent).
 * Returns n8n workflow id.
 */
export async function upsertN8nWorkflow(args: {
  name: string;
  nodes: unknown[];
  connections: Record<string, unknown>;
}): Promise<{ id: string; created: boolean }> {
  const existingId = await findWorkflowIdByName(args.name);

  const bodyBase: N8nWorkflowUpsertBody = {
    name: args.name,
    nodes: args.nodes,
    connections: args.connections,
    settings: {},
  };

  if (!existingId) {
    // Create new workflow
    const res = await n8nApiFetch(`/workflows`, {
      method: "POST",
      body: JSON.stringify(bodyBase),
    });
    const created = await res.json();
    return { id: created.id, created: true };
  }

  // Update existing workflow
  await n8nApiFetch(`/workflows/${existingId}`, {
    method: "PUT",
    body: JSON.stringify(bodyBase),
  });

  return { id: existingId, created: false };
}

/**
 * Activate workflow in n8n (registers webhook endpoint).
 */
export async function activateN8nWorkflow(id: string): Promise<void> {
  await n8nApiFetch(`/workflows/${id}/activate`, { method: "POST" });
}

/**
 * Trigger workflow execution via webhook POST.
 */
export async function callN8nExecute(webhookUrl: string, body: unknown): Promise<N8nExecuteResult> {
  requireExecuteUrl(webhookUrl);

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });

  if (!res.ok) {
    const details = await readErrorDetails(res);
    const err: N8nApiError = new Error(`n8n webhook error: ${details}`);
    err.code = "N8N_HTTP_ERROR";
    throw err;
  }

  return res.json();
}
```

**Critical Reflection**: The upsert pattern (create or update by name) was implemented to ensure idempotent workflow deployment. This allows developers to safely re-run workflow execution without creating duplicate workflows in n8n. The alternative approach of always creating new workflows would lead to n8n pollution with orphaned workflow definitions. The trade-off is that workflow name changes require handling the orphaned n8n workflow, which is currently not implemented (potential future enhancement).

---

### 5.4 Webhook-per-Workflow Pattern

Each workflow receives a unique webhook path to prevent conflicts and enable independent activation.

**Pattern Implementation**:

```typescript
// Webhook path format
const webhookPath = `/webhook/hrflow-${workflowId}-execute`;

// Full webhook URL
const webhookUrl = `${N8N_WEBHOOK_BASE_URL}${webhookPath}`;

// Example: http://localhost:5678/webhook/hrflow-42-execute
```

**Benefits of this pattern**:
1. **No Conflicts**: Each workflow has a unique endpoint
2. **Independent Activation**: Workflows can be activated/deactivated independently
3. **Easy Debugging**: Workflow ID is embedded in the URL

> **[INSERT SCREENSHOT: Execution detail page showing the timeline of executed nodes with input/output data for each step]**

---

## 6. CV Parser Integration

### 6.1 Microservice Architecture

The CV parser is implemented as a standalone Python microservice using FastAPI, communicating with the Node.js backend via HTTP.

**Architecture Diagram**:

```
┌─────────────────┐     HTTP POST      ┌──────────────────┐
│  HRFlow Backend │ ────────────────→  │   CV Parser      │
│   (Node.js)     │     /parse         │   (Python/FastAPI)│
│                 │ ←────────────────  │                  │
└─────────────────┘   JSON Response    └──────────────────┘
         ↑                                      ↑
         │                                      │
    File from                              Parses PDF/DOCX
    uploads/                               Extracts: name,
                                          email, skills, etc.
```

---

### 6.2 CV Parser Service Integration

**File: `backend/src/services/cvParserService.ts`**

```typescript
import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import { getFilePath, getFileMetadata } from "./fileUploadService";
import { config } from "../config/appConfig";

const CV_PARSER_URL = config.cvParser.url;

export interface CVParseResult {
  success: boolean;
  source: string;
  filename?: string;
  data: {
    name: string | null;
    email: string | null;
    phone: string | null;
    skills: string[];
    experience_years: number | null;
    education: string[];
    raw_text?: string;
  };
  error?: string;
}

/**
 * Parse a CV file by its upload ID.
 * Calls the cv-parser microservice directly.
 */
export async function parseCV(fileId: string): Promise<CVParseResult> {
  // Step 1: Check if cv-parser service is healthy
  const isHealthy = await isCVParserHealthy();
  if (!isHealthy) {
    return {
      success: false,
      source: "file",
      data: { name: null, email: null, phone: null, skills: [], experience_years: null, education: [] },
      error: `CV parser service unavailable at ${CV_PARSER_URL}`,
    };
  }

  // Step 2: Get file path and metadata from upload service
  const filePath = getFilePath(fileId);
  const metadata = getFileMetadata(fileId);

  if (!filePath || !metadata) {
    return {
      success: false,
      source: "file",
      data: { name: null, email: null, phone: null, skills: [], experience_years: null, education: [] },
      error: `File not found: ${fileId}`,
    };
  }

  try {
    // Step 3: Create form-data with file stream
    const form = new FormData();
    form.append("file", fs.createReadStream(filePath), {
      filename: metadata.originalName,
      contentType: metadata.mimeType,
    });

    // Step 4: Call cv-parser service
    const response = await axios.post(`${CV_PARSER_URL}/parse`, form, {
      headers: form.getHeaders(),
    });

    return {
      success: true,
      source: "file",
      filename: metadata.originalName,
      data: response.data.data || response.data,
    };
  } catch (err) {
    return {
      success: false,
      source: "file",
      filename: metadata.originalName,
      data: { name: null, email: null, phone: null, skills: [], experience_years: null, education: [] },
      error: err instanceof Error ? err.message : "Failed to parse CV",
    };
  }
}

/**
 * Health check for CV parser service.
 */
export async function isCVParserHealthy(): Promise<boolean> {
  try {
    const response = await axios.get(`${CV_PARSER_URL}/health`);
    return response.status === 200;
  } catch {
    return false;
  }
}
```

---

### 6.3 File Upload Service

The file upload service manages temporary CV file storage with automatic expiry.

**File: `backend/src/services/fileUploadService.ts`**

```typescript
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";

/**
 * File Upload Configuration
 * Intentionally hardcoded as business rules, not environment variables.
 */
export const FILE_UPLOAD_CONFIG = {
  MAX_SIZE_MB: 10,      // 10MB limit for CV/resume files
  EXPIRY_HOURS: 24      // 24-hour cleanup policy
} as const;

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(__dirname, "../../uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// In-memory metadata store (could use database for persistence)
const fileMetadata = new Map<string, FileMetadata>();

export interface FileMetadata {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  uploadedAt: Date;
  expiresAt: Date;
}

// Multer storage configuration with UUID filenames
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const uniqueId = crypto.randomUUID();
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueId}${ext}`);
  },
});

// File type filter - only PDF and DOCX allowed
const fileFilter = (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
  ];
  const allowedExtensions = [".pdf", ".docx", ".doc"];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error("Only PDF and DOCX files are allowed"));
  }
};

// Create multer instance
export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: FILE_UPLOAD_CONFIG.MAX_SIZE_MB * 1024 * 1024 },
});

// Save file metadata after upload
export function saveFileMetadata(file: Express.Multer.File): FileMetadata {
  const id = path.basename(file.filename, path.extname(file.filename));
  const metadata: FileMetadata = {
    id,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    path: file.path,
    uploadedAt: new Date(),
    expiresAt: new Date(Date.now() + FILE_UPLOAD_CONFIG.EXPIRY_HOURS * 60 * 60 * 1000),
  };
  fileMetadata.set(id, metadata);
  return metadata;
}

// Cleanup expired files (runs every hour)
export function cleanupExpiredFiles(): number {
  const now = new Date();
  let cleaned = 0;
  for (const [id, metadata] of fileMetadata.entries()) {
    if (metadata.expiresAt < now) {
      if (deleteFile(id)) cleaned++;
    }
  }
  return cleaned;
}

setInterval(cleanupExpiredFiles, 60 * 60 * 1000);
```

**Critical Reflection**: The decision to store file metadata in memory rather than the database was made for simplicity in the initial implementation. This approach works well for single-instance deployments but would not scale to a multi-instance setup without shared state. For production, the metadata should be migrated to the PostgreSQL database or a distributed cache like Redis. The file expiry mechanism (24 hours) ensures temporary files do not accumulate indefinitely.

> **[INSERT SCREENSHOT: CV Parser node configuration in the workflow builder showing file upload field and extracted fields checkboxes]**

---

## 7. Error Handling and Validation

### 7.1 Centralized Error Handler

The error handler middleware catches all errors thrown in the application and formats them consistently.

**File: `backend/src/middleware/errorHandler.ts`**

```typescript
import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { AppError, isAppError, ErrorCodes } from '../types/errors';
import logger from '../lib/logger';

/**
 * Global Error Handler Middleware
 *
 * Handles:
 * - AppError (custom application errors)
 * - Prisma errors (database errors)
 * - JWT errors (authentication errors)
 * - Generic errors (unexpected errors)
 */
export function errorHandler(
  error: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestId = (req as any).requestId || 'unknown';

  let statusCode = 500;
  let errorCode: string = ErrorCodes.INTERNAL_ERROR;
  let message = 'An unexpected error occurred';
  let details: any = undefined;

  // Handle custom AppError
  if (isAppError(error)) {
    statusCode = error.statusCode;
    errorCode = error.errorCode;
    message = error.message;

    if (error.isOperational) {
      logger.warn('Client error', { requestId, errorCode, message });
    } else {
      logger.error('Non-operational error', { requestId, errorCode, message, stack: error.stack });
    }
  }
  // Handle Prisma database errors
  else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002': // Unique constraint violation
        statusCode = 409;
        errorCode = ErrorCodes.DUPLICATE_ENTRY;
        message = 'A record with this value already exists';
        details = { field: error.meta?.target };
        break;

      case 'P2025': // Record not found
        statusCode = 404;
        errorCode = ErrorCodes.NOT_FOUND;
        message = 'The requested record was not found';
        break;

      case 'P2003': // Foreign key constraint violation
        statusCode = 400;
        errorCode = ErrorCodes.VALIDATION_ERROR;
        message = 'Referenced record does not exist';
        break;

      default:
        message = 'Database operation failed';
    }
    logger.error('Prisma error', { requestId, prismaCode: error.code, errorCode });
  }
  // Handle JWT authentication errors
  else if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    errorCode = ErrorCodes.INVALID_TOKEN;
    message = 'Invalid authentication token';
  }
  else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    errorCode = ErrorCodes.TOKEN_EXPIRED;
    message = 'Authentication token has expired';
  }
  // Handle unexpected errors
  else {
    logger.error('Unexpected error', {
      requestId,
      message: error.message,
      stack: error.stack,
      url: req.url,
    });
  }

  // Send consistent error response
  res.status(statusCode).json({
    error: {
      code: errorCode,
      message,
      requestId,
      ...(details && { details }),
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    },
  });
}

/**
 * 404 Not Found Handler
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: ErrorCodes.NOT_FOUND,
      message: `Route ${req.method} ${req.url} not found`,
    },
  });
}
```

---

### 7.2 Error Classification

Errors are classified into distinct categories for appropriate handling:

| Error Type | HTTP Status | Logging Level | Example |
|------------|-------------|---------------|---------|
| **Validation Error** | 400 | WARN | Invalid email format |
| **Authentication Error** | 401 | WARN | Expired JWT token |
| **Authorization Error** | 403 | WARN | Insufficient permissions |
| **Not Found** | 404 | WARN | Workflow ID not found |
| **Conflict** | 409 | WARN | Duplicate email address |
| **Database Error** | 400-500 | ERROR | Foreign key violation |
| **Engine Error** | 500 | ERROR | n8n unreachable |
| **Unexpected Error** | 500 | ERROR | Unhandled exception |

---

### 7.3 Startup Validation

The application validates all required configuration at startup to fail fast with clear error messages.

**File: `backend/src/config/appConfig.ts`** (Lines 39-50)

```typescript
function validateConfig(): AppConfig {
  const required = ['DATABASE_URL', 'JWT_SECRET', 'N8N_API_KEY'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      `Check the .env file and ensure all required variables are set.\n` +
      `See .env.example for reference.`
    );
  }
  // ... configuration construction
}

// Validation runs on module import
export const config = validateConfig();
```

---

### 7.4 URL Allow-List Validation

The n8n compiler validates all HTTP URLs against a domain allow-list before compilation.

**File: `backend/src/services/n8nCompiler.ts`** (Lines 62-122)

```typescript
/**
 * Validate all URLs in the workflow against the allow-list.
 * Prevents malicious or unapproved HTTP requests.
 */
async function validateWorkflowUrls(
  nodes: HRFlowNode[],
  workflowId: number,
  userId?: number
): Promise<UrlValidationError[]> {
  const errors: UrlValidationError[] = [];
  const urls = allowListService.extractUrlsFromWorkflow(nodes);

  for (const url of urls) {
    const result = await allowListService.isUrlAllowed(url);

    if (!result.allowed) {
      for (const node of nodes) {
        const cfg = node.config || {};
        if (node.kind === "http" && cfg.url === url) {
          errors.push({
            nodeId: node.id,
            nodeName: node.name || node.kind,
            url,
            reason: result.reason || "Domain not in allow-list",
          });

          // Log blocked request for audit trail
          if (userId) {
            await auditService.logAuditEvent({
              eventType: "http_domain_blocked",
              userId,
              targetType: "workflow",
              targetId: workflowId,
              details: { nodeId: node.id, blockedUrl: url },
            });
          }
        }
      }
    }
  }

  return errors;
}
```

**Critical Reflection**: The URL allow-list was implemented as a security measure to prevent workflow authors from making unauthorized external HTTP requests. This is particularly important in enterprise environments where data exfiltration and SSRF (Server-Side Request Forgery) attacks are concerns. The implementation logs all blocked requests to the audit trail for security monitoring. An alternative approach using a blocklist was considered but rejected as allow-lists provide stronger security guarantees.

---

### 7.5 n8n Error Handling

The execution service distinguishes between different types of n8n errors for appropriate status reporting.

**File: `backend/src/services/executionService.ts`** (Lines 401-418)

```typescript
try {
  // ... execution logic
  n8nResult = await callN8nExecute(webhookUrl, body);
  finalStatus = "completed";
} catch (err: unknown) {
  const code = getErrorCode(err);

  // Engine errors indicate n8n infrastructure issues
  if (code === "N8N_UNREACHABLE" || code === "N8N_HTTP_ERROR" || code === "N8N_MISSING_API_KEY") {
    finalStatus = "engine_error";
  } else {
    // Workflow failures indicate logic/data issues
    finalStatus = "failed";
  }

  errorMessage = getErrorMessage(err) || "Failed to execute workflow via n8n";
}
```

**Execution Status Values**:

| Status | Meaning | User Action |
|--------|---------|-------------|
| `running` | Execution in progress | Wait for completion |
| `completed` | Successful execution | Review results |
| `failed` | Workflow logic error | Check node configurations |
| `engine_error` | n8n infrastructure issue | Check n8n service status |

> **[INSERT SCREENSHOT: Error modal in the frontend showing a workflow execution failure with error code, message, and contextual troubleshooting tips]**

---

## Appendix A: File Reference Index

### Backend Files

| File Path | Purpose |
|-----------|---------|
| `backend/src/app.ts` | Express application setup and middleware |
| `backend/src/server.ts` | Server entry point |
| `backend/src/config/appConfig.ts` | Centralized configuration with validation |
| `backend/src/config/n8nConfig.ts` | n8n-specific configuration |
| `backend/src/services/n8nCompiler.ts` | Workflow compilation to n8n format |
| `backend/src/services/executionService.ts` | Workflow execution orchestration |
| `backend/src/services/n8nService.ts` | n8n REST API client |
| `backend/src/services/workflowService.ts` | Workflow CRUD operations |
| `backend/src/services/cvParserService.ts` | CV parser microservice integration |
| `backend/src/services/fileUploadService.ts` | File upload and expiry management |
| `backend/src/middleware/errorHandler.ts` | Global error handling |
| `backend/prisma/schema.prisma` | Database schema definition |

### Frontend Files

| File Path | Purpose |
|-----------|---------|
| `frontend/src/pages/Workflows/workflowBuilderPage.tsx` | Visual workflow editor |
| `frontend/src/components/HRFlowNode.tsx` | Custom ReactFlow node component |
| `frontend/src/components/builder/ConfigPanel.tsx` | Node configuration forms |
| `frontend/src/components/builder/NodePicker.tsx` | Node type selection modal |
| `frontend/src/components/builder/SmartField.tsx` | Variable/custom input toggle |
| `frontend/src/api/workflows.ts` | Workflow API client |
| `frontend/src/api/executions.ts` | Execution API client |
| `frontend/src/contexts/AuthContext.tsx` | Authentication state management |

### Infrastructure Files

| File Path | Purpose |
|-----------|---------|
| `docker-compose.yml` | Service orchestration configuration |
| `backend/package.json` | Backend dependencies |
| `frontend/package.json` | Frontend dependencies |
| `backend/tsconfig.json` | TypeScript configuration |
| `frontend/vite.config.ts` | Vite build configuration |

---

## Appendix B: Screenshot Checklist

The following screenshots should be captured and inserted at the indicated locations:

1. **Section 1.2**: Docker Desktop showing all five containers running with healthy status
2. **Section 2.1**: Terminal showing backend startup logs
3. **Section 2.2**: Prisma Studio showing workflows, workflow_nodes, and workflow_edges tables
4. **Section 3.2**: Workflow builder interface with connected nodes and ConfigPanel open
5. **Section 3.4**: Close-up of a node showing type badge, ID, name, and handles
6. **Section 3.5**: ConfigPanel showing HTTP Request node configuration
7. **Section 4.7**: n8n workflow editor showing a compiled HRFlow workflow
8. **Section 5.4**: Execution detail page with step timeline and input/output data
9. **Section 6.3**: CV Parser node configuration in workflow builder
10. **Section 7.5**: Error modal showing execution failure with troubleshooting tips

---

*Document generated for academic thesis purposes. All code segments are extracted from the HRFlow project codebase.*
