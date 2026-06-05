import { Stack, useRouter } from "expo-router";
import React, { Component, ErrorInfo, ReactNode, useEffect } from "react";
import { Text, View, TouchableOpacity } from "react-native";
import { useAuth } from "../../contexts/AuthContext";

// Error boundary to catch home page crashes
class AppErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("APP SCREEN ERROR:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ color: '#ff4444', fontSize: 22, fontWeight: 'bold', marginBottom: 16 }}>
            ⚠️ Screen Error
          </Text>
          <Text style={{ color: '#fff', fontSize: 14, textAlign: 'center', marginBottom: 20 }}>
            {this.state.error?.message || "Something went wrong loading this screen."}
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: '#00ff88', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={{ color: '#000', fontWeight: 'bold' }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

function AppLayoutInner() {
  const { user, loading, isNewUser, showProfileForm } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    // If no authenticated user, always go to phone
    if (!user || !user.uid) {
      router.replace("/(auth)/phone");
      return;
    }

    // If authenticated but needs to complete profile
    if (isNewUser && showProfileForm) {
      router.replace("/(app)/profile");
      return;
    }
  }, [user, loading, isNewUser, showProfileForm]);

  if (loading) {
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="explore" />
      <Stack.Screen name="report/form" />
    </Stack>
  );
}

export default function AppLayout() {
  return (
    <AppErrorBoundary>
      <AppLayoutInner />
    </AppErrorBoundary>
  );
}