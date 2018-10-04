const chai = require('chai')
const expect = chai.expect
const graph = require('./../src/graph.js')

const NOW = new Date().getTime()

const appConfig = (id, version, labels, stable) => ({
  id: id,
  version: version.toISOString(),
  labels: labels || {},
  tasksHealthy: stable ? 1 : 0,
  instances: 1,
  tasksStaged: 0,
  tasksUnhealthy: stable ? 0 : 1
})

describe('graph-builder', function () {
  it('the built graph should not have cycle if so configured', () => {
    const testApps = [
      appConfig('/app1', new Date(NOW), {}, true),
      appConfig('/app2', new Date(NOW), { 'restart-after-services': '/app1', 'restart-delay': '5' }, true)
    ]
    let serviceGraph = graph.build(testApps)
    expect(serviceGraph.hasCycle()).to.be.false
  })

  it('the built graph should have cycle if so configured', () => {
    const testApps = [
      appConfig('/app1', new Date(NOW), { 'restart-after-services': '/app2', 'restart-delay': '5' }, true),
      appConfig('/app2', new Date(NOW), { 'restart-after-services': '/app1', 'restart-delay': '5' }, true)
    ]
    let serviceGraph = graph.build(testApps)
    expect(serviceGraph.hasCycle()).to.be.true
  })

  it('Sub Graph should be reported stable when it is', () => {
    const testApps = [
      appConfig('/app1', new Date(NOW), {}, true),
      appConfig('/app2', new Date(NOW), { 'restart-after-services': '/app1', 'restart-delay': '5' }, true),
      appConfig('/app3', new Date(NOW), { 'restart-after-services': '/app2', 'restart-delay': '5' }, true)
    ]
    let serviceGraph = graph.build(testApps)
    expect(graph.isSubGraphStable(serviceGraph, '/app1')).to.be.true
    expect(graph.isSubGraphStable(serviceGraph, '/app2')).to.be.true
    expect(graph.isSubGraphStable(serviceGraph, '/app3')).to.be.true
  })

  it('Sub Graph should be reported unstable when it is', () => {
    const testApps = [
      appConfig('/app1', new Date(NOW), {}, true),
      appConfig('/app2', new Date(NOW), { 'restart-after-services': '/app1', 'restart-delay': '5' }, false),
      appConfig('/app3', new Date(NOW), { 'restart-after-services': '/app2', 'restart-delay': '5' }, true)
    ]
    let serviceGraph = graph.build(testApps)
    expect(graph.isSubGraphStable(serviceGraph, '/app1')).to.be.false
    expect(graph.isSubGraphStable(serviceGraph, '/app2')).to.be.false
    expect(graph.isSubGraphStable(serviceGraph, '/app3')).to.be.false
  })

  it('Graph should tell us if there are pending dependent restarts upstream', () => {
    const testApps = [
      appConfig('/app1', new Date(NOW), {}, true),
      appConfig('/app2', new Date(NOW + 59999), { 'restart-after-services': '/app1', 'restart-delay': '1' }, true),
      appConfig('/app3', new Date(NOW + 120000), { 'restart-after-services': '/app2', 'restart-delay': '1' }, true)
    ]
    let serviceGraph = graph.build(testApps)
    expect(graph.hasPendingDependentRestarts(serviceGraph, '/app1')).to.be.false
    expect(graph.hasPendingDependentRestarts(serviceGraph, '/app2')).to.be.true
    expect(graph.hasPendingDependentRestarts(serviceGraph, '/app3')).to.be.true
  })

  it('Graph should tell us if there are no pending dependent restarts upstream', () => {
    const testApps = [
      appConfig('/app1', new Date(NOW), {}, true),
      appConfig('/app2', new Date(NOW + 60000), { 'restart-after-services': '/app1', 'restart-delay': '1' }, true),
      appConfig('/app3', new Date(NOW + 120000), { 'restart-after-services': '/app2', 'restart-delay': '1' }, true)
    ]
    let serviceGraph = graph.build(testApps)
    expect(graph.hasPendingDependentRestarts(serviceGraph, '/app1')).to.be.false
    expect(graph.hasPendingDependentRestarts(serviceGraph, '/app2')).to.be.false
    expect(graph.hasPendingDependentRestarts(serviceGraph, '/app3')).to.be.false
  })

  it('Graph should return services needing restart', () => {
    // restart delay passed app2 started > 1 minute before dependency
    let testApps = [
      appConfig('/app1', new Date(NOW), {}, true),
      appConfig('/app2', new Date(NOW - 60001), { 'restart-after-services': '/app1', 'restart-delay': '1' }, true) // started > 1 minute before
    ]
    let serviceGraph = graph.build(testApps)
    expect(graph.servicesNeedingRestart(serviceGraph).length).to.equal(1)

    // restart delay passed app2 and app3 started > 1 minute before dependency
    testApps = [
      appConfig('/app1', new Date(NOW), {}, true),
      appConfig('/app2', new Date(NOW - 60001), { 'restart-after-services': '/app1', 'restart-delay': '1' }, true),
      appConfig('/app3', new Date(NOW - 120001), { 'restart-after-services': '/app1', 'restart-delay': '2' }, true)
    ]
    serviceGraph = graph.build(testApps)
    expect(graph.servicesNeedingRestart(serviceGraph).length).to.equal(2)

    testApps = [
      appConfig('/app1', new Date(NOW), {}, true),
      appConfig('/app2', new Date(NOW - 60001), { 'restart-after-services': '/app1', 'restart-delay': '1' }, true)
    ]
    serviceGraph = graph.build(testApps)
    expect(graph.servicesNeedingRestart(serviceGraph).length).to.equal(1)
  })
})
