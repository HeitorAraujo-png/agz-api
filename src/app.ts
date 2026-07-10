import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import { Prisma, PrismaClient } from '@prisma/client'
import argon2 from 'argon2'
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify'
import nodemailer from 'nodemailer'
import { z } from 'zod'
import { getConfig, type Config } from './config.js'
import { buildCalendar } from './lib/calendar.js'
import { dateKey, isoWeekday, monthBounds, parseDate } from './lib/date.js'
import { validatePassword } from './lib/password.js'
import { opaqueToken, tokenHash } from './lib/tokens.js'

type AuthUser = { sub: string; memberId: string }
const profile = (member: {
  memberId: string
  username: string
  email: string
  level: string
  mustChangePassword: boolean
}) => ({
  id: member.memberId,
  name: member.username,
  email: member.email,
  level: member.level === 'USER' ? 'Usuário' : 'Organizador',
  mustChangePassword: member.mustChangePassword,
})
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message)
  }
}

export function buildApp(options: { prisma?: PrismaClient; settings?: Config } = {}) {
  const settings = options.settings ?? getConfig()
  const prisma = options.prisma ?? new PrismaClient({ datasourceUrl: settings.databaseUrl })
  const app = Fastify({ logger: true })
  const mailer = nodemailer.createTransport({
    host: settings.smtp.host,
    port: settings.smtp.port,
    secure: false,
  })
  app.register(cookie)
  app.register(cors, { origin: settings.frontendOrigin, credentials: true })
  app.register(jwt, {
    secret: settings.accessSecret,
    cookie: { cookieName: 'agz_access', signed: false },
  })
  app.register(swagger, {
    openapi: { info: { title: 'AGZ API', version: '1.0.0' } },
  })
  app.register(swaggerUi, { routePrefix: '/docs' })
  app.addHook('onRequest', async (request) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      const origin = request.headers.origin
      if (origin && origin !== settings.frontendOrigin)
        throw new ApiError(403, 'Origem não permitida.')
    }
  })
  app.setErrorHandler((error, _request, reply) => {
    const status =
      error instanceof ApiError ? error.statusCode : error instanceof z.ZodError ? 400 : 500
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
      return reply.status(409).send({
        message: 'A reserva acabou de ser ocupada. Atualize a disponibilidade.',
      })
    app.log.error(error)
    return reply.status(status).send({
      message:
        error instanceof ApiError || error instanceof z.ZodError
          ? error.message
          : 'Erro interno do servidor.',
    })
  })
  app.get('/health', { schema: { tags: ['system'] } }, async () => ({
    status: 'ok',
  }))
  const setSession = async (reply: FastifyReply, member: { id: string; memberId: string }) => {
    const access = await reply.jwtSign(
      { sub: member.id, memberId: member.memberId },
      { expiresIn: '15m' },
    )
    const refresh = opaqueToken()
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14)
    await prisma.refreshToken.create({
      data: { memberId: member.id, tokenHash: tokenHash(refresh), expiresAt },
    })
    const common = {
      path: '/',
      sameSite: 'lax' as const,
      secure: settings.secureCookies,
    }
    reply.setCookie('agz_access', access, {
      ...common,
      httpOnly: true,
      maxAge: 60 * 15,
    })
    reply.setCookie('agz_refresh', refresh, {
      ...common,
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 14,
    })
  }
  const clearSession = (reply: FastifyReply) => {
    const options = {
      path: '/',
      sameSite: 'lax' as const,
      secure: settings.secureCookies,
    }
    reply.clearCookie('agz_access', options)
    reply.clearCookie('agz_refresh', options)
  }
  const authenticated = async (request: FastifyRequest) => {
    try {
      await request.jwtVerify()
    } catch {
      throw new ApiError(401, 'Sessão inválida ou expirada.')
    }
    return request.user as AuthUser
  }
  const memberFromRequest = async (request: FastifyRequest) => {
    const user = await authenticated(request)
    const member = await prisma.member.findUnique({ where: { id: user.sub } })
    if (!member?.active) throw new ApiError(401, 'Associado inválido ou inativo.')
    return member
  }
  const organizerFromRequest = async (request: FastifyRequest) => {
    const member = await memberFromRequest(request)
    if (member.level === 'USER')
      throw new ApiError(403, 'Somente organizadores podem acessar este recurso.')
    return member
  }
  const blocked = async (date: Date) => {
    if (dateKey(date) < dateKey(new Date())) return true
    if (settings.unavailableWeekdays.has(isoWeekday(date))) return true
    const [event, rental, count] = await Promise.all([
      prisma.event.findFirst({ where: { date, active: true } }),
      prisma.rental.findFirst({
        where: {
          active: true,
          OR: [{ startDate: date }, { eventDate: date }, { endDate: date }],
        },
      }),
      prisma.reservation.count({ where: { date } }),
    ])
    return Boolean(event || rental || count >= 5)
  }

  app.post('/v1/auth/login', async (request, reply) => {
    const body = z
      .object({
        username: z.string().min(1),
        memberId: z.string().min(1),
        password: z.string().min(1),
      })
      .parse(request.body)
    const member = await prisma.member.findFirst({
      where: { username: body.username, memberId: body.memberId, active: true },
    })
    if (!member || !(await argon2.verify(member.passwordHash, body.password)))
      throw new ApiError(401, 'Usuário, matrícula ou senha inválidos.')
    await setSession(reply, member)
    return { member: profile(member) }
  })
  app.post('/v1/auth/logout', async (request, reply) => {
    const refresh = request.cookies.agz_refresh
    if (refresh)
      await prisma.refreshToken.updateMany({
        where: { tokenHash: tokenHash(refresh), revokedAt: null },
        data: { revokedAt: new Date() },
      })
    clearSession(reply)
    return reply.status(204).send()
  })
  app.get('/v1/auth/session', async (request) => ({
    member: profile(await memberFromRequest(request)),
  }))
  app.post('/v1/auth/refresh', async (request, reply) => {
    const refresh = request.cookies.agz_refresh
    if (!refresh) throw new ApiError(401, 'Sessão inválida.')
    const token = await prisma.refreshToken.findFirst({
      where: {
        tokenHash: tokenHash(refresh),
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { member: true },
    })
    if (!token || !token.member.active) throw new ApiError(401, 'Sessão inválida.')
    await prisma.refreshToken.update({
      where: { id: token.id },
      data: { revokedAt: new Date() },
    })
    await setSession(reply, token.member)
    return { member: profile(token.member) }
  })
  app.post('/v1/auth/password/change', async (request) => {
    const member = await memberFromRequest(request)
    const body = z.object({ password: z.string(), confirmation: z.string() }).parse(request.body)
    if (body.password !== body.confirmation) throw new ApiError(400, 'As senhas não conferem.')
    try {
      validatePassword(body.password)
    } catch (error) {
      throw new ApiError(400, error instanceof Error ? error.message : 'Senha inválida.')
    }
    const updated = await prisma.member.update({
      where: { id: member.id },
      data: {
        passwordHash: await argon2.hash(body.password),
        mustChangePassword: false,
      },
    })
    return { member: profile(updated) }
  })
  app.post('/v1/auth/password-reset', async (request, reply) => {
    const { email } = z.object({ email: z.string().email() }).parse(request.body)
    const member = await prisma.member.findUnique({ where: { email } })
    if (member?.active) {
      const token = opaqueToken()
      await prisma.passwordResetToken.create({
        data: {
          memberId: member.id,
          tokenHash: tokenHash(token),
          expiresAt: new Date(Date.now() + 3_600_000),
        },
      })
      await mailer.sendMail({
        from: settings.smtp.from,
        to: member.email,
        subject: 'Redefinição de senha AGZ',
        text: `Redefina sua senha: ${settings.appUrl}/redefinir-senha/${token}`,
      })
    }
    return reply.status(202).send()
  })
  app.post('/v1/auth/password-reset/:token', async (request) => {
    const { token } = z.object({ token: z.string().min(1) }).parse(request.params)
    const body = z.object({ password: z.string(), confirmation: z.string() }).parse(request.body)
    if (body.password !== body.confirmation) throw new ApiError(400, 'As senhas não conferem.')
    try {
      validatePassword(body.password)
    } catch (error) {
      throw new ApiError(400, error instanceof Error ? error.message : 'Senha inválida.')
    }
    const reset = await prisma.passwordResetToken.findFirst({
      where: {
        tokenHash: tokenHash(token),
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    })
    if (!reset) throw new ApiError(400, 'Link inválido ou expirado.')
    await prisma.$transaction([
      prisma.member.update({
        where: { id: reset.memberId },
        data: {
          passwordHash: await argon2.hash(body.password),
          mustChangePassword: false,
        },
      }),
      prisma.passwordResetToken.update({
        where: { id: reset.id },
        data: { usedAt: new Date() },
      }),
    ])
    return { message: 'Senha redefinida.' }
  })

  app.get('/v1/calendar', async (request) => {
    await memberFromRequest(request)
    const query = z
      .object({
        year: z.coerce.number().int().min(2020).max(2100),
        month: z.coerce.number().int().min(1).max(12),
      })
      .parse(request.query)
    const { start, end } = monthBounds(query.year, query.month)
    const [reservations, events, rentals] = await Promise.all([
      prisma.reservation.findMany({
        where: { date: { gte: start, lte: end } },
        select: { date: true },
      }),
      prisma.event.findMany({
        where: { date: { gte: start, lte: end } },
        select: { date: true, active: true },
      }),
      prisma.rental.findMany({
        where: {
          active: true,
          OR: [
            { startDate: { gte: start, lte: end } },
            { eventDate: { gte: start, lte: end } },
            { endDate: { gte: start, lte: end } },
          ],
        },
        select: {
          startDate: true,
          eventDate: true,
          endDate: true,
          active: true,
        },
      }),
    ])
    return buildCalendar(query.year, query.month, settings.unavailableWeekdays, {
      reservations,
      events,
      rentals,
    })
  })
  app.get('/v1/reservations', async (request) => {
    const member = await memberFromRequest(request)
    const items = await prisma.reservation.findMany({
      where: { memberId: member.id },
      include: { dependents: true },
      orderBy: { date: 'asc' },
    })
    return items.map((item) => ({
      id: item.id,
      memberId: member.memberId,
      date: dateKey(item.date),
      kioskNumber: item.kioskNumber,
      dependentIds: item.dependents.map((dependent) => dependent.dependentId),
      active: true,
    }))
  })
  app.get('/v1/reservations/:date', async (request) => {
    const member = await memberFromRequest(request)
    const dateValue = z.object({ date: dateSchema }).parse(request.params).date
    const date = parseDate(dateValue)
    if (!date) throw new ApiError(400, 'Data inválida.')
    const item = await prisma.reservation.findUnique({
      where: { memberId_date: { memberId: member.id, date } },
      include: { dependents: true },
    })
    return item
      ? {
          id: item.id,
          memberId: member.memberId,
          date: dateKey(item.date),
          kioskNumber: item.kioskNumber,
          dependentIds: item.dependents.map((dependent) => dependent.dependentId),
          active: true,
        }
      : null
  })
  app.get('/v1/availability', async (request) => {
    await memberFromRequest(request)
    const dateValue = z.object({ date: dateSchema }).parse(request.query).date
    const date = parseDate(dateValue)
    if (!date) throw new ApiError(400, 'Data inválida.')
    if (await blocked(date)) return { kiosks: [] }
    const used = await prisma.reservation.findMany({
      where: { date },
      select: { kioskNumber: true },
    })
    return {
      kiosks: [1, 2, 3, 4, 5].filter((kiosk) => !used.some((item) => item.kioskNumber === kiosk)),
    }
  })
  app.get('/v1/dependents', async (request) => {
    const member = await memberFromRequest(request)
    return prisma.dependent.findMany({
      where: { memberId: member.id, active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })
  })
  app.post('/v1/dependents', async (request, reply) => {
    const member = await organizerFromRequest(request)
    const { name } = z.object({ name: z.string().trim().min(2).max(255) }).parse(request.body)
    const dependent = await prisma.dependent.create({
      data: { memberId: member.id, name },
      select: { id: true, name: true },
    })
    return reply.status(201).send(dependent)
  })
  app.get('/v1/events', async (request) => {
    await memberFromRequest(request)
    return prisma.event
      .findMany({
        where: { active: true, date: { gte: new Date() } },
        select: { id: true, name: true, date: true },
        orderBy: { date: 'asc' },
      })
      .then((items) => items.map((item) => ({ ...item, date: dateKey(item.date) })))
  })
  app.post('/v1/events', async (request, reply) => {
    await organizerFromRequest(request)
    const body = z
      .object({ name: z.string().trim().min(3).max(70), date: dateSchema })
      .parse(request.body)
    const date = parseDate(body.date)
    if (!date) throw new ApiError(400, 'Data inválida.')
    if (dateKey(date) < dateKey(new Date()))
      throw new ApiError(400, 'Não é possível criar eventos em datas passadas.')
    if (settings.unavailableWeekdays.has(isoWeekday(date)))
      throw new ApiError(400, 'Esta data está indisponível para eventos.')
    const [existingEvent, rental, reservations] = await Promise.all([
      prisma.event.findFirst({ where: { date, active: true } }),
      prisma.rental.findFirst({
        where: {
          active: true,
          OR: [{ startDate: date }, { eventDate: date }, { endDate: date }],
        },
      }),
      prisma.reservation.count({ where: { date } }),
    ])
    if (existingEvent) throw new ApiError(409, 'Já existe um evento nesta data.')
    if (rental) throw new ApiError(409, 'Existe uma locação nesta data.')
    if (reservations) throw new ApiError(409, 'Existem reservas nesta data.')
    const event = await prisma.event.create({ data: { name: body.name, date } })
    return reply.status(201).send({ id: event.id, name: event.name, date: dateKey(event.date) })
  })
  app.post('/v1/reservations', async (request, reply) => {
    const member = await memberFromRequest(request)
    const body = z
      .object({
        date: dateSchema,
        kioskNumber: z.number().int().min(1).max(5),
        dependentIds: z.array(z.number().int()).max(9),
      })
      .parse(request.body)
    const date = parseDate(body.date)
    if (!date) throw new ApiError(400, 'Data inválida.')
    if (await blocked(date)) throw new ApiError(409, 'Esta data não está disponível para reserva.')
    const validDependents = await prisma.dependent.count({
      where: {
        id: { in: body.dependentIds },
        memberId: member.id,
        active: true,
      },
    })
    if (validDependents !== new Set(body.dependentIds).size)
      throw new ApiError(400, 'Dependente inválido.')
    const reservation = await prisma.reservation.create({
      data: {
        memberId: member.id,
        date,
        kioskNumber: body.kioskNumber,
        dependents: {
          create: body.dependentIds.map((dependentId) => ({ dependentId })),
        },
      },
      include: { dependents: true },
    })
    return reply.status(201).send({
      id: reservation.id,
      memberId: member.memberId,
      date: dateKey(reservation.date),
      kioskNumber: reservation.kioskNumber,
      dependentIds: reservation.dependents.map((dependent) => dependent.dependentId),
      active: true,
    })
  })
  app.delete('/v1/reservations/:id', async (request, reply) => {
    const member = await memberFromRequest(request)
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    const result = await prisma.reservation.deleteMany({
      where: { id, memberId: member.id },
    })
    if (!result.count) throw new ApiError(404, 'Reserva não encontrada.')
    return reply.status(204).send()
  })
  app.addHook('onClose', async () => prisma.$disconnect())
  return app
}
