import http from 'k6/http'
import { check, sleep } from 'k6'

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'

// Each VU uses its own random phone to avoid OTP rate limit collisions.
// Backend must be running with DEMO_MODE=true so DEMO_OTP=123456 works.

export const options = {
  stages: [
    { duration: '20s', target: 10 },
    { duration: '40s', target: 30 },
    { duration: '20s', target: 0 },
  ],
  thresholds: {
    http_req_failed:   ['rate<0.02'],
    http_req_duration: ['p(95)<800'],
    checks:            ['rate>0.95'],
  },
}

function randomPhone() {
  return '9' + Math.floor(100000000 + Math.random() * 899999999).toString()
}

export default function () {
  const phone = randomPhone()
  const headers = { 'Content-Type': 'application/json' }

  // 1. Send OTP
  const sendRes = http.post(
    `${BASE_URL}/api/v1/auth/send-otp`,
    JSON.stringify({ phone }),
    { headers },
  )
  check(sendRes, { 'send-otp 200': (r) => r.status === 200 || r.status === 429 })

  // If rate limited, back off
  if (sendRes.status === 429) {
    sleep(2)
    return
  }

  sleep(0.3)

  // 2. Verify OTP (DEMO_OTP=123456 in dev)
  const verifyRes = http.post(
    `${BASE_URL}/api/v1/auth/verify-otp`,
    JSON.stringify({ phone, otp: '123456' }),
    { headers },
  )
  check(verifyRes, { 'verify-otp 200': (r) => r.status === 200 })

  sleep(1)
}
