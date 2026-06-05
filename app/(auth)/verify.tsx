import { Ionicons } from "@expo/vector-icons";
import { BlurView } from '../../components/SafeBlurView';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from '../../contexts/AuthContext';

const { width, height } = Dimensions.get("window");

export default function VerifyScreen() {
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [resendCooldown, setResendCooldown] = useState(0);
  const { verifyingOTP, verifyCode, sendVerificationCode, sendingOTP } = useAuth();
  const inputs = useRef<(TextInput | null)[]>([]);
  const router = useRouter();
  const params = useLocalSearchParams();

  const phoneNumber = params.phoneNumber as string;

  useEffect(() => {
    // Start resend cooldown
    setResendCooldown(60);
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const focusNext = (index: number, value: string) => {
    if (value && index < 5) {
      inputs.current[index + 1]?.focus();
    }
  };

  const focusPrevious = (index: number, key: string) => {
    if (key === 'Backspace' && !code[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handleCodeChange = (text: string, index: number) => {
    const newCode = [...code];
    
    // Only allow numbers
    if (/^\d*$/.test(text)) {
      newCode[index] = text;
      setCode(newCode);
      
      if (text && index < 5) {
        focusNext(index, text);
      }
    }
  };

  const handleVerify = async () => {
    try {
      const verificationCode = code.join('');
      
      if (verificationCode.length !== 6) {
        Alert.alert("Error", "Please enter the 6-digit verification code");
        return;
      }

      console.log("[DEBUG] Starting verification with code:", verificationCode);
      
      let result;
      try {
        result = await verifyCode(phoneNumber, verificationCode);
      } catch (verifyError: any) {
        Alert.alert("CRASH at verifyCode", `${verifyError.message}\n\nStack: ${verifyError.stack?.substring(0, 300)}`);
        return;
      }

      console.log("[DEBUG] verifyCode returned:", JSON.stringify(result));
      
      if (result.success) {
        // Show success confirmation BEFORE navigating
        // This proves the verification logic works
        const destination = result.isNewUser ? '/(app)/profile' : '/(app)';
        Alert.alert(
          "✅ Verification Success", 
          `isNewUser: ${result.isNewUser}\nNavigating to: ${destination}`,
          [{
            text: "Continue",
            onPress: () => {
              try {
                router.replace(destination as any);
              } catch (navError: any) {
                Alert.alert("CRASH at navigation", navError.message);
              }
            }
          }]
        );
      } else {
        Alert.alert("Verification Failed", result.message || "Unknown error");
        setCode(["", "", "", "", "", ""]);
        inputs.current[0]?.focus();
      }
    } catch (outerError: any) {
      Alert.alert("CRASH in handleVerify", `${outerError.message}\n\nStack: ${outerError.stack?.substring(0, 300)}`);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0) return;
    const result = await sendVerificationCode(phoneNumber);
    if (result.success) {
      Alert.alert("Code Resent", "A new verification code has been sent to your phone.");
      setResendCooldown(60);
      setCode(["", "", "", "", "", ""]);
      inputs.current[0]?.focus();
    } else {
      Alert.alert("Error", result.message);
    }
  };

  const isCodeComplete = code.every(digit => digit !== "");

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      
      {/* Background Gradient */}
      <LinearGradient
        colors={['#000000', '#0a3d2e', '#000000']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Decorative Glow Effects */}
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header Section */}
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={24} color="#00ff88" />
            </TouchableOpacity>
            
            <View style={styles.logoContainer}>
              <LinearGradient
                colors={['#00ff88', '#00cc6f']}
                style={styles.logoGradient}
              >
                <Ionicons name="lock-closed" size={32} color="#000" />
              </LinearGradient>
            </View>
            
            <Text style={styles.title}>Verify Phone Number</Text>
            <Text style={styles.subtitle}>
              Enter the 6-digit code sent to{"\n"}
              <Text style={styles.phoneNumber}>{phoneNumber}</Text>
            </Text>
          </View>

          {/* Main Card */}
          <BlurView intensity={20} tint="dark" style={styles.card}>
            <View style={styles.cardBorder} />
            
            <View style={styles.cardContent}>
              <View style={styles.labelContainer}>
                <Ionicons name="key-outline" size={18} color="#00ff88" />
                <Text style={styles.label}>VERIFICATION CODE</Text>
              </View>
              
              {/* OTP Input */}
              <View style={styles.otpContainer}>
                {code.map((digit, index) => (
                  <View key={index} style={styles.otpInputWrapper}>
                    <View style={styles.otpInputGlow} />
                    <TextInput
                      ref={(ref) => {
                        inputs.current[index] = ref;
                      }}
                      style={[
                        styles.otpInput,
                        digit && styles.otpInputFilled
                      ]}
                      value={digit}
                      onChangeText={(text) => handleCodeChange(text, index)}
                      onKeyPress={({ nativeEvent: { key } }) => focusPrevious(index, key)}
                      keyboardType="number-pad"
                      maxLength={1}
                      selectionColor="#00ff88"
                      editable={!verifyingOTP}
                    />
                  </View>
                ))}
              </View>
              


              {/* Verify Button */}
              <TouchableOpacity
                style={[
                  styles.button,
                  (!isCodeComplete || verifyingOTP) && styles.buttonDisabled
                ]}
                onPress={handleVerify}
                disabled={!isCodeComplete || verifyingOTP}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={
                    isCodeComplete && !verifyingOTP
                      ? ['#00ff88', '#00cc6f']
                      : ['#1a1a1a', '#0a0a0a']
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.buttonGradient}
                >
                  <View style={styles.buttonContent}>
                    {verifyingOTP ? (
                      <Text style={styles.buttonText}>Verifying...</Text>
                    ) : (
                      <>
                        <Text style={styles.buttonText}>Verify Code</Text>
                        <Ionicons name="checkmark-circle" size={20} color="#000" />
                      </>
                    )}
                  </View>
                </LinearGradient>
                {isCodeComplete && !verifyingOTP && (
                  <View style={styles.buttonGlow} />
                )}
              </TouchableOpacity>

              {/* Resend Code */}
              <TouchableOpacity
                style={[
                  styles.resendButton,
                  resendCooldown > 0 && styles.resendButtonDisabled
                ]}
                onPress={handleResendCode}
                disabled={resendCooldown > 0 || verifyingOTP}
              >
                <Text style={styles.resendText}>
                  {resendCooldown > 0 
                    ? `Resend code in ${resendCooldown}s` 
                    : "Resend verification code"
                  }
                </Text>
              </TouchableOpacity>
            </View>
          </BlurView>

          {/* Info Card */}
          <BlurView intensity={15} tint="dark" style={styles.infoCard}>
            <View style={styles.infoCardBorder} />
            <View style={styles.infoContent}>
              <Ionicons name="shield-checkmark" size={20} color="#00ff88" />
              <Text style={styles.infoText}>
                <Text style={styles.infoBold}>Security Notice: </Text>
                Never share your verification code with anyone
              </Text>
            </View>
          </BlurView>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  glowTop: {
    position: 'absolute',
    top: -100,
    right: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: '#00ff88',
    opacity: 0.1,
  },
  glowBottom: {
    position: 'absolute',
    bottom: -150,
    left: -100,
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: '#00cc6f',
    opacity: 0.08,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  backButton: {
    position: 'absolute',
    left: 0,
    top: 0,
    padding: 8,
  },
  logoContainer: {
    marginBottom: 24,
  },
  logoGradient: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00ff88',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    lineHeight: 24,
  },
  phoneNumber: {
    color: '#00ff88',
    fontWeight: '600',
  },
  card: {
    borderRadius: 28,
    overflow: 'hidden',
    marginBottom: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  cardBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.2)',
  },
  cardContent: {
    padding: 28,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    justifyContent: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#00ff88',
    letterSpacing: 1.5,
    marginLeft: 8,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  otpInputWrapper: {
    position: 'relative',
    width: 45,
    height: 56,
  },
  otpInputGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12,
    backgroundColor: '#00ff88',
    opacity: 0.05,
  },
  otpInput: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 255, 136, 0.2)',
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '600',
    color: '#ffffff',
  },
  otpInputFilled: {
    borderColor: '#00ff88',
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
  },

  button: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#00ff88',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
    marginBottom: 16,
  },
  buttonDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonGradient: {
    paddingVertical: 18,
    paddingHorizontal: 24,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000000',
    marginHorizontal: 8,
  },
  buttonGlow: {
    position: 'absolute',
    top: -20,
    left: -20,
    right: -20,
    bottom: -20,
    borderRadius: 36,
    backgroundColor: '#00ff88',
    opacity: 0.15,
  },
  resendButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  resendButtonDisabled: {
    opacity: 0.5,
  },
  resendText: {
    fontSize: 14,
    color: '#00ff88',
    fontWeight: '600',
  },
  infoCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 32,
    backgroundColor: 'rgba(0, 255, 136, 0.05)',
  },
  infoCardBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.15)',
  },
  infoContent: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'flex-start',
  },
  infoText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
  infoBold: {
    fontWeight: '700',
    color: '#00ff88',
  },
});