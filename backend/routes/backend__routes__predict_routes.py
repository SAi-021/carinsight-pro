"""
=============================================================
  CarInsight Pro — Prediction Routes
  File   : backend/routes/predict_routes.py
  Endpoints:
    POST /predict-price
    POST /resale-value
    GET  /history
    GET  /brands
    GET  /models/{brand}
=============================================================
"""

from fastapi      import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing       import List, Optional
import sys, os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(
    os.path.dirname(os.path.abspath(__file__)))), 'ml'))

from database import get_db
from auth     import get_current_user
from schemas  import (PredictRequest, PredictResponse,
                      ResaleRequest, ResaleResponse,
                      PredictionHistoryItem)
import models

from predictor  import predict_price, get_known_brands, get_known_models
from valuation  import calculate_resale_value

router = APIRouter(tags=["Predictions"])


# ── POST /predict-price ───────────────────────────────────────────────────────
@router.post("/predict-price", response_model=PredictResponse)
def predict_price_endpoint(
    req  : PredictRequest,
    db   : Session      = Depends(get_db),
    user : models.User  = Depends(get_current_user),
):
    """
    Predict market selling price using the best ML model.
    Returns price + confidence level + fallback explanation.
    """
    result = predict_price(
        brand        = req.brand,
        year         = req.year,
        km_driven    = req.km_driven,
        fuel         = req.fuel.value,
        transmission = req.transmission.value,
        owner        = req.owner,
        seller_type  = req.seller_type.value,
        brand_model  = req.brand_model,
    )

    # Save to DB
    db_pred = models.Prediction(
        user_id         = user.id,
        brand           = req.brand,
        brand_model     = req.brand_model,
        year            = req.year,
        km_driven       = req.km_driven,
        fuel            = req.fuel.value,
        transmission    = req.transmission.value,
        owner           = req.owner,
        seller_type     = req.seller_type.value,
        predicted_price = result["predicted_price"],
        model_used      = result["model_used"],
        confidence      = result["confidence"],
        fallback_level  = result["fallback_level"],
    )
    db.add(db_pred)
    db.commit()

    return {
        **result,
        "predicted_price_lakh": round(result["predicted_price"] / 100000, 2),
    }


# ── POST /resale-value ────────────────────────────────────────────────────────
@router.post("/resale-value", response_model=ResaleResponse)
def resale_value_endpoint(
    req  : ResaleRequest,
    db   : Session     = Depends(get_db),
    user : models.User = Depends(get_current_user),
):
    """
    Hybrid resale valuation: 60% ML + 40% rule-based depreciation.
    Returns ML price, rule price, blended final price, scrap value,
    and a full factor breakdown for transparency.
    """
    final, scrap, age, breakdown = calculate_resale_value(
        purchase_price = req.purchase_price,
        current_price  = req.current_price,
        year           = req.year,
        kms            = req.km_driven,
        fuel           = req.fuel.value,
        mileage        = req.mileage,
        accident       = req.accident,
        condition      = req.condition.value,
        owner          = req.owner,
        selling_type   = req.selling_type,
        brand          = req.brand,
        model_name     = req.brand_model,
        transmission   = req.transmission.value,
        fitness_status = req.fitness_status,
    )

    if isinstance(breakdown, dict) and "error" in breakdown:
        raise HTTPException(status_code=400, detail=breakdown["error"])

    # Save to DB
    db_log = models.ResaleLog(
        user_id        = user.id,
        brand          = req.brand,
        brand_model    = req.brand_model,
        year           = req.year,
        km_driven      = req.km_driven,
        fuel           = req.fuel.value,
        mileage        = req.mileage,
        condition      = req.condition.value,
        accident       = req.accident,
        owner          = req.owner,
        selling_type   = req.selling_type,
        transmission   = req.transmission.value,
        fitness_status = req.fitness_status,
        purchase_price = req.purchase_price,
        current_price  = req.current_price,
        ml_price       = breakdown.get("ml_price", 0),
        rule_price     = breakdown.get("rule_price", 0),
        final_price    = final,
        scrap_value    = scrap,
        car_age        = age,
    )
    db.add(db_log)
    db.commit()

    return {
        "ml_price"         : breakdown.get("ml_price", 0),
        "rule_price"       : breakdown.get("rule_price", 0),
        "final_price"      : final,
        "final_price_lakh" : round(final / 100000, 2),
        "scrap_value"      : scrap,
        "car_age"          : age,
        "blend"            : breakdown.get("blend", ""),
        "factors"          : breakdown.get("factors", {}),
    }


# ── GET /history ──────────────────────────────────────────────────────────────
@router.get("/history", response_model=List[PredictionHistoryItem])
def get_history(
    limit: int         = 20,
    db   : Session     = Depends(get_db),
    user : models.User = Depends(get_current_user),
):
    """Return last N price predictions for the logged-in user."""
    # NOTE: User model has `name`, not `username`. Wrapped in try/except
    # so a logging issue can never crash the endpoint again.
    try:
        total_in_db = db.query(models.Prediction).count()
        user_count  = (db.query(models.Prediction)
                       .filter(models.Prediction.user_id == user.id).count())
        print(f"[/history] user_id={user.id} name={user.name} "
              f"| total_in_db={total_in_db} | matched_by_user={user_count}")
    except Exception as _log_err:
        print(f"[/history] debug log skipped: {_log_err}")

    records = (
        db.query(models.Prediction)
        .filter(models.Prediction.user_id == user.id)
        .order_by(models.Prediction.created_at.desc())
        .limit(limit)
        .all()
    )
    print(f"[/history] returning {len(records)} records")
    return records


# ── GET /brands ───────────────────────────────────────────────────────────────
@router.get("/brands")
def list_brands():
    """Return all brand names known to the ML model (for frontend dropdown)."""
    return {"brands": get_known_brands()}


# ── GET /models/{brand} ───────────────────────────────────────────────────────
@router.get("/models/{brand}")
def list_models(brand: str):
    """Return all models for a specific brand (for frontend dropdown)."""
    models_list = get_known_models(brand)
    if not models_list:
        return {"brand": brand, "models": [], "note": "Brand not in dataset"}
    return {"brand": brand, "models": models_list}
