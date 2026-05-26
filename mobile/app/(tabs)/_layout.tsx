import React from 'react'
import { Text, View, StyleSheet, Platform } from 'react-native'
import { Tabs } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { colors } from '@/constants/colors'
import { shadows } from '@/constants/design'

// Tab icon component with active indicator dot
const TabIcon = ({ emoji, focused, label }: { emoji: string; focused: boolean; label: string }) => (
  <View style={styles.iconContainer} accessibilityLabel={label} accessibilityRole="button">
    <Text style={[styles.iconEmoji, focused && styles.iconEmojiActive]}>{emoji}</Text>
    {focused && <View style={styles.activeDot} />}
  </View>
)

export default function TabLayout() {
  const { t } = useTranslation()

  return (
    <Tabs
      screenOptions={{
        headerShown:         false,
        tabBarActiveTintColor:   colors.primary[600],
        tabBarInactiveTintColor: colors.gray[400],
        tabBarStyle:             styles.tabBar,
        tabBarLabelStyle:        styles.tabLabel,
        tabBarItemStyle:         styles.tabItem,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home', { defaultValue: 'Home' }),
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} label="Home" />,
        }}
      />
      <Tabs.Screen
        name="borrow"
        options={{
          title: t('tabs.borrow', { defaultValue: 'Borrow' }),
          tabBarIcon: ({ focused }) => <TabIcon emoji="💸" focused={focused} label="Borrow" />,
        }}
      />
      <Tabs.Screen
        name="group"
        options={{
          title: t('tabs.group', { defaultValue: 'Group' }),
          tabBarIcon: ({ focused }) => <TabIcon emoji="👥" focused={focused} label="Group" />,
        }}
      />
      <Tabs.Screen
        name="schemes"
        options={{
          title: t('tabs.schemes', { defaultValue: 'Schemes' }),
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏛️" focused={focused} label="Schemes" />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile', { defaultValue: 'Profile' }),
          tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} label="Profile" />,
        }}
      />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor:   colors.surface,
    borderTopWidth:    1,
    borderTopColor:    colors.gray[100],
    height:            Platform.OS === 'ios' ? 88 : 64,
    paddingTop:        6,
    paddingBottom:     Platform.OS === 'ios' ? 24 : 8,
    ...shadows.sm,
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
    opacity:   0.65,
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
    backgroundColor: colors.primary[500],
  },
})
