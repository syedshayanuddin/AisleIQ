from pydantic import BaseModel, Field, ConfigDict, EmailStr, BeforeValidator
from typing import List, Optional, Annotated
from datetime import datetime

PyObjectId = Annotated[str, BeforeValidator(str)]

class MongoBaseModel(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )

class User(MongoBaseModel):
    username: str
    email: EmailStr
    created_at: datetime = Field(default_factory=datetime.utcnow)

class SKU(MongoBaseModel):
    sku_code: str
    name: str
    description: Optional[str] = None
    price: float
    shelf_life_days: int

class StoreSession(MongoBaseModel):
    user_id: str
    start_time: datetime = Field(default_factory=datetime.utcnow)
    end_time: Optional[datetime] = None
    status: str = "active"

class CartItem(MongoBaseModel):
    session_id: str
    sku_id: str
    quantity: int = 1
    added_at: datetime = Field(default_factory=datetime.utcnow)
    status: str = "in_cart"

class PurchaseItem(BaseModel):
    sku_id: str
    quantity: int
    price: float
    expiry_date: datetime

class Purchase(MongoBaseModel):
    session_id: str
    user_id: str
    total_amount: float
    purchase_date: datetime = Field(default_factory=datetime.utcnow)
    items: List[PurchaseItem]

class PantryItem(MongoBaseModel):
    user_id: str
    sku_id: str
    name: str
    quantity: int = 1
    purchase_date: datetime = Field(default_factory=datetime.utcnow)
    expiry_date: datetime          # purchase_date + shelf_life_days from SKU catalog
    status: str = "in_pantry"      # in_pantry | consumed | expired
