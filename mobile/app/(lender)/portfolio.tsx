import React, { useEffect, useRef, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, StyleSheet, Animated, TouchableOpacity,
  Dimensions, RefreshControl, ActivityIndicator, Modal
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useAuthStore } from '@/store/auth.store'
import { lenderApi, notificationApi } from '@/services/api'
import { Skeleton } from '@/components/ui/SharedComponents'
import { colors } from '@/constants/colors'
import { radius, shadows, spacing } from '@/constants/design'
import { Ionicons } from '@expo/vector-icons'

const { width: SCREEN_W } = Dimensions.get('window')

const INITIAL_PORTFOLIO = {
  totalInvested: { inr: 0 },
  currentValue: { inr: 0 },
  totalReturns: { inr: 0 },
  apy: 0,
  activeLoans: 0,
  repaidLoans: 0,
  repaymentRate: 0,
}

/**
 * Lender Portfolio Dashboard — premium, data-rich overview of investments.
 * Fetches live data from GET /lender/portfolio and GET /lender/transactions.
 * Falls back to demo data on error so the screen is never blank.
 */
export default function PortfolioScreen() {
  const { user } = useAuthStore()
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [portfolio, setPortfolio] = useState(INITIAL_PORTFOLIO)
  const [recentLoans, setRecentLoans] = useState<any[]>([])
  const [notifPanelVisible, setNotifPanel] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  // Animations
  const headerAnim = useRef(new Animated.Value(0)).current
  const heroAnim = useRef(new Animated.Value(0)).current
  const statsAnim = useRef(new Animated.Value(0)).current
  const loansAnim = useRef(new Animated.Value(0)).current

  const animateIn = () => {
    Animated.stagger(140, [
      Animated.spring(headerAnim, { toValue: 1, friction: 8, useNativeDriver: true }),
      Animated.spring(heroAnim, { toValue: 1, friction: 8, useNativeDriver: true }),
      Animated.spring(statsAnim, { toValue: 1, friction: 8, useNativeDriver: true }),
      Animated.spring(loansAnim, { toValue: 1, friction: 8, useNativeDriver: true }),
    ]).start()
  }

  const makeAnim = (anim: Animated.Value) => ({
    opacity: anim,
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
  })

  const fetchPortfolioData = useCallback(async () => {
    try {
      const [portfolioRes, txRes, notifRes] = await Promise.allSettled([
        lenderApi.getPortfolio(),
        lenderApi.getTransactions(),
        notificationApi.getAll().catch(() => null),
      ])

      // Portfolio metrics
      if (portfolioRes.status === 'fulfilled') {
        const d = portfolioRes.value.data.data
        setPortfolio({
          totalInvested: d.totalInvested || { inr: 0 },
          currentValue: d.currentValue || { inr: 0 },
          totalReturns: d.totalReturns || { inr: 0 },
          apy: d.apy ?? 0,
          activeLoans: d.activeLoans ?? 0,
          repaidLoans: d.repaidLoans ?? 0,
          repaymentRate: d.repaymentRate ?? 0,
        })
      } else {
        setPortfolio(INITIAL_PORTFOLIO)
      }

      // Transactions → recent loans
      if (txRes.status === 'fulfilled' && txRes.value.data.data.transactions?.length > 0) {
        setRecentLoans(txRes.value.data.data.transactions.slice(0, 5))
      } else {
        setRecentLoans([])
      }

      // Notifications
      if (notifRes && notifRes.status === 'fulfilled') {
        setNotifications(notifRes.value?.data?.data?.items || [])
        setUnreadCount(notifRes.value?.data?.data?.unreadCount || 0)
      }
    } catch (e) {
      console.error('Portfolio fetch error:', e)
      setPortfolio(INITIAL_PORTFOLIO)
      setRecentLoans([])
    } finally {
      setLoading(false)
      animateIn()
    }
  }, [])

  useEffect(() => {
    fetchPortfolioData()
  }, [fetchPortfolioData])

  const onRefresh = async () => {
    setRefreshing(true)
    await fetchPortfolioData()
    setRefreshing(false)
  }

  const handleOpenNotif = () => {
    setNotifPanel(true)
  }

  const handleMarkAllRead = async () => {
    try {
      await notificationApi.markAllRead()
      setUnreadCount(0)
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
    } catch (e) { /* non-fatal */ }
  }

  const userName = user?.name || 'Investor'
  const totalInvested = portfolio.totalInvested.inr
  const currentValue = portfolio.currentValue.inr
  const totalReturns = portfolio.totalReturns.inr
  const returnPercent = totalInvested > 0 ? ((totalReturns / totalInvested) * 100).toFixed(1) : '0.0'

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#60a5fa"
              colors={['#3b82f6']}
            />
          }
        >
          {/* Header */}
          <Animated.View style={[styles.headerRow, makeAnim(headerAnim)]}>
            <View>
              <Text style={styles.greeting}>Welcome back 👋</Text>
              <Text style={styles.userName}>{userName}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity style={styles.notifBtn} onPress={handleOpenNotif}>
              <Ionicons name="notifications-outline" size={22} color={colors.info[400]} />
              {unreadCount > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            </View>
          </Animated.View>



          {/* Hero Card — Total Portfolio */}
          {loading ? (
            <View style={styles.heroSkeleton}>
              <Skeleton width="50%" height={14} />
              <Skeleton width="60%" height={36} style={{ marginTop: 10 }} />
              <Skeleton width="40%" height={14} style={{ marginTop: 10 }} />
              <Skeleton width="100%" height={1} style={{ marginTop: 16 }} />
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                <Skeleton width="22%" height={30} />
                <Skeleton width="22%" height={30} />
                <Skeleton width="22%" height={30} />
                <Skeleton width="22%" height={30} />
              </View>
            </View>
          ) : (
            <Animated.View style={makeAnim(heroAnim)}>
              <View style={styles.heroCard}>
                <View style={styles.heroCircle1} />
                <View style={styles.heroCircle2} />
                <View style={styles.heroContent}>
                  <View style={styles.heroTopRow}>
                    <Text style={styles.heroLabel}>💎 Total Portfolio Value</Text>
                    <View style={styles.apyBadge}>
                      <Text style={styles.apyText}>{portfolio.apy}% APY</Text>
                    </View>
                  </View>

                  <Text style={styles.heroAmount}>
                    ₹ {currentValue.toLocaleString('en-IN')}
                  </Text>

                  <View style={styles.heroReturnRow}>
                    <Text style={styles.heroReturnLabel}>Total Returns: </Text>
                    <Text style={styles.heroReturnValue}>
                      +₹{totalReturns.toLocaleString('en-IN')}
                    </Text>
                    <Text style={styles.heroReturnPercent}> (+{returnPercent}%)</Text>
                  </View>

                  <View style={styles.heroDivider} />

                  <View style={styles.heroBottomRow}>
                    <View style={styles.heroMeta}>
                      <Text style={styles.heroMetaLabel}>INVESTED</Text>
                      <Text style={styles.heroMetaValue}>₹{totalInvested >= 1000 ? `${(totalInvested / 1000).toFixed(0)}K` : totalInvested}</Text>
                    </View>
                    <View style={styles.heroMeta}>
                      <Text style={styles.heroMetaLabel}>ACTIVE</Text>
                      <Text style={styles.heroMetaValue}>{portfolio.activeLoans}</Text>
                    </View>
                    <View style={styles.heroMeta}>
                      <Text style={styles.heroMetaLabel}>REPAID</Text>
                      <Text style={styles.heroMetaValue}>{portfolio.repaidLoans}</Text>
                    </View>
                    <View style={styles.heroMeta}>
                      <Text style={styles.heroMetaLabel}>REPAY RATE</Text>
                      <Text style={styles.heroMetaValue}>{portfolio.repaymentRate}%</Text>
                    </View>
                  </View>
                </View>
              </View>
            </Animated.View>
          )}

          {/* Quick Stats */}
          <Animated.View style={[styles.statsRow, makeAnim(statsAnim)]}>
            <View style={styles.statCard}>
              <Text style={styles.statEmoji}>📈</Text>
              <Text style={styles.statValue}>₹{totalReturns >= 1000 ? `${(totalReturns / 1000).toFixed(1)}K` : totalReturns}</Text>
              <Text style={styles.statLabel}>Earned</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statEmoji}>🎯</Text>
              <Text style={styles.statValue}>{portfolio.activeLoans}</Text>
              <Text style={styles.statLabel}>Active Loans</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statEmoji}>✅</Text>
              <Text style={styles.statValue}>{portfolio.repaymentRate}%</Text>
              <Text style={styles.statLabel}>Success Rate</Text>
            </View>
          </Animated.View>

          {/* Active Investments */}
          <Animated.View style={makeAnim(loansAnim)}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Active Investments</Text>
              <TouchableOpacity>
                <Text style={styles.seeAll}>View All →</Text>
              </TouchableOpacity>
            </View>

            {loading ? (
              [1, 2, 3].map(i => (
                <View key={i} style={styles.loanCardSkeleton}>
                  <Skeleton width="45%" height={16} />
                  <Skeleton width="30%" height={14} style={{ marginTop: 6 }} />
                </View>
              ))
            ) : recentLoans.length > 0 ? (
              recentLoans.map((loan: any) => (
                <TouchableOpacity key={loan.id} style={styles.loanCard} activeOpacity={0.8}>
                  <View style={styles.loanLeft}>
                    <Text style={styles.loanShg}>{loan.shg || loan.shgName || 'SHG Pool'}</Text>
                    <Text style={styles.loanDistrict}>{loan.district || '–'}</Text>
                  </View>
                  <View style={styles.loanRight}>
                    <Text style={styles.loanAmount}>₹{(loan.amount || 0).toLocaleString('en-IN')}</Text>
                    <View style={[
                      styles.loanStatusBadge,
                      { backgroundColor: loan.status === 'REPAID' ? '#dcfce7' : '#dbeafe' }
                    ]}>
                      <Text style={[
                        styles.loanStatusText,
                        { color: loan.status === 'REPAID' ? '#15803d' : '#1d4ed8' }
                      ]}>
                        {loan.status === 'REPAID' ? '✓ Repaid' : `${loan.daysRemaining || '–'}d left`}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyEmoji}>📋</Text>
                <Text style={styles.emptyTitle}>No active investments</Text>
                <Text style={styles.emptySub}>Your impact investments will appear here after you fund a pool.</Text>
              </View>
            )}
          </Animated.View>

          {/* CTA */}
          <TouchableOpacity
            style={styles.investCta}
            onPress={() => router.push('/(lender)/invest')}
            activeOpacity={0.85}
          >
            <Text style={styles.investCtaText}>+ Add More Investment</Text>
          </TouchableOpacity>

          {/* Disclaimer */}
          <View style={styles.disclaimer}>
            <Text style={styles.disclaimerText}>
              ⚠️ Capital is not guaranteed. Past performance does not guarantee future results. All values shown in ₹ (INR).
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Notification Panel */}
      <Modal
        visible={notifPanelVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setNotifPanel(false)}
      >
        <SafeAreaView style={styles.notifPanel}>
          <View style={styles.notifPanelHeader}>
            <Text style={styles.notifPanelTitle}>Notifications</Text>
            <TouchableOpacity onPress={() => setNotifPanel(false)} style={styles.notifCloseBtn}>
              <Ionicons name="close" size={24} color={colors.info[400]} />
            </TouchableOpacity>
          </View>
          {notifications.length > 0 && (
            <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllReadBtn}>
              <Text style={styles.markAllReadText}>Mark all as read</Text>
            </TouchableOpacity>
          )}
          <ScrollView style={styles.notifScroll}>
            {notifications.length === 0 ? (
              <View style={styles.notifEmpty}>
                <Text style={styles.notifEmptyEmoji}>📭</Text>
                <Text style={styles.notifEmptyText}>No notifications yet</Text>
              </View>
            ) : (
              notifications.map((notif: any) => (
                <View key={notif.id} style={[styles.notifItem, !notif.isRead && styles.notifItemUnread]}>
                  <View style={styles.notifItemContent}>
                    <Text style={styles.notifItemTitle}>{notif.title || 'Notification'}</Text>
                    <Text style={styles.notifItemBody}>{notif.message || notif.body}</Text>
                    <Text style={styles.notifItemTime}>{new Date(notif.createdAt).toLocaleString()}</Text>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  safe: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 100,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 22,
  },
  greeting: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '500',
    marginBottom: 2,
  },
  userName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#f1f5f9',
    letterSpacing: -0.5,
  },
  notifBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#1e293b',
    alignItems: 'center',
  },
  notifIcon: { fontSize: 18 },
  notifBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  notifBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  notifDot: {
    position: 'absolute',
    top: 10, right: 10,
    width: 9, height: 9,
    borderRadius: 5,
    backgroundColor: '#3b82f6',
    borderWidth: 2,
    borderColor: '#1e293b',
  },

  // Notification Panel
  notifPanel: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  notifPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  notifPanelTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f1f5f9',
  },
  notifCloseBtn: {
    padding: 8,
  },
  markAllReadBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  markAllReadText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#60a5fa',
  },
  notifScroll: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  notifEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  notifEmptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  notifEmptyText: {
    fontSize: 16,
    color: '#94a3b8',
  },
  notifItem: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  notifItemUnread: {
    backgroundColor: '#1e3a5f',
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  notifItemContent: {
    gap: 6,
  },
  notifItemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f1f5f9',
  },
  notifItemBody: {
    fontSize: 13,
    color: '#cbd5e1',
    lineHeight: 18,
  },
  notifItemTime: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
  },

  // Hero
  heroCard: {
    backgroundColor: '#1e293b',
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#334155',
  },
  heroCircle1: {
    position: 'absolute', top: -30, right: -30,
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(59,130,246,0.08)',
  },
  heroCircle2: {
    position: 'absolute', bottom: -20, left: -20,
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(245,158,11,0.06)',
  },
  heroContent: {
    padding: 22,
    zIndex: 1,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  heroLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
  },
  apyBadge: {
    backgroundColor: 'rgba(34,197,94,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  apyText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4ade80',
  },
  heroAmount: {
    fontSize: 40,
    fontWeight: '900',
    color: '#f1f5f9',
    letterSpacing: -1.5,
  },
  heroReturnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  heroReturnLabel: {
    fontSize: 13,
    color: '#64748b',
  },
  heroReturnValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4ade80',
  },
  heroReturnPercent: {
    fontSize: 12,
    color: '#4ade80',
  },
  heroDivider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 16,
  },
  heroBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroMeta: {
    flex: 1,
  },
  heroMetaLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  heroMetaValue: {
    fontSize: 16,
    color: '#e2e8f0',
    fontWeight: '700',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  statEmoji: {
    fontSize: 22,
    marginBottom: 6,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#f1f5f9',
  },
  statLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 2,
  },

  // Section
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#f1f5f9',
    letterSpacing: -0.3,
  },
  seeAll: {
    fontSize: 13,
    color: '#3b82f6',
    fontWeight: '600',
  },

  // Loan Cards
  loanCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  loanLeft: {},
  loanShg: {
    fontSize: 15,
    fontWeight: '700',
    color: '#e2e8f0',
    marginBottom: 3,
  },
  loanDistrict: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  loanRight: {
    alignItems: 'flex-end',
  },
  loanAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: '#f1f5f9',
    marginBottom: 4,
  },
  loanStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  loanStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // CTA
  investCta: {
    backgroundColor: '#3b82f6',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 16,
    ...shadows.md,
  },
  investCtaText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },

  // Disclaimer
  disclaimer: {
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.15)',
  },
  disclaimerText: {
    fontSize: 11,
    color: '#d97706',
    lineHeight: 17,
    textAlign: 'center',
  },

  // Skeletons & Demo
  heroSkeleton: {
    backgroundColor: '#1e293b',
    borderRadius: 24,
    padding: 22,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#334155',
  },
  loanCardSkeleton: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  emptyContainer: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#334155',
    marginBottom: 20,
  },
  emptyEmoji: {
    fontSize: 32,
    marginBottom: 12,
    opacity: 0.8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#e2e8f0',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
})
