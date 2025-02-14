import { describe, it } from 'mocha';
import { assert, expect } from 'chai';
import cronRestarter from './../src/cron-deployment-restarter.js';

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

describe('cron-deployment-restarter', function () {
  it('no apps should restart when no restartAt defined', () => {
    const testApps = [appConfig('app1', NOW, {}, true)];
    cronRestarter.command(testApps, failIfRestart);
  });

  it('no apps should restart when restartAt is after current time', () => {
    const restartAt = new Date(NOW + minutes(5));
    const restartAtString = restartAt.getHours() + '.' + restartAt.getMinutes();
    const testApps = [
      appConfig(
        'app1',
        NOW - minutes(23 * 60),
        { restartAt: restartAtString },
        true,
      ),
    ];
    cronRestarter.command(testApps, failIfRestart);
  });

  it('no apps should restart when last restart within default limit interval', () => {
    const restartAt = new Date(NOW - minutes(5));
    const restartAtString = restartAt.getHours() + '.' + restartAt.getMinutes();
    const testApps = [
      appConfig(
        'app1',
        NOW - minutes(15 * 60),
        { restartAt: restartAtString },
        true,
      ),
    ];
    cronRestarter.command(testApps, failIfRestart);
  });

  it('no apps should restart when last restart within user set limit interval', () => {
    const restartAt = new Date(NOW - minutes(5));
    const restartAtString = restartAt.getHours() + '.' + restartAt.getMinutes();
    const testApps = [
      appConfig(
        'app1',
        NOW - minutes(110),
        { restartAt: restartAtString, restartLimitInterval: '120' },
        true,
      ),
    ];
    cronRestarter.command(testApps, failIfRestart);
  });

  it('no apps should restart when it has been over hour since when the deployment was supposed to restart', () => {
    const restartAt = new Date(NOW - minutes(350));
    const restartAtString = restartAt.getHours() + '.' + restartAt.getMinutes();
    const testApps = [
      appConfig(
        'app1',
        NOW - minutes(600),
        { restartAt: restartAtString, restartLimitInterval: '120' },
        true,
      ),
    ];
    cronRestarter.command(testApps, failIfRestart);
  });

  it('app should be restarted when deployment is not stable', () => {
    const restartAt = new Date(NOW - minutes(42));
    const restartAtString = restartAt.getHours() + '.' + restartAt.getMinutes();
    const testApps = [
      appConfig(
        'app1',
        NOW - minutes(150),
        { restartAt: restartAtString, restartLimitInterval: '120' },
        false,
      ),
    ];
    const counter = countRestarts();
    cronRestarter.command(testApps, counter);
    expect(counter.get()).to.be.equal(1);
    expect(counter.deployment()).to.be.equal('app1');
  });

  it('stable app with last restart outside of the user set limit interval should restart', () => {
    const restartAt = new Date(NOW - minutes(1));
    const restartAtString = restartAt.getHours() + '.' + restartAt.getMinutes();
    const testApps = [
      appConfig(
        'app1',
        NOW - minutes(150),
        { restartAt: restartAtString, restartLimitInterval: '120' },
        true,
      ),
      appConfig(
        'app2',
        NOW - minutes(100),
        { restartAt: restartAtString, restartLimitInterval: '120' },
        true,
      ),
    ];
    const counter = countRestarts();
    cronRestarter.command(testApps, counter);
    expect(counter.get()).to.be.equal(1);
    expect(counter.deployment()).to.be.equal('app1');
  });

  it('unstable app with last restart outside of the user set limit interval should restart', () => {
    const restartAt = new Date(NOW - minutes(1));
    const restartAtString = restartAt.getHours() + '.' + restartAt.getMinutes();
    const testApps = [
      appConfig(
        'app1',
        NOW - minutes(150),
        { restartAt: restartAtString, restartLimitInterval: '120' },
        false,
      ),
      appConfig(
        'app2',
        NOW - minutes(100),
        { restartAt: restartAtString, restartLimitInterval: '120' },
        true,
      ),
    ];
    const counter = countRestarts();
    cronRestarter.command(testApps, counter);
    expect(counter.get()).to.be.equal(1);
    expect(counter.deployment()).to.be.equal('app1');
  });

  it('stable app with last restart outside of the default limit interval should restart', () => {
    const restartAt = new Date(NOW - minutes(1));
    const restartAtString = restartAt.getHours() + '.' + restartAt.getMinutes();
    const testApps = [
      appConfig(
        'app1',
        NOW - minutes(23 * 60),
        { restartAt: restartAtString },
        true,
      ),
    ];
    const counter = countRestarts();
    cronRestarter.command(testApps, counter);
    expect(counter.get()).to.be.equal(1);
    expect(counter.deployment()).to.be.equal('app1');
  });

  it('stable app with restartAt less than 60 mins before should restart', () => {
    const restartAt = new Date(NOW - minutes(55));
    const restartAtString = restartAt.getHours() + '.' + restartAt.getMinutes();
    const testApps = [
      appConfig(
        'app1',
        NOW - minutes(23 * 60),
        { restartAt: restartAtString },
        true,
      ),
    ];
    const counter = countRestarts();
    cronRestarter.command(testApps, counter);
    expect(counter.get()).to.be.equal(1);
    expect(counter.deployment()).to.be.equal('app1');
  });

  it('stable app with one restartAt time less than 60 mins before should restart once', () => {
    const restartAtFirst = new Date(NOW - minutes(55));
    const restartAtSecond = new Date(NOW - minutes(350));
    const restartAtString =
      restartAtFirst.getHours() +
      '.' +
      restartAtFirst.getMinutes() +
      ', ' +
      restartAtSecond.getHours() +
      '.' +
      restartAtSecond.getMinutes();
    const testApps = [
      appConfig(
        'app1',
        NOW - minutes(23 * 60),
        { restartAt: restartAtString },
        true,
      ),
    ];
    const counter = countRestarts();
    cronRestarter.command(testApps, counter);
    expect(counter.get()).to.be.equal(1);
    expect(counter.deployment()).to.be.equal('app1');
  });

  it('stable app with two restartAt time less than 60 mins before should restart once', () => {
    const restartAtFirst = new Date(NOW - minutes(25));
    const restartAtSecond = new Date(NOW - minutes(55));
    const restartAtString =
      restartAtFirst.getHours() +
      '.' +
      restartAtFirst.getMinutes() +
      ', ' +
      restartAtSecond.getHours() +
      '.' +
      restartAtSecond.getMinutes();
    const testApps = [
      appConfig(
        'app1',
        NOW - minutes(23 * 60),
        { restartAt: restartAtString },
        true,
      ),
    ];
    const counter = countRestarts();
    cronRestarter.command(testApps, counter);
    expect(counter.get()).to.be.equal(1);
    expect(counter.deployment()).to.be.equal('app1');
  });
});
