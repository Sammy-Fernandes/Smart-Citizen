// components/ReportForm.tsx - UPDATED VERSION
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "../components/SafeBlurView";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { uploadMultipleToCloudinary } from "../services/cloudinaryService";
import { Category, Complaint, createComplaint, getCategories } from "../services/databaseService";

type ReportFormProps = {
  onSuccess?: (id: string) => void;
};

export default function ReportForm({ onSuccess }: ReportFormProps) {
  const { user, userData } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState<{ latitude?: number; longitude?: number }>({});
  const [images, setImages] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [locLoading, setLocLoading] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    const loadCategories = async () => {
      setLoadingCategories(true);
      try {
        const cats = await getCategories('complaint');
        setCategories(cats);
        if (!category && cats.length) setCategory(cats[0].name);
      } catch (e) {
        console.warn('Failed to load categories', e);
        Alert.alert('Error', 'Failed to load categories. Please try again.');
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

  const pickImages = async () => {
    try {
      console.log('Requesting gallery permissions...');
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Gallery permission is required to select photos',
          [{ text: 'OK' }]
        );
        return;
      }

      console.log('Launching image library...');
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.7,
        selectionLimit: 3 - images.length, // Max 3 images total
      });

      console.log('Image picker result:', res);
      if (!res.canceled && res.assets) {
        const uris = res.assets.map(a => a.uri);
        setImages(prev => [...prev, ...uris].slice(0, 3)); // Limit to 3 images
        console.log('Images selected:', uris.length);
      }
    } catch (error) {
      console.error('Error picking images:', error);
      Alert.alert('Error', 'Failed to pick images. Please try again.');
    }
  };

  const takePhoto = async () => {
    try {
      console.log('Requesting camera permissions...');
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Camera permission is required to take photos',
          [{ text: 'OK' }]
        );
        return;
      }

      console.log('Launching camera...');
      const res = await ImagePicker.launchCameraAsync({
        quality: 0.7,
        allowsEditing: true,
      });

      console.log('Camera result:', res);
      if (!res.canceled && res.assets?.[0]?.uri) {
        setImages(prev => [...prev, res.assets[0].uri].slice(0, 3)); // Limit to 3 images
        console.log('Photo taken successfully');
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const useLiveLocation = async () => {
    try {
      setLocLoading(true);
      console.log('Requesting location permissions...');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Location permission is required to use your current location',
          [{ text: 'OK' }]
        );
        setLocLoading(false);
        return;
      }

      console.log('Getting current position...');
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });

      console.log('Location obtained:', pos.coords);
      setCoords({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude
      });

      console.log('Reverse geocoding...');
      const rev = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude
      });

      const first = rev[0];
      const addr = [first?.name, first?.street, first?.city, first?.region, first?.postalCode]
        .filter(Boolean)
        .join(', ');
      setAddress(addr);
      console.log('Address resolved:', addr);

    } catch (e) {
      console.error('Live location error:', e);
      Alert.alert(
        'Location Error',
        'Failed to get your location. Please check your GPS settings or enter address manually.'
      );
    } finally {
      setLocLoading(false);
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!user || userData?.profileComplete !== true) {
      Alert.alert(
        'Profile Required',
        'Please complete your profile before submitting reports',
        [{ text: 'OK' }]
      );
      return;
    }

    if (!validateForm()) {
      Alert.alert(
        'Missing Information',
        'Please fill in all required fields correctly',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      setSaving(true);
      setUploadingImages(true);
      console.log('Starting report submission process...');

      // Upload images to Cloudinary
      let cloudinaryUrls: string[] = [];
      if (images.length > 0) {
        console.log('Uploading images to Cloudinary...');
        cloudinaryUrls = await uploadMultipleToCloudinary(images);
        console.log('Images uploaded to Cloudinary:', cloudinaryUrls);
      }

      setUploadingImages(false);

      // Create complaint data with Cloudinary URLs
      const complaint: Omit<Complaint, 'id' | 'createdAt' | 'updatedAt'> = {
        title: title.trim(),
        description: description.trim(),
        category,
        status: 'pending',
        priority: 'medium',
        location: {
          address: address.trim(),
          latitude: coords.latitude,
          longitude: coords.longitude
        },
        imageUrls: cloudinaryUrls, // Use Cloudinary URLs instead of local URIs
        userId: user.uid,
        userName: userData?.profile?.displayName || 'User',
        userPhone: user.phoneNumber || '',
        state: userData?.profile?.state || '',
        district: userData?.profile?.district || '',
        upvotes: 0,
        upvotedBy: [],
      };

      console.log('Complaint data prepared:', {
        title: complaint.title,
        category: complaint.category,
        hasLocation: !!complaint.location?.latitude,
        imageCount: complaint.imageUrls.length,
        cloudinaryUrls: complaint.imageUrls
      });

      const id = await createComplaint(complaint);

      setSaving(false);
      setUploadingImages(false);

      console.log('Complaint saved successfully. Showing success alert.');

      Alert.alert(
        'Success!',
        'Your report has been submitted successfully and is now visible to the community.',
        [{
          text: 'OK',
          onPress: () => {
            console.log('User clicked OK. Navigating to home.');
            onSuccess?.(id);
            // Use router.replace to ensure we're on the main app screen
            router.replace('/(app)');
          }
        }],
        { cancelable: false }
      );

      // Reset form fields
      setTitle('');
      setDescription('');
      setImages([]);
      setAddress('');
      setCoords({});
      setErrors({});
      if (categories.length > 0) {
        setCategory(categories[0].name);
      }

    } catch (error: any) {
      console.error('Save complaint error:', error);
      setUploadingImages(false);
      Alert.alert(
        'Submission Failed',
        error.message || 'Failed to submit report. Please check your connection and try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={['#000000', '#0a3d2e', '#000000']}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.iconContainer}>
              <LinearGradient
                colors={['#00ff88', '#00cc6f']}
                style={styles.iconGradient}
              >
                <Ionicons name="document-text" size={28} color="#000" />
              </LinearGradient>
              <View style={styles.iconGlow} />
            </View>
            <View>
              <Text style={styles.title}>Report an Issue</Text>
              <Text style={styles.subtitle}>Help improve your community</Text>
            </View>
          </View>
        </View>

        {/* Form Card */}
        <BlurView intensity={20} tint="dark" style={styles.card}>
          <View style={styles.cardBorder} />
          <View style={styles.cardContent}>

            {/* Title Input */}
            <View style={styles.inputGroup}>
              <View style={styles.labelContainer}>
                <Ionicons name="pencil" size={16} color="#00ff88" />
                <Text style={styles.label}>TITLE *</Text>
              </View>
              <View style={styles.inputWrapper}>
                <View style={styles.inputGlow} />
                <TextInput
                  value={title}
                  onChangeText={(text) => {
                    setTitle(text);
                    if (errors.title) setErrors(prev => ({ ...prev, title: '' }));
                  }}
                  placeholder="Brief title of the issue"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  style={[styles.input, errors.title && styles.inputError]}
                  selectionColor="#00ff88"
                  maxLength={100}
                />
              </View>
              {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}
            </View>

            {/* Description Input */}
            <View style={styles.inputGroup}>
              <View style={styles.labelContainer}>
                <Ionicons name="document-text-outline" size={16} color="#00ff88" />
                <Text style={styles.label}>DESCRIPTION *</Text>
              </View>
              <View style={styles.inputWrapper}>
                <View style={styles.inputGlow} />
                <TextInput
                  value={description}
                  onChangeText={(text) => {
                    setDescription(text);
                    if (errors.description) setErrors(prev => ({ ...prev, description: '' }));
                  }}
                  placeholder="Describe the issue in detail..."
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  style={[styles.input, styles.textArea, errors.description && styles.inputError]}
                  multiline
                  textAlignVertical="top"
                  selectionColor="#00ff88"
                  maxLength={500}
                />
              </View>
              {errors.description && <Text style={styles.errorText}>{errors.description}</Text>}
            </View>

            {/* Category Selection */}
            <View style={styles.inputGroup}>
              <View style={styles.labelContainer}>
                <Ionicons name="pricetag" size={16} color="#00ff88" />
                <Text style={styles.label}>CATEGORY *</Text>
              </View>
              {loadingCategories ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator color="#00ff88" />
                  <Text style={styles.loadingText}>Loading categories...</Text>
                </View>
              ) : categories.length > 0 ? (
                <View style={styles.chipsContainer}>
                  {categories.map((cat) => (
                    <TouchableOpacity
                      key={cat.id}
                      onPress={() => {
                        setCategory(cat.name);
                        if (errors.category) setErrors(prev => ({ ...prev, category: '' }));
                      }}
                      style={[styles.chip, category === cat.name && styles.chipActive]}
                    >
                      <View style={[styles.chipDot, category === cat.name && styles.chipDotActive]} />
                      <Text style={[styles.chipText, category === cat.name && styles.chipTextActive]}>
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <Text style={styles.errorText}>No categories available. Please try again later.</Text>
              )}
              {errors.category && <Text style={styles.errorText}>{errors.category}</Text>}
            </View>

            {/* Location Section */}
            <View style={styles.inputGroup}>
              <View style={styles.labelContainer}>
                <Ionicons name="location" size={16} color="#00ff88" />
                <Text style={styles.label}>LOCATION</Text>
              </View>

              <TouchableOpacity
                onPress={useLiveLocation}
                style={styles.locationButton}
                disabled={locLoading}
              >
                <LinearGradient
                  colors={locLoading ? ["#1a1a1a", "#0a0a0a"] : ["#00ff88", "#00cc6f"]}
                  style={styles.locationButtonGradient}
                >
                  {locLoading ? (
                    <>
                      <ActivityIndicator size="small" color="#00ff88" />
                      <Text style={[styles.locationButtonText, locLoading && { color: '#00ff88' }]}>
                        Getting location...
                      </Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="navigate" size={18} color="#000" />
                      <Text style={styles.locationButtonText}>Use Current Location</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <View style={styles.inputWrapper}>
                <View style={styles.inputGlow} />
                <TextInput
                  value={address}
                  onChangeText={setAddress}
                  placeholder="Or enter address manually"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  style={styles.input}
                  selectionColor="#00ff88"
                />
              </View>

              {(coords.latitude && coords.longitude) && (
                <View style={styles.coordsContainer}>
                  <Ionicons name="pin" size={12} color="#00ff88" />
                  <Text style={styles.coordText}>
                    {coords.latitude?.toFixed(6)}, {coords.longitude?.toFixed(6)}
                  </Text>
                </View>
              )}
            </View>

            {/* Photos Section */}
            <View style={styles.inputGroup}>
              <View style={styles.labelContainer}>
                <Ionicons name="image" size={16} color="#00ff88" />
                <Text style={styles.label}>PHOTOS ({images.length}/3)</Text>
                {images.length > 0 && (
                  <View style={styles.photoCount}>
                    <Text style={styles.photoCountText}>{images.length}</Text>
                  </View>
                )}
              </View>

              <Text style={styles.photoHint}>
                Add up to 3 photos to help describe the issue
              </Text>

              <View style={styles.photoButtons}>
                <TouchableOpacity onPress={pickImages} style={styles.photoButton} disabled={images.length >= 3}>
                  <LinearGradient
                    colors={images.length >= 3 ? ["#1a1a1a", "#0a0a0a"] : ["rgba(0,255,136,0.2)", "rgba(0,204,111,0.15)"]}
                    style={styles.photoButtonGradient}
                  >
                    <Ionicons name="images" size={20} color={images.length >= 3 ? "#666" : "#00ff88"} />
                    <Text style={[styles.photoButtonText, images.length >= 3 && { color: '#666' }]}>
                      Gallery
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity onPress={takePhoto} style={styles.photoButton} disabled={images.length >= 3}>
                  <LinearGradient
                    colors={images.length >= 3 ? ["#1a1a1a", "#0a0a0a"] : ["rgba(0,255,136,0.2)", "rgba(0,204,111,0.15)"]}
                    style={styles.photoButtonGradient}
                  >
                    <Ionicons name="camera" size={20} color={images.length >= 3 ? "#666" : "#00ff88"} />
                    <Text style={[styles.photoButtonText, images.length >= 3 && { color: '#666' }]}>
                      Camera
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              {images.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.imageScroll}
                  contentContainerStyle={styles.imageScrollContent}
                >
                  {images.map((uri, idx) => (
                    <View key={idx} style={styles.imageContainer}>
                      <Image source={{ uri }} style={styles.image} />
                      <TouchableOpacity
                        style={styles.imageRemove}
                        onPress={() => removeImage(idx)}
                      >
                        <LinearGradient colors={["#ff4444", "#cc0000"]} style={styles.imageRemoveGradient}>
                          <Ionicons name="close" size={14} color="#fff" />
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving || uploadingImages}
              style={[styles.submitButton, (saving || uploadingImages) && styles.submitButtonDisabled]}
            >
              <LinearGradient
                colors={(saving || uploadingImages) ? ["#1a1a1a", "#0a0a0a"] : ["#00ff88", "#00cc6f"]}
                style={styles.submitButtonGradient}
              >
                {saving || uploadingImages ? (
                  <>
                    <ActivityIndicator color="#00ff88" size="small" />
                    <Text style={[styles.submitButtonText, { color: '#00ff88' }]}>
                      {uploadingImages ? 'Uploading Images...' : 'Submitting...'}
                    </Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={22} color="#000" />
                    <Text style={styles.submitButtonText}>Submit Report</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

          </View>
        </BlurView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000'
  },
  container: {
    padding: 16,
    paddingTop: 60,
    paddingBottom: 40,
  },
  glowTop: {
    position: 'absolute',
    top: -100,
    left: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: '#00ff88',
    opacity: 0.1,
  },
  glowBottom: {
    position: 'absolute',
    bottom: -150,
    right: -100,
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: '#00cc6f',
    opacity: 0.08,
  },
  header: {
    marginBottom: 24,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconContainer: {
    position: 'relative',
  },
  iconGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlow: {
    position: 'absolute',
    top: -6,
    left: -6,
    right: -6,
    bottom: -6,
    borderRadius: 34,
    backgroundColor: '#00ff88',
    opacity: 0.3,
    zIndex: -1,
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    marginTop: 2,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.15)',
    overflow: 'hidden',
  },
  cardBorder: {
    position: 'absolute',
    inset: 0,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardContent: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 24,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#00ff88',
    letterSpacing: 1,
  },
  inputWrapper: {
    position: 'relative',
  },
  inputGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#00ff88',
    opacity: 0.05,
    borderRadius: 12,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#fff',
    fontSize: 15,
  },
  inputError: {
    borderColor: '#ff4444',
    borderWidth: 1,
  },
  textArea: {
    height: 120,
    paddingTop: 14,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 12,
    marginTop: 6,
    marginLeft: 4,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  chipActive: {
    backgroundColor: 'rgba(0,255,136,0.15)',
    borderColor: '#00ff88',
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  chipDotActive: {
    backgroundColor: '#00ff88',
  },
  chipText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#00ff88',
    fontWeight: '700',
  },
  locationButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  locationButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
  },
  locationButtonText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 15,
  },
  coordsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,255,136,0.1)',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  coordText: {
    color: '#00ff88',
    fontSize: 12,
    fontWeight: '600',
  },
  photoCount: {
    backgroundColor: '#00ff88',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  photoCountText: {
    color: '#000',
    fontSize: 11,
    fontWeight: '700',
  },
  photoHint: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  photoButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  photoButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,255,136,0.3)',
  },
  photoButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  photoButtonText: {
    color: '#00ff88',
    fontWeight: '700',
    fontSize: 14,
  },
  imageScroll: {
    marginTop: 12,
  },
  imageScrollContent: {
    gap: 12,
  },
  imageContainer: {
    position: 'relative',
  },
  image: {
    width: 100,
    height: 100,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(0,255,136,0.3)',
  },
  imageRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    borderRadius: 12,
    overflow: 'hidden',
  },
  imageRemoveGradient: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
  },
  submitButtonText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 16,
  },
});