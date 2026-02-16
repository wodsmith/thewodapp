import {Hono} from 'hono'
import type {Env} from './types'
import {observationRoutes} from './routes/observations'
import {searchRoutes} from './routes/search'
import {contextRoutes} from './routes/context'
import {feedbackRoutes} from './routes/feedback'
import {sessionRoutes} from './routes/sessions'
import {exportRoutes} from './routes/export'

const app = new Hono<{Bindings: Env}>()

app.get('/health', (c) => c.json({status: 'ok'}))

app.route('/observations', observationRoutes)
app.route('/search', searchRoutes)
app.route('/context', contextRoutes)
app.route('/feedback', feedbackRoutes)
app.route('/sessions', sessionRoutes)
app.route('/export', exportRoutes)

export default app
