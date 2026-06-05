import React from 'react';
import { View, ViewStyle } from 'react-native';

// Safe BlurView replacement
// expo-blur's BlurView causes native crashes on some Android devices.
// This wrapper provides a visually similar dark translucent background
// without any native dependencies.

interface SafeBlurViewProps {
  children?: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  intensity?: number;
  tint?: 'dark' | 'light' | 'default';
  [key: string]: any;
}

export const BlurView = ({ children, style, intensity = 20, tint = 'dark', ...props }: SafeBlurViewProps) => {
  const opacity = Math.min(intensity / 100 + 0.5, 0.95);
  const bgColor = tint === 'light' 
    ? `rgba(255,255,255,${opacity})` 
    : `rgba(10,10,10,${opacity})`;

  return (
    <View style={[style, { backgroundColor: bgColor }]} {...props}>
      {children}
    </View>
  );
};

export default BlurView;
