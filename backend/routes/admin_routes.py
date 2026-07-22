"""
Admin routes: stats, user listing, password reset/change, user deletion,
and clearing activity data (for all users or a single user).
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
import sys, os, secrets, string
import re

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import get_db
from auth import get_current_admin, hash_password
from email_utils import (send_password_email, send_account_deleted_email,
                         send_password_set_email, send_data_cleared_email)
import config
import models
from schemas import (
    AdminUserItem, AdminStatsResponse,
    AdminResetPasswordRequest, AdminResetPasswordResponse,
    AdminClearRequest, AdminClearResponse,
    AdminClearUserRequest,
    MessageResponse,
)

router = APIRouter(prefix="/admin", tags=["Admin"])


CLEARABLE = {
    "predictions"     : models.Prediction,
    "resale_logs"     : models.ResaleLog,
    "recommendations" : models.Recommendation,
    "finance_logs"    : models.FinanceLog,
    "wishlists"       : models.Wishlist,
}

ALL_TABLES = set(CLEARABLE.keys())

USER_DATA_MODELS = [
    models.Prediction,
    models.ResaleLog,
    models.Recommendation,
    models.FinanceLog,
    models.Wishlist,
]


def _generate_password(length: int = 12) -> str:
    # Build a strong password that always meets the policy (upper/lower/digit/
    # symbol, 8+ chars). Skips look-alike characters like 0 O l I 1.
    if length < 8:
        length = 12
    uppers  = "ABCDEFGHJKLMNPQRSTUVWXYZ"
    lowers  = "abcdefghijkmnopqrstuvwxyz"
    digits  = "23456789"
    symbols = "!@#$%^&*?-_"
    required = [
        secrets.choice(uppers),
        secrets.choice(lowers),
        secrets.choice(digits),
        secrets.choice(symbols),
    ]
    pool = uppers + lowers + digits + symbols
    rest = [secrets.choice(pool) for _ in range(length - len(required))]
    chars = required + rest
    secrets.SystemRandom().shuffle(chars)
    return "".join(chars)


def _password_problem(pw: str):
    # Same strict policy as auth_routes. Returns an error string or None.
    if not pw or len(pw) < 8:
        return "Password must be at least 8 characters."
    if not re.search(r"[A-Z]", pw):
        return "Password must include an uppercase letter."
    if not re.search(r"[a-z]", pw):
        return "Password must include a lowercase letter."
    if not re.search(r"[0-9]", pw):
        return "Password must include a number."
    if not re.search(r"[^A-Za-z0-9]", pw):
        return "Password must include a symbol (e.g. ! @ # $)."
    return None


def _count_by_user(db, model):
    # Returns {user_id: count} for one activity model.
    return dict(
        db.query(model.user_id, func.count(model.id))
          .group_by(model.user_id).all()
    )


@router.get("/stats", response_model=AdminStatsResponse)
def admin_stats(db: Session = Depends(get_db),
                admin: models.User = Depends(get_current_admin)):
    total_users = db.query(models.User).count()
    all_emails  = [u.email for u in db.query(models.User.email).all()] \
                  if total_users else []
    total_admins = sum(1 for e in all_emails if config.is_admin_email(e))

    newest = (db.query(models.User)
              .order_by(models.User.created_at.desc())
              .first())

    return {
        "total_users"           : total_users,
        "total_admins"          : total_admins,
        "total_predictions"     : db.query(models.Prediction).count(),
        "total_resale_logs"     : db.query(models.ResaleLog).count(),
        "total_recommendations" : db.query(models.Recommendation).count(),
        "total_finance_logs"    : db.query(models.FinanceLog).count(),
        "total_wishlist"        : db.query(models.Wishlist).count(),
        "newest_user_email"     : newest.email if newest else None,
        "newest_user_date"      : newest.created_at if newest else None,
    }


@router.get("/users", response_model=List[AdminUserItem])
def admin_list_users(db: Session = Depends(get_db),
                     admin: models.User = Depends(get_current_admin)):
    users = db.query(models.User).order_by(models.User.created_at.desc()).all()

    pred_counts   = _count_by_user(db, models.Prediction)
    resale_counts = _count_by_user(db, models.ResaleLog)
    reco_counts   = _count_by_user(db, models.Recommendation)
    fin_counts    = _count_by_user(db, models.FinanceLog)
    wish_counts   = _count_by_user(db, models.Wishlist)

    out = []
    for u in users:
        out.append({
            "id"              : u.id,
            "name"            : u.name,
            "email"           : u.email,
            "is_active"       : u.is_active,
            "is_admin"        : config.is_admin_email(u.email),
            "created_at"      : u.created_at,
            "predictions"     : pred_counts.get(u.id, 0),
            "resale_logs"     : resale_counts.get(u.id, 0),
            "recommendations" : reco_counts.get(u.id, 0),
            "finance_logs"    : fin_counts.get(u.id, 0),
            "wishlists"       : wish_counts.get(u.id, 0),
        })
    return out


@router.post("/reset-password", response_model=AdminResetPasswordResponse)
def admin_reset_password(req: AdminResetPasswordRequest,
                         db: Session = Depends(get_db),
                         admin: models.User = Depends(get_current_admin)):
    user = db.query(models.User).filter(models.User.id == req.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    new_password = req.new_password or _generate_password()
    user.password = hash_password(new_password)
    db.commit()

    sent, detail = send_password_email(user.email, user.name, new_password)

    return {
        "message"      : (f"Password reset and emailed to {user.email}"
                          if sent else
                          f"Password reset for {user.email} (email not sent)"),
        "success"      : True,
        "email_sent"   : sent,
        "new_password" : None if sent else new_password,
        "detail"       : detail,
    }


@router.post("/change-password", response_model=MessageResponse)
def admin_change_password(req: AdminResetPasswordRequest,
                          db: Session = Depends(get_db),
                          admin: models.User = Depends(get_current_admin)):
    if not req.new_password:
        raise HTTPException(status_code=400, detail="new_password is required")

    pw_problem = _password_problem(req.new_password)
    if pw_problem:
        raise HTTPException(status_code=400, detail=pw_problem)

    user = db.query(models.User).filter(models.User.id == req.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.password = hash_password(req.new_password)
    db.commit()

    try:
        sent, detail = send_password_set_email(user.email, user.name, req.new_password)
        print(f"[admin/change-password] email: sent={sent} detail={detail}")
    except Exception as e:
        print(f"[admin/change-password] email skipped: {e}")

    return {"message": f"Password updated for {user.email}", "success": True}


@router.delete("/user/{user_id}", response_model=MessageResponse)
def admin_delete_user(user_id: int,
                      db: Session = Depends(get_db),
                      admin: models.User = Depends(get_current_admin)):
    # Delete a user and all their activity data, then email a goodbye notice.
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    email = user.email
    name  = user.name

    try:
        sent, detail = send_account_deleted_email(email, name)
        print(f"[admin/delete] goodbye email: sent={sent} detail={detail}")
    except Exception as e:
        print(f"[admin/delete] goodbye email skipped: {e}")

    deleted_rows = 0
    for model in USER_DATA_MODELS:
        n = db.query(model).filter(model.user_id == user_id).delete()
        deleted_rows += n

    db.delete(user)
    db.commit()

    return {
        "message": f"Deleted user {email} and {deleted_rows} related record(s)",
        "success": True,
    }


@router.post("/clear-database", response_model=AdminClearResponse)
def admin_clear_database(req: AdminClearRequest,
                         db: Session = Depends(get_db),
                         admin: models.User = Depends(get_current_admin)):
    if req.confirm != "DELETE":
        raise HTTPException(status_code=400,
                            detail="Confirmation failed: send confirm='DELETE'")

    deleted = {}
    for table in req.tables:
        model = CLEARABLE.get(table)
        if model is None:
            deleted[table] = "skipped (not clearable)"
            continue
        n = db.query(model).delete()
        deleted[table] = n
    db.commit()

    cleared = sum(v for v in deleted.values() if isinstance(v, int))
    return {
        "message" : f"Cleared {cleared} rows across {len([v for v in deleted.values() if isinstance(v,int)])} table(s)",
        "success" : True,
        "deleted" : deleted,
    }


@router.post("/clear-user-data", response_model=AdminClearResponse)
def admin_clear_user_data(req: AdminClearUserRequest,
                          db: Session = Depends(get_db),
                          admin: models.User = Depends(get_current_admin)):
    # Clear chosen activity types for one user (the account is never deleted here).
    # Typed confirm='DELETE' is required only when clearing ALL five types.
    user = db.query(models.User).filter(models.User.id == req.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not req.tables:
        raise HTTPException(status_code=400, detail="No tables selected")

    requested = set(req.tables)
    invalid = requested - ALL_TABLES
    if invalid:
        raise HTTPException(status_code=400,
                            detail=f"Unknown table(s): {', '.join(sorted(invalid))}")

    clearing_everything = requested == ALL_TABLES
    if clearing_everything and req.confirm != "DELETE":
        raise HTTPException(
            status_code=400,
            detail="Clearing ALL data for this user requires confirm='DELETE'"
        )

    deleted = {}
    for table in req.tables:
        model = CLEARABLE.get(table)
        if model is None:
            deleted[table] = "skipped (not clearable)"
            continue
        n = (db.query(model)
             .filter(model.user_id == req.user_id)
             .delete(synchronize_session=False))
        deleted[table] = n
    db.commit()

    cleared = sum(v for v in deleted.values() if isinstance(v, int))
    table_count = len([v for v in deleted.values() if isinstance(v, int)])

    if cleared > 0:
        try:
            sent, detail = send_data_cleared_email(user.email, user.name, deleted)
            print(f"[admin/clear-user-data] email: sent={sent} detail={detail}")
        except Exception as e:
            print(f"[admin/clear-user-data] email skipped: {e}")

    return {
        "message" : f"Cleared {cleared} record(s) across {table_count} table(s) for {user.email}",
        "success" : True,
        "deleted" : deleted,
    }