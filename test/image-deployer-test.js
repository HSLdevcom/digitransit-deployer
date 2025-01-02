import { assert, expect } from 'chai'
import { describe, it } from 'mocha'
import deployer from './../src/image-deployer.js'

const appConfig = (id, version, labels, stable) => ({
  spec: {
    template: {
      spec: {
        containers: [
          {
            imagePullPolicy: 'Always'
          }
        ]
      }
    }
  },
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
  version,
  container: { docker: { forcePullImage: true } }
})

const failIfRestart = (repoDate) => ({
  kubernetes: {
    restartDeployment: function () {
      assert(false, 'deployment restart was called when it should not have')
    }
  },
  dockerRepo: {
    getImageDate: function () {
      return Promise.resolve(repoDate.getTime())
    }
  }
})

const countRestarts = (repoDate) => {
  let count = 0
  return {
    kubernetes: {
      restartDeployment: function () {
        count += 1
        return Promise.resolve('restarted!')
      }
    },
    dockerRepo: {
      getImageDate: function () {
        return Promise.resolve(repoDate.getTime())
      }
    },
    get: () => (count)
  }
}

const NOW = new Date().getTime()

describe('image-deployer', function () {
  it('image should update when subgraph is stable and cool off period has ended', (done) => {
    const testApps = [
      appConfig('app1', NOW - 60 * 60 * 1000, { update: 'auto' }, true),
      appConfig('app2', NOW, { restartAfterDeployments: 'app1', restartDelay: '5' }, true)
    ]
    const counter = countRestarts(new Date(NOW + 1))
    deployer.command(testApps, counter)
    setTimeout(function () {
      expect(counter.get()).to.be.equal(1)
      done()
    }, 10)
  })

  it('no image should be deployed when subgraph is not stable', (done) => {
    const testApps = [
      appConfig('app1', NOW, { update: 'auto' }, false),
      appConfig('app2', NOW, { restartAfterDeployments: 'app1', restartDelay: '5' }, true)
    ]
    setTimeout(function () {
      deployer.command(testApps, failIfRestart(new Date(NOW + 1)))
      done()
    }, 10)
  })

  it('image should not update when the running version is newer', (done) => {
    const testApps = [
      appConfig('app1', NOW, { update: 'auto' }, true),
      appConfig('app2', NOW, { restartAfterDeployments: 'app1', restartDelay: '5' }, true)
    ]
    const counter = countRestarts(new Date(NOW - 1))
    deployer.command(testApps, counter)
    setTimeout(function () {
      expect(counter.get()).to.be.equal(0)
      done()
    }, 10)
  })
})
