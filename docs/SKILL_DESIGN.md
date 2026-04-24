# GramChain — Design Skill Guide
**Tools:** Figma | Design System for React Native + NativeWind

---

## 1. Design Principles

1. **Clarity over complexity** — Rural users need immediate comprehension. One action per screen.
2. **Trust signals everywhere** — Green checkmarks, lock icons, "secured by blockchain" subtexts build psychological safety.
3. **Financial literacy first** — Use visual metaphors (piggy banks, calendars) not crypto jargon.
4. **Large touch targets** — Minimum 48×48dp for all interactive elements (WCAG 2.1 AA).
5. **Low-bandwidth assets** — SVG icons, system fonts (no heavy web fonts), compressed images < 100KB.

---

## 2. Color System

```ts
// constants/colors.ts
export const colors = {
  // Primary — Trust Green (financial safety)
  primary: {
    50:  '#f0fdf4',
    100: '#dcfce7',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',  // Main CTA
    700: '#15803d',
    900: '#14532d',
  },
  
  // Secondary — Warm Amber (attention, warnings)
  secondary: {
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
  },
  
  // Danger — Status red
  danger: {
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
  },
  
  // Neutrals
  gray: {
    50:  '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    500: '#6b7280',
    700: '#374151',
    900: '#111827',
  },
  
  // Semantic
  background: '#f9fafb',
  surface:    '#ffffff',
  border:     '#e5e7eb',
  text: {
    primary:   '#111827',
    secondary: '#6b7280',
    inverse:   '#ffffff',
  }
}
```

---

## 3. Typography

```ts
// constants/typography.ts
// Uses system fonts for performance
export const typography = {
  // Devanagari-compatible system font stack
  fontFamily: {
    regular: 'System',    // Platform default (supports Hindi)
    medium:  'System',
    bold:    'System',
  },
  
  fontSize: {
    xs:   12,
    sm:   14,
    base: 16,
    lg:   18,
    xl:   20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },
  
  lineHeight: {
    tight:  1.25,
    normal: 1.5,
    loose:  1.75,  // Better for Devanagari script
  }
}
```

---

## 4. Component Design Tokens (NativeWind classes)

### Buttons
```tsx
// Primary CTA
<TouchableOpacity className="bg-green-600 rounded-2xl py-4 px-6 active:bg-green-700">
  <Text className="text-white text-base font-semibold text-center">Apply for Loan</Text>
</TouchableOpacity>

// Secondary / Ghost
<TouchableOpacity className="border border-green-600 rounded-2xl py-4 px-6">
  <Text className="text-green-600 text-base font-semibold text-center">View Details</Text>
</TouchableOpacity>

// Danger
<TouchableOpacity className="bg-red-500 rounded-2xl py-4 px-6">
  <Text className="text-white text-base font-semibold text-center">Cancel Loan</Text>
</TouchableOpacity>
```

### Cards
```tsx
<View className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
  {/* Card content */}
</View>

// Highlighted card (active loan)
<View className="bg-green-600 rounded-3xl p-5">
  {/* White text on green */}
</View>
```

### Input Fields
```tsx
<View className="border border-gray-200 rounded-2xl px-4 py-3 bg-gray-50">
  <Text className="text-xs text-gray-500 mb-1">Loan Amount (₹)</Text>
  <TextInput
    className="text-lg font-semibold text-gray-900"
    keyboardType="numeric"
    placeholder="10,000"
    placeholderTextColor="#9ca3af"
  />
</View>
```

---

## 5. Screen Layouts

### Dashboard Screen Layout
```
┌─────────────────────────────────┐
│  🌿 GramChain        [🔔] [👤]  │  Header (safe area)
├─────────────────────────────────┤
│  नमस्ते, Meera Devi 🙏          │
│                                 │
│  ┌─────────────────────────┐   │
│  │  💚 Group Savings Pool  │   │  Hero Card (green bg)
│  │  ₹ 1,24,500             │   │
│  │  SHG: Shakti Mahila     │   │
│  └─────────────────────────┘   │
│                                 │
│  Active Loan ──────────────────│
│  ┌─────────────────────────┐   │
│  │  ₹ 25,000  @18% APR    │   │  Loan Card
│  │  Next EMI: ₹2,450       │   │
│  │  Due: 15 April 2026     │   │
│  │  [Pay Now ▶]            │   │
│  └─────────────────────────┘   │
│                                 │
│  Quick Actions ─────────────── │
│  [💰 Borrow] [📊 History]      │
│  [👥 Group]  [📅 Meetings]     │
└─────────────────────────────────┘
│  Home   Borrow   Group  Profile │  Tab Bar
└─────────────────────────────────┘
```

### Loan Application Flow
```
Step 1: Amount Input
  → Large numeric input
  → Purpose selector (chips: Agriculture, Business, Education, Medical, Other)
  → Tenure selector (3 / 6 / 12 months)

Step 2: ML Credit Score (animated)
  → Circular gauge animates from 0 to score
  → Color: < 500 red, 500-650 amber, > 650 green
  → Recommendation badge

Step 3: Loan Terms Preview
  → Principal, Interest Rate, EMI Amount table
  → Repayment calendar visualization
  → "Submit to Group" button

Step 4: Group Approval Tracker
  → Member avatars with ✅/⏳ status
  → Real-time updates via WebSocket

Step 5: Disbursement Confirmation
  → Success animation (Lottie)
  → Transaction hash (truncated)
  → "View in Explorer" link
```

---

## 6. Iconography

Use **react-native-vector-icons (MaterialCommunityIcons)** for consistency.

```ts
// Key icon mappings
const icons = {
  loan:       'cash-multiple',
  group:      'account-group',
  savings:    'piggy-bank',
  repayment:  'calendar-check',
  blockchain: 'link-variant',
  secured:    'shield-check',
  warning:    'alert-circle',
  success:    'check-circle',
  profile:    'account-circle',
  meeting:    'calendar-today',
  history:    'history',
  settings:   'cog',
}
```

---

## 7. Micro-animations

```ts
// Use react-native-reanimated for smooth animations

// Credit score gauge animation
import Animated, { useSharedValue, withSpring } from 'react-native-reanimated'

const scoreAnim = useSharedValue(0)
scoreAnim.value = withSpring(targetScore, { damping: 20, stiffness: 90 })

// Loan card entrance
const cardOpacity = useSharedValue(0)
const cardTranslateY = useSharedValue(20)
useEffect(() => {
  cardOpacity.value = withSpring(1)
  cardTranslateY.value = withSpring(0)
}, [])

// Success state (Lottie)
import LottieView from 'lottie-react-native'
<LottieView
  source={require('@/assets/animations/success.json')}
  autoPlay loop={false}
  style={{ width: 200, height: 200 }}
/>
```

---

## 8. Accessibility Standards

```tsx
// Every interactive element must have:
<TouchableOpacity
  accessibilityLabel="Pay EMI of ₹2,450 due on April 15"
  accessibilityRole="button"
  accessibilityHint="Triggers blockchain payment transaction"
>

// Status indicators:
<View accessibilityLabel="Loan status: Active" accessibilityRole="text">
  <Text>🟢 Active</Text>
</View>

// Loading states:
<ActivityIndicator accessibilityLabel="Loading loan details" />
```

---

## 9. Figma File Structure

```
GramChain Design System
├── 🎨 Foundations
│   ├── Colors
│   ├── Typography
│   ├── Spacing (4px grid)
│   └── Shadows
├── 🧩 Components
│   ├── Buttons (Primary, Secondary, Ghost, Danger)
│   ├── Cards (Loan, Member, SHG, Transaction)
│   ├── Inputs (Text, Amount, Select, OTP)
│   ├── Navigation (Tab Bar, Headers)
│   └── Modals & Sheets
├── 📱 Screens
│   ├── Onboarding (4 screens)
│   ├── Auth (OTP, KYC)
│   ├── Dashboard
│   ├── Loan Flow (5 steps)
│   ├── Group Management
│   └── Profile
└── 🌀 Flows
    ├── Loan Application Flow
    └── Repayment Flow
```

---

## 10. Hindi Typography QA Checklist

- [ ] All Devanagari text renders without clipping (line-height ≥ 1.6 for Hindi)
- [ ] Number formatting uses Indian system (₹1,24,500 not ₹124,500)
- [ ] Date formats: DD/MM/YYYY or "15 अप्रैल 2026"
- [ ] No text truncation on Hindi strings (they can be 30-50% longer than English equivalents)
- [ ] Test on physical device with Hindi system keyboard
