import http from 'k6/http'
import { check, sleep } from 'k6'

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'

export const options = {
  stages: [
    { duration: '30s', target: 50 },   // ramp to 50 VUs
    { duration: '1m',  target: 100 },  // sustained 100 VUs
    { duration: '30s', target: 0 },    // ramp down
  ],
  thresholds: {
    http_req_failed:   ['rate<0.01'],   // < 1% errors
    http_req_duration: ['p(95)<200'],   // p95 under 200ms
    checks:            ['rate>0.99'],
  },
}

export default function () {
  const res = http.get(`${BASE_URL}/health`)
  check(res, {
    'status is 200': (r) => r.status === 200,
    'has status:ok': (r) => (r.json('status') || r.json('data.status')) === 'ok',
  })
  sleep(0.5)
}
