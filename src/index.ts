import express from "express";

import { getConfig } from './config/config'
import logger from './logger'
import routes from './routes'

const port = getConfig().port
const app = express()

app.use(express.json({type: 'application/fhir+json'}))

app.use('/', routes)

app.listen(port, () => {
  logger.info(`Server is running on port - ${port}`)
})
