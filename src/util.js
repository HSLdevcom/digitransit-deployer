const { IncomingWebhook } = require('@slack/webhook')
const url = process.env.SLACK_WEBHOOK_URL || null
var webhook
if (process.env.ENVIRONMENT_TYPE === 'DEV') {
  webhook = url !== null ? new IncomingWebhook(url, { username: 'Configuration checker', channel: 'digitransit_monitoring_dev' }) : null
} else {
  webhook = url !== null ? new IncomingWebhook(url, { username: 'Configuration checker', channel: 'digitransit_monitoring_prd' }) : null
}

const postSlackMessage = (message) => {
  if (webhook === null) {
    process.stdout.write(`Not sending to slack: ${message}\n`)
    return
  }

  webhook.send({ text: message })
    .then(() => {
      process.stdout.write(`Sent to slack: ${message}\n`)
    })
    .catch((err) => {
      process.stdout.write(`ERROR sending to slack : ${err}\n`)
    })
}

module.exports = {
  postSlackMessage
}
