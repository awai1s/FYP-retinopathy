from jose import jwt, JWTError
from datetime import datetime, timedelta
from fastapi import HTTPException

import config

SECRET_KEY = config.SECRET_KEY
ALGORITHM = "HS256"


def create_access_token(data: dict):
    if not SECRET_KEY:
        raise HTTPException(status_code=500, detail="SECRET_KEY is not configured on the server")

    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(hours=24)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(token: str):
    if not SECRET_KEY:
        raise HTTPException(status_code=500, detail="SECRET_KEY is not configured on the server")

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid Token")
