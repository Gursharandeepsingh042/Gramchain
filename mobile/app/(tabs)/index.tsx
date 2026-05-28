import React, { useEffect, useState, useRef } from 'react'
import {
  View, Text, ScrollView, RefreshControl, StyleSheet, Animated,
  TouchableOpacity, Dimensions, Modal, Alert, FlatList,
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
  Card, StatCard, Badge, Skeleton,
  EmptyState, TrustBadge,
} from '@/components/ui/SharedComponents'
import { colors } from '@/constants/colors'
import { radius, shadows, spacing } from '@/constants/design'

const { width: SCREEN_W } = Dimensions.get('window')

// EMI Calculation Helper
const calcEMI = (principal: number, annualRatePercent: number, months: number) => {
  if (principal <= 0 || months <= 0) return 0
  const monthlyRate = (annualRatePercent / 100) / 12
  if (monthlyRate === 0) return principal / months
  const emi = principal * monthlyRate * Math.pow(1 + monthlyRate, months) / (Math.pow(1 + monthlyRate, months) - 1)
  return Math.round(emi)
}

export default function Dashboard() {
  const { t } = useTranslation()
  const { user }  = useAuthStore()
  const { myLoans, setMyLoans, activeLoan } = useLoanStore()

  const [refreshing, setRefreshing]         = useState(false)
  const [shgList, setShgList]               = useState<any[]>([])
  const [shgCarouselIndex, setShgCarouselIndex] = useState(0)
  const shgCarouselRef = useRef<FlatList>(null)
  const shgTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [loading, setLoading]               = useState(true)
  const [notifPanelVisible, setNotifPanel]  = useState(false)
  const [notifications, setNotifications]   = useState<any[]>([])
  const [unreadCount, setUnreadCount]       = useState(0)
  const [approvingLoan, setApprovingLoan]     = useState<string | null>(null)
  const [votingDissolveNotif, setVotingDN]   = useState<string | null>(null)
  const [creditScore, setCreditScore]       = useState<number | null>(null)
  const [creditScoreLoading, setCreditScoreLoading] = useState(false)
  const [totalBorrowed, setTotalBorrowed]   = useState(0)
  const [carouselIndex, setCarouselIndex]   = useState(0)
  const carouselRef = useRef<FlatList>(null)
  const carouselTimerRef = useRef<NodeJS.Timeout | null>(null)

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
      const loans = loansRes.data.data
      setMyLoans(loans)
      
      // Calculate total borrowed including interest (principal + total interest)
      const total = loans.reduce((sum: number, loan: any) => {
        const principal = loan.amount || 0
        const interestRate = loan.interestRateBps ? loan.interestRateBps / 100 : 18
        const tenure = loan.tenureMonths || 12
        const emi = calcEMI(principal, interestRate, tenure)
        const totalPayable = emi * tenure
        return sum + totalPayable
      }, 0)
      setTotalBorrowed(total)
      
      
      if (shgRes.data.data.length > 0) {
        setShgList(shgRes.data.data)
        
        // Fetch credit score directly from API using shgId
        const shgId = shgRes.data.data[0].shgId
        if (shgId) {
          setCreditScoreLoading(true)
          try {
            const scoreRes = await loanApi.getCreditScore({ shgId, amount: 0, refresh: false })
            setCreditScore(scoreRes.data?.data?.score ?? null)
          } catch (e) {
            console.warn('Failed to fetch credit score:', e)
            setCreditScore(null)
          } finally {
            setCreditScoreLoading(false)
          }
        }
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

  // Auto-rotate loan carousel every 5 seconds
  useEffect(() => {
    if (myLoans.length > 1) {
      carouselTimerRef.current = setInterval(() => {
        const nextIndex = (carouselIndex + 1) % myLoans.length
        setCarouselIndex(nextIndex)
        carouselRef.current?.scrollToIndex({ index: nextIndex, animated: true })
      }, 5000) as unknown as NodeJS.Timeout
      return () => {
        if (carouselTimerRef.current) clearInterval(carouselTimerRef.current)
      }
    }
  }, [carouselIndex, myLoans.length])

  // Auto-rotate SHG pool carousel every 8 seconds
  useEffect(() => {
    if (shgList.length > 1) {
      shgTimerRef.current = setInterval(() => {
        setShgCarouselIndex(prev => {
          const next = (prev + 1) % shgList.length
          shgCarouselRef.current?.scrollToIndex({ index: next, animated: true })
          return next
        })
      }, 8000) as unknown as NodeJS.Timeout
      return () => {
        if (shgTimerRef.current) clearInterval(shgTimerRef.current)
      }
    }
  }, [shgList.length])

  useEffect(() => {
    if (user?.id) {
      loadData()
    } else {
      setLoading(false)
    }
  }, [user?.id]) // use stable primitive, not object reference

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
              {t('dashboard.greeting')}
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

        {/* ─── Hero Card (SHG Pool Carousel) ────────── */}
        {loading ? (
          <View style={styles.heroSkeleton}>
            <Skeleton width="60%" height={14} />
            <Skeleton width="45%" height={32} style={{ marginTop: 8 }} />
            <Skeleton width="70%" height={12} style={{ marginTop: 12 }} />
          </View>
        ) : shgList.length > 0 ? (
          <Animated.View style={makeAnimStyle(heroAnim)}>
            <FlatList
              ref={shgCarouselRef}
              data={shgList}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.shgId}
              onMomentumScrollEnd={(e) => {
                const index = Math.round(e.nativeEvent.contentOffset.x / (SCREEN_W - 40))
                setShgCarouselIndex(index)
              }}
              renderItem={({ item }) => {
                const shg = item.shg
                const totalFunds = shg?.fundingRequests?.reduce((sum: number, req: any) => {
                  return sum + req.investments.reduce((s: number, inv: any) => s + Number(inv.amount), 0)
                }, 0) || 0
                return (
                  <TouchableOpacity
                    style={[styles.heroCard, shadows.green, { width: SCREEN_W - 40 }]}
                    activeOpacity={0.88}
                    onPress={() => router.push({ pathname: '/group-detail' as any, params: { shgId: item.shgId } })}
                  >
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
                        ₹ {shg?.poolBalance ? Number(shg.poolBalance).toLocaleString('en-IN') : '0'}
                      </Text>
                      {totalFunds > 0 && (
                        <Text style={styles.heroSubAmount}>
                          +₹{totalFunds.toLocaleString('en-IN')} from lenders
                        </Text>
                      )}
                      <View style={styles.heroDivider} />
                      <View style={styles.heroBottomRow}>
                        <View style={styles.heroMeta}>
                          <Text style={styles.heroMetaLabel}>SHG</Text>
                          <Text style={styles.heroMetaValue} numberOfLines={1}>{shg?.name}</Text>
                        </View>
                        <View style={styles.heroMeta}>
                          <Text style={styles.heroMetaLabel}>Members</Text>
                          <Text style={styles.heroMetaValue}>{shg?.members?.length ?? '–'}</Text>
                        </View>
                        <View style={styles.heroMeta}>
                          <Text style={styles.heroMetaLabel}>District</Text>
                          <Text style={styles.heroMetaValue} numberOfLines={1}>{shg?.district || '–'}</Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                )
              }}
            />
            {shgList.length > 1 && (
              <View style={styles.carouselDots}>
                {shgList.map((_, i) => (
                  <View key={i} style={[styles.carouselDot, i === shgCarouselIndex && styles.carouselDotActive]} />
                ))}
              </View>
            )}
          </Animated.View>
        ) : null}

        {/* ─── Quick Stats Row ───────────────────────── */}
        <Animated.View style={[styles.statsRow, makeAnimStyle(statsAnim)]}>
          <StatCard
            icon="📊"
            label="Credit Score"
            value={creditScoreLoading ? '...' : creditScore ? creditScore.toString() : 'N/A'}
          />
          <View style={{ width: 12 }} />
          <StatCard
            icon="💸"
            label="Total Borrowed"
            value={`₹${totalBorrowed.toLocaleString('en-IN')}`}
            subtext="Lifetime"
          />
        </Animated.View>

        {/* ─── Active Loan Section ───────────────────── */}
        <Animated.View style={makeAnimStyle(loanAnim)}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {t('dashboard.activeLoan', { defaultValue: 'Active Loan' })}
            </Text>
            {myLoans.length > 0 && (
              <TouchableOpacity onPress={() => router.push('/(tabs)/borrow')} accessibilityLabel="View all loans">
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
          ) : myLoans.length > 0 ? (
            <View style={styles.carouselContainer}>
              <FlatList
                ref={carouselRef}
                data={myLoans}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item.id}
                onMomentumScrollEnd={(e) => {
                  const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W)
                  setCarouselIndex(index)
                }}
                renderItem={({ item }) => (
                  <View style={styles.carouselItem}>
                    <TouchableOpacity onPress={() => router.push({ pathname: '/loan-detail', params: { loanId: item.id } })}>
                      <LoanCard loan={item} onRepay={handleRepay} />
                    </TouchableOpacity>
                  </View>
                )}
              />
              {myLoans.length > 1 && (
                <View style={styles.carouselDots}>
                  {myLoans.map((_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.carouselDot,
                        i === carouselIndex && styles.carouselDotActive
                      ]}
                    />
                  ))}
                </View>
              )}
            </View>
          ) : (
            <EmptyState
              icon="📋"
              title={t('dashboard.noActiveLoan', { defaultValue: 'No active loans' })}
              subtitle="Apply for a micro-loan through your SHG with fair interest rates"
              action={{ label: 'Apply Now', onPress: () => router.push('/(tabs)/borrow') }}
            />
          )}
        </Animated.View>

        {/* ─── Repayment Reminder ─────────────────────── */}
        <Animated.View style={makeAnimStyle(actionsAnim)}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Upcoming Payments</Text>
          </View>
          {(() => {
            const activeLoans = myLoans
              .filter((l: any) => l.status === 'ACTIVE' && l.nextEmiDue)
              .sort((a: any, b: any) => new Date(a.nextEmiDue).getTime() - new Date(b.nextEmiDue).getTime())
            
            if (activeLoans.length === 0) {
              return (
                <View style={[styles.reminderCard, shadows.sm]}>
                  <View style={styles.reminderIcon}>
                    <Ionicons name="checkmark-circle-outline" size={24} color={colors.primary[600]} />
                  </View>
                  <View style={styles.reminderContent}>
                    <Text style={styles.reminderTitle}>All Caught Up!</Text>
                    <Text style={styles.reminderDate}>No pending EMI payments</Text>
                  </View>
                </View>
              )
            }
            
            return activeLoans.map((loan: any) => (
              <View key={loan.id} style={[styles.reminderCard, shadows.sm, { marginBottom: 10 }]}>
                <View style={styles.reminderIcon}>
                  <Ionicons name="calendar-outline" size={24} color={colors.primary[600]} />
                </View>
                <View style={styles.reminderContent}>
                  <Text style={styles.reminderTitle}>{loan.purpose || 'Loan EMI'}</Text>
                  <Text style={styles.reminderDate}>
                    {new Date(loan.nextEmiDue).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </Text>
                  <Text style={styles.reminderAmount}>
                    ₹{Math.round(loan.emiAmount || 0).toLocaleString('en-IN')}
                  </Text>
                </View>
                <TouchableOpacity style={styles.reminderPayBtn} onPress={() => handleRepay(loan.id)}>
                  <Text style={styles.reminderPayBtnText}>Pay Now</Text>
                </TouchableOpacity>
              </View>
            ))
          })()}
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
                <TouchableOpacity onPress={handleMarkAllRead} style={styles.markReadBtn} accessibilityLabel="Mark all notifications as read">
                  <Text style={styles.markReadText}>Mark all read</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => setNotifPanel(false)} style={styles.notifCloseBtn} accessibilityLabel="Close notifications">
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
                      accessibilityLabel="Approve loan"
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
                        accessibilityLabel="Vote yes to dissolve group"
                      >
                        <Text style={styles.dissolveVoteBtnText}>✅ Yes, Dissolve</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.dissolveNoBtn, votingDissolveNotif === notif.id + '-no' && { opacity: 0.6 }]}
                        onPress={() => handleVoteFromNotif(notif.data.shgId, false, notif.id)}
                        disabled={!!votingDissolveNotif}
                        accessibilityLabel="Vote no to keep group"
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
    marginBottom:  4,
  },
  heroSubAmount: {
    fontSize:    13,
    fontWeight:  '600',
    color:       'rgba(255,255,255,0.75)',
    marginBottom: 8,
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

  // ── Carousel ──
  carouselContainer: {
    marginBottom: 24,
  },
  carouselItem: {
    width: SCREEN_W - 32,
  },
  carouselDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
  },
  carouselDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.gray[300],
  },
  carouselDotActive: {
    backgroundColor: colors.primary[600],
    width: 18,
  },

  // ── Reminder Card ──
  reminderCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.gray[100],
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  reminderIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  reminderContent: {
    flex: 1,
  },
  reminderTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: 2,
  },
  reminderDate: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginBottom: 4,
  },
  reminderAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text.primary,
  },
  reminderPayBtn: {
    backgroundColor: colors.primary[600],
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  reminderPayBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
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
