import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

if (!admin.apps.length) {
    try {
        // Try multiple paths for the service account file:
        // 1. FIREBASE_SERVICE_ACCOUNT_JSON env var (Docker/Render/CI)
        // 2. firebase-service-account.json in cwd (local dev)
        // 3. firebase-service-account.json relative to this file (compiled dist/)
        const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
        if (raw && raw !== '{}') {
            const cleaned = raw.trim().replace(/^['"]|['"]$/g, '');
            const serviceAccount = JSON.parse(cleaned);
            if (serviceAccount.private_key) {
                serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
            }
            admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
            console.log('✅ Firebase Admin initialized from env for project:', serviceAccount.project_id);
        } else {
            const candidates = [
                path.join(process.cwd(), 'firebase-service-account.json'),
                path.join(__dirname, '..', '..', 'firebase-service-account.json'),
            ]
            let initialized = false
            for (const credentialsPath of candidates) {
                if (fs.existsSync(credentialsPath)) {
                    const serviceAccount = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
                    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
                    console.log('✅ Firebase Admin initialized from file for project:', serviceAccount.project_id);
                    initialized = true
                    break
                }
            }
            if (!initialized) {
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
