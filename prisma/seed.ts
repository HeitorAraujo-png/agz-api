import 'dotenv/config'
import argon2 from 'argon2'
import { MemberLevel, PrismaClient } from '@prisma/client'
const required = [
  'SEED_ADMIN_USERNAME',
  'SEED_ADMIN_MEMBER_ID',
  'SEED_ADMIN_EMAIL',
  'SEED_ADMIN_PASSWORD',
] as const
for (const key of required)
  if (!process.env[key]) throw new Error(`Variável obrigatória ausente: ${key}`)
const prisma = new PrismaClient()
const passwordHash = await argon2.hash(process.env.SEED_ADMIN_PASSWORD!)
const adminData = {
  username: process.env.SEED_ADMIN_USERNAME!,
  email: process.env.SEED_ADMIN_EMAIL!,
  passwordHash,
  level: MemberLevel.ADMIN,
  active: true,
  mustChangePassword: true,
}
await prisma.member.upsert({
  where: { memberId: process.env.SEED_ADMIN_MEMBER_ID! },
  update: adminData,
  create: {
    memberId: process.env.SEED_ADMIN_MEMBER_ID!,
    ...adminData,
  },
})
await prisma.$disconnect()
