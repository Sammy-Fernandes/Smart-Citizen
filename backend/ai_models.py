import os
os.environ["HF_HOME"] = "/mnt/data/cache/huggingface"
os.environ["TORCH_HOME"] = "/mnt/data/cache/torch"
os.makedirs("/mnt/data/cache/huggingface", exist_ok=True)
os.makedirs("/mnt/data/cache/torch", exist_ok=True)

from ultralytics import YOLO
import cv2
import numpy as np
import requests
import torch
from PIL import Image
from transformers import CLIPProcessor, CLIPModel


class VerificationModel:

    # Restricted to EXCLUSIVELY indoor or unrelated items.
    # Common outdoor animals (cat, dog, bird) removed to avoid false rejects.
    YOLO_REJECTION_CLASSES = {
        'microwave', 'laptop', 'tv', 'monitor', 'cell phone', 'keyboard',
        'mouse', 'remote', 'book', 'chair', 'couch', 'sofa', 'bed',
        'dining table', 'toilet', 'sink', 'refrigerator', 'oven',
        'toaster', 'bowl', 'cup', 'fork', 'knife', 'spoon', 'bottle',
        'wine glass', 'potted plant', 'vase', 'clock', 'scissors',
        'teddy bear', 'hair drier', 'toothbrush',
        'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe',
    }

    # ── YOLO classes that confirm we are in a civic / outdoor scene ───
    YOLO_CIVIC_CLASSES = {
        'car', 'truck', 'bus', 'motorcycle', 'bicycle',
        'traffic light', 'stop sign', 'fire hydrant', 'person',
    }

    # ── PASS 1 — Generic civic-issue labels ───────────────────────────
    # These are VISUAL descriptions of what any real civic issue looks like:
    # discolouration, accumulation, structural failure, liquid, damage.
    GENERIC_POSITIVE_LABELS = [
        # Liquid / water problems
        "water pooling or flooding on a street or road",
        "water leaking from a pipe or wall outdoors",
        "a waterlogged road or footpath",
        "sewage or dirty water overflowing",
        "a burst pipe with water gushing out",
        # Structural / surface damage
        "broken or cracked road surface",
        "a large hole or depression in pavement",
        "collapsed or subsided ground",
        "damaged concrete or asphalt",
        "a fallen tree or debris blocking a road",
        # Waste / sanitation
        "garbage or waste scattered on a street",
        "overflowing rubbish bins outdoors",
        "open drain clogged with debris",
        # Electrical / lighting
        "a fallen or broken street light pole",
        "exposed electrical wires on a street",
        # General deterioration — catches edge cases
        "visible civic infrastructure damage outdoors",
        "a neglected or damaged public space",
    ]

    GENERIC_NOISE_LABELS = [
        "a laptop or computer on a desk",
        "a person posing for a selfie indoors",
        "a domestic pet like a cat or dog",
        "an indoor room with furniture",
        "food on a plate or dining table",
        "a bird perched on a branch",
        "a screenshot of a phone or computer screen",
        "a clear sky with no ground visible",
        "a portrait or close-up face photo",
        "a clean and well-maintained park or garden",
        "a new and undamaged road",
    ]

    # ── PASS 2 — Category-specific labels ────────────────────────────
    # EXPANDED to include more common civic issues for better robustness.
    CATEGORY_POSITIVE_LABELS = {
        'infrastructure': ["a pothole in the road", "cracked pavement", "damaged road", "asphalt damage", "broken street light"],
        'road': ["a pothole in the road", "cracked pavement", "damaged road", "manhole cover"],
        'pothole': ["a pothole in the asphalt", "a large hole in the street", "damaged pavement", "cracked road surface"],
        'sanitation': ["a pile of garbage", "trash bags on the street", "scattered litter", "overflowing dustbin", "waste and debris"],
        'garbage': ["a pile of garbage", "trash bags on the street", "scattered litter", "overflowing dustbin", "waste and debris"],
        'trash': ["a pile of garbage", "trash bags on the street", "scattered litter", "overflowing dustbin", "waste and debris"],
        'water': [
            "water leaking from a pipe outdoors",
            "water gushing out of a broken pipe on a street",
            "a waterlogged road with standing water",
            "sewage overflowing from a drain",
            "a burst water main flooding a street",
        ],
        'water supply': [
            "water leaking from a pipe outdoors",
            "water gushing out of a broken pipe on a street",
            "a waterlogged road with standing water",
            "sewage overflowing from a drain",
            "a burst water main flooding a street",
        ],
        'public safety': [
            "a broken or cracked road surface",
            "a fallen or leaning street light pole",
            "damaged concrete on a public footpath",
            "a broken manhole cover on a street",
            "a collapsed retaining wall or boundary wall",
            "exposed electrical wires on a street",
        ],
        'drainage': [
            "an open drain clogged with garbage and silt",
            "sewage overflowing from a blocked drain",
            "stagnant dirty water accumulated on a road",
            "a flooded street due to blocked drainage",
        ],
        'electricity': [
            "a fallen electric pole on a road",
            "exposed dangling electrical wires outdoors",
            "a broken street light pole on a road",
            "sparking or damaged electrical equipment on a street",
        ],
        'streetlight': [
            "a broken street light pole on a road",
            "a street light that is damaged or non-functional",
            "a fallen lamp post on a public road",
        ],
        'tree': [
            "a fallen tree blocking a road or pavement",
            "a large branch fallen on a street",
            "an uprooted tree lying across a road",
        ],
        'building': [
            "a cracked or damaged building wall",
            "a collapsed or partially collapsed structure",
            "a building with visible structural damage",
        ],
    }

    # Fallback for categories not in the dict above
    GENERIC_FALLBACK_LABELS = [
        "visible damage to outdoor public infrastructure",
        "a public space in a state of disrepair",
        "civic infrastructure that is broken or deteriorating",
        "outdoor area with clear signs of neglect or damage",
    ]

    # ── Scoring weights ───────────────────────────────────────────────
    # Combined score = (generic_pos * W_GENERIC) + (category_pos * W_CATEGORY)
    W_GENERIC   = 0.40
    W_CATEGORY  = 0.60

    # Adjusted thresholds for better recall while maintaining precision
    THRESHOLD_BASE  = 0.40
    THRESHOLD_CIVIC = 0.35
    NOISE_CEILING   = 0.35

    def __init__(self):
        print("Loading YOLOv8n model...")
        self.model = YOLO('yolov8n.pt')

        print("Loading CLIP model (openai/clip-vit-base-patch32)...")
        try:
            self.clip_model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32", use_safetensors=True)
            self.clip_processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
            self.device = "cuda" if torch.cuda.is_available() else "cpu"
            self.clip_model.to(self.device)
            print(f"✅ CLIP loaded on {self.device}")
        except Exception as e:
            try:
                self.clip_model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
                self.clip_processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
                self.device = "cuda" if torch.cuda.is_available() else "cpu"
                self.clip_model.to(self.device)
                print(f"✅ CLIP loaded on {self.device}")
            except Exception as e2:
                print(f"❌ Error loading CLIP: {e2}")
                self.clip_model = None

        self.pothole_model = None
        if os.path.exists('yolov8n-pothole-segmentation.pt'):
            self.pothole_model = YOLO('yolov8n-pothole-segmentation.pt')
        elif os.path.exists('best_pothole.pt'):
            self.pothole_model = YOLO('best_pothole.pt')

    # ── Helpers ───────────────────────────────────────────────────────

    def download_image(self, url):
        try:
            resp = requests.get(url, stream=True, timeout=10)
            resp.raise_for_status()
            arr = np.asarray(bytearray(resp.content), dtype=np.uint8)
            img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            return img
        except Exception as e:
            print(f"❌ Download failed [{url}]: {e}")
            return None

    def _clip_scores(self, pil_img, labels):
        """Return (probs_dict, image_embedding) for the given label list."""
        inputs = self.clip_processor(
            text=labels, images=pil_img,
            return_tensors="pt", padding=True,
        ).to(self.device)
        with torch.no_grad():
            outputs = self.clip_model(**inputs)
            
        # Get probabilities
        probs = outputs.logits_per_image.softmax(dim=1).cpu().numpy()[0]
        
        # Get normalized image features (embedding)
        image_embeds = outputs.image_embeds # [1, 512]
        image_embeds = image_embeds / image_embeds.norm(p=2, dim=-1, keepdim=True)
        embedding = image_embeds.cpu().numpy()[0]
        
        return dict(zip(labels, probs)), embedding

    def _check_map_proximity(self, lat, lon):
        """Query OpenStreetMap Overpass API for sensitive amenities and high-traffic highways within 250m."""
        try:
            lat = float(lat)
            lon = float(lon)
        except (TypeError, ValueError):
            return False, False, []

        query = f"""
        [out:json][timeout:5];
        (
          node["amenity"~"school|hospital|college|university|clinic|place_of_worship"](around:250, {lat}, {lon});
          way["amenity"~"school|hospital|college|university|clinic|place_of_worship"](around:250, {lat}, {lon});
          node["highway"~"motorway|trunk|primary"](around:100, {lat}, {lon});
          way["highway"~"motorway|trunk|primary"](around:100, {lat}, {lon});
        );
        out tags;
        """
        
        try:
            url = "http://overpass-api.de/api/interpreter"
            headers = {'User-Agent': 'Civically/1.0 (civic issue reporting app; contact@civically.app)'}
            response = requests.post(url, data={'data': query}, headers=headers, timeout=7.0)
            if response.status_code == 200:
                data = response.json()
                elements = data.get("elements", [])
                
                is_sensitive = False
                is_high_traffic = False
                found_names = []
                
                for el in elements:
                    tags = el.get("tags", {})
                    name = tags.get("name", "Unknown")
                    if "amenity" in tags:
                        is_sensitive = True
                        found_names.append(f"{name} ({tags['amenity']})")
                    if "highway" in tags:
                        is_high_traffic = True
                        if name != "Unknown":
                            found_names.append(f"{name} ({tags['highway']})")
                
                return is_sensitive, is_high_traffic, found_names
        except Exception as e:
            print(f"⚠️ Map proximity check failed: {e}")
            
        return False, False, []

    def verify_complaint(self, title, description, category, image_urls, location=None):
        """
        Returns:
            {
                'status':     'verified' | 'unverified' | 'rejected',
                'confidence': float,          # 0.0–1.0
                'issues':     [str, ...],     # matched labels
                'priority':   int,            # 1–4
                'severity':   int,            # 0–100 (severity score)
                'reason':     str,            # human-readable explanation
                'context':    dict,           # detected context (traffic, area type)
            }
        """
        cat_key = category.lower().strip()
        cat_positives = self.CATEGORY_POSITIVE_LABELS.get(cat_key, self.GENERIC_FALLBACK_LABELS)
        
        overall_status   = 'unverified'
        max_combined     = 0.0
        detected_issues  = []
        rejection_reason = None
        images_processed = 0
        
        traffic_count = 0
        people_count = 0
        civic_objects = []
        final_embedding = None

        for url in image_urls:
            img_bgr = self.download_image(url)
            if img_bgr is None:
                continue
            images_processed += 1

            # ── Step 1: YOLO gate & context ───────────────────────────
            results = self.model(img_bgr, verbose=False)
            detected = set()
            img_traffic = 0
            img_people = 0
            
            for r in results:
                for box in r.boxes:
                    if float(box.conf[0]) > 0.30:
                        cls_name = self.model.names[int(box.cls[0])]
                        detected.add(cls_name)
                        if cls_name in ['car', 'truck', 'bus', 'motorcycle']:
                            img_traffic += 1
                        if cls_name == 'person':
                            img_people += 1

            rejection_hits = detected & self.YOLO_REJECTION_CLASSES
            civic_hits     = detected & self.YOLO_CIVIC_CLASSES
            
            traffic_count = max(traffic_count, img_traffic)
            people_count = max(people_count, img_people)
            civic_objects.extend(list(civic_hits))

            if rejection_hits:
                rejection_reason = f"Detected non-civic objects: {list(rejection_hits)}"
                if overall_status == 'unverified':
                    overall_status = 'rejected'
                continue

            has_civic_context = bool(civic_hits)

            if not self.clip_model:
                if has_civic_context:
                    overall_status = 'verified'
                    max_combined = max(max_combined, 0.50)
                continue

            # ── Step 2: CLIP ──────────────────────────────────────────
            img_rgb  = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
            pil_img  = Image.fromarray(img_rgb)

            # Generic
            all_generic = self.GENERIC_POSITIVE_LABELS + self.GENERIC_NOISE_LABELS
            g_scores, img_embedding = self._clip_scores(pil_img, all_generic)
            max_g_pos   = max(g_scores[l] for l in self.GENERIC_POSITIVE_LABELS)
            max_g_noise = max(g_scores[l] for l in self.GENERIC_NOISE_LABELS)
            best_g_label = max(self.GENERIC_POSITIVE_LABELS, key=lambda l: g_scores[l])

            if max_g_noise > self.NOISE_CEILING and max_g_noise > max_g_pos:
                best_noise = max(self.GENERIC_NOISE_LABELS, key=lambda l: g_scores[l])
                if overall_status == 'unverified':
                    overall_status = 'rejected'
                rejection_reason = f"Image matched noise label: '{best_noise}'"
                continue

            # Category
            c_scores, _ = self._clip_scores(pil_img, cat_positives)
            max_c_pos     = max(c_scores[l] for l in cat_positives)
            best_c_label  = max(cat_positives, key=lambda l: c_scores[l])

            # Decision
            combined = (self.W_GENERIC * max_g_pos) + (self.W_CATEGORY * max_c_pos)
            threshold = self.THRESHOLD_CIVIC if has_civic_context else self.THRESHOLD_BASE

            if combined >= threshold:
                overall_status = 'verified'
                if combined > max_combined:
                    max_combined = combined
                    final_embedding = img_embedding # Keep the best embedding
                detected_issues.append(best_c_label if max_c_pos >= 0.20 else best_g_label)
            elif has_civic_context and max_g_pos >= 0.40:
                overall_status = 'verified'
                if max_g_pos * 0.80 > max_combined:
                    max_combined = max_g_pos * 0.80
                    final_embedding = img_embedding
                detected_issues.append(best_g_label)

        if images_processed == 0:
            return {
                'status': 'unverified', 'confidence': 0.0, 'issues': [], 'priority': 1, 'severity': 0,
                'reason': 'No images could be processed.', 'context': {}
            }

        # ── Severity & Priority ───────────────────────────────────────
        severity = int(max_combined * 60)
        text_content = (title + " " + description).lower()
        addr_content = (location.get('address', '') if location else '').lower()
        
        # Comprehensive sensitive keywords checking (lowercased)
        sensitive_kws = [
            "school", "schools", "college", "colleges", "collage", "collages", 
            "hospital", "hospitals", "highway", "highways", "expressway", 
            "expressways", "temple", "temples", "mosque", "mosques", 
            "church", "churches", "clinic", "clinics"
        ]
        
        # Area analysis (Text)
        is_high_traffic_area = any(k in addr_content or k in text_content for k in ["main road", "highway", "highways", "expressway", "junction", "crossroad", "market", "station", "chowk"])
        is_residential = any(k in addr_content or k in text_content for k in ["society", "colony", "apartment", "nagar", "residential"])
        is_sensitive = any(k in addr_content or k in text_content for k in sensitive_kws)
        
        # Real-World Map Analysis (GPS)
        map_sensitive = False
        map_high_traffic = False
        map_found_names = []
        if location and 'latitude' in location and 'longitude' in location:
            map_sensitive, map_high_traffic, map_found_names = self._check_map_proximity(
                location['latitude'], location['longitude']
            )
            if map_sensitive or map_high_traffic:
                print(f"🗺️ Map Analysis: Detected nearby infrastructure -> {', '.join(map_found_names)}")
                
        is_high_traffic_area = is_high_traffic_area or map_high_traffic
        is_sensitive = is_sensitive or map_sensitive
        
        # Check proximity phrases (e.g., "near school", "opposite hospital")
        proximity_boost = 0
        if map_sensitive or map_high_traffic:
            proximity_boost = 15
            print("✨ Proximity booster triggered: matched infrastructure on OpenStreetMap (+15 severity score boost)")
        else:
            proximity_indicators = ["near", "opposite", "next to", "beside", "behind", "adjacent", "close to"]
            for indicator in proximity_indicators:
                for kw in sensitive_kws:
                    phrase1 = f"{indicator} {kw}"
                    phrase2 = f"{kw} {indicator}"
                    if phrase1 in addr_content or phrase1 in text_content or phrase2 in addr_content or phrase2 in text_content:
                        proximity_boost = 15
                        print(f"✨ Proximity booster triggered: matched '{phrase1}' or '{phrase2}' (+15 severity score boost)")
                        break
                if proximity_boost > 0:
                    break
        
        # Context Score (0-20)
        context_score = 0
        if is_high_traffic_area or traffic_count > 3: context_score += 10
        if is_sensitive: context_score += 10
        elif is_residential: context_score += 5
        
        # Urgent keywords (0-20)
        urgent_score = 0
        urgent_kws = ["danger", "emergency", "accident", "unsafe", "collapsed", "fire", "electrocution", "flood", "death"]
        if any(k in text_content for k in urgent_kws):
            urgent_score = 20
            
        severity = min(100, severity + context_score + urgent_score + proximity_boost)
        
        # Priority mapping
        priority = 1
        if severity >= 80: priority = 4   # Critical
        elif severity >= 60: priority = 3 # High
        elif severity >= 40: priority = 2 # Medium
        else: priority = 1                # Low

        reason = (
            f"Matched: {', '.join(set(detected_issues))}" if detected_issues
            else (rejection_reason or "No strong civic-issue signal found.")
        )

        return {
            'status':     overall_status,
            'confidence': float(max_combined),
            'issues':     list(set(detected_issues)),
            'priority':   priority,
            'severity':   severity,
            'reason':     reason,
            'embedding':  final_embedding.tolist() if final_embedding is not None else None,
            'context': {
                'traffic_density': 'High' if traffic_count > 5 else 'Medium' if traffic_count > 1 else 'Low',
                'people_density': 'High' if people_count > 5 else 'Medium' if people_count > 1 else 'Low',
                'area_type': 'High Traffic' if is_high_traffic_area else 'Sensitive' if is_sensitive else 'Residential' if is_residential else 'General',
                'civic_objects': list(set(civic_objects))
            }
        }
