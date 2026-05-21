import React, { useEffect, useState, useRef } from 'react'
import {
  View, Text, ScrollView, RefreshControl, StyleSheet, Animated,
  TouchableOpacity, Modal, TextInput, Alert, Share, FlatList, PanResponder
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { shgApi, loanApi, geoApi } from '@/services/api'
import { MemberCard } from '@/components/ui/MemberCard'
import {
  Card, Badge, StatCard, EmptyState, Divider,
  Skeleton, TrustBadge,
} from '@/components/ui/SharedComponents'
import { colors } from '@/constants/colors'
import { radius, shadows, spacing } from '@/constants/design'
import { useAuthStore } from '@/store/auth.store'
import { Ionicons } from '@expo/vector-icons'

export default function GroupScreen() {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const [shgs, setShgs] = useState<any[]>([])
  const [expandedShgId, setExpandedShgId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [approving, setApproving] = useState(false)

  // Modals state
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [createData, setCreateData] = useState({ name: '', district: '', state: '' })
  const [processing, setProcessing] = useState(false)

  // Geo data
  const [states, setStates] = useState<string[]>([])
  const [districts, setDistricts] = useState<string[]>([])
  const [showStateDropdown, setShowStateDropdown] = useState(false)
  const [showDistrictDropdown, setShowDistrictDropdown] = useState(false)

  // Invite modal
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const [selectedShgForInvite, setSelectedShgForInvite] = useState<any>(null)

  // Remove member
  const [removingMember, setRemovingMember] = useState<string | null>(null)

  // Dissolution
  const [dissolveStatuses, setDissolveStatuses] = useState<Record<string, any>>({})
  const [initiatingDissolve, setInitiatingDissolve] = useState(false)
  const [votingDissolve, setVotingDissolve] = useState<string | null>(null)
  const [deletingGroup, setDeletingGroup] = useState<string | null>(null)

  // Swipe to delete
  const [deleteModeShgId, setDeleteModeShgId] = useState<string | null>(null)
  const [swipeProgress, setSwipeProgress] = useState(0)

  // Store panResponders for each SHG
  const panRespondersRef = useRef<Record<string, any>>({}).current
  const deleteModeShgIdRef = useRef<string | null>(null)

  // Animation
  const fadeAnim = useRef(new Animated.Value(0)).current
  const shakeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    deleteModeShgIdRef.current = deleteModeShgId
  }, [deleteModeShgId])

  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null
    if (deleteModeShgId) {
      shakeAnim.setValue(0)
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(shakeAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: -1, duration: 80, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 0, duration: 80, useNativeDriver: true }),
        ])
      )
      animation.start()
    } else {
      shakeAnim.setValue(0)
    }
    return () => {
      if (animation) animation.stop()
    }
  }, [deleteModeShgId])

  const shakeRotate = shakeAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-10deg', '10deg'],
  })

  const shakeTranslate = shakeAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: [-3, 3],
  })

  const loadShgs = async () => {
    try {
      const res = await shgApi.getMyGroups()
      setShgs(res.data.data || [])
      // Expand first group by default if any
      if (res.data.data?.length > 0 && !expandedShgId) {
        setExpandedShgId(res.data.data[0].shg.id)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
      Animated.timing(fadeAnim, {
        toValue: 1, duration: 400, useNativeDriver: true,
      }).start()
    }
  }

  useEffect(() => { 
    loadShgs()
    loadStates()
  }, [])

  const loadStates = async () => {
    try {
      const res = await geoApi.getStates()
      setStates(res.data.data.states || [])
    } catch (e) {
      console.error('Failed to load states', e)
    }
  }

  const loadDistricts = async (state: string) => {
    try {
      const res = await geoApi.getDistricts(state)
      setDistricts(res.data.data.districts || [])
    } catch (e) {
      console.error('Failed to load districts', e)
    }
  }

  const onRefresh = async () => {
    setRefreshing(true)
    await loadShgs()
    setRefreshing(false)
  }

  const handleJoin = async () => {
    if (!joinCode) return Alert.alert('Error', 'Please enter a joining code')
    setProcessing(true)
    try {
      await shgApi.joinByCode(joinCode)
      Alert.alert('Success', 'Successfully joined the group!')
      setShowJoinModal(false)
      setJoinCode('')
      loadShgs()
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.error?.message || 'Failed to join group')
    } finally {
      setProcessing(false)
    }
  }

  const handleCreate = async () => {
    if (!createData.name || !createData.district || !createData.state) {
      return Alert.alert('Error', 'Please fill in all fields')
    }
    setProcessing(true)
    try {
      await shgApi.createGroup(createData)
      Alert.alert('Success', 'Group created successfully!')
      setShowCreateModal(false)
      setCreateData({ name: '', district: '', state: '' })
      loadShgs()
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.error?.message || 'Failed to create group')
    } finally {
      setProcessing(false)
    }
  }

  const handleApprove = async (loanId: string) => {
    setApproving(true)
    try {
      await loanApi.approveLoan(loanId)
      Alert.alert('Success', 'Loan approved! Being processed on-chain by our relayer.')
      loadShgs()
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error?.message || 'Failed to approve loan.')
    } finally {
      setApproving(false)
    }
  }

  const handleRemoveMember = (shgId: string, memberId: string, memberName: string) => {
    Alert.alert(
      'Remove Member',
      `Remove ${memberName} from this group? They will be notified.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            setRemovingMember(memberId)
            try {
              await shgApi.removeMember(shgId, memberId)
              Alert.alert('Done', `${memberName} has been removed from the group.`)
              loadShgs()
            } catch (e: any) {
              Alert.alert('Error', e.response?.data?.error?.message || 'Failed to remove member.')
            } finally {
              setRemovingMember(null)
            }
          }
        }
      ]
    )
  }

  const loadDissolveStatus = async (shgId: string) => {
    try {
      const res = await shgApi.getDissolveStatus(shgId)
      setDissolveStatuses(prev => ({ ...prev, [shgId]: res.data.data }))
    } catch { /* silent */ }
  }

  const handleInitiateDissolve = (shg: any) => {
    Alert.alert(
      '⚠️ Dissolve Group',
      `This will start a vote to permanently dissolve "${shg.name}". All members will be notified and must vote. This cannot be undone if majority votes YES.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start Vote', style: 'destructive',
          onPress: async () => {
            setInitiatingDissolve(true)
            try {
              await shgApi.initiateDissolve(shg.id)
              Alert.alert('Vote Started', 'Members have been notified to vote.')
              loadShgs()
              loadDissolveStatus(shg.id)
            } catch (e: any) {
              Alert.alert('Error', e.response?.data?.error?.message || 'Failed to start dissolution vote.')
            } finally {
              setInitiatingDissolve(false)
            }
          }
        }
      ]
    )
  }

  const handleVoteDissolve = async (shgId: string, vote: boolean) => {
    setVotingDissolve(shgId + (vote ? '-yes' : '-no'))
    try {
      const res = await shgApi.voteDissolve(shgId, vote)
      const { status, message } = res.data.data
      Alert.alert(
        status === 'DISSOLVED' ? 'Group Dissolved' : status === 'CANCELLED' ? 'Vote Cancelled' : 'Vote Recorded',
        message
      )
      loadShgs()
      if (status !== 'DISSOLVED') loadDissolveStatus(shgId)
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error?.message || 'Failed to submit vote.')
    } finally {
      setVotingDissolve(null)
    }
  }

  const handleDeleteGroup = (shg: any) => {
    Alert.alert(
      'Delete Group',
      `You are the only member in "${shg.name}". Do you want to permanently delete this group? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            setDeletingGroup(shg.id)
            try {
              await shgApi.deleteGroup(shg.id)
              Alert.alert('Deleted', 'Group has been permanently deleted.')
              loadShgs()
            } catch (e: any) {
              Alert.alert('Error', e.response?.data?.error?.message || 'Failed to delete group.')
            } finally {
              setDeletingGroup(null)
            }
          }
        }
      ]
    )
  }

  const handleGenerateInvite = async (shg: any) => {
    setSelectedShgForInvite(shg)
    setInviteCode('')
    setShowInviteModal(true)
    try {
      const res = await shgApi.generateInvite(shg.id)
      setInviteCode(res.data.data.inviteCode || res.data.data.code || '')
    } catch {
      setInviteCode(shg.inviteCode || 'N/A')
    }
  }

  const handleShareInvite = async () => {
    if (!inviteCode) return
    await Share.share({
      message: `Join our SHG "${selectedShgForInvite?.name}" on GramChain!\nInvite code: ${inviteCode}`,
      title: 'Join my SHG on GramChain',
    })
  }

  const toggleExpand = (id: string) => {
    setExpandedShgId(prev => (prev === id ? null : id))
    if (expandedShgId !== id) loadDissolveStatus(id)
  }

  const handleLongPress = (shgId: string) => {
    // Only allow entering delete mode if the group is closed (not expanded)
    if (expandedShgId === shgId) return

    if (deleteModeShgId === shgId) {
      setDeleteModeShgId(null)
      setSwipeProgress(0)
    } else {
      setDeleteModeShgId(shgId)
      setSwipeProgress(0)
    }
  }

  const handleSwipeDelete = (shg: any, memberCount: number) => {
    if (memberCount === 1) {
      Alert.alert(
        'Delete Group',
        `You are the only member in "${shg.name}". Do you want to permanently delete this group? This action cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => { setDeleteModeShgId(null); setSwipeProgress(0) } },
          {
            text: 'Delete', style: 'destructive',
            onPress: async () => {
              setDeletingGroup(shg.id)
              try {
                await shgApi.deleteGroup(shg.id)
                Alert.alert('Deleted', 'Group has been permanently deleted.')
                setDeleteModeShgId(null)
                setSwipeProgress(0)
                loadShgs()
              } catch (e: any) {
                Alert.alert('Error', e.response?.data?.error?.message || 'Failed to delete group.')
                setDeleteModeShgId(null)
                setSwipeProgress(0)
              } finally {
                setDeletingGroup(null)
              }
            }
          }
        ]
      )
    } else {
      Alert.alert(
        'Request Group Dissolution',
        `This will start a vote to permanently dissolve "${shg.name}". All members will be notified and must vote. This cannot be undone if majority votes YES.`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => { setDeleteModeShgId(null); setSwipeProgress(0) } },
          {
            text: 'Start Vote', style: 'destructive',
            onPress: async () => {
              setInitiatingDissolve(true)
              try {
                await shgApi.initiateDissolve(shg.id)
                Alert.alert('Vote Started', 'Members have been notified to vote.')
                setDeleteModeShgId(null)
                setSwipeProgress(0)
                loadShgs()
                loadDissolveStatus(shg.id)
              } catch (e: any) {
                Alert.alert('Error', e.response?.data?.error?.message || 'Failed to start dissolution vote.')
                setDeleteModeShgId(null)
                setSwipeProgress(0)
              } finally {
                setInitiatingDissolve(false)
              }
            }
          }
        ]
      )
    }
  }

  const DropdownPicker = ({
    value, placeholder, items, onSelect, visible, setVisible,
  }: {
    value: string; placeholder: string; items: string[]
    onSelect: (v: string) => void; visible: boolean; setVisible: (v: boolean) => void
  }) => (
    <View>
      <TouchableOpacity style={styles.dropdownTrigger} onPress={() => setVisible(!visible)}>
        <Text style={[styles.dropdownValue, !value && { color: colors.gray[400] }]}>
          {value || placeholder}
        </Text>
        <Ionicons name={visible ? 'chevron-up' : 'chevron-down'} size={18} color={colors.gray[500]} />
      </TouchableOpacity>
      {visible && (
        <View style={styles.dropdownList}>
          <ScrollView nestedScrollEnabled style={{ maxHeight: 180 }}>
            {items.map(item => (
              <TouchableOpacity
                key={item}
                style={[styles.dropdownItem, value === item && styles.dropdownItemSelected]}
                onPress={() => { onSelect(item); setVisible(false) }}
              >
                <Text style={[styles.dropdownItemText, value === item && { color: colors.primary[700], fontWeight: '700' }]}>
                  {item}
                </Text>
                {value === item && <Ionicons name="checkmark" size={16} color={colors.primary[600]} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  )

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
            tintColor={colors.primary[500]} colors={[colors.primary[500]]} />
        }
      >
        <Animated.View style={{ opacity: fadeAnim }}>

          {/* ── Page Header ── */}
          <View style={styles.pageHeader}>
            <View>
              <Text style={styles.pageTitle}>My Groups</Text>
              <Text style={styles.pageSubtitle}>
                {loading ? '...' : `${shgs.length} group${shgs.length !== 1 ? 's' : ''} joined`}
              </Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.headerBtn} onPress={() => setShowJoinModal(true)}>
                <Ionicons name="enter-outline" size={20} color={colors.primary[700]} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.headerBtn, { backgroundColor: colors.primary[600], marginLeft: 8 }]}
                onPress={() => setShowCreateModal(true)}
              >
                <Ionicons name="add" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Skeleton ── */}
          {loading && [1, 2].map(i => (
            <View key={i} style={[styles.groupHeaderSkeleton, shadows.sm]}>
              <Skeleton width="60%" height={22} />
              <Skeleton width="40%" height={14} style={{ marginTop: 8 }} />
            </View>
          ))}

          {/* ── Empty State ── */}
          {!loading && shgs.length === 0 && (
            <View style={styles.emptyContainer}>
              <EmptyState
                icon="👥"
                title={t('group.noGroups', { defaultValue: 'No group yet' })}
                subtitle="Join or create a Self-Help Group to access group loans and collective savings"
                action={{ label: 'Create a Group', onPress: () => setShowCreateModal(true) }}
              />
              <TouchableOpacity style={styles.joinCodeBtn} onPress={() => setShowJoinModal(true)}>
                <Ionicons name="enter-outline" size={16} color={colors.primary[700]} />
                <Text style={styles.joinCodeBtnText}>Join with Invite Code</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Group Accordions ── */}
          {!loading && shgs.map((membership: any) => {
            const shg = membership.shg ?? membership
            const isExpanded = expandedShgId === shg.id
            const members: any[] = shg.members || []
            const memberCount = members.length
            const isLeader = members.some((m: any) => m.userId === user?.id && m.role === 'LEADER')
            const pendingLoans = (shg.loans || []).filter((l: any) => l.status === 'PENDING')
            const isInDeleteMode = deleteModeShgId === shg.id

            // Create panResponder if not exists
            if (!panRespondersRef[shg.id]) {
              panRespondersRef[shg.id] = PanResponder.create({
                onStartShouldSetPanResponder: () => deleteModeShgIdRef.current === shg.id,
                onMoveShouldSetPanResponder: () => deleteModeShgIdRef.current === shg.id,
                onPanResponderMove: (_, gestureState) => {
                  if (gestureState.dx < 0) {
                    const progress = Math.min(Math.abs(gestureState.dx) / 150, 1)
                    setSwipeProgress(progress)
                  }
                },
                onPanResponderRelease: (_, gestureState) => {
                  if (gestureState.dx < -100) {
                    handleSwipeDelete(shg, memberCount)
                  } else {
                    setSwipeProgress(0)
                  }
                },
                onPanResponderTerminate: () => {
                  setSwipeProgress(0)
                },
              })
            }

            const panResponder = panRespondersRef[shg.id]

            return (
              <View key={shg.id} style={[styles.accordionContainer, shadows.sm]}>
                {/* ── Accordion Header (always visible) ── */}
                <View
                  {...panResponder.panHandlers}
                  style={[
                    styles.accordionHeader,
                    isExpanded && styles.accordionHeaderExpanded,
                    isInDeleteMode && styles.accordionHeaderDeleteMode
                  ]}
                >
                  <TouchableOpacity
                    style={styles.headerTouchable}
                    onPress={() => toggleExpand(shg.id)}
                    onLongPress={() => handleLongPress(shg.id)}
                    delayLongPress={2000} // hold for 2 seconds to trigger
                    activeOpacity={0.85}
                  >
                    {isInDeleteMode ? (
                      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Animated.View
                          style={[
                            styles.groupInfo,
                            {
                              transform: [
                                { translateX: -swipeProgress * 120 },
                                { scale: 1 - swipeProgress * 0.3 }
                              ],
                              opacity: 1 - swipeProgress,
                            }
                          ]}
                        >
                          <Text style={[styles.groupName, { color: '#fff' }]}>
                            {shg.name}
                          </Text>
                          <Text style={[styles.groupLocation, { color: 'rgba(255,255,255,0.9)', fontWeight: '700' }]}>
                            ➔ {t('group.swipeToDelete', { defaultValue: 'Swipe left to delete' })}
                          </Text>
                        </Animated.View>

                        <Animated.View
                          style={[
                            styles.tremblingBinContainer,
                            {
                              transform: [
                                { rotate: shakeRotate },
                                { translateX: shakeTranslate },
                                { scale: 1.0 + swipeProgress * 0.3 }
                              ]
                            }
                          ]}
                        >
                          <Ionicons name="trash" size={24} color="#dc2626" />
                        </Animated.View>
                      </View>
                    ) : (
                      <>
                        <View style={[styles.groupLogo, isExpanded && styles.groupLogoExpanded]}>
                          <Text style={styles.groupLogoText}>
                            {shg.name?.charAt(0)?.toUpperCase() || 'S'}
                          </Text>
                        </View>
                        <View style={styles.groupInfo}>
                          <Text style={[styles.groupName, isExpanded && { color: '#fff' }]}>
                            {shg.name}
                          </Text>
                          <Text style={[styles.groupLocation, isExpanded && { color: 'rgba(255,255,255,0.7)' }]}>
                            📍 {shg.district}{shg.state ? `, ${shg.state}` : ''}
                          </Text>
                        </View>
                        <View style={styles.accordionMeta}>
                          <Text style={[styles.accordionMemberCount, isExpanded && { color: 'rgba(255,255,255,0.8)' }]}>
                            {memberCount} members
                          </Text>
                          <Ionicons
                            name={isExpanded ? 'chevron-up' : 'chevron-down'}
                            size={20}
                            color={isExpanded ? '#fff' : colors.gray[400]}
                          />
                        </View>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                {/* ── Accordion Body ── */}
                {isExpanded && (
                  <View style={styles.accordionBody}>

                    {/* Stats row */}
                    <View style={styles.groupStats}>
                      <View style={styles.statItem}>
                        <Text style={styles.statValue}>{memberCount}</Text>
                        <Text style={styles.statLabel}>Members</Text>
                      </View>
                      <View style={styles.statDivider} />
                      <View style={styles.statItem}>
                        <Text style={styles.statValue}>{pendingLoans.length}</Text>
                        <Text style={styles.statLabel}>Pending</Text>
                      </View>
                      <View style={styles.statDivider} />
                      <View style={styles.statItem}>
                        <Text style={[styles.statValue, { fontSize: 13 }]}>
                          {isLeader ? '👑 Leader' : '👤 Member'}
                        </Text>
                        <Text style={styles.statLabel}>Your Role</Text>
                      </View>
                    </View>

                    {/* Invite button */}
                    <TouchableOpacity
                      style={styles.inviteBtn}
                      onPress={() => handleGenerateInvite(shg)}
                    >
                      <Ionicons name="share-social-outline" size={16} color={colors.primary[700]} />
                      <Text style={styles.inviteBtnText}>Share Invite Code</Text>
                    </TouchableOpacity>

                    {/* ── Dissolution Vote Panel ── */}
                    {(() => {
                      const ds = dissolveStatuses[shg.id]
                      if (!ds) return null
                      if (!ds.isActive) return (
                        <View style={styles.dissolvedBanner}>
                          <Text style={styles.dissolvedBannerText}>🚫 This group has been dissolved</Text>
                        </View>
                      )
                      if (ds.voteInProgress && ds.myVote === null) return (
                        <View style={styles.dissolveCard}>
                          <Text style={styles.dissolveCardTitle}>⚠️ Dissolution Vote in Progress</Text>
                          <Text style={styles.dissolveCardBody}>
                            {ds.yesVotes} of {ds.totalMembers} voted YES · {ds.noVotes} voted NO
                          </Text>
                          <Text style={styles.dissolveCardHint}>Cast your vote:</Text>
                          <View style={styles.dissolveVoteRow}>
                            <TouchableOpacity
                              style={[styles.voteYesBtn, votingDissolve === shg.id + '-yes' && { opacity: 0.6 }]}
                              onPress={() => handleVoteDissolve(shg.id, true)}
                              disabled={!!votingDissolve}
                            >
                              <Text style={styles.voteBtnText}>✅ Yes, Dissolve</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.voteNoBtn, votingDissolve === shg.id + '-no' && { opacity: 0.6 }]}
                              onPress={() => handleVoteDissolve(shg.id, false)}
                              disabled={!!votingDissolve}
                            >
                              <Text style={styles.voteBtnText}>🚫 No, Keep Group</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )
                      if (ds.voteInProgress && ds.myVote !== null) return (
                        <View style={[styles.dissolveCard, { backgroundColor: '#fef9c3' }]}>
                          <Text style={styles.dissolveCardTitle}>⏳ Vote In Progress</Text>
                          <Text style={styles.dissolveCardBody}>
                            You voted {ds.myVote ? 'YES' : 'NO'} · {ds.yesVotes}/{ds.totalMembers} YES · {ds.noVotes}/{ds.totalMembers} NO
                          </Text>
                          <Text style={styles.dissolveCardHint}>Waiting for other members to vote…</Text>
                        </View>
                      )
                      return null
                    })()}

                    {/* Leader: start dissolution OR delete if sole member */}
                    {isLeader && !dissolveStatuses[shg.id]?.voteInProgress && dissolveStatuses[shg.id]?.isActive && (
                      <>
                        {memberCount === 1 ? (
                          <TouchableOpacity
                            style={[styles.dissolveBtn, { backgroundColor: colors.danger[600] }]}
                            onPress={() => handleDeleteGroup(shg)}
                            disabled={deletingGroup === shg.id}
                          >
                            <Ionicons name="trash-outline" size={16} color="#fff" />
                            <Text style={styles.dissolveBtnText}>
                              {deletingGroup === shg.id ? 'Deleting...' : 'Delete Group'}
                            </Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            style={styles.dissolveBtn}
                            onPress={() => handleInitiateDissolve(shg)}
                            disabled={initiatingDissolve}
                          >
                            <Ionicons name="warning-outline" size={16} color={colors.danger[600]} />
                            <Text style={styles.dissolveBtnText}>
                              {initiatingDissolve ? 'Starting Vote…' : 'Request Group Dissolution'}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </>
                    )}

                    {/* Leader: pending approvals */}
                    {isLeader && pendingLoans.length > 0 && (
                      <View style={styles.pendingSection}>
                        <Text style={styles.pendingSectionTitle}>⚡ Pending Approvals</Text>
                        {pendingLoans.map((loan: any) => (
                          <View key={loan.id} style={styles.pendingCard}>
                            <View style={styles.pendingHeader}>
                              <Text style={styles.pendingTitle}>Loan Request</Text>
                              <Badge label="New" variant="warning" size="sm" />
                            </View>
                            <Text style={styles.pendingText}>
                              {loan.member?.name || 'A member'} requesting
                              {' '}₹{Number(loan.amount).toLocaleString('en-IN')}
                              {' '}for {loan.purpose || 'general purposes'}.
                            </Text>
                            <TouchableOpacity
                              style={styles.approveBtn}
                              onPress={() => handleApprove(loan.id)}
                              disabled={approving}
                            >
                              <Text style={styles.approveBtnText}>
                                {approving ? 'Processing...' : 'Approve Gasless ⚡'}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Members list */}
                    <Text style={styles.membersSectionTitle}>
                      Members ({memberCount})
                    </Text>
                    {members.map((m: any) => {
                      const isCurrentUser = m.userId === user?.id
                      const memberName = m.user?.name || m.name || 'Member'
                      return (
                        <View key={m.userId} style={styles.memberRow}>
                          <View style={styles.memberCardWrap}>
                            <MemberCard member={m} />
                          </View>
                          {isLeader && !isCurrentUser && (
                            <TouchableOpacity
                              style={[styles.removeBtn, removingMember === m.userId && { opacity: 0.5 }]}
                              onPress={() => handleRemoveMember(shg.id, m.userId, memberName)}
                              disabled={removingMember === m.userId}
                              accessibilityLabel={`Remove ${memberName}`}
                            >
                              <Ionicons name="person-remove-outline" size={18} color={colors.danger[500]} />
                            </TouchableOpacity>
                          )}
                        </View>
                      )
                    })}

                  </View>
                )}
              </View>
            )
          })}

          {/* ── Invite Modal ── */}
          <Modal visible={showInviteModal} transparent animationType="fade">
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Invite to {selectedShgForInvite?.name}</Text>
                <Text style={styles.inviteSubtitle}>
                  Share this code with people you want to invite to the group
                </Text>
                <View style={styles.inviteCodeBox}>
                  {inviteCode ? (
                    <Text style={styles.inviteCodeText}>{inviteCode}</Text>
                  ) : (
                    <Text style={[styles.inviteCodeText, { color: colors.gray[400], fontSize: 14 }]}>
                      Generating...
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  style={[styles.submitBtn, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 }]}
                  onPress={handleShareInvite}
                  disabled={!inviteCode}
                >
                  <Ionicons name="share-social" size={18} color="#fff" />
                  <Text style={styles.submitBtnText}>Share via Apps</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cancelBtnRow}
                  onPress={() => setShowInviteModal(false)}
                >
                  <Text style={[styles.cancelBtnText, { textAlign: 'center' }]}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* ── Join Modal ── */}
          <Modal visible={showJoinModal} transparent animationType="slide">
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Join a Group</Text>
                <Text style={styles.inviteSubtitle}>
                  Enter the invite code shared by a group member
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. ABC123"
                  placeholderTextColor={colors.gray[400]}
                  value={joinCode}
                  onChangeText={setJoinCode}
                  autoCapitalize="characters"
                  maxLength={8}
                />
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.cancelBtnRow} onPress={() => setShowJoinModal(false)}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.submitBtn} onPress={handleJoin} disabled={processing}>
                    <Text style={styles.submitBtnText}>{processing ? 'Joining...' : 'Join Group'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          {/* ── Create Modal ── */}
          <Modal visible={showCreateModal} transparent animationType="slide">
            <View style={styles.modalOverlay}>
              <ScrollView keyboardShouldPersistTaps="handled">
                <View style={[styles.modalContent, { marginTop: 80, marginBottom: 40 }]}>
                  <Text style={styles.modalTitle}>Create a Group</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Group Name *"
                    placeholderTextColor={colors.gray[400]}
                    value={createData.name}
                    onChangeText={(v) => setCreateData(prev => ({ ...prev, name: v }))}
                  />

                  <Text style={styles.dropdownLabel}>State *</Text>
                  <DropdownPicker
                    value={createData.state}
                    placeholder="Select State"
                    items={states}
                    visible={showStateDropdown}
                    setVisible={setShowStateDropdown}
                    onSelect={(v) => {
                      setCreateData(prev => ({ ...prev, state: v, district: '' }))
                      setDistricts([])
                      loadDistricts(v)
                    }}
                  />

                  <Text style={[styles.dropdownLabel, { marginTop: 12 }]}>District *</Text>
                  <DropdownPicker
                    value={createData.district}
                    placeholder={createData.state ? 'Select District' : 'Select a state first'}
                    items={districts}
                    visible={showDistrictDropdown}
                    setVisible={(v) => { if (createData.state) setShowDistrictDropdown(v) }}
                    onSelect={(v) => setCreateData(prev => ({ ...prev, district: v }))}
                  />

                  <View style={[styles.modalActions, { marginTop: 20 }]}>
                    <TouchableOpacity
                      style={styles.cancelBtnRow}
                      onPress={() => {
                        setShowCreateModal(false)
                        setShowStateDropdown(false)
                        setShowDistrictDropdown(false)
                      }}
                    >
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.submitBtn} onPress={handleCreate} disabled={processing}>
                      <Text style={styles.submitBtnText}>{processing ? 'Creating...' : 'Create Group'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            </View>
          </Modal>

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
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 12,
    paddingBottom: 100,
  },

  // ── Page Header ──
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text.primary,
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Skeleton ──
  groupHeaderSkeleton: {
    backgroundColor: colors.gray[100],
    borderRadius: radius['2xl'],
    padding: 24,
    marginBottom: 12,
  },

  // ── Empty State ──
  emptyContainer: {
    paddingTop: 40,
  },
  joinCodeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.primary[300],
    backgroundColor: colors.primary[50],
  },
  joinCodeBtnText: {
    color: colors.primary[700],
    fontWeight: '700',
    fontSize: 15,
  },

  // ── Accordion ──
  accordionContainer: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.gray[100],
    backgroundColor: colors.surface,
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    backgroundColor: colors.surface,
  },
  accordionHeaderExpanded: {
    backgroundColor: '#0f6b30',
  },
  accordionBody: {
    padding: 16,
    paddingTop: 8,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.gray[100],
  },
  accordionMeta: {
    alignItems: 'flex-end',
    gap: 4,
  },
  headerDeleteBtn: {
    padding: 8,
    borderRadius: radius.sm,
  },
  headerTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  accordionHeaderDeleteMode: {
    backgroundColor: '#dc2626',
  },
  tremblingBinContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  deleteOverlay: {
    position: 'absolute',
    right: 16,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  deleteBin: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.danger[100],
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.danger[400],
  },
  accordionMemberCount: {
    fontSize: 11,
    color: colors.text.tertiary,
    fontWeight: '600',
  },

  // ── Group Logo ──
  groupLogo: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.primary[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupLogoExpanded: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  groupLogoText: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.primary[700],
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text.primary,
    letterSpacing: -0.3,
  },
  groupLocation: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },

  // ── Group Stats (inside accordion) ──
  groupStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    marginBottom: 12,
    backgroundColor: colors.gray[50],
    borderRadius: radius.md,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text.primary,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.gray[200],
    marginVertical: 4,
  },

  // ── Invite Button ──
  inviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.primary[200],
    backgroundColor: colors.primary[50],
    marginBottom: 16,
  },
  inviteBtnText: {
    color: colors.primary[700],
    fontWeight: '700',
    fontSize: 14,
  },

  // ── Pending Section ──
  pendingSection: {
    marginBottom: 16,
  },
  pendingSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#92400e',
    marginBottom: 10,
  },
  pendingCard: {
    backgroundColor: '#fffbeb',
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  pendingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  pendingTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400e',
  },
  pendingText: {
    fontSize: 13,
    color: '#b45309',
    lineHeight: 20,
    marginBottom: 12,
  },
  approveBtn: {
    backgroundColor: '#d97706',
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  approveBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },

  // ── Members Section Title ──
  membersSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text.primary,
    marginBottom: 10,
  },

  // ── Footer ──
  footerSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },

  // ── Modals ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 24,
    ...shadows.lg,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
    color: colors.text.primary,
  },
  inviteSubtitle: {
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: 20,
    lineHeight: 20,
  },
  inviteCodeBox: {
    backgroundColor: colors.primary[50],
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.primary[200],
    paddingVertical: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  inviteCodeText: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.primary[700],
    letterSpacing: 6,
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.gray[200],
    borderRadius: radius.md,
    padding: 13,
    marginBottom: 16,
    fontSize: 16,
    color: colors.text.primary,
    backgroundColor: colors.background,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
  },
  cancelBtnRow: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  cancelBtnText: {
    color: colors.gray[500],
    fontWeight: '600',
    fontSize: 15,
  },
  submitBtn: {
    backgroundColor: colors.primary[600],
    paddingVertical: 11,
    paddingHorizontal: 22,
    borderRadius: radius.md,
  },
  submitBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },

  // ── Dropdown ──
  dropdownLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.secondary,
    marginBottom: 6,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.gray[200],
    borderRadius: radius.md,
    paddingHorizontal: 13,
    paddingVertical: 12,
    backgroundColor: colors.background,
    marginBottom: 4,
  },
  dropdownValue: {
    fontSize: 15,
    color: colors.text.primary,
  },
  dropdownList: {
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    marginBottom: 4,
    overflow: 'hidden',
    ...shadows.sm,
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  dropdownItemSelected: {
    backgroundColor: colors.primary[50],
  },
  dropdownItemText: {
    fontSize: 14,
    color: colors.text.primary,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  memberCardWrap: {
    flex: 1,
  },
  removeBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.danger[50] ?? '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.danger[100],
  },
  // ── Dissolution ──
  dissolveBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             6,
    marginTop:       12,
    paddingVertical: 10,
    borderRadius:    10,
    borderWidth:     1.5,
    borderColor:     colors.danger[400],
    backgroundColor: colors.danger[50],
  },
  dissolveBtnText: {
    fontSize:   13,
    fontWeight: '700',
    color:      colors.danger[600],
  },
  dissolvedBanner: {
    marginTop:      12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius:   10,
    backgroundColor: colors.danger[100],
    alignItems:     'center',
  },
  dissolvedBannerText: {
    fontSize:   13,
    fontWeight: '700',
    color:      colors.danger[700],
  },
  dissolveCard: {
    marginTop:      12,
    padding:        14,
    borderRadius:   12,
    backgroundColor: '#fff7ed',
    borderWidth:    1,
    borderColor:    '#fed7aa',
  },
  dissolveCardTitle: {
    fontSize:   14,
    fontWeight: '800',
    color:      '#9a3412',
    marginBottom: 4,
  },
  dissolveCardBody: {
    fontSize:   13,
    color:      '#7c3a00',
    marginBottom: 6,
  },
  dissolveCardHint: {
    fontSize:   12,
    color:      '#92400e',
    marginBottom: 10,
  },
  dissolveVoteRow: {
    flexDirection: 'row',
    gap:           10,
  },
  voteYesBtn: {
    flex:           1,
    paddingVertical: 10,
    borderRadius:   10,
    backgroundColor: '#16a34a',
    alignItems:     'center',
  },
  voteNoBtn: {
    flex:           1,
    paddingVertical: 10,
    borderRadius:   10,
    backgroundColor: colors.danger[600],
    alignItems:     'center',
  },
  voteBtnText: {
    fontSize:   13,
    fontWeight: '700',
    color:      '#fff',
  },
})
