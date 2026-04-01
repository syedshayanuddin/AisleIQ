"""
Seed the 8 dali-grocery-items SKUs into MongoDB.
Run once: python seed_skus.py
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

load_dotenv()
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME   = os.getenv("DB_NAME", "aisleiq")

SKUS = [
    {"sku_code": "SKU-001", "name": "Coca Cola 1.5L",                "description": "Coca Cola 1.5L bottle",         "price": 85.00,  "shelf_life_days": 180},
    {"sku_code": "SKU-002", "name": "Coca Cola 290mL",               "description": "Coca Cola 290mL can",           "price": 40.00,  "shelf_life_days": 180},
    {"sku_code": "SKU-003", "name": "Datu Puti Soy Sauce 200mL",     "description": "Datu Puti Soy Sauce 200mL",     "price": 30.00,  "shelf_life_days": 365},
    {"sku_code": "SKU-004", "name": "Datu Puti Soy Sauce 385mL",     "description": "Datu Puti Soy Sauce 385mL",     "price": 55.00,  "shelf_life_days": 365},
    {"sku_code": "SKU-005", "name": "Palmolive Soap",                 "description": "Palmolive soap bar",            "price": 45.00,  "shelf_life_days": 730},
    {"sku_code": "SKU-006", "name": "Pancit Canton Chilimansi",       "description": "Lucky Me Pancit Canton",        "price": 15.00,  "shelf_life_days": 540},
    {"sku_code": "SKU-007", "name": "Pancit Canton Extra Hot Chili",  "description": "Lucky Me Pancit Canton",        "price": 15.00,  "shelf_life_days": 540},
    {"sku_code": "SKU-008", "name": "Safeguard Soap",                 "description": "Safeguard antibacterial soap",  "price": 50.00,  "shelf_life_days": 730},
]

async def seed():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]
    inserted = 0
    for sku in SKUS:
        exists = await db["skus"].find_one({"sku_code": sku["sku_code"]})
        if not exists:
            await db["skus"].insert_one(sku)
            print(f"  ✅ Inserted {sku['sku_code']} — {sku['name']}")
            inserted += 1
        else:
            # Update shelf_life_days in case it changed
            await db["skus"].update_one({"sku_code": sku["sku_code"]}, {"$set": sku})
            print(f"  🔄 Updated  {sku['sku_code']} — {sku['name']}")
    client.close()
    print(f"\nDone. {inserted} new SKU(s) inserted.")

if __name__ == "__main__":
    asyncio.run(seed())
