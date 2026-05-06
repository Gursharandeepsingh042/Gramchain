# GramChain — Tester Onboarding Guide

> **Welcome.** Thanks for testing GramChain. This is a 10-minute read.
> Skim it once, then keep it open while you test.

---

## 1. What You're Testing

GramChain is a hybrid mobile app for Self-Help Group (SHG) micro-lending in
rural India. Loans are accounted in INR and recorded on Polygon for audit.
**No real money moves** in this build — all payments are simulated.

You will be one of three personas:

| Role | What You Do |
|---|---|
| **Borrower** | Sign up, complete KYC, join an SHG, apply for a loan, repay EMIs |
| **Lender** | Sign up, browse SHGs, fund a pool, watch repayments come in |
| **SHG Leader** | (After borrower flow) approve other members' loan applications |

---

## 2. Install the APK

1. Download the APK link sent to you separately (EAS Internal Distribution).
2. On your Android phone: Settings → Security → enable **"Install from unknown sources"** for your browser.
3. Open the APK file → install. The first launch may take 5–10 seconds.

> ⚠️ The app currently targets **Android only**. iOS testing is in the next round.

---

## 3. Test Accounts

You can use either of these:

### Option A — Whitelisted Test Phone Numbers (recommended)
No SMS will arrive — use the OTP given below.

| Phone | OTP |
|---|---|
| `+919999900001` | `100001` |
| `+919999900002` | `100002` |
| `+919999900003` | `100003` |

### Option B — Your Real Number
A real SMS will arrive (subject to a 10/day quota across all testers).

### Google Sign-In
Any Google account works — but use one you don't mind getting an account
linked to a test build.

---

## 4. The Happy Path (Borrower)

Follow exactly this flow first; then explore.

1. Open app → **Get Started** → choose **Borrower**
2. Tap **Sign Up with Phone** → enter `+919999900001`
3. Enter OTP `100001` → app moves to KYC
4. Fill the **KYC form** with any plausible values — Aadhaar / PAN / address
   (sandbox API auto-approves)
5. On the **Home** tab, tap **Join an SHG** → use invite code `TEST-SHG-001`
6. Open the **Loans** tab → enter `15000` for amount, choose `6 months` tenure
7. Watch your **credit score** appear (≈ 700–750 expected)
8. Tap **↻ Refresh** next to the score — it should refetch and update
9. Submit the loan application. The status should be **PENDING**.
10. Switch to test account `+919999900002` (it's the SHG leader) and approve
    the loan from the **Group** tab.
11. Switch back to `+919999900001` — loan status now **APPROVED → ACTIVE** in
    the next 30 seconds (backend job picks it up).
12. Open the loan, tap **Pay EMI** → confirms the on-chain mark within a minute.

---

## 5. The Happy Path (Lender)

1. Logout → **Get Started** → choose **Lender**
2. Sign up with phone or Google
3. Open **Invest** tab → see SHGs you can fund
4. Tap any SHG → **Invest ₹5000** → confirm
5. Open **Portfolio** → see your contribution + projected returns
6. Open **Impact** → social-impact metrics

---

## 6. Known Issues (Don't Report These)

| Issue | Status |
|---|---|
| Razorpay payments throw "test mode only" toast | Expected — no real gateway wired |
| ML model returns 720 in DEMO_MODE | Expected — real model in next phase |
| Contracts are on Polygon Amoy testnet, not mainnet | Expected — by design |
| Some toast messages flash twice | Tracked, low-priority |
| Pull-to-refresh on Schemes tab does nothing | By design — that screen is static |

---

## 7. What We Want You to Find

Please prioritise reports of:

1. **Auth flow breakage** — any phone/email/Google flow that hangs or errors
2. **Visual glitches** on devices smaller than 6" or with cutout displays
3. **Slow screens** (anything > 3 seconds to load on 4G)
4. **Confusing copy** — places where you didn't know what to do next
5. **Crashes** — please send us the time + your phone model

Stretch goals:
- Try with airplane-mode toggled mid-flow (offline resilience)
- Try with very slow network (Chrome DevTools → throttle to 3G via VPN-style tool)
- Try rapidly tapping the **Apply** button — should not double-submit

---

## 8. How to File a Bug

Three options, in order of preference:

1. **Feedback form**: <https://forms.gle/REPLACE-ME>
2. **In-app shake** to open the report sheet → describe + send (auto-attaches logs)
3. **WhatsApp** the lead: include screenshot + steps + your phone model

Required info on every bug:

```
Device:        e.g. Realme C53, Android 14
Account:       e.g. +919999900001
Steps:         1. Opened Loans tab
               2. Entered ₹20,000
               3. Tapped Apply
What happened: App froze for 8 seconds, then showed a generic error toast
Expected:      Loan goes to PENDING, redirects to Home
Screenshot:    [attached]
```

---

## 9. Privacy & Data

- All your test data lives in our staging Postgres (`gramchain-staging`)
- We will wipe the staging DB **at the end of the testing window**
- Do **not** put real Aadhaar / PAN numbers — generate fake ones at
  <https://www.fakepersongenerator.com/india-fake-name-generator>
- Your phone number is hashed before storage; we keep the hash for 30 days

---

## 10. Contact

| What | Who |
|---|---|
| Test build issues / OTP not arriving | Backend lead — `<phone>` |
| Crashes / UI bugs | Mobile lead — `<phone>` |
| Wallet / blockchain weirdness | Smart contract lead — `<phone>` |
| Anything else | Project owner — `<phone>` |

---

## 11. Helpful Commands (for power testers only)

If you have `adb` set up:

```powershell
# View live app logs
adb logcat | Select-String "GramChain|ReactNative|Firebase"

# Force-stop the app
adb shell am force-stop com.gramchain.gramchain

# Clear app data (signs you out)
adb shell pm clear com.gramchain.gramchain
```

---

**Thank you for testing GramChain.** Every bug you find now is one a real
SHG member doesn't have to face. 🙏
