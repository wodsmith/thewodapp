export const getResetTokenKey = (token: string) => `password-reset:${token}`;
export const getVerificationTokenKey = (token: string) => `email-verification:${token}`;
