const chai = require('chai');
const assert = chai.assert;
const expect = chai.expect;
const deployer = require('./../src/image-deployer.js');

const appConfig = (id, version, labels, stable) => ({
  id: id,
  version: version.toISOString(),
  labels: labels ? labels : {},
  tasksHealthy: stable ? 1 : 0,
  instances: 1,
  tasksStaged: 0,
  tasksUnhealthy:stable ? 0 : 1,
  container: {docker:{forcePullImage:true}}
});

const failIfRestart = (repoDate) => ({
  marathon: {
    restartService: function() {
      assert(false, "service restart was called when it should not have");
    }
  },
  dockerRepo: {
    getImageDate: function() {
      return Promise.resolve(repoDate.getTime());
    }
  }
});

const countRestarts = (repoDate) => {
  let count = 0;
  return {
    marathon: {
      restartService: function() {
        count += 1;
        return Promise.resolve("restarted!");
      }
    },
    dockerRepo: {
      getImageDate: function() {
        return Promise.resolve(repoDate.getTime());
      }
    },
    get: () => (count)
  };
};

const NOW = new Date().getTime();

describe('image-deployer', function() {


  it('image should update when subgraph is stable', () => {
    const testApps = [
      appConfig('/app1', new Date(NOW), {"update":"auto"}, true),
      appConfig('/app2', new Date(NOW), {"restart-after-services":"/app1", "restart-delay": "5"}, true)
    ];
    let counter = countRestarts(new Date(NOW+1));
    deployer.command(testApps, counter);
    setTimeout(function () {
      expect(counter.get()).to.be.equal(1);
    }, 10);
  });

  it('no image should be deployed when subgraph is not stable', () => {
    const testApps = [
      appConfig('/app1', new Date(NOW), {"update":"auto"}, false),
      appConfig('/app2', new Date(NOW), {"restart-after-services":"/app1", "restart-delay": "5"}, true)
    ];
    deployer.command(testApps, failIfRestart(new Date(NOW+1)));
  });

  it('image should not update when the running version is newer', () => {
    const testApps = [
      appConfig('/app1', new Date(NOW), {"update":"auto"}, true),
      appConfig('/app2', new Date(NOW), {"restart-after-services":"/app1", "restart-delay": "5"}, true)
    ];
    let counter = countRestarts(new Date(NOW-1));
    deployer.command(testApps, counter);
    setTimeout(function () {
      expect(counter.get()).to.be.equal(0);
    }, 10);
  });
});
