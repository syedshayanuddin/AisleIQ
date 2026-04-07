from fastapi import APIRouter, HTTPException, File, UploadFile
from typing import List, Optional
from app.models.schemas import User, SKU, StoreSession, CartItem, Purchase, PantryItem
from app.db.mongodb import db_config
from bson import ObjectId
from datetime import datetime, timedelta
import cv2
import numpy as np
from vision.main import VisionSystem# Reusing your class

router = APIRouter()

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

@router.post("/detect-frame/{session_id}")
async def detect_frame(session_id: str, file: UploadFile = File(...)):
    # 1. Initialize Vision for this session if it doesn't exist
    if session_id not in vision_sessions:
        vision_sessions[session_id] = VisionSystem(session_id)
    
    # 2. Decode the frame from mobile
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if frame is None:
        raise HTTPException(status_code=400, detail="Invalid image")

    # 3. Process frame and return state
    result = vision_sessions[session_id].process_api_frame(frame)
    return {"status": "success", "data": result}


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
