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

    def update_doc_fields(self, doc_id: str, fields_dict: dict):
        token = self.get_id_token()
        if not token: return False

        update_masks = [f"updateMask.fieldPaths={k}" for k in fields_dict.keys()]
        query_str = "&".join(update_masks)
        url = f"https://firestore.googleapis.com/v1/projects/{self.project_id}/databases/(default)/documents/complaints/{doc_id}?{query_str}"

        headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
        firestore_fields = {}

        for k, v in fields_dict.items():
            if isinstance(v, bool):
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

                payload = {
                    'verificationStatus': result['status'],
                    'verificationConfidence': float(result['confidence']),
                    'detectedIssues': result['issues'],
                    'verificationReason': result['reason'],
                    'priority': int(result['priority']),
                    'severityScore': int(result.get('severity', 0)),
                    'aiProcessed': True
                }

                success = self.update_doc_fields(doc_id, payload)
                if success:
                    print(f"✅ [Realtime Worker] Processed & updated report {doc_id} -> {result['status']} (Severity: {result.get('severity')})")
        except Exception as e:
            print(f"⚠️ [Realtime Worker] Loop error: {e}")

    def start_loop(self):
        print("⚡ Real-time Firestore REST Worker active (Polling every 3s)...")
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
