import firestoreModule from '@react-native-firebase/firestore';
import authModule from '@react-native-firebase/auth';

console.log("✅ Firebase initialized natively for Android/iOS via @react-native-firebase");

const auth = authModule();
const firestore = firestoreModule();

// Bypass Play Integrity / reCAPTCHA checks for testing in development
// NOTE: Real SMS to non-test numbers requires a built app (EAS Build) with SHA keys in Firebase.
if (__DEV__) {
  auth.settings.appVerificationDisabledForTesting = true;
}

// We export the default modules.
export { auth, firestore as db };
