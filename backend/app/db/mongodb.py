from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

class MongoDB:
    client: AsyncIOMotorClient = None
    db = None

db_config = MongoDB()

async def connect_to_mongo():
    logger.info("Connecting to MongoDB...")
    db_config.client = AsyncIOMotorClient(settings.MONGODB_URL)
    db_config.db = db_config.client[settings.DATABASE_NAME]
    logger.info("Connected to MongoDB!")

async def close_mongo_connection():
    if db_config.client:
        db_config.client.close()
        logger.info("Closed MongoDB connection.")
