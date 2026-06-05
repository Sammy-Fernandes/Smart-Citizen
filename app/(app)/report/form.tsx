// app/(app)/report/form.tsx - UPDATED VERSION
import { useRouter } from "expo-router";
import React from "react";
import { View } from "react-native";
import ReportForm from "../../../components/ReportForm";

export default function NewReportScreen() {
  const router = useRouter();

  const handleSuccess = (id: string) => {
    console.log('Report submitted successfully with ID:', id);
    // Navigation is handled in the ReportForm component
  };

  return (
    <View style={{ flex: 1 }}>
      <ReportForm onSuccess={handleSuccess} />
    </View>
  );
}