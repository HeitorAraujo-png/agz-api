import { createHash, randomBytes } from 'node:crypto'
export function opaqueToken() {
  return randomBytes(48).toString('base64url')
}
export function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex')
}
