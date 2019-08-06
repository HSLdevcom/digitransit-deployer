const debug = require('debug')('digitransit-image-deployer')
const graph = require('./graph.js')

const logError = (e) => {
  debug('Error occurred %s', JSON.stringify(e))
}

const COOL_OFF_PERIOD = 60 * 60 * 1000 // 1 hour

/*
 * Automatically deploys new container versions for deployments that are tagged with update=auto and have imagePullPolicy configured as Always.
 * Also restarts deployment if one of the dependency images/tags defined in label restartAfterImageUpdates are updated.
 */
module.exports = {
  name: 'image-deployer',
  command: function (deployments, context) {
    let deploymentGraph = graph.build(deployments)

    const NOW = new Date().getTime()

    deployments.filter((deployment) => deployment.spec.template.metadata.labels['restartAfterImageUpdates'] ||
      (deployment.spec.template.metadata.labels['update'] === 'auto' &&
      deployment.spec.template.spec.containers[0].imagePullPolicy === 'Always'))
      .forEach(deployment => {
        let dependencies = []
        if (deployment.spec.template.metadata.labels['restartAfterImageUpdates']) {
          dependencies =
            dependencies.concat(
              deployment.spec.template.metadata.labels['restartAfterImageUpdates'].replace(/\s/g, '').split(','))
        }
        if (deployment.spec.template.metadata.labels['update'] === 'auto' &&
          deployment.spec.template.spec.containers[0].imagePullPolicy === 'Always') {
          dependencies.push(deployment.spec.template.spec.containers[0].image)
        }
        const promises = []
        for (let i = 0; i < dependencies.length; i++) {
          const dependency = dependencies[i]
          promises.push(new Promise((resolve) => {
            context.dockerRepo.getImageDate(dependency).then(repoImageDate => {
              const deploymentDate = Date.parse(deployment.version)
              if (repoImageDate > deploymentDate) {
                if (NOW > deploymentDate + COOL_OFF_PERIOD) {
                  if (graph.isSubGraphStable(deploymentGraph, deployment.metadata.labels.app)) {
                    resolve('restart')
                  } else {
                    debug('Delaying restart for %s (subgraph not stable)', deployment.metadata.labels.app)
                    resolve(null)
                  }
                } else {
                  debug('Delaying restart for %s (cool off period)', deployment.metadata.labels.app)
                  resolve(null)
                }
              } else {
                debug('No need to update %s', deployment.metadata.labels.app)
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
            debug('Restarting deployment %s', deployment.metadata.labels.app)
            context.kubernetes.restartDeployment(deployment.metadata.labels.app)
              .then((r) => debug('Restart called: %s', JSON.stringify(r)))
              .catch((err) => debug(err))
          }
        })
      })
  }
}
