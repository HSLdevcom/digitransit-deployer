const { Client } = require('kubernetes-client')
const Request = require('kubernetes-client/backends/request')

const backend = new Request(Request.config.getInCluster())
const client = new Client({ backend })

const getDeployments = () => {
  client.loadSpec()
    .then(() => {
      client.apis.apps.v1.deployments().get()
        .then((deployments) => {
          return deployments.body.items
        })
    })
}

// Restart by modifying deployment label because kubernetes does not have deployment restart functionality in 1.13 API version
const restartDeployment = (appName) => {
  client.loadSpec()
    .then(() => {
      client.apis.apps.v1.deployments()
        .patch({ qs: { labelSelector: `app=${appName}` }, body: { spec: { template: { metadata: { labels: { date: Date.now() } } } } } })
        .then((deployments) => {
          deployments.body.items.forEach((item) => {
            console.log(item.metadata)
          })
        })
    })
}

module.exports = {
  getDeployments,
  restartDeployment
}
