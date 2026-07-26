import os
import time
import threading
import firebase_admin
from firebase_admin import credentials, firestore
from fastapi import FastAPI, Request, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional

# Local imports
from ai_models import VerificationModel
from cache import setup_rate_limiting

from fastapi.middleware.cors import CORSMiddleware

import requests
import numpy as np

app = FastAPI(title="Smart Citizen Backend AI Service")
setup_rate_limiting(app)

# Add CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from google.auth import credentials as google_auth_creds

# Initialize Firebase Admin
cred_path = os.path.join(os.path.dirname(__file__), 'serviceAccountKey.json')
if os.path.exists(cred_path):
    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred)
else:
    print("WARNING: serviceAccountKey.json not found. Initializing with AnonymousCredentials for local dev mode...")
    anon_cred = google_auth_creds.AnonymousCredentials()
    firebase_admin.initialize_app(credential=anon_cred, options={'projectId': 'civic-engagement-app-67289'})

db = firestore.client()

def start_ngrok_and_update_firestore(port: int = 8000):
    """
    Automatically starts an ngrok tunnel and writes the public URL to Firestore.
    The mobile app reads this URL from Firestore to connect to this backend.
    """
    public_url = None

    # ── Strategy 1: Check if ngrok is already running ─────────────────
    try:
        response = requests.get('http://localhost:4040/api/tunnels', timeout=2)
        if response.status_code == 200:
            tunnels = response.json().get('tunnels', [])
            https_tunnels = [t for t in tunnels if t['public_url'].startswith('https')]
            if https_tunnels:
                public_url = https_tunnels[0]['public_url']
                print(f"♻️  Reusing existing ngrok tunnel: {public_url}")
    except Exception:
        pass  # ngrok not running yet, will start it below

    # ── Strategy 2: Start ngrok with pyngrok ──────────────────────────
    if not public_url:
        try:
            from pyngrok import ngrok, conf
            # Use any auth token set in the environment
            auth_token = os.environ.get('NGROK_AUTH_TOKEN')
            if auth_token:
                ngrok.set_auth_token(auth_token)
            tunnel = ngrok.connect(port, "http")
            public_url = tunnel.public_url
            # Prefer https
            if public_url.startswith('http://'):
                public_url = public_url.replace('http://', 'https://')
            print(f"🚀 ngrok tunnel started: {public_url}")
        except Exception as e:
            print(f"❌ pyngrok failed to start tunnel: {e}")
            print("   ➡ Make sure ngrok is installed or set NGROK_AUTH_TOKEN env var")
            return

    # ── Write URL to Firestore ────────────────────────────────────────
    if public_url:
        try:
            db.collection('settings').document('backend').set({
                'ai_url': public_url,
                'port': port,
                'updatedAt': firestore.SERVER_TIMESTAMP
            }, merge=True)
            print(f"✅ Firestore updated  →  settings/backend.ai_url = {public_url}")
            print(f"📱 Mobile app will auto-connect to this backend!")
        except Exception as e:
            print(f"❌ Failed to update Firestore: {e}")

# Start ngrok + Firestore update in background thread (non-blocking)
threading.Thread(target=start_ngrok_and_update_firestore, daemon=True).start()

verification_model = VerificationModel()

# Models for API
class VerificationResponse(BaseModel):
    status: str
    message: str

# --- Firestore Listeners ---

import math

def calculate_distance(lat1, lon1, lat2, lon2):
    # Haversine formula
    R = 6371000 # Earth radius in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1-a))

def find_similar_complaints(doc_id, category, lat, lon, new_embedding):
    """Finds complaints within 200m with visual similarity (across categories)."""
    if not lat or not lon or new_embedding is None: return None
    
    try:
        lat = float(lat)
        lon = float(lon)
    except (TypeError, ValueError):
        return None

    # Query only verified, unresolved reports (all categories)
    similar = db.collection('complaints')\
        .where('verificationStatus', '==', 'verified')\
        .get()
        
    for doc in similar:
        if doc.id == doc_id: continue
        data = doc.to_dict()
        
        if data.get('status') == 'resolved': continue
        if data.get('parentId'): continue # Skip children/duplicates to avoid circular/nested grouping
        
        # 1. Location Check (200m)
        loc = data.get('location', {})
        try:
            doc_lat = float(loc.get('latitude'))
            doc_lon = float(loc.get('longitude'))
        except (TypeError, ValueError):
            continue

        dist = calculate_distance(lat, lon, doc_lat, doc_lon)
        if dist < 200:
            # 2. Visual Similarity Check (using CLIP embeddings)
            old_embedding = data.get('visualEmbedding')
            if old_embedding and len(old_embedding) == len(new_embedding):
                # Calculate Cosine Similarity
                import numpy as np
                dot = np.dot(new_embedding, old_embedding)
                norm_a = np.linalg.norm(new_embedding)
                norm_b = np.linalg.norm(old_embedding)
                similarity = dot / (norm_a * norm_b)
                
                print(f"🔍 Similarity check {doc_id} vs {doc.id}: dist={dist:.1f}m, similarity={similarity:.4f}")
                # If similarity > 78%, it's likely the same physical issue
                if similarity >= 0.78:
                    return doc.id
    return None

def recalculate_group_severity(root_id: str):
    """
    Recalculates the combined severity score for a group of complaints.
    The group is defined by the parent report (root_id) and all children pointing to it.
    """
    if not root_id:
        return
        
    try:
        # 1. Fetch parent report
        parent_ref = db.collection('complaints').document(root_id)
        parent_snap = parent_ref.get()
        if not parent_snap.exists:
            return
            
        parent_data = parent_snap.to_dict()
        
        # 2. Fetch all children pointing to this parent
        children_snap = db.collection('complaints').where('parentId', '==', root_id).get()
        
        # 3. Collect severity scores of all verified, non-rejected reports in the group
        all_docs = [parent_snap] + list(children_snap)
        valid_reports = []
        for doc in all_docs:
            d_data = doc.to_dict()
            if d_data.get('verificationStatus') == 'verified':
                valid_reports.append(doc)
                
        if not valid_reports:
            # If no verified reports exist, use the parent's raw severity
            max_severity = parent_data.get('severityScore', 0)
            count = 1
        else:
            severities = [doc.to_dict().get('severityScore', 0) for doc in valid_reports]
            max_severity = max(severities) if severities else 0
            count = len(valid_reports)
            
        # 4. Calculate combined severity with boost
        # Diminishing returns formula: max_severity + 10 * (count - 1)^0.7
        if count <= 1:
            combined_severity = max_severity
        else:
            boost = int(10 * math.pow(count - 1, 0.7))
            combined_severity = min(100, max_severity + boost)
            
        print(f"📊 Recalculating combined severity for group {root_id}: count={count}, max={max_severity} -> combined={combined_severity}")
        
        # 5. Update combinedSeverity on ALL reports in the group
        for doc in all_docs:
            d_data = doc.to_dict()
            if d_data.get('combinedSeverity') != combined_severity:
                doc.reference.update({
                    'combinedSeverity': combined_severity,
                    'updatedAt': firestore.SERVER_TIMESTAMP
                })
                
    except Exception as e:
        print(f"❌ Error recalculating group severity for {root_id}: {e}")

def cascade_resolution(doc_id, data):
    """
    If a report is resolved, propagate this resolution status and details
    to all other reports in the same group (parent + children).
    """
    status = data.get('status')
    if status != 'resolved':
        return
        
    parent_id = data.get('parentId')
    root_id = parent_id if parent_id else doc_id
    
    resolution_data = data.get('resolution')
    resolved_at = data.get('resolvedAt')
    
    # 1. If we are a child and lack resolution details, try to read from the parent
    if parent_id and not resolution_data:
        parent_doc = db.collection('complaints').document(parent_id).get()
        if parent_doc.exists:
            p_data = parent_doc.to_dict()
            resolution_data = p_data.get('resolution')
            resolved_at = p_data.get('resolvedAt')
            
    # 2. Propagate to parent if we are a child
    if parent_id:
        parent_ref = db.collection('complaints').document(parent_id)
        parent_snap = parent_ref.get()
        if parent_snap.exists:
            p_data = parent_snap.to_dict()
            if p_data.get('status') != 'resolved':
                print(f"🔄 Cascading resolution to parent report {parent_id}")
                parent_ref.update({
                    'status': 'resolved',
                    'resolution': resolution_data,
                    'resolvedAt': resolved_at,
                    'updatedAt': firestore.SERVER_TIMESTAMP
                })
                
    # 3. Propagate to all sibling/child reports pointing to this root_id
    children = db.collection('complaints').where('parentId', '==', root_id).get()
    for child in children:
        if child.id == doc_id:
            continue
        c_data = child.to_dict()
        if c_data.get('status') != 'resolved':
            print(f"🔄 Cascading resolution to child report {child.id}")
            child.reference.update({
                'status': 'resolved',
                'resolution': resolution_data,
                'resolvedAt': resolved_at,
                'updatedAt': firestore.SERVER_TIMESTAMP
            })

def process_complaint(doc_id, data, doc_ref):
    # ── Cascade Resolution ──
    if data.get('status') == 'resolved':
        cascade_resolution(doc_id, data)
        # Recalculate group severity
        parent_id = data.get('parentId')
        root_id = parent_id if parent_id else doc_id
        recalculate_group_severity(root_id)
        return

    # Skip AI model runs if already processed to prevent infinite loops and severity changes
    if data.get('aiProcessed') is True:
        # Self-healing: validate the existing parentId connection if present
        parent_id = data.get('parentId')
        if parent_id:
            parent_doc = db.collection('complaints').document(parent_id).get()
            if not parent_doc.exists:
                print(f"🧹 Clearing non-existent parent {parent_id} on {doc_id}")
                doc_ref.update({'parentId': None, 'updatedAt': firestore.SERVER_TIMESTAMP})
                recalculate_group_severity(parent_id)
                recalculate_group_severity(doc_id)
            else:
                p_data = parent_doc.to_dict()
                should_unlink = False
                
                # We do NOT unlink if the parent status is 'resolved' so they stay grouped!
                if p_data.get('verificationStatus') == 'rejected':
                    should_unlink = True
                elif p_data.get('category') != data.get('category'):
                    should_unlink = True
                else:
                    loc = data.get('location', {})
                    p_loc = p_data.get('location', {})
                    try:
                        lat1, lon1 = float(loc.get('latitude', 0)), float(loc.get('longitude', 0))
                        lat2, lon2 = float(p_loc.get('latitude', 0)), float(p_loc.get('longitude', 0))
                        if lat1 and lon1 and lat2 and lon2:
                            dist = calculate_distance(lat1, lon1, lat2, lon2)
                            if dist >= 200:
                                should_unlink = True
                    except (TypeError, ValueError):
                        should_unlink = True
                    
                    stored_embedding = data.get('visualEmbedding')
                    if not should_unlink and stored_embedding and p_data.get('visualEmbedding'):
                        import numpy as np
                        a = np.array(stored_embedding)
                        b = np.array(p_data.get('visualEmbedding'))
                        if len(a) == len(b):
                            dot = np.dot(a, b)
                            norm_a = np.linalg.norm(a)
                            norm_b = np.linalg.norm(b)
                            similarity = dot / (norm_a * norm_b)
                            if similarity < 0.78:
                                print(f"💔 Unlinking {doc_id} from {parent_id} due to low similarity ({similarity:.4f})")
                                should_unlink = True
                
                if should_unlink:
                    doc_ref.update({'parentId': None, 'updatedAt': firestore.SERVER_TIMESTAMP})
                    recalculate_group_severity(parent_id)
                    recalculate_group_severity(doc_id)
        else:
            # If no parentId, search if there is a similar verified complaint we can group under!
            new_embedding = data.get('visualEmbedding')
            if new_embedding and data.get('verificationStatus') == 'verified':
                loc = data.get('location', {})
                found_parent = find_similar_complaints(
                    doc_id,
                    data.get('category'),
                    loc.get('latitude'),
                    loc.get('longitude'),
                    new_embedding
                )
                if found_parent:
                    print(f"🔗 Self-healing duplicate linking: {doc_id} -> {found_parent}")
                    doc_ref.update({
                        'parentId': found_parent,
                        'updatedAt': firestore.SERVER_TIMESTAMP
                    })
                    recalculate_group_severity(found_parent)
        return

    # 1. AI Verification (Run first to get status and embedding)
    image_urls = data.get('imageUrls', [])
    if not image_urls: return

    try:
        result = verification_model.verify_complaint(
            title=data.get('title', ''),
            description=data.get('description', ''),
            category=data.get('category', ''),
            image_urls=image_urls,
            location=data.get('location', {})
        )
        
        # 2. Triple-Check Grouping (Only if verified)
        parent_id = data.get('parentId')
        new_embedding = result.get('embedding')
        
        if result['status'] == 'verified' and not parent_id and new_embedding:
            loc = data.get('location', {})
            found_parent = find_similar_complaints(
                doc_id, 
                data.get('category'), 
                loc.get('latitude'), 
                loc.get('longitude'),
                new_embedding
            )
            if found_parent:
                parent_id = found_parent
                print(f"🔗 Visually verified duplicate found: {doc_id} -> {parent_id}")
        
        # Explicitly UNLINK if rejected (Clears old bad data)
        if result['status'] == 'rejected':
            parent_id = None

        # 3. Update Firestore with all new data, marking aiProcessed: True
        update_payload = {
            'verificationStatus': result['status'],
            'verificationConfidence': result['confidence'],
            'detectedIssues': result['issues'],
            'verificationReason': result['reason'],
            'priority': result['priority'],
            'severityScore': result.get('severity', 0),
            'aiContext': result.get('context', {}),
            'visualEmbedding': new_embedding, # Store for future similarity checks
            'parentId': parent_id,
            'aiProcessed': True,
            'updatedAt': firestore.SERVER_TIMESTAMP
        }
        
        doc_ref.update(update_payload)
        print(f"✅ Processed {doc_id}: {result['status']} (Severity: {result.get('severity')}, Priority: {result['priority']})")
        
        # 4. Recalculate combined severity for the group
        root_id = parent_id if parent_id else doc_id
        recalculate_group_severity(root_id)

    except Exception as e:
        print(f"❌ Error processing {doc_id}: {str(e)}")

def process_broadcast(doc_id, data):
    # No processing needed for broadcasts right now
    pass

def on_complaints_snapshot(col_snapshot, changes, read_time):
    for change in changes:
        if change.type.name in ['ADDED', 'MODIFIED']:
            process_complaint(change.document.id, change.document.to_dict(), change.document.reference)

def on_broadcasts_snapshot(col_snapshot, changes, read_time):
    for change in changes:
        if change.type.name in ['ADDED', 'MODIFIED']:
            process_broadcast(change.document.id, change.document.to_dict())

API_KEY = "AIzaSyC_J29mrAmjAFOoUos65aMnH3_itnRNOqE"
PROJECT_ID = "civic-engagement-app-67289"

def normalize_category(cat: str, title: str = '', issues: str = '') -> str:
    # 1. First check title & issues for SPECIFIC problem keywords
    specific_text = (str(title) + ' ' + str(issues)).lower().strip()
    if any(k in specific_text for k in ['garbage', 'trash', 'sanitation', 'litter', 'waste', 'dump', 'debris', 'bin']):
        return 'sanitation:solid'
    if any(k in specific_text for k in ['sewage', 'drain overflow', 'pipe leak', 'water overflow', 'flooding']):
        return 'water:sewage'
    if any(k in specific_text for k in ['water', 'drain', 'leak', 'pipe', 'flood']):
        return 'water:supply'
    if any(k in specific_text for k in ['pothole', 'road', 'crack', 'asphalt', 'surface']):
        return 'infrastructure:road'
    if any(k in specific_text for k in ['electric', 'light', 'lamp', 'wire', 'pole']):
        return 'electricity'

    # 2. Fall back to category field if title/issues didn't match specific keywords
    cat_text = str(cat).lower().strip()
    if any(k in cat_text for k in ['garbage', 'trash', 'sanitation', 'litter', 'waste']):
        return 'sanitation:solid'
    if any(k in cat_text for k in ['water', 'drain', 'sewage', 'leak', 'pipe']):
        return 'water:supply'
    if any(k in cat_text for k in ['pothole', 'road', 'infrastructure', 'crack', 'asphalt', 'surface']):
        return 'infrastructure:road'
    if any(k in cat_text for k in ['electric', 'light', 'lamp', 'wire', 'pole']):
        return 'electricity'

    return specific_text or cat_text

class RealtimeRestWorker:
    def __init__(self, api_key: str, project_id: str):
        self.api_key = api_key
        self.project_id = project_id
        self.id_token = None
        self.token_expiry = 0

    def get_id_token(self):
        if self.id_token and time.time() < self.token_expiry:
            return self.id_token
        try:
            auth_url = f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={self.api_key}"
            res = requests.post(auth_url, json={'returnSecureToken': True}, timeout=10).json()
            self.id_token = res.get('idToken')
            self.token_expiry = time.time() + 3000
            return self.id_token
        except Exception as e:
            print(f"❌ RealtimeWorker Auth Token Error: {e}")
            return None

    def clear_doc_field(self, doc_id: str, field_name: str):
        token = self.get_id_token()
        if not token: return False
        url = f"https://firestore.googleapis.com/v1/projects/{self.project_id}/databases/(default)/documents/complaints/{doc_id}?updateMask.fieldPaths={field_name}"
        headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
        try:
            r = requests.patch(url, json={'fields': {}}, headers=headers, timeout=10)
            return r.status_code == 200
        except Exception as e:
            print(f"❌ RealtimeWorker clear field failed [{doc_id}.{field_name}]: {e}")
            return False

    def update_doc_fields(self, doc_id: str, fields_dict: dict):
        token = self.get_id_token()
        if not token: return False

        update_masks = [f"updateMask.fieldPaths={k}" for k in fields_dict.keys()]
        query_str = "&".join(update_masks)
        url = f"https://firestore.googleapis.com/v1/projects/{self.project_id}/databases/(default)/documents/complaints/{doc_id}?{query_str}"

        headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
        firestore_fields = {}

        for k, v in fields_dict.items():
            if v is None:
                firestore_fields[k] = {'nullValue': None}
            elif isinstance(v, bool):
                firestore_fields[k] = {'booleanValue': v}
            elif isinstance(v, (int, float)):
                if isinstance(v, int):
                    firestore_fields[k] = {'integerValue': str(v)}
                else:
                    firestore_fields[k] = {'doubleValue': float(v)}
            elif isinstance(v, str):
                firestore_fields[k] = {'stringValue': v}
            elif isinstance(v, list):
                if v and isinstance(v[0], str):
                    firestore_fields[k] = {'arrayValue': {'values': [{'stringValue': s} for s in v]}}
                elif v and isinstance(v[0], (int, float)):
                    firestore_fields[k] = {'arrayValue': {'values': [{'doubleValue': float(n)} for n in v]}}
                else:
                    firestore_fields[k] = {'arrayValue': {'values': []}}

        try:
            r = requests.patch(url, json={'fields': firestore_fields}, headers=headers, timeout=10)
            return r.status_code == 200
        except Exception as e:
            print(f"❌ RealtimeWorker update failed [{doc_id}]: {e}")
            return False

    def poll_and_process(self):
        token = self.get_id_token()
        if not token: return

        url = f"https://firestore.googleapis.com/v1/projects/{self.project_id}/databases/(default)/documents/complaints"
        headers = {'Authorization': f'Bearer {token}'}

        try:
            r = requests.get(url, headers=headers, timeout=10)
            if r.status_code != 200: return
            documents = r.json().get('documents', [])

            for doc in documents:
                name = doc.get('name', '')
                doc_id = name.split('/')[-1]
                fields = doc.get('fields', {})

                ai_processed = fields.get('aiProcessed', {}).get('booleanValue', False)
                if ai_processed:
                    continue

                title = fields.get('title', {}).get('stringValue', '')
                description = fields.get('description', {}).get('stringValue', '')
                category = fields.get('category', {}).get('stringValue', '')
                
                img_array = fields.get('imageUrls', {}).get('arrayValue', {}).get('values', [])
                image_urls = [item.get('stringValue') for item in img_array if item.get('stringValue')]

                loc_map = fields.get('location', {}).get('mapValue', {}).get('fields', {})
                location = {
                    'address': loc_map.get('address', {}).get('stringValue', ''),
                    'latitude': float(loc_map.get('latitude', {}).get('doubleValue', loc_map.get('latitude', {}).get('integerValue', 0))),
                    'longitude': float(loc_map.get('longitude', {}).get('doubleValue', loc_map.get('longitude', {}).get('integerValue', 0))),
                }

                if not image_urls:
                    self.update_doc_fields(doc_id, {'aiProcessed': True, 'verificationStatus': 'unverified', 'verificationReason': 'No images submitted.'})
                    continue

                print(f"⚡ [Realtime Worker] Auto-Processing New Report: {doc_id} ('{title}')")

                result = verification_model.verify_complaint(
                    title=title,
                    description=description,
                    category=category,
                    image_urls=image_urls,
                    location=location
                )

                # Strict Duplicate Matching
                parent_id = self.find_duplicate_master(
                    lat=location['latitude'],
                    lon=location['longitude'],
                    category=category if category else title,
                    new_embedding=result.get('embedding'),
                    image_urls=image_urls,
                    exclude_doc_id=doc_id
                )

                payload = {
                    'verificationStatus': result['status'],
                    'verificationConfidence': float(result['confidence']),
                    'detectedIssues': result['issues'],
                    'verificationReason': result['reason'],
                    'priority': int(result['priority']),
                    'severityScore': int(result.get('severity', 0)),
                    'aiProcessed': True
                }

                if result.get('embedding'):
                    payload['visualEmbedding'] = result['embedding']

                if parent_id:
                    payload['parentId'] = parent_id
                    print(f"🔗 [Realtime Worker] Linked report {doc_id} -> Parent Master: {parent_id}")

                success = self.update_doc_fields(doc_id, payload)
                if success:
                    print(f"✅ [Realtime Worker] Processed & updated report {doc_id} -> {result['status']} (Severity: {result.get('severity')})")
        except Exception as e:
            print(f"⚠️ [Realtime Worker] Loop error: {e}")

    def find_duplicate_master(self, lat, lon, category, new_embedding, image_urls, exclude_doc_id):
        token = self.get_id_token()
        if not token: return None

        url = f"https://firestore.googleapis.com/v1/projects/{self.project_id}/databases/(default)/documents/complaints"
        headers = {'Authorization': f'Bearer {token}'}

        norm_cat = normalize_category(category, title)

        try:
            r = requests.get(url, headers=headers, timeout=10)
            if r.status_code != 200: return None
            documents = r.json().get('documents', [])

            for doc in documents:
                name = doc.get('name', '')
                doc_id = name.split('/')[-1]
                if doc_id == exclude_doc_id:
                    continue

                fields = doc.get('fields', {})
                parent_id = fields.get('parentId', {}).get('stringValue', None)
                if parent_id:
                    continue

                status = fields.get('status', {}).get('stringValue', '')
                v_status = fields.get('verificationStatus', {}).get('stringValue', '')
                if status == 'resolved' or status == 'rejected' or v_status == 'rejected' or 'rejectionReason' in fields:
                    continue

                # RULE 1: Category Match
                doc_title = fields.get('title', {}).get('stringValue', '')
                doc_cat = fields.get('category', {}).get('stringValue', '')
                doc_norm_cat = normalize_category(doc_cat, doc_title)
                if norm_cat != doc_norm_cat:
                    continue

                # RULE 2: Distance <= 50 meters
                loc_map = fields.get('location', {}).get('mapValue', {}).get('fields', {})
                try:
                    doc_lat = float(loc_map.get('latitude', {}).get('doubleValue', loc_map.get('latitude', {}).get('integerValue', 0)))
                    doc_lon = float(loc_map.get('longitude', {}).get('doubleValue', loc_map.get('longitude', {}).get('integerValue', 0)))
                except (ValueError, TypeError):
                    continue

                if doc_lat == 0 or doc_lon == 0 or lat == 0 or lon == 0:
                    continue

                dist = calculate_distance(lat, lon, doc_lat, doc_lon)
                if dist > 50.0:
                    continue

                # RULE 3: Visual Proof & Distance Match (Clean Image URL OR CLIP Cosine Similarity >= 0.75 OR Distance <= 50m)
                clean_new_imgs = [u.split('?')[0] for u in image_urls if u]
                img_array = fields.get('imageUrls', {}).get('arrayValue', {}).get('values', [])
                existing_imgs = [item.get('stringValue').split('?')[0] for item in img_array if item.get('stringValue')]
                exact_match = clean_new_imgs and existing_imgs and any(u in existing_imgs for u in clean_new_imgs)

                old_embed_values = fields.get('visualEmbedding', {}).get('arrayValue', {}).get('values', [])
                old_embedding = [float(v.get('doubleValue', v.get('integerValue', 0))) for v in old_embed_values]

                sim = 0.0
                if new_embedding is not None and old_embedding and len(old_embedding) == len(new_embedding):
                    dot = np.dot(new_embedding, old_embedding)
                    norm_a = np.linalg.norm(new_embedding)
                    norm_b = np.linalg.norm(old_embedding)
                    sim = dot / (norm_a * norm_b) if norm_a and norm_b else 0

                is_dup = exact_match or (sim >= 0.75) or (dist <= 50.0)

                if is_dup:
                    print(f"🔗 [Duplicate Match] Category '{norm_cat}' | Dist {dist:.1f}m | Sim {sim:.2f} -> Master {doc_id}")
                    return doc_id

        except Exception as e:
            print(f"⚠️ Strict duplicate check error: {e}")

        return None

    def run_full_initialization_and_clustering(self):
        print("🔍 [Startup Sweep] Scanning and catching up on all database reports...")
        token = self.get_id_token()
        if not token: return

        url = f"https://firestore.googleapis.com/v1/projects/{self.project_id}/databases/(default)/documents/complaints"
        headers = {'Authorization': f'Bearer {token}'}

        try:
            r = requests.get(url, headers=headers, timeout=10)
            if r.status_code != 200: return
            documents = r.json().get('documents', [])

            # Phase 1: Process any un-AI-processed reports
            for doc in documents:
                name = doc.get('name', '')
                doc_id = name.split('/')[-1]
                fields = doc.get('fields', {})

                ai_processed = fields.get('aiProcessed', {}).get('booleanValue', False)
                if not ai_processed:
                    title = fields.get('title', {}).get('stringValue', '')
                    description = fields.get('description', {}).get('stringValue', '')
                    category = fields.get('category', {}).get('stringValue', '')
                    img_array = fields.get('imageUrls', {}).get('arrayValue', {}).get('values', [])
                    image_urls = [item.get('stringValue') for item in img_array if item.get('stringValue')]
                    loc_map = fields.get('location', {}).get('mapValue', {}).get('fields', {})
                    location = {
                        'address': loc_map.get('address', {}).get('stringValue', ''),
                        'latitude': float(loc_map.get('latitude', {}).get('doubleValue', loc_map.get('latitude', {}).get('integerValue', 0))),
                        'longitude': float(loc_map.get('longitude', {}).get('doubleValue', loc_map.get('longitude', {}).get('integerValue', 0))),
                    }

                    if image_urls:
                        print(f"⚡ [Offline Catch-Up] Processing report: {doc_id} ('{title}')")
                        result = verification_model.verify_complaint(
                            title=title, description=description, category=category,
                            image_urls=image_urls, location=location
                        )
                        payload = {
                            'verificationStatus': result['status'],
                            'verificationConfidence': float(result['confidence']),
                            'detectedIssues': result['issues'],
                            'verificationReason': result['reason'],
                            'priority': int(result['priority']),
                            'severityScore': int(result.get('severity', 0)),
                            'aiProcessed': True
                        }
                        if result.get('embedding'):
                            payload['visualEmbedding'] = result['embedding']
                        self.update_doc_fields(doc_id, payload)

            # Re-fetch after catch-up
            r2 = requests.get(url, headers=headers, timeout=10)
            documents = r2.json().get('documents', []) if r2.status_code == 200 else documents

            # Phase 2: Perform Strict Full-Database Clustering Sweep
            parsed_docs = []
            for doc in documents:
                name = doc.get('name', '')
                doc_id = name.split('/')[-1]
                fields = doc.get('fields', {})
                title = fields.get('title', {}).get('stringValue', '')
                category = fields.get('category', {}).get('stringValue', '')
                norm_cat = normalize_category(category, title)
                status = fields.get('status', {}).get('stringValue', '')
                v_status = fields.get('verificationStatus', {}).get('stringValue', '')
                rejection = fields.get('rejectionReason', {}).get('stringValue', None)
                severity = int(fields.get('severityScore', {}).get('integerValue', fields.get('severityScore', {}).get('doubleValue', 50)))
                loc_map = fields.get('location', {}).get('mapValue', {}).get('fields', {})
                try:
                    lat = float(loc_map.get('latitude', {}).get('doubleValue', loc_map.get('latitude', {}).get('integerValue', 0)))
                    lon = float(loc_map.get('longitude', {}).get('doubleValue', loc_map.get('longitude', {}).get('integerValue', 0)))
                except: lat, lon = 0.0, 0.0

                img_array = fields.get('imageUrls', {}).get('arrayValue', {}).get('values', [])
                image_urls = [item.get('stringValue') for item in img_array if item.get('stringValue')]
                old_embed_values = fields.get('visualEmbedding', {}).get('arrayValue', {}).get('values', [])
                embedding = [float(v.get('doubleValue', v.get('integerValue', 0))) for v in old_embed_values]

                parent_id = fields.get('parentId', {}).get('stringValue', None)

                parsed_docs.append({
                    'doc_id': doc_id, 'title': title, 'category': category, 'norm_cat': norm_cat,
                    'status': status, 'v_status': v_status, 'rejection': rejection, 'severity': severity,
                    'lat': lat, 'lon': lon, 'image_urls': image_urls, 'embedding': embedding,
                    'parent_id': parent_id
                })

            patch_headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}

            # Cleanup stale cross-category or status-mismatched parent links
            doc_map = {d['doc_id']: d for d in parsed_docs}
            for d in parsed_docs:
                if d['parent_id'] and d['parent_id'] in doc_map:
                    parent_doc = doc_map[d['parent_id']]
                    if parent_doc['norm_cat'] != d['norm_cat'] or parent_doc['status'] != d['status'] or d['status'] == 'resolved' or parent_doc['status'] == 'resolved':
                        print(f"🧹 [Cleanup Stale Link] Unlinking {d['doc_id']} ('{d['title']}', status: {d['status']}) from Master {parent_doc['doc_id']} ('{parent_doc['title']}', status: {parent_doc['status']})")
                        d['parent_id'] = None
                        self.clear_doc_field(d['doc_id'], 'parentId')

            # Phase 2: Dynamic Connected-Components (Union-Find) Graph Clustering
            active_candidates = [d for d in parsed_docs if d['status'] == 'pending' and d['v_status'] != 'rejected' and not d['rejection']]

            parent_map = {d['doc_id']: d['doc_id'] for d in active_candidates}
            def find(i):
                if parent_map[i] == i:
                    return i
                parent_map[i] = find(parent_map[i])
                return parent_map[i]

            def union(i, j):
                root_i = find(i)
                root_j = find(j)
                if root_i != root_j:
                    parent_map[root_i] = root_j

            n = len(active_candidates)
            for i in range(n):
                for j in range(i+1, n):
                    d1, d2 = active_candidates[i], active_candidates[j]
                    if d1['norm_cat'] != d2['norm_cat']:
                        continue
                    if d1['lat'] == 0 or d1['lon'] == 0 or d2['lat'] == 0 or d2['lon'] == 0:
                        continue
                    dist = calculate_distance(d1['lat'], d1['lon'], d2['lat'], d2['lon'])
                    clean_imgs1 = [u.split('?')[0] for u in d1['image_urls'] if u]
                    clean_imgs2 = [u.split('?')[0] for u in d2['image_urls'] if u]
                    exact_match = clean_imgs1 and clean_imgs2 and any(u in clean_imgs2 for u in clean_imgs1)
                    sim = 0.0
                    if d1['embedding'] and d2['embedding'] and len(d1['embedding']) == len(d2['embedding']):
                        dot = np.dot(d1['embedding'], d2['embedding'])
                        norm_a = np.linalg.norm(d1['embedding'])
                        norm_b = np.linalg.norm(d2['embedding'])
                        sim = dot / (norm_a * norm_b) if norm_a and norm_b else 0.0
                    
                    is_dup = exact_match or (sim >= 0.75) or (dist <= 50.0)
                    if is_dup:
                        union(d1['doc_id'], d2['doc_id'])

            components = {}
            for d in active_candidates:
                root = find(d['doc_id'])
                if root not in components:
                    components[root] = []
                components[root].append(d)

            clustered_count = 0
            for root_id, members in components.items():
                if len(members) <= 1:
                    m = members[0]
                    self.clear_doc_field(m['doc_id'], 'parentId')
                    continue

                members.sort(key=lambda x: (-x['severity'], x['doc_id']))
                master = members[0]
                master_id = master['doc_id']
                children = members[1:]

                self.clear_doc_field(master_id, 'parentId')

                child_severities = []
                for child in children:
                    child_id = child['doc_id']
                    child_severities.append(child['severity'])
                    clustered_count += 1
                    print(f"🔗 [Graph Clustering] Linked child {child_id} ('{child['title']}') -> Master {master_id} ('{master['title']}') [Cat: {master['norm_cat']}]")
                    self.update_doc_fields(child_id, {'parentId': master_id})

                all_severities = [master['severity']] + child_severities
                comb_severity = min(100, max(all_severities) + min(20, len(children) * 5))
                self.update_doc_fields(master_id, {'combinedSeverity': comb_severity})

            print(f"✅ [Dynamic Graph Sweep] Completed! Total duplicates linked: {clustered_count}. Shifting to Real-Time 3s Polling...")

        except Exception as e:
            print(f"⚠️ Startup sweep error: {e}")

    def start_loop(self):
        print("⚡ Real-time Firestore REST Worker active (Polling every 3s)...")
        time.sleep(2)
        self.run_full_initialization_and_clustering()
        while True:
            try:
                self.poll_and_process()
            except Exception as e:
                print(f"⚠️ Worker exception: {e}")
            time.sleep(3)

# Start real-time background worker
rest_worker = RealtimeRestWorker(API_KEY, PROJECT_ID)
worker_thread = threading.Thread(target=rest_worker.start_loop, daemon=True)
worker_thread.start()

class VerificationRequest(BaseModel):
    title: str
    description: str
    category: str
    image_urls: List[str]
    location: Optional[dict] = {}

@app.post("/verify")
async def verify_endpoint(req: VerificationRequest):
    result = verification_model.verify_complaint(
        title=req.title,
        description=req.description,
        category=req.category,
        image_urls=req.image_urls,
        location=req.location or {}
    )
    return result

@app.get("/health")
async def health_check():
    return {"status": "ok", "message": "Smart Citizen Backend is running"}

if __name__ == "__main__":
    import uvicorn
    print("="*60)
    print("🏙️  Smart Citizen Backend Starting...")
    print("="*60)
    uvicorn.run(app, host="0.0.0.0", port=8000)
