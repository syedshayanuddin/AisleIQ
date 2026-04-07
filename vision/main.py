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
CONFIDENCE        = 0.15  # Lowered for testing; raise back to 0.40 in production
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

            # Items newly in cart zone → ADD
            for sku in in_cart_now:
                self.absence_count[sku] = 0
                if sku not in self.cart_skus:
                    self.cart_skus.add(sku)
                    to_add.append(sku)
                    logger.info(f"CART ADD: {sku}")

            # Items back on shelf or timed out → REMOVE
            for sku in list(self.cart_skus):
                if sku in in_shelf_now:
                    self.cart_skus.discard(sku)
                    to_remove.append(sku)
                elif sku not in in_cart_now:
                    self.absence_count[sku] += 1
                    if self.absence_count[sku] >= REMOVE_TIMEOUT_N:
                        self.cart_skus.discard(sku)
                        to_remove.append(sku)

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