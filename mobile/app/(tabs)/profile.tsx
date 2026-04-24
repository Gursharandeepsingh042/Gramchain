import React, { useRef, useEffect } from 'react'
import {
  View, Text, Switch, StyleSheet, ScrollView, TouchableOpacity,
  Animated, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Card, Badge, Divider, TrustBadge } from '@/components/ui/SharedComponents'
import { useAuthStore } from '@/store/auth.store'
import { clearWallet } from '@/services/wallet'
import { router } from 'expo-router'
import { colors } from '@/constants/colors'
import { radius, shadows, spacing } from '@/constants/design'

interface SettingRowProps {
  icon:       string
  label:      string
  value?:     string
  onPress?:   () => void
  trailing?:  React.ReactNode
  danger?:    boolean
}

const SettingRow = ({ icon, label, value, onPress, trailing, danger }: SettingRowProps) => (
  <TouchableOpacity
    style={styles.settingRow}
    onPress={onPress}
    activeOpacity={onPress ? 0.7 : 1}
    disabled={!onPress && !trailing}
  >
    <View style={[styles.settingIcon, danger && { backgroundColor: colors.danger[50] }]}>
      <Text style={styles.settingEmoji}>{icon}</Text>
    </View>
    <View style={styles.settingContent}>
      <Text style={[styles.settingLabel, danger && { color: colors.danger[600] }]}>{label}</Text>
      {value && <Text style={styles.settingValue}>{value}</Text>}
    </View>
    {trailing || (
      onPress && <Text style={styles.settingChevron}>›</Text>
    )}
  </TouchableOpacity>
)

export default function ProfileScreen() {
  const { t, i18n } = useTranslation()
  const { user, logout } = useAuthStore()

  // Animation
  const fadeAnim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start()
  }, [])

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            logout()
            await clearWallet()
            router.replace('/welcome')
          },
        },
      ]
    )
  }

  const toggleLang = (val: boolean) => {
    i18n.changeLanguage(val ? 'en' : 'hi')
  }

  const isVerified = user?.kycStatus === 'VERIFIED'

  // Avatar initials
  const name     = user?.name || user?.phone || 'U'
  const initials = name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          {/* ── Profile Header ── */}
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              <View style={[styles.avatar, shadows.green]}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              {isVerified && (
                <View style={styles.verifiedBadge}>
                  <Text style={styles.verifiedIcon}>✓</Text>
                </View>
              )}
            </View>

            <Text style={styles.userName}>{user?.name || 'GramChain User'}</Text>
            <Text style={styles.userPhone}>📞 +91 {user?.phone || '—'}</Text>

            <View style={styles.badgeRow}>
              <Badge
                label={isVerified ? 'KYC Verified' : 'KYC Pending'}
                variant={isVerified ? 'success' : 'warning'}
              />
            </View>
          </View>

          {/* ── Wallet Section ── */}
          <View style={[styles.walletCard, shadows.sm]}>
            <View style={styles.walletHeader}>
              <Text style={styles.walletIcon}>⛓</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.walletTitle}>Blockchain Wallet</Text>
                <Text style={styles.walletAddress} numberOfLines={1}>
                  {user?.walletAddress ? `${user.walletAddress.substring(0, 6)}...${user.walletAddress.substring(38)} (Polygon)` : 'Not Connected'}
                </Text>
              </View>
              {user?.walletAddress ? (
                <Badge label="Connected" variant="success" size="sm" />
              ) : (
                <Badge label="Pending" variant="neutral" size="sm" />
              )}
            </View>
          </View>

          {/* ── Settings Groups ── */}
          <Text style={styles.groupTitle}>Account</Text>
          <View style={[styles.settingsGroup, shadows.xs]}>
            <SettingRow
              icon="📞"
              label="Phone Number"
              value={`+91 ${user?.phone || '—'}`}
            />
            <View style={styles.rowDivider} />
            <SettingRow
              icon="🪪"
              label="KYC Status"
              value={isVerified ? 'Verified ✓' : 'Pending'}
              onPress={!isVerified ? () => router.push('/kyc') : undefined}
            />
            <View style={styles.rowDivider} />
            <SettingRow
              icon="🏦"
              label="Bank Account"
              value="Linked"
              onPress={() => {}}
            />
          </View>

          <Text style={styles.groupTitle}>Preferences</Text>
          <View style={[styles.settingsGroup, shadows.xs]}>
            <SettingRow
              icon="🌐"
              label="Language / भाषा"
              trailing={
                <View style={styles.langToggle}>
                  <Text style={styles.langLabel}>
                    {i18n.language === 'en' ? 'English' : 'हिंदी'}
                  </Text>
                  <Switch
                    value={i18n.language === 'en'}
                    onValueChange={toggleLang}
                    trackColor={{ false: colors.gray[300], true: colors.primary[400] }}
                    thumbColor={colors.surface}
                    style={{ transform: [{ scale: 0.85 }] }}
                  />
                </View>
              }
            />
            <View style={styles.rowDivider} />
            <SettingRow
              icon="🔔"
              label="Notifications"
              value="Enabled"
              onPress={() => {}}
            />
            <View style={styles.rowDivider} />
            <SettingRow
              icon="🔒"
              label="Biometric Lock"
              value="Off"
              onPress={() => {}}
            />
          </View>

          <Text style={styles.groupTitle}>Support</Text>
          <View style={[styles.settingsGroup, shadows.xs]}>
            <SettingRow
              icon="❓"
              label="Help & FAQ"
              onPress={() => {}}
            />
            <View style={styles.rowDivider} />
            <SettingRow
              icon="📄"
              label="Terms & Conditions"
              onPress={() => {}}
            />
            <View style={styles.rowDivider} />
            <SettingRow
              icon="🐛"
              label="Report a Bug"
              onPress={() => {}}
            />
          </View>

          {/* ── Logout ── */}
          <View style={styles.logoutSection}>
            <Button
              variant="danger"
              label={t('profile.logout', { defaultValue: 'Logout' })}
              onPress={handleLogout}
              size="lg"
              icon={<Text style={{ fontSize: 16 }}>🚪</Text>}
            />
          </View>

          {/* ── Footer ── */}
          <View style={styles.footer}>
            <TrustBadge />
            <Text style={styles.version}>GramChain v1.0.0</Text>
            <Text style={styles.buildInfo}>Build 2026.04.08 — Polygon Mainnet</Text>
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

  // ── Profile Header ──
  profileHeader: {
    alignItems:    'center',
    paddingTop:    16,
    marginBottom:  24,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 14,
  },
  avatar: {
    width:           80,
    height:          80,
    borderRadius:    28,
    backgroundColor: colors.primary[600],
    alignItems:      'center',
    justifyContent:  'center',
  },
  avatarText: {
    fontSize:   30,
    fontWeight: '900',
    color:      colors.text.inverse,
  },
  verifiedBadge: {
    position:        'absolute',
    bottom:          -2,
    right:           -2,
    width:           26,
    height:          26,
    borderRadius:    13,
    backgroundColor: colors.primary[500],
    borderWidth:     3,
    borderColor:     colors.background,
    alignItems:      'center',
    justifyContent:  'center',
  },
  verifiedIcon: {
    color:      colors.text.inverse,
    fontSize:   12,
    fontWeight: '800',
  },
  userName: {
    fontSize:      22,
    fontWeight:    '800',
    color:         colors.text.primary,
    letterSpacing: -0.3,
    marginBottom:  4,
  },
  userPhone: {
    fontSize:   14,
    color:      colors.text.secondary,
    marginBottom: 10,
  },
  badgeRow: {
    flexDirection: 'row',
    gap:           8,
  },

  // ── Wallet Card ──
  walletCard: {
    backgroundColor: colors.surface,
    borderRadius:    radius.lg,
    padding:         16,
    borderWidth:     1,
    borderColor:     colors.gray[100],
    marginBottom:    24,
  },
  walletHeader: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           12,
  },
  walletIcon: {
    fontSize: 22,
  },
  walletTitle: {
    fontSize:   14,
    fontWeight: '700',
    color:      colors.text.primary,
  },
  walletAddress: {
    fontSize:   12,
    color:      colors.text.secondary,
    fontFamily: 'monospace',
    marginTop:  2,
  },

  // ── Settings Groups ──
  groupTitle: {
    fontSize:      11,
    fontWeight:    '700',
    color:         colors.text.secondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom:  10,
    marginLeft:    4,
  },
  settingsGroup: {
    backgroundColor: colors.surface,
    borderRadius:    radius.lg,
    borderWidth:     1,
    borderColor:     colors.gray[100],
    overflow:        'hidden',
    marginBottom:    20,
  },
  settingRow: {
    flexDirection:     'row',
    alignItems:        'center',
    padding:           14,
    gap:               12,
  },
  settingIcon: {
    width:           40,
    height:          40,
    borderRadius:    12,
    backgroundColor: colors.gray[50],
    alignItems:      'center',
    justifyContent:  'center',
  },
  settingEmoji: {
    fontSize: 18,
  },
  settingContent: {
    flex: 1,
  },
  settingLabel: {
    fontSize:   14,
    fontWeight: '600',
    color:      colors.text.primary,
  },
  settingValue: {
    fontSize:   12,
    color:      colors.text.secondary,
    marginTop:  2,
  },
  settingChevron: {
    fontSize:   22,
    color:      colors.gray[300],
    fontWeight: '300',
  },
  rowDivider: {
    height:           1,
    backgroundColor:  colors.gray[100],
    marginLeft:       66,
  },

  // Language toggle
  langToggle: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
  },
  langLabel: {
    fontSize:   12,
    color:      colors.text.secondary,
    fontWeight: '500',
  },

  // ── Logout ──
  logoutSection: {
    marginTop:    8,
    marginBottom: 24,
  },

  // ── Footer ──
  footer: {
    alignItems:      'center',
    paddingVertical: 16,
    gap:             6,
  },
  version: {
    fontSize:   12,
    color:      colors.text.tertiary,
    fontWeight: '600',
  },
  buildInfo: {
    fontSize: 10,
    color:    colors.text.tertiary,
  },
})
