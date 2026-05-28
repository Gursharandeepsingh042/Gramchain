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

interface LoanReceiptData {
  fundingRequestId: string
  shgName: string
  amount: number
  durationMonths: number
  purpose: string
  disbursedAt: Date
  transactionId: string
  blockNumber: number
  blockHash: string
  contractAddress: string
  network: string
  investments: Array<{
    lenderName: string
    amount: number
    interestRateBps: number
  }>
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

/**
 * Generate PDF loan disbursement receipt with blockchain details
 */
export async function generateLoanReceipt(data: LoanReceiptData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 })
      const chunks: Buffer[] = []

      doc.on('data', (chunk) => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      // Calculate EMI and repayment schedule
      const avgRate = data.investments.reduce((sum, inv) => sum + inv.interestRateBps, 0) / data.investments.length / 100
      const emi = calculateEMI(data.amount, avgRate, data.durationMonths)
      const totalPayable = emi * data.durationMonths
      const totalInterest = totalPayable - data.amount

      // Header
      doc.fontSize(20).font('Helvetica-Bold').text('LOAN DISBURSEMENT RECEIPT', { align: 'center' })
      doc.moveDown()
      doc.fontSize(12).font('Helvetica').text('GramChain DeFi Social Lending Platform', { align: 'center' })
      doc.moveDown(2)

      // Receipt Number and Date
      const receiptNumber = `LOAN-${Date.now()}`
      doc.fontSize(10).font('Helvetica')
      doc.text(`Receipt Number: ${receiptNumber}`)
      doc.text(`Disbursement Date: ${data.disbursedAt.toLocaleDateString('en-IN')}`)
      doc.moveDown(2)

      // Borrower Details
      doc.fontSize(14).font('Helvetica-Bold').text('BORROWER DETAILS')
      doc.moveDown()
      doc.fontSize(11).font('Helvetica')
      doc.text(`SHG Group: ${data.shgName}`)
      doc.text(`Funding Request ID: ${data.fundingRequestId}`)
      doc.text(`Purpose: ${data.purpose}`)
      doc.moveDown(2)

      // Loan Summary
      doc.fontSize(14).font('Helvetica-Bold').text('LOAN SUMMARY')
      doc.moveDown()
      doc.fontSize(11).font('Helvetica')
      doc.text(`Principal Amount: ₹${data.amount.toLocaleString('en-IN')}`)
      doc.text(`Duration: ${data.durationMonths} months`)
      doc.text(`Average Interest Rate: ${avgRate.toFixed(2)}% per annum`)
      doc.text(`Total Interest: ₹${totalInterest.toLocaleString('en-IN')}`)
      doc.text(`Total Repayable: ₹${totalPayable.toLocaleString('en-IN')}`)
      doc.text(`Monthly EMI: ₹${emi.toLocaleString('en-IN')}`)
      doc.moveDown(2)

      // Blockchain Details
      doc.fontSize(14).font('Helvetica-Bold').text('BLOCKCHAIN TRANSACTION DETAILS')
      doc.moveDown()
      doc.fontSize(10).font('Helvetica')
      doc.text(`Transaction ID: ${data.transactionId}`)
      doc.text(`Block Number: ${data.blockNumber}`)
      doc.text(`Block Hash: ${data.blockHash}`)
      doc.text(`Contract Address: ${data.contractAddress}`)
      doc.text(`Network: ${data.network}`)
      doc.moveDown(2)

      // Investment Breakdown
      doc.fontSize(14).font('Helvetica-Bold').text('INVESTMENT BREAKDOWN')
      doc.moveDown()
      doc.fontSize(10).font('Helvetica')
      data.investments.forEach((inv, index) => {
        doc.text(`${index + 1}. ${inv.lenderName}: ₹${inv.amount.toLocaleString('en-IN')} @ ${(inv.interestRateBps / 100).toFixed(2)}%`)
      })
      doc.moveDown(2)

      // Repayment Schedule
      doc.fontSize(14).font('Helvetica-Bold').text('REPAYMENT SCHEDULE')
      doc.moveDown()
      doc.fontSize(9).font('Helvetica')
      doc.text('Month | Due Date | EMI Amount | Principal | Interest | Balance')
      doc.text('-------|----------|------------|----------|----------|---------')
      
      let balance = data.amount
      for (let i = 1; i <= data.durationMonths; i++) {
        const dueDate = new Date(data.disbursedAt)
        dueDate.setMonth(dueDate.getMonth() + i)
        const interest = (balance * avgRate / 100) / 12
        const principal = emi - interest
        balance -= principal
        
        doc.text(
          `${i.toString().padStart(2, '0')} | ${dueDate.toLocaleDateString('en-IN')} | ₹${emi.toLocaleString('en-IN')} | ₹${Math.round(principal).toLocaleString('en-IN')} | ₹${Math.round(interest).toLocaleString('en-IN')} | ₹${Math.max(0, Math.round(balance)).toLocaleString('en-IN')}`
        )
      }
      doc.moveDown(2)

      // Terms and Conditions
      doc.fontSize(14).font('Helvetica-Bold').text('TERMS AND CONDITIONS')
      doc.moveDown()
      doc.fontSize(9).font('Helvetica')
      
      const terms = [
        '1. The SHG leader is responsible for repayment to all lenders as per the schedule above.',
        '2. Repayment must be made on or before the due date each month.',
        '3. Late payments may incur penalties as per smart contract terms.',
        '4. This loan is recorded on the blockchain and all transactions are immutable.',
        '5. Default may affect the group\'s credit score and future borrowing capacity.',
        '6. Early repayment requires approval from all investors.',
        '7. This receipt serves as legal proof of the loan disbursement.',
      ]

      terms.forEach(term => {
        doc.text(term, { width: 450, align: 'justify' })
        doc.moveDown(0.5)
      })
      doc.moveDown(2)

      // Signatures
      doc.fontSize(14).font('Helvetica-Bold').text('SIGNATURES')
      doc.moveDown(2)

      doc.fontSize(11).font('Helvetica-Bold').text('SHG Leader Signature:')
      doc.moveDown(0.5)
      doc.fontSize(10).font('Helvetica').text(`Name: _______________________`)
      doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`)
      doc.moveDown(2)

      doc.fontSize(11).font('Helvetica-Bold').text('Platform Witness (GramChain):')
      doc.moveDown(0.5)
      doc.fontSize(10).font('Helvetica').text(`Name: _______________________`)
      doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`)
      doc.moveDown(2)

      // Footer
      doc.fontSize(8).font('Helvetica').text(
        'This is a digitally generated receipt. For verification, contact support@gramchain.com',
        { align: 'center' }
      )

      doc.end()
    } catch (error) {
      logger.error({ error }, 'Failed to generate loan receipt PDF')
      reject(error)
    }
  })
}

/**
 * Calculate EMI using standard formula
 */
function calculateEMI(principal: number, annualRatePercent: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0
  const monthlyRate = (annualRatePercent / 100) / 12
  if (monthlyRate === 0) return principal / months
  const emi = principal * monthlyRate * Math.pow(1 + monthlyRate, months) / (Math.pow(1 + monthlyRate, months) - 1)
  return Math.round(emi)
}
