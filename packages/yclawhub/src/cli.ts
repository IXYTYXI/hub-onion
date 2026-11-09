#!/usr/bin/env node
import { runCli } from '@guanghe-pub/clawhub-pak/cliApp'
import { YCLAWHUB_BRAND } from '@guanghe-pub/clawhub-pak/runtime'

void runCli(YCLAWHUB_BRAND, process.argv).catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
  process.exitCode = 1
})
