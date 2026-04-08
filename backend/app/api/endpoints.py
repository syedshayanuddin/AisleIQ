from fastapi import APIRouter, HTTPException, File, UploadFile
import logging
from typing import List, Optional
from app.models.schemas import User, SKU, StoreSession, CartItem, Purchase, PantryItem
from app.db.mongodb import db_config
from bson import ObjectId
from datetime import datetime, timedelta
import cv2
import numpy as np
from vision.main import VisionSystem# Reusing your class

import uuid
import random
from passlib.context import CryptContext
from pydantic import BaseModel
import bcrypt as _bcrypt

# Use bcrypt directly (avoids passlib/bcrypt 4.x incompatibility)
def _hash_pw(password: str) -> str:
    return _bcrypt.hashpw(password.encode(), _bcrypt.gensalt()).decode()

def _verify_pw(password: str, hashed: str) -> bool:
    return _bcrypt.checkpw(password.encode(), hashed.encode())

pwd_ctx = None  # kept for import compatibility, not used

router = APIRouter()

# ── Auth ─────────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    username: str
    password: str
    display_name: str = ""

class LoginRequest(BaseModel):
    username: str
    password: str

@router.post("/auth/register")
async def register(body: RegisterRequest):
    """Create a new user account."""
    username = body.username.strip().lower()
    if not username or not body.password:
        raise HTTPException(status_code=400, detail="Username and password are required")
    existing = await db_config.db["users"].find_one({"username": username})
    if existing:
        raise HTTPException(status_code=409, detail="Username already taken")
    display = body.display_name.strip() or username.capitalize()
    await db_config.db["users"].insert_one({
        "username":      username,
        "password_hash": _hash_pw(body.password),
        "display_name":  display,
        "created_at":    datetime.utcnow(),
    })
    return {"message": "Account created", "username": username, "display_name": display}


@router.post("/auth/login")
async def login(body: LoginRequest):
    """Verify credentials and return a fresh shopping session."""
    username = body.username.strip().lower()
    user = await db_config.db["users"].find_one({"username": username})
    if not user or not _verify_pw(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    # Create a fresh session for this login
    session_id = str(uuid.uuid4())
    display    = user["display_name"]
    now        = datetime.utcnow()
    await db_config.db["sessions_v2"].insert_one({
        "session_id":   session_id,
        "user_id":      username,
        "display_name": display,
        "created_at":   now,
        "status":       "active",
    })
    logging.info(f"LOGIN: {username} → session {session_id}")
    return {
        "session_id":   session_id,
        "user_id":      username,
        "display_name": display,
    }

_ADJECTIVES = ["Swift", "Bright", "Cool", "Fresh", "Smart", "Quick", "Bold", "Keen"]
_NOUNS      = ["Shopper", "Buyer", "Customer", "User", "Guest", "Member"]

def _random_name() -> str:
    return f"{random.choice(_ADJECTIVES)}-{random.choice(_NOUNS)}-{random.randint(10, 99)}"


# ── SKU Catalog ───────────────────────────────────────────────────────────────
# In-memory shelf life lookup (mirrors seed_skus.py)
# SKU-006 and SKU-007 are set to 3 days for demo — triggers Alerts immediately after checkout
SHELF_LIFE = {
    "SKU-001": 180, "SKU-002": 180,
    "SKU-003": 365, "SKU-004": 365,
    "SKU-005": 730, "SKU-006": 3,
    "SKU-007": 3,   "SKU-008": 730,
}
SKU_NAMES = {
    "SKU-001": "Coca Cola 1.5L",               "SKU-002": "Coca Cola 290mL",
    "SKU-003": "Datu Puti Soy Sauce 200mL",    "SKU-004": "Datu Puti Soy Sauce 385mL",
    "SKU-005": "Palmolive Soap",               "SKU-006": "Pancit Canton Chilimansi",
    "SKU-007": "Pancit Canton Extra Hot Chili","SKU-008": "Safeguard Soap",
}
SKU_PRICES = {
    "SKU-001": 85.00, "SKU-002": 40.00, "SKU-003": 30.00, "SKU-004": 55.00,
    "SKU-005": 45.00, "SKU-006": 15.00, "SKU-007": 15.00, "SKU-008": 50.00,
}


vision_sessions = {}

# ── Session Management ────────────────────────────────────────────────────────

@router.post("/session/create")
async def create_session_v2(display_name: str = ""):
    """
    Create a new shopping session.
    Returns a UUID session_id and a human-readable display name.
    """
    session_id   = str(uuid.uuid4())
    name         = display_name.strip() or _random_name()
    now          = datetime.utcnow()
    await db_config.db["sessions_v2"].insert_one({
        "session_id":   session_id,
        "display_name": name,
        "created_at":   now,
        "status":       "active",
    })
    logging.info(f"NEW SESSION: {session_id} ({name})")
    return {"session_id": session_id, "display_name": name, "created_at": now}


@router.get("/sessions/active")
async def get_active_sessions():
    """
    Return all sessions that currently have at least one in_cart item.
    Enriches each with display_name from sessions_v2 collection.
    """
    # Aggregate distinct session_ids with in_cart items
    pipeline = [
        {"$match": {"status": "in_cart"}},
        {"$group": {
            "_id":        "$session_id",
            "item_count": {"$sum": 1},
            "items":      {"$push": "$sku_id"},
            "last_updated": {"$max": "$added_at"},
        }},
        {"$sort": {"last_updated": -1}},
    ]
    active = await db_config.db["cart"].aggregate(pipeline).to_list(100)

    # Fetch display names for known sessions
    session_ids = [s["_id"] for s in active]
    meta_cursor = db_config.db["sessions_v2"].find({"session_id": {"$in": session_ids}})
    meta_list   = await meta_cursor.to_list(100)
    name_map    = {m["session_id"]: m["display_name"] for m in meta_list}

    return [
        {
            "session_id":   s["_id"],
            "display_name": name_map.get(s["_id"], "Unknown Shopper"),
            "item_count":   s["item_count"],
            "items":        s["items"],
            "last_updated": s["last_updated"],
        }
        for s in active
    ]


@router.get("/status")
async def system_status():
    """System health + active session count for dashboard."""
    active_sessions = await db_config.db["cart"].distinct("session_id", {"status": "in_cart"})
    total_items     = await db_config.db["cart"].count_documents({"status": "in_cart"})
    return {
        "status":          "online",
        "active_sessions": len(active_sessions),
        "total_items":     total_items,
        "vision_sessions": list(vision_sessions.keys()),
    }

@router.post("/detect-frame/{session_id}")
async def detect_frame(session_id: str, file: UploadFile = File(...)):
    # 1. Init VisionSystem for this session if needed
    if session_id not in vision_sessions:
        vision_sessions[session_id] = VisionSystem(session_id)

    # 2. Decode the uploaded frame
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if frame is None:
        raise HTTPException(status_code=400, detail="Invalid image")

    # 3. Run vision — returns {add:[...], remove:[...], cart_skus:[...], raw_predictions:[...]}
    result = vision_sessions[session_id].process_api_frame(frame)

    # 4. Write cart changes directly to MongoDB (no HTTP round-trip → no deadlock)
    now = datetime.utcnow()
    for sku_id in result.get("add", []):
        existing = await db_config.db["cart"].find_one(
            {"session_id": session_id, "sku_id": sku_id, "status": "in_cart"}
        )
        if not existing:
            await db_config.db["cart"].insert_one({
                "session_id": session_id,
                "sku_id":     sku_id,
                "quantity":   1,
                "status":     "in_cart",
                "added_at":   now,
            })
            logging.info(f"DB ADD: {sku_id} → session {session_id}")

    for sku_id in result.get("remove", []):
        await db_config.db["cart"].find_one_and_delete(
            {"session_id": session_id, "sku_id": sku_id, "status": "in_cart"},
            sort=[("added_at", 1)],
        )
        logging.info(f"DB REMOVE: {sku_id} → session {session_id}")

    return {"status": "ok", "data": result}



@router.post("/items", response_model=SKU)
async def create_sku(sku: SKU):
    new_sku = await db_config.db["skus"].insert_one(sku.model_dump(by_alias=True, exclude={"id", "_id"}))
    created_sku = await db_config.db["skus"].find_one({"_id": new_sku.inserted_id})
    return created_sku

@router.get("/items", response_model=List[SKU])
async def list_skus():
    skus = await db_config.db["skus"].find().to_list(100)
    return skus

@router.post("/sessions", response_model=StoreSession)
async def create_session(session: StoreSession):
    new_session = await db_config.db["sessions"].insert_one(session.model_dump(by_alias=True, exclude={"id", "_id"}))
    created_session = await db_config.db["sessions"].find_one({"_id": new_session.inserted_id})
    return created_session

# ── Cart ──────────────────────────────────────────────────────────────────────
@router.post("/cart", response_model=CartItem)
async def add_to_cart(item: CartItem):
    existing = await db_config.db["cart"].find_one({
        "session_id": item.session_id, "sku_id": item.sku_id, "status": "in_cart"
    })
    if existing:
        return existing
    new_item = await db_config.db["cart"].insert_one(item.model_dump(by_alias=True, exclude={"id", "_id"}))
    return await db_config.db["cart"].find_one({"_id": new_item.inserted_id})

@router.get("/cart/{session_id}", response_model=List[CartItem])
async def get_cart(session_id: str):
    return await db_config.db["cart"].find({"session_id": session_id, "status": "in_cart"}).to_list(100)

@router.delete("/cart/{session_id}/{sku_id}")
async def remove_from_cart(session_id: str, sku_id: str):
    result = await db_config.db["cart"].find_one_and_delete(
        {"session_id": session_id, "sku_id": sku_id, "status": "in_cart"},
        sort=[("added_at", 1)]
    )
    # Gracefully handle case where item was already checked out
    if not result:
        return {"message": "Item not in cart (may have been checked out already)"}
    return {"message": "Success"}

@router.delete("/cart/{session_id}")
async def clear_cart(session_id: str):
    result = await db_config.db["cart"].delete_many({"session_id": session_id})
    return {"message": f"Deleted {result.deleted_count} items from session {session_id}"}

# ── Checkout ──────────────────────────────────────────────────────────────────
@router.post("/checkout/{session_id}")
async def checkout(session_id: str, user_id: str = "demo_user"):
    """
    Simplified checkout: reads current in_cart items, calculates total,
    auto-creates PantryItems with expiry dates, marks cart as purchased.
    """
    cart_items = await db_config.db["cart"].find(
        {"session_id": session_id, "status": "in_cart"}
    ).to_list(100)

    if not cart_items:
        raise HTTPException(status_code=400, detail="Cart is empty")

    now = datetime.utcnow()
    total = 0.0
    pantry_docs = []

    for item in cart_items:
        sku_id   = item["sku_id"]
        price    = SKU_PRICES.get(sku_id, 0.0)
        days     = SHELF_LIFE.get(sku_id, 365)
        name     = SKU_NAMES.get(sku_id, sku_id)
        total   += price * item.get("quantity", 1)
        pantry_docs.append({
            "user_id":       user_id,
            "sku_id":        sku_id,
            "name":          name,
            "quantity":      item.get("quantity", 1),
            "purchase_date": now,
            "expiry_date":   now + timedelta(days=days),
            "status":        "in_pantry",
        })

    # Insert pantry items
    if pantry_docs:
        await db_config.db["pantry"].insert_many(pantry_docs)

    # Mark cart as purchased
    await db_config.db["cart"].update_many(
        {"session_id": session_id, "status": "in_cart"},
        {"$set": {"status": "purchased"}}
    )

    return {
        "message":    "Checkout successful",
        "user_id":    user_id,
        "session_id": session_id,
        "total":      round(total, 2),
        "items_count": len(cart_items),
    }

# ── Pantry ────────────────────────────────────────────────────────────────────
@router.get("/pantry/{user_id}", response_model=List[PantryItem])
async def get_pantry(user_id: str):
    """Return all in_pantry items sorted by expiry date (soonest first)."""
    items = await db_config.db["pantry"].find(
        {"user_id": user_id, "status": "in_pantry"}
    ).sort("expiry_date", 1).to_list(200)
    return items

@router.patch("/pantry/{user_id}/{item_id}")
async def mark_consumed(user_id: str, item_id: str):
    """Mark a pantry item as consumed."""
    try:
        oid = ObjectId(item_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid item ID")
    result = await db_config.db["pantry"].update_one(
        {"_id": oid, "user_id": user_id},
        {"$set": {"status": "consumed"}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Pantry item not found")
    return {"message": "Marked as consumed"}

@router.get("/purchases/{user_id}")
async def get_purchase_history(user_id: str):
    """Return checkout history for a user."""
    # Return grouped pantry purchases by date for history view
    items = await db_config.db["pantry"].find(
        {"user_id": user_id}
    ).sort("purchase_date", -1).to_list(500)
    # Group by purchase_date (date only)
    from itertools import groupby
    history = {}
    for item in items:
        date_key = item["purchase_date"].strftime("%Y-%m-%d")
        if date_key not in history:
            history[date_key] = {"date": date_key, "items": [], "total": 0.0}
        price = SKU_PRICES.get(item["sku_id"], 0.0)
        history[date_key]["items"].append({
            "name": item["name"], "sku_id": item["sku_id"],
            "quantity": item.get("quantity", 1), "price": price
        })
        history[date_key]["total"] += price * item.get("quantity", 1)
    return list(history.values())


# backend/app/api/endpoints.py

@router.get("/analytics/sales-summary") # Changed from /sales to /sales-summary
async def get_sales_analytics():
    """Aggregates total sales and revenue per SKU."""
    pipeline = [
        {"$match": {"status": "purchased"}},
        {"$group": {
            "_id": "$sku_id",
            "total_sold": {"$sum": "$quantity"},
        }}
    ]
    results = await db_config.db["pantry"].aggregate(pipeline).to_list(100)
    
    enriched_results = []
    for res in results:
        sku_id = res["_id"]
        # Use the catalog to add names and calculate revenue
        enriched_results.append({
            "sku_id": sku_id,
            "name": SKU_NAMES.get(sku_id, sku_id),
            "total_sold": res["total_sold"],
            "revenue": res["total_sold"] * SKU_PRICES.get(sku_id, 0)
        })
    return enriched_results
