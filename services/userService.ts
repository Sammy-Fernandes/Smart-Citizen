import AsyncStorage from '@react-native-async-storage/async-storage';
import firestore from '@react-native-firebase/firestore';
import { db } from '../config/firebase';

export interface UserProfile {
  displayName: string;
  address: string;
  pinCode: string;
  state: string;
  district: string;
  phoneNumber: string;
}

export interface User {
  id: string;
  uid: string;
  phoneNumber: string;
  profile?: UserProfile;
  profileComplete: boolean;
  createdAt: string;
  updatedAt: string;
}

// Database structure functions
export const initializeUserDocument = async (uid: string, phoneNumber: string): Promise<User> => {
  const userData: User = {
    id: uid,
    uid,
    phoneNumber,
    profileComplete: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  console.log("Initializing user document:", userData);
  return userData;
};

export const updateUserProfile = async (uid: string, profile: UserProfile): Promise<User> => {
  const userData: User = {
    id: uid,
    uid,
    phoneNumber: profile.phoneNumber,
    profile,
    profileComplete: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  console.log("Updating user profile:", userData);
  return userData;
};

export const getUserProfile = async (userId: string): Promise<User | null> => {
  try {
    // Validate userId
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      console.warn("Invalid user ID provided:", userId);
      return null;
    }

    // Check Firestore first
    const userDoc = await db.collection('users').doc(userId).get();

    if ((userDoc.exists as any)) {
      const userData = userDoc.data();
      if (!userData) return null;
      // Ensure we extract the profile fields correctly
      const profile: UserProfile = {
        displayName: userData.displayName || '',
        address: userData.address || '',
        pinCode: userData.pinCode || '',
        state: userData.state || '',
        district: userData.district || '',
        phoneNumber: userData.phoneNumber || ''
      };

      return {
        id: userId,
        uid: userId,
        phoneNumber: userData.phoneNumber || '',
        profile: userData.profileComplete ? profile : undefined,
        profileComplete: userData.profileComplete || false,
        createdAt: userData.createdAt?.toDate ? userData.createdAt.toDate().toISOString() : (userData.createdAt || new Date().toISOString()),
        updatedAt: userData.updatedAt?.toDate ? userData.updatedAt.toDate().toISOString() : (userData.updatedAt || new Date().toISOString())
      };
    }

    // Fallback to AsyncStorage for demo purposes
    const storedUserData = await AsyncStorage.getItem(`user_${userId}`);
    if (storedUserData) {
      return JSON.parse(storedUserData);
    }

    return null;
  } catch (error) {
    console.warn("Error getting user profile:", error);
    return null;
  }
};

export const createUserDocument = async (userId: string, phoneNumber: string, profileData?: any): Promise<void> => {
  try {
    // Validate userId
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      throw new Error('Invalid user ID');
    }

    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!(userDoc.exists as any)) {
      await userRef.set({
        phoneNumber,
        profileComplete: !!profileData,
        ...profileData,
        createdAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp()
      });
      console.log("User document created in Firestore for:", userId);
    } else {
      console.log("User document already exists for:", userId);
    }
  } catch (error: any) {
    if (error?.code === 'permission-denied' || error?.message?.includes('Missing or insufficient permissions')) {
      console.warn('Firestore permission denied (offline mode handling):', error.message);
    } else {
      console.warn('Error creating user document:', error);
    }
  }
};

export const updateUserProfileInFirestore = async (userId: string, profileData: UserProfile): Promise<void> => {
  try {
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      console.error('Invalid user ID provided to updateUserProfileInFirestore:', userId);
      throw new Error('Invalid user ID');
    }

    console.log('Updating user profile in Firestore for userId:', userId);

    const updateData = {
      displayName: profileData.displayName,
      address: profileData.address,
      pinCode: profileData.pinCode,
      state: profileData.state,
      district: profileData.district,
      phoneNumber: profileData.phoneNumber,
      profileComplete: true,
      updatedAt: firestore.FieldValue.serverTimestamp()
    };

    console.log('Update data:', updateData);

    await db.collection('users').doc(userId).update(updateData);

    const userData = await getUserProfile(userId);
    if (userData) {
      await AsyncStorage.setItem(`user_${userId}`, JSON.stringify(userData));
    }

    console.log("User profile updated in Firestore for:", userId);
  } catch (error: any) {
    if (error?.code === 'permission-denied' || error?.message?.includes('Missing or insufficient permissions')) {
      console.warn('Firestore permission denied during profile update (offline mode handling):', error.message);
    } else {
      console.error('Error updating user profile in Firestore:', error);
    }
  }
};

export const checkUserExists = async (phoneNumber: string): Promise<{ exists: boolean; user?: User }> => {
  try {
    const querySnapshot = await db.collection('users').where('phoneNumber', '==', phoneNumber).get();

    if (!querySnapshot.empty) {
      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();

      const user: User = {
        id: userDoc.id,
        uid: userDoc.id,
        phoneNumber: userData.phoneNumber || phoneNumber,
        profile: userData.profileComplete ? {
          displayName: userData.displayName || '',
          address: userData.address || '',
          pinCode: userData.pinCode || '',
          state: userData.state || '',
          district: userData.district || '',
          phoneNumber: userData.phoneNumber || phoneNumber
        } : undefined,
        profileComplete: userData.profileComplete || false,
        createdAt: userData.createdAt?.toDate ? userData.createdAt.toDate().toISOString() : (userData.createdAt || new Date().toISOString()),
        updatedAt: userData.updatedAt?.toDate ? userData.updatedAt.toDate().toISOString() : (userData.updatedAt || new Date().toISOString())
      };

      return { exists: true, user };
    }

    return { exists: false };
  } catch (error) {
    console.warn('Error checking user existence:', error);
    return { exists: false };
  }
};

export const createUserWithProfile = async (phoneNumber: string, profile: UserProfile): Promise<{ success: boolean; message: string; user?: User }> => {
  console.warn("createUserWithProfile called without UID. This function is deprecated in the secure flow.");
  return { success: false, message: 'Internal Error: UID missing' };
};

export const completeUserProfile = async (userId: string, profile: UserProfile): Promise<{ success: boolean; message: string }> => {
  try {
    await updateUserProfileInFirestore(userId, profile);
    return { success: true, message: 'Profile completed successfully' };
  } catch (error) {
    console.error("Error completing user profile:", error);
    throw error;
  }
};

export const updateUserLastLogin = async (userId: string): Promise<void> => {
  try {
    if (!userId) return;
    await db.collection('users').doc(userId).update({
      lastLoginAt: firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.warn('Error updating last login:', error);
  }
};