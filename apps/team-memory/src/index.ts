import {Hono} from 'hono'
import type {Env} from './types'
import {requireAuth} from './middleware/auth'
import {observationRoutes} from './routes/observations'
import {searchRoutes} from './routes/search'
import {contextRoutes} from './routes/context'
import {feedbackRoutes} from './routes/feedback'
import {sessionRoutes} from './routes/sessions'
import {exportRoutes} from './routes/export'
import {handleScheduled} from './routes/cron'

const app = new Hono<{Bindings: Env}>()

// Public - no auth required
app.get('/health', (c) => c.json({status: 'ok'}))

// Protected routes - require Bearer token auth
const api = new Hono<{Bindings: Env}>()
api.use('*', requireAuth)
api.route('/observations', observationRoutes)
api.route('/search', searchRoutes)
api.route('/context', contextRoutes)
api.route('/feedback', feedbackRoutes)
api.route('/sessions', sessionRoutes)
api.route('/export', exportRoutes)

app.route('/', api)

export default {
	fetch: app.fetch,
	scheduled: handleScheduled,
}
