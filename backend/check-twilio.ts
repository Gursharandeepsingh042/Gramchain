import * as dotenv from 'dotenv';
dotenv.config();

const checkTwilioLogs = async () => {
    const sid = process.env.TWILIO_SID;
    const token = process.env.TWILIO_TOKEN;

    if (!sid || !token) {
        console.error('❌ Twilio credentials missing in .env');
        process.exit(1);
    }

    try {
        const client = require('twilio')(sid, token);
        console.log('Fetching recent messages...');
        const messages = await client.messages.list({ limit: 5 });
        
        messages.forEach((m: any) => {
            console.log(`\nMessage SID: ${m.sid}`);
            console.log(`To: ${m.to}`);
            console.log(`Status: ${m.status}`);
            if (m.errorCode) {
                console.log(`Error Code: ${m.errorCode}`);
                console.log(`Error Message: ${m.errorMessage}`);
            }
        });
    } catch (error: any) {
        console.error('❌ Twilio Error:', error.message);
    }
};

checkTwilioLogs();
