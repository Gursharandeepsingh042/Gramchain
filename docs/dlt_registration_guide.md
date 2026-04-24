# Indian DLT Registration Guide (for SMS/OTP)

Under TRAI (Telecom Regulatory Authority of India) regulations, every business in India must register on a **DLT (Distributed Ledger Technology)** portal to send SMS and OTPs.

Follow this step-by-step process to get your GramChain OTPs running in production.

---

## Step 1: Principal Entity (PE) Registration
You must register your business as a legal entity on **one** of the telecom DLT portals. You do not need to register on all of them.

**Popular Portals:**
- [Jio DLT](https://trueconnect.jio.com/)
- [Airtel DLT](https://www.airtel.in/business/commercial-communication/home)
- [Vodafone Idea (VIL Power)](https://www.vilpower.in/)
- [BSNL DLT](https://www.ucc-bsnl.co.in/)

**Required Documents:**
- PAN Card (Business/Individual)
- GST Certificate / Business Registration
- Letter of Authorization (for the person registering)
- Address Proof

**Result:** Once approved, you will receive a **Principal Entity ID (PE ID)**.

---

## Step 2: Header (Sender ID) Registration
Once your Entity is approved, you need to register the 6-character name that appears on the user's phone (e.g., `GRAMCH`).

1. Log in to your DLT Portal.
2. Go to **Header Management > Create New Header**.
3. **Header Type**: Choose "Transactional" or "Service Implicit" for OTPs.
4. **Header Name**: Enter your desired 6-letter name (e.g., `GRAMCH`).
5. **Justification**: Briefly explain that this is for your mobile app "GramChain" to send OTPs.

**Result:** Once approved, this is your **Sender ID**.

---

## Step 3: Content Template Registration
Every message content must be pre-approved.

1. In the DLT Portal, go to **Template Management > Content Template**.
2. **Template Type**: Service Implicit.
3. **Header**: Select your approved Header (e.g., `GRAMCH`).
4. **Template Content**: 
   - *Example:* `{#var#} is your GramChain verification code. Do not share it with anyone.`
   - *Note:* Use `{#var#}` for the actual 6-digit OTP.
5. **Brand Name**: Ensure "GramChain" is mentioned in the template.

**Result:** Once approved, you will get a **DLT Template ID (DLT_TE_ID)**.

---

## Step 4: Map to MSG91 & your App
Finally, you must link these DLT IDs to your MSG91 account and our backend configuration.

1. **In MSG91 Dashboard**:
   - Go to **Settings > Configuration**.
   - Enter your **Principal Entity ID (PE ID)**.
   - Go to **OTP > Templates** and create a template there that matches your DLT template exactly. This gives you a **MSG91 Template ID**.

2. **In our Project (`backend/.env`)**:
   - Fill in the IDs you received:

```bash
# Found in MSG91 OTP Dashboard
MSG91_TEMPLATE_ID="YOUR_MSG91_TEMPLATE_ID"

# Found in DLT Portal (numeric ID)
MSG91_DLT_ID="YOUR_DLT_TEMPLATE_ID"

# Your 6-letter approved name
MSG91_SENDER_ID="GRAMCH"
```

---

> [!TIP]
> **Registration Fee**: Most DLT portals charge a one-time registration fee of approximately ₹5,900 (inclusive of GST). Some portals like **Jio** occasionally offer free registration.

> [!CAUTION]
> **Content Matching**: Your SMS will be blocked if the content you send from the code does not match your DLT approved template **character-for-character**.
