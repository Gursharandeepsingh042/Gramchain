import { Response } from 'express'
import * as SHGService from '@/services/shg.service'
import { sendSuccess, sendError } from '@/utils/response'
import { AuthenticatedRequest } from '@/middleware/auth.middleware'

/** POST /shg — Create new SHG group */
export const createSHG = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { name, district, state, village, description } = req.body
  if (!name || !district || !state) {
    sendError(res, 'MISSING_FIELDS', 'name, district, and state are required')
    return
  }
  const group = await SHGService.createSHG({
    name, district, state, village, description,
    creatorId: req.userId!,
  })
  sendSuccess(res, group, 201)
}

/** POST /shg/:id/join — Join an SHG group */
export const joinSHG = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const membership = await SHGService.joinSHG(req.userId!, req.params.id as string)
  sendSuccess(res, membership, 201)
}

/** GET /shg/:id — Get SHG details */
export const getSHG = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const group = await SHGService.getSHGById(req.params.id as string)
  sendSuccess(res, group)
}

/** GET /shg — Get all SHGs (with optional search) */
export const listSHGs = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const searchMatch = req.query.search ? String(req.query.search) : undefined
  const groups = await SHGService.listSHGs(searchMatch)
  sendSuccess(res, groups)
}

/** GET /shg/my — Get user's SHGs */
export const getMySHGs = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const memberships = await SHGService.getUserSHGs(req.userId!)
  sendSuccess(res, memberships)
}

/** POST /shg/:id/meetings — Log a meeting */
export const logMeeting = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { heldAt, attendeeIds, notes } = req.body
  if (!heldAt || !attendeeIds) {
    sendError(res, 'MISSING_FIELDS', 'heldAt and attendeeIds are required')
    return
  }
  const meeting = await SHGService.logMeeting({
    shgId: req.params.id as string,
    heldAt: new Date(heldAt),
    attendeeIds,
    notes,
    loggedByUserId: req.userId!,
  })
  sendSuccess(res, meeting, 201)
}

/** GET /shg/:id/meetings — Get meetings */
export const getMeetings = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const meetings = await SHGService.getSHGMeetings(req.params.id as string)
  sendSuccess(res, meetings)
}
