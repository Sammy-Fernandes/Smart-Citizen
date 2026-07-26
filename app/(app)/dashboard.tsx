// app/(app)/dashboard.tsx - COMPREHENSIVE & PREMIUM DASHBOARD
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "../../components/SafeBlurView";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useState, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
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

export default function DashboardScreen() {
  const { user, profile, userData } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ 
    totalComplaints: 0, 
    resolvedComplaints: 0, 
    rejectedComplaints: 0,
    inProgressComplaints: 0,
    pendingComplaints: 0, 
    totalSuggestions: 0 
  });
  const [recentComplaints, setRecentComplaints] = useState<Complaint[]>([]);
  const [recentSuggestions, setRecentSuggestions] = useState<Suggestion[]>([]);
  const [activeTab, setActiveTab] = useState<'reports' | 'profile'>('reports');
  const [reportFilter, setReportFilter] = useState<'all' | 'resolved' | 'rejected' | 'pending'>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);

  const loadData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const [userStats, complaints, suggestions] = await Promise.all([
        getUserStats(user.uid),
        getUserComplaints(user.uid, 50),
        getUserSuggestions(user.uid, 10)
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

  useEffect(() => {
    loadData();
  }, [user?.uid]);

  const resolutionRate = stats.totalComplaints > 0 
    ? Math.round((stats.resolvedComplaints / stats.totalComplaints) * 100)
    : 0;

  const filteredComplaints = useMemo(() => {
    if (reportFilter === 'all') return recentComplaints;
    if (reportFilter === 'resolved') return recentComplaints.filter(c => c.status === 'resolved');
    if (reportFilter === 'rejected') return recentComplaints.filter(c => c.status === 'rejected' || c.verificationStatus === 'rejected');
    if (reportFilter === 'pending') return recentComplaints.filter(c => c.status === 'pending' || !c.status);
    return recentComplaints;
  }, [recentComplaints, reportFilter]);

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
                resolvedComplaints: Math.max(0, prev.resolvedComplaints - (recentComplaints.find(c => c.id === id)?.status === 'resolved' ? 1 : 0)),
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

  const getStatusBadgeStyle = (status?: string, verificationStatus?: string) => {
    if (status === 'resolved') {
      return { bg: 'rgba(0, 255, 136, 0.15)', border: '#00ff88', text: '#00ff88', label: 'RESOLVED', icon: 'checkmark-circle' };
    }
    if (status === 'rejected' || verificationStatus === 'rejected') {
      return { bg: 'rgba(255, 68, 68, 0.15)', border: '#ff4444', text: '#ff4444', label: 'REJECTED', icon: 'close-circle' };
    }
    if (status === 'in-progress' || status === 'in_progress') {
      return { bg: 'rgba(255, 170, 0, 0.15)', border: '#ffaa00', text: '#ffaa00', label: 'IN PROGRESS', icon: 'time' };
    }
    return { bg: 'rgba(255, 255, 255, 0.1)', border: 'rgba(255, 255, 255, 0.3)', text: '#ccc', label: 'PENDING', icon: 'hourglass' };
  };

  const ProfileTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>User Profile Details</Text>
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

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Community Impact</Text>
        <BlurView intensity={15} tint="dark" style={styles.insightsCard}>
          <View style={styles.insightsCardBorder} />
          <View style={styles.insightItem}>
            <Ionicons name="trophy" size={18} color="#00ff88" />
            <Text style={styles.insightText}>
              You've successfully helped resolve {stats.resolvedComplaints} issues in your community.
            </Text>
          </View>
          <View style={styles.insightItem}>
            <Ionicons name="pie-chart" size={18} color="#00ff88" />
            <Text style={styles.insightText}>
              Resolution Efficiency: {resolutionRate}% of your reported issues have been actioned.
            </Text>
          </View>
          <View style={styles.insightItem}>
            <Ionicons name="bulb" size={18} color="#00ff88" />
            <Text style={styles.insightText}>
              {stats.totalSuggestions > 0 
                ? `You've submitted ${stats.totalSuggestions} suggestions for local improvements.`
                : 'Share ideas to improve public infrastructure in your district.'
              }
            </Text>
          </View>
        </BlurView>
      </View>
    </View>
  );

  const ReportsTab = () => (
    <View style={styles.tabContent}>
      {/* Status Filter Pills */}
      <View style={styles.filterContainer}>
        {[
          { key: 'all', label: `All (${recentComplaints.length})` },
          { key: 'resolved', label: `Resolved (${stats.resolvedComplaints})` },
          { key: 'rejected', label: `Rejected (${stats.rejectedComplaints})` },
          { key: 'pending', label: `Pending (${stats.pendingComplaints})` }
        ].map(filter => (
          <TouchableOpacity
            key={filter.key}
            onPress={() => setReportFilter(filter.key as any)}
            style={[
              styles.filterPill,
              reportFilter === filter.key && styles.filterPillActive
            ]}
          >
            <Text style={[
              styles.filterPillText,
              reportFilter === filter.key && styles.filterPillTextActive
            ]}>
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Submitted Reports</Text>
          <Text style={styles.sectionSubtitle}>
            Showing {filteredComplaints.length} of {recentComplaints.length}
          </Text>
        </View>

        {filteredComplaints.length > 0 ? (
          <View style={styles.activityList}>
            {filteredComplaints.map((complaint) => {
              const badge = getStatusBadgeStyle(complaint.status, complaint.verificationStatus);
              return (
                <TouchableOpacity 
                  key={complaint.id} 
                  activeOpacity={0.8}
                  onPress={() => setSelectedComplaint(complaint)}
                  style={styles.complaintCard}
                >
                  <BlurView intensity={15} tint="dark" style={styles.complaintBlur}>
                    <View style={styles.complaintHeader}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={styles.complaintTitle} numberOfLines={1}>
                          {complaint.title}
                        </Text>
                        <Text style={styles.complaintCategory}>{complaint.category} • {complaint.district || 'Local Area'}</Text>
                      </View>

                      {/* Status Badge */}
                      <View style={[styles.statusBadge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
                        <Ionicons name={badge.icon as any} size={12} color={badge.text} style={{ marginRight: 4 }} />
                        <Text style={[styles.statusBadgeText, { color: badge.text }]}>
                          {badge.label}
                        </Text>
                      </View>
                    </View>

                    {/* Admin Resolution Note Preview */}
                    {complaint.status === 'resolved' && (complaint.resolutionNotes || complaint.resolution?.note) && (
                      <View style={styles.adminNoteBox}>
                        <Ionicons name="shield-checkmark" size={14} color="#00ff88" style={{ marginRight: 6 }} />
                        <Text style={styles.adminNoteText} numberOfLines={2}>
                          Official Resolution: {complaint.resolution?.note || complaint.resolutionNotes}
                        </Text>
                      </View>
                    )}

                    {/* Rejection Note & Tags Preview */}
                    {(complaint.status === 'rejected' || complaint.verificationStatus === 'rejected') && (
                      <View style={styles.adminRejectBox}>
                        <View style={styles.adminRejectHeader}>
                          <Ionicons name="alert-circle" size={14} color="#ff4444" style={{ marginRight: 6 }} />
                          <Text style={styles.adminRejectHeaderTitle}>Report Rejected by Authority</Text>
                        </View>
                        {Boolean((complaint.rejectionTags?.length || 0) > 0 || (complaint.rejection?.tags?.length || 0) > 0) && (
                          <View style={styles.tagChipsRow}>
                            {(complaint.rejectionTags || complaint.rejection?.tags || []).map((tag: any, idx: number) => (
                              <View key={idx} style={styles.tagChip}>
                                <Ionicons name="pricetag" size={10} color="#ff9999" style={{ marginRight: 3 }} />
                                <Text style={styles.tagChipText}>{tag}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                        <Text style={styles.adminRejectText} numberOfLines={2}>
                          Reason: {complaint.rejectionReason || complaint.rejection?.note || complaint.rejection?.reason || 'Report was reviewed and flagged as invalid or out of scope.'}
                        </Text>
                      </View>
                    )}

                    <View style={styles.complaintFooter}>
                      <Text style={styles.complaintDate}>
                        {complaint.createdAt?.toDate?.().toLocaleDateString() || 'Recent'}
                      </Text>

                      <View style={styles.complaintActions}>
                        <TouchableOpacity
                          disabled={deletingId === complaint.id}
                          onPress={() => handleDeleteComplaint(complaint.id)}
                          style={styles.deleteButtonContainer}
                        >
                          <LinearGradient colors={['#ff5555', '#cc0000']} style={styles.deleteButton}>
                            {deletingId === complaint.id
                              ? <ActivityIndicator color="#fff" size={14} />
                              : <Ionicons name="trash" size={14} color="#fff" />
                            }
                          </LinearGradient>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </BlurView>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={48} color="rgba(255,255,255,0.3)" />
            <Text style={styles.emptyStateText}>No reports found</Text>
            <Text style={styles.emptyStateSubtext}>No reports match the selected filter criteria.</Text>
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
        <Text style={styles.loadingText}>Loading Smart Citizen Dashboard...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <LinearGradient colors={['#000000', '#0a3d2e', '#000000']} style={StyleSheet.absoluteFillObject} />
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Top Header */}
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
              <Text style={styles.subtitle}>Citizen Portal & Reports Analytics</Text>
            </View>
          </View>
        </View>

        {/* Global Key Metrics Overview Grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Report Overview</Text>
          <View style={styles.statsGrid}>
            <StatCard title="Total Reports" value={String(stats.totalComplaints)} icon="document-text" gradient={['#00ff88', '#00cc6f']} />
            <StatCard title="Resolved" value={String(stats.resolvedComplaints)} icon="checkmark-circle" gradient={['#00cc6f', '#009955']} description={`${resolutionRate}% Resolution Rate`} />
            <StatCard title="Rejected" value={String(stats.rejectedComplaints)} icon="close-circle" gradient={['#ff5555', '#cc0000']} />
            <StatCard title="Pending" value={String(stats.pendingComplaints)} icon="hourglass" gradient={['#ffaa00', '#cc8800']} />
          </View>
        </View>

        {/* Tabs Bar */}
        <View style={styles.tabs}>
          <TouchableOpacity
            onPress={() => setActiveTab('reports')}
            style={[styles.tabButton, activeTab === 'reports' && styles.tabButtonActive]}
          >
            <Text style={[styles.tabText, activeTab === 'reports' && styles.tabTextActive]}>
              My Reports ({recentComplaints.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab('profile')}
            style={[styles.tabButton, activeTab === 'profile' && styles.tabButtonActive]}
          >
            <Text style={[styles.tabText, activeTab === 'profile' && styles.tabTextActive]}>
              Profile Info
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        {activeTab === 'reports' ? <ReportsTab /> : <ProfileTab />}
      </ScrollView>

      {/* Interactive Complaint Detail Modal */}
      {selectedComplaint && (
        <Modal
          visible={!!selectedComplaint}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setSelectedComplaint(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <LinearGradient colors={['#111827', '#06100e']} style={StyleSheet.absoluteFillObject} />

              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>{selectedComplaint.title}</Text>
                  <Text style={styles.modalCategory}>{selectedComplaint.category} • {selectedComplaint.district}</Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedComplaint(null)} style={styles.modalCloseButton}>
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                {/* Status Indicator Banner */}
                {(() => {
                  const badge = getStatusBadgeStyle(selectedComplaint.status, selectedComplaint.verificationStatus);
                  return (
                    <View style={[styles.modalBanner, { backgroundColor: badge.bg, borderColor: badge.border }]}>
                      <Ionicons name={badge.icon as any} size={20} color={badge.text} style={{ marginRight: 8 }} />
                      <View>
                        <Text style={[styles.modalBannerTitle, { color: badge.text }]}>
                          Status: {badge.label}
                        </Text>
                        <Text style={styles.modalBannerSub}>
                          Report ID: {selectedComplaint.id}
                        </Text>
                      </View>
                    </View>
                  );
                })()}

                {/* Description */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Description</Text>
                  <Text style={styles.modalDescription}>
                    {selectedComplaint.description || 'No additional details provided.'}
                  </Text>
                </View>

                {/* Location */}
                {selectedComplaint.location?.address && (
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Location</Text>
                    <View style={styles.modalRow}>
                      <Ionicons name="location" size={16} color="#00ff88" style={{ marginRight: 6 }} />
                      <Text style={styles.modalText}>{selectedComplaint.location.address}</Text>
                    </View>
                  </View>
                )}

                {/* Admin Official Resolution Proof Section */}
                {(selectedComplaint.status === 'resolved' || selectedComplaint.resolution) && (
                  <View style={styles.modalAdminSection}>
                    <View style={styles.modalAdminHeader}>
                      <Ionicons name="shield-checkmark" size={18} color="#00ff88" style={{ marginRight: 6 }} />
                      <Text style={styles.modalAdminTitle}>Official Resolution Notice</Text>
                    </View>
                    <Text style={styles.modalAdminNote}>
                      {selectedComplaint.resolution?.note || selectedComplaint.resolutionNotes || 'This issue has been marked resolved by local authority admins.'}
                    </Text>

                    {selectedComplaint.resolution?.imageUrl && (
                      <View style={styles.proofImageContainer}>
                        <Text style={styles.proofImageLabel}>Resolution Proof Image:</Text>
                        <Image
                          source={{ uri: selectedComplaint.resolution.imageUrl }}
                          style={styles.proofImage}
                          resizeMode="cover"
                        />
                      </View>
                    )}
                  </View>
                )}

                {/* Rejection Details Modal Breakdown */}
                {(selectedComplaint.status === 'rejected' || selectedComplaint.verificationStatus === 'rejected') && (
                  <View style={styles.modalRejectSection}>
                    <View style={styles.modalAdminHeader}>
                      <Ionicons name="close-circle" size={20} color="#ff4444" style={{ marginRight: 8 }} />
                      <Text style={styles.modalRejectTitle}>Official Rejection Breakdown</Text>
                    </View>

                    {/* Rejection Tags */}
                    {Boolean((selectedComplaint.rejectionTags?.length || 0) > 0 || (selectedComplaint.rejection?.tags?.length || 0) > 0) && (
                      <View style={styles.modalTagChipsRow}>
                        {(selectedComplaint.rejectionTags || selectedComplaint.rejection?.tags || []).map((tag: any, idx: number) => (
                          <View key={idx} style={styles.modalTagChip}>
                            <Ionicons name="pricetag" size={11} color="#ffaaaa" style={{ marginRight: 4 }} />
                            <Text style={styles.modalTagChipText}>{tag}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    <Text style={styles.modalRejectSubtitle}>Authority Explanation Note:</Text>
                    <Text style={styles.modalRejectNote}>
                      {selectedComplaint.rejectionReason || selectedComplaint.rejection?.note || selectedComplaint.rejection?.reason || 'This report was reviewed by municipal authority admins or the AI verification engine and marked as invalid, duplicate, or out of scope.'}
                    </Text>

                    {(selectedComplaint.rejectedAt || selectedComplaint.rejection?.rejectedAt) && (
                      <View style={styles.modalRejectTimeRow}>
                        <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.4)" style={{ marginRight: 4 }} />
                        <Text style={styles.modalRejectTimeText}>
                          Recorded on {new Date((selectedComplaint.rejectedAt?.toDate?.() || (selectedComplaint.rejectedAt?.seconds ? new Date(selectedComplaint.rejectedAt.seconds * 1000) : selectedComplaint.rejection?.rejectedAt?.seconds ? new Date(selectedComplaint.rejection.rejectedAt.seconds * 1000) : new Date()))).toLocaleString()}
                        </Text>
                      </View>
                    )}

                    <View style={styles.modalRejectFooterNotice}>
                      <Ionicons name="information-circle-outline" size={14} color="#ff8888" style={{ marginRight: 6 }} />
                      <Text style={styles.modalRejectFooterNoticeText}>
                        If you feel this issue persists, please resubmit with updated photos and precise GPS location.
                      </Text>
                    </View>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
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
  tabContent: {
    marginTop: 8,
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
    marginBottom: 12,
  },
  sectionSubtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: '48%',
    minHeight: 130,
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
    padding: 14,
  },
  statCardIconBg: {
    marginBottom: 8,
  },
  statCardIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statCardValue: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 2,
  },
  statCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#00ff88',
  },
  statCardDescription: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  filterContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  filterPillActive: {
    backgroundColor: 'rgba(0, 255, 136, 0.2)',
    borderColor: '#00ff88',
  },
  filterPillText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '600',
  },
  filterPillTextActive: {
    color: '#00ff88',
    fontWeight: '700',
  },
  activityList: {
    gap: 12,
  },
  complaintCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  complaintBlur: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  complaintHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  complaintTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  complaintCategory: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  adminNoteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 136, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.2)',
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  adminNoteText: {
    color: '#00ff88',
    fontSize: 12,
    flex: 1,
  },
  adminRejectBox: {
    backgroundColor: 'rgba(255, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 68, 68, 0.25)',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
    marginBottom: 8,
  },
  adminRejectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  adminRejectHeaderTitle: {
    color: '#ff4444',
    fontSize: 12,
    fontWeight: '800',
  },
  tagChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 6,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 68, 68, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 68, 68, 0.35)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagChipText: {
    color: '#ff9999',
    fontSize: 10,
    fontWeight: '700',
  },
  adminRejectText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
    lineHeight: 16,
  },
  complaintFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  complaintDate: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
  },
  complaintActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteButtonContainer: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
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
    paddingVertical: 10,
  },
  insightText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
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
  tabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
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

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#09090b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '80%',
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  modalCategory: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    marginTop: 2,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalBody: {
    paddingVertical: 16,
  },
  modalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  modalBannerTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  modalBannerSub: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    marginTop: 2,
  },
  modalSection: {
    marginBottom: 16,
  },
  modalSectionTitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  modalDescription: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalText: {
    color: '#fff',
    fontSize: 13,
  },
  modalAdminSection: {
    backgroundColor: 'rgba(0, 255, 136, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.3)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  modalAdminHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalAdminTitle: {
    color: '#00ff88',
    fontSize: 15,
    fontWeight: '800',
  },
  modalAdminNote: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
  },
  proofImageContainer: {
    marginTop: 12,
  },
  proofImageLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  proofImage: {
    width: '100%',
    height: 180,
    borderRadius: 12,
  },
  modalRejectSection: {
    backgroundColor: 'rgba(255, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 68, 68, 0.35)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  modalRejectTitle: {
    color: '#ff4444',
    fontSize: 16,
    fontWeight: '800',
  },
  modalTagChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
    marginBottom: 12,
  },
  modalTagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 68, 68, 0.4)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  modalTagChipText: {
    color: '#ffaaaa',
    fontSize: 11,
    fontWeight: '700',
  },
  modalRejectSubtitle: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  modalRejectNote: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
  },
  modalRejectTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  modalRejectTimeText: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 11,
  },
  modalRejectFooterNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 8,
    padding: 8,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 68, 68, 0.15)',
  },
  modalRejectFooterNoticeText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 11,
    flex: 1,
    lineHeight: 15,
  },
});