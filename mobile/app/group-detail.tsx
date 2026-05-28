import React, { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { shgApi, fundingApi } from '@/services/api'
import { Card, Badge, Divider, TrustBadge } from '@/components/ui/SharedComponents'
import { MemberCard } from '@/components/ui/MemberCard'
import { colors } from '@/constants/colors'
import { radius, shadows, spacing } from '@/constants/design'

export default function GroupDetailScreen() {
  const { shgId } = useLocalSearchParams()
  const [shg, setShg] = useState<any>(null)
  const [fundingRequests, setFundingRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadGroup()
    loadFundingRequests()
  }, [shgId])

  const loadGroup = async () => {
    try {
      const res = await shgApi.getMyGroups()
      const foundGroup = res.data.data.find((g: any) => g.shgId === shgId)
      if (foundGroup?.shg) {
        setShg(foundGroup.shg)
        if (foundGroup.shg.fundingRequests) {
          setFundingRequests(foundGroup.shg.fundingRequests)
        } else {
          loadFundingRequests()
        }
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const loadFundingRequests = async () => {
    try {
      const res = await fundingApi.getMyFundingRequests()
      const groupRequests = res.data.data.filter((req: any) => req.shgId === shgId)
      setFundingRequests(groupRequests)
    } catch (e) {
      console.error(e)
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[600]} />
        </View>
      </SafeAreaView>
    )
  }

  if (!shg) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Group not found</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  const members = shg.members || []
  const loans = shg.loans || []
  const pendingLoans = loans.filter((l: any) => l.status === 'PENDING')
  const activeLoans = loans.filter((l: any) => ['ACTIVE', 'APPROVED'].includes(l.status))
  const repaidLoans = loans.filter((l: any) => l.status === 'REPAID')
  const totalFund = shg.poolBalance || 0
  const lenders = shg.lenders || []
  const poolTxns = shg.poolTransactions || []
  const activeFundingRequests = fundingRequests.filter((req: any) => ['FULLY_FUNDED', 'DISBURSED', 'ACTIVE'].includes(req.status))

  // Compute funds received (from lenders) vs lent (to members)
  const fundsReceived = activeFundingRequests.reduce((sum: number, req: any) => {
    return sum + (req.totalFunded || 0)
  }, 0)
  const fundsLent = loans.reduce((sum: number, loan: any) => {
    return sum + (loan.amount || 0)
  }, 0)

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBack}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Group Details</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Group Info Card */}
        <Card style={styles.infoCard}>
          <View style={styles.groupHeader}>
            <View style={styles.groupLogo}>
              <Text style={styles.groupLogoText}>{shg.name?.charAt(0)?.toUpperCase() || 'S'}</Text>
            </View>
            <View style={styles.groupInfo}>
              <Text style={styles.groupName}>{shg.name}</Text>
              <Text style={styles.groupLocation}>
                📍 {shg.district}{shg.state ? `, ${shg.state}` : ''}
              </Text>
            </View>
          </View>
          <Divider />
          <View style={styles.inviteRow}>
            <Text style={styles.inviteLabel}>Invite Code</Text>
            <Text style={styles.inviteCode}>{shg.inviteCode || 'N/A'}</Text>
          </View>
        </Card>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>₹{totalFund.toLocaleString('en-IN')}</Text>
            <Text style={styles.statLabel}>Total Fund</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{members.length}</Text>
            <Text style={styles.statLabel}>Members</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{pendingLoans.length}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{lenders.length}</Text>
            <Text style={styles.statLabel}>Lenders</Text>
          </View>
        </View>

        {/* Funds Received vs Lent */}
        <Card style={styles.fundsCard}>
          <Text style={styles.fundsTitle}>💰 Fund Flow</Text>
          <View style={styles.fundsRow}>
            <View style={styles.fundsBox}>
              <Text style={styles.fundsLabel}>Received (Lenders)</Text>
              <Text style={styles.fundsValueReceived}>+₹{fundsReceived.toLocaleString('en-IN')}</Text>
            </View>
            <View style={styles.fundsDivider} />
            <View style={styles.fundsBox}>
              <Text style={styles.fundsLabel}>Lent (Members)</Text>
              <Text style={styles.fundsValueLent}>-₹{fundsLent.toLocaleString('en-IN')}</Text>
            </View>
          </View>
          <View style={styles.fundsBalanceRow}>
            <Text style={styles.fundsBalanceLabel}>Available Pool</Text>
            <Text style={styles.fundsBalanceValue}>₹{(totalFund - fundsLent).toLocaleString('en-IN')}</Text>
          </View>
        </Card>

        {/* Lenders Section */}
        {lenders.length > 0 && (
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>💰 Lenders ({lenders.length})</Text>
            <Divider />
            {lenders.map((lender: any) => (
              <View key={lender.id} style={styles.lenderItem}>
                <View style={styles.lenderHeader}>
                  <Text style={styles.lenderName}>{lender.name || 'Lender'}</Text>
                  <Text style={styles.lenderAmount}>
                    ₹{Number(lender.amount || 0).toLocaleString('en-IN')}
                  </Text>
                </View>
                <Text style={styles.lenderMeta}>
                  Invested on {new Date(lender.investedAt).toLocaleDateString('en-IN')}
                </Text>
              </View>
            ))}
          </Card>
        )}

        {/* Funding Requests / External Loans */}
        {activeFundingRequests.length > 0 && (
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>🏦 External Loans ({activeFundingRequests.length})</Text>
            <Divider />
            {activeFundingRequests.map((req: any) => {
              const totalFunded = req.totalFunded || 0
              const progress = req.amount > 0 ? (totalFunded / Number(req.amount)) * 100 : 0
              return (
                <View key={req.id} style={styles.loanItem}>
                  <View style={styles.loanHeader}>
                    <Text style={styles.loanMember}>{req.purpose || 'Loan'}</Text>
                    <Badge 
                      label={req.status} 
                      variant={req.status === 'DISBURSED' ? 'success' : 'info'} 
                      size="sm" 
                    />
                  </View>
                  <Text style={styles.loanAmount}>
                    ₹{Number(req.amount).toLocaleString('en-IN')}
                  </Text>
                  <View style={styles.fundingProgress}>
                    <View style={styles.progressBar}>
                      <View style={[styles.progressFill, { width: `${Math.min(progress, 100)}%` }]} />
                    </View>
                    <Text style={styles.progressText}>
                      ₹{totalFunded.toLocaleString('en-IN')} / ₹{Number(req.amount).toLocaleString('en-IN')} funded
                    </Text>
                  </View>
                  <View style={styles.loanMetaRow}>
                    <Text style={styles.loanMeta}>
                      Duration: {req.durationMonths} months
                    </Text>
                    <Text style={styles.loanMeta}>
                      {req.investorCount || 0} investors
                    </Text>
                  </View>
                  {req.disbursedAt && (
                    <Text style={styles.disbursedText}>
                      Disbursed: {new Date(req.disbursedAt).toLocaleDateString('en-IN')}
                    </Text>
                  )}
                  <TouchableOpacity
                    style={styles.viewDocBtn}
                    onPress={() => router.push({ pathname: '/transaction-receipt' as any, params: { fundingRequestId: req.id } })}
                  >
                    <Ionicons name="document-text-outline" size={16} color={colors.primary[600]} />
                    <Text style={styles.viewDocBtnText}>View Loan Document</Text>
                  </TouchableOpacity>
                </View>
              )
            })}
          </Card>
        )}

        {/* Pending Approvals */}
        {pendingLoans.length > 0 && (
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>⚡ Pending Approvals</Text>
            {pendingLoans.map((loan: any) => (
              <View key={loan.id} style={styles.loanItem}>
                <View style={styles.loanHeader}>
                  <Text style={styles.loanMember}>{loan.member?.user?.name || 'Member'}</Text>
                  <Badge label="New" variant="warning" size="sm" />
                </View>
                <Text style={styles.loanAmount}>
                  ₹{Number(loan.amount).toLocaleString('en-IN')} for {loan.purpose || 'general purposes'}
                </Text>
              </View>
            ))}
          </Card>
        )}

        {/* Members Section */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>👥 Members ({members.length})</Text>
          <Divider />
          {members.map((m: any) => (
            <View key={m.userId} style={styles.memberRow}>
              <MemberCard member={m} />
            </View>
          ))}
        </Card>

        {/* Active Loans */}
        {activeLoans.length > 0 && (
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>💸 Active Loans ({activeLoans.length})</Text>
            <Divider />
            {activeLoans.map((loan: any) => (
              <View key={loan.id} style={styles.loanItem}>
                <View style={styles.loanHeader}>
                  <Text style={styles.loanMember}>{loan.member?.user?.name || 'Member'}</Text>
                  <Badge label="Active" variant="success" size="sm" />
                </View>
                <Text style={styles.loanAmount}>
                  ₹{Number(loan.amount).toLocaleString('en-IN')}
                </Text>
                <Text style={styles.loanMeta}>
                  EMI: ₹{Math.round(loan.emiAmount || 0).toLocaleString('en-IN')} · {loan.tenureMonths} months
                </Text>
              </View>
            ))}
          </Card>
        )}

        {/* Pool Transactions */}
        {poolTxns.length > 0 && (
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>📒 Pool Transactions ({poolTxns.length})</Text>
            <Divider />
            {poolTxns.map((txn: any) => {
              const amt = txn.amountPaise / 100
              const isCredit = txn.amountPaise > 0
              const typeLabel = txn.type === 'LENDER_DEPOSIT' ? '🏦 Lender Deposit'
                : txn.type === 'LOAN_DISBURSAL' ? '💸 Loan Disbursed'
                : txn.type === 'EMI_RECEIVED' ? '✅ EMI Received'
                : txn.type === 'INTEREST_ACCRUED' ? '📈 Interest'
                : txn.type
              return (
                <View key={txn.id} style={styles.txnItem}>
                  <View style={styles.txnLeft}>
                    <Text style={styles.txnType}>{typeLabel}</Text>
                    <Text style={styles.txnDate}>{new Date(txn.createdAt).toLocaleDateString('en-IN')}</Text>
                    {txn.ref && <Text style={styles.txnRef} numberOfLines={1}>Ref: {txn.ref}</Text>}
                  </View>
                  <Text style={[styles.txnAmount, { color: isCredit ? '#16a34a' : '#dc2626' }]}>
                    {isCredit ? '+' : '-'}₹{Math.abs(amt).toLocaleString('en-IN')}
                  </Text>
                </View>
              )
            })}
          </Card>
        )}

        {/* Blockchain Info */}
        {shg.poolContractAddress && (
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>🔗 Blockchain Info</Text>
            <Divider />
            <View style={styles.blockchainRow}>
              <Text style={styles.blockchainLabel}>Pool Address</Text>
              <Text style={styles.blockchainHash} numberOfLines={1}>
                {shg.poolContractAddress}
              </Text>
            </View>
          </Card>
        )}

        <View style={styles.footerSection}>
          <TrustBadge />
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
    padding: spacing.screenPadding,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: colors.text.secondary,
    marginBottom: 20,
  },
  backBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.primary[600],
    borderRadius: 10,
  },
  backBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerBack: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text.primary,
  },
  infoCard: {
    marginBottom: 20,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  groupLogo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  groupLogoText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 4,
  },
  groupLocation: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  inviteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
  },
  inviteLabel: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  inviteCode: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary[700],
    fontFamily: 'monospace',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.gray[100],
    ...shadows.sm,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  sectionCard: {
    marginBottom: 20,
  },
  fundsCard: {
    marginBottom: 20,
    padding: 16,
  },
  fundsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 12,
  },
  fundsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fundsBox: {
    flex: 1,
  },
  fundsLabel: {
    fontSize: 12,
    color: colors.text.secondary,
    marginBottom: 4,
  },
  fundsValueReceived: {
    fontSize: 18,
    fontWeight: '800',
    color: '#16a34a',
  },
  fundsValueLent: {
    fontSize: 18,
    fontWeight: '800',
    color: '#dc2626',
  },
  fundsDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.gray[200],
    marginHorizontal: 16,
  },
  fundsBalanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.gray[100],
  },
  fundsBalanceLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  fundsBalanceValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary[700],
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 12,
  },
  loanItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  loanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  loanMember: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  loanAmount: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 2,
  },
  loanMeta: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  memberRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  blockchainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  blockchainLabel: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  blockchainHash: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary[700],
    fontFamily: 'monospace',
    maxWidth: 200,
  },
  lenderItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  lenderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  lenderName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  lenderAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary[700],
  },
  lenderMeta: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  fundingProgress: {
    marginVertical: 8,
  },
  progressBar: {
    height: 6,
    backgroundColor: colors.gray[200],
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary[600],
    borderRadius: 3,
  },
  progressText: {
    fontSize: 11,
    color: colors.text.tertiary,
  },
  loanMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  disbursedText: {
    fontSize: 12,
    color: colors.primary[700],
    marginTop: 4,
    fontWeight: '600',
  },
  viewDocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.primary[50],
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  viewDocBtnText: {
    fontSize: 13,
    color: colors.primary[700],
    fontWeight: '600',
  },
  txnItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  txnLeft: {
    flex: 1,
    paddingRight: 8,
  },
  txnType: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
  },
  txnDate: {
    fontSize: 11,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  txnRef: {
    fontSize: 10,
    color: colors.text.tertiary,
    marginTop: 1,
    fontFamily: 'monospace',
  },
  txnAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  footerSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
})
