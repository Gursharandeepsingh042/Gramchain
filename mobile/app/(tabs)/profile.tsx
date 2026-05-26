import React, { useRef, useEffect, useState } from 'react'
import {
  View, Text, Switch, StyleSheet, ScrollView, TouchableOpacity,
  Animated, Alert, Modal, TextInput, Linking,
} from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Badge, TrustBadge } from '@/components/ui/SharedComponents'
import { useAuthStore } from '@/store/auth.store'
import { router } from 'expo-router'
import { colors } from '@/constants/colors'
import { radius, shadows, spacing } from '@/constants/design'
import { bankApi, authApi } from '@/services/api'
import { Ionicons } from '@expo/vector-icons'
import contractsConfig from '@/constants/contracts.json'
import Constants from 'expo-constants'

/**
 * Build a block explorer URL for the configured chain.
 * Returns null for local/unknown chains (no public explorer).
 */
const buildExplorerUrl = (address: string): string | null => {
  const chainId = (contractsConfig as { chainId?: number })?.chainId
  switch (chainId) {
    case 137:
      return `https://polygonscan.com/address/${address}`
    case 80002:
      return `https://amoy.polygonscan.com/address/${address}`
    default:
      return null
  }
}

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

// ── Bank account types ──────────────────────────────────────
interface BankAccount {
  id: string; bankName: string; accountNumber: string
  ifsc: string; verified: boolean
}

export default function ProfileScreen() {
  const { t, i18n } = useTranslation()
  const { user, logout, isKycComplete } = useAuthStore()

  // Modal visibility
  const [showBank, setShowBank]   = useState(false)
  const [showHelp, setShowHelp]   = useState(false)
  const [showFaq,  setShowFaq]    = useState(false)
  const [showTerms, setShowTerms] = useState(false)

  // Bank state
  const [accounts, setAccounts]       = useState<BankAccount[]>([])
  const [bankLoading, setBankLoading] = useState(false)
  const [showAddBank, setShowAddBank] = useState(false)
  const [bankName, setBankName]       = useState('')
  const [acctNum, setAcctNum]         = useState('')
  const [ifsc, setIfsc]               = useState('')
  const [refId, setRefId]             = useState('')
  const [otp, setOtp]                 = useState('')
  const [bankStep, setBankStep]       = useState<'FORM'|'OTP'>('FORM')

  // FAQ expand
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null)

  // Set Password modal
  const [showSetPw, setShowSetPw]     = useState(false)
  const [newPw, setNewPw]             = useState('')
  const [confirmPw, setConfirmPw]     = useState('')
  const [pwLoading, setPwLoading]     = useState(false)
  const [pwVisible, setPwVisible]     = useState(false)

  // Wallet modal
  const [showWallet, setShowWallet]   = useState(false)
  const [copiedAddr, setCopiedAddr]   = useState(false)

  // Edit profile modal
  const [showEditProfile, setShowEditProfile] = useState(false)
  const [editName, setEditName]               = useState('')
  const [editLoading, setEditLoading]        = useState(false)

  // Language selection modal
  const [showLanguage, setShowLanguage] = useState(false)

  // Animation
  const fadeAnim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start()
  }, [])

  // Load accounts when bank modal opens
  useEffect(() => {
    if (showBank) loadAccounts()
  }, [showBank])

  const loadAccounts = async () => {
    try {
      const res = await bankApi.getAccounts()
      setAccounts(res.data.data.accounts || [])
    } catch { /* silent */ }
  }

  const resetBankForm = () => {
    setBankName(''); setAcctNum(''); setIfsc('')
    setRefId(''); setOtp(''); setBankStep('FORM')
  }

  // Bank linking requires verified KYC. Skipping KYC at signup lets the user
  // into the dashboard, but adding a real bank account must be gated until
  // identity is verified. We clear `kycSkipped` so the root layout routes
  // them to the KYC screen on `replace('/')`.
  const handleAddBankPress = () => {
    if (!isKycComplete) {
      Alert.alert(
        'KYC Required',
        'You must complete KYC verification before linking a bank account. This protects you and the platform from fraud.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Complete KYC',
            onPress: () => {
              useAuthStore.setState({ kycSkipped: false })
              setShowBank(false)
              router.replace('/')
            },
          },
        ]
      )
      return
    }
    setShowAddBank(true)
  }

  const handleInitiate = async () => {
    if (!bankName || !acctNum || !ifsc) return Alert.alert('Error', 'Fill in all fields')
    if (acctNum.length < 9 || acctNum.length > 18) return Alert.alert('Error', 'Account number must be 9–18 digits')
    if (ifsc.length !== 11) return Alert.alert('Error', 'IFSC must be 11 characters')
    setBankLoading(true)
    try {
      const res = await bankApi.initiateLinking({ bankName, accountNumber: acctNum, ifsc: ifsc.toUpperCase() })
      setRefId(res.data.data.referenceId)
      setBankStep('OTP')
      Alert.alert('SMS Sent', res.data.data.message)
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error?.message || 'Failed')
    } finally { setBankLoading(false) }
  }

  const handleVerify = async () => {
    if (otp.length !== 6) return Alert.alert('Error', 'Enter 6-digit OTP')
    setBankLoading(true)
    try {
      await bankApi.verifyLinking(refId, otp)
      Alert.alert('Success', 'Bank account linked!')
      setShowAddBank(false); resetBankForm(); loadAccounts()
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error?.message || 'Verification failed')
    } finally { setBankLoading(false) }
  }

  const handleDelete = (id: string, name: string) => {
    Alert.alert('Unlink Account', `Unlink ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Unlink', style: 'destructive', onPress: async () => {
        try { await bankApi.deleteAccount(id); loadAccounts() } catch { Alert.alert('Error', 'Failed') }
      }},
    ])
  }

  const handleSetPassword = async () => {
    if (newPw.length < 8) return Alert.alert('Too short', 'Password must be at least 8 characters.')
    if (newPw !== confirmPw) return Alert.alert('Mismatch', 'Passwords do not match.')
    setPwLoading(true)
    try {
      await authApi.setPassword(newPw)
      Alert.alert('Done', 'Password updated successfully!')
      setShowSetPw(false); setNewPw(''); setConfirmPw('')
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error?.message || 'Failed to update password.')
    } finally { setPwLoading(false) }
  }

  const handleUpdateProfile = async () => {
    if (!editName.trim()) return Alert.alert('Error', 'Name cannot be empty')
    setEditLoading(true)
    try {
      await authApi.updateProfile({ name: editName })
      Alert.alert('Success', 'Profile updated successfully!')
      setShowEditProfile(false)
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error?.message || 'Failed to update profile')
    } finally {
      setEditLoading(false)
    }
  }

  const openEditProfile = () => {
    setEditName(user?.name || '')
    setShowEditProfile(true)
  }

  const handleCopyAddress = () => {
    if (!user?.walletAddress) return
    Clipboard.setStringAsync(user.walletAddress)
    setCopiedAddr(true)
    setTimeout(() => setCopiedAddr(false), 2000)
  }

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: async () => {
        // N1: Tell server to invalidate refresh tokens + clear FCM token
        // before wiping local state. Failure is non-fatal — local logout
        // must still proceed even if the network call fails.
        try { await authApi.logout() } catch { /* swallow — proceed with local logout */ }
        logout(); router.replace('/welcome')
      }},
    ])
  }

  const toggleLang = (lang: string) => {
    void i18n.changeLanguage(lang)
    setShowLanguage(false)
  }

  const LANGUAGES = [
    { code: 'en', name: 'English', native: 'English' },
    { code: 'hi', name: 'Hindi', native: 'हिंदी' },
    { code: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
    { code: 'ta', name: 'Tamil', native: 'தமிழ்' },
    { code: 'bn', name: 'Bangla', native: 'বাংলা' },
    { code: 'te', name: 'Telugu', native: 'తెలుగు' },
    { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ' },
  ]

  const currentLang = LANGUAGES.find(l => l.code === i18n.language) || LANGUAGES[0]

  const isVerified = user?.kycStatus === 'VERIFIED'
  const name       = user?.name || user?.phone || 'U'
  const initials   = name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()

  const FAQ_ITEMS = [
    { q: 'What is GramChain?', a: 'GramChain is a blockchain-powered microfinance platform connecting rural self-help groups with transparent, low-interest loans.' },
    { q: 'How do I complete KYC?', a: 'Go to your Profile, tap KYC Status, and follow the verification steps. You will need a valid Aadhaar number.' },
    { q: 'How are loans approved?', a: 'Your SHG leader reviews and approves loan applications. Approved loans are recorded on the Polygon blockchain.' },
    { q: 'Is my data secure?', a: 'Yes. Your data is encrypted and stored securely. Loan records are immutable on the blockchain.' },
    { q: 'How do I link a bank account?', a: 'Open Banking in your Profile, tap Add Account, enter your details, and verify via the SMS OTP sent to your registered number.' },
    { q: 'What is an invite code?', a: 'A unique 8-character code your SHG leader generates. Share it so new members can join your group directly.' },
  ]

  const HELP_TOPICS = [
    { icon: '🚀', title: 'Getting Started', desc: 'Create your account, complete KYC, and join or create an SHG group.' },
    { icon: '💰', title: 'Applying for a Loan', desc: 'Go to the Loans tab, tap Apply, fill in the amount and purpose, then submit.' },
    { icon: '🔁', title: 'Repaying a Loan', desc: 'Make repayments through the Loans tab. On-time payments build your credit score.' },
    { icon: '👥', title: 'Managing Your Group', desc: 'Leaders can approve members and loans, generate invite codes, and view group stats.' },
    { icon: '🏦', title: 'Bank Linking', desc: 'Link your bank account under Banking in Profile for seamless fund transfers.' },
    { icon: '🔒', title: 'Security', desc: 'Enable biometric lock and never share your OTPs with anyone.' },
  ]

  const TERMS = [
    { title: 'Eligibility', body: 'You must be 18+ and a resident of India. KYC verification is mandatory before applying for loans.' },
    { title: 'Loan Terms', body: 'Loans are issued at rates set by your SHG group. Repayment schedules are agreed upon at time of approval.' },
    { title: 'Data Usage', body: 'We collect personal information solely to provide our services. We do not sell your data to third parties.' },
    { title: 'Blockchain Records', body: 'Loan approvals and repayments are recorded on the Polygon blockchain and are publicly verifiable.' },
    { title: 'Bank Account Linking', body: 'You authorise GramChain to use linked account details only for loan disbursals and repayment collections.' },
    { title: 'Termination', body: 'We may suspend accounts for fraud, KYC failure, or repeated loan defaults after proper notice.' },
    { title: 'Contact', body: 'For disputes, email support@gramchain.in or call 1800-XXX-XXXX (Mon–Fri, 9 am–6 pm IST).' },
  ]

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
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
            <View style={styles.nameRow}>
              <Text style={styles.userName}>{user?.name || 'GramChain User'}</Text>
              {!isVerified && (
                <TouchableOpacity onPress={openEditProfile} style={styles.editIconBtn} hitSlop={8}>
                  <Ionicons name="pencil" size={16} color={colors.primary[600]} />
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.userPhone}>📞 +91 {user?.phone || '—'}</Text>
            <View style={styles.badgeRow}>
              <Badge label={isVerified ? 'KYC Verified' : 'KYC Pending'} variant={isVerified ? 'success' : 'warning'} />
            </View>
          </View>

          {/* ── Wallet Card ── */}
          <TouchableOpacity activeOpacity={0.85} onPress={() => setShowWallet(true)} style={[styles.walletCard, shadows.sm]}>
            <View style={styles.walletHeader}>
              <Text style={styles.walletIcon}>⛓</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.walletTitle}>Blockchain Wallet</Text>
                <Text style={styles.walletAddress} numberOfLines={1}>
                  {user?.walletAddress
                    ? `${user.walletAddress.substring(0, 6)}...${user.walletAddress.substring(38)} (Polygon)`
                    : 'Not Connected'}
                </Text>
              </View>
              {user?.walletAddress
                ? <Badge label="Connected" variant="success" size="sm" />
                : <Badge label="Pending" variant="neutral" size="sm" />}
            </View>
          </TouchableOpacity>

          {/* ── Account ── */}
          <Text style={styles.groupTitle}>Account</Text>
          <View style={[styles.settingsGroup, shadows.xs]}>
            <SettingRow icon="📞" label="Phone Number" value={`+91 ${user?.phone || '—'}`} />
            <View style={styles.rowDivider} />
            <SettingRow
              icon="🪪" label="KYC Status"
              value={isVerified ? 'Verified ✓' : 'Pending'}
              onPress={!isVerified ? () => router.push('/kyc') : undefined}
            />
            <View style={styles.rowDivider} />
            <SettingRow icon="🔑" label="Set Password" value="Update login password" onPress={() => setShowSetPw(true)} />
          </View>

          {/* ── Banking ── */}
          <Text style={styles.groupTitle}>Banking</Text>
          <View style={[styles.settingsGroup, shadows.xs]}>
            <SettingRow
              icon="🏦" label="Linked Bank Accounts"
              value={accounts.length ? `${accounts.length} linked` : 'None'}
              onPress={() => setShowBank(true)}
            />
          </View>

          {/* ── Preferences ── */}
          <Text style={styles.groupTitle}>Preferences</Text>
          <View style={[styles.settingsGroup, shadows.xs]}>
            <SettingRow
              icon="🌐" label="Language"
              value={currentLang.native}
              onPress={() => setShowLanguage(true)}
            />
            <View style={styles.rowDivider} />
            <SettingRow icon="🔔" label="Notifications" value="Enabled" onPress={() => {}} />
            <View style={styles.rowDivider} />
            <SettingRow icon="🔒" label="Biometric Lock" value="Off" onPress={() => {}} />
          </View>

          {/* ── Support ── */}
          <Text style={styles.groupTitle}>Support</Text>
          <View style={[styles.settingsGroup, shadows.xs]}>
            <SettingRow icon="❓" label="Help Center"        onPress={() => setShowHelp(true)} />
            <View style={styles.rowDivider} />
            <SettingRow icon="💬" label="FAQ"                onPress={() => setShowFaq(true)} />
            <View style={styles.rowDivider} />
            <SettingRow icon="📄" label="Terms & Conditions" onPress={() => setShowTerms(true)} />
          </View>

          {/* ── Logout ── */}
          <View style={styles.logoutSection}>
            <Button variant="danger" label={t('profile.logout', { defaultValue: 'Logout' })}
              onPress={handleLogout} size="lg" icon={<Text style={{ fontSize: 16 }}>🚪</Text>} />
          </View>

          {/* ── Footer ── */}
          <View style={styles.footer}>
            <TrustBadge />
            <Text style={styles.version}>GramChain v{Constants.expoConfig?.version ?? '1.0.0'}</Text>
            <Text style={styles.buildInfo}>
              Build {new Date().getFullYear()}.{String(new Date().getMonth() + 1).padStart(2, '0')}.{String(new Date().getDate()).padStart(2, '0')} — {
                (contractsConfig as { chainId?: number })?.chainId === 137 ? 'Polygon Mainnet' :
                (contractsConfig as { chainId?: number })?.chainId === 80002 ? 'Polygon Amoy Testnet' :
                'Local Development'
              }
            </Text>
          </View>
        </Animated.View>
      </ScrollView>

      {/* ════════════════ BANK MODAL ════════════════ */}
      <Modal visible={showBank} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowBank(false)}>
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Linked Bank Accounts</Text>
            <TouchableOpacity onPress={() => setShowBank(false)} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.text.primary} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody}>
            {accounts.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyIcon}>🏦</Text>
                <Text style={styles.emptyText}>No bank accounts linked</Text>
              </View>
            ) : accounts.map(acc => (
              <View key={acc.id} style={styles.bankCard}>
                <View style={styles.bankCardLeft}>
                  <Text style={styles.bankCardName}>{acc.bankName}</Text>
                  <Text style={styles.bankCardNum}>••••{acc.accountNumber.slice(-4)}  |  {acc.ifsc}</Text>
                  <View style={[styles.verifiedPill, { backgroundColor: acc.verified ? '#dcfce7' : '#fef9c3' }]}>
                    <Text style={[styles.verifiedPillText, { color: acc.verified ? '#166534' : '#854d0e' }]}>
                      {acc.verified ? '✓ Verified' : '⏳ Pending'}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => handleDelete(acc.id, acc.bankName)} style={styles.unlinkBtn}>
                  <Ionicons name="trash-outline" size={18} color={colors.danger[500]} />
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity style={styles.addBankBtn} onPress={handleAddBankPress}>
              <Ionicons name="add-circle-outline" size={20} color={colors.primary[600]} />
              <Text style={styles.addBankBtnText}>Add Bank Account</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Add Bank sub-modal */}
      <Modal visible={showAddBank} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { setShowAddBank(false); resetBankForm() }}>
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{bankStep === 'FORM' ? 'Add Bank Account' : 'Verify OTP'}</Text>
            <TouchableOpacity onPress={() => { setShowAddBank(false); resetBankForm() }} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.text.primary} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody}>
            {bankStep === 'FORM' ? (
              <>
                <Text style={styles.inputLabel}>Bank Name</Text>
                <TextInput style={styles.input} placeholder="e.g. State Bank of India" value={bankName} onChangeText={setBankName} />
                <Text style={styles.inputLabel}>Account Number</Text>
                <TextInput style={styles.input} placeholder="9–18 digits" keyboardType="numeric" value={acctNum} onChangeText={setAcctNum} />
                <Text style={styles.inputLabel}>IFSC Code</Text>
                <TextInput style={styles.input} placeholder="11 characters" autoCapitalize="characters" value={ifsc} onChangeText={setIfsc} maxLength={11} />
                <Button label={bankLoading ? 'Sending…' : 'Send OTP'} onPress={handleInitiate} disabled={bankLoading} />
              </>
            ) : (
              <>
                <Text style={styles.otpHint}>Enter the 6-digit OTP sent to your registered mobile number.</Text>
                <TextInput style={[styles.input, styles.otpInput]} placeholder="••••••" keyboardType="numeric" maxLength={6} value={otp} onChangeText={setOtp} />
                <Button label={bankLoading ? 'Verifying…' : 'Verify & Link'} onPress={handleVerify} disabled={bankLoading} />
                <TouchableOpacity style={styles.backLink} onPress={() => setBankStep('FORM')}>
                  <Text style={styles.backLinkText}>← Change details</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ════════════════ HELP MODAL ════════════════ */}
      <Modal visible={showHelp} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowHelp(false)}>
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Help Center</Text>
            <TouchableOpacity onPress={() => setShowHelp(false)} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.text.primary} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody}>
            {HELP_TOPICS.map((item, i) => (
              <View key={i} style={styles.helpCard}>
                <Text style={styles.helpIcon}>{item.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.helpTitle}>{item.title}</Text>
                  <Text style={styles.helpDesc}>{item.desc}</Text>
                </View>
              </View>
            ))}
            <View style={styles.contactBox}>
              <Text style={styles.contactTitle}>Need more help?</Text>
              <TouchableOpacity onPress={() => Linking.openURL('mailto:support@gramchain.in')}>
                <Text style={styles.contactLink}>✉️  support@gramchain.in</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => Linking.openURL('tel:1800XXXXXXX')}>
                <Text style={styles.contactLink}>📞  1800-XXX-XXXX</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ════════════════ FAQ MODAL ════════════════ */}
      <Modal visible={showFaq} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowFaq(false)}>
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>FAQ</Text>
            <TouchableOpacity onPress={() => setShowFaq(false)} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.text.primary} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody}>
            {FAQ_ITEMS.map((item, i) => (
              <TouchableOpacity key={i} style={styles.faqItem} activeOpacity={0.8} onPress={() => setExpandedFaq(expandedFaq === i ? null : i)}>
                <View style={styles.faqRow}>
                  <Text style={styles.faqQ}>{item.q}</Text>
                  <Ionicons name={expandedFaq === i ? 'chevron-up' : 'chevron-down'} size={18} color={colors.text.secondary} />
                </View>
                {expandedFaq === i && <Text style={styles.faqA}>{item.a}</Text>}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ════════════════ TERMS MODAL ════════════════ */}
      <Modal visible={showTerms} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowTerms(false)}>
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Terms & Conditions</Text>
            <TouchableOpacity onPress={() => setShowTerms(false)} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.text.primary} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody}>
            <Text style={styles.termsIntro}>Last updated: April 2026. By using GramChain you agree to the following terms.</Text>
            {TERMS.map((section, i) => (
              <View key={i} style={styles.termsSection}>
                <Text style={styles.termsSectionTitle}>{i + 1}. {section.title}</Text>
                <Text style={styles.termsSectionBody}>{section.body}</Text>
              </View>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ════════════════ SET PASSWORD MODAL ════════════════ */}
      <Modal visible={showSetPw} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowSetPw(false)}>
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Set Password</Text>
            <TouchableOpacity onPress={() => setShowSetPw(false)} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.text.primary} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody}>
            <Text style={styles.otpHint}>
              Set a password so you can also log in using your phone number and password — in addition to OTP.
            </Text>

            <Text style={styles.inputLabel}>New Password</Text>
            <View style={styles.pwInputRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                placeholder="Min. 8 characters"
                secureTextEntry={!pwVisible}
                value={newPw}
                onChangeText={setNewPw}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setPwVisible(v => !v)} style={styles.pwEye}>
                <Ionicons name={pwVisible ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.inputLabel, { marginTop: 16 }]}>Confirm Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Re-enter password"
              secureTextEntry={!pwVisible}
              value={confirmPw}
              onChangeText={setConfirmPw}
              autoCapitalize="none"
            />

            <Button label={pwLoading ? 'Saving…' : 'Save Password'} onPress={handleSetPassword} disabled={pwLoading} />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ════════════════ WALLET MODAL ════════════════ */}
      <Modal visible={showWallet} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowWallet(false)}>
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>My Wallet</Text>
            <TouchableOpacity onPress={() => setShowWallet(false)} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.text.primary} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody}>
            {user?.walletAddress ? (
              <>
                <View style={styles.walletModalHero}>
                  <View style={styles.walletModalIcon}>
                    <Text style={{ fontSize: 40 }}>⛓</Text>
                  </View>
                  <Text style={styles.walletModalNetwork}>Polygon Network</Text>
                  <Text style={styles.walletModalTitle}>Your GramChain Wallet</Text>
                </View>

                <View style={styles.walletAddrBox}>
                  <Text style={styles.walletAddrLabel}>Wallet Address</Text>
                  <Text style={styles.walletAddrFull} selectable>{user.walletAddress}</Text>
                  <View style={styles.walletAddrActions}>
                    <TouchableOpacity style={styles.copyBtn} onPress={handleCopyAddress}>
                      <Ionicons name={copiedAddr ? 'checkmark-circle' : 'copy-outline'} size={18} color={copiedAddr ? '#16a34a' : colors.primary[600]} />
                      <Text style={[styles.copyBtnText, copiedAddr && { color: '#16a34a' }]}>
                        {copiedAddr ? 'Copied!' : 'Copy'}
                      </Text>
                    </TouchableOpacity>
                    {(() => {
                      const explorerUrl = buildExplorerUrl(user.walletAddress)
                      if (!explorerUrl) return null
                      return (
                        <TouchableOpacity style={styles.copyBtn} onPress={() => Linking.openURL(explorerUrl)}>
                          <Ionicons name="open-outline" size={18} color={colors.primary[600]} />
                          <Text style={styles.copyBtnText}>View on Polygonscan</Text>
                        </TouchableOpacity>
                      )
                    })()}
                  </View>
                </View>

                <View style={styles.walletInfoCards}>
                  <View style={styles.walletInfoCard}>
                    <Text style={styles.walletInfoIcon}>🆔</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.walletInfoTitle}>Verifiable Audit Identifier</Text>
                      <Text style={styles.walletInfoDesc}>This address is your unique on-chain ID. Every loan, approval, and repayment linked to your account is recorded against it on the Polygon blockchain — anyone can verify your loan history independently.</Text>
                    </View>
                  </View>
                  <View style={styles.walletInfoCard}>
                    <Text style={styles.walletInfoIcon}>✍️</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.walletInfoTitle}>Signed by GramChain</Text>
                      <Text style={styles.walletInfoDesc}>To keep things simple, GramChain securely signs blockchain records on your behalf. You don't need to manage seed phrases or pay gas fees.</Text>
                    </View>
                  </View>
                  <View style={styles.walletInfoCard}>
                    <Text style={styles.walletInfoIcon}>📊</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.walletInfoTitle}>Tamper-Proof History</Text>
                      <Text style={styles.walletInfoDesc}>Once recorded, no one — not even GramChain — can alter your loan history. This is your verifiable credit reputation.</Text>
                    </View>
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyIcon}>🔗</Text>
                <Text style={[styles.emptyText, { textAlign: 'center' }]}>
                  Your wallet is being created.{'\n'}It will appear here once your account is fully set up.
                </Text>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal visible={showEditProfile} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowEditProfile(false)}>
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <TouchableOpacity onPress={() => setShowEditProfile(false)} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.text.primary} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody}>
            <Text style={styles.inputLabel}>Display Name</Text>
            <Text style={styles.inputHint}>This is a temporary name. Once you complete KYC, your verified name will appear instead.</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter your name"
              value={editName}
              onChangeText={setEditName}
              autoCapitalize="words"
            />
            <Button
              label="Save Changes"
              onPress={handleUpdateProfile}
              loading={editLoading}
              disabled={!editName.trim() || editLoading}
              size="xl"
              style={{ marginTop: 24 }}
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Language Selection Modal */}
      <Modal visible={showLanguage} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowLanguage(false)}>
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Language</Text>
            <TouchableOpacity onPress={() => setShowLanguage(false)} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.text.primary} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody}>
            {LANGUAGES.map((lang) => (
              <TouchableOpacity
                key={lang.code}
                style={[
                  styles.languageOption,
                  currentLang.code === lang.code && { backgroundColor: colors.primary[50] }
                ]}
                onPress={() => toggleLang(lang.code)}
              > 
                <Text style={styles.languageName}>{lang.name}</Text>
                <Text style={styles.languageNative}>{lang.native}</Text>
                {currentLang.code === lang.code && (
                  <Ionicons name="checkmark-circle" size={20} color={colors.primary[600]} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: spacing.screenPadding, paddingTop: 12, paddingBottom: 100 },

  // ── Profile Header ──
  profileHeader: { alignItems: 'center', paddingTop: 16, marginBottom: 24 },
  avatarContainer: { position: 'relative', marginBottom: 14 },
  avatar: { width: 80, height: 80, borderRadius: 28, backgroundColor: colors.primary[600], alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 30, fontWeight: '900', color: colors.text.inverse },
  verifiedBadge: { position: 'absolute', bottom: -2, right: -2, width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primary[500], borderWidth: 3, borderColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  verifiedIcon: { color: colors.text.inverse, fontSize: 12, fontWeight: '800' },
  userName: { fontSize: 22, fontWeight: '800', color: colors.text.primary, letterSpacing: -0.3, marginBottom: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editIconBtn: { padding: 6 },
  userPhone: { fontSize: 14, color: colors.text.secondary, marginBottom: 10 },
  badgeRow: { flexDirection: 'row', gap: 8 },

  // ── Wallet Card ──
  walletCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, borderWidth: 1, borderColor: colors.gray[100], marginBottom: 24 },
  walletHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  walletIcon: { fontSize: 22 },
  walletTitle: { fontSize: 14, fontWeight: '700', color: colors.text.primary },
  walletAddress: { fontSize: 12, color: colors.text.secondary, fontFamily: 'monospace', marginTop: 2 },

  // ── Settings Groups ──
  groupTitle: { fontSize: 11, fontWeight: '700', color: colors.text.secondary, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10, marginLeft: 4 },
  settingsGroup: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.gray[100], overflow: 'hidden', marginBottom: 20 },
  settingRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  settingIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.gray[50], alignItems: 'center', justifyContent: 'center' },
  settingEmoji: { fontSize: 18 },
  settingContent: { flex: 1 },
  settingLabel: { fontSize: 14, fontWeight: '600', color: colors.text.primary },
  settingValue: { fontSize: 12, color: colors.text.secondary, marginTop: 2 },
  settingChevron: { fontSize: 22, color: colors.gray[300], fontWeight: '300' },
  rowDivider: { height: 1, backgroundColor: colors.gray[100], marginLeft: 66 },

  // Language toggle
  langToggle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  langLabel: { fontSize: 12, color: colors.text.secondary, fontWeight: '500' },

  // ── Logout / Footer ──
  logoutSection: { marginTop: 8, marginBottom: 24 },
  footer: { alignItems: 'center', paddingVertical: 16, gap: 6 },
  version: { fontSize: 12, color: colors.text.tertiary, fontWeight: '600' },
  buildInfo: { fontSize: 10, color: colors.text.tertiary },

  // ── Shared Modal Shell ──
  modalSafe: { flex: 1, backgroundColor: colors.background },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  modalTitle: { fontSize: 20, fontWeight: '800', color: colors.text.primary },
  closeBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.gray[100], alignItems: 'center', justifyContent: 'center' },
  modalBody: { padding: 20, paddingBottom: 60 },

  // ── Edit Profile Modal ──
  inputLabel: { fontSize: 14, fontWeight: '700', color: colors.text.primary, marginBottom: 6 },
  inputHint: { fontSize: 12, color: colors.text.secondary, marginBottom: 12, lineHeight: 18 },
  textInput: { backgroundColor: colors.gray[50], borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.text.primary, borderWidth: 1, borderColor: colors.gray[200] },

  // ── Bank Modal ──
  emptyBox: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { fontSize: 44, marginBottom: 12 },
  emptyText: { fontSize: 15, color: colors.text.secondary },
  bankCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.gray[100] },
  bankCardLeft: { flex: 1 },
  bankCardName: { fontSize: 15, fontWeight: '700', color: colors.text.primary, marginBottom: 3 },
  bankCardNum: { fontSize: 13, color: colors.text.secondary, marginBottom: 6 },
  verifiedPill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 99 },
  verifiedPillText: { fontSize: 12, fontWeight: '600' },
  unlinkBtn: { padding: 8 },
  addBankBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8, paddingVertical: 14, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.primary[300], backgroundColor: colors.primary[50] },
  addBankBtnText: { color: colors.primary[700], fontWeight: '700', fontSize: 15 },

  // ── Add Bank Form ──
  input: { borderWidth: 1.5, borderColor: colors.gray[200], borderRadius: radius.md, padding: 13, marginBottom: 16, fontSize: 16, color: colors.text.primary, backgroundColor: colors.background },
  otpHint: { fontSize: 14, color: colors.text.secondary, lineHeight: 22, marginBottom: 16 },
  otpInput: { textAlign: 'center', fontSize: 24, letterSpacing: 8, fontWeight: '700' },
  backLink: { alignItems: 'center', marginTop: 16 },
  backLinkText: { color: colors.primary[600], fontWeight: '600', fontSize: 14 },

  // ── Help Modal ──
  helpCard: { flexDirection: 'row', gap: 14, padding: 16, backgroundColor: colors.surface, borderRadius: radius.lg, marginBottom: 12, borderWidth: 1, borderColor: colors.gray[100] },
  helpIcon: { fontSize: 26 },
  helpTitle: { fontSize: 15, fontWeight: '700', color: colors.text.primary, marginBottom: 4 },
  helpDesc: { fontSize: 13, color: colors.text.secondary, lineHeight: 20 },
  contactBox: { marginTop: 8, padding: 20, backgroundColor: colors.primary[50], borderRadius: radius.lg },
  contactTitle: { fontSize: 15, fontWeight: '800', color: colors.primary[800], marginBottom: 12 },
  contactLink: { fontSize: 14, color: colors.primary[700], fontWeight: '600', marginBottom: 10 },

  // ── FAQ Modal ──
  faqItem: { padding: 16, backgroundColor: colors.surface, borderRadius: radius.lg, marginBottom: 10, borderWidth: 1, borderColor: colors.gray[100] },
  faqRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  faqQ: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.text.primary, paddingRight: 12, lineHeight: 22 },
  faqA: { fontSize: 13, color: colors.text.secondary, lineHeight: 21, marginTop: 10 },

  // ── Terms Modal ──
  termsIntro: { fontSize: 13, color: colors.text.secondary, lineHeight: 20, marginBottom: 20 },
  termsSection: { marginBottom: 20 },
  termsSectionTitle: { fontSize: 15, fontWeight: '800', color: colors.text.primary, marginBottom: 6 },
  termsSectionBody: { fontSize: 13, color: colors.text.secondary, lineHeight: 21 },

  // ── Set Password Modal ──
  pwInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  pwEye: { padding: 10 },

  // ── Wallet Modal ──
  walletModalHero: { alignItems: 'center', paddingVertical: 28, gap: 8 },
  walletModalIcon: {
    width: 88, height: 88, borderRadius: 28,
    backgroundColor: colors.primary[50],
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.primary[200],
  },
  walletModalNetwork: { fontSize: 12, fontWeight: '700', color: colors.primary[600], letterSpacing: 1, textTransform: 'uppercase' },
  walletModalTitle: { fontSize: 20, fontWeight: '800', color: colors.text.primary },
  walletAddrBox: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16,
    borderWidth: 1, borderColor: colors.gray[100], marginBottom: 20,
  },
  walletAddrLabel: { fontSize: 12, fontWeight: '700', color: colors.text.secondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 },
  walletAddrFull: {
    fontSize: 13, color: colors.text.primary, fontFamily: 'monospace',
    lineHeight: 20, marginBottom: 12,
  },
  walletAddrActions: { flexDirection: 'row', gap: 8 },
  copyBtn: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, paddingHorizontal: 8, borderRadius: 10,
    backgroundColor: colors.primary[50], borderWidth: 1, borderColor: colors.primary[200],
  },
  copyBtnText: { fontSize: 13, fontWeight: '700', color: colors.primary[600] },
  walletInfoCards: { gap: 12 },
  walletInfoCard: {
    flexDirection: 'row', gap: 12, padding: 14,
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.gray[100], alignItems: 'flex-start',
  },
  walletInfoIcon: { fontSize: 22, marginTop: 2 },
  walletInfoTitle: { fontSize: 14, fontWeight: '700', color: colors.text.primary, marginBottom: 3 },
  walletInfoDesc: { fontSize: 13, color: colors.text.secondary, lineHeight: 19, flex: 1 },

  // ── Language Selection Modal ──
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: radius.lg,
    marginBottom: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.gray[100],
  },
  languageName: { fontSize: 16, fontWeight: '600', color: colors.text.primary },
  languageNative: { fontSize: 14, color: colors.text.secondary, marginLeft: 8 },
})
