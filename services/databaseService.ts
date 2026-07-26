import { db, firestore } from '../config/firebase';
import type { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

// Database Collections
export const DB_COLLECTIONS = {
  USERS: 'users',
  COMPLAINTS: 'complaints',
  SUGGESTIONS: 'suggestions',
  CATEGORIES: 'categories',
  UPVOTES: 'upvotes',
  COMMENTS: 'comments'
} as const;

// Types based on Native Firebase
type Timestamp = FirebaseFirestoreTypes.Timestamp | FirebaseFirestoreTypes.FieldValue;

// Complaint Interface
export interface Complaint {
  id: string;
  title: string;
  description: string;
  category: string;
  status: 'pending' | 'in-progress' | 'in_progress' | 'resolved' | 'rejected';
  priority: 'low' | 'medium' | 'high';
  location: {
    address: string;
    latitude?: number;
    longitude?: number;
  };
  state: string;
  district: string;
  imageUrls: string[]; 
  userId: string;
  userName: string;
  userPhone: string;
  upvotes: number;
  upvotedBy: string[];
  createdAt: any;
  updatedAt: any;
  resolvedAt?: any;
  assignedTo?: string;
  resolutionNotes?: string;
  resolution?: {
    note?: string;
    imageUrl?: string;
    resolvedAt?: any;
  };
  rejectionReason?: string;
  rejectionTags?: string[];
  rejectedAt?: any;
  rejectedBy?: string;
  rejection?: {
    reason?: string;
    note?: string;
    tags?: string[];
    rejectedAt?: any;
    rejectedBy?: string;
  };
  verificationStatus?: 'verified' | 'rejected' | 'unverified';
  verificationConfidence?: number;
  detectedIssues?: string[];
}

// Suggestion Interface
export interface Suggestion {
  id: string;
  title: string;
  description: string;
  category: string;
  location?: {
    address: string;
    latitude?: number;
    longitude?: number;
  };
  userId: string;
  userName: string;
  userPhone: string;
  upvotes: number;
  upvotedBy: string[];
  createdAt: any;
  updatedAt: any;
  implemented: boolean;
  implementedAt?: any;
}

// Category Interface
export interface Category {
  id: string;
  name: string;
  type: 'complaint' | 'suggestion';
  description: string;
  icon: string;
  color: string;
}

// Upvote Interface
export interface Upvote {
  id: string;
  userId: string;
  itemId: string;
  itemType: 'complaint' | 'suggestion';
  createdAt: any;
}

// Comment Interface
export interface Comment {
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  itemId: string;
  itemType: 'complaint' | 'suggestion';
  content: string;
  createdAt: any;
  updatedAt: any;
}

// Initialize default categories
export const initializeDefaultCategories = async (): Promise<void> => {
  const defaultCategories: Omit<Category, 'id'>[] = [
    // Complaint Categories
    { name: 'Sanitation', type: 'complaint', description: 'Garbage collection, cleaning issues', icon: 'trash', color: '#ff6b6b' },
    { name: 'Infrastructure', type: 'complaint', description: 'Roads, street lights, public facilities', icon: 'construct', color: '#4ecdc4' },
    { name: 'Water Supply', type: 'complaint', description: 'Water issues, pipeline problems', icon: 'water', color: '#45b7d1' },
    { name: 'Electricity', type: 'complaint', description: 'Power outages, electrical issues', icon: 'flash', color: '#ffa500' },
    { name: 'Public Safety', type: 'complaint', description: 'Safety concerns, security issues', icon: 'shield', color: '#96ceb4' },
    // Suggestion Categories
    { name: 'Infrastructure Improvement', type: 'suggestion', description: 'Suggestions for better infrastructure', icon: 'build', color: '#4ecdc4' },
    { name: 'Community Services', type: 'suggestion', description: 'Improvements in community services', icon: 'people', color: '#45b7d1' },
    { name: 'Environmental', type: 'suggestion', description: 'Green initiatives, environmental improvements', icon: 'leaf', color: '#96ceb4' },
    { name: 'Safety & Security', type: 'suggestion', description: 'Safety and security enhancements', icon: 'shield-checkmark', color: '#ff6b6b' },
    { name: 'Other Suggestions', type: 'suggestion', description: 'Other improvement suggestions', icon: 'bulb', color: '#ffa500' }
  ];

  try {
    const categoriesSnapshot = await db.collection(DB_COLLECTIONS.CATEGORIES).get();
    if (categoriesSnapshot.empty) {
      console.log('Initializing default categories...');
      const batch = db.batch();

      defaultCategories.forEach(category => {
        const docRef = db.collection(DB_COLLECTIONS.CATEGORIES).doc();
        batch.set(docRef, category);
      });

      await batch.commit();
      console.log('Default categories initialized successfully');
    }
  } catch (error) {
    console.warn('Error initializing categories:', error);
  }
};

// Initialize database structure
export const initializeDatabaseStructure = async (): Promise<void> => {
  try {
    await initializeDefaultCategories();
    console.log('Database structure initialized successfully');
  } catch (error) {
    console.warn('Error initializing database structure:', error);
  }
};

// Complaint Functions
export const createComplaint = async (complaintData: Omit<Complaint, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  try {
    const { auth } = await import('../config/firebase');
    const currentUser = auth.currentUser;

    if (!currentUser) {
      console.error("Attempted to create complaint without active Firebase session.");
      throw new Error("You must be logged in to file a complaint. Please restart the app or log in again.");
    }

    complaintData.userId = currentUser.uid;

    if (!complaintData.title?.trim()) throw new Error('Title is required');
    if (!complaintData.description?.trim()) throw new Error('Description is required');
    if (!complaintData.category) throw new Error('Category is required');
    if (!complaintData.userId) throw new Error('User ID is required');

    const complaintToSave: any = {
      title: complaintData.title.trim(),
      description: complaintData.description.trim(),
      category: complaintData.category,
      status: complaintData.status || 'pending',
      priority: complaintData.priority || 'medium',
      location: complaintData.location || { address: '' },
      state: complaintData.state || '',
      district: complaintData.district || '',
      imageUrls: complaintData.imageUrls || [], 
      userId: complaintData.userId,
      userName: complaintData.userName || 'User',
      userPhone: complaintData.userPhone || '',
      upvotes: complaintData.upvotes || 0,
      upvotedBy: complaintData.upvotedBy || [],
      createdAt: firestore.FieldValue.serverTimestamp(),
      updatedAt: firestore.FieldValue.serverTimestamp()
    };

    if (complaintData.resolvedAt) complaintToSave.resolvedAt = complaintData.resolvedAt;
    if (complaintData.assignedTo) complaintToSave.assignedTo = complaintData.assignedTo;
    if (complaintData.resolutionNotes) complaintToSave.resolutionNotes = complaintData.resolutionNotes;

    const docRef = await db.collection(DB_COLLECTIONS.COMPLAINTS).add(complaintToSave);
    return docRef.id;
  } catch (error: any) {
    if (error?.code === 'permission-denied') {
      throw new Error("Permission Denied: Unable to submit report.");
    }
    throw new Error(`Failed to create complaint: ${(error as Error).message}`);
  }
};

export const getUserComplaints = async (userId: string, limitCount: number = 10): Promise<Complaint[]> => {
  try {
    if (!userId || typeof userId !== 'string' || userId.trim() === '') return [];

    const querySnapshot = await db.collection(DB_COLLECTIONS.COMPLAINTS)
      .where('userId', '==', userId)
      .limit(limitCount)
      .get();
      
    const complaints = querySnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Complaint));
    
    return complaints.sort((a: any, b: any) => {
      const aTime = a.createdAt?.toMillis?.() ?? 0;
      const bTime = b.createdAt?.toMillis?.() ?? 0;
      return bTime - aTime;
    });
  } catch (error) {
    console.warn('Error fetching user complaints:', error);
    return [];
  }
};

export const getAllComplaints = async (limitCount: number = 20): Promise<Complaint[]> => {
  try {
    const querySnapshot = await db.collection(DB_COLLECTIONS.COMPLAINTS)
      .orderBy('createdAt', 'desc')
      .limit(limitCount)
      .get();

    return querySnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Complaint));
  } catch (error) {
    console.warn('Error fetching all complaints:', error);
    return [];
  }
};

// Suggestion Functions
export const createSuggestion = async (suggestionData: Omit<Suggestion, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  try {
    const { auth } = await import('../config/firebase');
    const currentUser = auth.currentUser;

    if (!currentUser) {
      throw new Error("You must be logged in to make a suggestion.");
    }

    if (!suggestionData.title?.trim()) throw new Error('Title is required');
    if (!suggestionData.description?.trim()) throw new Error('Description is required');
    if (!suggestionData.category) throw new Error('Category is required');

    const suggestionToSave: any = {
      title: suggestionData.title.trim(),
      description: suggestionData.description.trim(),
      category: suggestionData.category,
      location: suggestionData.location || { address: '' },
      userId: currentUser.uid,
      userName: suggestionData.userName || 'User',
      userPhone: suggestionData.userPhone || '',
      upvotes: 0,
      upvotedBy: [],
      implemented: false,
      createdAt: firestore.FieldValue.serverTimestamp(),
      updatedAt: firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection(DB_COLLECTIONS.SUGGESTIONS).add(suggestionToSave);
    return docRef.id;
  } catch (error: any) {
    console.error('Error creating suggestion:', error);
    throw new Error(error.message || 'Failed to create suggestion');
  }
};

export const getUserSuggestions = async (userId: string, limitCount: number = 10): Promise<Suggestion[]> => {
  try {
    if (!userId || typeof userId !== 'string' || userId.trim() === '') return [];

    const querySnapshot = await db.collection(DB_COLLECTIONS.SUGGESTIONS)
      .where('userId', '==', userId)
      .limit(limitCount)
      .get();
      
    const suggestions = querySnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Suggestion));
    
    return suggestions.sort((a: any, b: any) => {
      const aTime = a.createdAt?.toMillis?.() ?? 0;
      const bTime = b.createdAt?.toMillis?.() ?? 0;
      return bTime - aTime;
    });
  } catch (error) {
    console.warn('Error fetching user suggestions:', error);
    return [];
  }
};

export const getAllSuggestions = async (limitCount: number = 20): Promise<Suggestion[]> => {
  try {
    const querySnapshot = await db.collection(DB_COLLECTIONS.SUGGESTIONS)
      .orderBy('createdAt', 'desc')
      .limit(limitCount)
      .get();

    return querySnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Suggestion));
  } catch (error) {
    console.warn('Error fetching all suggestions:', error);
    return [];
  }
};

// Upvote Functions
export const addUpvote = async (userId: string, itemId: string, itemType: 'complaint' | 'suggestion'): Promise<void> => {
  try {
    if (!userId || !itemId) throw new Error('Invalid user ID or item ID');

    const collectionName = itemType === 'complaint' ? DB_COLLECTIONS.COMPLAINTS : DB_COLLECTIONS.SUGGESTIONS;
    const itemRef = db.collection(collectionName).doc(itemId);
    const itemDoc = await itemRef.get();

    if (!(itemDoc.exists as any)) throw new Error('Item not found');

    const itemData = itemDoc.data()!;
    const upvotedBy = itemData.upvotedBy || [];

    if (upvotedBy.includes(userId)) throw new Error('Already upvoted');

    await itemRef.update({
      upvotes: (itemData.upvotes || 0) + 1,
      upvotedBy: [...upvotedBy, userId]
    });
  } catch (error) {
    console.warn('Error adding upvote:', error);
    throw error;
  }
};

export const removeUpvote = async (userId: string, itemId: string, itemType: 'complaint' | 'suggestion'): Promise<void> => {
  try {
    if (!userId || !itemId) throw new Error('Invalid user ID or item ID');

    const collectionName = itemType === 'complaint' ? DB_COLLECTIONS.COMPLAINTS : DB_COLLECTIONS.SUGGESTIONS;
    const itemRef = db.collection(collectionName).doc(itemId);
    const itemDoc = await itemRef.get();

    if ((itemDoc.exists as any)) {
      const itemData = itemDoc.data()!;
      const upvotedBy = itemData.upvotedBy || [];
      const updatedUpvotedBy = upvotedBy.filter((id: string) => id !== userId);

      await itemRef.update({
        upvotes: Math.max(0, (itemData.upvotes || 0) - 1),
        upvotedBy: updatedUpvotedBy
      });
    }
  } catch (error) {
    console.warn('Error removing upvote:', error);
    throw error;
  }
};

// Category Functions
export const getCategories = async (type?: 'complaint' | 'suggestion'): Promise<Category[]> => {
  try {
    let querySnapshot;
    if (type) {
      querySnapshot = await db.collection(DB_COLLECTIONS.CATEGORIES).where('type', '==', type).get();
    } else {
      querySnapshot = await db.collection(DB_COLLECTIONS.CATEGORIES).get();
    }

    const categories = querySnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Category));
    
    // Deduplicate by name to prevent UI bugs if DB has duplicates
    const seen = new Set();
    return categories.filter((cat: Category) => {
      if (seen.has(cat.name)) return false;
      seen.add(cat.name);
      return true;
    });
  } catch (error) {
    console.warn('Error fetching categories:', error);
    return [];
  }
};

// Stats Functions
export const getUserStats = async (userId: string) => {
  try {
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      return { totalComplaints: 0, resolvedComplaints: 0, rejectedComplaints: 0, inProgressComplaints: 0, pendingComplaints: 0, totalSuggestions: 0 };
    }

    const [complaints, suggestions] = await Promise.all([
      getUserComplaints(userId),
      getUserSuggestions(userId)
    ]);

    return {
      totalComplaints: complaints.length,
      resolvedComplaints: complaints.filter(c => c.status === 'resolved').length,
      rejectedComplaints: complaints.filter(c => c.status === 'rejected' || c.verificationStatus === 'rejected').length,
      inProgressComplaints: complaints.filter(c => c.status === 'in-progress' || c.status === 'in_progress').length,
      pendingComplaints: complaints.filter(c => c.status === 'pending' || !c.status).length,
      totalSuggestions: suggestions.length
    };
  } catch (error) {
    console.warn('Error fetching user stats:', error);
    return { totalComplaints: 0, resolvedComplaints: 0, rejectedComplaints: 0, inProgressComplaints: 0, pendingComplaints: 0, totalSuggestions: 0 };
  }
};

// User Functions
export const getUserProfile = async (userId: string): Promise<any> => {
  try {
    if (!userId || typeof userId !== 'string' || userId.trim() === '') return null;
    const userDoc = await db.collection(DB_COLLECTIONS.USERS).doc(userId).get();
    return (userDoc.exists as any) ? { id: userDoc.id, ...userDoc.data() } : null;
  } catch (error) {
    console.warn('Error fetching user profile:', error);
    return null;
  }
};

export const updateUserProfile = async (userId: string, profileData: any): Promise<void> => {
  try {
    if (!userId || typeof userId !== 'string' || userId.trim() === '') throw new Error('Invalid user ID');
    await db.collection(DB_COLLECTIONS.USERS).doc(userId).update({
      ...profileData,
      profileComplete: true,
      updatedAt: firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.warn('Error updating user profile:', error);
    throw error;
  }
};

export const deleteComplaint = async (userId: string, complaintId: string): Promise<void> => {
  try {
    if (!userId || !complaintId) throw new Error('Invalid user or complaint ID');
    const ref = db.collection(DB_COLLECTIONS.COMPLAINTS).doc(complaintId);
    const snap = await ref.get();
    
    if (!(snap.exists as any)) throw new Error('Complaint not found');
    if (snap.data()?.userId !== userId) throw new Error('Unauthorized');

    await ref.delete();
  } catch (error) {
    console.warn('Error deleting complaint:', error);
    throw error;
  }
};

// Broadcast Functions
export const getBroadcasts = async (): Promise<any[]> => {
  try {
    const snapshot = await db.collection('broadcasts').where('active', '==', true).get();
    const items = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

    return items.sort((a: any, b: any) => {
      const aTime = a.createdAt?.seconds ?? 0;
      const bTime = b.createdAt?.seconds ?? 0;
      return bTime - aTime;
    });
  } catch (error) {
    console.warn('Error fetching broadcasts:', error);
    return [];
  }
};

// ─────────────────────────────────────────────────
// COMMUNITY HUB FUNCTIONS (CHAT & POLLS)
// ─────────────────────────────────────────────────

export const sendMessage = async (messageData: {
  text?: string;
  imageUrl?: string;
  district: string;
  senderId: string;
  senderName: string;
}) => {
  try {
    await db.collection('messages').add({
      ...messageData,
      createdAt: firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
};

export const getDistrictMessages = (district: string, callback: (messages: any[]) => void) => {
  return db.collection('messages')
    .where('district', '==', district)
    .limit(50)
    .onSnapshot((snapshot: any) => {
      try {
        const msgs = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
        // Sort client-side to avoid requiring a Firestore composite index
        const sorted = msgs.sort((a: any, b: any) => {
          const aT = a.createdAt?.seconds ?? 0;
          const bT = b.createdAt?.seconds ?? 0;
          return aT - bT;
        });
        callback(sorted);
      } catch (e) {
        console.warn('Message processing error:', e);
        callback([]);
      }
    }, (error: any) => {
      console.warn('Message stream error:', error);
      callback([]);
    });
};

export const createPoll = async (pollData: {
  question: string;
  options: string[];
  district: string;
  creatorId: string;
}) => {
  try {
    const poll = {
      question: pollData.question,
      options: pollData.options.map(opt => ({ text: opt, votes: 0, votedBy: [] })),
      district: pollData.district,
      creatorId: pollData.creatorId,
      createdAt: firestore.FieldValue.serverTimestamp(),
      active: true
    };
    await db.collection('polls').add(poll);
  } catch (error) {
    console.error('Error creating poll:', error);
    throw error;
  }
};

export const getDistrictPolls = (district: string, callback: (polls: any[]) => void) => {
  return db.collection('polls')
    .where('district', '==', district)
    .where('active', '==', true)
    .onSnapshot((snapshot: any) => {
      try {
        const polls = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
        // Sort client-side to avoid requiring a Firestore composite index
        const sorted = polls.sort((a: any, b: any) => {
          const aT = a.createdAt?.seconds ?? 0;
          const bT = b.createdAt?.seconds ?? 0;
          return bT - aT;
        });
        callback(sorted);
      } catch (e) {
        console.warn('Poll processing error:', e);
        callback([]);
      }
    }, (error: any) => {
      console.warn('Poll stream error:', error);
      callback([]);
    });
};

export const voteOnPoll = async (pollId: string, optionIndex: number, userId: string) => {
  try {
    const pollRef = db.collection('polls').doc(pollId);
    const pollDoc = await pollRef.get();
    if (!pollDoc.exists) return;

    const data: any = pollDoc.data();
    const options = [...data.options];
    
    // Check if user already voted in ANY option
    const alreadyVoted = options.some(opt => opt.votedBy?.includes(userId));
    if (alreadyVoted) throw new Error("You have already voted on this poll");

    options[optionIndex].votes += 1;
    options[optionIndex].votedBy = [...(options[optionIndex].votedBy || []), userId];

    await pollRef.update({ options });
  } catch (error) {
    console.error('Error voting:', error);
    throw error;
  }
};

// Comment Functions
export const addComment = async (
  userId: string,
  userName: string,
  itemId: string,
  itemType: 'complaint' | 'suggestion',
  content: string,
  isAdmin: boolean = false
): Promise<string> => {
  try {
    if (!content.trim()) throw new Error('Comment content cannot be empty');

    const commentData: any = {
      userId,
      userName,
      itemId,
      itemType,
      content: content.trim(),
      isAdmin,
      createdAt: firestore.FieldValue.serverTimestamp(),
      updatedAt: firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection(DB_COLLECTIONS.COMMENTS).add(commentData);
    return docRef.id;
  } catch (error) {
    console.warn('Error adding comment:', error);
    throw error;
  }
};

export const getComments = async (itemId: string, limitCount: number = 50): Promise<any[]> => {
  try {
    const querySnapshot = await db.collection(DB_COLLECTIONS.COMMENTS)
      .where('itemId', '==', itemId)
      .limit(limitCount)
      .get();

    const comments: any[] = querySnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

    return comments.sort((a, b) => {
      if (a.isAdmin && !b.isAdmin) return -1;
      if (!a.isAdmin && b.isAdmin) return 1;

      const aTime = a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || 0;
      const bTime = b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || 0;
      return bTime - aTime;
    });
  } catch (error) {
    console.warn('Error fetching comments:', error);
    return [];
  }
};

export const createUserDocument = async (userId: string, phoneNumber: string, profileData?: any): Promise<void> => {
  try {
    if (!userId || typeof userId !== 'string' || userId.trim() === '') throw new Error('Invalid user ID');

    const userRef = db.collection(DB_COLLECTIONS.USERS).doc(userId);
    const userDoc = await userRef.get();

    if (!(userDoc.exists as any)) {
      await userRef.set({
        phoneNumber,
        profileComplete: !!profileData,
        ...profileData,
        createdAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp()
      });
    }
  } catch (error) {
    console.warn('Error creating user document:', error);
    throw error;
  }
};