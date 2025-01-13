import { build, isSubGraphStable } from './graph.js'

const logError = (e) => {
  console.error('Error occurred %s', JSON.stringify(e))
}

const COOL_OFF_PERIOD = 60 * 60 * 1000 // 1 hour

/*
 * Automatically deploys new container versions for deployments that are tagged with update: "auto" and have imagePullPolicy configured as Always.
 */
export default {
  command: function (deployments, context) {
    const deploymentGraph = build(deployments)

    const NOW = new Date().getTime()

    deployments.filter((deployment) => deployment.metadata.labels.update === 'auto' &&
      deployment.spec.template.spec.containers[0].imagePullPolicy === 'Always')
      .forEach(deployment => {
        const deploymentLabels = deployment.metadata.labels
        const deploymentId = deploymentLabels.app
        const dependencies = []
        dependencies.push(deployment.spec.template.spec.containers[0].image)
        const promises = []
        for (let i = 0; i < dependencies.length; i++) {
          const dependency = dependencies[i]
          promises.push(new Promise((resolve) => {
            context.dockerRepo.getImageDate(dependency).then(repoImageDate => {
              const deploymentDate = deployment.version
              if (repoImageDate && repoImageDate > deploymentDate) {
                if (NOW > deploymentDate + COOL_OFF_PERIOD) {
                  if (isSubGraphStable(deploymentGraph, deploymentId)) {
                    resolve('restart')
                  } else {
                    console.log('Delaying restart for %s (subgraph not stable)', deploymentId)
                    resolve(null)
                  }
                } else {
                  console.log('Delaying restart for %s (cool off period)', deploymentId)
                  resolve(null)
                }
              } else {
                console.log('No need to update %s', deploymentId)
                resolve(null)
              }
            }).catch((err) => {
              logError(err)
              resolve(null)
            })
          }))
        }
        Promise.all(promises).then((values) => {
          if (values.indexOf('restart') >= 0) {
            console.log('Restarting deployment %s', deploymentId)
            context.kubernetes.restartDeployment(deploymentId)
              .then((r) => console.log('Restart called: %s', JSON.stringify(r)))
              .catch((err) => console.log(err))
          }
        })
      })
  }
}
