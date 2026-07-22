"""
Quick health-check for the CarInsight Pro backend.
Runs through every endpoint and prints PASS/FAIL for each.

Usage:
    1. Start the backend:  python -m uvicorn main:app --reload --port 8000
    2. In another terminal: python test_api.py

It signs up a throwaway test user, logs in, calls every feature endpoint,
and cleans up after itself. Needs the `requests` library:
    pip install requests
"""

import requests
import random
import sys

BASE = "http://localhost:8000"

# Track results
results = []
token = None
headers = {}

def check(name, ok, detail=""):
    results.append((name, ok, detail))
    mark = "PASS" if ok else "FAIL"
    line = f"  [{mark}] {name}"
    if detail and not ok:
        line += f"  →  {detail}"
    print(line)

def auth_headers():
    return {"Authorization": f"Bearer {token}"}


print("=" * 60)
print("  CarInsight Pro — Backend Health Check")
print("=" * 60)

# ── 0. Is the server even up? ──────────────────────────────
print("\n[ Server reachable? ]")
try:
    r = requests.get(f"{BASE}/docs", timeout=5)
    check("Server is running", r.status_code == 200)
except Exception as e:
    check("Server is running", False, str(e))
    print("\n  Server not reachable — start it first, then re-run.")
    sys.exit(1)

# ── 1. AUTH ────────────────────────────────────────────────
print("\n[ Auth ]")
test_email = f"apitest_{random.randint(10000,99999)}@gmail.com"
test_pass  = "TestPass123!"

# Direct signup (the non-OTP fallback path)
try:
    r = requests.post(f"{BASE}/auth/signup", json={
        "name": "API Test", "email": test_email, "password": test_pass
    }, timeout=10)
    check("Signup (direct)", r.status_code in (200, 201), f"{r.status_code}: {r.text[:120]}")
except Exception as e:
    check("Signup (direct)", False, str(e))

# Login
try:
    r = requests.post(f"{BASE}/auth/login", json={
        "email": test_email, "password": test_pass
    }, timeout=10)
    ok = r.status_code == 200 and "access_token" in r.json()
    check("Login", ok, f"{r.status_code}: {r.text[:120]}")
    if ok:
        token = r.json()["access_token"]
        headers = auth_headers()
except Exception as e:
    check("Login", False, str(e))

if not token:
    print("\n  Can't continue without a login token. Fix auth first.")
    sys.exit(1)

# ── 2. REFERENCE DATA ──────────────────────────────────────
print("\n[ Reference data ]")
brand_sample = None
try:
    r = requests.get(f"{BASE}/brands", headers=headers, timeout=10)
    brands = r.json().get("brands", [])
    check("GET /brands", r.status_code == 200 and len(brands) > 0, f"{len(brands)} brands")
    if brands: brand_sample = brands[0]
except Exception as e:
    check("GET /brands", False, str(e))

if brand_sample:
    try:
        r = requests.get(f"{BASE}/models/{brand_sample}", headers=headers, timeout=10)
        check(f"GET /models/{brand_sample}", r.status_code == 200)
    except Exception as e:
        check("GET /models/{brand}", False, str(e))

# ── 3. PREDICT PRICE ───────────────────────────────────────
print("\n[ Predict price ]")
try:
    r = requests.post(f"{BASE}/predict-price", headers=headers, json={
        "brand": brand_sample or "maruti", "brand_model": "",
        "year": 2019, "km_driven": 45000, "fuel": "petrol",
        "transmission": "manual", "owner": 1, "seller_type": "individual"
    }, timeout=15)
    ok = r.status_code == 200 and "predicted_price" in r.json()
    price = r.json().get("predicted_price", 0) if ok else 0
    check("POST /predict-price", ok, f"{r.status_code}: {r.text[:120]}")
    if ok:
        check("  prediction is a positive number", price > 0, f"got {price}")
except Exception as e:
    check("POST /predict-price", False, str(e))

# ── 4. RESALE VALUE ────────────────────────────────────────
print("\n[ Resale value ]")
try:
    r = requests.post(f"{BASE}/resale-value", headers=headers, json={
        "brand": brand_sample or "maruti", "brand_model": "maruti swift",
        "year": 2018, "km_driven": 55000, "fuel": "petrol", "mileage": 17,
        "condition": "Good", "accident": "No", "owner": 1,
        "selling_type": "Individual", "transmission": "manual",
        "fitness_status": "Valid", "purchase_price": 700000, "current_price": 550000
    }, timeout=15)
    ok = r.status_code == 200 and "final_price" in r.json()
    check("POST /resale-value", ok, f"{r.status_code}: {r.text[:120]}")
except Exception as e:
    check("POST /resale-value", False, str(e))

# ── 5. RECOMMEND ───────────────────────────────────────────
print("\n[ Recommend ]")
try:
    r = requests.post(f"{BASE}/recommend", headers=headers, json={
        "budget": 500000, "purpose": "Personal", "seats": 5, "fuel_pref": None
    }, timeout=15)
    ok = r.status_code == 200 and "cars" in r.json()
    n = len(r.json().get("cars", [])) if ok else 0
    check("POST /recommend", ok, f"{r.status_code}: {r.text[:120]}")
    if ok: check("  returned up to 3 cars", 0 < n <= 3, f"got {n}")
except Exception as e:
    check("POST /recommend", False, str(e))

# ── 6. FINANCE (with new investment_rate) ──────────────────
print("\n[ Finance decision ]")
try:
    # invest 4% -> expect cash
    r1 = requests.post(f"{BASE}/finance-decision", headers=headers, json={
        "car_price": 600000, "down_payment": 100000, "interest_rate": 9.5,
        "tenure_months": 60, "cash_discount": 2, "investment_rate": 4
    }, timeout=10)
    # invest 12% -> expect finance
    r2 = requests.post(f"{BASE}/finance-decision", headers=headers, json={
        "car_price": 600000, "down_payment": 100000, "interest_rate": 9.5,
        "tenure_months": 60, "cash_discount": 2, "investment_rate": 12
    }, timeout=10)
    ok = r1.status_code == 200 and r2.status_code == 200
    check("POST /finance-decision", ok, f"{r1.status_code}/{r2.status_code}: {r1.text[:100]}")
    if ok:
        d1 = r1.json().get("decision")
        d2 = r2.json().get("decision")
        emi = r1.json().get("monthly_emi", 0)
        check("  EMI ≈ 10,500 for default loan", 10400 < emi < 10600, f"got {emi}")
        check("  invest 4% → cash", d1 == "cash", f"got '{d1}'")
        check("  invest 12% → finance (the flip works!)", d2 == "finance", f"got '{d2}'")
        check("  response has investment_gain field", "investment_gain" in r1.json())
except Exception as e:
    check("POST /finance-decision", False, str(e))

# ── 7. WISHLIST ────────────────────────────────────────────
print("\n[ Wishlist ]")
wish_id = None
try:
    r = requests.post(f"{BASE}/wishlist", headers=headers, json={
        "brand": "maruti", "brand_model": "maruti swift", "year": 2020,
        "fuel": "petrol", "km_driven": 30000, "price": 500000, "notes": "api test"
    }, timeout=10)
    check("POST /wishlist (add)", r.status_code in (200, 201))
    r = requests.get(f"{BASE}/wishlist", headers=headers, timeout=10)
    items = r.json() if r.status_code == 200 else []
    check("GET /wishlist", r.status_code == 200 and len(items) > 0, f"{len(items)} items")
    if items: wish_id = items[0]["id"]
    if wish_id:
        r = requests.delete(f"{BASE}/wishlist/{wish_id}", headers=headers, timeout=10)
        check("DELETE /wishlist/{id}", r.status_code == 200)
except Exception as e:
    check("Wishlist", False, str(e))

# ── 8. DASHBOARD + HISTORY + DIAGNOSTICS ───────────────────
print("\n[ Dashboard / History / Diagnostics ]")
for path in ["/dashboard-data", "/dashboard-filters",
             "/history/resale", "/history/recommendations", "/history/finance",
             "/model-comparison", "/diagnostics"]:
    try:
        r = requests.get(f"{BASE}{path}", headers=headers, timeout=15)
        check(f"GET {path}", r.status_code == 200, f"{r.status_code}: {r.text[:80]}")
    except Exception as e:
        check(f"GET {path}", False, str(e))

# ── SUMMARY ────────────────────────────────────────────────
print("\n" + "=" * 60)
passed = sum(1 for _, ok, _ in results if ok)
total  = len(results)
failed = [name for name, ok, _ in results if not ok]
print(f"  RESULT: {passed}/{total} checks passed")
if failed:
    print("\n  Failed checks:")
    for f in failed:
        print(f"    ✗ {f}")
    print("\n  (Note: a test user was created — delete it from Admin if needed.)")
else:
    print("  ✓ All endpoints healthy!")
print("=" * 60)
