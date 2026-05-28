import { prisma } from '@/lib/prisma'
import { AppError } from '@/middleware/error.middleware'
import { createPoolOnChain } from './blockchain.service'
import { enqueueOutboxJob } from './outbox.service'
import { getRedis } from '@/lib/redis'
import crypto from 'crypto'

/**
 * Generate a random 6-character alphanumeric invite code
 */
const generateInviteCode = (): string => {
  return crypto.randomBytes(4).toString('base64url').slice(0, 6).toUpperCase()
}

/**
 * Create a new SHG group, set creator as LEADER, and deploy on-chain pool
 */
export const createSHG = async (params: {
  name: string
  district: string
  state: string
  village?: string
  description?: string
  creatorId: string
}) => {
  const { creatorId, ...groupData } = params

  // Get creator's wallet address for on-chain pool
  const creator = await prisma.user.findUnique({ where: { id: creatorId } })

  // Deploy SHGPool on-chain via factory
  let poolContractAddress: string | undefined
  try {
    const memberAddresses = creator?.walletAddress ? [creator.walletAddress] : []
    if (memberAddresses.length > 0) {
      const result = await createPoolOnChain({
        memberAddresses,
        quorum: 1, // Single member initially, quorum = 1
        name: groupData.name,
      })
      poolContractAddress = result.poolAddress
      console.log(`🔗 SHG Pool deployed on-chain: ${poolContractAddress}`)
    }
  } catch (err) {
    console.warn('⚠️  On-chain pool creation failed (continuing):', (err as Error).message)
  }

  const group = await prisma.$transaction(async (tx) => {
    const g = await tx.sHGGroup.create({
      data: {
        ...groupData,
        poolContractAddress,
        members: {
          create: { userId: creatorId, role: 'LEADER' },
        },
      },
      include: { members: { include: { user: true } } },
    })

    // Sync the creator's LEADER status to LoanManager on-chain so they can
    // approve loans through the relayer path. Only meaningful if they have a wallet.
    if (creator?.walletAddress) {
      await enqueueOutboxJob(tx, 'grant-leader-role', {
        leaderAddress: creator.walletAddress,
      })
    }

    return g
  })

  return group
}

/**
 * Join an existing SHG group as a MEMBER
 */
export const joinSHG = async (userId: string, shgId: string) => {
  const group = await prisma.sHGGroup.findUnique({ where: { id: shgId } })
  if (!group) throw new AppError(404, 'SHG_NOT_FOUND', 'SHG group not found')

  const existing = await prisma.sHGMember.findUnique({
    where: { userId_shgId: { userId, shgId } },
  })
  if (existing) throw new AppError(409, 'ALREADY_MEMBER', 'You are already a member of this group')

  const user = await prisma.user.findUnique({ where: { id: userId } })

  const newMember = await prisma.$transaction(async (tx) => {
    const m = await tx.sHGMember.create({
      data: { userId, shgId, role: 'MEMBER' },
      include: { shg: true, user: true },
    })

    // Sync to on-chain SHGPool if both pool and user wallet exist.
    // Worker will skip silently if either is missing.
    if (group.poolContractAddress && user?.walletAddress) {
      await enqueueOutboxJob(tx, 'add-pool-member', {
        poolAddress: group.poolContractAddress,
        memberAddress: user.walletAddress,
      })
    }

    return m
  })

  // Invalidate cache
  const redis = await getRedis()
  if (redis) await redis.del(`shg:${shgId}`)

  return newMember
}

/**
 * Get SHG details with members and recent meetings (Cached 60s)
 */
export const getSHGById = async (shgId: string) => {
  const redis = await getRedis()
  const cacheKey = `shg:${shgId}`

  if (redis) {
    const cached = await redis.get(cacheKey)
    if (cached) return JSON.parse(cached)
  }

  const group = await prisma.sHGGroup.findUnique({
    where: { id: shgId },
    include: {
      members: { include: { user: { select: { id: true, phone: true, name: true, walletAddress: true } } } },
      meetings: { orderBy: { heldAt: 'desc' }, take: 5 },
      loans: {
        include: { member: { select: { id: true, name: true } } },
        where: { status: { in: ['ACTIVE', 'APPROVED', 'PENDING', 'REPAID'] } },
        orderBy: { createdAt: 'desc' },
      },
      fundingRequests: {
        include: {
          investments: {
            where: { status: 'APPROVED' },
            include: { lender: { select: { id: true, name: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })
  if (!group) throw new AppError(404, 'SHG_NOT_FOUND', 'SHG group not found')

  // Compute pool balance from ledger
  const sumResult = await prisma.ledgerEntry.aggregate({
    where: { entityType: 'SHG', entityId: shgId },
    _sum: { amountPaise: true },
  })
  const poolBalancePaise = sumResult._sum.amountPaise ?? 0
  const totalLenderFunds = group.fundingRequests.reduce((sum: number, req: any) => {
    return sum + req.investments.reduce((s: number, inv: any) => s + Number(inv.amount), 0)
  }, 0)
  const recentTxns = await prisma.ledgerEntry.findMany({
    where: { entityType: 'SHG', entityId: shgId },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })

  const enriched = {
    ...group,
    poolBalance: poolBalancePaise / 100,
    poolTransactions: recentTxns,
  }

  if (redis) {
    await redis.setEx(cacheKey, 60, JSON.stringify(enriched))
  }

  return enriched
}

/**
 * Get all SHG groups a user belongs to
 */
export const getUserSHGs = async (userId: string) => {
  const memberships = await prisma.sHGMember.findMany({
    where: { userId },
    include: {
      shg: {
        include: {
          members: { include: { user: { select: { id: true, name: true, phone: true } } } },
          loans: {
            include: { member: { select: { id: true, name: true } } },
            where: { status: { in: ['ACTIVE', 'APPROVED', 'PENDING', 'REPAID'] } },
            orderBy: { createdAt: 'desc' },
          },
          fundingRequests: {
            include: {
              investments: {
                where: { status: 'APPROVED' },
                include: { lender: { select: { id: true, name: true } } },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      },
    },
  })

  // Augment each membership with poolBalance from ledger
  return Promise.all(memberships.map(async (m) => {
    const sumResult = await prisma.ledgerEntry.aggregate({
      where: { entityType: 'SHG', entityId: m.shgId },
      _sum: { amountPaise: true },
    })
    const poolBalancePaise = sumResult._sum.amountPaise ?? 0
    const poolBalance = poolBalancePaise / 100

    // Compute totalFunded from approved investments on all requests
    const totalLenderFunds = m.shg.fundingRequests.reduce((sum: number, req: any) => {
      return sum + req.investments.reduce((s: number, inv: any) => s + Number(inv.amount), 0)
    }, 0)

    const recentTxns = await prisma.ledgerEntry.findMany({
      where: { entityType: 'SHG', entityId: m.shgId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    return {
      ...m,
      shg: {
        ...m.shg,
        poolBalance,
        poolTransactions: recentTxns,
      },
    }
  }))
}

/**
 * Log a meeting for an SHG
 */
export const logMeeting = async (params: {
  shgId: string
  heldAt: Date
  attendeeIds: string[]
  notes?: string
  loggedByUserId: string
}) => {
  const { shgId, heldAt, attendeeIds, notes, loggedByUserId } = params

  // Verify logger is member
  const membership = await prisma.sHGMember.findUnique({
    where: { userId_shgId: { userId: loggedByUserId, shgId } },
  })
  if (!membership) throw new AppError(403, 'NOT_MEMBER', 'You are not a member of this SHG')

  const newMeeting = await prisma.meeting.create({
    data: { shgId, heldAt, attendees: attendeeIds, notes },
  })

  // Invalidate cache
  const redis = await getRedis()
  if (redis) await redis.del(`shg:${shgId}`)

  return newMeeting
}

/**
 * Get meetings for an SHG
 */
export const getSHGMeetings = async (shgId: string) => {
  return prisma.meeting.findMany({
    where: { shgId },
    orderBy: { heldAt: 'desc' },
    take: 20,
  })
}

/**
 * List all SHGs (for discovery / search)
 */
export const listSHGs = async (search?: string) => {
  return prisma.sHGGroup.findMany({
    where: search
      ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { district: { contains: search, mode: 'insensitive' } }] }
      : undefined,
    include: { _count: { select: { members: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
}

/**
 * Remove a member from an SHG — leader only
 */
export const removeMember = async (shgId: string, targetUserId: string, requesterId: string) => {
  const requesterMembership = await prisma.sHGMember.findUnique({
    where: { userId_shgId: { userId: requesterId, shgId } },
    include: { shg: { select: { name: true } } }
  })
  if (!requesterMembership || requesterMembership.role !== 'LEADER') {
    throw new AppError(403, 'NOT_LEADER', 'Only the group leader can remove members')
  }
  if (targetUserId === requesterId) {
    throw new AppError(400, 'CANNOT_REMOVE_SELF', 'Leader cannot remove themselves. Transfer leadership first.')
  }
  const targetMembership = await prisma.sHGMember.findUnique({
    where: { userId_shgId: { userId: targetUserId, shgId } }
  })
  if (!targetMembership) {
    throw new AppError(404, 'MEMBER_NOT_FOUND', 'This user is not a member of the group')
  }

  // Look up SHG (for poolContractAddress) and target user (for walletAddress)
  // before the transaction so we can enqueue chain-sync jobs atomically.
  const shg = await prisma.sHGGroup.findUnique({
    where: { id: shgId },
    select: { poolContractAddress: true, name: true },
  })
  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { walletAddress: true },
  })

  await prisma.$transaction(async (tx) => {
    await tx.sHGMember.delete({ where: { userId_shgId: { userId: targetUserId, shgId } } })

    if (shg?.poolContractAddress && targetUser?.walletAddress) {
      await enqueueOutboxJob(tx, 'remove-pool-member', {
        poolAddress: shg.poolContractAddress,
        memberAddress: targetUser.walletAddress,
      })
      // If the removed member was a LEADER, revoke their LoanManager role too.
      if (targetMembership.role === 'LEADER') {
        await enqueueOutboxJob(tx, 'revoke-leader-role', {
          leaderAddress: targetUser.walletAddress,
        })
      }
    }
  })

  const redis = await getRedis()
  if (redis) await redis.del(`shg:${shgId}`)

  // Push notification to removed member
  const { sendPushNotification } = await import('./notification.service')
  await sendPushNotification(
    targetUserId,
    'Removed from Group',
    `You have been removed from ${requesterMembership.shg.name} by the group leader.`,
    { type: 'MEMBER_REMOVED', shgId }
  )

  return { message: 'Member removed successfully' }
}

/**
 * Leader initiates group dissolution vote — notifies all members
 */
export const initiateDissolve = async (shgId: string, requesterId: string) => {
  const membership = await prisma.sHGMember.findUnique({
    where: { userId_shgId: { userId: requesterId, shgId } },
    include: { shg: { include: { members: { include: { user: true } } } } }
  })
  if (!membership || membership.role !== 'LEADER') {
    throw new AppError(403, 'NOT_LEADER', 'Only the group leader can initiate dissolution')
  }
  if (!membership.shg.isActive) {
    throw new AppError(400, 'ALREADY_DISSOLVED', 'This group has already been dissolved')
  }
  if (membership.shg.dissolutionRequestedAt) {
    throw new AppError(400, 'VOTE_IN_PROGRESS', 'A dissolution vote is already in progress')
  }

  await prisma.sHGGroup.update({
    where: { id: shgId },
    data: { dissolutionRequestedAt: new Date() }
  })

  // Cast leader's own YES vote automatically
  await prisma.dissolutionVote.upsert({
    where: { shgId_userId: { shgId, userId: requesterId } },
    create: { shgId, userId: requesterId, vote: true },
    update: { vote: true }
  })

  const redis = await getRedis()
  if (redis) await redis.del(`shg:${shgId}`)

  // Notify all other members
  const { notifyGroup } = await import('./notification.service')
  await notifyGroup(
    shgId,
    requesterId,
    'DISSOLUTION_VOTE',
    'Group Dissolution Vote',
    `${membership.shg.name} leader has requested to dissolve the group. Please vote Yes or No.`,
    { shgId, shgName: membership.shg.name }
  )

  return { message: 'Dissolution vote started. Members have been notified.' }
}

/**
 * Member submits dissolution vote (true = dissolve, false = keep)
 * If all members vote YES → group is dissolved
 */
export const voteDissolve = async (shgId: string, userId: string, vote: boolean) => {
  const membership = await prisma.sHGMember.findUnique({
    where: { userId_shgId: { userId, shgId } },
    include: { shg: { include: { members: true, dissolutionVotes: true } } }
  })
  if (!membership) {
    throw new AppError(404, 'NOT_MEMBER', 'You are not a member of this group')
  }
  if (!membership.shg.dissolutionRequestedAt) {
    throw new AppError(400, 'NO_VOTE', 'No dissolution vote is in progress for this group')
  }
  if (!membership.shg.isActive) {
    throw new AppError(400, 'ALREADY_DISSOLVED', 'This group has already been dissolved')
  }

  await prisma.dissolutionVote.upsert({
    where: { shgId_userId: { shgId, userId } },
    create: { shgId, userId, vote },
    update: { vote }
  })

  const totalMembers  = membership.shg.members.length
  const allVotes      = await prisma.dissolutionVote.findMany({ where: { shgId } })
  const yesVotes      = allVotes.filter(v => v.vote).length
  const noVotes       = allVotes.filter(v => !v.vote).length
  const majorityNeeded = Math.ceil(totalMembers / 2)

  if (yesVotes >= majorityNeeded) {
    // Dissolve the group
    await prisma.sHGGroup.update({ where: { id: shgId }, data: { isActive: false } })
    const redis = await getRedis()
    if (redis) await redis.del(`shg:${shgId}`)

    const { notifyUsers } = await import('./notification.service')
    const memberIds = membership.shg.members.map((m: any) => m.userId)
    await notifyUsers(
      memberIds,
      'GENERAL',
      'Group Dissolved',
      `Group has been dissolved by member consensus.`,
      { shgId, dissolved: 'true' }
    )
    return { status: 'DISSOLVED', message: 'Majority voted YES — group has been dissolved.' }
  }

  if (noVotes > totalMembers - majorityNeeded) {
    // Majority NO — cancel dissolution
    await prisma.sHGGroup.update({ where: { id: shgId }, data: { dissolutionRequestedAt: null } })
    await prisma.dissolutionVote.deleteMany({ where: { shgId } })
    return { status: 'CANCELLED', message: 'Majority voted NO — dissolution has been cancelled.' }
  }

  return {
    status: 'PENDING',
    message: 'Vote recorded.',
    yesVotes,
    noVotes,
    totalMembers,
    remaining: totalMembers - allVotes.length,
  }
}

/**
 * Get dissolution vote status for a group
 */
export const getDissolveStatus = async (shgId: string, userId: string) => {
  const membership = await prisma.sHGMember.findUnique({
    where: { userId_shgId: { userId, shgId } },
    include: { shg: { include: { members: true, dissolutionVotes: true } } }
  })
  if (!membership) throw new AppError(404, 'NOT_MEMBER', 'You are not a member of this group')

  const { shg } = membership
  const myVote = shg.dissolutionVotes.find(v => v.userId === userId)

  return {
    isActive:               shg.isActive,
    voteInProgress:         !!shg.dissolutionRequestedAt,
    dissolutionRequestedAt: shg.dissolutionRequestedAt,
    totalMembers:           shg.members.length,
    yesVotes:               shg.dissolutionVotes.filter(v => v.vote).length,
    noVotes:                shg.dissolutionVotes.filter(v => !v.vote).length,
    myVote:                 myVote?.vote ?? null,
  }
}

/**
 * Generate or regenerate invite code for an SHG
 * Only LEADER can generate
 */
export const generateInviteCodeForSHG = async (shgId: string, userId: string) => {
  // Verify user is leader of this SHG
  const membership = await prisma.sHGMember.findUnique({
    where: { userId_shgId: { userId, shgId } },
  })
  if (!membership || membership.role !== 'LEADER') {
    throw new AppError(403, 'NOT_LEADER', 'Only group leaders can generate invite codes')
  }

  // Generate unique invite code
  let inviteCode: string
  let existing: any
  do {
    inviteCode = generateInviteCode()
    existing = await prisma.sHGGroup.findUnique({ where: { inviteCode } })
  } while (existing)

  // Update SHG with invite code
  const updatedGroup = await prisma.sHGGroup.update({
    where: { id: shgId },
    data: { inviteCode },
    select: { id: true, name: true, inviteCode: true }
  })

  // Invalidate cache
  const redis = await getRedis()
  if (redis) await redis.del(`shg:${shgId}`)

  return updatedGroup
}

/**
 * Join an SHG using invite code
 */
export const joinSHGByInviteCode = async (userId: string, inviteCode: string) => {
  // Find group by invite code
  const group = await prisma.sHGGroup.findUnique({
    where: { inviteCode: inviteCode.toUpperCase() }
  })

  if (!group) {
    throw new AppError(404, 'INVALID_INVITE_CODE', 'Invalid invite code. Please check and try again.')
  }

  // Check if already a member
  const existing = await prisma.sHGMember.findUnique({
    where: { userId_shgId: { userId, shgId: group.id } }
  })

  if (existing) {
    throw new AppError(409, 'ALREADY_MEMBER', 'You are already a member of this group')
  }

  // Look up user wallet (needed for chain sync below)
  const user = await prisma.user.findUnique({ where: { id: userId } })

  // Join the group + sync to on-chain pool atomically via outbox
  const newMember = await prisma.$transaction(async (tx) => {
    const m = await tx.sHGMember.create({
      data: { userId, shgId: group.id, role: 'MEMBER' },
      include: { shg: true, user: true },
    })

    if (group.poolContractAddress && user?.walletAddress) {
      await enqueueOutboxJob(tx, 'add-pool-member', {
        poolAddress: group.poolContractAddress,
        memberAddress: user.walletAddress,
      })
    }

    return m
  })

  // Invalidate cache
  const redis = await getRedis()
  if (redis) await redis.del(`shg:${group.id}`)

  return newMember
}

/**
 * Delete an SHG group — leader only, must be sole member
 */
export const deleteSHG = async (shgId: string, requesterId: string) => {
  const membership = await prisma.sHGMember.findUnique({
    where: { userId_shgId: { userId: requesterId, shgId } },
    include: { shg: true }
  })
  if (!membership) {
    throw new AppError(404, 'NOT_MEMBER', 'You are not a member of this group')
  }
  if (membership.role !== 'LEADER') {
    throw new AppError(403, 'NOT_LEADER', 'Only the group leader can delete the group')
  }

  // Check if requester is the only member
  const memberCount = await prisma.sHGMember.count({ where: { shgId } })
  if (memberCount > 1) {
    throw new AppError(400, 'NOT_SOLE_MEMBER', 'Cannot delete group with multiple members. Use dissolution vote instead.')
  }

  await prisma.$transaction(async (tx) => {
    // Delete dissolution votes
    await tx.dissolutionVote.deleteMany({ where: { shgId } })
    // Delete meetings
    await tx.meeting.deleteMany({ where: { shgId } })
    // Delete members
    await tx.sHGMember.deleteMany({ where: { shgId } })
    // Delete the group
    await tx.sHGGroup.delete({ where: { id: shgId } })
  })

  // Invalidate cache
  const redis = await getRedis()
  if (redis) await redis.del(`shg:${shgId}`)

  return { message: 'Group deleted successfully' }
}
