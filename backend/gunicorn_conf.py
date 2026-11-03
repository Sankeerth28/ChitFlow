"""
ChitFlow Production Gunicorn Configuration
Manages multi-process Uvicorn ASGI workers for high throughput and fault tolerance.
"""

import os

# Server socket
bind = f"0.0.0.0:{os.getenv('PORT', '8000')}"
backlog = 2048

# Worker processes: 2 workers default for 512MB RAM cloud tiers
workers = int(os.getenv("WEB_CONCURRENCY", "2"))
worker_class = "uvicorn.workers.UvicornWorker"
worker_connections = 1000
timeout = int(os.getenv("WEB_TIMEOUT", "120"))
keepalive = 5

# Process naming
proc_name = "chitflow_api"

# Logging
accesslog = "-"
errorlog = "-"
loglevel = os.getenv("LOG_LEVEL", "info")
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" (%(D)s µs)'
