const chai = require('chai')
const { describe, it } = require('mocha')
const expect = chai.expect
const graph = require('./../src/graph.js')

const NOW = new Date().getTime()

const appConfig = (id, version, labels, stable) => ({
  metadata: {
    labels: {
      app: id,
      ...labels
    }
  },
  status: {
    replicas: 1,
    readyReplicas: stable ? 1 : 0,
    updatedReplicas: stable ? 1 : 0,
    availableReplicas: stable ? 1 : 0
  },
  version
})

describe('graph-builder', function () {
  it('the built graph should not have cycle if so configured', () => {
    const testApps = [
      appConfig('app1', NOW, {}, true),
      appConfig('app2', NOW, { restartAfterDeployments: 'app1', restartDelay: '5' }, true)
    ]
    const deploymentGraph = graph.build(testApps)
    expect(deploymentGraph.hasCycle()).to.equal(false)
  })

  it('the built graph should have cycle if so configured', () => {
    const testApps = [
      appConfig('app1', NOW, { restartAfterDeployments: 'app2', restartDelay: '5' }, true),
      appConfig('app2', NOW, { restartAfterDeployments: 'app1', restartDelay: '5' }, true)
    ]
    const deploymentGraph = graph.build(testApps)
    expect(deploymentGraph.hasCycle()).to.equal(true)
  })

  it('Sub Graph should be reported stable when it is', () => {
    const testApps = [
      appConfig('app1', NOW, {}, true),
      appConfig('app2', NOW, { restartAfterDeployments: 'app1', restartDelay: '5' }, true),
      appConfig('app3', NOW, { restartAfterDeployments: 'app2', restartDelay: '5' }, true)
    ]
    const deploymentGraph = graph.build(testApps)
    expect(graph.isSubGraphStable(deploymentGraph, 'app1')).to.equal(true)
    expect(graph.isSubGraphStable(deploymentGraph, 'app2')).to.equal(true)
    expect(graph.isSubGraphStable(deploymentGraph, 'app3')).to.equal(true)
  })

  it('Sub Graph should be reported unstable when it is', () => {
    const testApps = [
      appConfig('app1', NOW, {}, true),
      appConfig('app2', NOW, { restartAfterDeployments: 'app1', restartDelay: '5' }, false),
      appConfig('app3', NOW, { restartAfterDeployments: 'app2', restartDelay: '5' }, true)
    ]
    const deploymentGraph = graph.build(testApps)
    expect(graph.isSubGraphStable(deploymentGraph, 'app1')).to.equal(true)
    expect(graph.isSubGraphStable(deploymentGraph, 'app2')).to.equal(true)
    expect(graph.isSubGraphStable(deploymentGraph, 'app3')).to.equal(false)
  })

  it('Graph should tell us if there are pending dependent restarts upstream', () => {
    const testApps = [
      appConfig('app1', NOW, {}, true),
      appConfig('app2', NOW + 59999, { restartAfterDeployments: 'app1', restartDelay: '1' }, true),
      appConfig('app3', NOW + 120000, { restartAfterDeployments: 'app2', restartDelay: '1' }, true)
    ]
    const deploymentGraph = graph.build(testApps)
    expect(graph.hasPendingDependentRestarts(deploymentGraph, 'app1')).to.equal(false)
    expect(graph.hasPendingDependentRestarts(deploymentGraph, 'app2')).to.equal(true)
    expect(graph.hasPendingDependentRestarts(deploymentGraph, 'app3')).to.equal(true)
  })

  it('Graph should tell us if there are no pending dependent restarts upstream', () => {
    const testApps = [
      appConfig('app1', NOW, {}, true),
      appConfig('app2', NOW + 60000, { restartAfterDeployments: 'app1', restartDelay: '1' }, true),
      appConfig('app3', NOW + 120000, { restartAfterDeployments: 'app2', restartDelay: '1' }, true)
    ]
    const deploymentGraph = graph.build(testApps)
    expect(graph.hasPendingDependentRestarts(deploymentGraph, 'app1')).to.equal(false)
    expect(graph.hasPendingDependentRestarts(deploymentGraph, 'app2')).to.equal(false)
    expect(graph.hasPendingDependentRestarts(deploymentGraph, 'app3')).to.equal(false)
  })

  it('Graph should return deployments needing restart', () => {
    // restart delay passed app2 started > 1 minute before dependency
    let testApps = [
      appConfig('app1', NOW, {}, true),
      appConfig('app2', NOW - 60001, { restartAfterDeployments: 'app1', restartDelay: '1' }, true) // started > 1 minute before
    ]
    let deploymentGraph = graph.build(testApps)
    expect(graph.deploymentsNeedingRestart(deploymentGraph).length).to.equal(1)

    // restart delay passed app2 and app3 started > 1 minute before dependency
    testApps = [
      appConfig('app1', NOW, {}, true),
      appConfig('app2', NOW - 60001, { restartAfterDeployments: 'app1', restartDelay: '1' }, true),
      appConfig('app3', NOW - 120001, { restartAfterDeployments: 'app1', restartDelay: '2' }, true)
    ]
    deploymentGraph = graph.build(testApps)
    expect(graph.deploymentsNeedingRestart(deploymentGraph).length).to.equal(2)

    testApps = [
      appConfig('app1', NOW, {}, true),
      appConfig('app2', NOW - 60001, { restartAfterDeployments: 'app1', restartDelay: '1' }, true)
    ]
    deploymentGraph = graph.build(testApps)
    expect(graph.deploymentsNeedingRestart(deploymentGraph).length).to.equal(1)
  })
})
