/**
 * One-off diagnostic — lists users (id, name, email, phone, hasGoogle, hasPassword).
 * Usage: npx ts-node scripts/check-user.ts [emailSubstring]
 *
 * NEVER prints the password hash itself, only whether one is set.
 */
import { prisma } from '../src/lib/prisma'

async function main() {
  const filter = process.argv[2]?.toLowerCase()

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      googleId: true,
      // @ts-ignore - password column exists
      password: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  const filtered = filter
    ? users.filter(u => (u.email || '').toLowerCase().includes(filter) || (u.name || '').toLowerCase().includes(filter))
    : users

  if (filtered.length === 0) {
    console.log(`\nNo users found${filter ? ` matching "${filter}"` : ''}.\n`)
    return
  }

  console.log(`\nFound ${filtered.length} user(s):\n`)
  for (const u of filtered) {
    console.log('─'.repeat(70))
    console.log(`name        : ${u.name || '(none)'}`)
    console.log(`email       : ${u.email || '(none)'}`)
    console.log(`phone       : ${u.phone || '(none)'}`)
    console.log(`googleId    : ${u.googleId ? '✓ linked' : '✗ none'}`)
    // @ts-ignore
    console.log(`password set: ${u.password ? '✓ YES' : '✗ NO  ← cannot login with password'}`)
    console.log(`createdAt   : ${u.createdAt.toISOString()}`)
  }
  console.log('─'.repeat(70))
  console.log()
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
