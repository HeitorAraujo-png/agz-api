import 'dotenv/config'

export interface Config {
  port: number
  databaseUrl: string
  frontendOrigin: string
  accessSecret: string
  refreshSecret: string
  unavailableWeekdays: Set<number>
  smtp: { host: string; port: number; from: string }
  appUrl: string
  secureCookies: boolean
}

export function parseUnavailableWeekdays(value: string | undefined): Set<number> {
  if (!value?.trim()) return new Set()
  const days = value.split(',').map((part) => Number(part.trim()))
  if (days.some((day) => !Number.isInteger(day) || day < 1 || day > 7))
    throw new Error('UNAVAILABLE_WEEKDAYS deve conter dias ISO entre 1 e 7.')
  return new Set(days)
}

export function parseConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const required = [
    'DATABASE_URL',
    'FRONTEND_ORIGIN',
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
    'SMTP_HOST',
    'SMTP_FROM',
    'APP_URL',
  ] as const
  for (const name of required)
    if (!env[name]) throw new Error(`Variável obrigatória ausente: ${name}`)
  if ((env.JWT_ACCESS_SECRET?.length ?? 0) < 32 || (env.JWT_REFRESH_SECRET?.length ?? 0) < 32)
    throw new Error('Os segredos JWT devem ter ao menos 32 caracteres.')
  const port = Number(env.PORT ?? 3000),
    smtpPort = Number(env.SMTP_PORT ?? 1025)
  if (!Number.isInteger(port) || !Number.isInteger(smtpPort))
    throw new Error('PORT e SMTP_PORT devem ser números inteiros.')
  return {
    port,
    databaseUrl: env.DATABASE_URL!,
    frontendOrigin: env.FRONTEND_ORIGIN!,
    accessSecret: env.JWT_ACCESS_SECRET!,
    refreshSecret: env.JWT_REFRESH_SECRET!,
    unavailableWeekdays: parseUnavailableWeekdays(env.UNAVAILABLE_WEEKDAYS),
    smtp: { host: env.SMTP_HOST!, port: smtpPort, from: env.SMTP_FROM! },
    appUrl: env.APP_URL!,
    secureCookies: env.NODE_ENV === 'production',
  }
}

export function getConfig(): Config {
  return parseConfig()
}
