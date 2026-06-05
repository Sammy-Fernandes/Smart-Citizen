// @ts-nocheck
// services/twilioService.ts
import twilio from 'twilio';

// Twilio credentials (get from https://www.twilio.com/console)
const TWILIO_ACCOUNT_SID = process.env.EXPO_PUBLIC_TWILIO_ACCOUNT_SID || 'your_account_sid';
const TWILIO_AUTH_TOKEN = process.env.EXPO_PUBLIC_TWILIO_AUTH_TOKEN || 'your_auth_token';
const TWILIO_PHONE_NUMBER = process.env.EXPO_PUBLIC_TWILIO_PHONE_NUMBER || '+1234567890';

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

// Store OTPs temporarily (in production, use Redis)
const otpStore = new Map<string, { code: string; expiresAt: number; verified: boolean }>();

// Generate 6-digit OTP
const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP via SMS
export const sendOTP = async (phoneNumber: string): Promise<{ success: boolean; message: string }> => {
  try {
    // Validate phone number
    if (!phoneNumber || phoneNumber.length < 10) {
      return { success: false, message: 'Invalid phone number' };
    }

    // Format phone number with country code
    const formattedNumber = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes expiry

    // Store OTP
    otpStore.set(formattedNumber, {
      code: otp,
      expiresAt,
      verified: false
    });

    // Send SMS via Twilio
    const message = await client.messages.create({
      body: `Your Smart Citizen verification code is: ${otp}. This code expires in 10 minutes.`,
      from: TWILIO_PHONE_NUMBER,
      to: formattedNumber
    });

    console.log(`✅ OTP sent to ${formattedNumber}: ${otp}`);
    console.log(`📱 Twilio Message SID: ${message.sid}`);

    return {
      success: true,
      message: 'Verification code sent successfully'
    };

  } catch (error: any) {
    console.error('❌ Twilio Error:', error);

    // Handle specific Twilio errors
    if (error.code === 21211) {
      return { success: false, message: 'Invalid phone number format' };
    } else if (error.code === 21408) {
      return { success: false, message: 'Phone number not authorized' };
    } else if (error.code === 21610) {
      return { success: false, message: 'Phone number is unverified. Please verify in Twilio console.' };
    } else if (error.code === 30007) {
      return { success: false, message: 'Message delivery failed. Phone may be unreachable.' };
    } else {
      return { success: false, message: 'Failed to send verification code. Please try again.' };
    }
  }
};

// Verify OTP
export const verifyOTP = (phoneNumber: string, code: string): { success: boolean; message: string } => {
  try {
    const formattedNumber = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;
    const storedOTP = otpStore.get(formattedNumber);

    if (!storedOTP) {
      return { success: false, message: 'No OTP found for this number. Please request a new code.' };
    }

    if (Date.now() > storedOTP.expiresAt) {
      otpStore.delete(formattedNumber);
      return { success: false, message: 'OTP has expired. Please request a new code.' };
    }

    if (storedOTP.code !== code) {
      return { success: false, message: 'Invalid verification code. Please try again.' };
    }

    // Mark as verified
    storedOTP.verified = true;
    otpStore.set(formattedNumber, storedOTP);

    console.log(`✅ OTP verified for ${formattedNumber}`);
    return { success: true, message: 'Phone number verified successfully' };

  } catch (error) {
    console.error('❌ OTP Verification Error:', error);
    return { success: false, message: 'Verification failed. Please try again.' };
  }
};

// Check if OTP is verified
export const isOTPVerified = (phoneNumber: string): boolean => {
  const formattedNumber = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;
  const storedOTP = otpStore.get(formattedNumber);
  return !!(storedOTP && storedOTP.verified);
};

// Clean up expired OTPs
export const cleanupExpiredOTPs = (): void => {
  const now = Date.now();
  for (const [phone, data] of otpStore.entries()) {
    if (now > data.expiresAt) {
      otpStore.delete(phone);
    }
  }
};

// Run cleanup every hour
setInterval(cleanupExpiredOTPs, 60 * 60 * 1000);