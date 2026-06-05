import { Ionicons } from "@expo/vector-icons";
import { BlurView } from '../../components/SafeBlurView';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from "expo-router";
import React, { useState } from "react";
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

export default function PhoneScreen() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const { sendVerificationCode, sendingOTP } = useAuth();
  const router = useRouter();

  const handleSendCode = async () => {
    if (!phoneNumber || phoneNumber.length !== 10) {
      Alert.alert("Error", "Please enter a valid 10-digit phone number");
      return;
    }

    const formattedNumber = `+91${phoneNumber}`;

    const result = await sendVerificationCode(formattedNumber);

    if (result.success) {
      router.push({
        pathname: "/(auth)/verify",
        params: { phoneNumber: formattedNumber }
      });
    } else {
      Alert.alert("Error", result.message);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      <LinearGradient
        colors={['#000000', '#0a3d2e', '#000000']}
        style={StyleSheet.absoluteFillObject}
      />

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
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <LinearGradient
                colors={['#00ff88', '#00cc6f']}
                style={styles.logoGradient}
              >
                <Ionicons name="shield-checkmark" size={48} color="#000" />
              </LinearGradient>
              <View style={styles.logoGlow} />
            </View>

            <Text style={styles.title}>Welcome to Smart Citizen</Text>
            <Text style={styles.subtitle}>
              Join your community civic engagement platform
            </Text>
          </View>

          <BlurView intensity={20} tint="dark" style={styles.card}>
            <View style={styles.cardBorder} />

            <View style={styles.cardContent}>
              <View style={styles.labelContainer}>
                <Ionicons name="call-outline" size={18} color="#00ff88" />
                <Text style={styles.label}>MOBILE NUMBER</Text>
              </View>

              <View style={styles.inputWrapper}>
                <View style={styles.inputGlow} />
                <View style={styles.inputContainer}>
                  <View style={styles.countryCode}>
                    <Text style={styles.flag}>🇮🇳</Text>
                    <Text style={styles.countryText}>+91</Text>
                  </View>

                  <View style={styles.divider} />

                  <TextInput
                    style={styles.input}
                    placeholder="98765 43210"
                    placeholderTextColor="rgba(255, 255, 255, 0.3)"
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    keyboardType="phone-pad"
                    maxLength={10}
                    selectionColor="#00ff88"
                  />
                </View>
              </View>

              <View style={styles.helperContainer}>
                <Ionicons name="information-circle-outline" size={14} color="#00ff88" />
                <Text style={styles.helperText}>
                  We'll send a 6-digit verification code
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.button,
                  (!phoneNumber || phoneNumber.length < 10) && styles.buttonDisabled
                ]}
                onPress={handleSendCode}
                disabled={!phoneNumber || phoneNumber.length < 10 || sendingOTP}
              >
                <LinearGradient
                  colors={
                    phoneNumber && phoneNumber.length === 10
                      ? ['#00ff88', '#00cc6f']
                      : ['#1a1a1a', '#0a0a0a']
                  }
                  style={styles.buttonGradient}
                >
                  <Text style={styles.buttonText}>
                    {sendingOTP ? "Sending..." : "Send Verification Code"}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </BlurView>

          <Text style={styles.footer}>
            By continuing, you agree to our{" "}
            <Text style={styles.footerLink}>Terms</Text> and{" "}
            <Text style={styles.footerLink}>Privacy Policy</Text>
          </Text>
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
  logoContainer: {
    position: 'relative',
    marginBottom: 24,
  },
  logoGradient: {
    width: 100,
    height: 100,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00ff88',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
  },
  logoGlow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#00ff88',
    opacity: 0.2,
    top: -10,
    left: -10,
  },
  title: {
    fontSize: 32,
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
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#00ff88',
    letterSpacing: 1.5,
    marginLeft: 8,
  },
  inputWrapper: {
    position: 'relative',
    marginBottom: 16,
  },
  inputGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
    backgroundColor: '#00ff88',
    opacity: 0.05,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 255, 136, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  countryCode: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flag: {
    fontSize: 24,
    marginRight: 8,
  },
  countryText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginHorizontal: 16,
  },
  input: {
    flex: 1,
    fontSize: 18,
    fontWeight: '500',
    color: '#ffffff',
    letterSpacing: 1,
  },
  helperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  helperText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
    marginLeft: 6,
  },
  button: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#00ff88',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  buttonDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonGradient: {
    paddingVertical: 18,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000000',
  },
  footer: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.4)',
    textAlign: 'center',
    lineHeight: 18,
  },
  footerLink: {
    color: '#00ff88',
    fontWeight: '600',
  },
});