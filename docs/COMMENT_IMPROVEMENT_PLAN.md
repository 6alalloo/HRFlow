# HRFlow: Codebase Comment Quality Standards & Improvement Plan

This document serves as the official guide and plan for enhancing the internal documentation (comments) of the HRFlow codebase.

## 1. Core Principles

The following principles must be strictly followed when adding or replacing comments:

### 1.1 Meaningful & Weighted

- Comments should explain "why" and "intent" rather than "what" (unless the code is particularly complex).
- Avoid obvious comments like `// increment i`.
- Comments should be concise but provide enough context to be useful for a developer.
- Do not over-comment; only add comments where they add genuine value to understanding the system.

### 1.2 Professional Developer Tone

- Comments must be written as if the original developer is documenting their own work.
- **Do not** use second-person references like "your", "you", or "yours" (e.g., "Pass your object here" should be "Pass the configuration object here").
- Use objective, professional language.

### 1.3 No Emojis

- Emojis are strictly prohibited in the codebase comments.
- Existing emojis must be identified and removed or replaced with equivalent text if they convey meaning.

### 1.4 Zero Code Impact

- **No functional code shall be touched.**
- The logic, structure, and behavior of the application must remain identical.
- Ensure that comment modifications do not interfere with build tools or documentation generators (like TSDoc/JSDoc) unless intentional.

## 2. Implementation Strategy

### Phase 1: Audit & Discovery

- Identify files with high complexity that lack sufficient documentation.
- Scan for existing emojis using regex patterns.
- Review existing "filler" comments that need replacement with meaningful ones.

### Phase 2: Systematic Update

- **Backend**: Focus on services, controllers, and complex business logic in `backend/src`.
- **Frontend**: Focus on hooks, complex components, and state management in `frontend/src`.
- **Database**: Document complex relations in `prisma/schema.prisma`.

### Phase 3: Validation

- Run existing test suites to ensure zero regression.
- Manual peer review of selected files to verify tone and clarity.

## 3. Examples

### Before (Prohibited)

```typescript
// This is your function to handle the click 🚀
// It sends the data to the API
const handleClick = () => { ... }
```

### After (Standard)

```typescript
// Handles the submission process by validating state and dispatching the API request.
const handleClick = () => { ... }
```
