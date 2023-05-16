const k8s = require('@kubernetes/client-node')
const debug = require('debug')('kubernetes')

const kubeconfig = new k8s.KubeConfig()
kubeconfig.loadFromCluster()

const getDeployments = () => {
  return new Promise((resolve, reject) => {
    const appsApi = kubeconfig.makeApiClient(k8s.AppsV1Api)
    const coreApi = kubeconfig.makeApiClient(k8s.CoreV1Api)
    appsApi.listNamespacedDeployment('default').then(deploymentResponse => {
      const promises = []
      const deployments = deploymentResponse.body.items
      for (const deployment of deployments) {
        promises.push(new Promise(resolve => {
          const deploymentName = deployment.metadata.name
          const labelSelector = `app=${deploymentName}`
          const { lastRestartDate } = deployment.spec.template.metadata.labels
          const parsedDate = parseInt(lastRestartDate, 10)
          if (parsedDate) {
            debug(`Using lastRestartDate as version for deployment: ${deploymentName}`)
            resolve({ ...deployment, version: parsedDate })
          } else {
            debug(`Fetching pods for deployment: ${deploymentName}`)
            coreApi.listNamespacedPod(
              'default',
              undefined,
              undefined,
              undefined,
              undefined,
              labelSelector
            ).then(podResponse => {
              let oldestPodEpoch
              const pods = podResponse.body.items
              for (const pod of pods) {
                if (pod.status.startTime !== undefined && (!oldestPodEpoch || Date.parse(pod.status.startTime) < oldestPodEpoch)) {
                  oldestPodEpoch = Date.parse(pod.status.startTime)
                }
              }
              resolve({ ...deployment, version: oldestPodEpoch })
            })
          }
        }))
      }
      Promise.all(promises).then(values => {
        resolve(values)
      })
    })
      .catch((err) => {
        reject(err)
      })
  })
}

// Restart by modifying deployment label.
// It is important the deployment name and label "app" have same values
const restartDeployment = (appId) => {
  return new Promise((resolve, reject) => {
    const appsApi = kubeconfig.makeApiClient(k8s.AppsV1Api)
    const patch = [
      {
        op: 'replace',
        path: '/spec/template/metadata/labels',
        value: {
          app: appId,
          lastRestartDate: Date.now().toString()
        }
      }
    ]
    const options = { headers: { 'Content-type': k8s.PatchUtils.PATCH_FORMAT_JSON_PATCH } }
    appsApi.patchNamespacedDeployment(
      appId,
      'default',
      patch,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      options
    ).then(response => {
      resolve(appId)
    }).catch(err => {
      reject(err)
    })
  })
}

module.exports = {
  getDeployments,
  restartDeployment
}
