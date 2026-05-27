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

export const getBorrowers = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const borrowers = await prisma.user.findMany({
            where: { role: 'BORROWER' },
            select: {
                id: true,
                name: true,
                phone: true,
                email: true,
                kycStatus: true,
                createdAt: true,
                shgMemberships: {
                    select: {
                        shg: {
                            select: {
                                id: true,
                                name: true,
                                district: true,
                                state: true
                            }
                        }
                    }
                }
            }
        })
        sendSuccess(res, borrowers)
    } catch (err) {
        sendError(res, 'FETCH_FAILED', 'Failed to fetch borrowers')
    }
}

export const getLenders = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const lenders = await prisma.user.findMany({
            where: { role: 'LENDER' },
            select: {
                id: true,
                name: true,
                phone: true,
                email: true,
                kycStatus: true,
                walletAddress: true,
                createdAt: true
            }
        })
        sendSuccess(res, lenders)
    } catch (err) {
        sendError(res, 'FETCH_FAILED', 'Failed to fetch lenders')
    }
}
