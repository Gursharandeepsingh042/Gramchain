"""
GramChain ML Service — FastAPI Credit Scoring API
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

from api.routes.score import router as score_router

app = FastAPI(
    title="GramChain ML Service",
    description="Credit scoring API for rural SHG micro-lending",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS — allow all origins in dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(score_router, prefix="/score", tags=["Credit Scoring"])


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
