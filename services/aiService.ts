import { Platform } from 'react-native';
import Constants from 'expo-constants';

import { db } from '../config/firebase';

const getBackendUrl = async () => {
    try {
        const doc = await db.collection('settings').doc('backend').get();
        if (doc.exists) {
            const data = doc.data();
            if (data?.ai_url) return data.ai_url;
        }
    } catch (e) {
        console.warn("Failed to fetch dynamic backend URL:", e);
    }
    return null; 
};

let AI_BACKEND_URL = '';

// Initial fetch
getBackendUrl().then(url => {
    if (url) {
        AI_BACKEND_URL = url;
        console.log("📡 AI Backend connected to:", AI_BACKEND_URL);
    }
});

export interface QueryRequest {
    user_id: string;
    query: string;
}

export interface QueryResponse {
    response: string;
    cached: boolean;
    user_stats: {
        user_id: string;
        total_queries: number;
    };
}

export const aiService = {
    async queryAI(userId: string, query: string): Promise<QueryResponse> {
        try {
            const baseUrl = await getBackendUrl();
            console.log("📡 AI Request to:", `${baseUrl}/query`);
            const response = await fetch(`${baseUrl}/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true',
                },
                body: JSON.stringify({
                    user_id: userId,
                    query: query,
                }),
            });

            if (!response.ok) {
                if (response.status === 429) {
                    throw new Error('Rate limit exceeded. Please try again in a minute.');
                }
                throw new Error('Failed to connect to Smart Citizen AI service.');
            }

            return await response.json();
        } catch (error) {
            console.error('AI Service Error:', error);
            throw error;
        }
    },

    async getUserStats(userId: string) {
        try {
            const baseUrl = await getBackendUrl();
            const response = await fetch(`${baseUrl}/user/${userId}/stats`, {
                headers: {
                    'ngrok-skip-browser-warning': 'true',
                }
            });
            if (!response.ok) throw new Error('Failed to fetch AI stats.');
            return await response.json();
        } catch (error) {
            console.error('AI Stats Error:', error);
            throw error;
        }
    }
};
