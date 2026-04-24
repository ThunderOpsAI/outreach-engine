import { Router } from 'express'
import { generateOutreach } from '../controllers/generateController.js'

const router = Router()

router.post('/outreach', generateOutreach)

export default router
