import { prisma } from './prisma'

export async function requireKYC(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { kycStatus: true },
  })

  if (!user) {
    throw new Error('User not found')
  }

  if (user.kycStatus !== 'VERIFIED') {
    throw new Error('KYC_REQUIRED')
  }

  return true
}

export function isKYCVerified(kycStatus: string): boolean {
  return kycStatus === 'VERIFIED'
}

export function getKYCStatusColor(status: string) {
  switch (status) {
    case 'VERIFIED':
      return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800'
    case 'PENDING':
      return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800'
    case 'REJECTED':
      return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'
    case 'REQUIRES_REVIEW':
      return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800'
    default:
      return 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
  }
}
