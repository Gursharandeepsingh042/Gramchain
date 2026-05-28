import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient({ log: ['warn'] })

async function main() {
  // Find loans with same member+shg, keep the one with higher amount
  const loans = await (prisma as any).loan.findMany({
    select: { id: true, memberId: true, shgId: true, amount: true, status: true },
    orderBy: { amount: 'desc' },
  })

  const seen = new Set<string>()
  const toDelete: string[] = []

  for (const loan of loans) {
    const key = `${loan.memberId}-${loan.shgId}`
    if (seen.has(key)) {
      toDelete.push(loan.id)
      console.log(`  Marking for deletion: loan ${loan.id} — member=${loan.memberId} shg=${loan.shgId} amount=${loan.amount}`)
    } else {
      seen.add(key)
      console.log(`  Keeping: loan ${loan.id} — member=${loan.memberId} shg=${loan.shgId} amount=${loan.amount}`)
    }
  }

  if (toDelete.length > 0) {
    await (prisma as any).loan.deleteMany({ where: { id: { in: toDelete } } })
    console.log(`\n✅ Deleted ${toDelete.length} duplicate loans`)
  } else {
    console.log('\n✅ No duplicate loans found')
  }

  await prisma.$disconnect()
}

main().catch(console.error)
