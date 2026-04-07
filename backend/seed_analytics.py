import asyncio
from datetime import datetime, timedelta
import random
# Import the specific connection functions and the config object
from app.db.mongodb import db_config, connect_to_mongo, close_mongo_connection

# Reference from your existing catalog
SKUS = [
    {"id": "SKU-001", "name": "Coca Cola 1.5L", "price": 85.0},
    {"id": "SKU-006", "name": "Pancit Canton Chilimansi", "price": 15.0},
    {"id": "SKU-008", "name": "Safeguard Soap", "price": 50.0},
    {"id": "SKU-003", "name": "Datu Puti Soy Sauce 200mL", "price": 30.0}
]

async def seed_sales():
    print("Connecting to database...")
    # Call the standalone function from your mongodb.py
    await connect_to_mongo() 
    
    if db_config.db is None:
        print("Failed to connect to database. Check your MONGODB_URL in config.")
        return

    # Clean old dummy data
    await db_config.db["pantry"].delete_many({"status": "purchased"})
    
    dummy_purchases = []
    now = datetime.utcnow()

    for _ in range(50):
        sku = random.choice(SKUS)
        days_ago = random.randint(0, 7)
        purchase_date = now - timedelta(days=days_ago)
        
        dummy_purchases.append({
            "user_id": "demo_user",
            "sku_id": sku["id"],
            "name": sku["name"],
            "quantity": random.randint(1, 5),
            "purchase_date": purchase_date,
            "expiry_date": purchase_date + timedelta(days=30),
            "status": "purchased" 
        })

    if dummy_purchases:
        await db_config.db["pantry"].insert_many(dummy_purchases)
        print(f"Successfully seeded {len(dummy_purchases)} sales records!")
    
    # Call the standalone close function
    await close_mongo_connection()

if __name__ == "__main__":
    asyncio.run(seed_sales())