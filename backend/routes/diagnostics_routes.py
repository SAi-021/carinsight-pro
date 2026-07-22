"""
Diagnostics routes: serve the model metrics JSON and the diagnostic plot images.
"""

import os, json
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse, JSONResponse
from auth import get_current_user
import models as db_models

router = APIRouter(tags=["Diagnostics"])

ROOT_DIR    = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
REPORTS_DIR = os.path.join(ROOT_DIR, 'reports')
DIAG_PATH   = os.path.join(REPORTS_DIR, 'diagnostics.json')

VALID_KINDS = {'learning_curve', 'pred_vs_actual', 'confusion_matrix'}


@router.get("/diagnostics")
def get_diagnostics(user: db_models.User = Depends(get_current_user)):
    # Full diagnostics JSON: metrics, feature importance, learning curves.
    if not os.path.exists(DIAG_PATH):
        raise HTTPException(
            status_code=404,
            detail=("diagnostics.json not found. Run training first: "
                    "python ml/run_training.py")
        )
    with open(DIAG_PATH) as f:
        return json.load(f)


@router.get("/diagnostics/image/{kind}/{model_name}")
def get_diagnostics_image(
    kind: str,
    model_name: str,
    user: db_models.User = Depends(get_current_user),
):
    # Serve one diagnostic PNG (learning curve, predicted-vs-actual, etc.).
    if kind not in VALID_KINDS:
        raise HTTPException(status_code=400, detail=f"Invalid kind. Must be one of {VALID_KINDS}")

    safe_name = model_name.lower().replace(' ', '_').replace('/', '')
    filename = f"{kind}_{safe_name}.png"
    path = os.path.join(REPORTS_DIR, filename)

    if not os.path.exists(path):
        raise HTTPException(
            status_code=404,
            detail=f"Image not found: {filename}. Run training to generate it."
        )
    return FileResponse(path, media_type='image/png')