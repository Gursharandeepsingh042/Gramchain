import axios from 'axios';
import * as dotenv from 'dotenv';
import * as readline from 'readline';

dotenv.config();

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query: string): Promise<string> => {
    return new Promise((resolve) => rl.question(query, resolve));
};

const testAadhaarVerify = async () => {
    const apiKey = process.env.SANDBOX_API_KEY;
    const apiSecret = process.env.SANDBOX_API_SECRET;

    if (!apiKey || !apiSecret) {
        console.error('❌ API Key or Secret missing in .env');
        process.exit(1);
    }

    try {
        console.log('🔄 Authenticating...');
        const authRes = await axios.post(
            'https://api.sandbox.co.in/authenticate',
            {},
            { headers: { 'x-api-key': apiKey, 'x-api-secret': apiSecret, 'x-api-version': '1.0' } }
        );
        const token = authRes.data.access_token;
        console.log('✅ Token obtained.');

        const aadhaarNumber = await question('📝 Enter Aadhaar Number to test (12 digits): ');
        if (aadhaarNumber.length !== 12) {
            console.error('❌ Invalid Aadhaar length');
            rl.close();
            return;
        }

        console.log('🔄 Sending OTP...');
        const otpRes = await axios.post(
            'https://api.sandbox.co.in/kyc/aadhaar/okyc/otp',
            {
                "@entity": "in.co.sandbox.kyc.aadhaar.okyc.otp.request",
                "aadhaar_number": aadhaarNumber,
                "consent": "Y",
                "reason": "For KYC"
            },
            {
                headers: {
                    'Authorization': token,
                    'x-api-key': apiKey,
                    'x-api-version': '1.0',
                    'Content-Type': 'application/json'
                }
            }
        );

        const referenceId = otpRes.data.data?.reference_id || otpRes.data.reference_id;
        console.log('✅ OTP Sent! Reference ID:', referenceId);
        console.log('📱 Please check your mobile for the OTP.');

        const otp = await question('📝 Enter the 6-digit OTP received: ');
        
        console.log('🔄 Verifying OTP...');
        const verifyRes = await axios.post(
            'https://api.sandbox.co.in/kyc/aadhaar/okyc/otp/verify',
            {
                "@entity": "in.co.sandbox.kyc.aadhaar.okyc.request",
                "reference_id": String(referenceId),
                "otp": String(otp),
                "consent": "Y",
                "reason": "For KYC"
            },
            {
                headers: {
                    'Authorization': token,
                    'x-api-key': apiKey,
                    'x-api-version': '1.0',
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('✅ Aadhaar Verified Successfully!');
        console.log('👤 Details:', JSON.stringify(verifyRes.data.data, null, 2));

    } catch (error: any) {
        console.error('❌ Aadhaar Test Failed!');
        console.error(error.response?.data || error.message);
    } finally {
        rl.close();
    }
};

testAadhaarVerify();
