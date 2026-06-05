import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, Text, View, Alert } from "react-native";
import { AuthProvider, useAuth } from "../contexts/AuthContext";
import React, { Component, ErrorInfo, ReactNode } from "react";

// GLOBAL ERROR BOUNDARY - THE "UNCRASHABLE" LAYER
class GlobalErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("CRITICAL APP ERROR:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#800', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>🛑 Critical Error Caught</Text>
          <Text style={{ color: '#fff', fontSize: 16, textAlign: 'center' }}>
            {this.state.error?.message || "An unknown error occurred during app startup."}
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.6)', marginTop: 20, fontSize: 12 }}>
            Please screenshot this screen and share with the developer.
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

function RootLayoutNav() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000000' }}>
        <ActivityIndicator size="large" color="#00ff88" />
        <Text style={{ marginTop: 16, color: '#ffffff' }}>Launching Smart Citizen...</Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GlobalErrorBoundary>
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </GlobalErrorBoundary>
  );
}