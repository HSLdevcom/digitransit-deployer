const { Client, KubeConfig } = require('kubernetes-client')
const Request = require('kubernetes-client/backends/request')

const debug = require('debug')('kubernetes')

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
            client.api.v1.namespaces('default').pods().get()
              .then((pods) => {
                const deploymentVersions = {}
                pods.body.items.forEach((pod) => {
                  if (pod.metadata !== undefined &&
                    pod.metadata.labels !== undefined &&
                    pod.metadata.labels.app !== undefined &&
                    pod.status !== undefined &&
                    pod.status.startTime !== undefined &&
                    (deploymentVersions[pod.metadata.labels.app] === undefined ||
                      pod.status.startTime < deploymentVersions[pod.metadata.labels.app])) {
                    deploymentVersions[pod.metadata.labels.app] = pod.status.startTime
                  }
                })

                const patchedDeployments = []
                deployments.body.items.forEach((deployment) => {
                  if (deployment.metadata !== undefined &&
                    deployment.metadata.labels !== undefined &&
                    deployment.metadata.labels.app !== undefined &&
                    deploymentVersions[deployment.metadata.labels.app] !== undefined) {
                    patchedDeployments.push(
                      { ...deployment,
                        version: deploymentVersions[deployment.metadata.labels.app] })
                  } else {
                    debug('Could not find pods for deployment %s', JSON.stringify(deployment))
                  }
                })
                resolve(patchedDeployments)
              })
          })
      })
      .catch((err) => {
        reject(err)
      })
  })
}

// Restart by modifying deployment label because kubernetes does not have deployment restart functionality in 1.13 API version
const restartDeployment = (appId) => {
  return new Promise((resolve, reject) => {
    client.loadSpec()
      .then(() => {
        client.apis.apps.v1.namespaces('default').deployments()
          .patch({
            qs: { labelSelector: `app=${appId}` },
            body: { spec: { template: { metadata: { labels: { lastRestartDate: Date.now() } } } } }
          })
          .then(() => {
            resolve(appId)
          })
      })
      .catch((err) => {
        debug('Failed to restart %s', appId)
        reject(err)
      })
  })
}

module.exports = {
  getDeployments,
  restartDeployment
}
