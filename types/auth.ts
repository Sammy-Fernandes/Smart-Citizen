import { User } from "firebase/auth";

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
}

export interface PhoneVerificationState {
  phoneNumber: string;
  verificationId: string;
}