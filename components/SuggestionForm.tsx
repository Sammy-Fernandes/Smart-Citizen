import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "../components/SafeBlurView";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { Category, createSuggestion, getCategories } from "../services/databaseService";

type SuggestionFormProps = {
  onSuccess?: (id: string) => void;
};

export default function SuggestionForm({ onSuccess }: SuggestionFormProps) {
  const { user, userData } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState<{ latitude?: number; longitude?: number }>({});
  const [saving, setSaving] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [locLoading, setLocLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    const loadCategories = async () => {
      setLoadingCategories(true);
      try {
        const cats = await getCategories('suggestion');
        setCategories(cats);
        if (!category && cats.length) setCategory(cats[0].name);
      } catch (e) {
        console.warn('Failed to load categories', e);
      } finally {
        setLoadingCategories(false);
      }
    };
    loadCategories();
  }, []);

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!title.trim()) {
      newErrors.title = 'Title is required';
    } else if (title.trim().length < 5) {
      newErrors.title = 'Title must be at least 5 characters';
    }

    if (!description.trim()) {
      newErrors.description = 'Description is required';
    } else if (description.trim().length < 10) {
      newErrors.description = 'Description must be at least 10 characters';
    }

    if (!category) {
      newErrors.category = 'Please select a category';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const useLiveLocation = async () => {
    try {
      setLocLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Location permission is required.');
        setLocLoading(false);
        return;
      }

      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });

      const rev = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude
      });

      const first = rev[0];
      const addr = [first?.name, first?.street, first?.city, first?.region]
        .filter(Boolean)
        .join(', ');
      setAddress(addr);

    } catch (e) {
      console.error('Location error:', e);
      Alert.alert('Error', 'Failed to get location.');
    } finally {
      setLocLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user || userData?.profileComplete !== true) {
      Alert.alert('Profile Required', 'Please complete your profile first.');
      return;
    }

    if (!validateForm()) return;

    try {
      setSaving(true);
      const suggestion: any = {
        title: title.trim(),
        description: description.trim(),
        category,
        location: {
          address: address.trim(),
          latitude: coords.latitude,
          longitude: coords.longitude
        },
        userId: user.uid,
        userName: userData?.profile?.displayName || 'User',
        userPhone: user.phoneNumber || '',
        upvotes: 0,
        upvotedBy: [],
        implemented: false,
      };

      const id = await createSuggestion(suggestion);
      
      Alert.alert(
        'Success!',
        'Your suggestion has been submitted successfully.',
        [{
          text: 'OK',
          onPress: () => {
            onSuccess?.(id);
            router.replace('/(app)');
          }
        }]
      );

    } catch (error: any) {
      Alert.alert('Failed', error.message || 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <LinearGradient colors={['#000000', '#0a3d2e', '#000000']} style={StyleSheet.absoluteFillObject} />
      
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <LinearGradient colors={['#00ff88', '#00cc6f']} style={styles.iconGradient}>
              <Ionicons name="bulb" size={28} color="#000" />
            </LinearGradient>
          </View>
          <View>
            <Text style={styles.title}>Make a Suggestion</Text>
            <Text style={styles.subtitle}>Help improve your community</Text>
          </View>
        </View>

        <BlurView intensity={20} tint="dark" style={styles.card}>
          <View style={styles.cardContent}>
            
            {/* Title */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>TITLE *</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="What is your idea?"
                placeholderTextColor="rgba(255,255,255,0.3)"
                style={[styles.input, errors.title && styles.inputError]}
              />
              {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}
            </View>

            {/* Description */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>DESCRIPTION *</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Explain your suggestion in detail..."
                placeholderTextColor="rgba(255,255,255,0.3)"
                style={[styles.input, styles.textArea, errors.description && styles.inputError]}
                multiline
              />
              {errors.description && <Text style={styles.errorText}>{errors.description}</Text>}
            </View>

            {/* Category */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>CATEGORY *</Text>
              {loadingCategories ? (
                <ActivityIndicator color="#00ff88" />
              ) : (
                <View style={styles.chipsContainer}>
                  {categories.map((cat) => (
                    <TouchableOpacity
                      key={cat.id}
                      onPress={() => setCategory(cat.name)}
                      style={[styles.chip, category === cat.name && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, category === cat.name && styles.chipTextActive]}>
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Location */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>LOCATION (OPTIONAL)</Text>
              <TouchableOpacity onPress={useLiveLocation} style={styles.locationButton} disabled={locLoading}>
                <LinearGradient colors={["#00ff88", "#00cc6f"]} style={styles.locationButtonGradient}>
                  {locLoading ? <ActivityIndicator size="small" color="#000" /> : <Text style={styles.locationButtonText}>Detect Location</Text>}
                </LinearGradient>
              </TouchableOpacity>
              <TextInput
                value={address}
                onChangeText={setAddress}
                placeholder="Area or Address"
                placeholderTextColor="rgba(255,255,255,0.3)"
                style={styles.input}
              />
            </View>

            {/* Submit */}
            <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.submitButton}>
              <LinearGradient colors={["#00ff88", "#00cc6f"]} style={styles.submitButtonGradient}>
                {saving ? <ActivityIndicator color="#000" /> : <Text style={styles.submitButtonText}>Submit Suggestion</Text>}
              </LinearGradient>
            </TouchableOpacity>

          </View>
        </BlurView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  container: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 24 },
  iconContainer: { borderRadius: 28 },
  iconGradient: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 24, fontWeight: '700' },
  subtitle: { color: 'rgba(255,255,255,0.6)', fontSize: 14 },
  card: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  cardContent: { padding: 20 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 12, fontWeight: '700', color: '#00ff88', marginBottom: 8, letterSpacing: 1 },
  input: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 14, color: '#fff', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  inputError: { borderColor: '#ff4444' },
  textArea: { height: 100, textAlignVertical: 'top' },
  errorText: { color: '#ff4444', fontSize: 11, marginTop: 4 },
  chipsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  chipActive: { backgroundColor: 'rgba(0,255,136,0.15)', borderColor: '#00ff88' },
  chipText: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
  chipTextActive: { color: '#00ff88', fontWeight: '700' },
  locationButton: { borderRadius: 12, overflow: 'hidden', marginBottom: 10 },
  locationButtonGradient: { paddingVertical: 12, alignItems: 'center' },
  locationButtonText: { color: '#000', fontWeight: '700' },
  submitButton: { borderRadius: 12, overflow: 'hidden', marginTop: 10 },
  submitButtonGradient: { paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10 },
  submitButtonText: { color: '#000', fontWeight: '800', fontSize: 16 },
});
