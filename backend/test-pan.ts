import axios from 'axios';
import * as dotenv from 'dotenv';
dotenv.config();

const testPanVerify = async () => {
    const apiKey = process.env.SANDBOX_API_KEY;
    const apiSecret = process.env.SANDBOX_API_SECRET;

    console.log('🔄 Authenticating...');
    const authRes = await axios.post(
        'https://api.sandbox.co.in/authenticate',
        {},
        { headers: { 'x-api-key': apiKey, 'x-api-secret': apiSecret, 'x-api-version': '1.0' } }
    );
    const token = authRes.data.access_token;
    console.log('✅ Token obtained:', token.substring(0, 10) + '...');

    console.log('🔄 Verifying PAN RJEPS1465R...');
    try {
        const response = await axios.post(
            'https://api.sandbox.co.in/kyc/pan/verify',
            { 
                "@entity": "in.co.sandbox.kyc.pan_verification.request",
                "pan": 'RJEPS1465R',
                "name_as_per_pan": "GURSHARAN SINGH",
                "date_of_birth": "01/01/1990",
                "consent": 'Y',
                "reason": 'For KYC'
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
        console.log('✅ PAN Verify Success:', response.data);
    } catch (error: any) {
        console.error('❌ PAN Verify Failed!');
        console.error(error.response?.data || error.message);
    }
};

testPanVerify();
