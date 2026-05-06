import { HardhatUserConfig } from 'hardhat/config'
import '@nomicfoundation/hardhat-toolbox'
import '@nomicfoundation/hardhat-verify'
import * as dotenv from 'dotenv'

dotenv.config()

/**
 * Only treat DEPLOYER_PRIVATE_KEY as valid when it's a 32-byte hex string
 * (64 hex chars, with optional 0x prefix). This lets `hardhat compile` and
 * other non-network commands succeed even when the env var is a placeholder.
 */
const rawKey = process.env.DEPLOYER_PRIVATE_KEY?.trim() ?? ''
const normalizedKey = rawKey.startsWith('0x') ? rawKey.slice(2) : rawKey
const VALID_DEPLOYER_KEY = /^[0-9a-fA-F]{64}$/.test(normalizedKey) ? `0x${normalizedKey}` : ''
const networkAccounts = VALID_DEPLOYER_KEY ? [VALID_DEPLOYER_KEY] : []

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    // Local Hardhat node
    localhost: {
      url: 'http://127.0.0.1:8545',
    },
    // Polygon Amoy Testnet
    amoy: {
      url: process.env.POLYGON_AMOY_RPC_URL ?? 'https://rpc-amoy.polygon.technology',
      chainId: 80002,
      accounts: networkAccounts,
    },
    // Polygon Mainnet
    polygon: {
      url: process.env.POLYGON_MAINNET_RPC_URL ?? 'https://polygon-rpc.com',
      chainId: 137,
      accounts: networkAccounts,
      gasPrice: 'auto',
    },
  },
  etherscan: {
    apiKey: {
      polygon: process.env.POLYGONSCAN_API_KEY ?? '',
      polygonAmoy: process.env.POLYGONSCAN_API_KEY ?? '',
    },
    customChains: [
      {
        network: 'polygonAmoy',
        chainId: 80002,
        urls: {
          apiURL: 'https://api-amoy.polygonscan.com/api',
          browserURL: 'https://amoy.polygonscan.com',
        },
      },
    ],
  },
  paths: {
    sources: './contracts',
    tests: './test',
    artifacts: './artifacts',
  },
  typechain: {
    outDir: 'typechain-types',
    target: 'ethers-v6',
  },
}

export default config
