// Site configuration
export const SITE_NAME = 'WODsmith'
export const SITE_DESCRIPTION = 'Track your workouts and progress.'
export const SITE_URL =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000'
    : process.env.SITE_URL || 'https://thewodapp.com'

// Auth configuration
export const REDIRECT_AFTER_SIGN_IN = '/workouts'
export const SESSION_COOKIE_NAME = 'session'
export const ACTIVE_TEAM_COOKIE_NAME = 'active-team'
export const PASSWORD_RESET_TOKEN_EXPIRATION_SECONDS = 24 * 60 * 60 // 24 hours
export const EMAIL_VERIFICATION_TOKEN_EXPIRATION_SECONDS = 24 * 60 * 60 // 24 hours
export const MAX_SESSIONS_PER_USER = 5
