import React, { useEffect, useState, useRef } from 'react'
import {
  View, Text, ScrollView, RefreshControl, StyleSheet, Animated,
  TouchableOpacity, Dimensions, Modal, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '@/store/auth.store'
import { useLoanStore } from '@/store/loan.store'
import { loanApi, shgApi, notificationApi } from '@/services/api'

import { LoanCard } from '@/components/ui/LoanCard'
import {
  Card, StatCard, QuickAction, Badge, Skeleton,
  EmptyState, TrustBadge,
} from '@/components/ui/SharedComponents'
import { colors } from '@/constants/colors'
import { radius, shadows, spacing } from '@/constants/design'

const { width: SCREEN_W } = Dimensions.get('window')

export default function Dashboard() {
  const { t } = useTranslation()
  const { user }  = useAuthStore()
  const { myLoans, setMyLoans, activeLoan } = useLoanStore()

  const [refreshing, setRefreshing]         = useState(false)
  const [shgData, setShgData]               = useState<any>(null)
  const [loading, setLoading]               = useState(true)
  const [notifPanelVisible, setNotifPanel]  = useState(false)
  const [notifications, setNotifications]   = useState<any[]>([])
  const [unreadCount, setUnreadCount]       = useState(0)
  const [approvingLoan, setApprovingLoan]     = useState<string | null>(null)
  const [votingDissolveNotif, setVotingDN]   = useState<string | null>(null)

  // Staggered entrance animations
  const greetAnim   = useRef(new Animated.Value(0)).current
  const heroAnim    = useRef(new Animated.Value(0)).current
  const statsAnim   = useRef(new Animated.Value(0)).current
  const loanAnim    = useRef(new Animated.Value(0)).current
  const actionsAnim = useRef(new Animated.Value(0)).current

  const animateIn = () => {
    Animated.stagger(120, [
      Animated.spring(greetAnim,   { toValue: 1, friction: 8, useNativeDriver: true }),
      Animated.spring(heroAnim,    { toValue: 1, friction: 8, useNativeDriver: true }),
      Animated.spring(statsAnim,   { toValue: 1, friction: 8, useNativeDriver: true }),
      Animated.spring(loanAnim,    { toValue: 1, friction: 8, useNativeDriver: true }),
      Animated.spring(actionsAnim, { toValue: 1, friction: 8, useNativeDriver: true }),
    ]).start()
  }

  const makeAnimStyle = (anim: Animated.Value) => ({
    opacity:   anim,
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
  })

  const loadData = async () => {
    try {
      const [loansRes, shgRes, notifRes] = await Promise.all([
        loanApi.getMyLoans(),
        shgApi.getMyGroups(),
        notificationApi.getAll().catch(() => null),
      ])
      setMyLoans(loansRes.data.data)
      if (shgRes.data.data.length > 0) {
        setShgData(shgRes.data.data[0].shg)
      }
      if (notifRes) {
        setNotifications(notifRes.data.data.items || [])
        setUnreadCount(notifRes.data.data.unreadCount || 0)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
      animateIn()
    }
  }

  const handleOpenNotif = async () => {
    setNotifPanel(true)
  }

  const handleMarkAllRead = async () => {
    try {
      await notificationApi.markAllRead()
      setUnreadCount(0)
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
    } catch (e) { /* non-fatal */ }
  }

  const handleApproveLoan = async (loanId: string, notifId: string) => {
    Alert.alert('Approve Loan', 'Are you sure you want to approve this loan request?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Approve', style: 'default',
        onPress: async () => {
          setApprovingLoan(loanId)
          try {
            await loanApi.approveLoan(loanId)
            await notificationApi.markOneRead(notifId)
            setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, isRead: true } : n))
            setUnreadCount(prev => Math.max(0, prev - 1))
            Alert.alert('Done', 'Loan approved successfully.')
            loadData()
          } catch (err: any) {
            Alert.alert('Error', err.response?.data?.error?.message || 'Failed to approve loan.')
          } finally {
            setApprovingLoan(null)
          }
        }
      }
    ])
  }

  const handleVoteFromNotif = async (shgId: string, vote: boolean, notifId: string) => {
    const key = notifId + (vote ? '-yes' : '-no')
    setVotingDN(key)
    try {
      const res = await shgApi.voteDissolve(shgId, vote)
      await notificationApi.markOneRead(notifId)
      setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, isRead: true } : n))
      setUnreadCount(prev => Math.max(0, prev - 1))
      const { status, message } = res.data.data
      Alert.alert(
        status === 'DISSOLVED' ? 'Group Dissolved' : status === 'CANCELLED' ? 'Vote Cancelled' : 'Vote Recorded',
        message
      )
      loadData()
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error?.message || 'Failed to submit vote.')
    } finally {
      setVotingDN(null)
    }
  }

  useEffect(() => {
    if (user) {
      loadData()
    } else {
      setLoading(false)
    }
  }, [user])

  const onRefresh = async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }

  const handleRepay = async (loanId: string) => {
    try {
      await loanApi.repayLoan(loanId)
      loadData()
    } catch (e: any) {
      console.error(e)
    }
  }

  // Time-based greeting
  const hour     = new Date().getHours()
  const greeting = hour < 12 ? 'सुप्रभात' : hour < 17 ? 'नमस्ते' : 'शुभ संध्या'
  const userName = user?.name || user?.phone || 'User'

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
        {/* ─── Header ─────────────────────────────────── */}
        <Animated.View style={[styles.headerRow, makeAnimStyle(greetAnim)]}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>
              {greeting} 🙏
            </Text>
            <Text style={styles.userName}>{userName}</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.notifBtn} accessibilityLabel="Notifications" onPress={handleOpenNotif}>
              <Ionicons name="notifications-outline" size={22} color={colors.text.primary} />
              {unreadCount > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ─── Hero Card (SHG Pool) ──────────────────── */}
        {loading ? (
          <View style={styles.heroSkeleton}>
            <Skeleton width="60%" height={14} />
            <Skeleton width="45%" height={32} style={{ marginTop: 8 }} />
            <Skeleton width="70%" height={12} style={{ marginTop: 12 }} />
          </View>
        ) : shgData ? (
          <Animated.View style={makeAnimStyle(heroAnim)}>
            <View style={[styles.heroCard, shadows.green]}>
              {/* Decorative circles */}
              <View style={styles.heroCircle1} />
              <View style={styles.heroCircle2} />

              <View style={styles.heroContent}>
                <View style={styles.heroTopRow}>
                  <Text style={styles.heroLabel}>
                    💚 {t('dashboard.groupSavings', { defaultValue: 'Group Savings Pool' })}
                  </Text>
                  <Badge label="Active" variant="success" size="sm" />
                </View>

                <Text style={styles.heroAmount}>
                  ₹ {shgData?.poolBalance ? shgData.poolBalance.toLocaleString('en-IN') : '0'}
                </Text>

                <View style={styles.heroDivider} />

                <View style={styles.heroBottomRow}>
                  <View style={styles.heroMeta}>
                    <Text style={styles.heroMetaLabel}>SHG</Text>
                    <Text style={styles.heroMetaValue}>{shgData.name}</Text>
                  </View>
                  <View style={styles.heroMeta}>
                    <Text style={styles.heroMetaLabel}>Members</Text>
                    <Text style={styles.heroMetaValue}>
                      {shgData.members?.length ?? '–'}
                    </Text>
                  </View>
                  <View style={styles.heroMeta}>
                    <Text style={styles.heroMetaLabel}>District</Text>
                    <Text style={styles.heroMetaValue} numberOfLines={1}>
                      {shgData.district || '–'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </Animated.View>
        ) : null}

        {/* ─── Quick Stats Row ───────────────────────── */}
        <Animated.View style={[styles.statsRow, makeAnimStyle(statsAnim)]}>
          <StatCard
            icon="📊"
            label="Credit Score"
            value="N/A"
          />
          <View style={{ width: 12 }} />
          <StatCard
            icon="💸"
            label="Total Borrowed"
            value="₹0"
            subtext="Lifetime"
          />
        </Animated.View>

        {/* ─── Active Loan Section ───────────────────── */}
        <Animated.View style={makeAnimStyle(loanAnim)}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {t('dashboard.activeLoan', { defaultValue: 'Active Loan' })}
            </Text>
            {activeLoan && (
              <TouchableOpacity onPress={() => router.push('/(tabs)/borrow')}>
                <Text style={styles.seeAll}>View All →</Text>
              </TouchableOpacity>
            )}
          </View>
          {loading ? (
            <View style={[styles.loanSkeleton, shadows.sm]}>
              <Skeleton width="50%" height={24} />
              <Skeleton width="100%" height={14} style={{ marginTop: 12 }} />
              <Skeleton width="80%" height={14} style={{ marginTop: 6 }} />
              <Skeleton width="100%" height={44} radius={12} style={{ marginTop: 16 }} />
            </View>
          ) : activeLoan ? (
            <LoanCard loan={activeLoan} onRepay={handleRepay} />
          ) : (
            <EmptyState
              icon="📋"
              title={t('dashboard.noActiveLoan', { defaultValue: 'No active loans' })}
              subtitle="Apply for a micro-loan through your SHG with fair interest rates"
              action={{ label: 'Apply Now', onPress: () => router.push('/(tabs)/borrow') }}
            />
          )}
        </Animated.View>

        {/* ─── Quick Actions ─────────────────────────── */}
        <Animated.View style={makeAnimStyle(actionsAnim)}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
          </View>
          <View style={styles.actionsGrid}>
            <QuickAction
              icon="💰"
              label={t('dashboard.borrow', { defaultValue: 'Borrow' })}
              onPress={() => router.push('/(tabs)/borrow')}
              color={colors.primary[600]}
            />
            <QuickAction
              icon="📊"
              label={t('dashboard.history', { defaultValue: 'History' })}
              onPress={() => {}}
              color={colors.info[600]}
            />
            <QuickAction
              icon="👥"
              label={t('dashboard.group', { defaultValue: 'Group' })}
              onPress={() => router.push('/(tabs)/group')}
              color={colors.secondary[600]}
            />
            <QuickAction
              icon="🏛️"
              label={t('dashboard.schemes', { defaultValue: 'Schemes' })}
              onPress={() => router.push('/(tabs)/schemes')}
              color={colors.danger[500]}
            />
          </View>
        </Animated.View>

        {/* ─── Footer Trust Badge ────────────────────── */}
        <View style={styles.footerSection}>
          <TrustBadge />
          <Text style={styles.versionText}>GramChain v1.0 — Powered by Polygon</Text>
        </View>
      </ScrollView>

      {/* ─── Notification Panel Modal ──────────────── */}
      <Modal
        visible={notifPanelVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setNotifPanel(false)}
      >
        <SafeAreaView style={styles.notifModal}>
          <View style={styles.notifModalHeader}>
            <Text style={styles.notifModalTitle}>Notifications</Text>
            <View style={styles.notifModalActions}>
              {unreadCount > 0 && (
                <TouchableOpacity onPress={handleMarkAllRead} style={styles.markReadBtn}>
                  <Text style={styles.markReadText}>Mark all read</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => setNotifPanel(false)} style={styles.notifCloseBtn}>
                <Ionicons name="close" size={20} color={colors.text.primary} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.notifList}>
            {notifications.length === 0 ? (
              <View style={styles.notifEmpty}>
                <Text style={styles.notifEmptyIcon}>🔔</Text>
                <Text style={styles.notifEmptyText}>You're all caught up!</Text>
              </View>
            ) : (
              notifications.map(notif => (
                <View key={notif.id} style={[styles.notifItem, !notif.isRead && styles.notifItemUnread]}>
                  <View style={styles.notifItemTop}>
                    <Text style={styles.notifItemIcon}>
                      {notif.type === 'LOAN_APPROVAL_REQUEST' ? '💸'
                        : notif.type === 'LOAN_APPROVED' ? '✅'
                        : notif.type === 'MEMBER_REMOVED' ? '🚫'
                        : notif.type === 'DISSOLUTION_VOTE' ? '⚠️'
                        : '🔔'}
                    </Text>
                    <View style={styles.notifItemContent}>
                      <Text style={styles.notifItemTitle}>{notif.title}</Text>
                      <Text style={styles.notifItemBody}>{notif.body}</Text>
                      <Text style={styles.notifItemTime}>
                        {new Date(notif.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                    {!notif.isRead && <View style={styles.unreadDot} />}
                  </View>
                  {notif.type === 'LOAN_APPROVAL_REQUEST' && notif.data?.loanId && !notif.isRead && (
                    <TouchableOpacity
                      style={[styles.approveBtn, approvingLoan === notif.data.loanId && { opacity: 0.6 }]}
                      onPress={() => handleApproveLoan(notif.data.loanId, notif.id)}
                      disabled={approvingLoan === notif.data.loanId}
                    >
                      <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
                      <Text style={styles.approveBtnText}>
                        {approvingLoan === notif.data.loanId ? 'Approving...' : 'Approve Loan'}
                      </Text>
                    </TouchableOpacity>
                  )}
                  {notif.type === 'DISSOLUTION_VOTE' && notif.data?.shgId && !notif.isRead && (
                    <View style={styles.dissolveNotifRow}>
                      <TouchableOpacity
                        style={[styles.dissolveYesBtn, votingDissolveNotif === notif.id + '-yes' && { opacity: 0.6 }]}
                        onPress={() => handleVoteFromNotif(notif.data.shgId, true, notif.id)}
                        disabled={!!votingDissolveNotif}
                      >
                        <Text style={styles.dissolveVoteBtnText}>✅ Yes, Dissolve</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.dissolveNoBtn, votingDissolveNotif === notif.id + '-no' && { opacity: 0.6 }]}
                        onPress={() => handleVoteFromNotif(notif.data.shgId, false, notif.id)}
                        disabled={!!votingDissolveNotif}
                      >
                        <Text style={styles.dissolveVoteBtnText}>🚫 No, Keep</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
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

  // ── Header ──
  headerRow: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'center',
    marginBottom:    20,
  },
  headerLeft: {},
  greeting: {
    fontSize:   14,
    color:      colors.text.secondary,
    fontWeight: '500',
    marginBottom: 2,
  },
  userName: {
    fontSize:    24,
    fontWeight:  '800',
    color:       colors.text.primary,
    letterSpacing: -0.5,
  },
  headerRight: {
    flexDirection: 'row',
    gap:           8,
  },
  notifBtn: {
    width:           44,
    height:          44,
    borderRadius:    14,
    backgroundColor: colors.surface,
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1,
    borderColor:     colors.gray[100],
    ...shadows.sm,
  },
  notifIcon: {
    fontSize: 18,
  },
  notifDot: {
    position:        'absolute',
    top:             10,
    right:           10,
    width:           9,
    height:          9,
    borderRadius:    5,
    backgroundColor: colors.danger[500],
    borderWidth:     2,
    borderColor:     colors.surface,
  },
  notifBadge: {
    position:        'absolute',
    top:             6,
    right:           6,
    minWidth:        18,
    height:          18,
    borderRadius:    9,
    backgroundColor: colors.danger[500],
    alignItems:      'center',
    justifyContent:  'center',
    paddingHorizontal: 3,
    borderWidth:     1.5,
    borderColor:     colors.surface,
  },
  notifBadgeText: {
    fontSize:    10,
    fontWeight:  '800',
    color:       '#fff',
    lineHeight:  12,
  },
  // ── Notification Panel Modal ──
  notifModal: {
    flex:            1,
    backgroundColor: colors.background,
  },
  notifModalHeader: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'center',
    paddingHorizontal: 20,
    paddingVertical:  16,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  notifModalTitle: {
    fontSize:   20,
    fontWeight: '800',
    color:      colors.text.primary,
  },
  notifModalActions: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  markReadBtn: {
    paddingHorizontal: 10,
    paddingVertical:   6,
    backgroundColor:   colors.primary[50],
    borderRadius:      8,
  },
  markReadText: {
    fontSize:   12,
    fontWeight: '700',
    color:      colors.primary[700],
  },
  notifCloseBtn: {
    width:           36,
    height:          36,
    borderRadius:    10,
    backgroundColor: colors.gray[100],
    alignItems:      'center',
    justifyContent:  'center',
  },
  notifList: {
    padding:    16,
    paddingBottom: 60,
    gap:        10,
  },
  notifEmpty: {
    alignItems:    'center',
    paddingTop:    80,
    gap:           12,
  },
  notifEmptyIcon: {
    fontSize: 48,
  },
  notifEmptyText: {
    fontSize:   16,
    fontWeight: '600',
    color:      colors.text.secondary,
  },
  notifItem: {
    backgroundColor: colors.surface,
    borderRadius:    14,
    padding:         14,
    borderWidth:     1,
    borderColor:     colors.gray[100],
    ...shadows.sm,
  },
  notifItemUnread: {
    borderColor:     colors.primary[200],
    backgroundColor: colors.primary[50],
  },
  notifItemTop: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           10,
  },
  notifItemIcon: {
    fontSize:  22,
    marginTop:  2,
  },
  notifItemContent: {
    flex: 1,
  },
  notifItemTitle: {
    fontSize:    14,
    fontWeight:  '700',
    color:       colors.text.primary,
    marginBottom: 2,
  },
  notifItemBody: {
    fontSize:   13,
    color:      colors.text.secondary,
    lineHeight: 18,
  },
  notifItemTime: {
    fontSize:   11,
    color:      colors.text.tertiary,
    marginTop:  4,
  },
  unreadDot: {
    width:           8,
    height:          8,
    borderRadius:    4,
    backgroundColor: colors.primary[500],
    marginTop:       4,
  },
  approveBtn: {
    marginTop:       10,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             6,
    backgroundColor: colors.primary[600],
    borderRadius:    10,
    paddingVertical: 10,
  },
  approveBtnText: {
    fontSize:   14,
    fontWeight: '700',
    color:      '#fff',
  },
  dissolveNotifRow: {
    flexDirection: 'row',
    gap:           8,
    marginTop:     10,
  },
  dissolveYesBtn: {
    flex:            1,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    paddingVertical: 9,
    borderRadius:    10,
    backgroundColor: '#16a34a',
  },
  dissolveNoBtn: {
    flex:            1,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    paddingVertical: 9,
    borderRadius:    10,
    backgroundColor: colors.danger[600],
  },
  dissolveVoteBtnText: {
    fontSize:   13,
    fontWeight: '700',
    color:      '#fff',
  },

  // ── Hero Card ──
  heroCard: {
    backgroundColor: '#0f6b30',
    borderRadius:    radius['2xl'],
    padding:         0,
    marginBottom:    20,
    overflow:        'hidden',
  },
  heroCircle1: {
    position:        'absolute',
    top:             -30,
    right:           -30,
    width:           120,
    height:          120,
    borderRadius:    60,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  heroCircle2: {
    position:        'absolute',
    bottom:          -20,
    left:            -20,
    width:           80,
    height:          80,
    borderRadius:    40,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  heroContent: {
    padding:  22,
    zIndex:   1,
  },
  heroTopRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   8,
  },
  heroLabel: {
    fontSize:   13,
    fontWeight: '600',
    color:      'rgba(255,255,255,0.8)',
  },
  heroAmount: {
    fontSize:      40,
    fontWeight:    '900',
    color:         '#ffffff',
    letterSpacing: -1.5,
    marginBottom:  8,
  },
  heroDivider: {
    height:          1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginVertical:  12,
  },
  heroBottomRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
  },
  heroMeta: {
    flex: 1,
  },
  heroMetaLabel: {
    fontSize:   10,
    color:      'rgba(255,255,255,0.55)',
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  heroMetaValue: {
    fontSize:   14,
    color:      '#ffffff',
    fontWeight: '700',
  },

  // ── Stats ──
  statsRow: {
    flexDirection: 'row',
    marginBottom:  24,
  },

  // ── Section Headers ──
  sectionHeader: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'center',
    marginBottom:    14,
  },
  sectionTitle: {
    fontSize:   18,
    fontWeight: '800',
    color:      colors.text.primary,
    letterSpacing: -0.3,
  },
  seeAll: {
    fontSize:   13,
    color:      colors.primary[600],
    fontWeight: '600',
  },

  // ── Skeletons ──
  heroSkeleton: {
    backgroundColor: colors.gray[100],
    borderRadius:    radius['2xl'],
    padding:         24,
    marginBottom:    20,
  },
  loanSkeleton: {
    backgroundColor: colors.surface,
    borderRadius:    radius.card,
    padding:         20,
    borderWidth:     1,
    borderColor:     colors.gray[100],
    marginBottom:    20,
  },

  // ── Quick Actions Grid ──
  actionsGrid: {
    flexDirection:   'row',
    backgroundColor: colors.surface,
    borderRadius:    radius.card,
    padding:         20,
    borderWidth:     1,
    borderColor:     colors.gray[100],
    ...shadows.sm,
    marginBottom:    24,
  },

  // ── Footer ──
  footerSection: {
    alignItems:     'center',
    paddingVertical: 16,
    gap:            8,
  },
  versionText: {
    fontSize: 11,
    color:    colors.text.tertiary,
  },
})
