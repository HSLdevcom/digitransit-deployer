const chai = require('chai')
const assert = chai.assert
const expect = chai.expect
const restarter = require('./../src/dep-service-restarter.js')

const appConfig = (id, version, labels, stable) => ({
  id: id,
  version: version.toISOString(),
  labels: labels || {},
  tasksHealthy: stable ? 1 : 0,
  instances: 1,
  tasksStaged: 0,
  tasksUnhealthy: stable ? 0 : 1
})

const failIfRestart = {
  marathon: {
    restartService: function () {
      assert(false, 'service restart was called when it should not have')
    }
  }
}

const countRestarts = () => {
  let count = 0
  let service = null
  return {
    marathon: {
      restartService: function (id) {
        service = id
        count += 1
        return Promise.resolve('restarted!')
      }
    },
    get: () => (count),
    service: () => (service)
  }
}

const NOW = new Date().getTime()

const minutes = (m) => (m * 60 * 1000)

describe('dep-service-restarter', function () {
  it('no apps should restart when restart-delay has not passed for only dependency', () => {
    const testApps = [
      appConfig('/app1', new Date(NOW), {}, true),
      appConfig('/app2', new Date(NOW - 1), { 'restart-after-services': '/app1', 'restart-delay': '5' }, true)
    ]
    restarter.command(testApps, failIfRestart)
  })

  it('no apps should restart when restart-delay has not passed for some dependency', () => {
    const testApps = [
      appConfig('/app1', new Date(NOW - minutes(4)), {}, true),
      appConfig('/app2', new Date(NOW - minutes(5)), {}, true),
      appConfig('/app3', new Date(NOW - minutes(5)), { 'restart-after-services': '/app1,/app2', 'restart-delay': '5' }, true)
    ]
    restarter.command(testApps, failIfRestart)
  })

  it('stable app should be restarted when restart-delay has passed for only dependency', () => {
    const testApps = [
      appConfig('/app1', new Date(NOW - minutes(1)), {}, true),
      appConfig('/app2', new Date(NOW - minutes(1)), { 'restart-after-services': '/app1', 'restart-delay': '1' }, true)
    ]
    const counter = countRestarts()
    restarter.command(testApps, counter)
    expect(counter.get()).to.be.equal(1)
    expect(counter.service()).to.be.equal('/app2')
  })

  it('stable app should not be restarted when restart-delay has not passed for only dependency', () => {
    const testApps = [
      appConfig('/app1', new Date(NOW - minutes(0)), {}, true),
      appConfig('/app2', new Date(NOW - minutes(1)), { 'restart-after-services': '/app1', 'restart-delay': '1' }, true)
    ]
    restarter.command(testApps, failIfRestart)
  })

  it('stable app should be restarted when restart-delay has passed for every dependency', () => {
    const testApps = [
      appConfig('/app1', new Date(NOW - minutes(10)), {}, true),
      appConfig('/app2', new Date(NOW - minutes(5)), {}, true),
      appConfig('/app3', new Date(NOW - minutes(5)), { 'restart-after-services': '/app1,/app2', 'restart-delay': '5' }, true)
    ]
    const counter = countRestarts()
    restarter.command(testApps, counter)
    expect(counter.get()).to.be.equal(1)
    expect(counter.service()).to.be.equal('/app3')
  })

  it('stable app should not be restarted if it has been restarted already', () => {
    const testApps = [
      appConfig('/app1', new Date(NOW - minutes(5)), {}, true),
      appConfig('/app2', new Date(NOW), { 'restart-after-services': '/app1', 'restart-delay': '5' }, true)
    ]
    restarter.command(testApps, failIfRestart)
  })

  it('no apps should restart when single dependency is not stable', () => {
    const testApps = [
      appConfig('/app1', new Date(NOW - minutes(5)), {}, false),
      appConfig('/app2', new Date(NOW - minutes(5)), { 'restart-after-services': '/app1', 'restart-delay': '5' }, true)
    ]
    restarter.command(testApps, failIfRestart)
  })

  it('no apps should restart when any dependency is not stable', () => {
    const testApps = [
      appConfig('/app1', new Date(NOW - minutes(5)), {}, true),
      appConfig('/app2', new Date(NOW - minutes(5)), {}, false),
      appConfig('/app3', new Date(NOW - minutes(5)), { 'restart-after-services': '/app1,/app2', 'restart-delay': '5' }, true)
    ]
    restarter.command(testApps, failIfRestart)
  })

  it('no apps should restart when service is not stable', () => {
    const testApps = [
      appConfig('/app1', new Date(NOW - minutes(5)), {}, true),
      appConfig('/app2', new Date(NOW - minutes(5)), { 'restart-after-services': '/app1', 'restart-delay': '5' }, false)
    ]
    restarter.command(testApps, failIfRestart)
  })

  it('incorrect dependency should be ignored and restart should be called because of valid dependency', () => {
    const testApps = [
      appConfig('/app1', new Date(NOW - minutes(1)), {}, true),
      appConfig('/app2', new Date(NOW - minutes(1)), { 'restart-after-services': '/app3,/app1', 'restart-delay': '1' }, true)
    ]
    const counter = countRestarts()
    restarter.command(testApps, counter)
    expect(counter.get()).to.be.equal(1)
    expect(counter.service()).to.be.equal('/app2')
  })
})
