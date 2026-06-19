import { init } from "@paralleldrive/cuid2"

export const createToken = init({ length: 32 })

export const getResetTokenKey = (token: string) => `password-reset:${token}`
export const getVerificationTokenKey = (token: string) =>
  `email-verification:${token}`
export const getClaimTokenKey = (token: string) => `claim-token:${token}`
