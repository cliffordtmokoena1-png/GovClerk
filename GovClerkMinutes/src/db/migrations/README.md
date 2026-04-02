# Portal Database Migrations

Lightweight migration system for the GovClerk Public Portal database (PlanetScale).

## Quick Start

```bash
# Apply all pending migrations
npm run db:migrate

# Preview what would run (no changes made)
npm run db:migrate:dry

# Check migration status
npm run db:migrate:status
```

## How It Works

1. Each migration is a TypeScript file in `src/db/migrations/` with a sequential ID
2. The runner connects to PlanetScale and checks `gc_portal_migrations` for applied IDs
3. Any migrations not yet recorded are executed in order
4. Each successful migration is recorded in the tracking table

## Adding a New Migration

1. Create `src/db/migrations/NNN_description.ts`:

```typescript
import type { Migration } from "./index";

export const migrationNNN: Migration = {
  id: "NNN",
  name: "Human-readable description",
  sql: `
ALTER TABLE gc_some_table
  ADD COLUMN IF NOT EXISTS new_col VARCHAR(255) DEFAULT NULL;
  `.trim(),
};
```

2. Register it in `src/db/migrations/index.ts`:

```typescript
import { migrationNNN } from "./NNN_description";

export const MIGRATIONS: Migration[] = [
  // ... existing migrations
  migrationNNN,
];
```

3. Run `npm run db:migrate` to apply.

## Rules

- **IDs must be sequential** — `001`, `002`, `003`, etc.
- **Never modify an applied migration** — create a new one instead.
- **Use idempotent SQL** — `IF NOT EXISTS`, `IF EXISTS` where possible.
- **PlanetScale quirk** — DDL is not transactional; each `ALTER TABLE` is atomic individually.

## Environment Variables

The runner requires these PlanetScale credentials:

| Variable | Description |
|---|---|
| `PLANETSCALE_DB_HOST` | Database host URL |
| `PLANETSCALE_DB_USERNAME` | Database username |
| `PLANETSCALE_DB_PASSWORD` | Database password | 

These are the same variables used by the portal API routes.
