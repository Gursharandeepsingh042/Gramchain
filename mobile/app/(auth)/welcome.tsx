import React, { useRef, useEffect } from 'react'
import {
  View, Text, StyleSheet, Animated, TouchableOpacity, Image, useWindowDimensions
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { router, useLocalSearchParams } from 'expo-router'
import { Button } from '@/components/ui/Button'
import { colors } from '@/constants/colors'
import { radius, shadows, spacing, getScreenPadding } from '@/constants/design'

export default function WelcomeScreen() {
  const { t, i18n } = useTranslation()
  const { role } = useLocalSearchParams<{ role?: string }>()
  const isLender = role === 'LENDER'
  const { width } = useWindowDimensions()
  const horizontalPadding = getScreenPadding(width)

  // Animations
  const contentAnim = useRef(new Animated.Value(0)).current
  const logoAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(logoAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      Animated.timing(contentAnim, { toValue: 1, duration: 800, delay: 300, useNativeDriver: true }),
    ]).start()
  }, [])

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'hi' ? 'en' : 'hi')
  }

  return (
    <View style={styles.container}>
      {/* Visual Background */}
      <View style={styles.bgWrapper}>
          <Image 
            source={{ uri: 'https://images.unsplash.com/photo-1590650516494-0c8e4a4dd67e?q=80&w=2071&auto=format&fit=crop' }} // Agriculture/Trust image
            style={styles.bgImage}
            blurRadius={2}
          />
          <View style={styles.overlay} />
      </View>

      <SafeAreaView style={[styles.safe, { paddingHorizontal: horizontalPadding }]}>
        <View style={styles.topRow}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.replace('/role-select' as any)}
          >
            <Ionicons name="chevron-back" size={24} color={colors.surface} />
          </TouchableOpacity>

          <TouchableOpacity onPress={toggleLanguage} style={styles.langBtn}>
            <Text style={styles.langBtnText}>
              {i18n.language === 'hi' ? 'EN' : 'हिंदी'}
            </Text>
          </TouchableOpacity>
        </View>

        <Animated.View style={[styles.hero, { opacity: logoAnim, transform: [{ scale: logoAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }] }]}>
            <View style={styles.logoCircle}>
                <Image 
                    source={require('../../assets/icon.png')} 
                    style={styles.logo}
                    resizeMode="cover"
                />
            </View>
            <Text style={styles.appName}>GramChain</Text>
            <Text style={styles.tagline}>
                Connecting rural communities to {'\n'}global finance
            </Text>
        </Animated.View>

        <Animated.View style={[styles.footer, { opacity: contentAnim, transform: [{ translateY: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [50, 0] }) }] }]}>
            <Text style={styles.welcomeText}>Welcome to the future of SHGs</Text>
            
            <View style={styles.btnGroup}>
                <Button
                    label={isLender ? 'START INVESTING' : 'GET STARTED'}
                    onPress={() => router.push((isLender ? '/lender-signup' : '/signup') as any)}
                    size="xl"
                    variant="primary"
                    style={[styles.mainBtn, isLender && { backgroundColor: colors.info[600] }]}
                />
                <TouchableOpacity 
                  style={styles.loginLink}
                  onPress={() => router.push((isLender ? '/lender-login' : '/login') as any)}
                >
                    <Text style={styles.loginLinkText}>
                        Already have an account? <Text style={styles.loginBold}>Log In</Text>
                    </Text>
                </TouchableOpacity>
            </View>

            <View style={styles.trustBadge}>
                <View style={styles.badgeLine} />
                <Text style={styles.trustText}>Securely build on Blockchain</Text>
                <View style={styles.badgeLine} />
            </View>
        </Animated.View>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary[900],
  },
  bgWrapper: {
    ...StyleSheet.absoluteFillObject,
  },
  bgImage: {
    width: '100%',
    height: '100%',
    opacity: 0.6,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.primary[900],
    opacity: 0.5,
  },
  safe: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  backBtn: {
    padding: 5,
  },
  langBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 6,
    paddingHorizontal: 15,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  langBtnText: {
    color: colors.surface,
    fontWeight: '700',
    fontSize: 14,
  },
  hero: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 60,
  },
  logoCircle: {
      width: 128,
      height: 128,
      borderRadius: 64,
      backgroundColor: colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
      ...shadows.lg,
  },
  logo: {
      width: 128,
      height: 128,
  },
  appName: {
      fontSize: 42,
      fontWeight: '900',
      color: colors.surface,
      marginTop: 20,
      letterSpacing: -1,
  },
  tagline: {
      fontSize: 18,
      color: colors.primary[100],
      textAlign: 'center',
      marginTop: 10,
      lineHeight: 28,
  },
  footer: {
      paddingBottom: 40,
  },
  welcomeText: {
      color: colors.surface,
      fontSize: 15,
      textAlign: 'center',
      marginBottom: 30,
      opacity: 0.8,
  },
  btnGroup: {
      gap: 20,
  },
  mainBtn: {
      height: 60,
      borderRadius: 30,
      backgroundColor: colors.secondary[500],
  },
  loginLink: {
      alignItems: 'center',
  },
  loginLinkText: {
      color: colors.surface,
      fontSize: 16,
  },
  loginBold: {
      fontWeight: '900',
      color: colors.secondary[400],
  },
  trustBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 40,
      justifyContent: 'center',
      opacity: 0.5,
  },
  badgeLine: {
      height: 1,
      width: 30,
      backgroundColor: colors.surface,
  },
  trustText: {
      color: colors.surface,
      fontSize: 12,
      marginHorizontal: 10,
      fontWeight: '600',
  }
})
