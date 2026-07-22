from datetime import datetime, timedelta
import bcrypt
import os, sys

from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from database import get_db
import models
import config

SECRET_KEY   = os.getenv("SECRET_KEY", "carinsight-secret-key-change-in-production")
ALGORITHM    = "HS256"
TOKEN_EXPIRE = 60 * 24   # 24 hours

bearer_scheme = HTTPBearer()


def hash_password(plain: str) -> str:
    # bcrypt only accepts up to 72 bytes, so slice before hashing
    pwd_bytes = plain.encode('utf-8')[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode('utf-8')


def verify_password(plain: str, hashed: str) -> bool:
    pwd_bytes = plain.encode('utf-8')[:72]
    return bcrypt.checkpw(pwd_bytes, hashed.encode('utf-8'))


def create_token(data: dict, expires_minutes: int = TOKEN_EXPIRE) -> str:
    payload = data.copy()
    payload["exp"] = datetime.utcnow() + timedelta(minutes=expires_minutes)
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> models.User:
    payload = decode_token(credentials.credentials)
    user_id = payload.get("sub")

    if user_id is None:
        raise HTTPException(status_code=401, detail="Token payload invalid")

    user = db.query(models.User).filter(models.User.id == int(user_id)).first()

    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    return user


def get_current_admin(
    user: models.User = Depends(get_current_user),
) -> models.User:
    # Only allow users whose email is listed as an admin in config
    if not config.is_admin_email(user.email):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return user