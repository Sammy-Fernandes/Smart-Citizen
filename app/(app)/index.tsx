import { Ionicons } from "@expo/vector-icons";
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import MapView, { Marker, Circle, Heatmap, PROVIDER_GOOGLE } from 'react-native-maps';
import { FreeMap } from "../../components/FreeMap";
import { useAuth } from "../../contexts/AuthContext";
import {
  Complaint,
  Suggestion,
  addUpvote,
  getAllComplaints,
  getBroadcasts
} from "../../services/databaseService";

// Heatmap Intensity Map
const getHeatmapIntensity = (upvotes: number) => {
  if (upvotes >= 6) return { radius: 60, color: 'rgba(0, 255, 136, 0.6)' };
  if (upvotes >= 3) return { radius: 45, color: 'rgba(0, 255, 136, 0.4)' };
  return { radius: 30, color: 'rgba(0, 255, 136, 0.2)' };
};

const categories = [
  { id: "all", name: "All Issues", icon: "grid" },
  { id: "Infrastructure", name: "Infrastructure", icon: "construct" },
  { id: "Public Safety", name: "Public Safety", icon: "shield" },
  { id: "Sanitation", name: "Sanitation", icon: "trash" },
  { id: "Water", name: "Water", icon: "water" },
];

const getCategoryColor = (category: string) => {
  switch (category) {
    case 'Infrastructure': return '#00ff88';
    case 'Public Safety': return '#ff4444';
    case 'Sanitation': return '#ffa500';
    case 'Water': return '#4488ff';
    default: return '#888888';
  }
};

// Safe BlurView replacement - expo-blur crashes on some Android devices
const BlurView = ({ children, style, intensity, tint, ...props }: any) => (
  <View style={[style, { backgroundColor: 'rgba(10,10,10,0.85)' }]} {...props}>{children}</View>
);

const { width, height } = Dimensions.get("window");

interface StatCardProps {
  title: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  delay: number;
  gradient: [string, string];
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, delay, gradient }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.statCard,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <BlurView intensity={20} tint="dark" style={styles.statCardBlur}>
        <View style={styles.statCardBorder} />
        <View style={styles.statCardContent}>
          <LinearGradient
            colors={gradient}
            style={styles.statIconContainer}
          >
            <Ionicons name={icon} size={20} color="#000" />
          </LinearGradient>
          <Text style={styles.statValue}>{value}</Text>
          <Text style={styles.statTitle}>{title}</Text>
        </View>
      </BlurView>
    </Animated.View>
  );
};

const ComplaintStatus: React.FC<{ status: string }> = ({ status }) => {
  const getStatusColor = () => {
    switch (status) {
      case 'resolved': return '#00ff88';
      case 'in-progress': return '#ffa500';
      default: return '#ff4444';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'resolved': return 'Resolved';
      case 'in-progress': return 'In Progress';
      default: return 'Pending';
    }
  };

  return (
    <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor()}20` }]}>
      <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
      <Text style={[styles.statusText, { color: getStatusColor() }]}>
        {getStatusText()}
      </Text>
    </View>
  );
};

// Heatmap Legend Component
const HeatmapLegend: React.FC = () => {
  return (
    <View style={styles.legendContainer}>
      <Text style={styles.legendTitle}>Heatmap Intensity</Text>
      <View style={styles.legendItems}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: 'rgba(0,255,136,0.2)' }]} />
          <Text style={styles.legendText}>1-2 Upvotes</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: 'rgba(0,255,136,0.4)' }]} />
          <Text style={styles.legendText}>3-5 Upvotes</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: 'rgba(0,255,136,0.6)' }]} />
          <Text style={styles.legendText}>6+ Upvotes</Text>
        </View>
      </View>
    </View>
  );
};

export default function HomeScreen() {
  const { user, profile, logout, userData, loading: authLoading } = useAuth();
  const router = useRouter();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [allComplaints, setAllComplaints] = useState<Complaint[]>([]);
  const [broadcasts, setBroadcasts] = useState<any[]>([]); 
  const [dataLoading, setDataLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [districtFilter, setDistrictFilter] = useState<string | "all">("all");
  const [locLoading, setLocLoading] = useState(false);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [mapsUnavailable, setMapsUnavailable] = useState(false);
  const [upvoting, setUpvoting] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;
  const [currentBroadcastIndex, setCurrentBroadcastIndex] = useState(0);

  // fetchUserData placeholder since it's used in refresh
  const fetchUserData = async () => {
    // Auth context handles this, but we define it to fix reference error
    console.log("Refreshing user data...");
  };

  const loadCommunityReports = async () => {
    try {
      console.log("[DEBUG] Fetching community reports...");
      const [items, news] = await Promise.all([
        getAllComplaints(100),
        getBroadcasts()
      ]);
      console.log(`[DEBUG] Fetched ${items.length} complaints and ${news.length} broadcasts`);
      
      const withLoc = items.filter(c => c.location?.latitude && c.location?.longitude);
      console.log(`[DEBUG] Complaints with location data: ${withLoc.length}`);
      
      setAllComplaints(items);
      setBroadcasts(news);
    } catch (e) {
      console.warn('[DEBUG] Error loading community data:', e);
    }
  };

  // Get current location - FIXED VERSION
  const getCurrentLocation = async () => {
    try {
      setLocLoading(true);
      console.log('Requesting location permissions...');

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Location permission denied');
        setLocLoading(false);
        return;
      }

      console.log('Getting current position...');
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = position.coords;
      console.log('Location obtained:', { latitude, longitude });

      setCoords({ latitude, longitude });

    } catch (error) {
      console.warn('Error getting location:', error);
      // Fallback to default coordinates (India center)
      setCoords({ latitude: 20.5937, longitude: 78.9629 });
    } finally {
      setLocLoading(false);
    }
  };

  // Filter complaints by category and district
  const filteredComplaints = allComplaints.filter(complaint => {
    const categoryMatch = selectedCategory === 'all' || complaint.category === selectedCategory;

    // Check explicit district field first, fallback to address parsing for old data
    let complaintDistrict = complaint.district;
    if (!complaintDistrict && complaint.location?.address) {
      // Try to extract district from address for backward compatibility
      const addressParts = complaint.location.address.split(',').map(s => s.trim());
      // Usually district is one of the address parts
      complaintDistrict = addressParts.find(part =>
        districtFilter !== 'all' && part.toLowerCase().includes(districtFilter.toLowerCase())
      ) ? districtFilter : '';
    }

    const districtMatch = districtFilter === 'all' || complaintDistrict === districtFilter;

    // Debug logging
    if (districtFilter !== 'all') {
      console.log(`Filtering: District="${districtFilter}", Complaint District="${complaintDistrict}", Address="${complaint.location?.address}", Match=${districtMatch}`);
    }

    return categoryMatch && districtMatch;
  });

  // Get complaints with valid coordinates for heatmap
  const complaintsWithLocation = filteredComplaints.filter(
    complaint => complaint.location?.latitude && complaint.location?.longitude
  );

  // Set default district filter when profile loads
  useEffect(() => {
    if (profile?.district) {
      setDistrictFilter(profile.district);
    }
  }, [profile]);

  useEffect(() => {
    const init = async () => {
      if (!user) return;
      try {
        await Promise.all([
          getCurrentLocation(),
          loadCommunityReports()
        ]);
      } catch (e) {
        console.warn("Init error", e);
      } finally {
        setDataLoading(false);
      }
    };
    init();
  }, [user]);

  // Auto-slide broadcast carousel every 10 seconds (max 5 items)
  useEffect(() => {
    const maxItems = Math.min(broadcasts.length, 5);
    if (maxItems <= 1) return;
    const interval = setInterval(() => {
      setCurrentBroadcastIndex((prev) => (prev + 1) % maxItems);
    }, 10000);
    return () => clearInterval(interval);
  }, [broadcasts.length]);

  const handleRefresh = async () => {
    if (!user) return;

    setRefreshing(true);
    try {
      await Promise.all([fetchUserData(), loadCommunityReports()]);
    } catch (error) {
      console.warn("Error refreshing data:", error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout",
          onPress: async () => {
            try {
              await logout();
              router.replace("/(auth)/phone");
            } catch (error) {
              console.warn("Logout error:", error);
            }
          },
          style: "destructive"
        }
      ]
    );
  };

  const handleCreateComplaint = async () => {
    if (!user || userData?.profileComplete !== true) {
      Alert.alert("Complete Profile", "Please complete your profile first to report issues");
      return;
    }

    try {
      router.push("/(app)/report/form");
    } catch (error) {
      console.warn("Error creating complaint:", error);
      Alert.alert("Error", "Failed to create complaint");
    }
  };

  const handleCreateSuggestion = async () => {
    if (!user || userData?.profileComplete !== true) {
      Alert.alert("Complete Profile", "Please complete your profile first to make suggestions");
      return;
    }

    try {
      router.push("/(app)/make-suggestion");
    } catch (error) {
      console.warn("Error navigating to suggestion page:", error);
      Alert.alert("Error", "Failed to open suggestion page");
    }
  };

  const handleUpvoteComplaint = async (complaintId: string) => {
    if (!user) return;

    setUpvoting(complaintId);
    try {
      await addUpvote(user.uid, complaintId, 'complaint');

      setComplaints(prev => prev.map(complaint =>
        complaint.id === complaintId
          ? { ...complaint, upvotes: complaint.upvotes + 1 }
          : complaint
      ));
      setAllComplaints(prev => prev.map(complaint =>
        complaint.id === complaintId
          ? { ...complaint, upvotes: complaint.upvotes + 1 }
          : complaint
      ));
    } catch (error: any) {
      if (error.message === 'Already upvoted') {
        Alert.alert("Already Upvoted", "You have already upvoted this complaint");
      } else {
        console.warn("Error upvoting complaint:", error);
        Alert.alert("Error", "Failed to upvote complaint");
      }
    } finally {
      setUpvoting(null);
    }
  };

  const handleUpvoteSuggestion = async (suggestionId: string) => {
    if (!user) return;

    setUpvoting(suggestionId);
    try {
      await addUpvote(user.uid, suggestionId, 'suggestion');

      setSuggestions(prev => prev.map(suggestion =>
        suggestion.id === suggestionId
          ? { ...suggestion, upvotes: suggestion.upvotes + 1 }
          : suggestion
      ));
    } catch (error: any) {
      if (error.message === 'Already upvoted') {
        Alert.alert("Already Upvoted", "You have already upvoted this suggestion");
      } else {
        console.warn("Error upvoting suggestion:", error);
        Alert.alert("Error", "Failed to upvote suggestion");
      }
    } finally {
      setUpvoting(null);
    }
  };

  const handleViewComplaint = (complaint: Complaint) => {
    Alert.alert(
      "Complaint Details",
      `Title: ${complaint.title}\n\nDescription: ${complaint.description}\n\nStatus: ${complaint.status}\n\nCategory: ${complaint.category}\n\nUpvotes: ${complaint.upvotes}`,
      [
        { text: "Close", style: "cancel" },
        {
          text: "Upvote",
          onPress: () => handleUpvoteComplaint(complaint.id)
        }
      ]
    );
  };

  const handleViewSuggestion = (suggestion: Suggestion) => {
    Alert.alert(
      "Suggestion Details",
      `Title: ${suggestion.title}\n\nDescription: ${suggestion.description}\n\nCategory: ${suggestion.category}\n\nUpvotes: ${suggestion.upvotes}\n\nStatus: ${suggestion.implemented ? 'Implemented' : 'Under Review'}`,
      [
        { text: "Close", style: "cancel" },
        {
          text: "Upvote",
          onPress: () => handleUpvoteSuggestion(suggestion.id)
        }
      ]
    );
  };

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  if (dataLoading) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient
          colors={['#000000', '#0a3d2e', '#000000']}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.loadingContent}>
          <View style={styles.loadingIcon}>
            <LinearGradient
              colors={['#00ff88', '#00cc6f']}
              style={styles.loadingIconGradient}
            >
              <Ionicons name="people" size={40} color="#000" />
            </LinearGradient>
          </View>
          <ActivityIndicator size="large" color="#00ff88" style={{ marginTop: 20 }} />
          <Text style={styles.loadingText}>Loading Smart Citizen...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {/* Animated Background */}
      <LinearGradient
        colors={['#000000', '#0a3d2e', '#001a11', '#000000']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Background Glows */}
      <View style={styles.glowTopLeft} />
      <View style={styles.glowBottomRight} />

      {/* Floating Header */}
      <Animated.View pointerEvents="none" style={[styles.floatingHeader, { opacity: headerOpacity }]}>
        <BlurView intensity={30} tint="dark" style={styles.floatingHeaderBlur}>
          <View style={styles.floatingHeaderBorder} />
          <Text style={styles.floatingHeaderText}>Smart Citizen</Text>
        </BlurView>
      </Animated.View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#00ff88"
            colors={['#00ff88']}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerLeft}>
              <View style={styles.headerLeft}>
                <TouchableOpacity
                  style={styles.avatarContainer}
                  onPress={() => router.push('/(app)/dashboard')}
                >
                  <LinearGradient
                    colors={['#00ff88', '#00cc6f']}
                    style={styles.avatar}
                  >
                    <Ionicons name="person" size={24} color="#000" />
                  </LinearGradient>
                  <View style={styles.avatarGlow} />
                  <View style={styles.onlineDot} />
                </TouchableOpacity>
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={styles.welcomeText}>Welcome back</Text>
                <Text style={styles.userName}>
                  {profile?.displayName
                    || userData?.profile?.displayName
                    || (user?.phoneNumber ? `User ${user.phoneNumber.slice(-4)}` : 'User')}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={handleLogout}
              style={styles.logoutButton}
            >
              <BlurView intensity={20} tint="dark" style={styles.logoutButtonBlur}>
                <View style={styles.logoutButtonBorder} />
                <Ionicons name="log-out-outline" size={22} color="#00ff88" />
              </BlurView>
            </TouchableOpacity>
          </View>


          {/* Map Section - Always Show */}
          <View style={styles.mapSection}>
            <View style={styles.mapHeader}>
              <Ionicons name="map" size={20} color="#00ff88" />
              <Text style={styles.sectionTitle}>Issues Near You</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{complaintsWithLocation.length}</Text>
              </View>
            </View>

            {/* Category Filter Chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterContainer}
              contentContainerStyle={styles.filterContent}
            >
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.filterChip,
                    selectedCategory === cat.id && styles.filterChipActive
                  ]}
                  onPress={() => setSelectedCategory(cat.id)}
                >
                  <Text style={[
                    styles.filterChipText,
                    selectedCategory === cat.id && styles.filterChipTextActive
                  ]}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* District Filter Toggle */}
            <View style={styles.districtToggleContainer}>
              <TouchableOpacity
                style={[
                  styles.districtToggle,
                  districtFilter === profile?.district && styles.districtToggleActive
                ]}
                onPress={() => setDistrictFilter(profile?.district || 'all')}
                disabled={!profile?.district}
              >
                <Ionicons
                  name="location"
                  size={14}
                  color={districtFilter === profile?.district ? "#000" : "#00ff88"}
                />
                <Text style={[
                  styles.districtToggleText,
                  districtFilter === profile?.district && styles.districtToggleTextActive
                ]}>
                  {profile?.district ? `My District (${profile.district})` : 'Select District in Profile'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.districtToggle,
                  districtFilter === 'all' && styles.districtToggleActive
                ]}
                onPress={() => setDistrictFilter('all')}
              >
                <Ionicons
                  name="globe"
                  size={14}
                  color={districtFilter === 'all' ? "#000" : "#00ff88"}
                />
                <Text style={[
                  styles.districtToggleText,
                  districtFilter === 'all' && styles.districtToggleTextActive
                ]}>
                  All Districts
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.mapContainer}>
              {coords ? (
                <FreeMap 
                  latitude={coords.latitude} 
                  longitude={coords.longitude} 
                  reports={complaintsWithLocation} 
                />
              ) : (
                <View style={styles.mapLoading}>
                  <ActivityIndicator color="#00ff88" size="large" />
                  <Text style={styles.mapLoadingText}>
                    {locLoading ? 'Getting your location...' : 'Initializing Map...'}
                  </Text>
                </View>
              )}
            </View>
          </View>
          {/* Broadcasts Section - Below Map */}
          {broadcasts.length > 0 && (
            <TouchableOpacity
              style={styles.broadcastSection}
              onPress={() => router.push('/(app)/broadcasts')}
              activeOpacity={0.9}
            >
              <View style={styles.broadcastHeader}>
                <View style={styles.broadcastTitleRow}>
                  <Ionicons name="megaphone" size={22} color="#00ff88" />
                  <Text style={styles.broadcastTitleText}>Broadcasts</Text>
                </View>
                <View style={styles.viewAllRow}>
                  <Text style={styles.viewAllText}>View All</Text>
                  <Ionicons name="chevron-forward" size={16} color="#00ff88" />
                </View>
              </View>

              {/* Single Card Carousel - Latest 5 */}
              <View style={styles.carouselContainer}>
                {(() => {
                  const carouselItems = broadcasts.slice(0, 5);
                  const item = carouselItems[currentBroadcastIndex % carouselItems.length];
                  if (!item) return null;
                  return (
                    <View style={styles.carouselCard}>
                      <View style={styles.carouselBorder} />
                      {((item.imageUrl && typeof item.imageUrl === 'string' && item.imageUrl.length > 0) || (item.image && typeof item.image === 'string' && item.image.length > 0)) && (
                        <Image
                          source={item.imageUrl || item.image}
                          style={styles.carouselImage}
                          contentFit="cover"
                          transition={300}
                          cachePolicy="memory-disk"
                        />
                      )}
                      <BlurView intensity={20} tint="dark" style={styles.carouselContentBlur}>
                        <View style={styles.carouselContent}>
                          <View style={styles.broadcastTypeRow}>
                            <Ionicons
                              name={item.type === 'alert' ? "warning" : "megaphone"}
                              size={14}
                              color={item.type === 'alert' ? "#ff4444" : "#00ff88"}
                            />
                            <Text style={[
                              styles.broadcastTypeText,
                              { color: item.type === 'alert' ? '#ff4444' : '#00ff88' }
                            ]}>
                              {item.type === 'alert' ? 'Alert' : 'Update'}
                            </Text>
                          </View>
                          <Text style={styles.carouselTitle} numberOfLines={1}>{item.title}</Text>
                          <Text style={styles.carouselDescription} numberOfLines={2}>{item.content}</Text>
                        </View>
                      </BlurView>
                    </View>
                  );
                })()}
              </View>

              {/* Page Indicators - Latest 5 */}
              {broadcasts.slice(0, 5).length > 1 && (
                <View style={styles.pageIndicators}>
                  {broadcasts.slice(0, 5).map((_: any, index: number) => (
                    <View
                      key={index}
                      style={[
                        styles.pageIndicator,
                        index === (currentBroadcastIndex % Math.min(broadcasts.length, 5)) && styles.pageIndicatorActive
                      ]}
                    />
                  ))}
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="flash" size={20} color="#00ff88" />
            <Text style={styles.sectionTitle}>Quick Actions</Text>
          </View>

          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={handleCreateComplaint}
            >
              <BlurView intensity={20} tint="dark" style={styles.actionCardBlur}>
                <View style={styles.actionCardBorder} />
                <LinearGradient
                  colors={['#00ff88', '#00cc6f']}
                  style={styles.actionIcon}
                >
                  <Ionicons name="alert-circle" size={24} color="#000" />
                </LinearGradient>
                <Text style={styles.actionTitle}>Report Issue</Text>
                <Text style={styles.actionSubtitle}>File a complaint</Text>
              </BlurView>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={handleCreateSuggestion}
            >
              <BlurView intensity={20} tint="dark" style={styles.actionCardBlur}>
                <View style={styles.actionCardBorder} />
                <LinearGradient
                  colors={['#00cc6f', '#009955']}
                  style={styles.actionIcon}
                >
                  <Ionicons name="bulb" size={24} color="#000" />
                </LinearGradient>
                <Text style={styles.actionTitle}>Make Suggestion</Text>
                <Text style={styles.actionSubtitle}>Share ideas</Text>
              </BlurView>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push('/(app)/explore')}
            >
              <BlurView intensity={20} tint="dark" style={styles.actionCardBlur}>
                <View style={styles.actionCardBorder} />
                <LinearGradient
                  colors={['#001f14', '#00cc6f']}
                  style={styles.actionIcon}
                >
                  <Ionicons name="compass" size={24} color="#000" />
                </LinearGradient>
                <Text style={styles.actionTitle}>Explore</Text>
                <Text style={styles.actionSubtitle}>Discover issues</Text>
              </BlurView>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionCard}
              onPress={() => router.push('/(app)/community')}
            >
              <BlurView intensity={20} tint="dark" style={styles.actionCardBlur}>
                <View style={styles.actionCardBorder} />
                <LinearGradient
                  colors={['#00ff88', '#00cc6f']}
                  style={styles.actionIcon}
                >
                  <Ionicons name="people" size={24} color="#000" />
                </LinearGradient>
                <Text style={styles.actionTitle}>Community</Text>
                <Text style={styles.actionSubtitle}>Engage</Text>
              </BlurView>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={handleRefresh}
            >
              <BlurView intensity={20} tint="dark" style={styles.actionCardBlur}>
                <View style={styles.actionCardBorder} />
                <LinearGradient
                  colors={['#009955', '#006633']}
                  style={styles.actionIcon}
                >
                  <Ionicons name="refresh" size={24} color="#000" />
                </LinearGradient>
                <Text style={styles.actionTitle}>Refresh Data</Text>
                <Text style={styles.actionSubtitle}>Update feed</Text>
              </BlurView>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push('/(app)/chatbot' as any)}
            >
              <BlurView intensity={20} tint="dark" style={styles.actionCardBlur}>
                <View style={styles.actionCardBorder} />
                <LinearGradient
                  colors={['#00ff88', '#0a3d2e']}
                  style={styles.actionIcon}
                >
                  <Ionicons name="chatbubbles" size={24} color="#00ff88" />
                </LinearGradient>
                <Text style={styles.actionTitle}>Smart Citizen AI</Text>
                <Text style={styles.actionSubtitle}>Ask anything</Text>
              </BlurView>
            </TouchableOpacity>
          </View>
        </View>

        {/* Community Reports */}
        {filteredComplaints.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="people" size={20} color="#00ff88" />
              <Text style={styles.sectionTitle}>Community Reports Near You</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{filteredComplaints.length}</Text>
              </View>
            </View>

            <View style={styles.complaintsList}>
              {filteredComplaints
                .sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0))
                .slice(0, 5)
                .map((complaint) => (
                  <TouchableOpacity
                    key={`community-${complaint.id}`}
                    style={styles.complaintCard}
                    onPress={() => handleViewComplaint(complaint)}
                  >
                    <BlurView intensity={20} tint="dark" style={styles.complaintCardBlur}>
                      <View style={styles.complaintCardBorder} />
                      <View style={styles.complaintHeader}>
                        <Text style={styles.complaintTitle}>{complaint.title}</Text>
                        <ComplaintStatus status={complaint.status} />
                      </View>
                      <Text style={styles.complaintDescription} numberOfLines={2}>
                        {complaint.description}
                      </Text>
                      <View style={styles.complaintFooter}>
                        <View style={styles.complaintCategory}>
                          <Ionicons name="pricetag" size={12} color="rgba(255,255,255,0.5)" />
                          <Text style={styles.complaintCategoryText}>{complaint.category}</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.complaintUpvotes}
                          onPress={() => handleUpvoteComplaint(complaint.id)}
                          disabled={upvoting === complaint.id}
                        >
                          <Ionicons
                            name="thumbs-up"
                            size={12}
                            color={upvoting === complaint.id ? "#00ff88" : "rgba(255,255,255,0.5)"}
                          />
                          <Text style={[
                            styles.complaintUpvotesText,
                            upvoting === complaint.id && { color: '#00ff88' }
                          ]}>
                            {complaint.upvotes || 0}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </BlurView>
                  </TouchableOpacity>
                ))}
            </View>
          </View>
        )}

        {/* Recent Complaints */}
        {complaints.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="alert-circle" size={20} color="#00ff88" />
              <Text style={styles.sectionTitle}>Your Recent Complaints</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{complaints.length}</Text>
              </View>
            </View>

            <View style={styles.complaintsList}>
              {complaints.slice(0, 3).map((complaint) => (
                <TouchableOpacity
                  key={complaint.id}
                  style={styles.complaintCard}
                  onPress={() => handleViewComplaint(complaint)}
                >
                  <BlurView intensity={20} tint="dark" style={styles.complaintCardBlur}>
                    <View style={styles.complaintCardBorder} />
                    <View style={styles.complaintHeader}>
                      <Text style={styles.complaintTitle}>{complaint.title}</Text>
                      <ComplaintStatus status={complaint.status} />
                    </View>
                    <Text style={styles.complaintDescription} numberOfLines={2}>
                      {complaint.description}
                    </Text>
                    <View style={styles.complaintFooter}>
                      <View style={styles.complaintCategory}>
                        <Ionicons name="pricetag" size={12} color="rgba(255,255,255,0.5)" />
                        <Text style={styles.complaintCategoryText}>{complaint.category}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.complaintUpvotes}
                        onPress={() => handleUpvoteComplaint(complaint.id)}
                        disabled={upvoting === complaint.id}
                      >
                        <Ionicons
                          name="thumbs-up"
                          size={12}
                          color={upvoting === complaint.id ? "#00ff88" : "rgba(255,255,255,0.5)"}
                        />
                        <Text style={[
                          styles.complaintUpvotesText,
                          upvoting === complaint.id && { color: '#00ff88' }
                        ]}>
                          {complaint.upvotes || 0}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </BlurView>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Recent Suggestions */}
        {suggestions.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="bulb" size={20} color="#00ff88" />
              <Text style={styles.sectionTitle}>Your Suggestions</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{suggestions.length}</Text>
              </View>
            </View>

            <View style={styles.suggestionsList}>
              {suggestions.slice(0, 3).map((suggestion) => (
                <TouchableOpacity
                  key={suggestion.id}
                  style={styles.suggestionCard}
                  onPress={() => handleViewSuggestion(suggestion)}
                >
                  <BlurView intensity={20} tint="dark" style={styles.suggestionCardBlur}>
                    <View style={styles.suggestionCardBorder} />
                    <View style={styles.suggestionIcon}>
                      <Ionicons name="bulb" size={20} color="#00ff88" />
                    </View>
                    <View style={styles.suggestionContent}>
                      <Text style={styles.suggestionTitle}>{suggestion.title}</Text>
                      <Text style={styles.suggestionDescription} numberOfLines={2}>
                        {suggestion.description}
                      </Text>
                      <View style={styles.suggestionFooter}>
                        <Text style={styles.suggestionCategory}>{suggestion.category}</Text>
                        <TouchableOpacity
                          style={styles.suggestionUpvotes}
                          onPress={() => handleUpvoteSuggestion(suggestion.id)}
                          disabled={upvoting === suggestion.id}
                        >
                          <Ionicons
                            name="thumbs-up"
                            size={12}
                            color={upvoting === suggestion.id ? "#00ff88" : "rgba(255,255,255,0.5)"}
                          />
                          <Text style={[
                            styles.suggestionUpvotesText,
                            upvoting === suggestion.id && { color: '#00ff88' }
                          ]}>
                            {suggestion.upvotes || 0}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </BlurView>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Empty State - Only show if user has no activity */}
        {complaints.length === 0 && suggestions.length === 0 && (
          <View style={styles.emptyState}>
            <BlurView intensity={20} tint="dark" style={styles.emptyStateCard}>
              <View style={styles.emptyStateBorder} />
              <Ionicons name="document-text" size={48} color="rgba(255,255,255,0.3)" />
              <Text style={styles.emptyStateTitle}>No Contributions Yet</Text>
              <Text style={styles.emptyStateText}>
                Start by reporting an issue or sharing a suggestion to help improve your community.
              </Text>
              <TouchableOpacity
                style={styles.emptyStateButton}
                onPress={handleCreateComplaint}
              >
                <LinearGradient
                  colors={['#00ff88', '#00cc6f']}
                  style={styles.emptyStateButtonGradient}
                >
                  <Ionicons name="add" size={20} color="#000" />
                  <Text style={styles.emptyStateButtonText}>Get Started</Text>
                </LinearGradient>
              </TouchableOpacity>
            </BlurView>
          </View>
        )}

        {/* Bottom Spacing */}
        <View style={{ height: 40 }} />
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContent: {
    alignItems: 'center',
  },
  loadingIcon: {
    shadowColor: '#00ff88',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  loadingIconGradient: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 12,
  },
  glowTopLeft: {
    position: 'absolute',
    top: -100,
    left: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: '#00ff88',
    opacity: 0.1,
  },
  glowBottomRight: {
    position: 'absolute',
    bottom: -150,
    right: -100,
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: '#00cc6f',
    opacity: 0.08,
  },
  floatingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingTop: 50,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  floatingHeaderBlur: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  floatingHeaderBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.2)',
  },
  floatingHeaderText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    paddingVertical: 12,
  },
  scrollContent: {
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  header: {
    marginBottom: 24,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00ff88',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  avatarGlow: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#00ff88',
    opacity: 0.15,
    top: -7,
    left: -7,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#00ff88',
    borderWidth: 2,
    borderColor: '#000',
  },
  headerTextContainer: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 4,
  },
  userName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
  },
  logoutButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    overflow: 'hidden',
  },
  logoutButtonBlur: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  logoutButtonBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.2)',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  statCard: {
    width: '50%',
    paddingHorizontal: 6,
    marginBottom: 12,
  },
  statCardBlur: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  statCardBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.15)',
  },
  statCardContent: {
    padding: 16,
    alignItems: 'center',
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 2,
  },
  statTitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '500',
    textAlign: 'center',
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginLeft: 8,
    flex: 1,
  },
  badge: {
    backgroundColor: 'rgba(0, 255, 136, 0.15)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.3)',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#00ff88',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  actionCard: {
    width: '50%',
    paddingHorizontal: 6,
    marginBottom: 12,
  },
  actionCardBlur: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 20,
    alignItems: 'center',
  },
  actionCardBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.15)',
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#00ff88',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
    textAlign: 'center',
  },
  actionSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
  },
  complaintsList: {
    gap: 12,
  },
  complaintCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  complaintCardBlur: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 16,
  },
  complaintCardBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.15)',
  },
  complaintHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  complaintTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    flex: 1,
    marginRight: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  complaintDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 12,
    lineHeight: 20,
  },
  complaintFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  complaintCategory: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  complaintCategoryText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    marginLeft: 4,
  },
  complaintUpvotes: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
  },
  complaintUpvotesText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    marginLeft: 4,
  },
  mapSection: {
    marginTop: 12,
  },
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  filterContainer: {
    marginBottom: 12,
  },
  filterContent: {
    gap: 8,
    paddingRight: 24,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  filterChipActive: {
    borderColor: '#00ff88',
    backgroundColor: 'rgba(0,255,136,0.1)',
  },
  filterChipText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#00ff88',
    fontWeight: '600',
  },
  mapContainer: {
    height: 280,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.05)'
  },
  mapLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  userMarker: {
    backgroundColor: '#00ff88',
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#000',
  },
  complaintMarker: {
    padding: 6,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendContainer: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  legendTitle: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  legendItems: {
    gap: 6,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
  },
  suggestionsList: {
    gap: 12,
  },
  suggestionCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  suggestionCardBlur: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  suggestionCardBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.15)',
  },
  suggestionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  suggestionContent: {
    flex: 1,
  },
  suggestionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  suggestionDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 8,
    lineHeight: 20,
  },
  suggestionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  suggestionCategory: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  suggestionUpvotes: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
  },
  suggestionUpvotesText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    marginLeft: 4,
  },
  emptyState: {
    marginBottom: 32,
  },
  emptyStateCard: {
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 40,
    alignItems: 'center',
  },
  emptyStateBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.15)',
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyStateButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  emptyStateButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  emptyStateButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  mapLoadingText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 12,
    textAlign: 'center',
  },
  mapHelpText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 8,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,255,136,0.2)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#00ff88',
  },
  retryButtonText: {
    color: '#00ff88',
    fontWeight: '600',
    fontSize: 14,
  },
  broadcastSection: {
    marginBottom: 0,
    marginTop: 24,
  },
  broadcastHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  broadcastTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  broadcastTitleText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  viewAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewAllText: {
    color: '#00ff88',
    fontSize: 13,
    fontWeight: '600',
  },
  carouselContainer: {
    marginBottom: 12,
  },
  carouselCard: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  carouselBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.2)',
  },
  carouselImage: {
    width: '100%',
    height: 160,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  carouselContentBlur: {
    flex: 1,
  },
  carouselContent: {
    padding: 16,
  },
  broadcastTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  broadcastTypeText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  carouselTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  carouselDescription: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    lineHeight: 20,
  },
  pageIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  pageIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  pageIndicatorActive: {
    backgroundColor: '#00ff88',
    width: 24,
  },
  districtToggleContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    marginTop: 12,
    marginBottom: 8,
  },
  districtToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.2)',
  },
  districtToggleActive: {
    backgroundColor: '#00ff88',
    borderColor: '#00ff88',
  },
  districtToggleText: {
    color: '#00ff88',
    fontSize: 12,
    fontWeight: '700',
  },
  districtToggleTextActive: {
    color: '#000',
  },
});
