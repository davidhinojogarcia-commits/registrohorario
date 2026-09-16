# Supabase database for Control Horario de Obra

The migration in `migrations/` defines the independent PostgreSQL database for this application.

## Security model

- Supabase Auth identifies company owners and supervisors.
- Row Level Security isolates every company.
- Worker PIN hashes, invitation tokens, and sessions live in the non-exposed `private` schema.
- Original clock events and audit entries are append-only.
- Corrections are stored separately and preserve the original event.
- The browser never receives a Supabase secret key.

## Runtime variables

The application will require these values after the new Supabase project is created:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` (server only)

## Migration order

1. Create or select the dedicated Supabase project.
2. Apply migrations in filename order.
3. Run Supabase security and performance advisors.
4. Generate TypeScript database types.
5. Configure runtime variables.
6. Switch the application API routes from D1 to Supabase.
7. Verify isolation with two different company accounts before production use.

The current Sites database contains only demonstration company, worksite, worker, and assignment rows, with no clock events. Those rows should not be imported into the production Supabase project.
