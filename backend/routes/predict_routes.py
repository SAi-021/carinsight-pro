"""
Prediction routes: price prediction, resale value, history, and the
brand/model dropdown lookups.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
import sys, os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(
    os.path.dirname(os.path.abspath(__file__)))), 'ml'))

from database import get_db
from auth import get_current_user
from schemas import (PredictRequest, PredictResponse,
                     ResaleRequest, ResaleResponse,
                     PredictionHistoryItem)
import models

from predictor import predict_price, get_known_brands, get_known_models
from valuation import calculate_resale_value

router = APIRouter(tags=["Predictions"])


@router.post("/predict-price", response_model=PredictResponse)
def predict_price_endpoint(
    req  : PredictRequest,
    db   : Session      = Depends(get_db),
    user : models.User  = Depends(get_current_user),
):
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


@router.post("/resale-value", response_model=ResaleResponse)
def resale_value_endpoint(
    req  : ResaleRequest,
    db   : Session     = Depends(get_db),
    user : models.User = Depends(get_current_user),
):
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


@router.get("/history")
def get_history(
    limit: int         = 20,
    db   : Session     = Depends(get_db),
    user : models.User = Depends(get_current_user),
):
    # Last N predictions for this user. Built manually with safe type
    # conversion (and no response_model) so a malformed old row can't crash it.
    try:
        records = (
            db.query(models.Prediction)
            .filter(models.Prediction.user_id == user.id)
            .order_by(models.Prediction.created_at.desc())
            .limit(limit)
            .all()
        )
    except Exception as e:
        print(f"[/history] query error: {e}")
        return []

    def num(v):
        try:    return float(v) if v is not None else None
        except: return None
    def integer(v):
        try:    return int(v) if v is not None else None
        except: return None

    out = []
    for r in records:
        out.append({
            "id"              : integer(getattr(r, "id", None)),
            "brand"           : getattr(r, "brand", None),
            "brand_model"     : getattr(r, "brand_model", None),
            "year"            : integer(getattr(r, "year", None)),
            "km_driven"       : num(getattr(r, "km_driven", None)),
            "fuel"            : getattr(r, "fuel", None),
            "predicted_price" : num(getattr(r, "predicted_price", None)),
            "confidence"      : getattr(r, "confidence", None),
            "model_used"      : getattr(r, "model_used", None),
            "created_at"      : r.created_at.isoformat() if getattr(r, "created_at", None) else None,
        })

    print(f"[/history] returning {len(out)} records")
    return out


@router.get("/brands")
def list_brands():
    # All brand names known to the model, for the frontend dropdown.
    return {"brands": get_known_brands()}


@router.get("/models/{brand}")
def list_models(brand: str):
    # All models for one brand, for the frontend dropdown.
    models_list = get_known_models(brand)
    if not models_list:
        return {"brand": brand, "models": [], "note": "Brand not in dataset"}
    return {"brand": brand, "models": models_list}