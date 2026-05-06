import 'dotenv/config'
import { verifyPan } from '../services/kyc.service'
import { prisma } from '../lib/prisma'

/**
 * Test script to verify PAN and compare with dummy Aadhaar data
 */
async function runTest() {
  const testPan = process.argv[2] || 'ABCDE1234F'
  const testName = process.argv[3] || 'GURSHARAN SINGH'
  const testDob = process.argv[4] || '15/05/1995'

  console.log('--- PAN VERIFICATION TEST ---')
  console.log(`Input PAN: ${testPan}`)
  console.log(`Input Name: ${testName}`)
  console.log(`Input DOB: ${testDob}`)

  try {
    const result = await verifyPan(testPan, testName, testDob)
    console.log('\n--- API RESPONSE ---')
    console.log(JSON.stringify(result, null, 2))

    console.log('\n--- AADHAAR MATCH SIMULATION ---')
    const nameMatch = result.name.toLowerCase().includes(testName.toLowerCase()) || testName.toLowerCase().includes(result.name.toLowerCase())
    
    // Normalize dates for comparison
    const normalizeDate = (d: string) => d.replace(/\//g, '-').replace(/-/g, '-')
    const dobMatch = normalizeDate(result.dob || '') === normalizeDate(testDob)

    console.log(`Name Match: ${nameMatch ? '✅ MATCH' : '❌ MISMATCH'}`)
    console.log(`DOB Match: ${dobMatch ? '✅ MATCH' : '❌ MISMATCH'}`)

    if (nameMatch && dobMatch) {
      console.log('\n✅ KYC STATUS: VERIFIED')
    } else {
      console.log('\n⚠️  KYC STATUS: PENDING (Manual Review Required)')
    }

  } catch (error: any) {
    console.error('\n❌ TEST FAILED')
    console.error(error.message)
    if (error.details) console.error(JSON.stringify(error.details, null, 2))
  } finally {
    await prisma.$disconnect()
  }
}

runTest()
