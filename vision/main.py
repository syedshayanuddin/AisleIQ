import cv2
import numpy as np
import threading
import logging
from collections import defaultdict
from inference_sdk import InferenceHTTPClient
from api_client import APIClient, label_to_sku

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── Session ──────────────────────────────────────────────────────────────────
SESSION_ID = "69a7633f26e35f1ab5ab2916"

# ── Roboflow Config ───────────────────────────────────────────────────────────
ROBOFLOW_API_KEY  = "1UBfVlKOa3A7H5RF7ntB"
MODEL_ID          = "dali-grocery-items-zcdvo/13"
CONFIDENCE        = 0.90
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
    def __init__(self):
        logger.info(f"Connecting to Roboflow model: {MODEL_ID}")
        self.api             = APIClient(session_id=SESSION_ID)
        self.cart_skus       = set()
        self.absence_count   = defaultdict(int)
        self.sku_names       = {}              # sku_id → class_name cache
        self.last_boxes      = []
        self.inference_thread = InferenceThread()
        self.inference_thread.start()
        logger.info("Inference thread started.")

    def process_frame(self, frame: np.ndarray, frame_count: int) -> np.ndarray:
        height, width = frame.shape[:2]
        cart_zone_y   = height // 2

        # ── Submit frame to inference thread every N frames ──────────────────
        if frame_count % INFER_EVERY_N == 0:
            self.inference_thread.submit(frame)

        # ── Get latest predictions (never blocks the camera) ─────────────────
        predictions, is_fresh = self.inference_thread.get_predictions()

        # ── On fresh inference: update cart zone state ────────────────────────
        if is_fresh:
            boxes       = []       # for overlay
            in_cart_now = set()    # SKUs visible in cart zone this inference

            for pred in predictions:
                if pred["confidence"] < CONFIDENCE:
                    continue
                x, y, w, h  = pred["x"], pred["y"], pred["width"], pred["height"]
                x1, y1      = int(x - w / 2), int(y - h / 2)
                x2, y2      = int(x + w / 2), int(y + h / 2)
                cy          = int(y)
                class_name  = pred["class"]
                sku_id      = label_to_sku(class_name)
                in_cart_zone = cy > cart_zone_y

                boxes.append((class_name, pred["confidence"], x1, y1, x2, y2, in_cart_zone))

                if in_cart_zone:
                    in_cart_now.add(sku_id)

            self.last_boxes = boxes

            # Build sets for zone logic
            in_shelf_now = set()   # SKUs positively seen in SHELF zone this inference
            for pred in predictions:
                if pred["confidence"] < CONFIDENCE:
                    continue
                cy     = int(pred["y"])
                sku_id = label_to_sku(pred["class"])
                if cy <= cart_zone_y:          # above the line = shelf zone
                    in_shelf_now.add(sku_id)

            # SKUs newly entered cart zone → ADD
            for sku in in_cart_now:
                self.absence_count[sku] = 0
                if sku not in self.cart_skus:
                    self.cart_skus.add(sku)
                    name = next((b[0] for b in boxes if label_to_sku(b[0]) == sku), sku)
                    self.sku_names[sku] = name
                    logger.info(f"ADDED   '{name}' → {sku}")
                    self.api.add_to_cart(sku_id=sku)

            # Cart SKU removal logic
            for sku in list(self.cart_skus):
                if sku in in_shelf_now:
                    # ✅ Positively detected in SHELF zone → remove immediately
                    self.cart_skus.discard(sku)
                    self.absence_count[sku] = 0
                    name = self.sku_names.get(sku, sku)
                    logger.info(f"REMOVED '{name}' ← {sku} (returned to shelf)")
                    self.api.remove_from_cart(sku_id=sku)
                elif sku not in in_cart_now:
                    # Not seen anywhere — increment absence counter
                    self.absence_count[sku] += 1
                    if self.absence_count[sku] >= REMOVE_TIMEOUT_N:
                        # Fallback: item gone for ~30s (shopper walked away?)
                        self.cart_skus.discard(sku)
                        self.absence_count[sku] = 0
                        name = self.sku_names.get(sku, sku)
                        logger.info(f"REMOVED '{name}' ← {sku} (timeout)")
                        self.api.remove_from_cart(sku_id=sku)
                else:
                    self.absence_count[sku] = 0  # still in cart zone, reset counter


        # ── Draw detection boxes from latest results ──────────────────────────
        for class_name, conf, x1, y1, x2, y2, in_cart_zone in self.last_boxes:
            color = (0, 200, 100) if in_cart_zone else (200, 200, 0)
            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
            cv2.putText(frame, f"{class_name} ({conf:.0%})",
                        (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.45, color, 1)

        # ── Zone line ─────────────────────────────────────────────────────────
        cv2.line(frame, (0, cart_zone_y), (width, cart_zone_y), (0, 0, 255), 2)
        cv2.putText(frame, "  SHELF ZONE", (10, cart_zone_y - 8),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 0, 255), 2)
        cv2.putText(frame, "  CART ZONE",  (10, cart_zone_y + 22),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 0, 255), 2)

        # ── Cart item count ───────────────────────────────────────────────────
        cv2.putText(frame, f"Cart: {len(self.cart_skus)} item(s)",
                    (width - 190, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255, 255, 0), 2)

        return frame


def main():
    system = VisionSystem()
    cap    = cv2.VideoCapture(0)

    if not cap.isOpened():
        logger.error("Could not open webcam.")
        return

    logger.info("AisleIQ Vision System started. Press 'q' to quit.")
    frame_count = 0

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                logger.error("Failed to read frame.")
                break

            processed = system.process_frame(frame, frame_count)
            frame_count += 1
            cv2.imshow("AisleIQ Vision System", processed)

            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
    finally:
        cap.release()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
