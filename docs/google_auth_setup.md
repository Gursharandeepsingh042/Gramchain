# Google Authentication Setup Guide

To resolve the "Authorization Blocked" error and ensure a smooth login experience on both Android, iOS, and Web, please follow these steps in your [Google Cloud Console](https://console.cloud.google.com/).

## 1. OAuth Consent Screen
1. Go to **APIs & Services > OAuth consent screen**.
2. **User Type**: Set to **External** (so any user can sign in).
3. **App Information**: Fill in "GramChain", your developer email, and the app logo.
4. **Scopes**: Add `.../auth/userinfo.email`, `.../auth/userinfo.profile`, and `openid`.
5. **Publish App**: Once you are ready for others to test, click **Publish App**. Note: Until published, only users in the "Test users" list can sign in.

## 2. API Credentials
You need separate Client IDs for each platform. Create them under **APIs & Services > Credentials**.

### 📱 Android Client ID
1. **Application Type**: Android
2. **Package Name**: `com.gramchain.app`
3. **SHA-1 Certificate Fingerprint**: 
   - Run `npx expo fetch:android:hashes` in your terminal to get the fingerprint for your development build.

### 🍎 iOS Client ID (Optional)
1. **Application Type**: iOS
2. **Bundle ID**: `com.gramchain.app`

### 🌐 Web Client ID (Crucial for Expo Go)
1. **Application Type**: Web application
2. **Authorized Redirect URIs**:
   - Add `https://auth.expo.io/@gramchain/gramchain`
   - Add `http://localhost:19006` (for web development)

---

## 3. Update Mobile App
Once you have the IDs, update your `mobile/app/(auth)/login.tsx` state or environment variables.

> [!IMPORTANT]
> **Whitelisting**: "Authorization Blocked" usually means the `redirectUri` hasn't been added to the **Web Client ID**'s whitelist. Ensure `https://auth.expo.io/@gramchain/gramchain` is added precisely.
