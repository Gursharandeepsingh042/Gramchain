import PDFDocument from 'pdfkit'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

interface AgreementData {
  lenderName: string
  lenderId: string
  groupName: string
  shgId: string
  amount: number
  interestRateBps: number
  durationMonths: number
  investmentDate: Date
  signatureUrl?: string
}

/**
 * Generate PDF agreement for lender-group investment
 */
export async function generateInvestmentAgreement(data: AgreementData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 })
      const chunks: Buffer[] = []

      doc.on('data', (chunk) => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      // Header
      doc.fontSize(20).font('Helvetica-Bold').text('INVESTMENT AGREEMENT', { align: 'center' })
      doc.moveDown()
      doc.fontSize(12).font('Helvetica').text('GramChain DeFi Social Lending Platform', { align: 'center' })
      doc.moveDown(2)

      // Agreement Number and Date
      const agreementNumber = `INV-${Date.now()}`
      doc.fontSize(10).font('Helvetica')
      doc.text(`Agreement Number: ${agreementNumber}`)
      doc.text(`Date: ${data.investmentDate.toLocaleDateString('en-IN')}`)
      doc.moveDown(2)

      // Parties
      doc.fontSize(14).font('Helvetica-Bold').text('PARTIES TO THE AGREEMENT')
      doc.moveDown()
      doc.fontSize(11).font('Helvetica')
      doc.text(`LENDER: ${data.lenderName} (ID: ${data.lenderId})`)
      doc.text(`GROUP: ${data.groupName} (ID: ${data.shgId})`)
      doc.moveDown(2)

      // Investment Details
      doc.fontSize(14).font('Helvetica-Bold').text('INVESTMENT DETAILS')
      doc.moveDown()
      doc.fontSize(11).font('Helvetica')
      doc.text(`Investment Amount: ₹${data.amount.toLocaleString('en-IN')}`)
      doc.text(`Interest Rate: ${(data.interestRateBps / 100).toFixed(2)}% per annum`)
      doc.text(`Duration: ${data.durationMonths} months`)
      doc.text(`Investment Date: ${data.investmentDate.toLocaleDateString('en-IN')}`)
      doc.moveDown(2)

      // Terms and Conditions
      doc.fontSize(14).font('Helvetica-Bold').text('TERMS AND CONDITIONS')
      doc.moveDown()
      doc.fontSize(10).font('Helvetica')
      
      const terms = [
        '1. The Lender agrees to invest the specified amount in the Group for the stated duration.',
        '2. The Group agrees to repay the principal amount along with accrued interest at the agreed rate.',
        '3. Interest shall be calculated on a simple interest basis for the duration of the investment.',
        '4. The Group shall provide regular updates on the utilization of funds and repayment status.',
        '5. This agreement is governed by the laws of India and any disputes shall be subject to the jurisdiction of courts in India.',
        '6. Both parties acknowledge that this investment is facilitated through the GramChain DeFi platform.',
        '7. The Lender understands that investments carry risk and returns are not guaranteed.',
      ]

      terms.forEach(term => {
        doc.text(term, { width: 450, align: 'justify' })
        doc.moveDown(0.5)
      })
      doc.moveDown(2)

      // Signatures
      doc.fontSize(14).font('Helvetica-Bold').text('SIGNATURES')
      doc.moveDown(2)

      // Lender Signature
      doc.fontSize(11).font('Helvetica-Bold').text('Lender Signature:')
      doc.moveDown(0.5)
      doc.fontSize(10).font('Helvetica').text(`Name: ${data.lenderName}`)
      doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`)
      doc.moveDown(2)

      // Group Leader Signature
      doc.fontSize(11).font('Helvetica-Bold').text('Group Leader Signature:')
      doc.moveDown(0.5)
      doc.fontSize(10).font('Helvetica').text(`Name: _______________________`)
      doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`)
      doc.moveDown(2)

      // Platform Witness
      doc.fontSize(11).font('Helvetica-Bold').text('Platform Witness (GramChain):')
      doc.moveDown(0.5)
      doc.fontSize(10).font('Helvetica').text(`Name: _______________________`)
      doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`)
      doc.moveDown(2)

      // Footer
      doc.fontSize(8).font('Helvetica').text(
        'This is a digitally generated agreement. For verification, contact support@gramchain.com',
        { align: 'center' }
      )

      doc.end()
    } catch (error) {
      logger.error({ error }, 'Failed to generate PDF agreement')
      reject(error)
    }
  })
}

/**
 * Generate agreement for a specific investment
 */
export async function generateInvestmentAgreementById(investmentId: string): Promise<Buffer> {
  const investment = await prisma.lenderInvestment.findUnique({
    where: { id: investmentId },
    include: {
      lender: {
        select: {
          id: true,
          name: true,
        }
      },
      fundingRequest: {
        include: {
          shg: {
            select: {
              id: true,
              name: true,
            }
          }
        }
      }
    }
  })

  if (!investment) {
    throw new Error('Investment not found')
  }

  const data: AgreementData = {
    lenderName: investment.lender.name || 'Unknown Lender',
    lenderId: investment.lender.id,
    groupName: investment.fundingRequest.shg.name || 'Unknown Group',
    shgId: investment.fundingRequest.shg.id,
    amount: Number(investment.amount),
    interestRateBps: investment.interestRateBps,
    durationMonths: investment.fundingRequest.durationMonths,
    investmentDate: investment.createdAt,
    signatureUrl: undefined, // Could be added later if signature images are stored
  }

  return generateInvestmentAgreement(data)
}
