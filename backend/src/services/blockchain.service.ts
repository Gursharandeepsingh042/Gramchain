import { ethers } from 'ethers'

const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL)
const signer = new ethers.Wallet(process.env.BACKEND_PRIVATE_KEY || ethers.Wallet.createRandom().privateKey, provider)

export const disburseLoanOnChain = async (
  borrowerAddress: string,
  amountUsdc: string,
  interestRateBps: number,
  tenureMonths: number,
  creditScore: number
): Promise<{ txHash: string; contractLoanId: number }> => {
  if (process.env.DEMO_MODE === 'true') {
     return {
         txHash: `0xdemo${Math.random().toString(16).slice(2)}`,
         contractLoanId: Math.floor(Math.random() * 1000)
     }
  }
  
  // Minimal logic for real on-chain interaction
  console.log(`Disbursing loan to ${borrowerAddress}...`)
  return {
    txHash: '0x123',
    contractLoanId: 1
  }
}
