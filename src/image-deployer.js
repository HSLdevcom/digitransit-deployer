const debug = require('debug')('digitransit-image-deployer')
const graph = require('./graph.js')

const logError = (e) => {
  debug('Error occurred %s', JSON.stringify(e))
}

const COOL_OFF_PERIOD = 60 * 60 * 1000 // 1 hour

/*
 * Automatically deploys new container versions for deployments that are tagged with update: "auto" and have imagePullPolicy configured as Always.
 */
module.exports = {
  name: 'image-deployer',
  command: function (deployments, context) {
    const deploymentGraph = graph.build(deployments)

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
                  if (graph.isSubGraphStable(deploymentGraph, deploymentId)) {
                    resolve('restart')
                  } else {
                    debug('Delaying restart for %s (subgraph not stable)', deploymentId)
                    resolve(null)
                  }
                } else {
                  debug('Delaying restart for %s (cool off period)', deploymentId)
                  resolve(null)
                }
              } else {
                debug('No need to update %s', deploymentId)
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
            debug('Restarting deployment %s', deploymentId)
            context.kubernetes.restartDeployment(deploymentId)
              .then((r) => debug('Restart called: %s', JSON.stringify(r)))
              .catch((err) => debug(err))
          }
        })
      })
  }
}
