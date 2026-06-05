import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { auth, db } from "../config/firebase";
import { FirebaseAuthTypes } from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

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

interface AuthContextType {
  user: FirebaseAuthTypes.User | null;
  profile: UserProfile | null;
  userData: User | null;
  loading: boolean;
  sendingOTP: boolean;
  verifyingOTP: boolean;
  remainingQuota: number;
  isNewUser: boolean;
  showProfileForm: boolean;
  logout: () => Promise<void>;
  sendVerificationCode: (phoneNumber: string) => Promise<{
    success: boolean;
    message: string;
    freeTier?: boolean;
  }>;
  verifyCode: (phoneNumber: string, code: string) => Promise<{ success: boolean; message: string; isNewUser?: boolean }>;
  completeProfile: (profile: UserProfile) => Promise<{ success: boolean; message: string; user?: User }>;
  getRemainingQuota: (phoneNumber: string) => number;
  setShowProfileForm: (show: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEYS = {
  USER: 'civically_user',
  USER_DATA: 'civically_user_data',
  PROFILE: 'civically_profile'
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userData, setUserData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendingOTP, setSendingOTP] = useState(false);
  const [verifyingOTP, setVerifyingOTP] = useState(false);
  const [remainingQuota] = useState(10);
  const [isNewUser, setIsNewUser] = useState(false);
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<FirebaseAuthTypes.ConfirmationResult | null>(null);

  // ─────────────────────────────────────────────────
  // AUTH STATE LISTENER
  // ─────────────────────────────────────────────────
  useEffect(() => {
    const safetyTimeout = setTimeout(() => {
      if (loading) setLoading(false);
    }, 10000);

    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      clearTimeout(safetyTimeout);
      if (currentUser) {
        setUser(currentUser);
        try {
          // Load cached data from AsyncStorage
          const [storedData, storedProfile] = await Promise.all([
            AsyncStorage.getItem(STORAGE_KEYS.USER_DATA),
            AsyncStorage.getItem(STORAGE_KEYS.PROFILE)
          ]);
          if (storedData) {
            const parsed = JSON.parse(storedData);
            setUserData(parsed);
            if (!parsed.profileComplete) {
              setIsNewUser(true);
              setShowProfileForm(true);
            }
          }
          if (storedProfile) setProfile(JSON.parse(storedProfile));
        } catch (e) {
          console.warn("Error restoring data from storage:", e);
        }
      } else {
        setUser(null);
        setUserData(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // ─────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────
  const clearStorage = async () => {
    try {
      await Promise.all([
        AsyncStorage.removeItem(STORAGE_KEYS.USER),
        AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA),
        AsyncStorage.removeItem(STORAGE_KEYS.PROFILE)
      ]);
    } catch (e) { /* ignore */ }
  };

  const saveToStorage = async (uData: User, profileData?: UserProfile) => {
    try {
      const ops: Promise<void>[] = [
        AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(uData))
      ];
      if (profileData) {
        ops.push(AsyncStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profileData)));
      }
      await Promise.all(ops);
    } catch (e) { /* ignore */ }
  };

  /** Fetch existing user doc by phone number from Firestore */
  const fetchUserByPhone = async (phoneNumber: string): Promise<User | null> => {
    try {
      const snap = await db.collection('users').where('phoneNumber', '==', phoneNumber).limit(1).get();
      if (snap.empty) return null;
      const doc = snap.docs[0];
      const data = doc.data();
      return {
        id: doc.id,
        uid: doc.id,
        phoneNumber: data.phoneNumber || phoneNumber,
        profile: data.profileComplete ? {
          displayName: data.displayName || '',
          address: data.address || '',
          pinCode: data.pinCode || '',
          state: data.state || '',
          district: data.district || '',
          phoneNumber: data.phoneNumber || phoneNumber,
        } : undefined,
        profileComplete: data.profileComplete || false,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (data.createdAt || new Date().toISOString()),
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : (data.updatedAt || new Date().toISOString()),
      };
    } catch (e) {
      console.warn('Error fetching user by phone:', e);
      return null;
    }
  };

  /** Create or overwrite a user document with set() — safe for new & existing docs */
  const upsertUserDocument = async (uid: string, phoneNumber: string, extraData?: Partial<UserProfile>) => {
    try {
      const userRef = db.collection('users').doc(uid);
      const snap = await userRef.get();
      if ((snap.exists as any)) {
        // Doc already correct — just update timestamp
        await userRef.update({ updatedAt: firestore.FieldValue.serverTimestamp() });
      } else {
        await userRef.set({
          phoneNumber,
          profileComplete: false,
          ...extraData,
          createdAt: firestore.FieldValue.serverTimestamp(),
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });
      }
    } catch (e: any) {
      console.warn('upsertUserDocument error:', e.message);
    }
  };

  const sendVerificationCode = async (phoneNumber: string) => {
    setSendingOTP(true);
    try {
      console.log("📱 Sending real OTP to:", phoneNumber);
      // Real SMS verification
      const confirmation = await auth.signInWithPhoneNumber(phoneNumber);
      setConfirmationResult(confirmation);
      return { success: true, message: 'Verification code sent to your phone' };
    } catch (error: any) {
      console.error("❌ Send OTP error:", error.message);
      let msg = 'Failed to send OTP. ';
      if (error.code === 'auth/too-many-requests') msg += 'Too many attempts. Try again later.';
      else if (error.code === 'auth/invalid-phone-number') msg += 'Invalid phone number.';
      else msg += error.message;
      
      return { success: false, message: msg };
    } finally {
      setSendingOTP(false);
    }
  };

  // ─────────────────────────────────────────────────
  // VERIFY OTP (Stable: Supports both real SMS and 123456 bypass)
  // ─────────────────────────────────────────────────
  const verifyCode = async (phoneNumber: string, code: string) => {
    setVerifyingOTP(true);
    try {
      console.log("[AUTH] Starting verification...");

      let firebaseUser;
      
      if (code === '123456') {
        // Test code bypass — keeps the app accessible for reviewers
        console.log("[AUTH] Using test code bypass...");
        const credential = await auth.signInAnonymously();
        firebaseUser = credential.user;
      } else {
        // Real OTP verification
        if (!confirmationResult) {
          return { success: false, message: 'Session expired. Please request a new code.' };
        }
        console.log("[AUTH] Verifying real OTP...");
        const credential = await confirmationResult.confirm(code);
        firebaseUser = credential.user;
      }

      if (!firebaseUser) throw new Error("Authentication failed");

      const uid = firebaseUser.uid;
      console.log("[AUTH] Signed in. UID:", uid);

      // Check LOCAL storage first
      let uData: User | null = null;
      let userIsNew = true;

      try {
        const storedData = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
        if (storedData) {
          const parsed = JSON.parse(storedData);
          if (parsed.phoneNumber === phoneNumber && parsed.profileComplete) {
            console.log("[AUTH] Returning user found in local storage");
            uData = { ...parsed, id: uid, uid };
            userIsNew = false;
            const storedProfile = await AsyncStorage.getItem(STORAGE_KEYS.PROFILE);
            if (storedProfile) uData!.profile = JSON.parse(storedProfile);
          }
        }
      } catch (e) {
        console.warn("[AUTH] Local storage check failed:", e);
      }

      // If not in local storage, check FIRESTORE (safely)
      if (userIsNew) {
        try {
          console.log("[AUTH] Checking Firestore for existing user with phone:", phoneNumber);
          
          // Try with and without +91 prefix
          const phoneFormats = [phoneNumber];
          if (!phoneNumber.startsWith('+')) {
            phoneFormats.push('+91' + phoneNumber);
            if (phoneNumber.startsWith('91')) {
               phoneFormats.push('+' + phoneNumber);
            }
          } else if (phoneNumber.startsWith('+91')) {
            phoneFormats.push(phoneNumber.substring(3));
          }

          console.log("[AUTH] Trying formats:", phoneFormats);
          
          let foundDoc = null;
          for (const format of phoneFormats) {
            const userDoc = await db.collection('users').where('phoneNumber', '==', format).limit(1).get();
            if (!userDoc.empty) {
              foundDoc = userDoc.docs[0];
              break;
            }
          }

          if (foundDoc) {
            const data = foundDoc.data();
            console.log("[AUTH] Existing user found in Firestore:", data);
            
            // Map top-level fields back to the profile object
            const profileData: UserProfile = {
              displayName: data.displayName || '',
              address: data.address || '',
              pinCode: data.pinCode || '',
              state: data.state || '',
              district: data.district || '',
              phoneNumber: data.phoneNumber || phoneNumber,
            };

            uData = {
              id: uid,
              uid,
              phoneNumber: data.phoneNumber || phoneNumber,
              profileComplete: data.profileComplete || false,
              createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              profile: profileData
            };
            userIsNew = !data.profileComplete;
          }
        } catch (e) {
          console.warn("[AUTH] Firestore check failed during login:", e);
        }
      }

      // If still no user data, create fresh user
      if (!uData) {
        console.log("[AUTH] New user, creating data...");
        uData = {
          id: uid,
          uid,
          phoneNumber,
          profileComplete: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }

      // Set state
      setUser(firebaseUser);
      setUserData(uData);
      setIsNewUser(userIsNew);
      setShowProfileForm(userIsNew);
      if (uData.profile) setProfile(uData.profile);

      // Save to AsyncStorage
      try {
        await saveToStorage(uData, uData.profile);
      } catch (e) {
        console.warn("[AUTH] AsyncStorage save failed:", e);
      }



      return {
        success: true,
        message: userIsNew ? 'Please complete your profile' : 'Welcome back!',
        isNewUser: userIsNew
      };

    } catch (error: any) {
      console.error('❌ verifyCode error:', error.message);
      const msg = `Verification failed: ${error.message || 'Unknown Error'}`;
      Alert.alert("Auth Error", msg);
      return { success: false, message: msg };
    } finally {
      setVerifyingOTP(false);
    }
  };

  // ─────────────────────────────────────────────────
  // COMPLETE PROFILE — uses set() with merge so it never crashes
  // ─────────────────────────────────────────────────
  const completeProfile = async (profileData: UserProfile) => {
    const uid = user?.uid || userData?.uid;
    if (!uid) {
      return { success: false, message: 'Not authenticated. Please log in again.' };
    }

    try {
      console.log("📝 Saving profile for UID:", uid);
      // Use set + merge:true — works whether the doc exists or not
      await db.collection('users').doc(uid).set({
        displayName: profileData.displayName,
        address: profileData.address,
        pinCode: profileData.pinCode,
        state: profileData.state,
        district: profileData.district,
        phoneNumber: profileData.phoneNumber || user?.phoneNumber || '',
        profileComplete: true,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      const updatedUserData: User = {
        id: uid,
        uid,
        phoneNumber: profileData.phoneNumber || user?.phoneNumber || '',
        profile: profileData,
        profileComplete: true,
        createdAt: userData?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setUserData(updatedUserData);
      setProfile(profileData);
      setIsNewUser(false);
      setShowProfileForm(false);
      await saveToStorage(updatedUserData, profileData);

      console.log("✅ Profile saved successfully");
      return { success: true, message: 'Profile completed!', user: updatedUserData };
    } catch (error: any) {
      console.error('❌ completeProfile error:', error.code, error.message);
      return { success: false, message: 'Failed to save profile. Please try again.' };
    }
  };

  // ─────────────────────────────────────────────────
  // LOGOUT
  // ─────────────────────────────────────────────────
  const logout = async () => {
    try {
      await clearStorage();
      setUser(null);
      setUserData(null);
      setProfile(null);
      setIsNewUser(false);
      setShowProfileForm(false);
      await auth.signOut();
    } catch (e) {
      console.warn("Logout error:", e);
      setUser(null);
    }
  };

  const getRemainingQuota = (_phoneNumber: string) => remainingQuota;

  const value: AuthContextType = {
    user, profile, userData, loading, sendingOTP, verifyingOTP,
    remainingQuota, isNewUser, showProfileForm,
    logout, sendVerificationCode, verifyCode, completeProfile,
    getRemainingQuota, setShowProfileForm
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};