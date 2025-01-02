import { Graph } from '@dagrejs/graphlib'
import { postSlackMessage } from './util.js'

function addDepEdges (graph, deployment, deployments) {
  const deploymentLabels = deployment.metadata.labels
  const dependencies = deploymentLabels.restartAfterDeployments
    .split('_')
    .filter((unfilteredDeployment) => /\S/.test(unfilteredDeployment)) // remove elements that consists of just whitespace
  const delay = (deploymentLabels.restartDelay || 5) * 60 * 1000
  const deploymentName = deploymentLabels.app
  dependencies.forEach(dependency => {
    if (deployments.filter(deploymentInstance => (deploymentInstance.metadata.labels.app === dependency)).length > 0) {
      graph.setEdge(deploymentName, dependency, { delay })
    } else {
      console.log(`${dependency} does not exist but is defined as a dependency for a deployment`)
      postSlackMessage(`${dependency} does not exist but is defined as a dependency for a deployment`)
    }
  })
}

function needsRestart (graph, from, to, edge) {
  // needs restart if deployment time is smaller than dependency time + delay
  const deploymentTime = graph.node(from).version
  const dependencyTime = graph.node(to).version
  const needsStart = dependencyTime + edge.delay > deploymentTime
  return needsStart
}

const deploymentIsStable = (deployment) =>
  deployment.status.replicas > 0 && deployment.status.readyReplicas === deployment.status.replicas &&
  deployment.status.updatedReplicas === deployment.status.replicas && deployment.status.availableReplicas === deployment.status.replicas

export function hasPendingDependentRestarts (graph, deploymentId) {
  // has pending dependent restart if the deploymentId or any vertex that deployment
  // has Path to has pending restarts

  const outEdges = graph.outEdges(deploymentId)
  for (const edge of outEdges) {
    const edgeData = graph.edge(edge)
    const dependency = edge.w
    console.log('next checking dependency %s %s %s', deploymentId, dependency, edgeData)
    if (needsRestart(graph, deploymentId, dependency, edgeData)) {
      return true
    }

    if (hasPendingDependentRestarts(graph, dependency)) {
      return true
    }
  }
  return false
}

export function build (deployments) {
  const graph = new Graph({ directed: true })
  console.log('adding vertexes')
  deployments.forEach(deployment => {
    graph.setNode(deployment.metadata.labels.app, deployment)
  })
  console.log('adding edges')
  deployments.forEach(deployment => {
    if (deployment.metadata.labels.restartAfterDeployments) {
      addDepEdges(graph, deployment, deployments)
    }
  })
  return graph
}

export function isSubGraphStable (graph, vertexId) {
  // sub graph is stable if all vertexes accessible from the vertex
  for (const nodeId of graph.successors(vertexId)) {
    const deployment = graph.node(nodeId)
    if (!deploymentIsStable(deployment)) return false
  }
  return true
}

export function deploymentsNeedingRestart (graph) {
  const deployments = []
  for (const edge of graph.edges()) {
    const from = edge.v
    const to = edge.w
    const value = graph.edge(edge)
    if (needsRestart(graph, from, to, value)) {
      deployments.push({ from, to, value })
    }
  }
  return deployments
}
