import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

if (!admin.apps.length) {
    try {
        // Production approach: load credentials from a dedicated JSON file.
        // This avoids all .env escaping issues with private keys.
        // process.cwd() = backend/ (where npm run dev is executed)
        const credentialsPath = path.join(process.cwd(), 'firebase-service-account.json');

        if (fs.existsSync(credentialsPath)) {
            const serviceAccount = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });
            console.log('✅ Firebase Admin initialized from file for project:', serviceAccount.project_id);
        } else {
            // Fallback: try environment variable (for CI/CD or Docker environments)
            const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
            if (raw && raw !== '{}') {
                const cleaned = raw.trim().replace(/^['"]|['"]$/g, '');
                const serviceAccount = JSON.parse(cleaned);
                if (serviceAccount.private_key) {
                    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
                }
                admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
                console.log('✅ Firebase Admin initialized from env for project:', serviceAccount.project_id);
            } else {
                console.warn('⚠️  No Firebase credentials found. Auth verification will fail.');
                admin.initializeApp();
            }
        }
    } catch (error: any) {
        console.error('❌ Firebase Admin initialization failed:', error.message);
        if (!admin.apps.length) admin.initializeApp();
    }
}

export default admin;
