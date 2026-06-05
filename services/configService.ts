import { db } from '../config/firebase';

/**
 * AI Service Configuration
 * 
 * To update the backend URL without rebuilding the app:
 * 1. Go to Firebase Console -> Firestore
 * 2. Update the 'url' field in 'settings/backend'
 */
let cachedUrl = 'https://spotty-carrots-fetch.loca.lt';

export const getBackendUrl = async () => {
    try {
        const configDoc = await db.collection('settings').doc('backend').get();
        if (configDoc.exists) {
            const data = configDoc.data();
            if (data?.ai_url) {
                cachedUrl = data.ai_url;
                return cachedUrl;
            }
        }
    } catch (error) {
        console.warn('Failed to fetch dynamic backend URL, using fallback:', cachedUrl);
    }
    return cachedUrl;
};

export const AI_BACKEND_URL = cachedUrl;
