import { Router } from 'express'
import * as GeoController from '@/controllers/geo.controller'

const router = Router()

// GET /geo/states - List all Indian states
router.get('/states', GeoController.getStates)

// GET /geo/states/:state/districts - List districts for a state
router.get('/states/:state/districts', GeoController.getDistricts)

export default router
