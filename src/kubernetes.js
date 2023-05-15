const k8s = require('@kubernetes/client-node')

const kubeconfig = new k8s.KubeConfig()
kubeconfig.loadFromCluster()

const getDeployments = () => {
  return new Promise((resolve, reject) => {
    const appsApi = kubeconfig.makeApiClient(k8s.AppsV1Api)
    const coreApi = kubeconfig.makeApiClient(k8s.CoreV1Api)
    const patchedDeployments = []
    appsApi.listNamespacedDeployment('default').then(deploymentResponse => {
      const deployments = deploymentResponse.body.items
      for (const deployment of deployments) {
        const deploymentName = deployment.metadata.name
        console.log(`Fetching pods for deployment: ${deploymentName}`)
        const labelSelector = `app=${deploymentName}`
        const { lastRestartDate } = deployment.spec.template.metadata.labels
        const parsedDate = parseInt(lastRestartDate, 10)
        if (parsedDate) {
          patchedDeployments.push({ ...deployment, version: parsedDate })
        } else {
          let oldestPodEpoch
          coreApi.listNamespacedPod(
            'default',
            undefined,
            undefined,
            undefined,
            undefined,
            labelSelector
          ).then(podResponse => {
            const pods = podResponse.body.items
            for (const pod of pods) {
              if (pod.status.startTime !== undefined && (!oldestPodEpoch || pod.status.startTime < oldestPodEpoch)) {
                oldestPodEpoch = Date.parse(pod.status.startTime)
              }
            }
          })
          patchedDeployments.push({ ...deployment, version: oldestPodEpoch })
        }
      }
      resolve(patchedDeployments)
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
