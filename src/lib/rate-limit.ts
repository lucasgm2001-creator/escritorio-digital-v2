// Rate limiting em memória - máximo 20 requisições por minuto por usuário
const requestCounts = new Map<string, { count: number; resetTime: number }>()

const LIMIT = 20
const WINDOW_MS = 60 * 1000 // 1 minuto

export interface RateLimitInfo {
  allowed: boolean
  remaining: number
  resetTime: number
}

export function checkRateLimit(userId: string): RateLimitInfo {
  const now = Date.now()
  const userKey = `rate-limit-${userId}`
  const userData = requestCounts.get(userKey)

  if (!userData || now > userData.resetTime) {
    // Nova janela de tempo
    const resetTime = now + WINDOW_MS
    requestCounts.set(userKey, { count: 1, resetTime })
    return {
      allowed: true,
      remaining: LIMIT - 1,
      resetTime,
    }
  }

  // Incrementar contador
  userData.count++
  const allowed = userData.count <= LIMIT
  return {
    allowed,
    remaining: Math.max(0, LIMIT - userData.count),
    resetTime: userData.resetTime,
  }
}
