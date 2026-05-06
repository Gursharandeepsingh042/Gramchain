"""
GramChain ML Service — FastAPI Credit Scoring API
"""
import os
from fastapi import FastAPI, Depends, HTTPException, Security
from fastapi.security.api_key import APIKeyHeader
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

from api.routes.score import router as score_router

# ─── Security ───────────────────────────────────────────────
API_KEY_NAME = "X-Internal-Secret"
api_key_header = APIKeyHeader(name=API_KEY_NAME, auto_error=True)

async def verify_internal_secret(api_key: str = Security(api_key_header)):
    expected_secret = os.getenv("ML_INTERNAL_SECRET", "dev-secret-key-change-in-prod")
    if api_key != expected_secret:
        raise HTTPException(status_code=403, detail="Forbidden: Invalid internal secret")
    return api_key

app = FastAPI(
    title="GramChain ML Service",
    description="Credit scoring API for rural SHG micro-lending",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS — Restrict to backend internal network only in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "").split(",") if os.getenv("ALLOWED_ORIGINS") else ["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=[API_KEY_NAME, "Content-Type"],
)

# Include routers with security dependency
app.include_router(
    score_router,
    prefix="/score",
    tags=["Credit Scoring"],
    dependencies=[Depends(verify_internal_secret)]
)

@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "service": "gramchain-ml", "version": "1.0.0"}


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={"success": False, "error": str(exc)},
    )


if __name__ == "__main__":
    uvicorn.run("api.main:app", host="0.0.0.0", port=8000, reload=True)
