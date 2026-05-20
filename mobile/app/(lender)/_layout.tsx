import React from 'react'
import { Text, View, StyleSheet, Platform } from 'react-native'
import { Tabs } from 'expo-router'
import { colors } from '@/constants/colors'
import { shadows } from '@/constants/design'

// Lender shell uses dark theme — premium investor aesthetic
const LENDER_BG = colors.gray[900]
const LENDER_BORDER = colors.gray[800]
const LENDER_ACTIVE = colors.info[400]
const LENDER_INACTIVE = colors.gray[500]
const LENDER_DOT = colors.info[500]

// Tab icon component with active indicator dot
const TabIcon = ({ emoji, focused }: { emoji: string; focused: boolean }) => (
  <View style={styles.iconContainer}>
    <Text style={[styles.iconEmoji, focused && styles.iconEmojiActive]}>{emoji}</Text>
    {focused && <View style={styles.activeDot} />}
  </View>
)

/**
 * Lender Tab Layout — premium dark-themed tab bar for investors
 */
export default function LenderTabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown:         false,
        tabBarActiveTintColor:   LENDER_ACTIVE,
        tabBarInactiveTintColor: LENDER_INACTIVE,
        tabBarStyle:             styles.tabBar,
        tabBarLabelStyle:        styles.tabLabel,
        tabBarItemStyle:         styles.tabItem,
      }}
    >
      <Tabs.Screen
        name="portfolio"
        options={{
          title: 'Portfolio',
          tabBarIcon: ({ focused }) => <TabIcon emoji="💎" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="invest"
        options={{
          title: 'Invest',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📊" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="impact"
        options={{
          title: 'Impact',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🌍" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="lender-profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} />,
        }}
      />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor:   LENDER_BG,
    borderTopWidth:    1,
    borderTopColor:    LENDER_BORDER,
    height:            Platform.OS === 'ios' ? 88 : 64,
    paddingTop:        6,
    paddingBottom:     Platform.OS === 'ios' ? 24 : 8,
  },
  tabLabel: {
    fontSize:    11,
    fontWeight:  '600',
    letterSpacing: 0.1,
    marginTop:   2,
  },
  tabItem: {
    gap: 2,
  },
  iconContainer: {
    alignItems:     'center',
    justifyContent: 'center',
    height:         28,
  },
  iconEmoji: {
    fontSize:  20,
    opacity:   0.5,
  },
  iconEmojiActive: {
    opacity:  1.0,
    fontSize: 22,
  },
  activeDot: {
    marginTop:       3,
    width:           5,
    height:          5,
    borderRadius:    2.5,
    backgroundColor: LENDER_DOT,
  },
})
