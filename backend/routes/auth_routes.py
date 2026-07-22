"""
Auth routes: signup (with email OTP verification), login, and password reset.

Signup is a 2-step flow: /request-otp emails a code and holds the pending
signup in memory; /verify-otp checks the code and creates the account.
A direct /signup (no OTP) is kept as a fallback. OTP and lockout state are
stored in module-level dicts — fine for a demo; production would use Redis.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import sys, os, time, random
import re

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import get_db
from schemas import (SignupRequest, LoginRequest, TokenResponse, MessageResponse,
                     OtpRequest, OtpVerifyRequest,
                     ForgotPasswordRequest, ResetPasswordRequest)
import models
from auth import hash_password, verify_password, create_token
import config


router = APIRouter(prefix="/auth", tags=["Authentication"])


# Pending signups, keyed by email: {otp, name, password_hash, expires, last_sent, attempts}
_OTP_STORE = {}
OTP_TTL_SECONDS = 5 * 60
RESEND_COOLDOWN = 30


def _gen_otp() -> str:
    return f"{random.randint(0, 9999):04d}"


def _password_problem(pw: str):
    # Enforce a strong password: 8+ chars with upper, lower, digit and symbol.
    if len(pw) < 8:
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


# Login lockout state, keyed by email: {fails, locked_until}
_LOGIN_ATTEMPTS = {}
MAX_LOGIN_FAILS = 5
LOCKOUT_SECONDS = 5 * 60

def _is_locked(email: str):
    rec = _LOGIN_ATTEMPTS.get(email)
    if not rec:
        return (False, 0)
    if rec.get("locked_until", 0) > time.time():
        return (True, int(rec["locked_until"] - time.time()))
    return (False, 0)

def _record_fail(email: str):
    rec = _LOGIN_ATTEMPTS.setdefault(email, {"fails": 0, "locked_until": 0})
    rec["fails"] += 1
    if rec["fails"] >= MAX_LOGIN_FAILS:
        rec["locked_until"] = time.time() + LOCKOUT_SECONDS
        rec["fails"] = 0

def _clear_fails(email: str):
    _LOGIN_ATTEMPTS.pop(email, None)


def _purge_expired():
    now = time.time()
    for k in [k for k, v in _OTP_STORE.items() if v["expires"] < now]:
        _OTP_STORE.pop(k, None)


def _domain_has_mail_server(email: str) -> bool:
    # Check the email domain can receive mail (MX or A record), to catch typos
    # like '@gmial.com'. Fails open: if the check itself errors, return True so
    # a real signup is never blocked by a DNS/network issue.
    try:
        domain = email.split("@", 1)[1].lower().strip()
    except Exception:
        return False

    try:
        import dns.resolver
        try:
            answers = dns.resolver.resolve(domain, "MX")
            if answers and len(answers) > 0:
                return True
        except (dns.resolver.NoAnswer, dns.resolver.NXDOMAIN):
            # No MX record — some valid domains still accept mail on their A record.
            try:
                a = dns.resolver.resolve(domain, "A")
                return bool(a and len(a) > 0)
            except Exception:
                return False
        except Exception:
            return True
    except ImportError:
        # dnspython not installed — fall back to a basic hostname resolve.
        import socket
        try:
            socket.gethostbyname(domain)
            return True
        except Exception:
            return False

    return True


@router.post("/request-otp", response_model=MessageResponse)
def request_otp(req: SignupRequest, db: Session = Depends(get_db)):
    # Signup step 1: validate, then generate and email a code. No account yet.
    _purge_expired()
    email = req.email.lower().strip()

    existing = db.query(models.User).filter(models.User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    if not _domain_has_mail_server(email):
        raise HTTPException(
            status_code=400,
            detail="That email domain doesn't seem to exist. Please check for typos."
        )

    pw_problem = _password_problem(req.password)
    if pw_problem:
        raise HTTPException(status_code=400, detail=pw_problem)

    # Don't allow spamming the resend button.
    prev = _OTP_STORE.get(email)
    now = time.time()
    if prev and (now - prev.get("last_sent", 0)) < RESEND_COOLDOWN:
        wait = int(RESEND_COOLDOWN - (now - prev["last_sent"]))
        raise HTTPException(status_code=429,
                            detail=f"Please wait {wait}s before requesting another code")

    otp = _gen_otp()
    _OTP_STORE[email] = {
        "otp"           : otp,
        "name"          : req.name.strip(),
        "password_hash" : hash_password(req.password),
        "expires"       : now + OTP_TTL_SECONDS,
        "last_sent"     : now,
        "attempts"      : 0,
    }

    try:
        from email_utils import send_otp_email
        sent, detail = send_otp_email(email, otp, minutes=OTP_TTL_SECONDS // 60)
        print(f"[request-otp] {email} otp={otp} sent={sent} detail={detail}")
    except Exception as e:
        sent, detail = False, str(e)
        print(f"[request-otp] email error: {e}")

    if not sent:
        _OTP_STORE.pop(email, None)
        raise HTTPException(
            status_code=502,
            detail="Could not send the verification email. Check the address and try again."
        )

    return {"message": f"Verification code sent to {email}", "success": True}


@router.post("/verify-otp", response_model=MessageResponse, status_code=201)
def verify_otp(req: OtpVerifyRequest, db: Session = Depends(get_db)):
    # Signup step 2: check the code; if valid, create the account.
    _purge_expired()
    email = req.email.lower().strip()
    pending = _OTP_STORE.get(email)

    if not pending:
        raise HTTPException(status_code=400,
                            detail="No pending verification for this email. Please request a new code.")

    if time.time() > pending["expires"]:
        _OTP_STORE.pop(email, None)
        raise HTTPException(status_code=400, detail="Code expired. Please request a new one.")

    pending["attempts"] += 1
    if pending["attempts"] > 6:
        _OTP_STORE.pop(email, None)
        raise HTTPException(status_code=429, detail="Too many attempts. Please request a new code.")

    if req.otp.strip() != pending["otp"]:
        raise HTTPException(status_code=400, detail="Incorrect code. Please try again.")

    user = models.User(
        name     = pending["name"],
        email    = email,
        password = pending["password_hash"],
    )
    db.add(user)
    db.commit()
    _OTP_STORE.pop(email, None)

    try:
        from email_utils import send_welcome_email
        sent, detail = send_welcome_email(user.email, user.name)
        print(f"[verify-otp] welcome email: sent={sent} detail={detail}")
    except Exception as e:
        print(f"[verify-otp] welcome email skipped: {e}")

    return {"message": "Email verified and account created successfully", "success": True}


# Direct signup with no OTP, kept as a fallback.
@router.post("/signup", response_model=MessageResponse, status_code=201)
def signup(req: SignupRequest, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.email == req.email.lower().strip()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    pw_problem = _password_problem(req.password)
    if pw_problem:
        raise HTTPException(status_code=400, detail=pw_problem)

    user = models.User(
        name     = req.name.strip(),
        email    = req.email.lower().strip(),
        password = hash_password(req.password),
    )
    db.add(user)
    db.commit()

    try:
        from email_utils import send_welcome_email
        sent, detail = send_welcome_email(user.email, user.name)
        print(f"[signup] welcome email: sent={sent} detail={detail}")
    except Exception as e:
        print(f"[signup] welcome email skipped: {e}")

    return {"message": "Account created successfully", "success": True}


# Password-reset codes, keyed by email: {otp, expires, last_sent, attempts}
_RESET_STORE = {}

def _purge_reset_expired():
    now = time.time()
    for k in [k for k, v in _RESET_STORE.items() if v["expires"] < now]:
        _RESET_STORE.pop(k, None)


@router.post("/forgot-password", response_model=MessageResponse)
def forgot_password(req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    # Reset step 1: email a code if the account exists. The response is the same
    # whether or not it exists, so we don't reveal which emails are registered.
    _purge_reset_expired()
    email = req.email.lower().strip()

    user = db.query(models.User).filter(models.User.email == email).first()

    prev = _RESET_STORE.get(email)
    now = time.time()
    if prev and (now - prev.get("last_sent", 0)) < RESEND_COOLDOWN:
        wait = int(RESEND_COOLDOWN - (now - prev["last_sent"]))
        raise HTTPException(status_code=429,
                            detail=f"Please wait {wait}s before requesting another code")

    if user:
        otp = _gen_otp()
        _RESET_STORE[email] = {
            "otp": otp, "expires": now + OTP_TTL_SECONDS,
            "last_sent": now, "attempts": 0,
        }
        try:
            from email_utils import send_otp_email
            sent, detail = send_otp_email(email, otp, minutes=OTP_TTL_SECONDS // 60)
            print(f"[forgot-password] {email} otp={otp} sent={sent} detail={detail}")
        except Exception as e:
            print(f"[forgot-password] email error: {e}")

    return {"message": f"If an account exists for {email}, a reset code has been sent.",
            "success": True}


@router.post("/reset-password", response_model=MessageResponse)
def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    # Reset step 2: verify the code and set the new (strong) password.
    _purge_reset_expired()
    email = req.email.lower().strip()
    pending = _RESET_STORE.get(email)

    if not pending:
        raise HTTPException(status_code=400,
                            detail="No reset request found. Please request a new code.")
    if time.time() > pending["expires"]:
        _RESET_STORE.pop(email, None)
        raise HTTPException(status_code=400, detail="Code expired. Please request a new one.")

    pending["attempts"] += 1
    if pending["attempts"] > 6:
        _RESET_STORE.pop(email, None)
        raise HTTPException(status_code=429, detail="Too many attempts. Please request a new code.")

    if req.otp.strip() != pending["otp"]:
        raise HTTPException(status_code=400, detail="Incorrect code. Please try again.")

    pw_problem = _password_problem(req.new_password)
    if pw_problem:
        raise HTTPException(status_code=400, detail=pw_problem)

    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        _RESET_STORE.pop(email, None)
        raise HTTPException(status_code=404, detail="Account not found.")

    user.password = hash_password(req.new_password)
    db.commit()
    _RESET_STORE.pop(email, None)
    _clear_fails(email)   # also clear any login lockout

    try:
        from email_utils import send_password_email
        sent, detail = send_password_email(user.email, user.name, "(the password you just set)")
        print(f"[reset-password] confirm email: sent={sent} detail={detail}")
    except Exception as e:
        print(f"[reset-password] email skipped: {e}")

    return {"message": "Password reset successfully. You can now log in.", "success": True}


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    email = req.email.lower().strip()

    # Check the brute-force lockout before anything else.
    locked, wait = _is_locked(email)
    if locked:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many failed attempts. Try again in {wait // 60}m {wait % 60}s."
        )

    user = db.query(models.User).filter(models.User.email == email).first()

    if not user or not verify_password(req.password, user.password):
        _record_fail(email)
        locked2, wait2 = _is_locked(email)
        if locked2:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Too many failed attempts. Account locked for 5 minutes."
            )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Incorrect email or password")

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Account is disabled")

    _clear_fails(email)

    token = create_token({"sub": str(user.id), "email": user.email})
    return {
        "access_token": token,
        "token_type"  : "bearer",
        "user_id"     : user.id,
        "name"        : user.name,
        "email"       : user.email,
        "is_admin"    : config.is_admin_email(user.email),
    }