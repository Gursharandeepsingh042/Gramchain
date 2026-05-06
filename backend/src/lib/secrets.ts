/**
 * Secret Resolver — KMS-ready secret abstraction.
 *
 * In dev/staging: secrets come from process.env.
 * In production: a KMS adapter (AWS Secrets Manager / GCP Secret Manager / HashiCorp Vault)
 * can be plugged in by setting SECRET_PROVIDER=aws|gcp|vault and implementing the resolver.
 *
 * Why this exists: see SEC1 / SEC10 in PLAN_TO_PROD.md — secrets in env vars are
 * a single point of failure. This file gives us one place to swap that out without
 * touching every caller.
 *
 * Usage:
 *   import { getSecret } from '@/lib/secrets'
 *   const key = await getSecret('BACKEND_PRIVATE_KEY')
 */

import { logger } from './logger'

type SecretProvider = 'env' | 'aws' | 'gcp' | 'vault'

const PROVIDER: SecretProvider =
  (process.env.SECRET_PROVIDER as SecretProvider) || 'env'

// In-memory cache (cold-start fetch, then reuse for the process lifetime).
// Restart the process to rotate.
const cache = new Map<string, string>()

/**
 * Resolve a secret by name. Throws if not found in production.
 * Returns undefined in dev/test if missing (callers handle dev fallbacks).
 */
export async function getSecret(name: string): Promise<string | undefined> {
  if (cache.has(name)) return cache.get(name)

  let value: string | undefined

  switch (PROVIDER) {
    case 'aws':
      value = await fetchFromAwsSecretsManager(name)
      break
    case 'gcp':
      value = await fetchFromGcpSecretManager(name)
      break
    case 'vault':
      value = await fetchFromVault(name)
      break
    case 'env':
    default:
      value = process.env[name]
      break
  }

  if (value !== undefined) {
    cache.set(name, value)
  } else if (process.env.NODE_ENV === 'production') {
    logger.fatal({ name, provider: PROVIDER }, 'FATAL: required secret not found')
    throw new Error(`Required secret "${name}" not found via provider "${PROVIDER}"`)
  }

  return value
}

/**
 * Sync convenience wrapper for callers that have already cached the secret
 * (e.g. blockchain.service warm-loads keys at startup).
 */
export function getSecretSync(name: string): string | undefined {
  return cache.get(name) ?? process.env[name]
}

/**
 * Warm-load a list of secrets at startup so latency-sensitive code paths
 * (e.g. signing a tx, decrypting KYC PII) hit the cache instead of the network.
 */
export async function warmSecrets(names: string[]): Promise<void> {
  await Promise.all(names.map((n) => getSecret(n)))
  logger.info({ count: names.length, provider: PROVIDER }, 'Secrets warmed')
}

// ─── Provider Adapters ──────────────────────────────────────
// These are stubs you implement when you provision the actual KMS.
// Keeping them in this file (rather than separate adapter files) so the
// scaffolding is in one place — extract later if list grows.

async function fetchFromAwsSecretsManager(name: string): Promise<string | undefined> {
  // Implement when AWS_REGION + IAM role are wired up.
  // Example:
  //   import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'
  //   const client = new SecretsManagerClient({ region: process.env.AWS_REGION })
  //   const out = await client.send(new GetSecretValueCommand({ SecretId: name }))
  //   return out.SecretString
  logger.warn({ name }, 'AWS provider not implemented — falling back to env')
  return process.env[name]
}

async function fetchFromGcpSecretManager(name: string): Promise<string | undefined> {
  // Implement when GCP project + service account are wired up.
  // Example:
  //   import { SecretManagerServiceClient } from '@google-cloud/secret-manager'
  //   const client = new SecretManagerServiceClient()
  //   const [v] = await client.accessSecretVersion({
  //     name: `projects/${process.env.GCP_PROJECT_ID}/secrets/${name}/versions/latest`,
  //   })
  //   return v.payload?.data?.toString()
  logger.warn({ name }, 'GCP provider not implemented — falling back to env')
  return process.env[name]
}

async function fetchFromVault(name: string): Promise<string | undefined> {
  // Implement when Vault is provisioned.
  // Example:
  //   const token = process.env.VAULT_TOKEN
  //   const url = `${process.env.VAULT_ADDR}/v1/secret/data/${name}`
  //   const r = await axios.get(url, { headers: { 'X-Vault-Token': token } })
  //   return r.data?.data?.data?.value
  logger.warn({ name }, 'Vault provider not implemented — falling back to env')
  return process.env[name]
}
