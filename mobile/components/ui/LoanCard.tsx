import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native'
import { useTranslation } from 'react-i18next'
import { colors } from '@/constants/colors'
import { radius, shadows, spacing } from '@/constants/design'
import type { Loan } from '@/types'

interface Props {
  loan:    Loan
  onRepay: (id: string) => void
}

const STATUS_CONFIG = {
  ACTIVE: {
    label: 'Active',
    bg:    colors.status.active.bg,
    text:  colors.status.active.text,
    dot:   colors.status.active.dot,
  },
  PENDING: {
    label: 'Pending',
    bg:    colors.status.pending.bg,
    text:  colors.status.pending.text,
    dot:   colors.status.pending.dot,
  },
  APPROVED: {
    label: 'Approved',
    bg:    colors.status.approved.bg,
    text:  colors.status.approved.text,
    dot:   colors.status.approved.dot,
  },
  REJECTED: {
    label: 'Rejected',
    bg:    colors.status.rejected.bg,
    text:  colors.status.rejected.text,
    dot:   colors.status.rejected.dot,
  },
  CLOSED: {
    label: 'Closed',
    bg:    colors.status.closed.bg,
    text:  colors.status.closed.text,
    dot:   colors.status.closed.dot,
  },
}

export const LoanCard = ({ loan, onRepay }: Props) => {
  const { t } = useTranslation()
  const statusCfg = STATUS_CONFIG[loan.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.PENDING

  const d             = new Date(loan.nextEmiDue || '')
  const formattedDate = loan.nextEmiDue
    ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  // Progress for repayment (derived from tenure; actual paid count not in type)
  const paidInstallments  = (loan as any).paidInstallments  ?? 0
  const totalInstallments = (loan as any).totalInstallments ?? loan.tenureMonths ?? 12
  const progressRatio     = totalInstallments > 0 ? paidInstallments / totalInstallments : 0

  return (
    <View style={[styles.card, shadows.md]}>
      {/* ── Header Row ── */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.amountLabel}>ऋण राशि</Text>
          <Text style={styles.amount}>
            ₹{loan.amount.toLocaleString('en-IN')}
          </Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: statusCfg.bg }]}>
          <View style={[styles.statusDot, { backgroundColor: statusCfg.dot }]} />
          <Text style={[styles.statusText, { color: statusCfg.text }]}>
            {t(`loan.status.${loan.status}`, { defaultValue: statusCfg.label })}
          </Text>
        </View>
      </View>

      {/* ── Loan Meta Row ── */}
      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>ब्याज दर</Text>
          <Text style={styles.metaValue}>{(loan.interestRateBps ?? 1800) / 100}% APR</Text>
        </View>
        <View style={styles.metaDivider} />
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>अवधि</Text>
          <Text style={styles.metaValue}>{loan.tenureMonths ?? 12} months</Text>
        </View>
        <View style={styles.metaDivider} />
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>EMI</Text>
          <Text style={[styles.metaValue, { color: colors.primary[700] }]}>
            ₹{(loan.emiAmount ?? 0).toLocaleString('en-IN')}
          </Text>
        </View>
      </View>

      {/* ── Progress Bar (ACTIVE loans) ── */}
      {loan.status === 'ACTIVE' && (
        <View style={styles.progressSection}>
          <View style={styles.progressLabelRow}>
            <Text style={styles.progressLabel}>Repayment Progress</Text>
            <Text style={styles.progressLabel}>{paidInstallments}/{totalInstallments} EMIs</Text>
          </View>
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${progressRatio * 100}%` as any }]} />
          </View>
        </View>
      )}

      {/* ── Next EMI Due ── */}
      {loan.status === 'ACTIVE' && formattedDate && (
        <View style={styles.emiDueBox}>
          <View style={styles.emiDueDot} />
          <Text style={styles.emiDueText}>
            {t('dashboard.dueDate', { date: formattedDate, defaultValue: `Due: ${formattedDate}` })}
          </Text>
        </View>
      )}

      {/* ── Waiting Message (APPROVED) ── */}
      {loan.status === 'APPROVED' && (
        <View style={styles.pendingRow}>
          <Text style={styles.pendingIcon}>⛓</Text>
          <Text style={styles.pendingText}>
            Awaiting on-chain disbursement…
          </Text>
        </View>
      )}

      {/* ── Pay Now CTA ── */}
      {loan.status === 'ACTIVE' && loan.emiAmount && (
        <TouchableOpacity
          style={styles.payButton}
          onPress={() => onRepay(loan.id)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`Pay EMI of ₹${loan.emiAmount.toLocaleString('en-IN')} due on ${formattedDate}`}
          accessibilityHint="Triggers blockchain payment transaction"
        >
          <Text style={styles.payButtonText}>
            {t('dashboard.payNow', { defaultValue: 'Pay EMI Now' })}  →
          </Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius:    radius.card,
    padding:         spacing[5],
    marginBottom:    spacing[4],
    borderWidth:     1,
    borderColor:     colors.gray[100],
  },

  // Header
  headerRow: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'flex-start',
    marginBottom:    spacing[4],
  },
  amountLabel: {
    fontSize:    11,
    color:       colors.gray[500],
    fontWeight:  '600',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  amount: {
    fontSize:   28,
    fontWeight: '800',
    color:      colors.text.primary,
    letterSpacing: -0.5,
  },

  // Status Pill
  statusPill: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius:   radius.pill,
    gap:            6,
  },
  statusDot: {
    width:        7,
    height:       7,
    borderRadius: 4,
  },
  statusText: {
    fontSize:   12,
    fontWeight: '700',
  },

  // Meta row
  metaRow: {
    flexDirection:    'row',
    alignItems:       'center',
    backgroundColor:  colors.gray[50],
    borderRadius:     radius.md,
    padding:          spacing[3],
    marginBottom:     spacing[4],
  },
  metaItem: {
    flex:       1,
    alignItems: 'center',
  },
  metaLabel: {
    fontSize:    10,
    color:       colors.gray[500],
    fontWeight:  '600',
    letterSpacing: 0.3,
    marginBottom: 3,
  },
  metaValue: {
    fontSize:   14,
    fontWeight: '700',
    color:      colors.text.primary,
  },
  metaDivider: {
    width:           1,
    height:          28,
    backgroundColor: colors.gray[200],
  },

  // Progress
  progressSection: {
    marginBottom: spacing[3],
  },
  progressLabelRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    marginBottom:   6,
  },
  progressLabel: {
    fontSize:  11,
    color:     colors.gray[500],
    fontWeight: '500',
  },
  progressBg: {
    height:          8,
    backgroundColor: colors.gray[100],
    borderRadius:    radius.full,
    overflow:        'hidden',
  },
  progressFill: {
    height:          8,
    backgroundColor: colors.primary[500],
    borderRadius:    radius.full,
  },

  // EMI Due
  emiDueBox: {
    flexDirection:  'row',
    alignItems:     'center',
    marginBottom:   spacing[4],
    gap:            6,
  },
  emiDueDot: {
    width:           8,
    height:          8,
    borderRadius:    4,
    backgroundColor: colors.secondary[500],
  },
  emiDueText: {
    fontSize:  13,
    color:     colors.text.secondary,
    fontWeight: '500',
  },

  // Pending row
  pendingRow: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            8,
    padding:        spacing[3],
    backgroundColor: colors.info[50],
    borderRadius:   radius.md,
    marginBottom:   spacing[3],
  },
  pendingIcon: {
    fontSize: 14,
  },
  pendingText: {
    fontSize:  13,
    color:     colors.info[600],
    fontWeight: '500',
    flex:      1,
  },

  // Pay Button
  payButton: {
    backgroundColor: colors.primary[600],
    borderRadius:    radius.button,
    paddingVertical: 15,
    alignItems:      'center',
    ...shadows.green,
  },
  payButtonText: {
    color:       colors.text.inverse,
    fontSize:    16,
    fontWeight:  '700',
    letterSpacing: 0.2,
  },
})
