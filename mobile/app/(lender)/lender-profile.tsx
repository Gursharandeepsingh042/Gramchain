import React, { useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '@/store/auth.store'
import { authApi } from '@/services/api'
import { colors } from '@/constants/colors'
import { radius, shadows } from '@/constants/design'

/**
 * Lender Profile Screen — account settings, verification status, and logout
 */
export default function LenderProfileScreen() {
  const { user, logout } = useAuthStore()

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            // N1: Server-side logout (FCM + refresh-token invalidation)
            // before wiping local state. Network failure is non-fatal.
            try { await authApi.logout() } catch { /* proceed with local logout */ }
            logout()
            router.replace('/role-select' as any)
          },
        },
      ]
    )
  }

  const profileSections = [
    {
      title: 'Account',
      items: [
        { icon: 'person-outline', label: 'Personal Details', value: user?.name || 'Not set', action: () => {} },
        { icon: 'mail-outline', label: 'Email', value: user?.email || 'Not set', action: () => {} },
        { icon: 'call-outline', label: 'Phone', value: user?.phone ? `+91 ${user.phone}` : 'Not set', action: () => {} },
      ],
    },
    {
      title: 'Verification',
      items: [
        { icon: 'shield-checkmark-outline', label: 'KYC Status', value: 'Tier 1 — PAN Verified', badge: true, action: () => {} },
        { icon: 'wallet-outline', label: 'Wallet Address', value: user?.walletAddress ? `${user.walletAddress.slice(0, 8)}...` : 'Not linked', action: () => {} },
      ],
    },
    {
      title: 'Investment',
      items: [
        { icon: 'pie-chart-outline', label: 'Risk Preference', value: 'AA — Conservative', action: () => {} },
        { icon: 'cash-outline', label: 'Monthly Budget', value: '₹25,000', action: () => {} },
        { icon: 'document-text-outline', label: 'Tax Reports', value: 'Download', action: () => {} },
      ],
    },
    {
      title: 'Settings',
      items: [
        { icon: 'notifications-outline', label: 'Notifications', value: 'Enabled', action: () => {} },
        { icon: 'language-outline', label: 'Language', value: 'English', action: () => {} },
        { icon: 'help-circle-outline', label: 'Help & Support', value: '', action: () => {} },
        { icon: 'document-outline', label: 'Terms & Risk Disclosure', value: '', action: () => {} },
      ],
    },
  ]

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Profile</Text>
          </View>

          {/* Avatar Card */}
          <View style={styles.avatarCard}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>
                {user?.name ? user.name.charAt(0).toUpperCase() : '💎'}
              </Text>
            </View>
            <View style={styles.avatarInfo}>
              <Text style={styles.avatarName}>{user?.name || 'Investor'}</Text>
              <View style={styles.roleBadge}>
                <Text style={styles.roleText}>💎 INVESTOR</Text>
              </View>
            </View>
          </View>

          {/* Profile Sections */}
          {profileSections.map((section) => (
            <View key={section.title} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <View style={styles.sectionCard}>
                {section.items.map((item, i) => (
                  <TouchableOpacity
                    key={item.label}
                    style={[
                      styles.menuItem,
                      i < section.items.length - 1 && styles.menuItemBorder,
                    ]}
                    onPress={item.action}
                    activeOpacity={0.7}
                  >
                    <View style={styles.menuLeft}>
                      <Ionicons name={item.icon as any} size={20} color="#60a5fa" />
                      <Text style={styles.menuLabel}>{item.label}</Text>
                    </View>
                    <View style={styles.menuRight}>
                      {item.badge ? (
                        <View style={styles.verifiedBadge}>
                          <Text style={styles.verifiedText}>✓ Verified</Text>
                        </View>
                      ) : item.value ? (
                        <Text style={styles.menuValue}>{item.value}</Text>
                      ) : null}
                      <Ionicons name="chevron-forward" size={16} color="#475569" />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}

          {/* Logout */}
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="#ef4444" />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>

          <Text style={styles.version}>GramChain Investor v1.0 — Powered by Polygon</Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 100 },

  header: { marginBottom: 22 },
  title: { fontSize: 28, fontWeight: '900', color: '#f1f5f9', letterSpacing: -0.5 },

  // Avatar
  avatarCard: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: '#1e293b', borderRadius: 20, padding: 20, marginBottom: 28,
    borderWidth: 1, borderColor: '#334155',
  },
  avatarCircle: {
    width: 60, height: 60, borderRadius: 20,
    backgroundColor: '#172554', justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#3b82f6',
  },
  avatarText: { fontSize: 24, fontWeight: '800', color: '#60a5fa' },
  avatarInfo: { flex: 1 },
  avatarName: { fontSize: 20, fontWeight: '800', color: '#f1f5f9', marginBottom: 4 },
  roleBadge: {
    backgroundColor: 'rgba(245,158,11,0.12)', paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: 8, alignSelf: 'flex-start',
  },
  roleText: { fontSize: 10, fontWeight: '700', color: colors.secondary[400], letterSpacing: 0.5 },

  // Sections
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: '#64748b', letterSpacing: 0.5,
    textTransform: 'uppercase', marginBottom: 8, marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: '#1e293b', borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: '#334155',
  },

  menuItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 16,
  },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: '#334155' },
  menuLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuLabel: { fontSize: 14, fontWeight: '500', color: '#e2e8f0' },
  menuRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  menuValue: { fontSize: 13, color: '#64748b', fontWeight: '500' },

  verifiedBadge: {
    backgroundColor: 'rgba(34,197,94,0.12)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  verifiedText: { fontSize: 11, color: '#4ade80', fontWeight: '700' },

  // Logout
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#1e293b', borderRadius: 14, padding: 16, marginTop: 8, marginBottom: 16,
    borderWidth: 1, borderColor: '#ef444430',
  },
  logoutText: { fontSize: 15, fontWeight: '700', color: '#ef4444' },

  version: { fontSize: 11, color: '#475569', textAlign: 'center', marginBottom: 20 },
})
