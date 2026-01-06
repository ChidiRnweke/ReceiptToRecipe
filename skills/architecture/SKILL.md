---
name: r2r-architecture
description: Enforces strict architectural constraints for the Receipt2Recipe (R2R) project. Use when writing code, creating services, defining database schemas, or implementing backend logic.
---

# Receipt2Recipe (R2R) Architecture Guidelines

You must adhere to the following architectural rules. Do not deviate.

## 1. Framework & Core Patterns
- **Framework:** SvelteKit (Node adapter) with TypeScript.
- **Server-Side Priority:** Use SSR for everything.
- **Data Flow:**
  - **Writes:** Use SvelteKit `Form Actions` (`+page.server.ts`).
  - **Reads:** Use `Load Functions` (`+page.server.ts`).
  - **Client:** Avoid client-side `fetch` unless strictly needed for streaming status updates.

## 2. Hexagonal Service Architecture
The application uses a strict separation of concerns.

### A. Models (Domain Entities)
- **What:** Pure TypeScript classes/interfaces representing DB schema and domain entities.
- **Rules:** Zero dependencies. No logic.

### B. Services (Business Logic)
- **What:** Classes containing ALL business logic and external API interactions (Mistral, S3, OpenAI).
- **Rules:**
  - Must receive dependencies via `constructor`.
  - **Isolation:** Must NOT import other Services.
  - **HTTP Agnostic:** Must NOT know about `Request`/`Response` objects.
  - **Interfaces:** Every service must implement a defined interface (e.g., `IStorageService`).

### C. Controllers (Orchestration)
- **What:** The entry point for Actions and Loaders.
- **Rules:**
  - Import and orchestrate multiple Services to complete a user task.
  - **Isolation:** Must NOT import other Controllers.
  - **HTTP Agnostic:** Return plain data/objects. Let the SvelteKit file handle the HTTP response.

### D. Factories
- **What:** Responsible for wiring dependencies (DI Container pattern).
- **Rules:** Use factories to instantiate Controllers with their required Service instances.


## 4. Async State Machine Pattern
For long-running AI tasks (OCR, Image Gen):
1. **Immediate Return:** Create a DB record with status `QUEUED` or `PROCESSING` and return the ID to the UI immediately.
2. **Background Process:** Trigger the Service method without awaiting it in the HTTP request (fire-and-forget), or use a job queue.
3. **Completion:** The background process updates the DB record to `DONE` or `FAILED`.
4. **UI:** The frontend handles this via polling or optimistic UI updates.

## 5. Coding Standards
- **Styling:** Tailwind CSS only.
- **Type Safety:** Strict mode enabled. No `any`.