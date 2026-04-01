"""
Seeds demo pantry items — some fresh, some expiring soon, some expired.
Run once to populate the Alerts tab for demo purposes.
Usage: python3 seed_pantry_demo.py
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from datetime import datetime, timedelta
import os

load_dotenv()
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME   = os.getenv("DB_NAME", "aisleiq")
USER_ID   = "demo_user"

now = datetime.utcnow()

DEMO_ITEMS = [
    # Fresh items
    {"sku_id": "SKU-005", "name": "Palmolive Soap",               "days_offset":  200},
    {"sku_id": "SKU-008", "name": "Safeguard Soap",               "days_offset":  150},
    {"sku_id": "SKU-003", "name": "Datu Puti Soy Sauce 200mL",   "days_offset":   45},
    # Expiring soon (within 5 days)
    {"sku_id": "SKU-001", "name": "Coca Cola 1.5L",               "days_offset":    3},
    {"sku_id": "SKU-006", "name": "Pancit Canton Chilimansi",     "days_offset":    1},
    # Expired
    {"sku_id": "SKU-002", "name": "Coca Cola 290mL",              "days_offset":   -2},
]

async def seed():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]

    # Only clear DEMO items (those with negative days or very short shelf life added by this script)
    # We identify them by checking if their names match demo items exactly
    demo_names = [item["name"] for item in DEMO_ITEMS]
    result = await db["pantry"].delete_many({"user_id": USER_ID, "name": {"$in": demo_names}})
    print(f"Cleared {result.deleted_count} existing demo items (real checkout data preserved)")

    docs = []
    for item in DEMO_ITEMS:
        purchase_date = now - timedelta(days=30)
        expiry_date   = now + timedelta(days=item["days_offset"])
        docs.append({
            "user_id":       USER_ID,
            "sku_id":        item["sku_id"],
            "name":          item["name"],
            "quantity":      1,
            "purchase_date": purchase_date,
            "expiry_date":   expiry_date,
            "status":        "in_pantry",
        })

    await db["pantry"].insert_many(docs)
    client.close()

    print(f"\nSeeded {len(docs)} demo pantry items:")
    for i, item in enumerate(DEMO_ITEMS):
        status = "🔴 EXPIRED" if item["days_offset"] < 0 else ("🟡 Soon" if item["days_offset"] <= 5 else "🟢 Fresh")
        print(f"  {status}  {item['name']} ({item['days_offset']}d)")

if __name__ == "__main__":
    asyncio.run(seed())
