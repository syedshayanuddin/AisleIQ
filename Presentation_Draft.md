# AisleIQ: AI-Powered Smart Retail System
**Project Seminar Presentation (REVIEW - I)**
**B.E. AI & ML VIII SEM**

---

## 1. Title Slide
* **Project Title:** AisleIQ: AI-Powered Smart Vision System for Autonomous Retail Checkout
* **Team Members:** [Your Names/USNs]
* **Guide:** [Guide Name]
* **Department:** Artificial Intelligence & Machine Learning

---

## 2. Abstract (Slide 1)
* **Problem:** Traditional retail checkouts are a major bottleneck, leading to long queues and poor customer experience. Existing cashier-less systems (like Amazon Go) require expensive store-wide structural modifications.
* **Solution:** **AisleIQ** is a smart-cart based edge AI vision system. It uses advanced object detection to automatically recognize products as customers place them into or remove them from their shopping cart. 
* **Technology:** Built using **YOLOv8** for real-time edge vision processing, **FastAPI** for a high-performance asynchronous backend, and **MongoDB** for flexible inventory and cart management.
* **Outcome:** A seamless, automated, and cost-effective "scan-less" checkout experience that works directly at the cart level.

---

## 3. Existing System (Slide 2 - 3)

### Slide 2: Current Approaches
* **Barcode Scanning:** Requires manual effort for each item, time-consuming, causes long queues.
* **RFID (Radio Frequency Identification):** 
  * Requires tagging *every single item*.
  * High recurring cost (tags cost money).
  * Susceptible to physical interference (liquid/metal).
* **Self-Checkout Kiosks:** Still require manual scanning by the user, prone to theft and user error.

### Slide 3: Drawbacks of Advanced Existing Solutions
* **Store-Wide Camera Systems (e.g., Amazon Just Walk Out):** 
  * Requires installing hundreds of ceiling-mounted cameras and weight sensors on shelves.
  * Massive initial capital expenditure and infrastructure overhaul.
  * Heavy cloud-computing costs for continuous video stream processing.

---

## 4. Literature Survey (Slide 4)
| Title/Author | Approach / Method | Limitations Addressed by AisleIQ |
| :--- | :--- | :--- |
| *Real-time Object Detection with YOLOv8 (Jocher et al.)* | State-of-the-art CNN for real-time bounding box detection. | Provides the core speed and accuracy needed for edge hardware. |
| *Retail Product Checkout Dataset & Benchmarks (Wei et al.)* | Deep learning for SKU-level recognition. | Generalizes model to recognize packaged goods in varying lighting. |
| *Edge AI in IoT Retail Applications* | Processing vision locally on edge devices rather than streaming to cloud. | Solves the high-latency and bandwidth costs of cloud-based video processing. |

---

## 5. Proposed System (Slides 5 - 9)

### Slide 5: Proposed System Overview
* **Smart Cart Focus:** Move the intelligence from the store ceiling directly to the cart. 
* A camera mounted on the cart monitors the basket area (Region of Interest - ROI).
* As an item crosses the bounding plane into the cart, the edge vision module identifies it and sends an API request to the backend.
* The cart maintains a live digital tally. If the item is removed from the cart, the system detects the reversal and deducts the item.

### Slide 6: System Architecture Design (Block Diagram)
*(You can draw this in your PPT or use this flow)*
```mermaid
graph TD;
    Camera Stream --> Vision Module [Edge Vision: YOLOv8 + Tracker]
    Vision Module --> |API: Detects Item & Direction| FastAPI [Backend API]
    FastAPI <--> MongoDB [Database]
    FastAPI --> Store Dashboard / Mobile App [React/Vue UI]
```

### Slide 7: E-R Diagram (Database Structure)
* **Entities:**
  * **User:** `user_id`, `name`, `payment_info`
  * **Product:** `product_id`, `name`, `price`, `stock`, `category`
  * **Cart:** `cart_id`, `status` (active/completed), `total_amount`
  * **CartItem:** `cart_id`, `product_id`, `quantity`

### Slide 8: UML Use Case Diagram
* **Actor (Customer):** Opens CartSession, Adds Item, Removes Item, Pays Bill.
* **Actor (Edge Camera):** Captures Video, Detects Bounding Box.
* **Actor (System/Backend):** Validates Product, Updates Cart Total, Manages Inventory.

### Slide 9: UML Sequence Diagram
1. **Camera** sends video frame to **Vision Model**.
2. **Vision Model** detects "Cola" entering ROI.
3. **Vision Model** sends POST `/cart/{cart_id}/add` with `product_id` to **FastAPI Backend**.
4. **FastAPI** queries **MongoDB** for product price.
5. **FastAPI** updates cart document in DB.
6. **FastAPI** pushes updated total to the **User Interface/App**.

---

## 6. Methodology & Algorithms (Slide 10 - 11)

### Slide 10: Implementation Phases
1. **Data Collection & Annotation:** Gather images of retail products and annotate bounding boxes.
2. **Vision Model Training:** Train YOLOv8 on the retail dataset for precise classification.
3. **Region of Interest (ROI) Tracking Algorithm:** Define a virtual boundary line for the cart. Use object tracking (e.g., DeepSORT) to determine if the object centroid crosses *into* the cart (Add) or *out of* the cart (Remove).
4. **API and State Management:** Develop robust backend endpoints to handle concurrent cart updates and calculate totals.

### Slide 11: Vision-Based Action Algorithm (Pseudocode)
```python
Initialize ROI_Polygon for cart interior
For each frame in video_stream:
    detections = YOLOv8.predict(frame)
    track_objects(detections)  # Assign ID to each object
    
    For obj in tracked_objects:
        if obj.trajectory crosses exactly into ROI_Polygon:
            API.add_to_cart(cart_id, obj.class_label)
            
        elif obj.trajectory crosses exactly out of ROI_Polygon:
            API.remove_from_cart(cart_id, obj.class_label)
```

---

## 7. Dataset Description (Slide 12 - 13)

### Slide 12: Dataset Details
* **Source:** Custom curated images combined with open-source retail datasets (e.g., SKU-110K or RPC dataset).
* **Classes:** Currently configured for typical grocery/supermarket items (e.g., Snacks, Beverages, Toiletries).
* **Size:** [Specify number, e.g., 5,000 images, 15,000 annotated instances].
* **Format:** YOLO annotation format (.TXT files containing class index and normalized X, Y, W, H).

### Slide 13: Data Preparation
* **Augmentation Techniques:**
  * Random Cropping and Scaling (to simulate depth).
  * Brightness/Contrast adjustments (to handle varying store lighting).
  * Motion Blur (since items will be in motion while being dropped into the cart).
* **Data Split:** 70% Training, 20% Validation, 10% Testing.

---

## 8. Module Implementation (Slide 14 - 15)

### Slide 14: Backend Code Snippet
*(Displaying the speed and modern async nature of the backend)*
```python
@app.post("/api/v1/carts/{cart_id}/add")
async def add_item_to_cart(cart_id: str, item: CartItemAdd):
    # Retrieve cart and product securely
    cart = await db.carts.find_one({"_id": ObjectId(cart_id)})
    product = await db.products.find_one({"product_id": item.product_id})
    
    # Update cart state
    await db.carts.update_one(
        {"_id": ObjectId(cart_id)},
        {"$push": {"items": product}, "$inc": {"total": product['price']}}
    )
    return {"status": "success", "new_total": cart['total'] + product['price']}
```

### Slide 15: Sample Results
* **Vision Output:** *(Insert a screenshot here showing a bounding box around a product with a high confidence score, e.g., "Kurkure 0.95").*
* **API Output:** 
```json
{
  "cart_id": "65e6...",
  "status": "Item Added",
  "item": "Diet Coke",
  "current_total_amount": 140.00
}
```
* **Performance:** Achieving > 30 FPS on edge constraints with an mAP (Mean Average Precision) of > 90% for tested SKUs.
