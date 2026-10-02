# Hospital Management System

Production-ready hospital operations platform with a Node.js/Express API and a React/Vite frontend. The system supports patient intake, clinical care, pharmacy, lab, radiology, billing, administration, and role-based access for hospital staff.

## Quick Start

### 1. Install dependencies

From the repository root:

```bash
npm install
npm --prefix frontend install
```

### 2. Configure the backend

Create a local environment file:

```bash
cp .env.example .env
```

For local development, the defaults in `.env.example` are suitable. Make sure `CORS_ORIGINS` includes `http://localhost:5173` if you change it.

### 3. Start the backend

In the repository root:

```bash
npm start
```

The API starts at http://localhost:3000. On first startup, the app creates the SQLite database and schema automatically.

### 4. Start the frontend

Open a second terminal:

```bash
npm --prefix frontend run dev
```

Open http://localhost:5173 on the server itself. The frontend dev server also listens on the server's LAN address, so other devices can use `http://SERVER_IP:5173`.

For another device on the intranet, set the API URL to the server's LAN address before starting the frontend:

```bash
VITE_API_BASE=http://SERVER_IP:3000/api npm --prefix frontend run dev -- --host 0.0.0.0
```

Replace `SERVER_IP` with the hospital server's private address, such as `192.168.1.50`. Set the backend CORS origin to match the frontend URL:

```bash
CORS_ORIGINS=http://192.168.1.50:5173
```

Then staff on the same network can open `http://192.168.1.50:5173` in their browsers.

### 5. Sign in and use the HMS

The login page includes selectable demo accounts. You can also enter one of these credentials manually:

| Role | Username | Password |
| --- | --- | --- |
| Administrator | `admin` | `Admin` |
| Physician | `doctor` | `Doctor` |
| Receptionist | `receptionist` | `Receptionist` |
| Nurse | `nurse` | `Nurse` |
| Laboratory | `labtech` | `LabTech` |
| Pharmacy | `pharmacy` | `Pharmacy` |
| Radiology | `radiology` | `Radiology` |
| Billing | `billing` | `Billing` |
| Patient | `patient` | `Patient` |

After signing in, use the role-specific dashboard to manage patients, appointments, clinical records, admissions, prescriptions, lab and radiology workflows, billing, pharmacy, and reports. The backend API documentation is available at http://localhost:3000/api-docs.

## Deployment Overview

This application is structured as a two-part deployment:

- Backend API: Express server serving REST endpoints and Swagger docs
- Frontend: React SPA built with Vite and served either through a static host or behind a reverse proxy
- Database: SQLite for local or simple-hosted deployments

For production, the recommended pattern is:

- run the backend as a Node.js service
- build the frontend into static assets
- serve the frontend via Nginx or a static hosting platform
- expose the API behind a single domain or subdomain
- set secure environment variables for JWT and CORS

## Architecture

```text
Browser
  ├── Frontend (React + Vite)
  │    └── built static assets / dev server
  └── API Requests
        ↓
  Backend (Express + JWT auth)
        ↓
  SQLite database (hospital.db)
```

## Stack

- Node.js 22.5+
- Express 5
- SQLite via node:sqlite
- React 19
- Vite 8
- Tailwind CSS
- JWT-based authentication
- Swagger UI documentation
- Vitest + Supertest for automated tests

## Project Structure

```text
.
├── frontend/                  # React application
│   ├── public/
│   ├── src/
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
├── src/                       # Express backend
│   ├── config/
│   ├── middleware/
│   ├── models/
│   ├── modules/
│   ├── routes/
│   └── server.js
├── scripts/
├── tests/
├── package.json
├── vitest.config.js
├── hospital.db                # SQLite database file
├── .gitignore
├── LICENSE
└── README.md
```

## Prerequisites

- Node.js 22.5 or newer
- npm 9+
- Access to a host or VM with Node installed for deployment
- Optional: Nginx or any reverse proxy for serving the frontend

## Installation

Install both app layers:

```bash
npm install
npm --prefix frontend install
```

## Environment Variables

Set these before starting the backend in production:

```bash
PORT=3000
JWT_SECRET=replace_with_a_strong_secret
CORS_ORIGINS=https://your-frontend-domain.com,https://www.your-frontend-domain.com
DB_PATH=/var/app/hospital_management/hospital.db
NODE_ENV=production
ENABLE_API_DOCS=false
# Only needed when SEED_DEMO_DATA=true:
SEED_DEMO_PASSWORD=replace_with_a_strong_secret
```

Important notes:

- `JWT_SECRET` is required in production.
- `CORS_ORIGINS` should include your deployed frontend URL(s).
- `DB_PATH` should point to a writable persistent storage location.
- `ENABLE_API_DOCS` should remain `false` unless Swagger is protected by your reverse proxy.
- `SEED_DEMO_PASSWORD` is **required** whenever `NODE_ENV=production` and
  `SEED_DEMO_DATA=true`. In production the seeder refuses to run without it, and
  also refuses it if it equals one of the default demo passwords (which are the
  capitalised username) or is shorter than 16 characters. Generate a value with
  `openssl rand -hex 24`. Never commit it — on Render use
  `generateValue: true`, which keeps the secret out of git.

The frontend accepts its API URL at build time:

```bash
VITE_API_BASE=https://api.your-domain.com/api npm --prefix frontend run build
```

If the frontend and API share one domain through a reverse proxy, use `/api` instead:

```bash
VITE_API_BASE=/api npm --prefix frontend run build
```

## Local Development

### Start backend

```bash
npm start
```

### Start frontend

```bash
npm --prefix frontend run dev
```

The standard local URLs are:

- Frontend: http://localhost:5173
- API: http://localhost:3000
- Swagger docs: http://localhost:3000/api-docs

## Production Build

Build the frontend production bundle:

```bash
npm run build
```

This runs the root build script and compiles the React app for deployment.

## Deploying the Backend

On the production server, install only locked dependencies and do not use the Vite development server:

```bash
npm ci
npm --prefix frontend ci
npm run build
NODE_ENV=production npm start
```

Run the server in production with a process manager such as PM2:

```bash
npm install --global pm2
pm2 start src/server.js --name hospital-api --node-args="--env-file=.env"
```

To monitor:

```bash
pm2 logs hospital-api
pm2 status
```

Recommended production setup:

- run as a system service or PM2 process
- keep logs enabled
- store environment variables in a `.env` file or a deployment secret manager
- enable HTTPS at the reverse proxy or load balancer layer

## Deploying the Frontend

### Option 1: Static hosting

After building:

```bash
npm --prefix frontend run build
```

The output is generated in the frontend build directory. Serve those files with:

- Nginx
- Vercel
- Netlify
- S3 + CloudFront
- any static web host

### Option 2: Nginx reverse proxy

Example Nginx config:

```nginx
server {
    listen 80;
    server_name app.example.com;

    location /api {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        root /var/www/hospital-frontend/dist;
        try_files $uri /index.html;
    }
}
```

This allows the frontend to be served from the same domain while API calls are routed to the backend.

## Database Deployment Notes

The application uses SQLite, which is a good fit for small to medium deployments and internal or regional applications. For production, make sure:

- the database file is stored on persistent disk
- file permissions are locked down
- backups are scheduled
- WAL mode remains enabled as configured by the app

## Demo Data and Seed Setup

The app seeds demo data when `SEED_DEMO_DATA=true`. This is independent of `NODE_ENV`, so a hosted demo can run in production mode and still populate itself. Seeding is idempotent, so it is safe to leave enabled. For a real hospital deployment, set `SEED_DEMO_DATA=false` and remove the `/api/setup-demo` endpoints. Do not copy demo credentials into a live hospital deployment.

In a local development environment, you can trigger demo setup manually:

```bash
curl http://localhost:3000/api/setup-demo
```

For production, it is usually better to disable or limit demo seeding unless it is part of the deployment flow.

## Testing

Run the test suite:

```bash
npm test
```

Coverage:

```bash
npm run test:coverage
```

## Security Checklist

Before production deployment, confirm:

- JWT secret is strong and stored securely
- HTTPS is enforced for all public traffic
- CORS is restricted to trusted origins
- database and uploads are on protected storage
- admin credentials are not left at default values
- `NODE_ENV=production` is set on the backend
- demo seed endpoints and demo credentials are disabled in production
- Swagger is disabled or protected in production
- logs and errors do not leak sensitive details

## Demo Deployment (single service)

The API and the built frontend ship as **one** Express process, so a demo needs only one
host and one domain. The server serves `frontend/dist` and falls back to `index.html` for
client-side routes, which means `VITE_API_BASE=/api` works unchanged.

State lives in two places: `DB_PATH` (SQLite) and `UPLOAD_DIR` (multer document uploads).
Both default to `/data` inside the container.

### Free hosting on Render

`render.yaml` provisions a **Free** Docker web service. No credit card, and `JWT_SECRET` is
generated automatically, so a Blueprint deploy needs no manual steps:

1. Connect the GitHub repo in the Render dashboard.
2. **New > Blueprint**, select the repo. Render reads `render.yaml` and creates the service.
3. Deploy.

The Free plan has an **ephemeral filesystem**: `/data` is wiped on every redeploy, restart,
and spin-down. This is acceptable for a demo because `SEED_DEMO_DATA=true` re-seeds the
database on every boot, so visitors always get a populated system. Any records created in
the UI are lost when the instance cycles. Persistent disks require a paid plan.

Free instances also spin down after 15 minutes idle and take roughly a minute to wake, so
the first visitor to an idle instance sees a loading page.

### Docker

```bash
docker build -t hms-demo .
docker run -d -p 3000:3000 \
  -e JWT_SECRET="$(openssl rand -hex 32)" \
  -e SEED_DEMO_DATA=true \
  --name hms-demo hms-demo
```

Omit the volume and the database resets whenever the container is recreated. Add
`-v hms-data:/data` to keep data across recreations:

```bash
docker run -d -p 3000:3000 -v hms-data:/data \
  -e JWT_SECRET="$(openssl rand -hex 32)" \
  -e SEED_DEMO_DATA=true --name hms-demo hms-demo
```

`docker-entrypoint.sh` creates and chowns `/data` at startup, then re-execs the server as
the unprivileged `node` user, because a mounted volume is normally owned by root.

### Other hosts

The image is portable. On Railway, Fly.io or any VPS, attach a volume at `/data` and set
the same environment variables.

### Required environment

| Variable | Purpose |
| --- | --- |
| `JWT_SECRET` | Required in production. The app refuses to boot without it. |
| `DB_PATH` | SQLite file location. Defaults to `/data/hospital.db`. |
| `UPLOAD_DIR` | Document upload directory. Defaults to `/data/uploads/documents`. |
| `SEED_DEMO_DATA` | `true` seeds demo users, roles, departments, and beds on boot. |
| `CORS_ORIGINS` | Comma-separated allowed origins. Same-origin serving means this is optional. |

### Demo credentials

Password equals the username in each case (`doctor` / `Doctor`, `superadmin` / `SuperAdmin`).
Ten roles exist: `superadmin`, `admin`, `receptionist`, `doctor`, `nurse`, `labtech`,
`pharmacy`, `radiology`, `billing`, `patient`. Swagger UI is at `/api-docs`.

## Security and Compliance Notes

This software still requires an organization-level security, privacy, backup, access-control, incident-response, and regulatory review before handling real patient data. Passing the application test suite does not by itself establish HIPAA or other regulatory compliance.

## License

This project is licensed under the ISC license.
