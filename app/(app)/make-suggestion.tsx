import { Stack, useRouter } from "expo-router";
import React from "react";
import { View } from "react-native";
import SuggestionForm from "../../components/SuggestionForm";

export default function MakeSuggestionScreen() {
  const router = useRouter();

  const handleSuccess = (id: string) => {
    console.log('Suggestion submitted successfully with ID:', id);
  };

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen 
        options={{ 
          title: "New Suggestion",
          headerShown: false
        }} 
      />
      <SuggestionForm onSuccess={handleSuccess} />
    </View>
  );
}
