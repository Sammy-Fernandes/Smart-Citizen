// app/(app)/explore.tsx - UPDATED VERSION
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "../../components/SafeBlurView";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { useAuth } from "../../contexts/AuthContext";
import { Complaint, Suggestion, addComment, addUpvote, getAllComplaints, getAllSuggestions, getComments } from "../../services/databaseService";

type ExploreTab = 'issues' | 'ideas';

export default function ExploreScreen() {
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<ExploreTab>('issues');
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [upvoting, setUpvoting] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [selectedType, setSelectedType] = useState<'complaint' | 'suggestion'>('complaint');

  // Comment State
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [postingComment, setPostingComment] = useState(false);

  useEffect(() => {
    if (selectedItem) {
      loadComments(selectedItem.id);
    } else {
      setComments([]);
      setNewComment("");
    }
  }, [selectedItem]);

  const loadComments = async (itemId: string) => {
    try {
      setLoadingComments(true);
      const items = await getComments(itemId);
      setComments(items);
    } catch (e) {
      console.warn("Load comments error", e);
    } finally {
      setLoadingComments(false);
    }
  };

  const handlePostComment = async () => {
    if (!user || !profile || !selectedItem || !newComment.trim()) {
      if (!user) Alert.alert("Login Required", "Please login to comment");
      return;
    }

    try {
      setPostingComment(true);
      await addComment(user.uid, profile.displayName || "User", selectedItem.id, selectedType, newComment);
      setNewComment("");
      loadComments(selectedItem.id);
    } catch (e) {
      Alert.alert("Error", "Failed to post comment");
    } finally {
      setPostingComment(false);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [complaintsData, suggestionsData] = await Promise.all([
        getAllComplaints(50),
        getAllSuggestions(50)
      ]);

      const sortData = (items: any[]) => {
        return items.sort((a, b) => {
          const addrA = (a.location?.address || '').toLowerCase();
          const addrB = (b.location?.address || '').toLowerCase();
          const state = (profile?.state || '').toLowerCase();
          const district = (profile?.district || '').toLowerCase();
          const score = (addr: string) => (state && addr.includes(state) ? 2 : 0) + (district && addr.includes(district) ? 1 : 0);
          return score(addrB) - score(addrA);
        });
      };

      setComplaints(sortData(complaintsData));
      setSuggestions(sortData(suggestionsData));
    } catch (e: any) {
      console.warn("Explore load error", e);
      setError('Failed to load community content. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [profile?.state, profile?.district]);

  const handleUpvote = async (id: string, type: 'complaint' | 'suggestion') => {
    if (!user) {
      Alert.alert("Login Required", "Please login to upvote");
      return;
    }
    try {
      setUpvoting(id);
      await addUpvote(user.uid, id, type);
      if (type === 'complaint') {
        setComplaints(prev => prev.map(c => c.id === id ? { ...c, upvotes: (c.upvotes || 0) + 1 } : c));
      } else {
        setSuggestions(prev => prev.map(s => s.id === id ? { ...s, upvotes: (s.upvotes || 0) + 1 } : s));
      }
    } catch (e: any) {
      if (e?.message === 'Already upvoted') {
        Alert.alert("Already Upvoted", "You have already upvoted this");
      } else {
        Alert.alert("Error", "Failed to upvote");
      }
    } finally {
      setUpvoting(null);
    }
  };

  const showDetails = (item: any, type: 'complaint' | 'suggestion') => {
    setSelectedItem(item);
    setSelectedType(type);
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <LinearGradient colors={['#000000', '#0a3d2e', '#000000']} style={StyleSheet.absoluteFillObject} />
        <ActivityIndicator size="large" color="#00ff88" />
        <Text style={styles.loadingText}>Loading Hub...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <LinearGradient colors={['#000000', '#0a3d2e', '#000000']} style={StyleSheet.absoluteFillObject} />
      
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.iconContainer}>
              <LinearGradient colors={['#00ff88', '#00cc6f']} style={styles.iconGradient}>
                <Ionicons name="compass" size={28} color="#000" />
              </LinearGradient>
              <View style={styles.iconGlow} />
            </View>
            <View>
              <Text style={styles.title}>Community Hub</Text>
              <Text style={styles.subtitle}>Discover what's happening near you</Text>
            </View>
          </View>
        </View>

        {/* Tab Switcher */}
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            onPress={() => setActiveTab('issues')} 
            style={[styles.tabButton, activeTab === 'issues' && styles.tabButtonActive]}
          >
            <Ionicons name="alert-circle" size={18} color={activeTab === 'issues' ? "#00ff88" : "#666"} />
            <Text style={[styles.tabButtonText, activeTab === 'issues' && styles.tabButtonTextActive]}>Citizen Issues</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => setActiveTab('ideas')} 
            style={[styles.tabButton, activeTab === 'ideas' && styles.tabButtonActive]}
          >
            <Ionicons name="bulb" size={18} color={activeTab === 'ideas' ? "#00ff88" : "#666"} />
            <Text style={[styles.tabButtonText, activeTab === 'ideas' && styles.tabButtonTextActive]}>Citizen Ideas</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.cardsContainer}>
          {error && <Text style={styles.errorText}>{error}</Text>}

          {activeTab === 'issues' ? (
            complaints.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="document-text-outline" size={48} color="#666" />
                <Text style={styles.emptyTitle}>No Issues Reported</Text>
              </View>
            ) : complaints.map((c) => (
              <TouchableOpacity key={c.id} style={styles.cardWrapper} onPress={() => showDetails(c, 'complaint')}>
                <BlurView intensity={20} tint="dark" style={styles.card}>
                  <View style={styles.cardBorder} />
                  <View style={styles.cardInner}>
                    <View style={styles.upvoteSection}>
                      <TouchableOpacity onPress={() => handleUpvote(c.id, 'complaint')} style={styles.upvoteButton}>
                        <View style={[styles.upvoteIconContainer, (c.upvotedBy && user?.uid && c.upvotedBy.includes(user.uid)) && styles.upvoteIconContainerActive]}>
                          <Ionicons name="arrow-up" size={20} color={(c.upvotedBy && user?.uid && c.upvotedBy.includes(user.uid)) ? "#000" : "#00ff88"} />
                        </View>
                      </TouchableOpacity>
                      <Text style={styles.upvoteCount}>{c.upvotes || 0}</Text>
                    </View>
                    <View style={styles.contentSection}>
                      {c.imageUrls && c.imageUrls.length > 0 && (
                        <View style={styles.imageContainer}>
                          <Image source={{ uri: c.imageUrls[0] }} style={styles.complaintImage} />
                          {c.imageUrls.length > 1 && (
                            <View style={styles.imageCountBadge}>
                              <Ionicons name="images" size={12} color="#fff" />
                              <Text style={styles.imageCountText}>+{c.imageUrls.length - 1}</Text>
                            </View>
                          )}
                          {/* AI Verification Badges */}
                          {c.verificationStatus === 'verified' && (
                            <View style={[styles.aiBadge, styles.aiBadgeVerified]}>
                              <Ionicons name="checkmark-circle" size={12} color="#fff" />
                              <Text style={styles.aiBadgeText}>AI Verified</Text>
                            </View>
                          )}
                          {c.verificationStatus === 'rejected' && (
                            <View style={[styles.aiBadge, styles.aiBadgeRejected]}>
                              <Ionicons name="close-circle" size={12} color="#fff" />
                              <Text style={styles.aiBadgeText}>Rejected</Text>
                            </View>
                          )}
                        </View>
                      )}
                      <Text style={styles.cardTitle}>{c.title}</Text>
                      <Text style={styles.cardDesc} numberOfLines={2}>{c.description}</Text>
                      <View style={styles.cardFooter}>
                        <View style={styles.categoryContainer}><Text style={styles.categoryText}>{c.category}</Text></View>
                        <Text style={styles.locationText}>{c.location?.address?.split(',')[0]}</Text>
                      </View>
                    </View>
                  </View>
                </BlurView>
              </TouchableOpacity>
            ))
          ) : (
            suggestions.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="bulb-outline" size={48} color="#666" />
                <Text style={styles.emptyTitle}>No Ideas Shared Yet</Text>
              </View>
            ) : suggestions.map((s) => (
              <TouchableOpacity key={s.id} style={styles.cardWrapper} onPress={() => showDetails(s, 'suggestion')}>
                <BlurView intensity={20} tint="dark" style={styles.card}>
                  <View style={styles.cardBorder} />
                  <View style={styles.cardInner}>
                    <View style={styles.upvoteSection}>
                      <TouchableOpacity onPress={() => handleUpvote(s.id, 'suggestion')} style={styles.upvoteButton}>
                        <View style={[styles.upvoteIconContainer, (s.upvotedBy && user?.uid && s.upvotedBy.includes(user.uid)) && styles.upvoteIconContainerActive]}>
                          <Ionicons name="thumbs-up" size={20} color={(s.upvotedBy && user?.uid && s.upvotedBy.includes(user.uid)) ? "#000" : "#00ff88"} />
                        </View>
                      </TouchableOpacity>
                      <Text style={styles.upvoteCount}>{s.upvotes || 0}</Text>
                    </View>
                    <View style={styles.contentSection}>
                      <View style={styles.ideaHeader}>
                        <Text style={styles.cardTitle}>{s.title}</Text>
                        {s.implemented && (
                          <View style={styles.implementedBadge}>
                            <Ionicons name="checkmark-done" size={12} color="#00ff88" />
                            <Text style={styles.implementedText}>DONE</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.cardDesc} numberOfLines={2}>{s.description}</Text>
                      <View style={styles.cardFooter}>
                        <View style={[styles.categoryContainer, { backgroundColor: 'rgba(0,180,255,0.1)' }]}>
                          <Text style={[styles.categoryText, { color: '#00b4ff' }]}>{s.category}</Text>
                        </View>
                        <Text style={styles.authorText}>By {s.userName}</Text>
                      </View>
                    </View>
                  </View>
                </BlurView>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* Detail Modal */}
      {selectedItem && (
        <View style={styles.modalOverlay}>
          <BlurView intensity={50} tint="dark" style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedType === 'complaint' ? 'Issue Details' : 'Idea Details'}</Text>
              <TouchableOpacity onPress={() => setSelectedItem(null)} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <KeyboardAvoidingView 
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={{ flex: 1 }}
              keyboardVerticalOffset={120}
            >
              <ScrollView 
                style={styles.modalBody} 
                contentContainerStyle={styles.modalScrollContent}
                showsVerticalScrollIndicator={false}
              >
              {selectedType === 'complaint' && selectedItem.imageUrls && selectedItem.imageUrls.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageGallery}>
                  {selectedItem.imageUrls.map((url: string, index: number) => (
                    <Image key={index} source={{ uri: url }} style={styles.modalImage} />
                  ))}
                </ScrollView>
              )}

              {selectedType === 'suggestion' && (
                <View style={styles.ideaIconContainer}>
                  <LinearGradient colors={['#00ff88', '#00b4ff']} style={styles.ideaIconGlow}>
                    <Ionicons name="bulb" size={32} color="#000" />
                  </LinearGradient>
                </View>
              )}
              
              <Text style={styles.detailTitle}>{selectedItem.title}</Text>
              
              {/* AI Verification Badge (Modal) */}
              {selectedType === 'complaint' && (
                <View style={{ marginBottom: 16 }}>
                  {selectedItem.verificationStatus === 'verified' && (
                    <View style={[styles.aiBadge, { position: 'relative', top: 0, left: 0, alignSelf: 'flex-start' }, styles.aiBadgeVerified]}>
                      <Ionicons name="checkmark-circle" size={14} color="#fff" />
                      <Text style={[styles.aiBadgeText, { fontSize: 12 }]}>AI Verified Authenticated Report</Text>
                    </View>
                  )}
                  {selectedItem.verificationStatus === 'rejected' && (
                    <View style={[styles.aiBadge, { position: 'relative', top: 0, left: 0, alignSelf: 'flex-start' }, styles.aiBadgeRejected]}>
                      <Ionicons name="close-circle" size={14} color="#fff" />
                      <Text style={[styles.aiBadgeText, { fontSize: 12 }]}>Rejected by AI Verification</Text>
                    </View>
                  )}
                </View>
              )}

              <Text style={styles.detailDescription}>{selectedItem.description}</Text>
              
              {/* Premium Stat Cards */}
              <View style={styles.statCardsRow}>
                <View style={[styles.statCard, styles.statCardDistrict]}>
                  <View style={styles.statCardIconBg}>
                    <Ionicons name="location" size={16} color="#00ff88" />
                  </View>
                  <Text style={styles.statCardLabel}>District</Text>
                  <Text style={styles.statCardValue} numberOfLines={1}>{selectedItem.district || 'General'}</Text>
                </View>

                <View style={[styles.statCard, styles.statCardCategory]}>
                  <View style={[styles.statCardIconBg, styles.statCardIconCategory]}>
                    <Ionicons name={selectedType === 'complaint' ? 'pricetag' : 'bulb'} size={16} color="#00b4ff" />
                  </View>
                  <Text style={styles.statCardLabel}>Category</Text>
                  <Text style={styles.statCardValue} numberOfLines={1}>{selectedItem.category || 'General'}</Text>
                </View>

                <View style={[styles.statCard, styles.statCardUpvotes]}>
                  <View style={[styles.statCardIconBg, styles.statCardIconUpvotes]}>
                    <Ionicons name="arrow-up" size={16} color="#ffa500" />
                  </View>
                  <Text style={styles.statCardLabel}>Upvotes</Text>
                  <Text style={[styles.statCardValue, styles.statCardValueUpvotes]}>{selectedItem.upvotes || 0}</Text>
                </View>
              </View>

              {/* Status badge for issues */}
              {selectedType === 'complaint' && selectedItem.status && (
                <View style={styles.statusRow}>
                  <View style={[
                    styles.statusBadge,
                    selectedItem.status === 'resolved' && styles.statusResolved,
                    selectedItem.status === 'in-progress' && styles.statusInProgress,
                    (selectedItem.status === 'rejected' || selectedItem.verificationStatus === 'rejected') && { backgroundColor: 'rgba(255,68,68,0.15)', borderColor: 'rgba(255,68,68,0.4)' },
                  ]}>
                    <Ionicons
                      name={selectedItem.status === 'resolved' ? 'checkmark-circle' : selectedItem.status === 'in-progress' ? 'time' : (selectedItem.status === 'rejected' || selectedItem.verificationStatus === 'rejected') ? 'close-circle' : 'alert-circle'}
                      size={14}
                      color={selectedItem.status === 'resolved' ? '#00ff88' : selectedItem.status === 'in-progress' ? '#ffa500' : '#ff4444'}
                    />
                    <Text style={[
                      styles.statusText,
                      selectedItem.status === 'resolved' && { color: '#00ff88' },
                      selectedItem.status === 'in-progress' && { color: '#ffa500' },
                      (selectedItem.status === 'rejected' || selectedItem.verificationStatus === 'rejected') && { color: '#ff4444' },
                      selectedItem.status === 'pending' && { color: '#ff4444' },
                    ]}>
                      {selectedItem.status === 'resolved' ? 'Resolved' : selectedItem.status === 'in-progress' ? 'In Progress' : (selectedItem.status === 'rejected' || selectedItem.verificationStatus === 'rejected') ? 'Rejected' : 'Pending'}
                    </Text>
                  </View>
                </View>
              )}

              {/* Rejection Details in Community Hub Detail Modal */}
              {selectedType === 'complaint' && (selectedItem.status === 'rejected' || selectedItem.verificationStatus === 'rejected') && (
                <View style={styles.exploreRejectSection}>
                  <View style={styles.exploreRejectHeader}>
                    <Ionicons name="close-circle" size={18} color="#ff4444" style={{ marginRight: 6 }} />
                    <Text style={styles.exploreRejectTitle}>Report Decision: Rejected</Text>
                  </View>
                  {(selectedItem.rejectionTags?.length > 0 || selectedItem.rejection?.tags?.length > 0) && (
                    <View style={styles.exploreTagChipsRow}>
                      {(selectedItem.rejectionTags || selectedItem.rejection?.tags || []).map((tag: string, idx: number) => (
                        <View key={idx} style={styles.exploreTagChip}>
                          <Ionicons name="pricetag" size={10} color="#ffaaaa" style={{ marginRight: 3 }} />
                          <Text style={styles.exploreTagChipText}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  <Text style={styles.exploreRejectNote}>
                    {selectedItem.rejectionReason || selectedItem.rejection?.note || selectedItem.rejection?.reason || 'This report was flagged or rejected after verification.'}
                  </Text>
                </View>
              )}

              {/* Location */}
              {selectedItem.location?.address && (
                <View style={styles.locationRow}>
                  <Ionicons name="map-outline" size={14} color="rgba(255,255,255,0.4)" />
                  <Text style={styles.locationAddress} numberOfLines={2}>{selectedItem.location.address}</Text>
                </View>
              )}

              <TouchableOpacity 
                onPress={() => handleUpvote(selectedItem.id, selectedType)} 
                style={styles.modalUpvoteButton}
              >
                <LinearGradient colors={['#00ff88', '#00cc6f']} style={styles.modalUpvoteGradient}>
                  <Ionicons name={selectedType === 'complaint' ? "arrow-up" : "thumbs-up"} size={22} color="#000" />
                  <Text style={styles.modalUpvoteText}>Upvote This {selectedType === 'complaint' ? 'Issue' : 'Idea'}</Text>
                </LinearGradient>
              </TouchableOpacity>

              {/* Discussion Section */}
              <View style={styles.commentsContainer}>
                <View style={styles.discussionHeader}>
                  <Ionicons name="chatbubbles" size={18} color="#00ff88" />
                  <Text style={styles.detailLabel}>Discussion</Text>
                </View>
                
                {loadingComments ? (
                  <ActivityIndicator color="#00ff88" style={{ marginVertical: 20 }} />
                ) : (
                  comments.length === 0 ? (
                    <View style={styles.noCommentsContainer}>
                      <Ionicons name="chatbubble-outline" size={32} color="rgba(255,255,255,0.1)" />
                      <Text style={styles.noComments}>No comments yet. Start the conversation!</Text>
                    </View>
                  ) : (
                    <View style={styles.commentsList}>
                      {comments.map(c => (
                        <View key={c.id} style={styles.commentCard}>
                          <View style={styles.commentCardContent}>
                            <Text style={styles.commentUserName}>{c.userName}</Text>
                            <Text style={styles.commentText}>{c.content}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )
                )}
                
                <View style={styles.commentInputWrapper}>
                  <View style={styles.commentInputContainer}>
                    <TextInput 
                      style={styles.commentInput} 
                      placeholder="Share your thoughts..." 
                      placeholderTextColor="#666"
                      value={newComment}
                      onChangeText={setNewComment}
                      multiline
                    />
                    <TouchableOpacity onPress={handlePostComment} style={styles.sendButton}>
                      {postingComment ? (
                        <ActivityIndicator size="small" color="#000" />
                      ) : (
                        <Ionicons name="send" size={20} color="#000" />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
              <View style={{ height: 100 }} />
            </ScrollView>
            </KeyboardAvoidingView>
          </BlurView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  container: { padding: 16, paddingTop: 60, paddingBottom: 40 },
  glowTop: { position: 'absolute', top: -100, right: -100, width: 300, height: 300, borderRadius: 150, backgroundColor: '#00ff88', opacity: 0.1 },
  glowBottom: { position: 'absolute', bottom: -150, left: -100, width: 400, height: 400, borderRadius: 200, backgroundColor: '#00cc6f', opacity: 0.08 },
  header: { marginBottom: 24 },
  headerContent: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  iconContainer: { borderRadius: 28 },
  iconGradient: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  iconGlow: { position: 'absolute', top: -6, left: -6, right: -6, bottom: -6, borderRadius: 34, backgroundColor: '#00ff88', opacity: 0.3, zIndex: -1 },
  title: { color: '#fff', fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { color: 'rgba(255,255,255,0.6)', fontSize: 14, marginTop: 2 },
  tabContainer: { flexDirection: 'row', gap: 10, marginBottom: 20, paddingHorizontal: 4 },
  tabButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  tabButtonActive: { backgroundColor: 'rgba(0,255,136,0.1)', borderColor: 'rgba(0,255,136,0.3)' },
  tabButtonText: { color: '#666', fontSize: 13, fontWeight: '600' },
  tabButtonTextActive: { color: '#00ff88' },
  cardsContainer: { gap: 16 },
  cardWrapper: { borderRadius: 16, overflow: 'hidden' },
  card: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(0, 255, 136, 0.15)' },
  cardBorder: { position: 'absolute', inset: 0, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  cardInner: { flexDirection: 'row', padding: 16 },
  upvoteSection: { alignItems: 'center', marginRight: 16, width: 40 },
  upvoteButton: { marginBottom: 4 },
  upvoteIconContainer: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0, 255, 136, 0.1)', borderWidth: 1, borderColor: 'rgba(0,255,136,0.3)', alignItems: 'center', justifyContent: 'center' },
  upvoteIconContainerActive: { backgroundColor: '#00ff88' },
  upvoteCount: { color: '#00ff88', fontSize: 14, fontWeight: '700' },
  contentSection: { flex: 1 },
  ideaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  implementedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,255,136,0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  implementedText: { color: '#00ff88', fontSize: 9, fontWeight: '800' },
  cardTitle: { color: '#fff', fontSize: 17, fontWeight: '700', lineHeight: 22, marginBottom: 6 },
  cardDesc: { color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 20, marginBottom: 12 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  categoryContainer: { backgroundColor: 'rgba(0,255,136,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  categoryText: { color: '#00ff88', fontSize: 11, fontWeight: '600' },
  locationText: { color: 'rgba(255,255,255,0.4)', fontSize: 11 },
  authorText: { color: 'rgba(255,255,255,0.3)', fontSize: 11 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: '#00ff88', fontSize: 16, marginTop: 12 },
  emptyState: { alignItems: 'center', marginTop: 60, gap: 12 },
  emptyTitle: { color: '#666', fontSize: 16, fontWeight: '600' },
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.8)', padding: 20, paddingTop: 100 },
  modalContent: { flex: 1, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  closeButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  modalBody: { padding: 20 },
  detailTitle: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 12 },
  detailDescription: { color: 'rgba(255,255,255,0.7)', fontSize: 16, lineHeight: 24, marginBottom: 24 },
  detailGrid: { flexDirection: 'row', gap: 20, marginBottom: 30 },
  detailItem: { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 12 },
  detailLabel: { color: '#00ff88', fontSize: 11, fontWeight: '700', marginBottom: 4, letterSpacing: 1 },
  detailValue: { color: '#fff', fontSize: 15, fontWeight: '600' },
  commentsContainer: { marginTop: 20 },
  commentCard: { backgroundColor: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 12, marginBottom: 10 },
  commentUserName: { color: '#00ff88', fontSize: 12, fontWeight: '700', marginBottom: 4 },
  commentText: { color: '#fff', fontSize: 14, lineHeight: 20 },
  commentInputContainer: { flexDirection: 'row', gap: 10, marginTop: 20, alignItems: 'center' },
  commentInput: { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 15, paddingHorizontal: 15, paddingVertical: 10, color: '#fff' },
  sendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#00ff88', alignItems: 'center', justifyContent: 'center' },
  // ── Stat Cards ───────────────────────────────────────────
  statCardsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center' },
  statCardDistrict: { borderColor: 'rgba(0,255,136,0.15)', backgroundColor: 'rgba(0,255,136,0.04)' },
  statCardCategory: { borderColor: 'rgba(0,180,255,0.15)', backgroundColor: 'rgba(0,180,255,0.04)' },
  statCardUpvotes: { borderColor: 'rgba(255,165,0,0.15)', backgroundColor: 'rgba(255,165,0,0.04)' },
  statCardIconBg: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(0,255,136,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statCardIconCategory: { backgroundColor: 'rgba(0,180,255,0.12)' },
  statCardIconUpvotes: { backgroundColor: 'rgba(255,165,0,0.12)' },
  statCardLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4 },
  statCardValue: { color: '#fff', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  statCardValueUpvotes: { color: '#ffa500', fontSize: 18, fontWeight: '800' },
  statusRow: { marginBottom: 16 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(255,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(255,68,68,0.2)', alignSelf: 'flex-start' },
  statusResolved: { backgroundColor: 'rgba(0,255,136,0.1)', borderColor: 'rgba(0,255,136,0.2)' },
  statusInProgress: { backgroundColor: 'rgba(255,165,0,0.1)', borderColor: 'rgba(255,165,0,0.2)' },
  statusText: { fontSize: 13, fontWeight: '700', color: '#ff4444' },
  locationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 20, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 10 },
  locationAddress: { color: 'rgba(255,255,255,0.45)', fontSize: 12, flex: 1, lineHeight: 18 },
  errorText: { color: '#ff4444', textAlign: 'center', padding: 20 },
  imageContainer: { marginBottom: 12, borderRadius: 12, overflow: 'hidden' },
  complaintImage: { width: '100%', height: 180, borderRadius: 12 },
  imageCountBadge: { position: 'absolute', top: 8, right: 8, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, gap: 4 },
  imageCountText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  imageGallery: { marginBottom: 16 },
  modalImage: { width: 280, height: 200, borderRadius: 16, marginRight: 12 },
  modalUpvoteButton: { marginBottom: 24, borderRadius: 16, overflow: 'hidden' },
  modalUpvoteGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  modalUpvoteText: { color: '#000', fontWeight: '800', fontSize: 16 },
  noCommentsContainer: { alignItems: 'center', paddingVertical: 30, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 16, marginTop: 10 },
  noComments: { color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: 10, fontStyle: 'italic', fontSize: 13 },
  commentCardContent: { padding: 4 },
  modalScrollContent: { paddingBottom: 100 },
  discussionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  discussionTitle: { color: '#00ff88', fontSize: 13, fontWeight: '700', letterSpacing: 0.8 },
  commentInputWrapper: { marginTop: 16 },
  commentsList: { gap: 8 },
  ideaIconContainer: { alignItems: 'center', marginVertical: 16 },
  ideaIconGlow: { width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center', shadowColor: '#00ff88', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 15 },
  
  // AI Badges
  aiBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  aiBadgeVerified: {
    backgroundColor: '#00cc6f',
  },
  aiBadgeRejected: {
    backgroundColor: '#ff4444',
  },
  aiBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 4,
    textTransform: 'uppercase',
  },

  // Explore Rejection Styles
  exploreRejectSection: {
    backgroundColor: 'rgba(255, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 68, 68, 0.3)',
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
    marginBottom: 8,
  },
  exploreRejectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  exploreRejectTitle: {
    color: '#ff4444',
    fontSize: 14,
    fontWeight: '800',
  },
  exploreTagChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 6,
  },
  exploreTagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 68, 68, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 68, 68, 0.35)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  exploreTagChipText: {
    color: '#ffaaaa',
    fontSize: 10,
    fontWeight: '700',
  },
  exploreRejectNote: {
    color: '#fff',
    fontSize: 13,
    lineHeight: 18,
  },
});
