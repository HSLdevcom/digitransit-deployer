const { IncomingWebhook } = require('@slack/client')
const url = process.env.SLACK_WEBHOOK_URL || null
var webhook
if (process.env.ENVIRONMENT_TYPE === 'DEV') {
  webhook = url !== null ? new IncomingWebhook(url, { username: 'Configuration checker', channel: 'dev-monitoring' }) : null
} else {
  webhook = url !== null ? new IncomingWebhook(url, { username: 'Configuration checker', channel: 'monitoring' }) : null
}

const postSlackMessage = (message) => {
  if (webhook === null) {
    process.stdout.write(`Not sending to slack: ${message}\n`)
    return
  }

  process.stdout.write(`Sending to slack: ${message}\n`)

  webhook.send(message, function (err) {
    if (err) {
      process.stdout.write(`ERROR sending to slack: ${err}\n`)
    }
  })
}

module.exports = {
  postSlackMessage
}
