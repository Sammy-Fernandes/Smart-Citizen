// app/(app)/dashboard.tsx - ENHANCED VERSION
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "../../components/SafeBlurView";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { useAuth } from "../../contexts/AuthContext";
import {
  Complaint,
  Suggestion,
  deleteComplaint,
  getUserComplaints,
  getUserStats,
  getUserSuggestions
} from "../../services/databaseService";

type StatCardProps = {
  title: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  gradient: [string, string];
  description?: string;
};

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, gradient, description }) => (
  <View style={styles.statCard}>
    <BlurView intensity={20} tint="dark" style={styles.statCardBlur}>
      <View style={styles.statCardBorder} />
      <View style={styles.statCardContent}>
        <View style={styles.statCardIconBg}>
          <LinearGradient colors={gradient} style={styles.statCardIcon}>
            <Ionicons name={icon} size={20} color="#000" />
          </LinearGradient>
        </View>
        <Text style={styles.statCardValue}>{value}</Text>
        <Text style={styles.statCardTitle}>{title}</Text>
        {description && <Text style={styles.statCardDescription}>{description}</Text>}
      </View>
    </BlurView>
  </View>
);

const ComplaintItem: React.FC<{ complaint: Complaint }> = ({ complaint }) => (
  <View style={styles.complaintItem}>
    <BlurView intensity={15} tint="dark" style={styles.complaintItemBlur}>
      <View style={styles.complaintHeader}>
        <Text style={styles.complaintTitle} numberOfLines={1}>{complaint.title}</Text>
        <View style={[
          styles.statusBadge,
          complaint.status === 'resolved' && styles.statusResolved,
          complaint.status === 'in-progress' && styles.statusInProgress
        ]}>
          <Text style={styles.statusText}>{complaint.status}</Text>
        </View>
      </View>
      <Text style={styles.complaintCategory}>{complaint.category}</Text>
      <Text style={styles.complaintDate}>
        {complaint.createdAt?.toDate?.().toLocaleDateString() || 'Recent'}
      </Text>
    </BlurView>
  </View>
);

const SuggestionItem: React.FC<{ suggestion: Suggestion }> = ({ suggestion }) => (
  <View style={styles.suggestionItem}>
    <BlurView intensity={15} tint="dark" style={styles.suggestionItemBlur}>
      <View style={styles.suggestionHeader}>
        <Text style={styles.suggestionTitle} numberOfLines={1}>{suggestion.title}</Text>
        <View style={[
          styles.implementationBadge,
          suggestion.implemented && styles.implemented
        ]}>
          <Ionicons 
            name={suggestion.implemented ? "checkmark-circle" : "time"} 
            size={12} 
            color="#fff" 
          />
          <Text style={styles.implementationText}>
            {suggestion.implemented ? 'Implemented' : 'Under Review'}
          </Text>
        </View>
      </View>
      <Text style={styles.suggestionCategory}>{suggestion.category}</Text>
    </BlurView>
  </View>
);

export default function DashboardScreen() {
  const { user, profile, userData } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ 
    totalComplaints: 0, 
    resolvedComplaints: 0, 
    pendingComplaints: 0, 
    totalSuggestions: 0 
  });
  const [recentComplaints, setRecentComplaints] = useState<Complaint[]>([]);
  const [recentSuggestions, setRecentSuggestions] = useState<Suggestion[]>([]);
  const [activeTab, setActiveTab] = useState<'profile' | 'reports'>('profile');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const [userStats, complaints, suggestions] = await Promise.all([
          getUserStats(user.uid),
          getUserComplaints(user.uid, 20),
          getUserSuggestions(user.uid, 5)
        ]);

        setStats(userStats);
        setRecentComplaints(complaints);
        setRecentSuggestions(suggestions);
      } catch (error) {
        console.warn('Error loading dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user?.uid]);

  const resolutionRate = stats.totalComplaints > 0 
    ? Math.round((stats.resolvedComplaints / stats.totalComplaints) * 100)
    : 0;

  const handleDeleteComplaint = async (id: string) => {
    if (!user) return;
    Alert.alert(
      'Delete Report',
      'Are you sure you want to delete this report? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingId(id);
              await deleteComplaint(user.uid, id);
              setRecentComplaints(prev => prev.filter(c => c.id !== id));
              setStats(prev => ({
                ...prev,
                totalComplaints: Math.max(0, prev.totalComplaints - 1),
                resolvedComplaints: Math.max(0, prev.resolvedComplaints - 0),
                pendingComplaints: Math.max(0, prev.pendingComplaints - 1),
              }));
              Alert.alert('Deleted', 'Your report has been removed.');
            } catch (e) {
              console.warn('Delete failed', e);
              Alert.alert('Error', 'Failed to delete report. Please try again.');
            } finally {
              setDeletingId(null);
            }
          }
        }
      ]
    );
  };

  const ProfileTab = () => (
    <View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Profile Info</Text>
        <BlurView intensity={15} tint="dark" style={styles.profileCard}>
          <View style={styles.profileCardBorder} />
          <View style={styles.profileRow}>
            <Text style={styles.profileLabel}>Name</Text>
            <Text style={styles.profileValue}>
              {profile?.displayName || userData?.profile?.displayName || 'Not set'}
            </Text>
          </View>
          <View style={styles.profileRow}>
            <Text style={styles.profileLabel}>Phone</Text>
            <Text style={styles.profileValue}>{user?.phoneNumber || 'Not set'}</Text>
          </View>
          <View style={styles.profileRow}>
            <Text style={styles.profileLabel}>State</Text>
            <Text style={styles.profileValue}>{profile?.state || 'Not set'}</Text>
          </View>
          <View style={styles.profileRow}>
            <Text style={styles.profileLabel}>District</Text>
            <Text style={styles.profileValue}>{profile?.district || 'Not set'}</Text>
          </View>
          <View style={styles.editProfileRow}>
            <TouchableOpacity style={styles.editProfileButton} onPress={() => router.push('/(app)/profile')}>
              <LinearGradient colors={['#00ff88', '#00cc6f']} style={styles.editProfileGradient}>
                <Ionicons name="create" size={18} color="#000" />
                <Text style={styles.editProfileText}>Edit Profile</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </BlurView>
      </View>

      {/* Insights remain consistent */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Insights</Text>
        <BlurView intensity={15} tint="dark" style={styles.insightsCard}>
          <View style={styles.insightsCardBorder} />
          <View style={styles.insightItem}>
            <Ionicons name="trophy" size={16} color="#00ff88" />
            <Text style={styles.insightText}>
              You've helped improve {stats.resolvedComplaints} issues in your community
            </Text>
          </View>
          <View style={styles.insightItem}>
            <Ionicons name="people" size={16} color="#00ff88" />
            <Text style={styles.insightText}>
              {stats.totalSuggestions > 0 
                ? `You've contributed ${stats.totalSuggestions} ideas for community betterment`
                : 'Share your first suggestion to help improve your community'
              }
            </Text>
          </View>
          <View style={styles.insightItem}>
            <Ionicons name="trending-up" size={16} color="#00ff88" />
            <Text style={styles.insightText}>
              {resolutionRate >= 50 
                ? 'Great work! Your reports have high resolution rates'
                : 'Keep reporting - every issue reported makes a difference'
              }
            </Text>
          </View>
        </BlurView>
      </View>
    </View>
  );

  const ReportsTab = () => (
    <View>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Reports</Text>
          <Text style={styles.sectionSubtitle}>
            {recentComplaints.length} total
          </Text>
        </View>
        {recentComplaints.length > 0 ? (
          <View style={styles.activityList}>
            {recentComplaints.map((complaint) => (
              <View key={complaint.id} style={styles.complaintItem}>
                <BlurView intensity={15} tint="dark" style={styles.complaintItemBlur}>
                  <View style={styles.complaintHeader}>
                    <Text style={styles.complaintTitle} numberOfLines={1}>{complaint.title}</Text>
                    <View style={styles.complaintActions}>
                      <TouchableOpacity
                        disabled={deletingId === complaint.id}
                        onPress={() => handleDeleteComplaint(complaint.id)}
                      >
                        <LinearGradient colors={['#ff5555', '#cc0000']} style={styles.deleteButton}>
                          {deletingId === complaint.id
                            ? <ActivityIndicator color="#fff" size={16} />
                            : <Ionicons name="trash" size={16} color="#fff" />
                          }
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <Text style={styles.complaintCategory}>{complaint.category}</Text>
                  <Text style={styles.complaintDate}>
                    {complaint.createdAt?.toDate?.().toLocaleDateString() || 'Recent'}
                  </Text>
                </BlurView>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={48} color="rgba(255,255,255,0.3)" />
            <Text style={styles.emptyStateText}>No reports yet</Text>
            <Text style={styles.emptyStateSubtext}>Start by reporting an issue in your community</Text>
          </View>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.screen, styles.loading]}>
        <LinearGradient colors={['#000000', '#0a3d2e', '#000000']} style={StyleSheet.absoluteFillObject} />
        <ActivityIndicator size="large" color="#00ff88" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <LinearGradient colors={['#000000', '#0a3d2e', '#000000']} style={StyleSheet.absoluteFillObject} />
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.iconContainer}>
              <LinearGradient colors={['#00ff88', '#00cc6f']} style={styles.iconGradient}>
                <Ionicons name="grid" size={28} color="#000" />
              </LinearGradient>
              <View style={styles.iconGlow} />
            </View>
            <View>
              <Text style={styles.title}>Dashboard</Text>
              <Text style={styles.subtitle}>Your info and reports</Text>
            </View>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            onPress={() => setActiveTab('profile')}
            style={[styles.tabButton, activeTab === 'profile' && styles.tabButtonActive]}
          >
            <Text style={[styles.tabText, activeTab === 'profile' && styles.tabTextActive]}>Profile Info</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab('reports')}
            style={[styles.tabButton, activeTab === 'reports' && styles.tabButtonActive]}
          >
            <Text style={[styles.tabText, activeTab === 'reports' && styles.tabTextActive]}>My Reports</Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        {activeTab === 'profile' ? <ProfileTab /> : <ReportsTab />}

        {/* Overview stats (optional footer) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <View style={styles.statsGrid}>
            <StatCard title="Total Reports" value={String(stats.totalComplaints)} icon="document-text" gradient={['#00ff88', '#00cc6f']} />
            <StatCard title="Resolved" value={String(stats.resolvedComplaints)} icon="checkmark-circle" gradient={['#00cc6f', '#009955']} />
            <StatCard title="Resolution Rate" value={`${resolutionRate}%`} icon="trending-up" gradient={['#009955', '#006633']} />
            <StatCard title="Suggestions" value={String(stats.totalSuggestions)} icon="bulb" gradient={['#006633', '#004422']} />
          </View>
        </View>
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
    paddingBottom: 40 
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
    marginBottom: 32,
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
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  sectionSubtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: '48%',
    minHeight: 140,
  },
  statCardBlur: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  statCardBorder: {
    position: 'absolute',
    inset: 0,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,255,136,0.15)',
  },
  statCardContent: {
    padding: 16,
  },
  statCardIconBg: {
    marginBottom: 12,
  },
  statCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statCardValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
  },
  statCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#00ff88',
    marginBottom: 4,
  },
  statCardDescription: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
  },
  activityList: {
    gap: 8,
  },
  complaintItem: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  complaintItemBlur: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 12,
    borderRadius: 12,
  },
  complaintHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  complaintTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  complaintActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: {
    backgroundColor: 'rgba(255,68,68,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusResolved: {
    backgroundColor: 'rgba(0,255,136,0.2)',
  },
  statusInProgress: {
    backgroundColor: 'rgba(255,165,0,0.2)',
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  complaintCategory: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    marginBottom: 2,
  },
  complaintDate: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
  },
  suggestionItem: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  suggestionItemBlur: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 12,
    borderRadius: 12,
  },
  suggestionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  suggestionTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  implementationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,165,0,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  implemented: {
    backgroundColor: 'rgba(0,255,136,0.2)',
  },
  implementationText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  suggestionCategory: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  emptyStateText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 4,
  },
  emptyStateSubtext: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    textAlign: 'center',
  },
  insightsCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,255,136,0.15)',
    padding: 16,
  },
  insightsCardBorder: {
    position: 'absolute',
    inset: 0,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 8,
  },
  insightText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  // Profile Tab Styles
  profileCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,255,136,0.15)',
    padding: 16,
  },
  profileCardBorder: {
    position: 'absolute',
    inset: 0,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  profileLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '500',
  },
  profileValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  editProfileRow: {
    paddingTop: 16,
    alignItems: 'center',
  },
  editProfileButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  editProfileGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  editProfileText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '700',
  },
  // Tab Styles
  tabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: 'rgba(0,255,136,0.2)',
  },
  tabText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#00ff88',
  },
  loading: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  loadingText: {
    marginTop: 12,
    color: 'rgba(255,255,255,0.7)',
  },
});