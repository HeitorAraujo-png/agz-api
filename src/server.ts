import { buildApp } from './app.js'
import { getConfig } from './config.js'
const settings = getConfig()
const app = buildApp({ settings })
app.listen({ port: settings.port, host: '0.0.0.0' }).catch((error) => {
  app.log.error(error)
  process.exit(1)
})
