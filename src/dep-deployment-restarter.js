const debug = require('debug')('dep-deployment-restarter')
const graph = require('./graph.js')
const { postSlackMessage } = require('./util')

/*
 * Automatically restarts dependand services in controlled manner. This is
 * useful because we have data as container and we want to restart containers
 * that depend on that data.
 * Configured with labels as follows:
 *  restart-after-services=/service-name
 *  restart-delay=5
 *
 *  or multiple:
 *  restart-after-services=/service-name,/another-service
 *  restart-delay=5
 *
 * /service-name is the dependent mesos service name (including the
 * leading '/').
 * restart-delay is in minutes, specifying this to 1 means that restart is not
 * triggered before 1 minutes have elapsed from restarting of the dependent
 * service. This also means that if service has restarted during delay period
 * it will be restarted after dependency restart time + delay has passed.
 *
 * Additionally the subgraph of dependencies including the service at hand must
 * all be in stable condition before restart is attempted.
 *
 * Additionally the dependent mesos service (or any of it's parents) must not
 * have any pending restarts waiting.
 *
 */
module.exports = {
  name: 'dep-deployment-restarter',
  command: (services, context) => {
    const NOW = new Date().getTime()

    let serviceGraph = graph.build(services)
    if (serviceGraph.hasCycle()) {
      debug('Bummer! Graph has cycle, %s', serviceGraph.toJSON())
      postSlackMessage('Services are configured to restart each other in a cycle.')
    } else {
      graph.servicesNeedingRestart(serviceGraph).filter(({ from, value }) => {
        debug('service %s needs restart', from)
        // check that enough time has passed after all depedency restarts
        for (let [, vertexValue] of serviceGraph.verticesFrom(from)) {
          debug('checking %s %s', NOW, Date.parse(vertexValue.version))
          if (NOW <= Date.parse(vertexValue.version) + value.delay) {
            return false
          }
        }
        return true
      }).filter(({ from }) => {
        if (!graph.isSubGraphStable(serviceGraph, from)) {
          debug('Sub Graph for %s is not stable, delaying restart', from)
          return false
        }
        return true
      }).forEach(({ from }) => {
        debug('Restarting service %s', from)
        context.marathon.restartService(from).then((e) => debug('Restarted: %s', JSON.stringify(e)))
      })
    }
  }
}
