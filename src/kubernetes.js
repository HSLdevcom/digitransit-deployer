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
                const oldestPodsEpochs = {}
                pods.body.items.forEach((pod) => {
                  // for each deployment, store the oldest pod's start time
                  if (pod.metadata !== undefined &&
                    pod.metadata.labels !== undefined &&
                    pod.metadata.labels.app !== undefined &&
                    pod.status !== undefined &&
                    pod.status.startTime !== undefined &&
                    (oldestPodsEpochs[pod.metadata.labels.app] === undefined ||
                      pod.status.startTime < oldestPodsEpochs[pod.metadata.labels.app])) {
                    oldestPodsEpochs[pod.metadata.labels.app] = Date.parse(pod.status.startTime)
                  }
                })

                const patchedDeployments = []
                // patch deployments with last deployment time if that exists
                // or with oldest pod's start time
                deployments.body.items.forEach((deployment) => {
                  if (deployment.metadata !== undefined &&
                    deployment.metadata.labels !== undefined &&
                    deployment.metadata.labels.app !== undefined &&
                    oldestPodsEpochs[deployment.metadata.labels.app] !== undefined) {
                    const { lastRestartDate } = deployment.template.metadata.labels
                    const version = lastRestartDate
                      ? parseInt(lastRestartDate, 10)
                      : oldestPodsEpochs[deployment.metadata.labels.app]
                    patchedDeployments.push(
                      { ...deployment,
                        version })
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
// It is important the deployment name and label "app" have same values
const restartDeployment = (appId) => {
  return new Promise((resolve, reject) => {
    client.loadSpec()
      .then(() => {
        client.apis.apps.v1.namespaces('default').deployments(appId)
          .patch({
            body: { spec: { template: { metadata: { labels: { lastRestartDate: Date.now().toString() } } } } }
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
