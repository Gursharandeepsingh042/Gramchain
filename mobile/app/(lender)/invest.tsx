import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Animated,
  RefreshControl, Alert
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { lenderApi } from '@/services/api'
import { Skeleton } from '@/components/ui/SharedComponents'
import { colors } from '@/constants/colors'
import { radius, shadows } from '@/constants/design'
import { PaymentService } from '@/services/payment'
import { getAddress } from '@/services/wallet'
import * as SecureStore from 'expo-secure-store'



/**
 * Invest Screen — browse and fund loan pools by Risk Tier + Geographic Filter.
 * Fetches live data from GET /lender/pools, falls back to demo data on error.
 */
export default function InvestScreen() {
  const [selectedTier, setSelectedTier] = useState<'ALL' | 'AA' | 'A' | 'B'>('ALL')
  const [selectedState, setSelectedState] = useState('All States')
  const [showStateFilter, setShowStateFilter] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [pools, setPools] = useState<any[]>([])
  const [fundingPool, setFundingPool] = useState<string | null>(null)

  const fadeAnim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.spring(fadeAnim, { toValue: 1, friction: 8, useNativeDriver: true }).start()
  }, [])

  const states = ['All States', 'Jammu & Kashmir', 'Jharkhand', 'Bihar', 'Odisha', 'Madhya Pradesh', 'Rajasthan']

  const tiers = [
    { id: 'ALL' as const, label: 'All Tiers', emoji: '🎯' },
    { id: 'AA' as const, label: 'AA Safe', emoji: '🛡️', apy: '10%', risk: 'Low', color: '#22c55e' },
    { id: 'A' as const, label: 'A Standard', emoji: '📊', apy: '13%', risk: 'Medium', color: '#f59e0b' },
    { id: 'B' as const, label: 'B Growth', emoji: '🚀', apy: '16%', risk: 'Higher', color: '#ef4444' },
  ]

  const fetchPools = useCallback(async () => {
    try {
      const params: any = {}
      if (selectedTier !== 'ALL') params.tier = selectedTier
      if (selectedState !== 'All States') params.state = selectedState

      const res = await lenderApi.getAvailablePools(params)
      const data = res.data.data

      if (data.pools && data.pools.length > 0) {
        setPools(data.pools)
      }
    } catch (e) {
      console.warn('Pools API failed:', e)
      setPools([])
    } finally {
      setLoading(false)
    }
  }, [selectedTier, selectedState])

  useEffect(() => {
    setLoading(true)
    fetchPools()
  }, [fetchPools])

  const onRefresh = async () => {
    setRefreshing(true)
    await fetchPools()
    setRefreshing(false)
  }

  const handleFundPool = async (poolId: string, poolName: string) => {
    Alert.alert(
      'Fund Pool',
      `Invest in ${poolName}?\n\nThis will initiate a payment via Transak (UPI → USDC → Pool).`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Invest ₹5,000',
          onPress: async () => {
            setFundingPool(poolId)
            try {
              const walletAddress = await getAddress()
              
              if (!walletAddress) {
                Alert.alert('Wallet Error', 'Please initialize your wallet first.')
                return
              }

              const url = PaymentService.getOnMetaUrl({
                walletAddress,
                fiatAmount: 5000,
                fiatCurrency: 'INR',
                cryptoCurrency: 'USDC',
                chainId: 80002 // Polygon Amoy Testnet
              })

              await PaymentService.launchGateway(url)
              
              // Phase 2: Start polling for balance change
              Alert.alert('Processing', 'Your payment window has opened. Once payment is complete, tokens will arrive in your wallet.')
            } catch (err: any) {
              Alert.alert('Error', 'Failed to launch payment gateway.')
            } finally {
              setFundingPool(null)
            }
          }
        }
      ]
    )
  }

  const filteredPools = pools

  const tierColor = (tier: string) => {
    if (tier === 'AA') return '#22c55e'
    if (tier === 'A') return '#f59e0b'
    return '#ef4444'
  }

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
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.title}>Invest</Text>
              <Text style={styles.subtitle}>Browse loan pools by risk and geography</Text>
            </View>
          </View>



          {/* Risk Tier Filter */}
          <View style={styles.tierRow}>
            {tiers.map((tier) => (
              <TouchableOpacity
                key={tier.id}
                style={[styles.tierBtn, selectedTier === tier.id && styles.tierBtnActive]}
                onPress={() => setSelectedTier(tier.id)}
              >
                <Text style={styles.tierEmoji}>{tier.emoji}</Text>
                <Text style={[styles.tierLabel, selectedTier === tier.id && styles.tierLabelActive]}>
                  {tier.label}
                </Text>
                {tier.apy && (
                  <Text style={[styles.tierApy, selectedTier === tier.id && { color: tier.color }]}>
                    {tier.apy}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Geographic Filter */}
          <TouchableOpacity
            style={styles.geoFilter}
            onPress={() => setShowStateFilter(!showStateFilter)}
          >
            <Ionicons name="location-outline" size={18} color="#60a5fa" />
            <Text style={styles.geoFilterText}>{selectedState}</Text>
            <Ionicons name={showStateFilter ? "chevron-up" : "chevron-down"} size={18} color="#64748b" />
          </TouchableOpacity>

          {showStateFilter && (
            <View style={styles.stateDropdown}>
              {states.map((state) => (
                <TouchableOpacity
                  key={state}
                  style={[styles.stateItem, selectedState === state && styles.stateItemActive]}
                  onPress={() => { setSelectedState(state); setShowStateFilter(false) }}
                >
                  <Text style={[styles.stateText, selectedState === state && styles.stateTextActive]}>
                    {state}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Pool Cards */}
          <View style={styles.poolsSection}>
            <Text style={styles.resultCount}>{filteredPools.length} pools available</Text>

            {loading ? (
              [1, 2, 3].map(i => (
                <View key={i} style={styles.poolCardSkeleton}>
                  <Skeleton width="55%" height={16} />
                  <Skeleton width="40%" height={12} style={{ marginTop: 6 }} />
                  <Skeleton width="100%" height={8} radius={4} style={{ marginTop: 16 }} />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 }}>
                    <Skeleton width="28%" height={24} />
                    <Skeleton width="28%" height={24} />
                    <Skeleton width="28%" height={24} />
                  </View>
                  <Skeleton width="100%" height={44} radius={12} style={{ marginTop: 14 }} />
                </View>
              ))
            ) : (
              <>
                {filteredPools.map((pool: any) => {
                  const poolAmount = pool.amount?.inr || pool.amount || 0
                  const poolFunded = pool.funded || 0
                  const progress = poolAmount > 0 ? (poolFunded / poolAmount) * 100 : 0
                  const remaining = poolAmount - poolFunded
                  const poolName = pool.shgName || pool.shg || 'SHG Pool'

                  return (
                    <TouchableOpacity key={pool.id} style={styles.poolCard} activeOpacity={0.85}>
                      {/* Header Row */}
                      <View style={styles.poolHeader}>
                        <View>
                          <Text style={styles.poolShg}>{poolName}</Text>
                          <Text style={styles.poolLocation}>
                            📍 {pool.district}, {pool.state}
                          </Text>
                        </View>
                        <View style={[styles.tierBadge, { backgroundColor: `${tierColor(pool.tier)}20` }]}>
                          <Text style={[styles.tierBadgeText, { color: tierColor(pool.tier) }]}>
                            {pool.tier}
                          </Text>
                        </View>
                      </View>

                      {/* Purpose */}
                      <View style={styles.purposeRow}>
                        <Text style={styles.purposeLabel}>Purpose:</Text>
                        <Text style={styles.purposeValue}>{pool.purpose}</Text>
                      </View>

                      {/* Progress Bar */}
                      <View style={styles.progressContainer}>
                        <View style={styles.progressBar}>
                          <View style={[styles.progressFill, { width: `${Math.min(progress, 100)}%`, backgroundColor: tierColor(pool.tier) }]} />
                        </View>
                        <View style={styles.progressLabels}>
                          <Text style={styles.progressText}>₹{poolFunded.toLocaleString('en-IN')} funded</Text>
                          <Text style={styles.progressText}>₹{poolAmount.toLocaleString('en-IN')} target</Text>
                        </View>
                      </View>

                      {/* Stats Row */}
                      <View style={styles.poolStats}>
                        <View style={styles.poolStatItem}>
                          <Text style={styles.poolStatValue}>{pool.memberCount || pool.members || '–'}</Text>
                          <Text style={styles.poolStatLabel}>Members</Text>
                        </View>
                        <View style={styles.poolStatItem}>
                          <Text style={styles.poolStatValue}>{pool.repayRate || '–'}%</Text>
                          <Text style={styles.poolStatLabel}>Repay Rate</Text>
                        </View>
                        <View style={styles.poolStatItem}>
                          <Text style={[styles.poolStatValue, { color: tierColor(pool.tier) }]}>
                            ₹{remaining.toLocaleString('en-IN')}
                          </Text>
                          <Text style={styles.poolStatLabel}>Remaining</Text>
                        </View>
                      </View>

                      {/* Fund CTA */}
                      {remaining > 0 && (
                        <TouchableOpacity
                          style={[styles.fundBtn, fundingPool === pool.id && { opacity: 0.6 }]}
                          onPress={() => handleFundPool(pool.id, poolName)}
                          disabled={fundingPool === pool.id}
                        >
                          <Text style={styles.fundBtnText}>
                            {fundingPool === pool.id ? 'Processing...' : 'Fund This Pool →'}
                          </Text>
                        </TouchableOpacity>
                      )}
                      {remaining <= 0 && (
                        <View style={styles.fundedBadge}>
                          <Text style={styles.fundedText}>✓ Fully Funded</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  )
                })}

                {filteredPools.length === 0 && (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyEmoji}>🔍</Text>
                    <Text style={styles.emptyTitle}>No pools found</Text>
                    <Text style={styles.emptySubtitle}>Try adjusting your filters or pull to refresh</Text>
                  </View>
                )}
              </>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 100 },

  headerRow: { marginBottom: 22 },
  title: { fontSize: 28, fontWeight: '900', color: '#f1f5f9', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },

  // Tier Filter
  tierRow: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  tierBtn: {
    flex: 1, minWidth: 70,
    backgroundColor: '#1e293b', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 10,
    alignItems: 'center', borderWidth: 1, borderColor: '#334155',
  },
  tierBtnActive: { borderColor: '#3b82f6', backgroundColor: '#172554' },
  tierEmoji: { fontSize: 18, marginBottom: 4 },
  tierLabel: { fontSize: 11, fontWeight: '600', color: '#64748b', textAlign: 'center' },
  tierLabelActive: { color: '#93c5fd' },
  tierApy: { fontSize: 12, fontWeight: '800', color: '#64748b', marginTop: 2 },

  // Geo Filter
  geoFilter: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#1e293b', borderRadius: 12, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: '#334155',
  },
  geoFilterText: { flex: 1, color: '#e2e8f0', fontSize: 14, fontWeight: '600' },

  stateDropdown: {
    backgroundColor: '#1e293b', borderRadius: 12, marginBottom: 16,
    borderWidth: 1, borderColor: '#334155', overflow: 'hidden',
  },
  stateItem: { paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#334155' },
  stateItemActive: { backgroundColor: '#172554' },
  stateText: { fontSize: 14, color: '#94a3b8' },
  stateTextActive: { color: '#60a5fa', fontWeight: '700' },

  // Pools
  poolsSection: { marginTop: 8 },
  resultCount: { fontSize: 12, color: '#64748b', fontWeight: '600', marginBottom: 12 },

  poolCard: {
    backgroundColor: '#1e293b', borderRadius: 20, padding: 18, marginBottom: 14,
    borderWidth: 1, borderColor: '#334155',
  },
  poolHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  poolShg: { fontSize: 16, fontWeight: '700', color: '#e2e8f0', marginBottom: 3 },
  poolLocation: { fontSize: 12, color: '#64748b' },
  tierBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  tierBadgeText: { fontSize: 12, fontWeight: '800' },

  purposeRow: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  purposeLabel: { fontSize: 12, color: '#64748b' },
  purposeValue: { fontSize: 12, color: '#94a3b8', fontWeight: '600' },

  progressContainer: { marginBottom: 14 },
  progressBar: { height: 8, backgroundColor: '#334155', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  progressText: { fontSize: 11, color: '#64748b', fontWeight: '500' },

  poolStats: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  poolStatItem: { alignItems: 'center' },
  poolStatValue: { fontSize: 16, fontWeight: '800', color: '#e2e8f0' },
  poolStatLabel: { fontSize: 10, color: '#64748b', fontWeight: '600', marginTop: 2 },

  fundBtn: {
    backgroundColor: '#3b82f6', borderRadius: 12, padding: 14, alignItems: 'center',
  },
  fundBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  fundedBadge: {
    backgroundColor: '#dcfce720', borderRadius: 12, padding: 14, alignItems: 'center',
    borderWidth: 1, borderColor: '#22c55e30',
  },
  fundedText: { color: '#4ade80', fontSize: 14, fontWeight: '700' },

  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#e2e8f0' },
  emptySubtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },

  // Skeleton & Demo
  poolCardSkeleton: {
    backgroundColor: '#1e293b', borderRadius: 20, padding: 18, marginBottom: 14,
    borderWidth: 1, borderColor: '#334155',
  },
})
