"""
Feature routes: recommendations, finance decision, dashboard, history, wishlist.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
import sys, os
import pandas as pd
import numpy as np
import json
import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(
    os.path.dirname(os.path.abspath(__file__)))), 'ml'))

from database import get_db
from auth import get_current_user
from schemas import (RecommendRequest, RecommendResponse,
                     FinanceRequest, FinanceResponse,
                     DashboardResponse, ModelComparisonResponse,
                     WishlistAddRequest, WishlistItem, MessageResponse)
import models

router = APIRouter(tags=["Features"])

ROOT_DIR  = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA_PATH = os.path.join(ROOT_DIR, 'data', 'final_dataset.csv')
MODEL_DIR = os.path.join(ROOT_DIR, 'models')
META_PATH = os.path.join(MODEL_DIR, 'metadata.json')

CURRENT_YEAR = 2026

# Dataset is loaded once and cached in this module-level variable.
_df_cars = None
def _get_cars_df():
    global _df_cars
    if _df_cars is None:
        _df_cars = pd.read_csv(DATA_PATH)
        _df_cars.columns = _df_cars.columns.str.lower().str.strip()
        _df_cars['fuel']  = _df_cars['fuel'].str.lower().str.strip()
        _df_cars['brand'] = _df_cars['brand'].str.lower().str.strip()
        _df_cars['selling_price'] = pd.to_numeric(
            _df_cars['selling_price'], errors='coerce')
        _df_cars.dropna(subset=['selling_price'], inplace=True)
    return _df_cars


# The dataset has no seats column, so 7-seaters are inferred from the model name.
SEVEN_SEATER_KEYWORDS = ['fortuner','innova','scorpio','xuv','endeavour',
                         'safari','hexa','triber','ertiga','carens',
                         'carnival','marazzo','rumion','gloster',
                         'mahindra alturas','tata aria','range rover',
                         'discovery','q7','x7','gls','gle','xc90']


def _build_response(selected_rows, budget, total_count, warning_msg,
                    dataset_max, used_filter, db, user, req):
    # Turn the chosen rows into the JSON payload and log the recommendation.
    result_list = []
    for row in selected_rows:
        display_price = float(row.get('price_median', row.get('selling_price', 0)))
        result_list.append({
            "brand"              : str(row.get('brand', '')),
            "brand_model"        : str(row.get('brand_model', '')),
            "year"               : int(row.get('year', 0)),
            "fuel"               : str(row.get('fuel', '')),
            "km_driven"          : float(row.get('km_driven', 0)),
            "selling_price"      : display_price,
            "selling_price_lakh" : round(display_price / 100000, 2),
            "score"              : round(float(row['_score']), 1),
            "reason"             : str(row['_reason']),
            "budget_use_pct"     : float(row['_budget_pct']),
            "match_quality"      : str(row['_match_quality']),
        })

    try:
        db_rec = models.Recommendation(
            user_id   = user.id,
            budget    = budget,
            purpose   = req.purpose.value,
            seats     = req.seats,
            fuel_pref = req.fuel_pref.value if req.fuel_pref else None,
            results   = result_list,
        )
        db.add(db_rec)
        db.commit()
    except Exception:
        db.rollback()

    return {
        "total_found": total_count,
        "budget_lakh": round(budget / 100000, 2),
        "cars"       : result_list,
        "warning"    : warning_msg,
        "dataset_max": dataset_max,
        "used_filter": used_filter,
    }


@router.post("/recommend", response_model=RecommendResponse)
def recommend(
    req  : RecommendRequest,
    db   : Session     = Depends(get_db),
    user : models.User = Depends(get_current_user),
):
    df = _get_cars_df().copy()
    budget = float(req.budget)
    dataset_max = float(df['selling_price'].max())
    dataset_p95 = float(df['selling_price'].quantile(0.95))
    dataset_p05 = float(df['selling_price'].quantile(0.05))

    warning_msg = None
    pref_notes = []   # preference-mismatch notes, combined into the warning at the end

    # Warn if the budget sits well outside what the dataset covers.
    if budget > dataset_max * 2.0:
        warning_msg = (
            f"Your budget of ₹{budget/100000:.1f} L far exceeds anything in our dataset "
            f"(top end ₹{dataset_max/100000:.1f} L). Showing the most premium cars we have."
        )
    elif budget > dataset_p95 * 1.10:
        warning_msg = (
            f"Your budget of ₹{budget/100000:.1f} L is higher than 95% of cars in our "
            f"dataset. Showing top matches up to ₹{dataset_max/100000:.1f} L."
        )
    elif budget < dataset_p05:
        warning_msg = (
            f"Your budget of ₹{budget/100000:.1f} L is on the low end of our dataset. "
            f"Results may be limited."
        )

    # Keep one row per model (the newest, lowest-km listing) plus per-model price stats.
    df_sorted = df.sort_values(
        ['brand_model', 'year', 'km_driven'],
        ascending=[True, False, True]
    )
    model_stats = df.groupby('brand_model').agg(
        price_min    =('selling_price', 'min'),
        price_max    =('selling_price', 'max'),
        price_median =('selling_price', 'median'),
        listings     =('selling_price', 'count'),
    ).reset_index()
    deduped = df_sorted.drop_duplicates(subset=['brand_model'], keep='first').copy()
    deduped = deduped.merge(model_stats, on='brand_model', how='left')

    # Special case: budget far above the dataset — just show the most premium cars.
    if budget > dataset_max * 2.0:
        top_premium = deduped.nlargest(15, 'price_median').copy()
        top_premium['_score']      = [85.0, 82.0, 80.0] + [70.0] * (len(top_premium) - 3)
        top_premium['_reason']     = ['Most premium option available'] * len(top_premium)
        top_premium['_budget_pct'] = [round(p/budget*100, 2) for p in top_premium['price_median']]
        top_premium['_match_quality'] = ['Below budget'] * len(top_premium)

        seen, picks = set(), []
        for _, row in top_premium.iterrows():
            if row['brand'] not in seen:
                picks.append(row); seen.add(row['brand'])
            if len(picks) == 3: break
        return _build_response(picks, budget, len(deduped), warning_msg,
                              dataset_max, "Top premium (budget far exceeds dataset)",
                              db, user, req)

    # Filter to cars near the budget, widening the band if too few match.
    bp = deduped['price_median'].fillna(deduped['selling_price'])
    lo, hi = budget * 0.65, budget * 1.10

    filtered = deduped[(bp >= lo) & (bp <= hi)].copy()
    used_filter = f"65-110% of budget (₹{lo/100000:.1f}L – ₹{hi/100000:.1f}L)"

    if len(filtered) < 3:
        lo = budget * 0.40
        filtered = deduped[(bp >= lo) & (bp <= hi)].copy()
        used_filter = f"40-110% of budget (₹{lo/100000:.1f}L – ₹{hi/100000:.1f}L)"

    if len(filtered) < 3:
        filtered = deduped[bp <= hi].copy()
        used_filter = f"Anything ≤ ₹{hi/100000:.1f}L"

    if len(filtered) == 0:
        filtered = deduped.nlargest(30, 'price_median').copy()
        used_filter = f"Top {len(filtered)} most premium (budget exceeds dataset)"
        if not warning_msg:
            warning_msg = (
                f"No cars in our dataset reach ₹{budget/100000:.1f} L. "
                f"Showing the most premium options we have."
            )

    if len(filtered) == 0:
        raise HTTPException(
            status_code=404,
            detail=f"No cars found. Try a different budget."
        )

    # Seats preference: prefer 7-seaters if asked, but fall back with a note
    # rather than returning nothing when none are in budget.
    if req.seats >= 7:
        suv_mask = filtered['brand_model'].str.lower().apply(
            lambda m: any(kw in m for kw in SEVEN_SEATER_KEYWORDS)
        )
        n_seven = int(suv_mask.sum())
        if n_seven >= 1:
            filtered = filtered[suv_mask].copy()
            if n_seven < 3:
                pref_notes.append(
                    f"only {n_seven} {req.seats}-seater option(s) found in your budget"
                )
        else:
            pref_notes.append(
                f"no {req.seats}-seater (SUV/MPV) cars found within your budget — "
                f"showing other body types instead"
            )

    # Fuel preference: use exact-fuel cars if any exist, otherwise keep the
    # closest cars and warn (handles cases like electric under a low budget).
    if req.fuel_pref:
        want_fuel = req.fuel_pref.value.lower()
        fuel_match = filtered[filtered['fuel'].str.lower() == want_fuel].copy()
        n_fuel = len(fuel_match)

        if n_fuel >= 3:
            filtered = fuel_match
        elif n_fuel >= 1:
            filtered = fuel_match
            pref_notes.append(
                f"only {n_fuel} {want_fuel} car(s) found in your budget"
            )
        else:
            pref_notes.append(
                f"no {want_fuel} cars found within ₹{budget/100000:.1f} L — "
                f"showing the closest alternatives in other fuel types"
            )

    if pref_notes:
        note_text = "No exact match for all your preferences: " + "; ".join(pref_notes) + "."
        warning_msg = (warning_msg + " " + note_text) if warning_msg else note_text

    # Score each car out of 100 across 7 factors.
    scores, reasons, budget_use_pcts, match_qualities = [], [], [], []

    for _, row in filtered.iterrows():
        score  = 0.0
        reason = []

        # Budget fit (0-40)
        price = float(row.get('price_median', row.get('selling_price', budget)))
        ratio = price / budget
        budget_use_pct = round(ratio * 100, 2)

        if 0.90 <= ratio <= 1.00:
            bud_s = 40; reason.append("Perfect budget match"); match_q = "Excellent"
        elif 0.80 <= ratio < 0.90:
            bud_s = 35; reason.append("Strong budget match"); match_q = "Excellent"
        elif 1.00 < ratio <= 1.10:
            bud_s = 30; reason.append("Slightly over budget"); match_q = "Over budget"
        elif 0.70 <= ratio < 0.80:
            bud_s = 25; reason.append("Good budget match"); match_q = "Good"
        elif 0.55 <= ratio < 0.70:
            bud_s = 15; reason.append("Good value below budget"); match_q = "Good"
        elif 0.40 <= ratio < 0.55:
            bud_s = 5; match_q = "Below budget"
        else:
            bud_s = 0
            match_q = "Below budget" if ratio < 0.40 else "Over budget"

        score += bud_s
        budget_too_far_off = (bud_s == 0)

        # Age (0-15)
        age = CURRENT_YEAR - int(row.get('year', 2010))
        if   age <= 2:  age_s = 15; reason.append("Very recent (≤2 yrs)")
        elif age <= 4:  age_s = 12; reason.append("Recent (≤4 yrs)")
        elif age <= 6:  age_s = 9;  reason.append("Good age (≤6 yrs)")
        elif age <= 8:  age_s = 6
        elif age <= 12: age_s = 3
        else:           age_s = 0
        if budget_too_far_off: age_s = min(age_s, 2)
        score += age_s

        # Kilometres (0-15)
        km = float(row.get('km_driven', 100000))
        if age >= 2 and km < 5000:
            km_s = 5
        elif km < 20000:   km_s = 15; reason.append("Very low mileage")
        elif km < 40000:   km_s = 12; reason.append("Low mileage")
        elif km < 70000:   km_s = 9
        elif km < 100000:  km_s = 5
        elif km < 150000:  km_s = 2
        else:              km_s = 0
        if budget_too_far_off: km_s = min(km_s, 2)
        score += km_s

        # Fuel preference (0-12)
        car_fuel = str(row.get('fuel', '')).lower()
        fuel_s = 0
        if req.fuel_pref:
            if car_fuel == req.fuel_pref.value.lower():
                fuel_s = 12
                reason.append(f"Matches {req.fuel_pref.value} preference")
        if budget_too_far_off: fuel_s = 0
        score += fuel_s

        # Purpose alignment (0-12)
        purpose = req.purpose.value
        brand_l = str(row.get('brand', '')).lower()
        trans   = str(row.get('transmission', '')).lower()
        purpose_s = 0

        if purpose == 'Personal':
            if km < 80000:
                purpose_s += 7; reason.append("Ideal for personal use")
            if car_fuel == 'petrol':
                purpose_s += 3
        elif purpose == 'Taxi':
            if car_fuel == 'diesel':
                purpose_s += 9; reason.append("Diesel — ideal taxi")
            elif car_fuel == 'cng':
                purpose_s += 8; reason.append("CNG — low running cost")
            if km < 80000:
                purpose_s += 3
        elif purpose == 'Company':
            if age <= 4:
                purpose_s += 7; reason.append("Newer model for company use")
            if trans == 'automatic':
                purpose_s += 5; reason.append("Automatic transmission")
        elif purpose == 'Long Drive':
            if car_fuel in ('diesel', 'electric'):
                purpose_s += 9
                reason.append(f"{car_fuel.capitalize()} — great for highways")
            if km < 80000:
                purpose_s += 3
        elif purpose == 'Off-road':
            if brand_l in ('mahindra', 'jeep', 'toyota', 'tata', 'land rover', 'land'):
                purpose_s += 12
                reason.append(f"{brand_l.title()} — proven off-road brand")

        if budget_too_far_off: purpose_s = min(purpose_s, 2)
        score += purpose_s

        # Brand reputation (0-6)
        brand_rep = {
            'toyota': 6, 'honda': 5, 'mercedes-benz': 6, 'bmw': 6, 'audi': 5,
            'lexus': 5, 'porsche': 6, 'land rover': 5, 'volvo': 5,
            'maruti': 4, 'hyundai': 4, 'kia': 4, 'mahindra': 4, 'jeep': 4,
            'tata': 3, 'ford': 3, 'volkswagen': 3, 'skoda': 3, 'mg': 3,
            'jaguar': 4, 'renault': 2, 'nissan': 2, 'chevrolet': 2,
            'fiat': 1, 'datsun': 1, 'mitsubishi': 2,
            'rolls-royce': 6, 'bentley': 5, 'ferrari': 5, 'lamborghini': 5,
        }
        brand_s = brand_rep.get(brand_l, 2)
        if budget_too_far_off: brand_s = min(brand_s, 1)
        score += brand_s

        # Listing popularity (0-5)
        listings = int(row.get('listings', 1))
        if   listings >= 200: list_s = 5
        elif listings >= 100: list_s = 4
        elif listings >= 50:  list_s = 3
        elif listings >= 10:  list_s = 2
        else:                 list_s = 1
        if budget_too_far_off: list_s = 0
        score += list_s

        scores.append(round(score, 1))
        reasons.append(", ".join(reason) if reason else "Within criteria")
        budget_use_pcts.append(budget_use_pct)
        match_qualities.append(match_q)

    filtered = filtered.copy()
    filtered['_score']         = scores
    filtered['_reason']        = reasons
    filtered['_budget_pct']    = budget_use_pcts
    filtered['_match_quality'] = match_qualities

    # Add a small daily-seeded jitter so ties break differently each day.
    today_seed = int(datetime.date.today().strftime('%Y%m%d'))
    rng = np.random.default_rng(today_seed)
    filtered['_jitter'] = rng.uniform(-0.5, 0.5, size=len(filtered))
    filtered['_score_total'] = filtered['_score'] + filtered['_jitter']

    # Pick the top 3, preferring a different brand for each.
    top_candidates = filtered.sort_values('_score_total', ascending=False).head(20)

    selected, used_brands = [], set()
    for _, row in top_candidates.iterrows():
        brand = str(row.get('brand', '')).lower().strip()
        if brand not in used_brands:
            selected.append(row)
            used_brands.add(brand)
        if len(selected) == 3:
            break

    if len(selected) < 3:
        chosen_idx = {s.name for s in selected}
        for _, row in top_candidates.iterrows():
            if len(selected) == 3: break
            if row.name not in chosen_idx:
                selected.append(row)
                chosen_idx.add(row.name)

    return _build_response(selected, budget, len(filtered), warning_msg,
                          dataset_max, used_filter, db, user, req)


@router.post("/finance-decision", response_model=FinanceResponse)
def finance_decision(
    req  : FinanceRequest,
    db   : Session     = Depends(get_db),
    user : models.User = Depends(get_current_user),
):
    loan_amount = req.car_price - req.down_payment
    r           = (req.interest_rate / 100) / 12
    n           = req.tenure_months

    if r == 0:
        monthly_emi = loan_amount / n
    else:
        monthly_emi = loan_amount * r * (1 + r) ** n / ((1 + r) ** n - 1)

    total_payment  = monthly_emi * n + req.down_payment
    total_interest = (monthly_emi * n) - loan_amount
    cash_price     = req.car_price * (1 - req.cash_discount / 100)

    # Opportunity cost: if you finance instead of paying cash, you keep the
    # money you would have spent (minus the down payment) and invest it over
    # the loan term, growing at the user's expected investment rate.
    invest_principal = max(cash_price - req.down_payment, 0)
    inv_r            = (req.investment_rate / 100) / 12
    future_value     = invest_principal * (1 + inv_r) ** n
    investment_gain  = future_value - invest_principal

    # Effective finance cost = cash paid out over the term minus what the
    # money you kept invested earned in the same period.
    effective_finance_cost = total_payment - investment_gain

    if cash_price <= effective_finance_cost:
        decision = "cash"
        savings  = effective_finance_cost - cash_price
        rec = (f"Pay in cash — after investing your spare money at "
               f"{req.investment_rate}%, financing still costs "
               f"₹{effective_finance_cost:,.0f}, which is ₹{savings:,.0f} more "
               f"than the cash price of ₹{cash_price:,.0f}.")
    else:
        decision = "finance"
        savings  = cash_price - effective_finance_cost
        rec = (f"Finance the car — by keeping ₹{invest_principal:,.0f} invested at "
               f"{req.investment_rate}% you earn ₹{investment_gain:,.0f}, making the "
               f"effective cost just ₹{effective_finance_cost:,.0f}. That's "
               f"₹{savings:,.0f} less than paying ₹{cash_price:,.0f} cash.")

    db_log = models.FinanceLog(
        user_id        = user.id,
        car_price      = req.car_price,
        down_payment   = req.down_payment,
        interest_rate  = req.interest_rate,
        tenure_months  = req.tenure_months,
        cash_discount  = req.cash_discount,
        monthly_emi    = round(monthly_emi, 2),
        total_interest = round(total_interest, 2),
        total_payment  = round(total_payment, 2),
        cash_price     = round(cash_price, 2),
        decision       = decision,
        savings        = round(savings, 2),
    )
    db.add(db_log); db.commit()

    return {
        "loan_amount"           : round(loan_amount, 2),
        "monthly_emi"           : round(monthly_emi, 2),
        "total_interest"        : round(total_interest, 2),
        "total_payment"         : round(total_payment, 2),
        "cash_price"            : round(cash_price, 2),
        "cash_discount_pct"     : req.cash_discount,
        "investment_rate"       : req.investment_rate,
        "investment_gain"       : round(investment_gain, 2),
        "effective_finance_cost": round(effective_finance_cost, 2),
        "decision"              : decision,
        "savings"               : round(savings, 2),
        "recommendation"        : rec,
    }


# History endpoints return plain dicts (no response_model) so old or malformed
# rows can't trigger a response-validation error.
def _num(v):
    try:    return float(v) if v is not None else None
    except: return None

def _iso(v):
    try:    return v.isoformat() if v else None
    except: return None


@router.get("/history/resale")
def history_resale(limit: int = 100, db: Session = Depends(get_db),
                   user: models.User = Depends(get_current_user)):
    rows = (db.query(models.ResaleLog)
            .filter(models.ResaleLog.user_id == user.id)
            .order_by(models.ResaleLog.created_at.desc())
            .limit(limit).all())
    out = []
    for r in rows:
        out.append({
            "id"           : getattr(r, "id", None),
            "brand"        : getattr(r, "brand", None),
            "brand_model"  : getattr(r, "brand_model", None),
            "year"         : getattr(r, "year", None),
            "km_driven"    : _num(getattr(r, "km_driven", None)),
            "fuel"         : getattr(r, "fuel", None),
            "condition"    : getattr(r, "condition", None),
            "final_price"  : _num(getattr(r, "final_price", None)),
            "ml_price"     : _num(getattr(r, "ml_price", None)),
            "rule_price"   : _num(getattr(r, "rule_price", None)),
            "car_age"      : getattr(r, "car_age", None),
            "created_at"   : _iso(getattr(r, "created_at", None)),
        })
    return out


@router.get("/history/recommendations")
def history_recommendations(limit: int = 100, db: Session = Depends(get_db),
                            user: models.User = Depends(get_current_user)):
    rows = (db.query(models.Recommendation)
            .filter(models.Recommendation.user_id == user.id)
            .order_by(models.Recommendation.created_at.desc())
            .limit(limit).all())
    out = []
    for r in rows:
        results = getattr(r, "results", None) or []
        top = results[0] if isinstance(results, list) and results else {}
        out.append({
            "id"          : getattr(r, "id", None),
            "budget"      : _num(getattr(r, "budget", None)),
            "purpose"     : getattr(r, "purpose", None),
            "seats"       : getattr(r, "seats", None),
            "fuel_pref"   : getattr(r, "fuel_pref", None),
            "top_pick"    : (f"{top.get('brand_model','')}".strip() or None) if isinstance(top, dict) else None,
            "top_price"   : _num(top.get("selling_price")) if isinstance(top, dict) else None,
            "num_results" : len(results) if isinstance(results, list) else 0,
            "created_at"  : _iso(getattr(r, "created_at", None)),
        })
    return out


@router.get("/history/finance")
def history_finance(limit: int = 100, db: Session = Depends(get_db),
                    user: models.User = Depends(get_current_user)):
    rows = (db.query(models.FinanceLog)
            .filter(models.FinanceLog.user_id == user.id)
            .order_by(models.FinanceLog.created_at.desc())
            .limit(limit).all())
    out = []
    for r in rows:
        out.append({
            "id"             : getattr(r, "id", None),
            "car_price"      : _num(getattr(r, "car_price", None)),
            "down_payment"   : _num(getattr(r, "down_payment", None)),
            "interest_rate"  : _num(getattr(r, "interest_rate", None)),
            "tenure_months"  : getattr(r, "tenure_months", None),
            "monthly_emi"    : _num(getattr(r, "monthly_emi", None)),
            "total_payment"  : _num(getattr(r, "total_payment", None)),
            "cash_price"     : _num(getattr(r, "cash_price", None)),
            "decision"       : getattr(r, "decision", None),
            "savings"        : _num(getattr(r, "savings", None)),
            "created_at"     : _iso(getattr(r, "created_at", None)),
        })
    return out


@router.get("/dashboard-filters")
def dashboard_filters(
    db   : Session     = Depends(get_db),
    user : models.User = Depends(get_current_user),
):
    df = _get_cars_df()
    brands = sorted(df['brand'].dropna().unique().tolist())
    fuels  = sorted(df['fuel'].dropna().unique().tolist())
    yr_min = int(df['year'].min()) if 'year' in df.columns else 1990
    yr_max = int(df['year'].max()) if 'year' in df.columns else CURRENT_YEAR
    return {
        "brands"   : brands,
        "fuels"    : fuels,
        "year_min" : yr_min,
        "year_max" : yr_max,
    }


# Optional filters (min_year, max_year, brand, fuel) affect only the dataset
# charts. User-activity charts always use the full database.
@router.get("/dashboard-data", response_model=DashboardResponse)
def dashboard_data(
    min_year : int = None,
    max_year : int = None,
    brand    : str = None,
    fuel     : str = None,
    db   : Session     = Depends(get_db),
    user : models.User = Depends(get_current_user),
):
    df_full = _get_cars_df()

    df = df_full.copy()
    if min_year is not None and 'year' in df.columns:
        df = df[df['year'] >= int(min_year)]
    if max_year is not None and 'year' in df.columns:
        df = df[df['year'] <= int(max_year)]
    if brand:
        df = df[df['brand'].str.lower() == brand.lower().strip()]
    if fuel:
        df = df[df['fuel'].str.lower() == fuel.lower().strip()]

    # If filters wipe out everything, fall back to the full set so the page renders.
    if len(df) == 0:
        df = df_full.copy()

    total_preds = db.query(models.Prediction).count()
    total_users = db.query(models.User).count()
    avg_price   = db.query(func.avg(models.Prediction.predicted_price)).scalar() or 0

    pby = (df.groupby('year')['selling_price'].median().reset_index()
           .sort_values('year').rename(columns={'year':'year','selling_price':'median_price'})
           .tail(15).to_dict('records'))

    bd = (df.groupby('brand')['selling_price'].count().reset_index()
          .rename(columns={'selling_price':'count'})
          .sort_values('count', ascending=False).head(15).to_dict('records'))

    fd = (df.groupby('fuel')['selling_price'].count().reset_index()
          .rename(columns={'selling_price':'count'}).to_dict('records'))

    price_by_fuel = (df.groupby('fuel')['selling_price'].median().reset_index()
                     .rename(columns={'selling_price':'median_price'})
                     .sort_values('median_price', ascending=False)
                     .to_dict('records'))

    top_brands = (df.groupby('brand')['selling_price'].count()
                  .sort_values(ascending=False).head(12).index.tolist())
    apb = (df[df['brand'].isin(top_brands)]
           .groupby('brand')['selling_price'].median().reset_index()
           .rename(columns={'selling_price':'median_price'})
           .sort_values('median_price', ascending=False)
           .to_dict('records'))

    models_per_brand = {}
    if 'brand_model' in df.columns:
        for b in top_brands:
            sub = df[df['brand'] == b]
            mlist = (sub.groupby('brand_model')['selling_price']
                     .agg(['count', 'median']).reset_index()
                     .rename(columns={'count':'count', 'median':'median_price'})
                     .sort_values('count', ascending=False).head(10))
            models_per_brand[b] = mlist.to_dict('records')

    # User-activity series always use the full DB, not the filtered dataset.
    pot = []
    try:
        rows = (db.query(func.date(models.Prediction.created_at).label('d'),
                         func.count(models.Prediction.id).label('c'))
                .group_by(func.date(models.Prediction.created_at))
                .order_by(func.date(models.Prediction.created_at))
                .all())
        pot = [{"date": str(r.d), "count": int(r.c)} for r in rows]
    except Exception as e:
        print(f"[dashboard] predictions_over_time error: {e}")

    pbs = []
    try:
        rows = (db.query(models.Prediction.brand,
                         func.count(models.Prediction.id).label('c'))
                .group_by(models.Prediction.brand)
                .order_by(func.count(models.Prediction.id).desc())
                .limit(10).all())
        pbs = [{"brand": (r.brand or 'unknown'), "count": int(r.c)} for r in rows]
    except Exception as e:
        print(f"[dashboard] popular_brands error: {e}")

    best_model = "N/A"; r2 = 0.0
    if os.path.exists(META_PATH):
        with open(META_PATH) as f:
            meta = json.load(f)
        best_model = meta.get('best_model_name', 'N/A')
        r2 = meta.get('results', {}).get(best_model, {}).get('R2', 0.0)

    return {
        "total_predictions"   : total_preds,
        "total_users"         : total_users,
        "avg_predicted_price" : round(avg_price, 2),
        "price_by_year"       : pby,
        "brand_distribution"  : bd,
        "fuel_distribution"   : fd,
        "best_model"          : best_model,
        "model_r2"            : r2,
        "dataset_size"        : int(len(df)),
        "brands_count"        : int(df['brand'].nunique()),
        "models_count"        : int(df['brand_model'].nunique()) if 'brand_model' in df.columns else 0,
        "price_by_fuel"        : price_by_fuel,
        "avg_price_by_brand"   : apb,
        "models_per_brand"     : models_per_brand,
        "predictions_over_time": pot,
        "popular_brands"       : pbs,
    }


@router.get("/brand-models/{brand}")
def brand_models(
    brand : str,
    db    : Session     = Depends(get_db),
    user  : models.User = Depends(get_current_user),
):
    # Per-model stats for one brand, used by the dashboard drill-down.
    df = _get_cars_df()
    sub = df[df['brand'].str.lower() == brand.lower().strip()]
    if len(sub) == 0:
        return {"brand": brand, "models": [], "total_listings": 0,
                "median_price": 0, "min_price": 0, "max_price": 0}

    if 'brand_model' in sub.columns:
        mlist = (sub.groupby('brand_model')['selling_price']
                 .agg(['count', 'median', 'min', 'max']).reset_index()
                 .rename(columns={'count':'count', 'median':'median_price',
                                  'min':'min_price', 'max':'max_price'})
                 .sort_values('count', ascending=False).head(20))
        models_out = mlist.to_dict('records')
    else:
        models_out = []

    return {
        "brand"          : brand,
        "models"         : models_out,
        "total_listings" : int(len(sub)),
        "median_price"   : float(sub['selling_price'].median()),
        "min_price"      : float(sub['selling_price'].min()),
        "max_price"      : float(sub['selling_price'].max()),
    }


@router.get("/model-comparison", response_model=ModelComparisonResponse)
def model_comparison():
    if not os.path.exists(META_PATH):
        raise HTTPException(status_code=500,
                            detail="Model metadata not found. Run training first.")
    with open(META_PATH) as f:
        meta = json.load(f)
    best = meta['best_model_name']
    out  = []
    for name, m in meta['results'].items():
        out.append({
            "model_name" : name, "mae": m['MAE'], "mse": m['MSE'],
            "rmse": m['RMSE'], "r2_score": m['R2'],
            "cv_r2_mean": m['CV_R2_mean'], "cv_r2_std": m['CV_R2_std'],
            "is_best": name == best,
        })
    out.sort(key=lambda x: x['r2_score'], reverse=True)
    return {"best_model": best, "models": out}


@router.post("/wishlist", response_model=MessageResponse, status_code=201)
def add_to_wishlist(req: WishlistAddRequest, db: Session = Depends(get_db),
                    user: models.User = Depends(get_current_user)):
    item = models.Wishlist(
        user_id     = user.id,
        brand       = req.brand,
        brand_model = req.brand_model,
        year        = req.year,
        fuel        = req.fuel.value,
        km_driven   = req.km_driven,
        price       = req.price,
        notes       = req.notes,
    )
    db.add(item); db.commit()
    return {"message": "Car added to wishlist", "success": True}


@router.get("/wishlist", response_model=List[WishlistItem])
def get_wishlist(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    items = (db.query(models.Wishlist).filter(models.Wishlist.user_id == user.id)
             .order_by(models.Wishlist.created_at.desc()).all())
    result = []
    for item in items:
        d = {c.name: getattr(item, c.name) for c in item.__table__.columns}
        d['price_lakh'] = round(item.price / 100000, 2)
        result.append(d)
    return result


@router.delete("/wishlist/{item_id}", response_model=MessageResponse)
def remove_from_wishlist(item_id: int, db: Session = Depends(get_db),
                         user: models.User = Depends(get_current_user)):
    item = (db.query(models.Wishlist)
            .filter(models.Wishlist.id == item_id,
                    models.Wishlist.user_id == user.id).first())
    if not item:
        raise HTTPException(status_code=404, detail="Wishlist item not found")
    db.delete(item); db.commit()
    return {"message": "Removed from wishlist", "success": True}