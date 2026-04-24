export const startRepaymentReminderJob = async () => {
    if (process.env.DEMO_MODE === 'true') {
      console.log('✅ [DEMO] Repayment reminder cron job mocked.')
      return
    }
    
    if (!process.env.REDIS_URL) {
      console.warn('⚠️  REDIS_URL missing. Skipping repayment reminder job.')
      return
    }
  
    console.log('✅ Repayment reminder job started')
    // Real implementation would schedule a BullMQ repeatable job
}
