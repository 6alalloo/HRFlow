# Workflow Builder UI Overhaul Specification

## Overview

The goal is to transform the technical, open-ended canvas into a **guided, linear experience** suitable for non-technical users (HR staff). The aesthetic will be "Premium Dark" with glowing elements, focusing on simplicity and guardrails.

## Core Interaction Concept: "The Ghost Node"

Instead of dragging nodes from a palette, the user builds the flow by clicking **"Ghost Nodes"** (Add Buttons) that appear at valid connection points.

### Behavior

1.  **Start State**: A new workflow consists of a fixed **Trigger Node** connected to a **Ghost Node**.
2.  **Adding a Step**:
    - Clicking the **Ghost Node** (`(+)`) opens a **Floating Node Picker** (Popover).
    - Selecting a node type (e.g., "Email") replaces the Ghost Node with the Real Node.
    - A new Ghost Node is automatically appended after the new Real Node.
3.  **Branching (Condition Node)**:
    - When a `Condition` node is added, the system **automatically** generates two branches (True/False).
    - Each branch terminates with its own **Ghost Node**.
    - _Technical Implementation_: This requires custom "layouting" logic to ensure branches don't overlap.

## Component Strategy

### 1. `PremiumNode` (Custom ReactFlow Node)

- **Visuals**:
  - Dark navy card (`bg-navy-800`).
  - Glowing border on selection (`shadow-cyan-glow`).
  - Icon + Title on top.
  - Summary text of config (e.g., "To: john@doe.com") in the body.
- **Handles**: Hidden or strictly managed. Users should _not_ need to manually drag connection lines in this mode.

### 2. `GhostNode` (Custom ReactFlow Node)

- **Visuals**:
  - Small, circular, pulsating button (`(+)`).
  - Dotted line connection to previous node.
- **Action**: Opens `NodePicker`.

### 3. `NodePicker` (Floating UI)

- **Visuals**: Glassmorphism popover.
- **Content**: Grid of available node types with icons and descriptions.
- **Grouping**: "Actions" (Email, HTTP) vs "Logic" (Condition, Wait).

### 4. `ConfigPanel` (Right Overlay)

- **Behavior**: slides in from the right when a `PremiumNode` is selected.
- **Content**: **Specific Form** based on node type.
  - **Email**: Inputs for To, CC, Subject, Rich Text Editor for Body.
  - **HTTP**: Dropdown for Method, URL input, Key-Value pairs for Headers.
  - **Condition**: Field selector, Operator dropdown (Equals, Contains), Value input.
  - **Validation**: Real-time validation (e.g., "Subject is required").
- **Implementation**: A map of `NodeType -> FormComponent`.

## Layout & Auto-Arrangement

- Since users aren't dragging nodes, we need an **Auto-Layout** engine.
- **Strategy**: Use `dagre` or `elkjs` to re-calculate node positions every time a node is added or removed. This keeps the "linear" flow straight and balanced.

## Technical Tasks

1.  **Refactor `WorkflowBuilderPage`**:
    - Implement "Add Node" logic that inserts _between_ nodes or at _end_.
    - Integrate `dagre` for auto-layout.
2.  **Create Components**:
    - `components/nodes/PremiumNode.tsx`
    - `components/nodes/GhostNode.tsx`
    - `components/builder/NodePicker.tsx`
    - `components/builder/ConfigPanel.tsx`
3.  **Form Schemas**:
    - Define formatting rules for `trigger`, `http`, `email`, `condition`...

## Plan of Action

1.  **Setup**: Install `dagre` (for layout) and `framer-motion` (for smooth panel slides).
2.  **Node Visuals**: Build the static `PremiumNode` look.
3.  **Flow Logic**: Implement the "Ghost Node" insertion logic.
4.  **Forms**: Build the `ConfigPanel` with the first 3 node types (Trigger, Email, Condition).
