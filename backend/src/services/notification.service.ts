export const sendPushNotification = async (userId: string, title: string, body: string, data?: any) => {
    if (process.env.DEMO_MODE === 'true') {
        console.log(`[PUSH NOTIFICATION to ${userId}] ${title} - ${body}`)
        return
    }

    // In a real implementation we would integrate Firebase Admin SDK here.
    console.log(`Notification queued for ${userId}`)
}
