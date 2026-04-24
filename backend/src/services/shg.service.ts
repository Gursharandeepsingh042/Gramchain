import { prisma } from '@/lib/prisma'
import { AppError } from '@/middleware/error.middleware'

/**
 * Create a new SHG group and set creator as LEADER
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

  const group = await prisma.sHGGroup.create({
    data: {
      ...groupData,
      members: {
        create: { userId: creatorId, role: 'LEADER' },
      },
    },
    include: { members: { include: { user: true } } },
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

  return prisma.sHGMember.create({
    data: { userId, shgId, role: 'MEMBER' },
    include: { shg: true, user: true },
  })
}

/**
 * Get SHG details with members and recent meetings
 */
export const getSHGById = async (shgId: string) => {
  const group = await prisma.sHGGroup.findUnique({
    where: { id: shgId },
    include: {
      members: { include: { user: { select: { id: true, phone: true, name: true, walletAddress: true } } } },
      meetings: { orderBy: { heldAt: 'desc' }, take: 5 },
      loans: { where: { status: { in: ['ACTIVE', 'APPROVED'] } } },
    },
  })
  if (!group) throw new AppError(404, 'SHG_NOT_FOUND', 'SHG group not found')
  return group
}

/**
 * Get all SHG groups a user belongs to
 */
export const getUserSHGs = async (userId: string) => {
  return prisma.sHGMember.findMany({
    where: { userId },
    include: {
      shg: {
        include: {
          members: true,
          loans: { where: { status: { in: ['ACTIVE', 'APPROVED'] } } },
        },
      },
    },
  })
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

  return prisma.meeting.create({
    data: { shgId, heldAt, attendees: attendeeIds, notes },
  })
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
