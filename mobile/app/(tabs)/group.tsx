import React, { useEffect, useState, useRef } from 'react'
import {
  View, Text, ScrollView, RefreshControl, StyleSheet, Animated,
  TouchableOpacity,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { shgApi } from '@/services/api'
import { MemberCard } from '@/components/ui/MemberCard'
import {
  Card, Badge, StatCard, EmptyState, Divider,
  Skeleton, TrustBadge,
} from '@/components/ui/SharedComponents'
import { colors } from '@/constants/colors'
import { radius, shadows, spacing } from '@/constants/design'

export default function GroupScreen() {
  const { t } = useTranslation()
  const [shg, setShg]             = useState<any>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading]     = useState(true)

  // Animation
  const fadeAnim = useRef(new Animated.Value(0)).current

  const loadShg = async () => {
    try {
      const res = await shgApi.getMyGroups()
      if (res.data.data.length > 0) {
        setShg(res.data.data[0].shg)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
      Animated.timing(fadeAnim, {
        toValue: 1, duration: 400, useNativeDriver: true,
      }).start()
    }
  }

  useEffect(() => { loadShg() }, [])

  const onRefresh = async () => {
    setRefreshing(true)
    await loadShg()
    setRefreshing(false)
  }

  // Empty state
  if (!loading && !shg) {
    return (
      <SafeAreaView style={styles.safe}>
        <EmptyState
          icon="👥"
          title={t('group.noGroups', { defaultValue: 'No group yet' })}
          subtitle="Join or create a Self-Help Group to access group loans and collective savings"
          action={{ label: 'Create a Group', onPress: () => {} }}
        />
      </SafeAreaView>
    )
  }

  const memberCount = shg?.members?.length ?? 0
  const leaders     = shg?.members?.filter((m: any) => m.role === 'LEADER') ?? []

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary[500]}
            colors={[colors.primary[500]]}
          />
        }
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          {/* ── Group Header Card ── */}
          {loading ? (
            <View style={[styles.groupHeaderSkeleton, shadows.sm]}>
              <Skeleton width="60%" height={24} />
              <Skeleton width="40%" height={14} style={{ marginTop: 8 }} />
              <Skeleton width="100%" height={14} style={{ marginTop: 16 }} />
            </View>
          ) : (
            <View style={[styles.groupHeaderCard, shadows.green]}>
              {/* Decorative */}
              <View style={styles.headerBlob1} />
              <View style={styles.headerBlob2} />

              <View style={styles.headerContent}>
                <View style={styles.groupLogo}>
                  <Text style={styles.groupLogoText}>
                    {shg.name?.charAt(0)?.toUpperCase() || 'S'}
                  </Text>
                </View>

                <View style={styles.groupInfo}>
                  <Text style={styles.groupName}>{shg.name}</Text>
                  <Text style={styles.groupLocation}>
                    📍 {shg.district}{shg.state ? `, ${shg.state}` : ''}
                  </Text>
                </View>

                <Badge label="Active" variant="success" size="sm" />
              </View>

              <View style={styles.headerDivider} />

              {/* SHG Meta Row */}
              <View style={styles.groupMeta}>
                <View style={styles.metaItem}>
                  <Text style={styles.metaValue}>{memberCount}</Text>
                  <Text style={styles.metaLabel}>Members</Text>
                </View>
                <View style={styles.metaSeparator} />
                <View style={styles.metaItem}>
                  <Text style={styles.metaValue}>₹1.5L</Text>
                  <Text style={styles.metaLabel}>Pool</Text>
                </View>
                <View style={styles.metaSeparator} />
                <View style={styles.metaItem}>
                  <Text style={styles.metaValue}>3</Text>
                  <Text style={styles.metaLabel}>Active Loans</Text>
                </View>
              </View>
            </View>
          )}

          {/* ── Stats Row ── */}
          <View style={styles.statsRow}>
            <StatCard
              icon="💰"
              label="Total Collected"
              value="₹2.4L"
              trend="up"
              trendValue="+12%"
            />
            <View style={{ width: 12 }} />
            <StatCard
              icon="📊"
              label="Repayment Rate"
              value="98%"
              trend="up"
              trendValue="+3%"
            />
          </View>

          {/* ── Members List ── */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {t('group.members', { defaultValue: 'Members' })} ({memberCount})
            </Text>
            <TouchableOpacity>
              <Text style={styles.addMemberBtn}>+ Add</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <>
              {[1, 2, 3].map(i => (
                <View key={i} style={[styles.memberSkeleton, shadows.xs]}>
                  <Skeleton width={48} height={48} radius={16} />
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Skeleton width="60%" height={16} />
                    <Skeleton width="40%" height={12} style={{ marginTop: 6 }} />
                  </View>
                </View>
              ))}
            </>
          ) : (
            shg.members?.map((m: any) => (
              <MemberCard key={m.userId} member={m} />
            ))
          )}

          {/* ── Upcoming Meeting ── */}
          <Divider label="Upcoming Meeting" />
          <View style={[styles.meetingCard, shadows.sm]}>
            <View style={styles.meetingIconBg}>
              <Text style={styles.meetingIcon}>📅</Text>
            </View>
            <View style={styles.meetingContent}>
              <Text style={styles.meetingTitle}>Monthly SHG Meeting</Text>
              <Text style={styles.meetingDate}>Next Sunday, 10:00 AM</Text>
              <Text style={styles.meetingLocation}>📍 Village Panchayat Hall</Text>
            </View>
          </View>

          {/* ── Footer ── */}
          <View style={styles.footerSection}>
            <TrustBadge />
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop:        12,
    paddingBottom:     100,
  },

  // ── Group Header Card ──
  groupHeaderCard: {
    backgroundColor: '#0f6b30',
    borderRadius:    radius['2xl'],
    padding:         0,
    marginBottom:    20,
    overflow:        'hidden',
  },
  headerBlob1: {
    position:        'absolute',
    top:             -30,
    right:           -30,
    width:           100,
    height:          100,
    borderRadius:    50,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  headerBlob2: {
    position:        'absolute',
    bottom:          -15,
    left:            -15,
    width:           60,
    height:          60,
    borderRadius:    30,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  headerContent: {
    flexDirection:  'row',
    alignItems:     'center',
    padding:        20,
    paddingBottom:  12,
    gap:            14,
  },
  groupLogo: {
    width:           52,
    height:          52,
    borderRadius:    18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  groupLogoText: {
    fontSize:   24,
    fontWeight: '900',
    color:      '#fff',
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize:   20,
    fontWeight: '800',
    color:      '#fff',
    letterSpacing: -0.3,
  },
  groupLocation: {
    fontSize:   12,
    color:      'rgba(255,255,255,0.7)',
    marginTop:  3,
  },
  headerDivider: {
    height:           1,
    backgroundColor:  'rgba(255,255,255,0.12)',
    marginHorizontal: 20,
  },
  groupMeta: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    padding:         18,
  },
  metaItem: {
    flex:       1,
    alignItems: 'center',
  },
  metaValue: {
    fontSize:   20,
    fontWeight: '800',
    color:      '#fff',
    marginBottom: 3,
  },
  metaLabel: {
    fontSize:   10,
    color:      'rgba(255,255,255,0.6)',
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  metaSeparator: {
    width:           1,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },

  // ── Stats ──
  statsRow: {
    flexDirection: 'row',
    marginBottom:  24,
  },

  // ── Section Header ──
  sectionHeader: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'center',
    marginBottom:    14,
  },
  sectionTitle: {
    fontSize:      18,
    fontWeight:    '800',
    color:         colors.text.primary,
    letterSpacing: -0.3,
  },
  addMemberBtn: {
    fontSize:   13,
    color:      colors.primary[600],
    fontWeight: '700',
  },

  // ── Skeletons ──
  groupHeaderSkeleton: {
    backgroundColor: colors.gray[100],
    borderRadius:    radius['2xl'],
    padding:         24,
    marginBottom:    20,
  },
  memberSkeleton: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: colors.surface,
    borderRadius:    radius.lg,
    padding:         14,
    marginBottom:    10,
    borderWidth:     1,
    borderColor:     colors.gray[100],
  },

  // ── Meeting Card ──
  meetingCard: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   colors.surface,
    borderRadius:      radius.lg,
    padding:           16,
    gap:               14,
    borderWidth:       1,
    borderColor:       colors.gray[100],
    marginBottom:      24,
  },
  meetingIconBg: {
    width:           52,
    height:          52,
    borderRadius:    16,
    backgroundColor: colors.secondary[50],
    alignItems:      'center',
    justifyContent:  'center',
  },
  meetingIcon: {
    fontSize: 24,
  },
  meetingContent: {
    flex: 1,
  },
  meetingTitle: {
    fontSize:   14,
    fontWeight: '700',
    color:      colors.text.primary,
    marginBottom: 3,
  },
  meetingDate: {
    fontSize:   13,
    color:      colors.primary[700],
    fontWeight: '600',
    marginBottom: 2,
  },
  meetingLocation: {
    fontSize:   12,
    color:      colors.text.secondary,
  },

  // ── Footer ──
  footerSection: {
    alignItems:      'center',
    paddingVertical: 16,
  },
})
