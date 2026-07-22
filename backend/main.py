"""
FastAPI application entry point.
Run with: python -m uvicorn main:app --reload --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import sys, os, json

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR    = os.path.dirname(BACKEND_DIR)
ML_DIR      = os.path.join(ROOT_DIR, 'ml')

for p in [BACKEND_DIR, ROOT_DIR, ML_DIR]:
    if p not in sys.path:
        sys.path.insert(0, p)

app = FastAPI(
    title       = "CarInsight Pro API",
    description = "AI-powered car price prediction, resale valuation & advisory",
    version     = "1.0.0",
    docs_url    = "/docs",
    redoc_url   = "/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins     = ["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)

# Register all the route modules
from routes.auth_routes        import router as auth_router
from routes.predict_routes     import router as predict_router
from routes.other_routes       import router as other_router
from routes.diagnostics_routes import router as diagnostics_router
from routes.admin_routes       import router as admin_router

app.include_router(auth_router)
app.include_router(predict_router)
app.include_router(other_router)
app.include_router(diagnostics_router)
app.include_router(admin_router)


@app.get("/", tags=["Health"])
def root():
    return {
        "status"  : "running",
        "app"     : "CarInsight Pro API",
        "version" : "1.0.0",
        "docs"    : "http://localhost:8000/docs",
    }

@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok"}


@app.on_event("startup")
async def startup_event():
    # Create tables and seed model metrics on first run. This runs after the
    # server starts, so a DB hiccup doesn't stop the app from booting.
    try:
        from database import engine, SessionLocal, Base
        import models

        Base.metadata.create_all(bind=engine)
        print("[INFO] Database tables created/verified")

        # Load the trained-model metrics from metadata.json into the DB (once).
        META_PATH = os.path.join(ROOT_DIR, 'models', 'metadata.json')
        if os.path.exists(META_PATH):
            db = SessionLocal()
            try:
                if db.query(models.ModelMetric).count() == 0:
                    with open(META_PATH) as f:
                        meta = json.load(f)
                    best = meta['best_model_name']
                    for name, m in meta['results'].items():
                        db.add(models.ModelMetric(
                            model_name = name,
                            mae        = m['MAE'],
                            mse        = m['MSE'],
                            rmse       = m['RMSE'],
                            r2_score   = m['R2'],
                            r2_train   = m.get('R2_train', 0),
                            cv_r2_mean = m['CV_R2_mean'],
                            cv_r2_std  = m['CV_R2_std'],
                            is_best    = (name == best),
                        ))
                    db.commit()
                    print("[INFO] Seeded model_metrics table")
            except Exception as e:
                print(f"[WARN] Could not seed model_metrics: {e}")
                db.rollback()
            finally:
                db.close()

    except Exception as e:
        print(f"[ERROR] DB startup failed: {e}")
        print("[HINT] Check DB_PASSWORD in backend/database.py")
        print("[HINT] Make sure MySQL is running: net start MySQL80")