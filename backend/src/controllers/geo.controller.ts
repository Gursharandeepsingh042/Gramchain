import { Request, Response, NextFunction } from 'express'
import * as GeoService from '@/services/geo.service'
import { sendSuccess, sendError } from '@/utils/response'

/**
 * GET /geo/states
 * Returns all Indian states
 */
export const getStates = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const states = GeoService.getAllStates()
    sendSuccess(res, { states })
  } catch (error) {
    next(error)
  }
}

/**
 * GET /geo/states/:state/districts
 * Returns districts for a given state
 */
export const getDistricts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const state = req.params.state as string
    if (!state) {
      sendError(res, 'MISSING_STATE', 'State parameter is required')
      return
    }

    if (!GeoService.isValidState(state)) {
      sendError(res, 'INVALID_STATE', `Invalid state: ${state}`)
      return
    }

    const districts = GeoService.getDistrictsForState(state)
    sendSuccess(res, { state, districts })
  } catch (error) {
    next(error)
  }
}
