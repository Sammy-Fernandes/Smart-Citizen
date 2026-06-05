// app/(app)/broadcasts.tsx - All Broadcasts Screen
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from '../../components/SafeBlurView';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import { getBroadcasts } from "../../services/databaseService";

export default function BroadcastsScreen() {
    const router = useRouter();
    const [broadcasts, setBroadcasts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const loadBroadcasts = async () => {
        try {
            const items = await getBroadcasts();
            setBroadcasts(items);
        } catch (e) {
            console.warn("Error loading broadcasts:", e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadBroadcasts();
    }, []);

    const handleRefresh = () => {
        setRefreshing(true);
        loadBroadcasts();
    };

    return (
        <View style={styles.screen}>
            <StatusBar barStyle="light-content" backgroundColor="#000" />

            {/* Background Glow */}
            <View style={styles.glowTop} />
            <View style={styles.glowBottom} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>All Broadcasts</Text>
                <View style={styles.liveBadge}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>LIVE</Text>
                </View>
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#00ff88" />
                    <Text style={styles.loadingText}>Loading broadcasts...</Text>
                </View>
            ) : (
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={handleRefresh}
                            tintColor="#00ff88"
                            colors={["#00ff88"]}
                        />
                    }
                >
                    {broadcasts.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Ionicons name="megaphone-outline" size={64} color="rgba(255,255,255,0.2)" />
                            <Text style={styles.emptyTitle}>No Broadcasts</Text>
                            <Text style={styles.emptyText}>There are no active broadcasts at this time.</Text>
                        </View>
                    ) : (
                        broadcasts.map((item: any) => (
                            <View
                                key={item.id}
                                style={[
                                    styles.broadcastCard,
                                    item.type === 'alert' && styles.broadcastCardAlert
                                ]}
                            >
                                <View style={styles.cardBorder} />

                                {((item.imageUrl && typeof item.imageUrl === 'string' && item.imageUrl.length > 0) || (item.image && typeof item.image === 'string' && item.image.length > 0)) && (
                                    <Image
                                        source={item.imageUrl || item.image}
                                        style={styles.cardImage}
                                        contentFit="cover"
                                        transition={300}
                                        cachePolicy="memory-disk"
                                    />
                                )}

                                <BlurView intensity={15} tint="dark" style={styles.cardContentBlur}>
                                    <View style={styles.cardContent}>
                                        <View style={styles.typeRow}>
                                            <LinearGradient
                                                colors={item.type === 'alert' ? ['#ff4444', '#cc0000'] : ['#00ff88', '#00cc6f']}
                                                style={styles.typeIcon}
                                            >
                                                <Ionicons
                                                    name={item.type === 'alert' ? "warning" : "megaphone"}
                                                    size={16}
                                                    color="#000"
                                                />
                                            </LinearGradient>
                                            <Text style={[
                                                styles.typeText,
                                                { color: item.type === 'alert' ? '#ff4444' : '#00ff88' }
                                            ]}>
                                                {item.type === 'alert' ? 'Priority Alert' : 'City Update'}
                                            </Text>
                                            <Text style={styles.dateText}>
                                                {item.createdAt?.seconds
                                                    ? new Date(item.createdAt.seconds * 1000).toLocaleDateString()
                                                    : 'Recent'}
                                            </Text>
                                        </View>

                                        <Text style={styles.cardTitle}>{item.title}</Text>
                                        <Text style={styles.cardDescription}>{item.content}</Text>
                                    </View>
                                </BlurView>
                            </View>
                        ))
                    )}
                </ScrollView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: '#000',
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
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 60,
        paddingHorizontal: 16,
        paddingBottom: 16,
        gap: 12,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.08)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    headerTitle: {
        flex: 1,
        fontSize: 24,
        fontWeight: '700',
        color: '#fff',
        letterSpacing: -0.5,
    },
    liveBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 68, 68, 0.12)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 10,
        gap: 6,
        borderWidth: 1,
        borderColor: 'rgba(255, 68, 68, 0.25)',
    },
    liveDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#ff4444',
    },
    liveText: {
        color: '#ff4444',
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 1,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        color: 'rgba(255,255,255,0.5)',
        marginTop: 12,
        fontSize: 14,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 40,
        gap: 16,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
        marginTop: 16,
    },
    emptyText: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 14,
        marginTop: 8,
    },
    broadcastCard: {
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    broadcastCardAlert: {
        borderColor: 'rgba(255, 68, 68, 0.2)',
    },
    cardContentBlur: {
        flex: 1,
    },
    cardBorder: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: 16,
    },
    cardImage: {
        width: '100%',
        height: 180,
        backgroundColor: 'rgba(255,255,255,0.03)',
    },
    cardContent: {
        padding: 16,
    },
    typeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 10,
    },
    typeIcon: {
        width: 28,
        height: 28,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    typeText: {
        fontSize: 11,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    dateText: {
        marginLeft: 'auto',
        color: 'rgba(255,255,255,0.35)',
        fontSize: 12,
    },
    cardTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 6,
        lineHeight: 24,
    },
    cardDescription: {
        color: 'rgba(255,255,255,0.65)',
        fontSize: 14,
        lineHeight: 21,
    },
});
