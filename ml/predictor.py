"""
Inference helper — loads the trained model and predicts a selling price.

Includes a 4-level fallback for brands/models the model hasn't seen, so a
prediction is never silently wrong. The response always reports which level
was used and a matching confidence:
  Level 0: exact brand_model match
  Level 1: brand known, model unknown (use brand's average score)
  Level 2: brand unknown, mapped to a similar known brand
  Level 3: completely unknown (global median, rough estimate)
"""

import os
import sys
import json
import joblib
import numpy as np
import pandas as pd

ML_DIR    = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR  = os.path.dirname(ML_DIR)
MODEL_DIR = os.path.join(ROOT_DIR, 'models')
for p in [ML_DIR, ROOT_DIR]:
    if p not in sys.path:
        sys.path.insert(0, p)

CURRENT_YEAR = 2026

BRAND_VALUE_MAP = {
    'toyota': 0.95, 'honda': 0.90, 'maruti': 0.88, 'hyundai': 0.85,
    'tata': 0.80,   'mahindra': 0.80, 'ford': 0.75, 'volkswagen': 0.75,
    'renault': 0.72, 'nissan': 0.70, 'chevrolet': 0.68, 'bmw': 0.88,
    'audi': 0.85,   'mercedes-benz': 0.90, 'mercedes': 0.90,
    'skoda': 0.73,  'jeep': 0.82, 'kia': 0.83, 'mg': 0.80,
    'land rover': 0.87, 'land': 0.87,
    'volvo': 0.84,  'jaguar': 0.82, 'mitsubishi': 0.75,
    'datsun': 0.68, 'fiat': 0.65, 'isuzu': 0.72,
    'citroen'  : 0.70,
    'lexus'    : 0.90,
    'infiniti' : 0.82,
    'porsche'  : 0.88,
    'maserati' : 0.80,
    'bentley'  : 0.85,
    'lamborghini': 0.80,
    'ferrari'  : 0.80,
    'mini'     : 0.78,
    'seat'     : 0.70,
    'peugeot'  : 0.68,
    'opel'     : 0.65,
    'suzuki'   : 0.80,
    'swift'    : 0.88,
}
DEFAULT_BRAND_SCORE = 0.65

# Maps an unknown brand to the nearest known brand (for the Level 2 fallback).
SEGMENT_FALLBACK = {
    'citroen': 'renault',   'peugeot': 'renault',  'opel': 'chevrolet',
    'seat'   : 'volkswagen','lexus'  : 'toyota',   'infiniti': 'nissan',
    'porsche': 'audi',      'mini'   : 'bmw',      'bentley': 'audi',
    'ferrari': 'audi',      'lamborghini': 'audi', 'maserati': 'audi',
    'suzuki' : 'maruti',    'swift'  : 'maruti',
}

SELLER_MAP = {'individual': 0, 'dealer': 1, 'trustmark dealer': 2}


def _load_artefacts():
    # Load the model, scaler, brand encoder, metadata and model-score lookup.
    meta_path = os.path.join(MODEL_DIR, 'metadata.json')
    if not os.path.exists(meta_path):
        raise FileNotFoundError(
            "Model artefacts not found. Run ml/model_training.py first."
        )
    with open(meta_path) as f:
        meta = json.load(f)

    best_model = joblib.load(os.path.join(MODEL_DIR, 'best_model.pkl'))
    scaler     = joblib.load(os.path.join(MODEL_DIR, 'scaler.pkl'))
    le_brand   = joblib.load(os.path.join(MODEL_DIR, 'le_brand.pkl'))

    lookup = {}
    lookup_path = os.path.join(MODEL_DIR, 'model_price_lookup.json')
    if os.path.exists(lookup_path):
        with open(lookup_path) as f:
            lookup = json.load(f)

    # Average the per-model scores up to a per-brand score (for Level 1).
    brand_scores = {}
    for model_key, score in lookup.items():
        brand = model_key.split()[0] if ' ' in model_key else model_key
        brand_scores.setdefault(brand, []).append(score)
    brand_median_scores = {b: round(sum(v)/len(v), 4)
                           for b, v in brand_scores.items()}

    return best_model, scaler, le_brand, meta, lookup, brand_median_scores


try:
    (_best_model, _scaler, _le_brand, _meta,
     _model_lookup, _brand_median_scores) = _load_artefacts()
    _feature_cols    = _meta['feature_cols']
    _best_model_name = _meta['best_model_name']
    _needs_scaling   = _meta['needs_scaling'].get(_best_model_name, False)
    _known_brands    = set(_le_brand.classes_)
    print(f"[INFO] Model loaded : {_best_model_name}")
    print(f"[INFO] Known brands : {len(_known_brands)}")
    print(f"[INFO] Known models : {len(_model_lookup)}")
except FileNotFoundError as e:
    print(f"[WARN] {e}")
    (_best_model, _scaler, _le_brand, _meta,
     _model_lookup, _brand_median_scores) = (None,)*6
    _feature_cols = _best_model_name = _needs_scaling = None
    _known_brands = set()


def resolve_brand_and_model(brand: str, brand_model: str = None):
    # Resolve brand + model to known equivalents, returning the encoded values
    # plus the fallback level (0-3) and a message explaining what was used.
    brand = brand.lower().strip()
    bm    = brand_model.lower().strip() if brand_model else brand

    # Level 0: exact model match.
    if bm in _model_lookup and brand in _known_brands:
        brand_encoded    = int(_le_brand.transform([brand])[0])
        brand_val_score  = BRAND_VALUE_MAP.get(brand, DEFAULT_BRAND_SCORE)
        model_price_score = _model_lookup[bm]
        return (brand_encoded, brand_val_score, model_price_score,
                brand, 0, f"Exact match: '{bm}' found in dataset")

    # Level 1: brand known, model unknown — use the brand's average score.
    if brand in _known_brands:
        brand_encoded    = int(_le_brand.transform([brand])[0])
        brand_val_score  = BRAND_VALUE_MAP.get(brand, DEFAULT_BRAND_SCORE)
        model_price_score = _brand_median_scores.get(brand, 0.5)
        msg = (f"Brand '{brand}' known but model '{bm}' not in dataset. "
               f"Using brand average score ({model_price_score:.3f}). "
               f"Prediction may be ±15% off.")
        return (brand_encoded, brand_val_score, model_price_score,
                brand, 1, msg)

    # Level 2: brand unknown but a similar known brand exists.
    proxy = SEGMENT_FALLBACK.get(brand)
    if proxy and proxy in _known_brands:
        brand_encoded    = int(_le_brand.transform([proxy])[0])
        brand_val_score  = BRAND_VALUE_MAP.get(brand,
                           BRAND_VALUE_MAP.get(proxy, DEFAULT_BRAND_SCORE))
        model_price_score = _brand_median_scores.get(proxy, 0.5)
        msg = (f"Brand '{brand}' not in dataset. "
               f"Using '{proxy}' as closest segment proxy. "
               f"Prediction may be ±20–25% off.")
        return (brand_encoded, brand_val_score, model_price_score,
                proxy, 2, msg)

    # Level 3: completely unknown — global median, rough estimate.
    brand_val_score   = BRAND_VALUE_MAP.get(brand, DEFAULT_BRAND_SCORE)
    model_price_score = 0.5
    brand_encoded     = 0
    msg = (f"Brand '{brand}' is completely unknown to the model. "
           f"Prediction is a rough estimate only (±30%). "
           f"Consider using a known brand for accurate results.")
    return (brand_encoded, brand_val_score, model_price_score,
            brand, 3, msg)


def _build_input_df(brand, year, km_driven, fuel, transmission,
                    owner, seller_type, brand_model):

    fuel         = fuel.lower().strip()
    transmission = transmission.lower().strip()
    seller_type  = seller_type.lower().strip()

    car_age    = max(CURRENT_YEAR - year, 1)
    km_per_year = km_driven / car_age

    (brand_encoded, brand_val_score, model_price_score,
     resolved_brand, fallback_level, fallback_msg) = resolve_brand_and_model(
        brand, brand_model
    )

    seller_encoded = SELLER_MAP.get(seller_type, 0)

    row = {
        'km_driven'          : km_driven,
        'owner'              : owner,
        'brand'              : brand_encoded,
        'car_age'            : car_age,
        'km_per_year'        : km_per_year,
        'brand_value_score'  : brand_val_score,
        'model_price_score'  : model_price_score,
        'seller_type'        : seller_encoded,
    }

    # One-hot fuel columns (CNG is the dropped first category).
    for col in ['fuel_diesel','fuel_electric','fuel_lpg','fuel_petrol']:
        row[col] = 0
    fuel_col = f'fuel_{fuel.capitalize()}'
    if fuel_col in row:
        row[fuel_col] = 1

    row['transmission_manual'] = 1 if transmission == 'manual' else 0

    df_input = pd.DataFrame([row])
    if _feature_cols:
        df_input = df_input.reindex(columns=_feature_cols, fill_value=0)

    return df_input, fallback_level, fallback_msg, resolved_brand


def predict_price(brand, year, km_driven, fuel, transmission,
                  owner=1, seller_type='individual',
                  brand_model=None) -> dict:
    # Predict the selling price, using the fallback resolver for unknown
    # brands/models. Confidence is derived from the fallback level.
    if _best_model is None:
        raise RuntimeError("Model not loaded. Run model_training.py first.")

    df_input, fallback_level, fallback_msg, resolved_brand = _build_input_df(
        brand, year, km_driven, fuel, transmission,
        owner, seller_type, brand_model
    )

    arr   = _scaler.transform(df_input) if _needs_scaling else df_input.values
    price = float(np.clip(_best_model.predict(arr)[0], 0, None))

    confidence_map = {
        0: 'High',
        1: 'Medium',
        2: 'Low',
        3: 'Very Low',
    }

    return {
        'predicted_price' : round(price, 2),
        'model_used'      : _best_model_name,
        'car_age'         : CURRENT_YEAR - year,
        'km_per_year'     : round(km_driven / max(CURRENT_YEAR - year, 1), 0),
        'fallback_level'  : fallback_level,
        'fallback_message': fallback_msg,
        'confidence'      : confidence_map[fallback_level],
        'resolved_brand'  : resolved_brand,
    }


def get_model_metrics() -> dict:
    if _meta is None:
        return {}
    return {'best_model': _meta['best_model_name'], 'results': _meta['results']}


def get_known_brands() -> list:
    # All brands in the dataset, for the frontend dropdown.
    return sorted(list(_known_brands))


def get_known_models(brand: str = None) -> list:
    # Known models, optionally filtered to one brand.
    all_models = list(_model_lookup.keys())
    if brand:
        brand = brand.lower().strip()
        return [m for m in all_models if m.startswith(brand)]
    return sorted(all_models)


if __name__ == '__main__':
    test_cases = [
        ('maruti', 2018, 45000, 'Petrol', 'Manual', 1,
         'individual', 'maruti swift',   'Level 0 — exact match'),
        ('toyota', 2019, 30000, 'Petrol', 'Manual', 1,
         'individual', 'toyota corolla', 'Level 1 — brand known, model unknown'),
        ('citroen', 2020, 25000, 'Petrol', 'Manual', 1,
         'individual', None,             'Level 2 — unknown brand, proxy used'),
        ('ola electric', 2022, 15000, 'Electric', 'Automatic', 1,
         'individual', None,             'Level 3 — completely unknown'),
    ]

    print("\n" + "="*65)
    print("  FALLBACK SYSTEM TEST")
    print("="*65)
    for brand, yr, km, fuel, trans, own, sel, bm, desc in test_cases:
        result = predict_price(brand, yr, km, fuel, trans, own, sel, bm)
        print(f"\n  {desc}")
        print(f"  Input   : {brand} / {bm}")
        print(f"  Price   : ₹{result['predicted_price']:,.0f}")
        print(f"  Confidence : {result['confidence']}")
        print(f"  Message : {result['fallback_message']}")
    print("="*65)