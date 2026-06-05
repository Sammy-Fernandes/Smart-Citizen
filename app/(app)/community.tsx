import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "../../components/SafeBlurView";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../../contexts/AuthContext";

import {
  getDistrictMessages,
  getDistrictPolls,
  sendMessage,
  voteOnPoll,
} from "../../services/databaseService";

type Tab = "chat" | "polls";

export default function CommunityHub() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("chat");
  const [messages, setMessages] = useState<any[]>([]);
  const [polls, setPolls] = useState<any[]>([]);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const district = profile?.district || "General";
  const displayName = profile?.displayName || "Citizen";

  useEffect(() => {
    let unsubMessages: any = null;
    let unsubPolls: any = null;

    const subscribe = () => {
      try {
        unsubMessages = getDistrictMessages(district, (msgs: any[]) => {
          try {
            if (Array.isArray(msgs)) setMessages(msgs);
          } catch (innerErr) {
            console.warn("Community: Message processing error", innerErr);
          }
        });
      } catch (e) {
        console.warn("Community: Message subscription error", e);
        setLoadError(true);
      }

      try {
        unsubPolls = getDistrictPolls(district, (p: any[]) => {
          try {
            if (Array.isArray(p)) setPolls(p);
          } catch (innerErr) {
            console.warn("Community: Poll processing error", innerErr);
          }
        });
      } catch (e) {
        console.warn("Community: Poll subscription error", e);
      }
    };

    subscribe();

    return () => {
      try { if (typeof unsubMessages === "function") unsubMessages(); } catch (e) {}
      try { if (typeof unsubPolls === "function") unsubPolls(); } catch (e) {}
    };
  }, [district]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || !user) return;
    try {
      setSending(true);
      await sendMessage({
        text: inputText.trim(),
        district,
        senderId: user.uid,
        senderName: displayName,
      });
      setInputText("");
    } catch (error) {
      Alert.alert("Error", "Failed to send message. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const handleVote = async (pollId: string, optionIndex: number) => {
    if (!user) return;
    try {
      await voteOnPoll(pollId, optionIndex, user.uid);
    } catch (error: any) {
      Alert.alert("Poll", error?.message || "Vote failed");
    }
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isMe = item.senderId === user?.uid;
    return (
      <View style={[styles.messageWrapper, isMe ? styles.myMessageWrapper : styles.theirMessageWrapper]}>
        {!isMe && <Text style={styles.senderName}>{item.senderName || "Citizen"}</Text>}
        <View style={[styles.messageBubble, isMe ? styles.myBubble : styles.theirBubble]}>
          <Text style={[styles.messageText, isMe && styles.myMessageText]}>{item.text}</Text>
          <Text style={[styles.messageTime, isMe && styles.myMessageTime]}>
            {item.createdAt?.seconds
              ? new Date(item.createdAt.seconds * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : "..."}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#000000", "#0a3d2e", "#000000"]} style={StyleSheet.absoluteFillObject} />
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color="#00ff88" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <View style={styles.headerTitleRow}>
            <LinearGradient colors={["#00ff88", "#00cc6f"]} style={styles.headerIcon}>
              <Ionicons name="people" size={18} color="#000" />
            </LinearGradient>
            <Text style={styles.headerTitle}>{district} Community</Text>
          </View>
          <View style={styles.onlineBadge}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>Live Hub</Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          onPress={() => setActiveTab("chat")}
          style={[styles.tab, activeTab === "chat" && styles.activeTab]}
        >
          <Ionicons name="chatbubbles" size={18} color={activeTab === "chat" ? "#00ff88" : "rgba(255,255,255,0.4)"} />
          <Text style={[styles.tabText, activeTab === "chat" && styles.activeTabText]}>District Chat</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab("polls")}
          style={[styles.tab, activeTab === "polls" && styles.activeTab]}
        >
          <Ionicons name="stats-chart" size={18} color={activeTab === "polls" ? "#00ff88" : "rgba(255,255,255,0.4)"} />
          <Text style={[styles.tabText, activeTab === "polls" && styles.activeTabText]}>Civic Polls</Text>
        </TouchableOpacity>
      </View>

      {activeTab === "chat" ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
        >
          {loadError ? (
            <View style={styles.errorState}>
              <Ionicons name="cloud-offline" size={48} color="rgba(255,255,255,0.2)" />
              <Text style={styles.errorStateText}>Chat unavailable</Text>
              <Text style={styles.errorStateSubtext}>Check your connection and try again</Text>
            </View>
          ) : messages.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="chatbubbles-outline" size={56} color="rgba(255,255,255,0.1)" />
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptySubtitle}>Be the first to start a conversation in {district}!</Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.chatList}
              onContentSizeChange={() => {
                if (messages.length > 0) {
                  setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 150);
                }
              }}
              showsVerticalScrollIndicator={false}
            />
          )}

          {/* Input */}
          <BlurView intensity={30} tint="dark" style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Message your neighbors..."
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              onPress={handleSendMessage}
              disabled={sending || !inputText.trim()}
              style={[styles.sendBtn, (!inputText.trim() || sending) && styles.sendBtnDisabled]}
            >
              <LinearGradient colors={["#00ff88", "#00cc6f"]} style={styles.sendBtnGradient}>
                {sending ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Ionicons name="send" size={18} color="#000" />
                )}
              </LinearGradient>
            </TouchableOpacity>
          </BlurView>
        </KeyboardAvoidingView>
      ) : (
        <ScrollView contentContainerStyle={styles.pollList} showsVerticalScrollIndicator={false}>
          {polls.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="stats-chart-outline" size={56} color="rgba(255,255,255,0.1)" />
              <Text style={styles.emptyTitle}>No active polls</Text>
              <Text style={styles.emptySubtitle}>Civic polls for {district} will appear here</Text>
            </View>
          ) : (
            polls.map((poll) => (
              <BlurView key={poll.id} intensity={20} tint="dark" style={styles.pollCard}>
                <View style={styles.pollCardBorder} />
                <Text style={styles.pollQuestion}>{poll.question}</Text>
                {(poll.options || []).map((opt: any, idx: number) => {
                  const totalVotes = (poll.options || []).reduce((s: number, o: any) => s + (o.votes || 0), 0);
                  const percentage = totalVotes > 0 ? Math.round(((opt.votes || 0) / totalVotes) * 100) : 0;
                  return (
                    <TouchableOpacity key={idx} onPress={() => handleVote(poll.id, idx)} style={styles.pollOption}>
                      <View style={styles.pollOptionContent}>
                        <Text style={styles.pollOptionText}>{opt.text}</Text>
                        <Text style={styles.pollVoteText}>{percentage}%</Text>
                      </View>
                      <View style={styles.pollProgressBar}>
                        <View style={[styles.pollProgressFill, { width: `${percentage}%` as any }]} />
                      </View>
                    </TouchableOpacity>
                  );
                })}
                <Text style={styles.pollFooter}>
                  {(poll.options || []).reduce((s: number, o: any) => s + (o.votes || 0), 0)} votes
                </Text>
              </BlurView>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  glowTop: { position: "absolute", top: -80, right: -80, width: 250, height: 250, borderRadius: 125, backgroundColor: "#00ff88", opacity: 0.07 },
  glowBottom: { position: "absolute", bottom: -100, left: -80, width: 300, height: 300, borderRadius: 150, backgroundColor: "#00cc6f", opacity: 0.05 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)" },
  backButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(0,255,136,0.2)" },
  headerInfo: { marginLeft: 14, flex: 1 },
  headerTitleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  onlineBadge: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#00ff88", marginRight: 6 },
  onlineText: { color: "#00ff88", fontSize: 11, fontWeight: "600", opacity: 0.8 },
  tabBar: { flexDirection: "row", padding: 12, gap: 10 },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  activeTab: { backgroundColor: "rgba(0,255,136,0.08)", borderColor: "rgba(0,255,136,0.25)" },
  tabText: { color: "rgba(255,255,255,0.4)", fontSize: 13, fontWeight: "600" },
  activeTabText: { color: "#00ff88" },
  chatList: { padding: 16, paddingBottom: 100 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80 },
  emptyTitle: { color: "rgba(255,255,255,0.5)", fontSize: 18, fontWeight: "700", marginTop: 20 },
  emptySubtitle: { color: "rgba(255,255,255,0.3)", fontSize: 13, marginTop: 8, textAlign: "center", paddingHorizontal: 40 },
  errorState: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80 },
  errorStateText: { color: "rgba(255,255,255,0.5)", fontSize: 18, fontWeight: "700", marginTop: 20 },
  errorStateSubtext: { color: "rgba(255,255,255,0.3)", fontSize: 13, marginTop: 8 },
  messageWrapper: { marginBottom: 14, maxWidth: "82%" },
  myMessageWrapper: { alignSelf: "flex-end" },
  theirMessageWrapper: { alignSelf: "flex-start" },
  senderName: { color: "rgba(255,255,255,0.4)", fontSize: 11, marginBottom: 4, marginLeft: 14 },
  messageBubble: { padding: 12, borderRadius: 20 },
  myBubble: { backgroundColor: "rgba(0,255,136,0.15)", borderBottomRightRadius: 4, borderWidth: 1, borderColor: "rgba(0,255,136,0.2)" },
  theirBubble: { backgroundColor: "rgba(255,255,255,0.07)", borderBottomLeftRadius: 4, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  messageText: { color: "rgba(255,255,255,0.9)", fontSize: 14, lineHeight: 20 },
  myMessageText: { color: "#fff" },
  messageTime: { color: "rgba(255,255,255,0.25)", fontSize: 10, alignSelf: "flex-end", marginTop: 6 },
  myMessageTime: { color: "rgba(0,255,136,0.4)" },
  inputContainer: { position: "absolute", bottom: 20, left: 16, right: 16, borderRadius: 26, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderColor: "rgba(0,255,136,0.15)", overflow: "hidden" },
  input: { flex: 1, color: "#fff", fontSize: 14, maxHeight: 100, paddingVertical: 8 },
  sendBtn: { marginLeft: 10 },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnGradient: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  pollList: { padding: 16, paddingBottom: 40 },
  pollCard: { padding: 20, borderRadius: 20, marginBottom: 16, overflow: "hidden" },
  pollCardBorder: { position: "absolute", inset: 0, borderRadius: 20, borderWidth: 1, borderColor: "rgba(0,255,136,0.15)" },
  pollQuestion: { color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 20, lineHeight: 22 },
  pollOption: { marginBottom: 14 },
  pollOptionContent: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  pollOptionText: { color: "rgba(255,255,255,0.8)", fontSize: 14 },
  pollVoteText: { color: "#00ff88", fontWeight: "700", fontSize: 14 },
  pollProgressBar: { height: 6, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" },
  pollProgressFill: { height: "100%", backgroundColor: "#00ff88", borderRadius: 3 },
  pollFooter: { color: "rgba(255,255,255,0.3)", fontSize: 11, marginTop: 8, textAlign: "right" },
});
