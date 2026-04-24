import { Response } from 'express'
import { prisma } from '@/lib/prisma'
import { AuthenticatedRequest } from '@/middleware/auth.middleware'
import { sendSuccess, sendError } from '@/utils/response'

export const updateProfile = async (req: AuthenticatedRequest, res: Response) => {
    const { name, walletAddress } = req.body
    
    try {
        const user = await prisma.user.update({
            where: { id: req.userId },
            data: { 
                ...(name && { name }),
                ...(walletAddress && { walletAddress })
            }
        })
        sendSuccess(res, user)
    } catch (err) {
        sendError(res, 'UPDATE_FAILED', 'Failed to update user profile')
    }
}
