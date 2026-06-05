// services/smsService.ts
// Store OTPs
const otpStore = new Map<string, { 
  code: string; 
  expiresAt: number; 
  verified: boolean;
  attempts: number;
  createdAt: number;
}>();

/**
 * Send OTP - Always works in test mode
 */
export const sendOTP = async (phoneNumber: string): Promise<{ 
  success: boolean; 
  message: string;
  code?: string;
}> => {
  try {
    // Validate phone number
    const formattedNumber = validateAndFormatPhone(phoneNumber);
    if (!formattedNumber) {
      return { success: false, message: 'Invalid phone number format' };
    }

    // Generate OTP - Always use 123456 for testing
    const otp = "123456"; // Fixed test code
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store OTP
    otpStore.set(formattedNumber, {
      code: otp,
      expiresAt,
      verified: false,
      attempts: 0,
      createdAt: Date.now()
    });

    console.log(`🎯 TEST MODE: OTP for ${formattedNumber}: ${otp}`);
    
    return { 
      success: true, 
      message: 'Test mode: Use 123456 as verification code',
      code: otp
    };

  } catch (error: any) {
    console.error('❌ SMS Error:', error);
    
    // Fallback
    const formattedNumber = validateAndFormatPhone(phoneNumber);
    const otp = "123456";
    const expiresAt = Date.now() + 10 * 60 * 1000;

    if (formattedNumber) {
      otpStore.set(formattedNumber, {
        code: otp,
        expiresAt,
        verified: false,
        attempts: 0,
        createdAt: Date.now()
      });
    }

    return {
      success: true,
      message: 'Test mode: Use 123456 as verification code',
      code: otp
    };
  }
};

/**
 * Verify OTP - Only accepts 123456
 */
export const verifyOTP = (phoneNumber: string, code: string): { 
  success: boolean; 
  message: string;
  isNewUser?: boolean;
} => {
  try {
    const formattedNumber = validateAndFormatPhone(phoneNumber);
    if (!formattedNumber) {
      return { success: false, message: 'Invalid phone number' };
    }

    const storedOTP = otpStore.get(formattedNumber);

    if (!storedOTP) {
      return { 
        success: false, 
        message: 'No OTP found. Please request a new code.' 
      };
    }

    // Check expiry
    if (Date.now() > storedOTP.expiresAt) {
      otpStore.delete(formattedNumber);
      return { 
        success: false, 
        message: 'OTP has expired. Please request a new code.' 
      };
    }

    // Track attempts
    storedOTP.attempts++;
    otpStore.set(formattedNumber, storedOTP);

    // Max 5 attempts per OTP
    if (storedOTP.attempts > 5) {
      otpStore.delete(formattedNumber);
      return { 
        success: false, 
        message: 'Too many failed attempts. Please request a new code.' 
      };
    }

    // Only accept 123456
    if (code !== '123456') {
      const remainingAttempts = 5 - storedOTP.attempts;
      return { 
        success: false, 
        message: `Invalid code. Use 123456. ${remainingAttempts} attempts remaining.` 
      };
    }

    // Mark as verified
    storedOTP.verified = true;
    otpStore.set(formattedNumber, storedOTP);

    console.log(`✅ OTP verified for ${formattedNumber}`);
    return { 
      success: true, 
      message: 'Phone number verified successfully',
      isNewUser: true // Will be determined later
    };

  } catch (error) {
    console.error('❌ OTP Verification Error:', error);
    return { 
      success: false, 
      message: 'Verification failed. Please try again.' 
    };
  }
};

// Remove quota functions since we don't need them
export const getRemainingQuota = (phoneNumber: string): number => {
  return 999; // Always show high number
};

// Keep other functions the same...
export const isOTPVerified = (phoneNumber: string): boolean => {
  const formattedNumber = validateAndFormatPhone(phoneNumber);
  if (!formattedNumber) return false;
  
  const storedOTP = otpStore.get(formattedNumber);
  return !!(storedOTP && storedOTP.verified);
};

// Helper functions (keep the same)
const validateAndFormatPhone = (phone: string): string | null => {
  if (!phone || phone.length < 10) return null;
  
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.length === 10) {
    return `+91${cleaned}`;
  } else if (cleaned.length === 12 && cleaned.startsWith('91')) {
    return `+${cleaned}`;
  }
  
  return null;
};

// Clean up expired OTPs every hour
setInterval(() => {
  const now = Date.now();
  for (const [phone, data] of otpStore.entries()) {
    if (now > data.expiresAt) {
      otpStore.delete(phone);
    }
  }
}, 60 * 60 * 1000);