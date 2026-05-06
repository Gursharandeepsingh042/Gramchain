import { ethers, run } from 'hardhat'
import * as fs from 'fs'
import * as path from 'path'

/**
 * GramChain Deployment Script
 *
 * Deploy order:
 *   1. CreditScoreRegistry (standalone)
 *   2. LoanManager (needs backend wallet)
 *   3. SHGPoolFactory (needs LoanManager + backend wallet)
 *
 * After deployment:
 *   - Contracts are verified on Polygonscan automatically
 *   - Addresses are exported to backend/src/constants/ and mobile/constants/
 *
 * Flags:
 *   --network polygon | amoy | localhost
 *   FORCE_REDEPLOY=true  to re-deploy even if contracts.json exists
 */
async function main() {
  const [deployer] = await ethers.getSigners()
  const backendWallet = process.env.BACKEND_WALLET_ADDRESS ?? deployer.address
  const network = await ethers.provider.getNetwork()
  const networkName = network.name === 'unknown' ? 'localhost' : network.name
  const approvalQuorum = parseInt(process.env.APPROVAL_QUORUM ?? '3', 10)

  // ─── Idempotency Check ──────────────────────────────────────────
  const deploymentsDir = path.join(__dirname, '..', 'deployments')
  const deployFile = path.join(deploymentsDir, `${networkName}-addresses.json`)
  if (fs.existsSync(deployFile) && process.env.FORCE_REDEPLOY !== 'true') {
    console.log(`\n⚠️  Deployment already exists for network: ${networkName}`)
    console.log(`   File: ${deployFile}`)
    console.log(`   Set FORCE_REDEPLOY=true to override.\n`)
    process.exit(0)
  }

  console.log('═══════════════════════════════════════════════')
  console.log('  🌿 GramChain Contract Deployment')
  console.log('═══════════════════════════════════════════════')
  console.log(`  Deployer:        ${deployer.address}`)
  console.log(`  Backend Wallet:  ${backendWallet}`)
  console.log(`  Network:         ${networkName}`)
  console.log(`  Chain ID:        ${Number(network.chainId)}`)
  console.log(`  Approval Quorum: ${approvalQuorum}`)
  console.log('═══════════════════════════════════════════════\n')

  // ─── 1. Deploy CreditScoreRegistry ────────────────────────────
  console.log('📦 Deploying CreditScoreRegistry...')
  const Registry = await ethers.getContractFactory('CreditScoreRegistry')
  const registry = await Registry.deploy(deployer.address, backendWallet)
  await registry.waitForDeployment()
  const registryAddress = await registry.getAddress()
  console.log(`   ✅ CreditScoreRegistry: ${registryAddress}\n`)

  // ─── 2. Deploy LoanManager ─────────────────────────────────────
  console.log('📦 Deploying LoanManager...')
  const LoanManager = await ethers.getContractFactory('LoanManager')
  const loanManager = await LoanManager.deploy(backendWallet, approvalQuorum)
  await loanManager.waitForDeployment()
  const loanManagerAddress = await loanManager.getAddress()
  console.log(`   ✅ LoanManager:         ${loanManagerAddress}\n`)

  // ─── 3. Deploy SHGPoolFactory ──────────────────────────────────
  console.log('📦 Deploying SHGPoolFactory...')
  const SHGPoolFactory = await ethers.getContractFactory('SHGPoolFactory')
  const factory = await SHGPoolFactory.deploy(loanManagerAddress, backendWallet)
  await factory.waitForDeployment()
  const factoryAddress = await factory.getAddress()
  console.log(`   ✅ SHGPoolFactory:      ${factoryAddress}\n`)

  // ─── 4. Export Addresses ──────────────────────────────────────
  const addresses = {
    creditScoreRegistry: registryAddress,
    loanManager: loanManagerAddress,
    shgPoolFactory: factoryAddress,
    network: networkName,
    chainId: Number(network.chainId),
    deployer: deployer.address,
    backendWallet,
    approvalQuorum,
    deployedAt: new Date().toISOString(),
  }

  if (!fs.existsSync(deploymentsDir)) fs.mkdirSync(deploymentsDir, { recursive: true })
  fs.writeFileSync(deployFile, JSON.stringify(addresses, null, 2))
  console.log(`📄 Deployment saved:  ${deployFile}`)

  const backendConstantsDir = path.join(__dirname, '..', '..', 'backend', 'src', 'constants')
  if (!fs.existsSync(backendConstantsDir)) fs.mkdirSync(backendConstantsDir, { recursive: true })
  fs.writeFileSync(path.join(backendConstantsDir, 'contracts.json'), JSON.stringify(addresses, null, 2))
  console.log(`📄 Backend export:    ${path.join(backendConstantsDir, 'contracts.json')}`)

  const mobileConstantsDir = path.join(__dirname, '..', '..', 'mobile', 'constants')
  if (!fs.existsSync(mobileConstantsDir)) fs.mkdirSync(mobileConstantsDir, { recursive: true })
  fs.writeFileSync(path.join(mobileConstantsDir, 'contracts.json'), JSON.stringify(addresses, null, 2))
  console.log(`📄 Mobile export:     ${path.join(mobileConstantsDir, 'contracts.json')}`)

  // ─── 5. Verify on Polygonscan (skip for localhost) ────────────
  if (networkName !== 'localhost' && networkName !== 'hardhat') {
    console.log('\n🔍 Verifying contracts on Polygonscan...')
    await waitForIndexing(5)

    try {
      await run('verify:verify', {
        address: registryAddress,
        constructorArguments: [deployer.address, backendWallet],
      })
      console.log('   ✅ CreditScoreRegistry verified')
    } catch (e: any) {
      console.warn('   ⚠️  CreditScoreRegistry verification failed:', e.message)
    }

    try {
      await run('verify:verify', {
        address: loanManagerAddress,
        constructorArguments: [backendWallet, approvalQuorum],
      })
      console.log('   ✅ LoanManager verified')
    } catch (e: any) {
      console.warn('   ⚠️  LoanManager verification failed:', e.message)
    }

    try {
      await run('verify:verify', {
        address: factoryAddress,
        constructorArguments: [loanManagerAddress, backendWallet],
      })
      console.log('   ✅ SHGPoolFactory verified')
    } catch (e: any) {
      console.warn('   ⚠️  SHGPoolFactory verification failed:', e.message)
    }
  }

  console.log('\n═══════════════════════════════════════════════')
  console.log('  🎉 Deployment Complete!')
  console.log('═══════════════════════════════════════════════')
  console.log(JSON.stringify(addresses, null, 2))
}

/** Wait N blocks for Polygonscan to index newly deployed contracts */
async function waitForIndexing(blocks: number) {
  console.log(`   Waiting ${blocks} blocks for Polygonscan indexing...`)
  return new Promise((resolve) => setTimeout(resolve, blocks * 3000))
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Deployment failed:', error)
    process.exit(1)
  })
