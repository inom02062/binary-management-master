<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1nTX9_AjK3cT3KX9Qijs2xW3PBQy2Oeb-

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app (frontend)

   - Default dev server URL: http://localhost:3001/ (was 3000)
   - If you need to run on a different port: `PORT=3002 npm run dev` or `vite --port 3002`

## Backend (Prisma + SQLite)

This project includes a small Express backend using Prisma and SQLite to persist blocks, apartments and payments.

Steps to set it up locally:

1. Install dependencies: `npm install`
2. Generate Prisma client: `npm run prisma:generate`
3. Create database and apply migrations: `npm run prisma:migrate`
4. Start backend server (in a separate terminal): `npm run server`
5. Run frontend: `npm run dev`

The frontend will try to call the backend at `http://localhost:4000` by default. You can change the URL by setting `VITE_API_URL` in an `.env` file.

Data reads can use the local cache while the backend is offline, but login and all protected actions require a reachable backend and an authenticated session.

### Accounts, roles and security

The server enforces tenant-scoped roles on every API request:

- `SUPERADMIN`: signs in at `/control` to create companies and their initial login, and to enable or disable company access. Each company's activity journal is shown separately in that company's panel and can be cleared individually; platform activity has its own section. It cannot access company business data through the client API.
- `HYPERADMIN`: belongs to exactly one company, manages that company's administrator and observer accounts (including creating them, resetting their passwords, disabling them, and deleting them), and has the same business-data access as an `ADMIN`. It can view and clear only its own company's activity journal. It cannot manage hyper-admin accounts or import/reset company data.
- `ADMIN`: view and manage only their company's buildings, apartments and payments; export their company's data.
- `VIEWER`: read-only access.

The super-admin panel is available at `http://<host>/control`; client accounts use the regular web app at `/`. Each company has a separate SQLite data file under `TENANT_DATA_DIR`; its login is linked to exactly one company. User credentials, sessions and the company registry are kept separately in `PLATFORM_DATABASE_URL`. Client usernames are unique across the platform. Disabling a company revokes its sessions without deleting its data.

The login page includes a six-step interactive company guide in Uzbek, Russian, and English. Open it with the black animated balls or the guide button below the login form.

Sessions are stored server-side and sent in an HttpOnly, SameSite cookie. Sessions expire after eight hours. The server checks the account and company status on every API request; hiding UI controls is only a usability measure. Authenticated Socket.IO connections are also required for live updates. Configure `ALLOWED_ORIGINS` for the exact frontend origins when hosting outside the local Compose setup. Use HTTPS in production.

The old built-in `admin / admin123` credential is disabled. To reset an existing super-admin password, set `RESET_ADMIN_USERNAME` and a unique `RESET_ADMIN_PASSWORD` of at least 5 characters (maximum 72 UTF-8 bytes) in the local Compose `.env`, recreate the server container, then run `docker compose exec -T server node server/reset-admin-password.js`. Remove both reset variables from `.env` and recreate the container afterward. The command revokes existing sessions and writes an audit event. Do not paste the password into chat or commit `.env`.

For an empty platform database, set `BOOTSTRAP_ADMIN_USERNAME` and `BOOTSTRAP_ADMIN_PASSWORD` in `.env` before the first server start. The first account is created as `SUPERADMIN`; no default credentials are generated. Remove those bootstrap variables and recreate the container after successful creation.

In `/control`, create a company and choose the initial hyper-admin's username and password. Super-admins can also create, promote, or demote company accounts, and hyper-admin accounts are listed alongside their company in `/control`. A hyper-admin sees and manages only regular administrator and observer accounts in their own company. Passwords must be at least 5 characters (maximum 72 UTF-8 bytes). Existing `DATABASE_URL` data is retained as the initial company; on startup, its user accounts and audit history are moved to the platform database and the old sessions are revoked. Existing company admins can be promoted to hyper-admin from `/control`. Back up both database locations before upgrading an existing deployment. Administrative events are recorded in `ActivityLog`.

Run the authorization unit tests with `npm test`.

### Database migrations

Development Compose uses `prisma db push` to keep the initial company database in sync. The platform database and each newly created company database use the tracked migration chain. Existing volumes were historically created with `db push` and may have no migration baseline; back up both database locations before switching `NODE_ENV=production`, and baseline the migrations already represented in an existing database before running `prisma migrate deploy`.

### Browser-local data

Offline caches and pending edits are namespaced by the signed-in company, so switching accounts does not send one company's queued changes to another. Legacy mock data in unscoped browser localStorage is not automatically copied into a company database; preserve an export and contact the deployment administrator before moving it.

### Offline behavior and synchronization

The app supports offline edits by queueing operations when the backend is unavailable. Key points:

- When server unreachable, saves (create/update/delete) are stored locally in a pending queue (`localStorage` key `blm_pending_ops`) and applied to the local mock DB for immediate UI responsiveness.
- The app periodically attempts to flush the pending queue to the server (every 10s), and you can trigger manual sync from the header or from System Data → Sync now.
- When syncing, the app sends only the pending operations for the currently signed-in company.
- Requests rejected with `401` or `403` stay in the pending queue and are never treated as successful offline fallbacks.
- After successful sync, pending ops are cleared and frontend refreshes data from that company's SQLite database.

If you see differing data between browsers for the same company, open System Data and use "Sync now" to force pending operations to be uploaded and unified in that company's SQLite database.

## Docker

Provided files:
- `server.Dockerfile` — Dockerfile for the Express + Prisma server
- `frontend.Dockerfile` — Dockerfile for the Vite frontend (dev mode)
- `docker-compose.yml` — convenience compose file that runs both services and mounts a persistent volume `blm_data` for the SQLite file

Quickstart (requires Docker / Docker Compose):

1. Build and start containers:
   - docker compose up --build -d
   If your Docker does not support the `docker compose` plugin, use `docker-compose up --build -d`.

2. The frontend will be available at `http://localhost:3001`, the backend at `http://localhost:4000`, and the super-admin panel at `http://localhost:3001/control`.

Notes:
- `dev.db`, `platform.db`, and all company database files are stored under the named Docker volume `blm_data` so they persist between container restarts. Compose sets `PLATFORM_DATABASE_URL=file:/data/platform.db` and `TENANT_DATA_DIR=/data/tenants`; keep these paths on persistent storage in other deployments too.
- Compose is configured for a developer workflow (bind mounts so code changes reflect inside containers). For production, change to a multi-stage build that builds static frontend output and runs migrations with `prisma migrate deploy`.
- If Docker is not installed on your machine, you can still run the app locally with `npm run server` and `npm run dev` as before.

If you want, I can also:
- Add a one-command `npm run dev:all` script that uses `concurrently` to run both server and frontend in parallel (no Docker required), or
- Create production-ready multi-stage Dockerfiles and an nginx-based frontend image.
