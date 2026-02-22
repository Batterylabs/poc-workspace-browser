"""
Workspace Browser — FastAPI server
Run with: uvicorn backend.server:app --host 0.0.0.0 --port 8081
"""
import logging
import sys
from pathlib import Path

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from backend.config import AUTH_TOKEN, PORT, WORKSPACE_ROOT
from backend.db import init_db
from backend.routers import files as files_router
from backend.routers import annotations as annotations_router

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("workspace-browser")

# ── FastAPI app ───────────────────────────────────────────────────────────────
app = FastAPI(title="Workspace Browser", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Auth middleware ───────────────────────────────────────────────────────────
UNPROTECTED = {"/", "/health"}


@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    path = request.url.path

    # Allow health check and static assets without token
    if path == "/health" or path.startswith("/assets/") or path == "/favicon.ico":
        return await call_next(request)

    # For API routes, require Bearer token
    if path.startswith("/api/"):
        # Check Authorization header
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
        else:
            # Also accept token as query param
            token = request.query_params.get("token", "")

        if token != AUTH_TOKEN:
            return JSONResponse(status_code=401, content={"detail": "Unauthorized"})

    return await call_next(request)


# ── Startup ───────────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    await init_db()
    logger.info("=" * 60)
    logger.info("  Workspace Browser started")
    logger.info(f"  URL:   http://0.0.0.0:{PORT}")
    logger.info(f"  Token: {AUTH_TOKEN}")
    logger.info(f"  Root:  {WORKSPACE_ROOT}")
    logger.info("=" * 60)
    logger.info(f"  Access: http://localhost:{PORT}/?token={AUTH_TOKEN}")
    logger.info("=" * 60)


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}


# ── API routers ───────────────────────────────────────────────────────────────
app.include_router(files_router.router)
app.include_router(annotations_router.router)

# ── Static frontend ───────────────────────────────────────────────────────────
DIST_DIR = Path(__file__).parent.parent / "dist"

if DIST_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(DIST_DIR / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str, token: str = ""):
        """Serve the SPA for all non-API routes. Auth via query param on first load."""
        index = DIST_DIR / "index.html"
        if index.exists():
            return FileResponse(str(index))
        return JSONResponse({"error": "Frontend not built. Run: npm run build"}, status_code=503)
else:
    @app.get("/")
    async def no_frontend():
        return JSONResponse(
            {"message": "Backend running. Frontend not built yet.", "token": AUTH_TOKEN},
            status_code=200,
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.server:app", host="0.0.0.0", port=PORT, reload=False)
