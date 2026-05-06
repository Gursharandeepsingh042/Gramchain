import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  View, Text, ScrollView, StyleSheet, Animated, Alert, TouchableOpacity, ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { AmountInput } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { CreditScoreGauge } from '@/components/ui/CreditScoreGauge'
import { Chip, Card, Divider, TrustBadge } from '@/components/ui/SharedComponents'
import { loanApi, shgApi } from '@/services/api'
import { router } from 'expo-router'
import { colors } from '@/constants/colors'
import { radius, shadows, spacing } from '@/constants/design'

const PURPOSES = [
  { key: 'agriculture', label: '🌾 Agriculture', hindi: 'कृषि' },
  { key: 'business',    label: '🏪 Business',    hindi: 'व्यापार' },
  { key: 'education',   label: '📚 Education',   hindi: 'शिक्षा' },
  { key: 'medical',     label: '🏥 Medical',     hindi: 'चिकित्सा' },
  { key: 'other',       label: '📦 Other',       hindi: 'अन्य' },
]

const TENURES = [
  { months: 3,  label: '3 Months' },
  { months: 6,  label: '6 Months' },
  { months: 12, label: '12 Months' },
]

// Simple EMI calculator
const calcEMI = (principal: number, rate: number, months: number) => {
  if (!principal || !months) return 0
  const monthlyRate = rate / 100 / 12
  if (monthlyRate === 0) return principal / months
  return (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) /
    (Math.pow(1 + monthlyRate, months) - 1)
}

export default function BorrowScreen() {
  const { t } = useTranslation()
  const [amount, setAmount]   = useState('')
  const [tenure, setTenure]   = useState(6)
  const [purpose, setPurpose] = useState('agriculture')
  const [loading, setLoading] = useState(false)
  const [shgId, setShgId]     = useState<string | null>(null)
  const [score, setScore]     = useState<number | null>(null)
  const [scoreLoading, setScoreLoading] = useState(false)
  const [scoreCached, setScoreCached]   = useState(false)
  const [step, setStep]       = useState<1 | 2 | 3>(1)
  const [refreshing, setRefreshing]     = useState(false)

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start()
  }, [])

  // F1 FIX: Fetch real credit score from backend ML endpoint.
  // Wrapped so user can re-fetch on demand (e.g. refresh button).
  const fetchScore = useCallback(async (forceRefresh = false) => {
    if (!amount || parseInt(amount) <= 0 || !shgId) return
    setScoreLoading(true)
    setScore(null)
    try {
      const res = await loanApi.getCreditScore({
        shgId,
        amount: parseInt(amount),
        refresh: forceRefresh,
      })
      setScore(res.data?.data?.score ?? 720)
      setScoreCached(!!res.data?.data?.cached)
    } catch {
      // Fallback: if ML service is down, use a sensible default
      // so the user can still submit (score will be recalculated server-side)
      setScore(700)
      setScoreCached(false)
    } finally {
      setScoreLoading(false)
    }
  }, [amount, shgId])

  // Auto-fetch when amount/shg changes (debounced 800ms)
  useEffect(() => {
    if (amount && parseInt(amount) > 0 && shgId) {
      const timer = setTimeout(() => fetchScore(false), 800)
      return () => clearTimeout(timer)
    } else {
      setScore(null)
    }
  }, [amount, shgId, fetchScore])

  // Fetch SHG (extracted so pull-to-refresh can reuse it)
  const loadShg = useCallback(async () => {
    try {
      const res: any = await shgApi.getMyGroups()
      if (res.data?.data?.length > 0) {
        setShgId(res.data.data[0].shgId)
      }
    } catch { /* ignore network errors — caller decides UX */ }
  }, [])

  useEffect(() => { void loadShg() }, [loadShg])

  // F8: Pull-to-refresh — re-fetch SHG + force refresh credit score
  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await loadShg()
      if (amount && parseInt(amount) > 0 && shgId) {
        await fetchScore(true)
      }
    } finally {
      setRefreshing(false)
    }
  }, [loadShg, fetchScore, amount, shgId])

  const principal   = parseInt(amount) || 0
  const interestRate = 18
  const emiAmount    = calcEMI(principal, interestRate, tenure)
  const totalPayable = emiAmount * tenure
  const totalInterest = totalPayable - principal

  const handleApply = async () => {
    if (!amount || !shgId) {
      Alert.alert('Error', 'Please enter amount and ensure you are in an SHG.')
      return
    }
    setLoading(true)
    try {
      await loanApi.applyLoan({
        shgId,
        amount,
        tenureMonths: tenure,
        purpose,
      })
      Alert.alert('🎉 Success', 'Loan request submitted to your SHG leader for approval.')
      router.push('/')
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error?.message || 'Failed to apply')
    } finally {
      setLoading(false)
    }
  }

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
          {/* ── Page Header ── */}
          <View style={styles.pageHeader}>
            <Text style={styles.pageTitle}>
              {t('loan.apply', { defaultValue: 'Apply for Loan' })}
            </Text>
            <Text style={styles.pageSubtitle}>
              ऋण के लिए आवेदन करें
            </Text>
          </View>

          {/* ── Step Indicator ── */}
          <View style={styles.stepRow}>
            {[1, 2, 3].map(s => (
              <View key={s} style={styles.stepItem}>
                <View style={[
                  styles.stepDot,
                  s <= step ? styles.stepDotActive : styles.stepDotInactive,
                ]}>
                  <Text style={[
                    styles.stepNum,
                    s <= step && { color: colors.text.inverse },
                  ]}>
                    {s <= step ? (s < step ? '✓' : s) : s}
                  </Text>
                </View>
                <Text style={[
                  styles.stepLabel,
                  s <= step && styles.stepLabelActive,
                ]}>
                  {s === 1 ? 'Amount' : s === 2 ? 'Score' : 'Review'}
                </Text>
              </View>
            ))}
            {/* Connectors */}
            <View style={[styles.stepConnector, { left: '22%' }, step >= 2 && styles.stepConnectorActive]} />
            <View style={[styles.stepConnector, { left: '55%' }, step >= 3 && styles.stepConnectorActive]} />
          </View>

          {/* ── Step 1: Amount & Details ── */}
          {step >= 1 && (
            <View style={styles.section}>
              <AmountInput
                value={amount}
                onChange={setAmount}
                max={100000}
              />

              {/* Purpose chips */}
              <Text style={styles.fieldLabel}>Purpose / उद्देश्य</Text>
              <View style={styles.chipRow}>
                {PURPOSES.map(p => (
                  <Chip
                    key={p.key}
                    label={p.label}
                    selected={purpose === p.key}
                    onPress={() => setPurpose(p.key)}
                  />
                ))}
              </View>

              {/* Tenure chips */}
              <Text style={styles.fieldLabel}>Tenure / अवधि</Text>
              <View style={styles.chipRow}>
                {TENURES.map(t => (
                  <Chip
                    key={t.months}
                    label={t.label}
                    selected={tenure === t.months}
                    onPress={() => setTenure(t.months)}
                  />
                ))}
              </View>

              {amount && parseInt(amount) > 0 && step === 1 && (
                <View style={{ marginTop: 16 }}>
                  <Button
                    label="Check Eligibility →"
                    onPress={() => setStep(2)}
                    size="lg"
                  />
                </View>
              )}
            </View>
          )}

          {/* ── Step 2: Credit Score ── */}
          {step >= 2 && (
            <View style={styles.section}>
              <Divider label="AI Credit Assessment" />
              <CreditScoreGauge score={score} />

              {/* Refresh score control */}
              <View style={styles.scoreMetaRow}>
                <Text style={styles.scoreMetaText}>
                  {scoreLoading
                    ? 'Calculating your score…'
                    : scoreCached
                      ? 'Cached score · tap refresh for latest'
                      : 'Latest score'}
                </Text>
                <TouchableOpacity
                  style={styles.refreshBtn}
                  onPress={() => fetchScore(true)}
                  disabled={scoreLoading || !shgId || !amount}
                  accessibilityRole="button"
                  accessibilityLabel="Refresh credit score"
                >
                  {scoreLoading
                    ? <ActivityIndicator size="small" color={colors.primary[600]} />
                    : <Text style={styles.refreshBtnText}>↻ Refresh</Text>}
                </TouchableOpacity>
              </View>

              {step === 2 && (
                <View style={{ marginTop: 8 }}>
                  <Button
                    label="Review Loan Terms →"
                    onPress={() => setStep(3)}
                    size="lg"
                  />
                </View>
              )}
            </View>
          )}

          {/* ── Step 3: Loan Terms Review ── */}
          {step === 3 && principal > 0 && (
            <View style={styles.section}>
              <Divider label="Loan Terms Preview" />

              <View style={[styles.termsCard, shadows.sm]}>
                {/* Terms table */}
                {[
                  { label: 'Principal',       value: `₹${principal.toLocaleString('en-IN')}` },
                  { label: 'Interest Rate',   value: `${interestRate}% APR` },
                  { label: 'Tenure',          value: `${tenure} months` },
                  { label: 'Monthly EMI',     value: `₹${Math.round(emiAmount).toLocaleString('en-IN')}`, highlight: true },
                  { label: 'Total Interest',  value: `₹${Math.round(totalInterest).toLocaleString('en-IN')}` },
                  { label: 'Total Payable',   value: `₹${Math.round(totalPayable).toLocaleString('en-IN')}`, highlight: true },
                ].map((row, i) => (
                  <View
                    key={i}
                    style={[
                      styles.termsRow,
                      i < 5 && styles.termsRowBordered,
                    ]}
                  >
                    <Text style={styles.termsLabel}>{row.label}</Text>
                    <Text style={[
                      styles.termsValue,
                      row.highlight && styles.termsValueHighlight,
                    ]}>
                      {row.value}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Repayment calendar mini-visual */}
              <View style={[styles.calendarCard, shadows.xs]}>
                <Text style={styles.calendarTitle}>📅 Repayment Schedule</Text>
                <View style={styles.calendarGrid}>
                  {Array.from({ length: tenure }).map((_, i) => {
                    const date = new Date()
                    date.setMonth(date.getMonth() + i + 1)
                    const month = date.toLocaleString('en-IN', { month: 'short' })
                    return (
                      <View key={i} style={styles.calendarItem}>
                        <View style={[
                          styles.calendarDot,
                          i === 0 && { backgroundColor: colors.secondary[500] },
                        ]} />
                        <Text style={styles.calendarMonth}>{month}</Text>
                        <Text style={styles.calendarAmt}>₹{Math.round(emiAmount).toLocaleString('en-IN')}</Text>
                      </View>
                    )
                  })}
                </View>
              </View>

              {/* Submit button */}
              <View style={styles.submitSection}>
                <Button
                  label={t('loan.submitToGroup', { defaultValue: 'Submit to Group for Approval' })}
                  onPress={handleApply}
                  loading={loading}
                  disabled={!score || !amount || !shgId}
                  icon={<Text style={{ fontSize: 16 }}>🤝</Text>}
                  size="xl"
                />
                <Text style={styles.submitHint}>
                  Your SHG leader will review and approve
                </Text>
              </View>
            </View>
          )}

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

  // Page header
  pageHeader: {
    marginBottom: 20,
  },
  pageTitle: {
    fontSize:      28,
    fontWeight:    '800',
    color:         colors.text.primary,
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize:   14,
    color:      colors.text.secondary,
    marginTop:  4,
  },

  // Steps
  stepRow: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'center',
    marginBottom:    28,
    paddingHorizontal: 20,
    position:        'relative',
  },
  stepItem: {
    alignItems: 'center',
    gap:        6,
    zIndex:     2,
  },
  stepDot: {
    width:          32,
    height:         32,
    borderRadius:   16,
    alignItems:     'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    backgroundColor: colors.primary[600],
    ...shadows.green,
  },
  stepDotInactive: {
    backgroundColor: colors.gray[100],
    borderWidth:     1.5,
    borderColor:     colors.gray[200],
  },
  stepNum: {
    fontSize:   13,
    fontWeight: '700',
    color:      colors.gray[500],
  },
  stepLabel: {
    fontSize:   11,
    fontWeight: '600',
    color:      colors.gray[400],
  },
  stepLabelActive: {
    color: colors.primary[700],
  },
  stepConnector: {
    position:        'absolute',
    top:             16,
    height:          2,
    width:           '22%',
    backgroundColor: colors.gray[200],
    zIndex:          1,
  },
  stepConnectorActive: {
    backgroundColor: colors.primary[400],
  },

  // Sections
  section: {
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize:      13,
    fontWeight:    '700',
    color:         colors.text.secondary,
    marginBottom:  10,
    marginTop:     16,
    letterSpacing: 0.2,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           8,
  },

  // Terms card
  termsCard: {
    backgroundColor: colors.surface,
    borderRadius:    radius.lg,
    padding:         16,
    borderWidth:     1,
    borderColor:     colors.gray[100],
    marginBottom:    16,
  },
  termsRow: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'center',
    paddingVertical: 11,
  },
  termsRowBordered: {
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  termsLabel: {
    fontSize:   14,
    color:      colors.text.secondary,
    fontWeight: '500',
  },
  termsValue: {
    fontSize:   14,
    color:      colors.text.primary,
    fontWeight: '700',
  },
  termsValueHighlight: {
    color:    colors.primary[700],
    fontSize: 16,
  },

  // Calendar
  calendarCard: {
    backgroundColor: colors.surface,
    borderRadius:    radius.lg,
    padding:         16,
    borderWidth:     1,
    borderColor:     colors.gray[100],
    marginBottom:    24,
  },
  calendarTitle: {
    fontSize:   14,
    fontWeight: '700',
    color:      colors.text.primary,
    marginBottom: 12,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           8,
  },
  calendarItem: {
    alignItems:      'center',
    width:           60,
    paddingVertical: 8,
    backgroundColor: colors.gray[50],
    borderRadius:    radius.sm,
    gap:             3,
  },
  calendarDot: {
    width:           6,
    height:          6,
    borderRadius:    3,
    backgroundColor: colors.primary[400],
  },
  calendarMonth: {
    fontSize:   11,
    fontWeight: '600',
    color:      colors.text.secondary,
  },
  calendarAmt: {
    fontSize:   10,
    fontWeight: '700',
    color:      colors.text.primary,
  },

  // Submit
  submitSection: {
    gap: 10,
  },
  submitHint: {
    fontSize:   12,
    color:      colors.text.tertiary,
    textAlign:  'center',
  },

  // Footer
  footerSection: {
    alignItems:      'center',
    paddingVertical: 20,
  },

  // Refresh score
  scoreMetaRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginTop:      8,
    paddingHorizontal: 4,
  },
  scoreMetaText: {
    fontSize: 12,
    color:    colors.text.tertiary,
    flex:     1,
  },
  refreshBtn: {
    paddingVertical:   6,
    paddingHorizontal: 12,
    borderRadius:      radius.sm,
    backgroundColor:   colors.gray[100],
    minWidth:          80,
    alignItems:        'center',
  },
  refreshBtnText: {
    fontSize:   12,
    fontWeight: '700',
    color:      colors.primary[700],
  },
})
