import React, { useRef, useEffect } from 'react'
import {
  View, Text, StyleSheet, Animated, TouchableOpacity, Dimensions, Image
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '@/constants/colors'
import { radius, shadows, spacing } from '@/constants/design'

const { width } = Dimensions.get('window')

/**
 * Role Selection Screen — shown after splash.
 * User picks: "Continue as Borrower / SHG Member" or "Continue as Lender / Investor"
 */
export default function RoleSelectScreen() {
  const cardAnim1 = useRef(new Animated.Value(0)).current
  const cardAnim2 = useRef(new Animated.Value(0)).current
  const headerAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.stagger(200, [
      Animated.spring(headerAnim, { toValue: 1, friction: 8, useNativeDriver: true }),
      Animated.spring(cardAnim1, { toValue: 1, friction: 8, useNativeDriver: true }),
      Animated.spring(cardAnim2, { toValue: 1, friction: 8, useNativeDriver: true }),
    ]).start()
  }, [])

  const makeAnim = (anim: Animated.Value) => ({
    opacity: anim,
    transform: [
      { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) },
      { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
    ],
  })

  const handleSelectRole = (role: 'BORROWER' | 'LENDER') => {
    router.push({
      pathname: '/(auth)/welcome',
      params: { role }
    })
  }

  return (
    <View style={styles.container}>
      {/* Background */}
      <View style={styles.bgGradient}>
        <View style={styles.bgCircle1} />
        <View style={styles.bgCircle2} />
        <View style={styles.bgCircle3} />
      </View>

      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <Animated.View style={[styles.header, makeAnim(headerAnim)]}>
          <View style={styles.logoCircle}>
            <Image
              source={{ uri: 'https://img.icons8.com/clouds/200/leaf.png' }}
              style={styles.logo}
            />
          </View>
          <Text style={styles.appName}>GramChain</Text>
          <Text style={styles.subtitle}>Choose how you want to use GramChain</Text>
        </Animated.View>

        {/* Role Cards */}
        <View style={styles.cardsContainer}>
          {/* Borrower Card */}
          <Animated.View style={makeAnim(cardAnim1)}>
            <TouchableOpacity
              style={styles.roleCard}
              onPress={() => handleSelectRole('BORROWER')}
              activeOpacity={0.85}
              accessibilityLabel="Continue as SHG Member or Borrower"
            >
              <View style={styles.cardIconCircle}>
                <Text style={styles.cardEmoji}>👥</Text>
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>SHG Member / Borrower</Text>
                <Text style={styles.cardDesc}>
                  Join a Self-Help Group, apply for micro-loans, and build your credit score
                </Text>
              </View>
              <View style={styles.cardArrow}>
                <Ionicons name="arrow-forward-circle" size={32} color={colors.primary[500]} />
              </View>
              {/* Decorative accent */}
              <View style={[styles.cardAccent, { backgroundColor: colors.primary[500] }]} />
            </TouchableOpacity>
          </Animated.View>

          {/* Lender Card */}
          <Animated.View style={makeAnim(cardAnim2)}>
            <TouchableOpacity
              style={styles.roleCard}
              onPress={() => handleSelectRole('LENDER')}
              activeOpacity={0.85}
              accessibilityLabel="Continue as Lender or Investor"
            >
              <View style={[styles.cardIconCircle, { backgroundColor: '#FEF3C7' }]}>
                <Text style={styles.cardEmoji}>💎</Text>
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>Lender / Investor</Text>
                <Text style={styles.cardDesc}>
                  Fund rural micro-loans, earn competitive returns, and create real-world impact
                </Text>
              </View>
              <View style={styles.cardArrow}>
                <Ionicons name="arrow-forward-circle" size={32} color={colors.secondary[600]} />
              </View>
              {/* Decorative accent */}
              <View style={[styles.cardAccent, { backgroundColor: colors.secondary[500] }]} />
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Bottom Trust */}
        <View style={styles.bottomSection}>
          <View style={styles.trustRow}>
            <View style={styles.trustItem}>
              <Text style={styles.trustEmoji}>🔒</Text>
              <Text style={styles.trustText}>Bank-Grade{'\n'}Security</Text>
            </View>
            <View style={styles.trustDivider} />
            <View style={styles.trustItem}>
              <Text style={styles.trustEmoji}>⛓️</Text>
              <Text style={styles.trustText}>Blockchain{'\n'}Verified</Text>
            </View>
            <View style={styles.trustDivider} />
            <View style={styles.trustItem}>
              <Text style={styles.trustEmoji}>🇮🇳</Text>
              <Text style={styles.trustText}>RBI{'\n'}Compliant</Text>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary[900],
  },
  bgGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0a3d1e',
  },
  bgCircle1: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(34,197,94,0.08)',
  },
  bgCircle2: {
    position: 'absolute',
    bottom: 100,
    left: -80,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(245,158,11,0.06)',
  },
  bgCircle3: {
    position: 'absolute',
    top: '40%',
    right: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  safe: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    paddingTop: 30,
    marginBottom: 40,
  },
  logoCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.lg,
  },
  logo: {
    width: 60,
    height: 60,
  },
  appName: {
    fontSize: 36,
    fontWeight: '900',
    color: colors.surface,
    marginTop: 16,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 8,
    textAlign: 'center',
  },
  cardsContainer: {
    gap: 16,
    flex: 1,
  },
  roleCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 22,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadows.lg,
    overflow: 'hidden',
  },
  cardAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
  },
  cardIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  cardEmoji: {
    fontSize: 28,
  },
  cardContent: {
    flex: 1,
    marginRight: 8,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text.primary,
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 19,
  },
  cardArrow: {
    opacity: 0.8,
  },
  bottomSection: {
    paddingBottom: 30,
    paddingTop: 20,
  },
  trustRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 12,
  },
  trustItem: {
    flex: 1,
    alignItems: 'center',
  },
  trustEmoji: {
    fontSize: 22,
    marginBottom: 6,
  },
  trustText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    fontWeight: '600',
    lineHeight: 15,
  },
  trustDivider: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
})
