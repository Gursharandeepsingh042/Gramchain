import { prisma } from '../src/lib/prisma'
import crypto from 'crypto'

async function main() {
  console.log('========================================')
  console.log('  CREATING MOCK FUNDING REQUESTS')
  console.log('========================================\n')

  // Get the three groups
  const kashmirGroup = await prisma.sHGGroup.findFirst({
    where: { name: { contains: 'Kashmiri' } }
  })
  const appleGroup = await prisma.sHGGroup.findFirst({
    where: { name: { contains: 'Apple' } }
  })
  const mahilaGroup = await prisma.sHGGroup.findFirst({
    where: { name: { contains: 'Mahila' } }
  })

  if (!kashmirGroup || !appleGroup || !mahilaGroup) {
    throw new Error('Groups not found')
  }

  // Get Sandeep as the requestor (leader of all groups)
  const sandeep = await prisma.user.findUnique({
    where: { email: 'sandeepkour666333@gmail.com' }
  })

  if (!sandeep) {
    throw new Error('Sandeep user not found')
  }

  // Get a lender (Raghav)
  const raghav = await prisma.user.findUnique({
    where: { email: 'raghav2005@gmail.com' }
  })

  if (!raghav) {
    throw new Error('Raghav user not found')
  }

  // Create funding request for Kashmiri Saffron (90000)
  const funding1 = await prisma.groupFundingRequest.create({
    data: {
      shgId: kashmirGroup.id,
      requestedBy: sandeep.id,
      amount: 90000,
      durationMonths: 12,
      purpose: 'Saffron cultivation expansion and processing equipment',
      minInvestment: 10000,
      maxInvestment: 50000,
      signatureUrl: null,
      termsAccepted: true,
      status: 'FULLY_FUNDED',
      disbursedAt: new Date(),
    }
  })
  console.log(`  ✅ Funding request 1: ₹90,000 for Kashmiri Saffron Startup`)

  // Create funding request for Apple Orchards (100000)
  const funding2 = await prisma.groupFundingRequest.create({
    data: {
      shgId: appleGroup.id,
      requestedBy: sandeep.id,
      amount: 100000,
      durationMonths: 12,
      purpose: 'Apple orchard irrigation and storage facilities',
      minInvestment: 10000,
      maxInvestment: 50000,
      signatureUrl: null,
      termsAccepted: true,
      status: 'FULLY_FUNDED',
      disbursedAt: new Date(),
    }
  })
  console.log(`  ✅ Funding request 2: ₹1,00,000 for Hybrid Apple Orchards`)

  // Create funding request for Mahila Sangh (70000)
  const funding3 = await prisma.groupFundingRequest.create({
    data: {
      shgId: mahilaGroup.id,
      requestedBy: sandeep.id,
      amount: 70000,
      durationMonths: 12,
      purpose: 'Handicraft materials and workshop setup',
      minInvestment: 10000,
      maxInvestment: 50000,
      signatureUrl: null,
      termsAccepted: true,
      status: 'FULLY_FUNDED',
      disbursedAt: new Date(),
    }
  })
  console.log(`  ✅ Funding request 3: ₹70,000 for Mahila Shashakt Shang\n`)

  // Create mock investments for each funding request
  // Kashmiri Saffron - 2 investors
  await prisma.lenderInvestment.create({
    data: {
      fundingRequestId: funding1.id,
      lenderId: raghav.id,
      shgId: kashmirGroup.id,
      amount: 50000,
      interestRateBps: 1800, // 18%
      status: 'APPROVED',
      approvedAt: new Date(),
      txHash: '0x' + crypto.randomBytes(32).toString('hex'),
    }
  })
  await prisma.lenderInvestment.create({
    data: {
      fundingRequestId: funding1.id,
      lenderId: raghav.id,
      shgId: kashmirGroup.id,
      amount: 40000,
      interestRateBps: 1800,
      status: 'APPROVED',
      approvedAt: new Date(),
      txHash: '0x' + crypto.randomBytes(32).toString('hex'),
    }
  })
  console.log(`  ✅ Added 2 investments for Kashmiri Saffron (₹50,000 + ₹40,000)`)

  // Apple Orchards - 2 investors
  await prisma.lenderInvestment.create({
    data: {
      fundingRequestId: funding2.id,
      lenderId: raghav.id,
      shgId: appleGroup.id,
      amount: 60000,
      interestRateBps: 1800,
      status: 'APPROVED',
      approvedAt: new Date(),
      txHash: '0x' + crypto.randomBytes(32).toString('hex'),
    }
  })
  await prisma.lenderInvestment.create({
    data: {
      fundingRequestId: funding2.id,
      lenderId: raghav.id,
      shgId: appleGroup.id,
      amount: 40000,
      interestRateBps: 1800,
      status: 'APPROVED',
      approvedAt: new Date(),
      txHash: '0x' + crypto.randomBytes(32).toString('hex'),
    }
  })
  console.log(`  ✅ Added 2 investments for Apple Orchards (₹60,000 + ₹40,000)`)

  // Mahila Sangh - 1 investor
  await prisma.lenderInvestment.create({
    data: {
      fundingRequestId: funding3.id,
      lenderId: raghav.id,
      shgId: mahilaGroup.id,
      amount: 70000,
      interestRateBps: 1800,
      status: 'APPROVED',
      approvedAt: new Date(),
      txHash: '0x' + crypto.randomBytes(32).toString('hex'),
    }
  })
  console.log(`  ✅ Added 1 investment for Mahila Sangh (₹70,000)\n`)

  console.log('========================================')
  console.log('  MOCK FUNDING REQUESTS CREATED')
  console.log('========================================')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
