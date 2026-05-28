import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient({ log: ['warn'] })

async function main() {
  const groups = await prisma.sHGGroup.findMany({ select: { id: true, name: true } })
  console.log('\n=== SHG Groups ===')
  groups.forEach(g => console.log(`  ${g.id} — ${g.name}`))

  const reqs = await prisma.groupFundingRequest.findMany({
    select: { id: true, shgId: true, status: true, amount: true },
    take: 10,
  })
  console.log('\n=== Funding Requests ===')
  reqs.forEach(r => console.log(`  shgId=${r.shgId} status=${r.status} amount=${r.amount}`))

  const invs = await prisma.lenderInvestment.findMany({
    select: { id: true, shgId: true, amount: true, status: true },
    take: 10,
  })
  console.log('\n=== Investments ===')
  invs.forEach(i => console.log(`  shgId=${i.shgId} amount=${i.amount} status=${i.status}`))

  const ledger = await prisma.ledgerEntry.findMany({ where: { entityType: 'SHG' }, take: 10 })
  console.log('\n=== SHG Ledger Entries ===')
  if (ledger.length === 0) {
    console.log('  ❌ NO LEDGER ENTRIES FOR ANY SHG')
  } else {
    ledger.forEach(l => console.log(`  entityId=${l.entityId} type=${l.type} amount=${l.amountPaise/100}`))
  }

  await prisma.$disconnect()
}

main().catch(console.error)
