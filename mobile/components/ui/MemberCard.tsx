import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { colors } from '@/constants/colors'
import { radius, shadows, spacing } from '@/constants/design'

interface MemberProps {
  member: {
    userId:  string
    role:    string
    phone?:  string
    name?:   string
    user?:   { phone: string; name?: string; kycStatus?: string }
  }
  showApproval?:   boolean
  approvalStatus?: 'approved' | 'pending' | 'rejected'
}

const ROLE_CONFIG: Record<string, { label: string; bg: string; text: string; icon: string }> = {
  LEADER:  { label: 'Leader',   bg: colors.primary[100],   text: colors.primary[700], icon: '👑' },
  MEMBER:  { label: 'Member',   bg: colors.gray[100],      text: colors.gray[600],    icon: '👤' },
  ADMIN:   { label: 'Admin',    bg: colors.info[100],      text: colors.info[600],     icon: '⚙️' },
}

const APPROVAL_ICON: Record<string, string> = {
  approved: '✅',
  pending:  '⏳',
  rejected: '❌',
}

export const MemberCard = ({ member, showApproval, approvalStatus }: MemberProps) => {
  const name  = member.user?.name || member.name || 'Member'
  const phone = member.user?.phone || member.phone || ''
  const role  = ROLE_CONFIG[member.role] || ROLE_CONFIG.MEMBER
  const kyc   = member.user?.kycStatus

  // Generate avatar initials
  const initials = name
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  // Avatar bg color based on name hash
  const hash = name.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  const avatarColors = [
    colors.primary[400], colors.info[400], colors.secondary[500],
    colors.danger[400], '#8b5cf6', '#ec4899',
  ]
  const avatarBg = avatarColors[hash % avatarColors.length]

  return (
    <View style={[styles.card, shadows.xs]}>
      {/* Avatar */}
      <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          {/* Role badge */}
          <View style={[styles.roleBadge, { backgroundColor: role.bg }]}>
            <Text style={styles.roleIcon}>{role.icon}</Text>
            <Text style={[styles.roleText, { color: role.text }]}>{role.label}</Text>
          </View>
        </View>

        {phone ? (
          <Text style={styles.phone}>📞 +91 {phone}</Text>
        ) : null}

        {/* KYC Status */}
        <View style={styles.metaRow}>
          {kyc && (
            <View style={[
              styles.kycBadge,
              { backgroundColor: kyc === 'VERIFIED' ? colors.primary[50] : colors.secondary[50] },
            ]}>
              <Text style={styles.kycIcon}>
                {kyc === 'VERIFIED' ? '✓' : '⏳'}
              </Text>
              <Text style={[
                styles.kycText,
                { color: kyc === 'VERIFIED' ? colors.primary[700] : colors.secondary[700] },
              ]}>
                {kyc === 'VERIFIED' ? 'KYC Verified' : 'KYC Pending'}
              </Text>
            </View>
          )}

          {/* Approval status (for loan approvals) */}
          {showApproval && approvalStatus && (
            <Text style={styles.approvalIcon}>
              {APPROVAL_ICON[approvalStatus]}
            </Text>
          )}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   colors.surface,
    borderRadius:      radius.lg,
    padding:           14,
    marginBottom:      10,
    borderWidth:       1,
    borderColor:       colors.gray[100],
    gap:               14,
  },

  // Avatar
  avatar: {
    width:           48,
    height:          48,
    borderRadius:    16,
    alignItems:      'center',
    justifyContent:  'center',
  },
  avatarText: {
    fontSize:   17,
    fontWeight: '800',
    color:      colors.text.inverse,
    letterSpacing: 0.5,
  },

  // Content
  content: {
    flex: 1,
  },
  nameRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   3,
  },
  name: {
    fontSize:   15,
    fontWeight: '700',
    color:      colors.text.primary,
    flex:       1,
    marginRight: 8,
  },
  phone: {
    fontSize:   12,
    color:      colors.text.secondary,
    marginBottom: 4,
  },

  // Role badge
  roleBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               3,
    paddingVertical:   3,
    paddingHorizontal: 8,
    borderRadius:      radius.pill,
  },
  roleIcon: {
    fontSize: 10,
  },
  roleText: {
    fontSize:   10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // Meta
  metaRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  kycBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    paddingVertical:   2,
    paddingHorizontal: 8,
    borderRadius:      radius.pill,
  },
  kycIcon: {
    fontSize:   10,
    fontWeight: '700',
  },
  kycText: {
    fontSize:   10,
    fontWeight: '600',
  },
  approvalIcon: {
    fontSize: 16,
  },
})
