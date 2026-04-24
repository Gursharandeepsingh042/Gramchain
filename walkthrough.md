# GramChain Frontend — Complete UI Overhaul

## Overview

Complete redesign of the GramChain mobile frontend from bare-bones scaffolding to a premium, production-grade UI with animations, design tokens, and polished screens.

---

## Design System (Constants)

### [colors.ts](file:///c:/Users/GURSHARAN/.vscode/DeFI%20Loan/mobile/constants/colors.ts)
- **Primary**: Trust Green palette (50–900) with brand shadow
- **Secondary**: Warm Amber for alerts/warnings
- **Danger/Info**: Full palettes with semantic tokens
- **Gradients**: Pre-defined LinearGradient arrays for hero cards, onboarding, etc.
- **Score Colors**: Mapped to credit score ranges (poor/fair/good/excellent)
- **Status Pills**: Background + text + dot colors per status (active/pending/approved/rejected/closed)
- **Shadow Tokens**: Named shadows (xs → xl, green, amber)

### [typography.ts](file:///c:/Users/GURSHARAN/.vscode/DeFI%20Loan/mobile/constants/typography.ts)
- Platform-aware font families (including monospace)
- Pre-composed text presets: `hero`, `h1`–`h4`, `body`, `bodyHindi`, `caption`, `label`, `overline`, `amount`, `mono`
- Extra line-height for Devanagari script (1.8)

### [design.ts](file:///c:/Users/GURSHARAN/.vscode/DeFI%20Loan/mobile/constants/design.ts)
- 4px-base spacing scale (0–32) with semantic tokens (`screenPadding`, `cardPadding`, etc.)
- Border radii (including component-specific: `button`, `card`, `input`, `pill`)
- Shadows with proper `elevation` for Android
- Animation spring configs (`snappy`, `bouncy`, `gentle`, `slow`)
- Z-index layers and WCAG hit-slop presets

---

## UI Components

### [Button.tsx](file:///c:/Users/GURSHARAN/.vscode/DeFI%20Loan/mobile/components/ui/Button.tsx)
- **7 variants**: primary, secondary, ghost, danger, warning, outline, blockchain
- **4 sizes**: sm, md, lg, xl
- Press-scale spring animation via `Animated.spring`
- Brand green shadow on primary CTA
- Icon left/right slots
- Full accessibility props

### [Input.tsx](file:///c:/Users/GURSHARAN/.vscode/DeFI%20Loan/mobile/components/ui/Input.tsx)
- **3 components**: `Input`, `OtpInput`, `AmountInput`
- Animated focus border color transition
- Prefix (₹, +91) and suffix/clear-button support
- OTP box input with hidden TextInput trick
- AmountInput with large ₹ symbol and max-eligible hint
- Error + hint states with icons

### [CreditScoreGauge.tsx](file:///c:/Users/GURSHARAN/.vscode/DeFI%20Loan/mobile/components/ui/CreditScoreGauge.tsx)
- SVG 270° arc gauge with `react-native-reanimated` + `react-native-svg`
- Animated fill with `interpolateColor` (red → amber → green)
- Score markers at 300, 500, 650, 750, 900
- Hindi label ("आपका स्कोर") with quality badge pill
- Score range legend (Poor/Fair/Good/Excellent)

### [LoanCard.tsx](file:///c:/Users/GURSHARAN/.vscode/DeFI%20Loan/mobile/components/ui/LoanCard.tsx)
- Status pill with animated dot (5 states)
- Meta row with interest rate / tenure / EMI dividers
- Repayment progress bar with fraction label
- EMI due date with amber dot indicator
- Blockchain pending message for APPROVED status
- Green shadow "Pay EMI Now →" CTA

### [MemberCard.tsx](file:///c:/Users/GURSHARAN/.vscode/DeFI%20Loan/mobile/components/ui/MemberCard.tsx)
- Auto-generated avatar initials with name-hash color
- Role badge (Leader/Member/Admin)
- KYC verified/pending indicator
- Approval status emoji (for loan voting)

### [SharedComponents.tsx](file:///c:/Users/GURSHARAN/.vscode/DeFI%20Loan/mobile/components/ui/SharedComponents.tsx)
- **Header**: Left/center/right layout, transparent/solid variants
- **Card**: 6 variants (default, elevated, outlined, success, warning, hero)
- **Badge**: 5 color variants with optional dot
- **StatCard**: Value + trend arrow + subtext
- **Chip**: Selectable chip for purpose/tenure pickers
- **Divider**: Optional label in center
- **Skeleton**: Animated pulse loader
- **EmptyState**: Icon + title + subtitle + CTA button
- **TrustBadge**: "🔒 Secured by Blockchain ⛓"
- **QuickAction**: Icon circle button with label

---

## Screens

### Auth Flow
| Screen | Key Features |
|--------|-------------|
| [welcome.tsx](file:///c:/Users/GURSHARAN/.vscode/DeFI%20Loan/mobile/app/(auth)/welcome.tsx) | Staggered entrance animation, pulsing logo, feature list, blob backgrounds, language toggle |
| [otp.tsx](file:///c:/Users/GURSHARAN/.vscode/DeFI%20Loan/mobile/app/(auth)/otp.tsx) | Two-step (phone → OTP), country code prefix, OTP box input, 30s countdown timer, animated step transition |
| [kyc.tsx](file:///c:/Users/GURSHARAN/.vscode/DeFI%20Loan/mobile/app/(auth)/kyc.tsx) | 3-step progress with connector lines, animated step completion, Aadhaar + Bank + Wallet flow, success state |

### Tab Screens
| Screen | Key Features |
|--------|-------------|
| [Dashboard](file:///c:/Users/GURSHARAN/.vscode/DeFI%20Loan/mobile/app/(tabs)/index.tsx) | Staggered 5-section entrance, hero SHG card with decorative circles, stat cards (score + total borrowed), LoanCard with progress bar, quick actions grid, skeleton loaders |
| [Borrow](file:///c:/Users/GURSHARAN/.vscode/DeFI%20Loan/mobile/app/(tabs)/borrow.tsx) | 3-step flow (Amount → Score → Review), step indicator, purpose/tenure chips, AmountInput, CreditScoreGauge, terms table, repayment calendar visualization |
| [Group](file:///c:/Users/GURSHARAN/.vscode/DeFI%20Loan/mobile/app/(tabs)/group.tsx) | Hero SHG card with member/pool stats, stat cards (collected/repayment rate), member list with MemberCards, upcoming meeting card |
| [Profile](file:///c:/Users/GURSHARAN/.vscode/DeFI%20Loan/mobile/app/(tabs)/profile.tsx) | Avatar with verified badge, wallet card, grouped settings rows (Account/Preferences/Support), language switch, logout confirmation dialog |

### [Tab Layout](file:///c:/Users/GURSHARAN/.vscode/DeFI%20Loan/mobile/app/(tabs)/_layout.tsx)
- Active tab indicator dot
- Platform-specific tab bar height
- Brand colors with shadow

---

## i18n Updates
- Added `tabs` section (home/borrow/group/profile)
- Updated auth strings for new flow
- Added CLOSED/REJECTED loan status translations
- Improved Hindi translations for new copy

## Dependencies Added
- `react-native-svg` — for CreditScoreGauge SVG arc rendering

---

## Animations Summary
| Component | Animation Type |
|-----------|---------------|
| Welcome screen | Staggered fade-in + slide-up, logo pulse loop |
| OTP screen | Fade entrance, step cross-fade transition |
| KYC screen | Step progress with connector color interpolation |
| Dashboard | 5-section staggered spring entrance |
| Borrow flow | Step indicator transitions |
| Credit gauge | 1.8s arc fill with color interpolation |
| Button | Press-scale spring (0.96) |
| Skeleton | Opacity pulse loop |
