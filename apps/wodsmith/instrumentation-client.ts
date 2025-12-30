import posthog from 'posthog-js'

if (process.env.NODE_ENV !== 'development') {
  posthog.init('phc_UCtCVOUXvpuKzF50prCLKIWWCFc61j5CPTbt99OrKsK', {
    api_host: 'https://analytics.wodsmith.com/ingest',
    ui_host: 'https://us.posthog.com',
    defaults: '2025-05-24',
    capture_exceptions: true,
    debug: false,
  })
}
