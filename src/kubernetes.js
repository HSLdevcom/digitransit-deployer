const { Client, KubeConfig } = require('kubernetes-client')
const Request = require('kubernetes-client/backends/request')

const kubeconfig = new KubeConfig()
kubeconfig.loadFromCluster()
const backend = new Request({ kubeconfig })
const client = new Client({ backend, version: '1.13' })

const getDeployments = () => {
  return new Promise((resolve, reject) => {
    client.loadSpec()
      .then(() => {
        client.apis.apps.v1.namespaces('default').deployments().get()
          .then((deployments) => {
            client.apis.apps.v1.namespaces('default').pods().get()
              .then((pods) => {
                pods.forEach((pod) => {
                  console.log(pod)
                  resolve([])
                })
              })
          })
      })
      .catch((err) => {
        reject(err)
      })
  })
}

// Restart by modifying deployment label because kubernetes does not have deployment restart functionality in 1.13 API version
const restartDeployment = (appName) => {
  client.loadSpec()
    .then(() => {
      client.apis.apps.v1.namespaces('default').deployments()
        .patch({ qs: { labelSelector: `app=${appName}` }, body: { spec: { template: { metadata: { labels: { lastRestartDate: Date.now() } } } } } })
        .then((deployments) => {
          deployments.body.items.forEach((item) => {
            console.log(item)
          })
        })
    })
}

module.exports = {
  getDeployments,
  restartDeployment
}
