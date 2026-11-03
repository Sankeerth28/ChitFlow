# ChitFlow — Production Deployment & Operations Guide

This guide details the complete production deployment procedures for the **ChitFlow Chit Fund Management System**.

---

## 1. Architecture Overview

ChitFlow is built as a cloud-native, multi-tenant financial platform:
- **Frontend**: React 19 + TypeScript + Vite, served via Nginx with SPA routing and security headers.
- **Backend**: FastAPI + Python 3.10 running under Gunicorn with multi-worker Uvicorn ASGI processes.
- **Database**: PostgreSQL 16+ with ACID transaction isolation and relational integrity constraints.
- **Security**: 12-round salted `bcrypt` password hashing, signed JWT tokens (`HS256`) with server-side `RevokedToken` session blacklist.

---

## 2. Production Environment Variables Checklist

Before launching, configure the following environment variables:

| Variable | Required | Description | Example / Recommended Value |
| :--- | :---: | :--- | :--- |
| `ENVIRONMENT` | **Yes** | Operating environment mode | `production` |
| `SECRET_KEY` | **Yes** | 256-bit cryptographic signing key for JWT | Generate with `openssl rand -hex 32` |
| `DATABASE_URL` | **Yes** | PostgreSQL connection URI | `postgresql+psycopg2://user:pass@host:5432/chitflow_prod` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | JWT validity lifetime (minutes) | `1440` (24 hours) |
| `ALLOW_DEMO_SEEDING` | **Yes** | Disables test accounts | Must be `false` in production |
| `CORS_ORIGINS` | **Yes** | Whitelisted frontend web origins | `https://chitflow.yourdomain.com` |
| `VITE_API_URL` | **Yes** | API endpoint for the React frontend | `https://api.yourdomain.com/api/v1` or `/api/v1` |

---

## 3. Deployment Option 1: Docker Compose (Self-Hosted / VPS / Cloud VM)

Recommended for AWS EC2, DigitalOcean Droplets, Hetzner, or any Linux VPS.

### Step 1: Clone the Repository
```bash
git clone https://github.com/Sankeerth28/ChitFlow.git
cd ChitFlow
```

### Step 2: Configure Environment Variables
```bash
cp .env.example .env
```
Edit `.env` and provide a cryptographically random secret and strong database password:
```bash
SECRET_KEY=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -base64 24)
```

### Step 3: Build & Launch the Containers
```bash
docker compose up -d --build
```

### Step 4: Verify Service Health
```bash
docker compose ps
docker compose logs -f backend
```
Test health endpoint:
```bash
curl -I http://localhost/health
curl -I http://localhost:8000/health
```

---

## 4. Deployment Option 2: Render.com Blueprint (PaaS)

ChitFlow includes a native [`render.yaml`](render.yaml) blueprint for automated zero-configuration deployment on Render.

1. Create a free or team account on [Render.com](https://render.com).
2. Go to **Blueprints** -> **New Blueprint Instance**.
3. Connect your GitHub repository `https://github.com/Sankeerth28/ChitFlow`.
4. Render will automatically provision:
   - `chitflow-db`: Managed PostgreSQL database.
   - `chitflow-api`: Python Web Service running Gunicorn + Uvicorn.
   - `chitflow-web`: Static React Site with automatic CDN edge caching.
5. Click **Apply**. Deployment will complete in ~3–5 minutes.

---

## 5. Deployment Option 3: Split Deployment (Backend on Render/Railway + Frontend on Vercel)

### Backend (Render / Railway)
- **Runtime**: Python 3.10
- **Root Directory**: `backend`
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `gunicorn -c gunicorn_conf.py app.main:app`
- **Required Env**: `ENVIRONMENT=production`, `SECRET_KEY`, `DATABASE_URL`, `ALLOW_DEMO_SEEDING=false`, `CORS_ORIGINS=https://your-frontend.vercel.app`

### Frontend (Vercel)
- **Framework Preset**: Vite
- **Root Directory**: `frontend`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Environment Variables**:
  - `VITE_API_URL`: `https://your-backend.onrender.com/api/v1`

---

## 6. SSL / TLS & Domain Setup

For Docker Compose deployments behind custom domains:
1. Point your domain DNS `A` records to the server's public IP address.
2. Install Certbot for Let's Encrypt SSL certificates:
   ```bash
   sudo apt install certbot python3-certbot-nginx -y
   sudo certbot --nginx -d yourdomain.com -d api.yourdomain.com
   ```
3. Or place Cloudflare in front with **Full (Strict)** SSL encryption.

---

## 7. Database Backups & High Availability

Chit funds are legally governed under the **Chit Funds Act, 1982**. Regular automated database backups are mandatory:

```bash
# Automated Daily Backup Script (Crontab)
0 2 * * * docker exec chitflow_db pg_dump -U chitflow_admin chitflow_prod | gzip > /backups/chitflow_$(date +\%F).sql.gz
```
Store backups in off-site encrypted storage (AWS S3 Glacier or Google Cloud Storage) with a 7-year retention policy.
