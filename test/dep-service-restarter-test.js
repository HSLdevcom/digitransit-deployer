import { assert, expect } from 'chai';
import { describe, it } from 'mocha';
import deploymentRestarter from './../src/dep-deployment-restarter.js';

const appConfig = (id, version, labels, stable) => ({
  metadata: {
    labels: {
      app: id,
      ...labels,
    },
  },
  status: {
    replicas: 1,
    readyReplicas: stable ? 1 : 0,
    updatedReplicas: stable ? 1 : 0,
    availableReplicas: stable ? 1 : 0,
  },
  version,
});

const failIfRestart = {
  kubernetes: {
    restartDeployment: function () {
      assert(false, 'deployment restart was called when it should not have');
    },
  },
};

const countRestarts = () => {
  let count = 0;
  let deployment = null;
  return {
    kubernetes: {
      restartDeployment: function (id) {
        deployment = id;
        count += 1;
        return Promise.resolve('restarted!');
      },
    },
    get: () => count,
    deployment: () => deployment,
  };
};

const NOW = new Date().getTime();

const minutes = m => m * 60 * 1000;

describe('dep-deployment-restarter', function () {
  it('no apps should restart when restartDelay has not passed for only dependency', () => {
    const testApps = [
      appConfig('app1', NOW, {}, true),
      appConfig(
        'app2',
        NOW - 1,
        { restartAfterDeployments: 'app1', restartDelay: '5' },
        true,
      ),
    ];
    deploymentRestarter.command(testApps, failIfRestart);
  });

  it('no apps should restart when restartDelay has not passed for some dependency', () => {
    const testApps = [
      appConfig('app1', NOW - minutes(4), {}, true),
      appConfig('app2', NOW - minutes(5), {}, true),
      appConfig(
        'app3',
        NOW - minutes(5),
        { restartAfterDeployments: 'app1_app2', restartDelay: '5' },
        true,
      ),
    ];
    deploymentRestarter.command(testApps, failIfRestart);
  });

  it('stable app should be restarted when restartDelay has passed for only dependency', () => {
    const testApps = [
      appConfig('app1', NOW - minutes(1), {}, true),
      appConfig(
        'app2',
        NOW - minutes(1),
        { restartAfterDeployments: 'app1', restartDelay: '1' },
        true,
      ),
    ];
    const counter = countRestarts();
    deploymentRestarter.command(testApps, counter);
    expect(counter.get()).to.be.equal(1);
    expect(counter.deployment()).to.be.equal('app2');
  });

  it('stable app should not be restarted when restartDelay has not passed for only dependency', () => {
    const testApps = [
      appConfig('app1', NOW - minutes(0), {}, true),
      appConfig(
        'app2',
        NOW - minutes(1),
        { restartAfterDeployments: 'app1', restartDelay: '1' },
        true,
      ),
    ];
    deploymentRestarter.command(testApps, failIfRestart);
  });

  it('stable app should be restarted when restartDelay has passed for every dependency', () => {
    const testApps = [
      appConfig('app1', NOW - minutes(10), {}, true),
      appConfig('app2', NOW - minutes(5), {}, true),
      appConfig(
        'app3',
        NOW - minutes(5),
        { restartAfterDeployments: 'app1_app2', restartDelay: '5' },
        true,
      ),
    ];
    const counter = countRestarts();
    deploymentRestarter.command(testApps, counter);
    expect(counter.get()).to.be.equal(1);
    expect(counter.deployment()).to.be.equal('app3');
  });

  it('stable app should not be restarted if it has been restarted already', () => {
    const testApps = [
      appConfig('app1', NOW - minutes(5), {}, true),
      appConfig(
        'app2',
        NOW,
        { restartAfterDeployments: 'app1', restartDelay: '5' },
        true,
      ),
    ];
    deploymentRestarter.command(testApps, failIfRestart);
  });

  it('no apps should restart when single dependency is not stable', () => {
    const testApps = [
      appConfig('app1', NOW - minutes(5), {}, false),
      appConfig(
        'app2',
        NOW - minutes(5),
        { restartAfterDeployments: 'app1', restartDelay: '5' },
        true,
      ),
    ];
    deploymentRestarter.command(testApps, failIfRestart);
  });

  it('no apps should restart when any dependency is not stable', () => {
    const testApps = [
      appConfig('app1', NOW - minutes(5), {}, true),
      appConfig('app2', NOW - minutes(5), {}, false),
      appConfig(
        'app3',
        NOW - minutes(5),
        { restartAfterDeployments: 'app1_app2', restartDelay: '5' },
        true,
      ),
    ];
    deploymentRestarter.command(testApps, failIfRestart);
  });

  it('incorrect dependency should be ignored and restart should be called because of valid dependency', () => {
    const testApps = [
      appConfig('app1', NOW - minutes(1), {}, true),
      appConfig(
        'app2',
        NOW - minutes(1),
        { restartAfterDeployments: 'app3_app1', restartDelay: '1' },
        true,
      ),
    ];
    const counter = countRestarts();
    deploymentRestarter.command(testApps, counter);
    expect(counter.get()).to.be.equal(1);
    expect(counter.deployment()).to.be.equal('app2');
  });
});
