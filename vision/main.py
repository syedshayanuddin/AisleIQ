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
CONFIDENCE        = 0.55  # 0.55 balances recall vs precision well
INFER_EVERY_N     = 5      # Submit a new frame for inference every N frames
REMOVE_TIMEOUT_N  = 60    # Fallback: remove after this many missed inferences
STABILITY_REQUIRED = 2    # Must appear in N consecutive inferences before cart ADD

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
        self.cart_skus      = set()
        self.absence_count  = defaultdict(int)
        self.stable_count   = defaultdict(int)  # consecutive frames item appeared in cart zone
        self.sku_names      = {}
        self.last_boxes     = []
        self.inference_thread = InferenceThread()
        self.inference_thread.start()
        self.frame_count    = 0

    def process_api_frame(self, frame: np.ndarray):
        """
        Process one frame and return a dict of cart changes.
        Does NOT make any HTTP calls — the endpoint handles DB writes directly.
        Returns: {add: [sku_id,...], remove: [sku_id,...], cart_skus: [...], raw_predictions: [...]}
        """
        height, width = frame.shape[:2]
        cart_zone_y = height // 2
        self.frame_count += 1

        self.inference_thread.submit(frame)
        predictions, is_fresh = self.inference_thread.get_predictions()

        to_add = []
        to_remove = []

        if is_fresh:
            if predictions:
                logger.info(f"[DEBUG] {len(predictions)} prediction(s) from Roboflow:")
                for p in predictions:
                    logger.info(f"  [{p['confidence']:.2f}] {p['class']!r}  y={int(p.get('y', 0))}")
            else:
                logger.info("[DEBUG] Roboflow returned 0 predictions.")

            in_cart_now  = set()
            in_shelf_now = set()

            # ── Top-1 per zone: track highest-confidence SKU seen in each zone ──
            # Prevents 1 physical item from triggering multiple different SKU adds.
            best_cart  = {}  # sku_id → confidence
            best_shelf = {}  # sku_id → confidence

            for pred in predictions:
                if pred["confidence"] < CONFIDENCE:
                    continue
                sku_id = label_to_sku(pred["class"])
                conf   = pred["confidence"]
                cy     = int(pred.get("y", 0))
                if cy > cart_zone_y:
                    if conf > best_cart.get(sku_id, -1):
                        best_cart[sku_id] = conf
                else:
                    if conf > best_shelf.get(sku_id, -1):
                        best_shelf[sku_id] = conf

            # If multiple different SKUs detected in cart zone, keep only the best one
            if len(best_cart) > 1:
                top_sku = max(best_cart, key=best_cart.get)
                logger.info(f"TOP-1 FILTER: keeping {top_sku} ({best_cart[top_sku]:.2f}) "
                            f"over {[s for s in best_cart if s != top_sku]}")
                best_cart = {top_sku: best_cart[top_sku]}

            in_cart_now  = set(best_cart.keys())
            in_shelf_now = set(best_shelf.keys())


            # Items newly visible in cart zone → increment stability counter
            for sku in in_cart_now:
                self.absence_count[sku] = 0
                self.stable_count[sku] += 1
                if sku not in self.cart_skus:
                    if self.stable_count[sku] >= STABILITY_REQUIRED:
                        self.cart_skus.add(sku)
                        to_add.append(sku)
                        logger.info(f"CART ADD (stable x{self.stable_count[sku]}): {sku}")
                    else:
                        logger.info(f"CART PENDING ({self.stable_count[sku]}/{STABILITY_REQUIRED}): {sku}")

            # Items back on shelf or absent → reset stability and remove from cart
            for sku in list(self.cart_skus):
                if sku in in_shelf_now:
                    self.cart_skus.discard(sku)
                    self.stable_count[sku] = 0
                    to_remove.append(sku)
                elif sku not in in_cart_now:
                    self.absence_count[sku] += 1
                    if self.absence_count[sku] >= REMOVE_TIMEOUT_N:
                        self.cart_skus.discard(sku)
                        self.stable_count[sku] = 0
                        to_remove.append(sku)

            # Also reset stability for items no longer in cart zone (prevents ghost adds)
            for sku in list(self.stable_count.keys()):
                if sku not in in_cart_now and sku not in self.cart_skus:
                    self.stable_count[sku] = 0

        raw = [{"class": p["class"], "confidence": round(p["confidence"], 3)} for p in predictions]
        return {
            "add":             to_add,
            "remove":          to_remove,
            "cart_skus":       list(self.cart_skus),
            "raw_predictions": raw,
        }
    
import time
import glob

def run_standalone():
    print("🚀 Vision System starting...")
    
    # Ensure this path matches where your backend saves frames
    # If backend is in ../backend/app/frames, use that path
    FRAME_PATH = os.path.join(os.path.dirname(__file__), "..", "backend", "frames", "*.jpg")
    
    vision = VisionSystem(SESSION_ID)
    print(f"📂 Watching for frames in: {FRAME_PATH}")
    print("💡 Tip: Move an item from the top half to the bottom half of your phone screen.")

    while True:
        # Get the latest frame saved by the backend
        files = glob.glob(FRAME_PATH)
        if not files:
            time.sleep(0.5) # Wait for a frame to arrive
            continue
            
        # Sort by modification time to get the newest
        latest_file = max(files, key=os.path.getmtime)
        
        frame = cv2.imread(latest_file)
        if frame is not None:
            # Process the frame
            result = vision.process_api_frame(frame)
            
            # Optional: Visual feedback in terminal
            if vision.frame_count % 10 == 0:
                print(f"Status: {len(vision.cart_skus)} items in cart | Processing: {os.path.basename(latest_file)}")
        
        # Clean up old frames so the folder doesn't explode
        if len(files) > 5:
            for f in files[:-1]: # Keep only the most recent one
                try: os.remove(f)
                except: pass

        time.sleep(0.1) # Don't melt the CPU

if __name__ == "__main__":
    run_standalone()