import * as dotenv from 'dotenv';
dotenv.config();

const testTwilio = async () => {
    const sid = process.env.TWILIO_SID;
    const token = process.env.TWILIO_TOKEN;
    const phone = process.env.TWILIO_PHONE;

    if (!sid || !token || !phone) {
        console.error('❌ Twilio credentials missing in .env');
        process.exit(1);
    }

    console.log(`🔄 Attempting to send SMS from ${phone} using Twilio...`);
    try {
        const client = require('twilio')(sid, token);
        const message = await client.messages.create({
            body: `Test SMS from GramChain to verify Twilio works!`,
            from: phone,
            to: `+919622599557` // User's magic phone number, or maybe they can change it
        });
        console.log('✅ SMS successfully queued/sent!');
        console.log('Message SID:', message.sid);
    } catch (error: any) {
        console.error('❌ Twilio sending Failed!');
        console.error('Error Code:', error.code);
        console.error('Error Message:', error.message);
        console.error('More Info:', error.moreInfo);
    }
};

testTwilio();
