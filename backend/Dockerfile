# ==============================================================================
# ChitFlow Backend Production Dockerfile
# Multi-stage / hardened slim Python container with non-root execution
# ==============================================================================

FROM python:3.10-slim AS builder

WORKDIR /app

# Install build dependencies for C-extensions (bcrypt, psycopg2)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# --- Final Production Image ---
FROM python:3.10-slim AS runner

WORKDIR /app

# Install runtime dependencies for PostgreSQL and health checks
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create secure non-root user
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser

# Copy installed Python packages from builder
COPY --from=builder /root/.local /home/appuser/.local
ENV PATH=/home/appuser/.local/bin:$PATH
ENV PYTHONPATH=/app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV ENVIRONMENT=production

# Copy application source code
COPY app/ /app/app/
COPY gunicorn_conf.py /app/

# Set file ownership to non-root user
RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 8000

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Start production server using Gunicorn + Uvicorn workers
CMD ["gunicorn", "-c", "gunicorn_conf.py", "app.main:app"]
