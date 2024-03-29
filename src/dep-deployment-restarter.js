const debug = require('debug')('dep-deployment-restarter')
const graph = require('./graph.js')
const { postSlackMessage } = require('./util')

/*
 * Automatically restarts dependand deployments in controlled manner. This is
 * useful because we have data as container and we want to restart containers
 * that depend on that data.
 * Configured with labels as follows:
 *  restartAfterDeployments: "deployment-name"
 *  restartDelay: "5"
 *
 *  or multiple:
 *  restartAfterDeployments: "deployment-name_another-deployment"
 *  restartDelay: "5"
 *
 * deployment-name is the dependent kubernetes deployment name.
 * restartDelay is in minutes, specifying this to 1 means that restart is not
 * triggered before 1 minutes have elapsed from restarting of the dependent
 * deployment. This also means that if deployment has restarted during delay period
 * it will be restarted after dependency restart time + delay has passed.
 *
 * Additionally the subgraph of dependencies including the deployment at hand must
 * all be in stable condition before restart is attempted.
 *
 * Additionally the dependent kubernetes deployment (or any of it's parents) must not
 * have any pending restarts waiting.
 *
 */
module.exports = {
  name: 'dep-deployment-restarter',
  command: (deployments, context) => {
    const NOW = new Date().getTime()

    const deploymentGraph = graph.build(deployments)
    if (deploymentGraph.hasCycle()) {
      debug('Bummer! Graph has cycle, %s', deploymentGraph.toJSON())
      postSlackMessage('Deployments are configured to restart each other in a cycle.')
    } else {
      graph.deploymentsNeedingRestart(deploymentGraph).filter(({ from, value }) => {
        debug('deployment %s needs restart', from)
        // check that enough time has passed after all depedency restarts
        for (const [, vertexValue] of deploymentGraph.verticesFrom(from)) {
          debug('checking %s %s', NOW, vertexValue.version)
          if (NOW <= vertexValue.version + value.delay) {
            return false
          }
        }
        return true
      }).filter(({ from }) => {
        if (!graph.isSubGraphStable(deploymentGraph, from)) {
          debug('Sub Graph for %s is not stable, delaying restart', from)
          return false
        }
        return true
      }).forEach(({ from }) => {
        debug('Restarting deployment %s', from)
        context.kubernetes.restartDeployment(from)
          .then((e) => debug('Restarted: %s', JSON.stringify(e)))
          .catch((err) => debug(err))
      })
    }
  }
}
