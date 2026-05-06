import http from 'k6/http'
import { check, sleep } from 'k6'

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'
const TOKEN    = __ENV.AUTH_TOKEN  // set to a valid JWT before running
const SHG_ID   = __ENV.SHG_ID || 'test-shg-1'

export const options = {
  scenarios: {
    cached: {
      executor: 'constant-vus',
      vus: 30,
      duration: '1m',
      exec: 'cached',
    },
    refresh: {
      executor: 'constant-vus',
      vus: 5,
      duration: '1m',
      exec: 'refresh',
      startTime: '15s',
    },
  },
  thresholds: {
    'http_req_duration{scenario:cached}':  ['p(95)<400'],
    'http_req_duration{scenario:refresh}': ['p(95)<2000'],
    http_req_failed:                       ['rate<0.02'],
  },
}

const headers = () => ({ Authorization: `Bearer ${TOKEN}` })

export function cached() {
  const res = http.get(
    `${BASE_URL}/api/v1/loan/credit-score?shgId=${SHG_ID}&amount=25000`,
    { headers: headers() },
  )
  check(res, {
    '200': (r) => r.status === 200,
    'has score': (r) => typeof r.json('data.score') === 'number',
  })
  sleep(0.5)
}

export function refresh() {
  const res = http.get(
    `${BASE_URL}/api/v1/loan/credit-score?shgId=${SHG_ID}&amount=25000&refresh=true`,
    { headers: headers() },
  )
  check(res, {
    '200': (r) => r.status === 200,
    'cached:false': (r) => r.json('data.cached') === false,
  })
  sleep(2)
}
