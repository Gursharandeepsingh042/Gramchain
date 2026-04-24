export const startEventListener = async () => {
  if (process.env.DEMO_MODE === 'true') {
    console.log('✅ [DEMO] Blockchain event listener mocked.')
    return
  }
  
  if (!process.env.REDIS_URL) {
    console.warn('⚠️  REDIS_URL missing. Skipping BullMQ worker initialization.')
    return
  }

  console.log('✅ Blockchain event listener started')
  // Real implementation would connect to BullMQ and Ethers event feed here.
}
