import requests
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)
BASE_URL = "http://localhost:8000/api/v1"

# ─────────────────────────────────────────────────────────────────────────────
# DALI GROCERY ITEMS — Class Name → SKU Mapping
# These are the exact 8 class names from the dali-grocery-items-zcdvo/13 model.
# ─────────────────────────────────────────────────────────────────────────────
LABEL_TO_SKU: Dict[str, Dict[str, Any]] = {
    "Coca Cola 1.5L":               {"sku_id": "SKU-001", "name": "Coca Cola 1.5L",               "price": 85.00},
    "Coca Cola 290mL":              {"sku_id": "SKU-002", "name": "Coca Cola 290mL",              "price": 40.00},
    "Datu Puti Soy Sauce 200mL":    {"sku_id": "SKU-003", "name": "Datu Puti Soy Sauce 200mL",    "price": 30.00},
    "Datu Puti Soy Sauce 385mL":    {"sku_id": "SKU-004", "name": "Datu Puti Soy Sauce 385mL",    "price": 55.00},
    "Palmolive":                    {"sku_id": "SKU-005", "name": "Palmolive Soap",               "price": 45.00},
    "Pancit Canton Chilimansi":     {"sku_id": "SKU-006", "name": "Pancit Canton Chilimansi",     "price": 15.00},
    "Pancit Canton Extra Hot Chili":{"sku_id": "SKU-007", "name": "Pancit Canton Extra Hot Chili","price": 15.00},
    "Safeguard":                    {"sku_id": "SKU-008", "name": "Safeguard Soap",               "price": 50.00},
    # Fallback
    "__default__":                  {"sku_id": "SKU-000", "name": "Unknown Item",                 "price": 0.00},
}


def label_to_sku(class_label: str) -> str:
    """Convert a Roboflow class name to a store SKU ID."""
    entry = LABEL_TO_SKU.get(class_label, LABEL_TO_SKU["__default__"])
    return entry["sku_id"]


class APIClient:
    def __init__(self, session_id: str):
        self.session_id = session_id

    def add_to_cart(self, sku_id: str, quantity: int = 1) -> Dict[str, Any]:
        url = f"{BASE_URL}/cart"
        payload = {
            "session_id": self.session_id,
            "sku_id": sku_id,
            "quantity": quantity
        }
        try:
            response = requests.post(url, json=payload)
            response.raise_for_status()
            logger.info(f"Added item {sku_id} to cart remotely.")
            return response.json()
        except requests.RequestException as e:
            logger.error(f"Failed to add item {sku_id} to cart: {e}")
            return {}

    def remove_from_cart(self, sku_id: str) -> bool:
        url = f"{BASE_URL}/cart/{self.session_id}/{sku_id}"
        try:
            response = requests.delete(url)
            response.raise_for_status()
            logger.info(f"Removed item {sku_id} from cart remotely.")
            return True
        except requests.RequestException as e:
            logger.error(f"Failed to remove item {sku_id} from cart: {e}")
            return False
