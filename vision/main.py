import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import cv2
import numpy as np
import threading
import logging
from collections import defaultdict
from inference_sdk import InferenceHTTPClient
from api_client import APIClient, label_to_sku # Note: relative import for backend

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── Session ──────────────────────────────────────────────────────────────────
SESSION_ID = "69a7633f26e35f1ab5ab2916"

# ── Roboflow Config ───────────────────────────────────────────────────────────
ROBOFLOW_API_KEY  = "1UBfVlKOa3A7H5RF7ntB"
MODEL_ID          = "dali-grocery-items-zcdvo/13"
CONFIDENCE        = 0.40
INFER_EVERY_N     = 5      # Submit a new frame for inference every N frames
REMOVE_TIMEOUT_N  = 60    # Fallback: remove after this many missed inferences (~30s)

CLIENT = InferenceHTTPClient(
    api_url="https://serverless.roboflow.com",
    api_key=ROBOFLOW_API_KEY,
)


# ─────────────────────────────────────────────────────────────────────────────
# Background Inference Thread
# Camera thread submits frames; inference thread runs Roboflow in background.
# ─────────────────────────────────────────────────────────────────────────────
class InferenceThread(threading.Thread):
    def __init__(self):
        super().__init__(daemon=True)
        self._lock            = threading.Lock()
        self._frame           = None
        self._new_frame       = threading.Event()
        self.latest_preds     = []
        self.has_new          = False

    def submit(self, frame: np.ndarray):
        with self._lock:
            self._frame = frame.copy()
        self._new_frame.set()

    def run(self):
        while True:
            self._new_frame.wait()
            self._new_frame.clear()
            with self._lock:
                frame = self._frame
            if frame is None:
                continue
            try:
                result = CLIENT.infer(frame, model_id=MODEL_ID)
                with self._lock:
                    self.latest_preds = result.get("predictions", [])
                    self.has_new      = True
            except Exception as e:
                logger.error(f"Inference error: {e}")

    def get_predictions(self):
        """Returns (predictions, is_fresh). is_fresh only True once per result."""
        with self._lock:
            preds    = list(self.latest_preds)
            is_fresh = self.has_new
            self.has_new = False
        return preds, is_fresh


# ─────────────────────────────────────────────────────────────────────────────
# Vision System  —  SKU-Zone tracking (no centroid tracker needed)
#
# Rather than tracking object IDs (which are unstable across async inferences),
# we simply track WHICH SKUs are currently visible in the CART ZONE.
#   - SKU appears in cart zone  →  ADDED
#   - SKU disappears from cart zone for N consecutive inferences  →  REMOVED
# ─────────────────────────────────────────────────────────────────────────────
class VisionSystem:
    def __init__(self, session_id):
        self.api = APIClient(session_id=session_id)
        self.session_id = session_id
        self.cart_skus = set()
        self.absence_count = defaultdict(int)
        self.sku_names = {}
        self.last_boxes = []
        self.inference_thread = InferenceThread()
        self.inference_thread.start()
        self.frame_count = 0

    def process_api_frame(self, frame: np.ndarray):
        height, width = frame.shape[:2]
        cart_zone_y = height // 2
        self.frame_count += 1

        # Mobile performance: Submit every 2nd frame for inference
        if self.frame_count % 2 == 0:
            self.inference_thread.submit(frame)

        predictions, is_fresh = self.inference_thread.get_predictions()

        if is_fresh:
            in_cart_now = set()
            in_shelf_now = set()

            for pred in predictions:
                if pred["confidence"] < CONFIDENCE:
                    continue
                
                sku_id = label_to_sku(pred["class"])
                cy = int(pred["y"])
                
                if cy > cart_zone_y:
                    in_cart_now.add(sku_id)
                else:
                    in_shelf_now.add(sku_id)

            # ADD Logic
            for sku in in_cart_now:
                self.absence_count[sku] = 0
                if sku not in self.cart_skus:
                    self.cart_skus.add(sku)
                    self.api.add_to_cart(sku_id=sku)
                    logger.info(f"API ADD: {sku}")

            # REMOVE Logic (Return to shelf or Timeout)
            for sku in list(self.cart_skus):
                if sku in in_shelf_now:
                    self.cart_skus.discard(sku)
                    self.api.remove_from_cart(sku_id=sku)
                elif sku not in in_cart_now:
                    self.absence_count[sku] += 1
                    if self.absence_count[sku] >= REMOVE_TIMEOUT_N:
                        self.cart_skus.discard(sku)
                        self.api.remove_from_cart(sku_id=sku)

        return {"cart_count": len(self.cart_skus), "items": list(self.cart_skus)}