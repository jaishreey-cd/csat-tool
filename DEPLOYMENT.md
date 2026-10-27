# CSAT Container Deployment Guide (Docker & Docker Compose)

This guide documents the containerized deployment of the **CSAT (Customer Satisfaction Survey System)** using Docker and Docker Compose.

---

## 1. Container Architecture Overview

The CSAT application is deployed as a coordinated, secure, three-container cluster on an internal Docker bridge network (`csat_network`):

```
                                  Client Browser
                                        │
                                        ▼ HTTP (Host Port 80)
                       ┌─────────────────────────────────┐
                       │       csat_frontend (Nginx)      │
                       │  • Serves React 19 / Vite SPA   │
                       │  • Handles SPA routing fallback │
                       │  • Proxies /api/ requests       │
                       └────────────────┬────────────────┘
                                        │
                                        │ Internal HTTP (:8000)
                                        │ (csat_network)
                                        ▼
                       ┌─────────────────────────────────┐
                       │      csat_backend (FastAPI)     │
                       │  • Uvicorn ASGI Server (:8000)  │
                       │  • JWT Auth & Role Permissions  │
                       │  • In-process follow-up checker │
                       │  • CSV/Excel data sync engine   │
                       └────────────────┬────────────────┘
                                        │
                                        │ Internal PostgreSQL (:5432)
                                        │ (csat_network)
                                        ▼
                       ┌─────────────────────────────────┐
                       │     csat_db (PostgreSQL 16)     │
                       │  • Dedicated relational DB      │
                       │  • Healthcheck via pg_isready   │
                       │  • Volume: csat_postgres_data   │
                       └─────────────────────────────────┘
```

### Security & Isolation Principles
- **No Direct DB Exposure:** The `csat_db` container has no host ports exposed by default. Only the backend on the internal bridge network can access port 5432.
- **No Direct Backend Exposure:** The `csat_backend` container has no host ports exposed by default. All client browser requests pass through the Nginx reverse proxy.
- **Single Host Port:** Only port `80` (configurable via `${FRONTEND_PORT}`) is published on the host.
- **Persistence Across Restarts:** Database files are stored in the named Docker volume `csat_postgres_data`. Uploaded CSV/Excel and audit files are stored in `csat_backend_uploads`. Recreating or stopping containers will **never** delete your data.

---

## 2. Prerequisites

- **Docker:** Engine version 24.0+ (or Docker Desktop 4.20+)
- **Docker Compose:** v2.20+ (included with `docker compose`)
- Available Host Port: Port `80` (or another port specified via `FRONTEND_PORT`)

---

## 3. Configuration & Environment Variables

Copy the provided [.env.example](file:///c:/Projects/CSAT/csat-tool/.env.example) to `.env` in the `csat-tool/` root directory:

```bash
cp .env.example .env
```

### Key Configuration Settings in `.env`

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `FRONTEND_PORT` | `80` | Host port where the CSAT frontend is published |
| `FRONTEND_URL` | `http://localhost` | Externally reachable base URL of the CSAT UI |
| `POSTGRES_DB` | `csat_db` | PostgreSQL database name |
| `POSTGRES_USER` | `postgres` | PostgreSQL username |
| `POSTGRES_PASSWORD` | *(Strong Password)* | PostgreSQL password (change in production) |
| `JWT_SECRET` | *(64+ random chars)* | Cryptographic signing secret for JWT tokens |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `480` | JWT token validity window (8 hours) |
| `SEED_ADMIN_EMAIL` | `admin@csat.local` | Default Administrator login email |
| `SEED_ADMIN_PASSWORD` | `AdminPassword123!` | Default Administrator login password |
| `SEED_REVIEWER_EMAIL` | `reviewer@csat.local` | Default PMO Reviewer login email |
| `SEED_REVIEWER_PASSWORD` | `ReviewerPassword123!` | Default PMO Reviewer login password |
| `SMTP_HOST` | `smtp.gmail.com` | Outgoing SMTP host for survey invitations |
| `SMTP_PORT` | `587` | SMTP port (STARTTLS) |
| `SMTP_USER` | `""` | SMTP sender email account |
| `SMTP_PASSWORD` | `""` | SMTP app password |
| `VITE_SSO_ENABLED` | `false` | Enable Microsoft Entra ID SSO login |

> [!IMPORTANT]
> Never commit `.env` into git. Both root and subfolder `.dockerignore` files prevent local environment files and credentials from being baked into Docker images.

---

## 4. Building and Starting the Application

### Start All Services in Detached Mode

From the `csat-tool/` directory:

```bash
docker compose up -d --build
```

Docker Compose will:
1. Initialize the `csat_network` bridge network and named volumes.
2. Start `csat_db` and await PostgreSQL health readiness via `pg_isready`.
3. Build and launch `csat_backend`, automatically running Alembic database migrations (`alembic upgrade head`) and seeding initial accounts/questions before serving traffic.
4. Build the production React/Vite assets, copy them to `nginx:alpine`, and launch `csat_frontend`.

### Check Service Health & Status

```bash
docker compose ps
```

Expected output:
```text
NAME            IMAGE               COMMAND                  SERVICE      STATUS                    PORTS
csat_db         postgres:16-alpine  "docker-entrypoint.s…"   db           Up (healthy)              5432/tcp
csat_backend    csat-tool-backend   "sh -c 'alembic upgr…"   backend      Up (healthy)              8000/tcp
csat_frontend   csat-tool-frontend  "/docker-entrypoint.…"   frontend     Up (healthy)              0.0.0.0:80->80/tcp
```

### Stream Application Logs

View combined logs:
```bash
docker compose logs -f
```

View specific service logs:
```bash
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f db
```

---

## 5. Database Initialization, Migrations & Seeding

### Automatic Startup Migration
The backend container is configured to automatically apply pending migrations at container start before Uvicorn starts listening:
```bash
alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Manual One-Time Migration Command
If you wish to execute or verify migrations manually inside the running backend container:

```bash
docker compose exec backend alembic upgrade head
```

To verify the current migration revision:
```bash
docker compose exec backend alembic current
```

### Re-running Seed Data
The application includes idempotent seeding for the Admin user, PMO Reviewer, question bank templates, and project imports:

```bash
docker compose exec backend python scripts/seed.py
```

---

## 6. Accessing the Application

- **Web Application:** [http://localhost](http://localhost) (or `http://<your-host-ip>:<FRONTEND_PORT>`)
- **Backend Health Check:** [http://localhost/api/health](http://localhost/api/health)
- **Direct Backend Health Check (Internal):** [http://localhost:8000/health](http://localhost:8000/health) (when port 8000 is mapped)
- **Initial Admin Credentials:**
  - Email: `admin@csat.local`
  - Password: `AdminPassword123!`
- **Initial PMO Reviewer Credentials:**
  - Email: `reviewer@csat.local`
  - Password: `ReviewerPassword123!`

---

## 7. Managing Application Lifecycle

### Stopping the Services
To stop all containers while preserving database and volume data:
```bash
docker compose stop
```

To stop and remove containers and network (data in volumes remains intact):
```bash
docker compose down
```

### Restarting Services
```bash
docker compose restart
```

### Rebuilding After Code Changes
When frontend or backend code is modified, rebuild the specific service without affecting other containers or volumes:

```bash
# Rebuild only the frontend after UI/theme changes:
docker compose up -d --build frontend

# Rebuild only the backend after Python API changes:
docker compose up -d --build backend
```

### Total Reset (Disposable / Test Environments Only)
> [!CAUTION]
> The following command deletes the PostgreSQL named volume and permanently removes all stored surveys, clients, users, and audit records. **Never use this in production.**

```bash
docker compose down -v
```

---

## 8. Production Deployment & Future Utiliza Integration

### Running Behind HTTPS (Reverse Proxy / Load Balancer)
When deploying behind AWS ALB, Traefik, Cloudflare, or an enterprise Nginx reverse proxy:
1. Terminate SSL at your load balancer/proxy.
2. Forward HTTP traffic to port 80 of the `csat_frontend` container.
3. Configure your proxy to pass standard headers:
   - `X-Forwarded-Proto https`
   - `X-Forwarded-Host <your-public-domain>`
   - `X-Real-IP $remote_addr`
4. Set `FRONTEND_URL=https://csat.yourcompany.com` in `.env` so that generated client survey tokens produce public URLs with HTTPS.

### Integration with Utiliza
The CSAT Survey application is built to run standalone while maintaining full compatibility for future integration into the Utiliza platform:
1. **Independent Service:** CSAT operates independently on its own database schema (`csat_db`) and JWT token lifecycle, preventing breaking changes to Utiliza core.
2. **API Boundaries:** All API calls are routed through `/api/` endpoints adhering to strict REST contracts.
3. **CORS Flexibility:** The `FRONTEND_URL` environment variable controls allowed CORS origins in `backend/app/main.py`. When embedding CSAT into the Utiliza portal (e.g., via iframe, micro-frontend, or subdomain), add the Utiliza origin to `FRONTEND_URL`.
4. **Single Sign-On (SSO):** When organization approval is granted, set `VITE_SSO_ENABLED=true` and configure `AAD_CLIENT_ID`, `AAD_CLIENT_SECRET`, and `AAD_TENANT_ID`. Both CSAT and Utiliza can authenticate against the same Microsoft Entra ID tenant.

### Background Tasks & Scalability
- **Current Mode:** The automated 15-day survey reminder scanner runs inside the FastAPI process via an asynchronous background task (`_periodic_followup_checker` in `main.py`).
- **Horizontal Scaling Recommendation:** If you scale the backend horizontally across multiple replicas (`replicas > 1`), extract the periodic follow-up scanner into a lightweight dedicated worker container (`celery` or standalone Python script) to ensure reminders are not sent multiple times concurrently. For single-instance deployments, the built-in in-process scheduler is fully sufficient.

---

## 9. Troubleshooting & FAQ

### Issue: "failed to connect to the docker API / daemon is not running"
- **Cause:** Docker Desktop engine is not running on your host machine.
- **Fix:** Start Docker Desktop from the Windows Start menu or ensure the Docker daemon service is running:
  ```powershell
  Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
  ```

### Issue: "Port 80 is already in use"
- **Cause:** Another service on the host (e.g., IIS or Apache) is listening on port 80.
- **Fix:** Update `FRONTEND_PORT` in `.env`:
  ```bash
  FRONTEND_PORT=8080
  ```
  Then restart with `docker compose up -d`. Access the application at `http://localhost:8080`.

### Issue: Database connection fails on startup
- **Cause:** `backend` attempted to connect before `db` finished initializing.
- **Fix:** The `docker-compose.yml` uses `condition: service_healthy` on `db` with `pg_isready`. If database initialization takes longer on slower hardware, increase `start_period` or `retries` under `db.healthcheck` in `docker-compose.yml`.

### Issue: Alembic migration revision mismatch
- **Fix:** Ensure both migrations are present:
  - `93ce04dfd98e_create_phase1_tables.py`
  - `3fa821834a9e_create_phase2_surveys_and_questions.py`
  Run `docker compose exec backend alembic upgrade head` to align the database with `head`.
