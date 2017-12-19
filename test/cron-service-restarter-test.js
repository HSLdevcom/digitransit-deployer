const chai = require('chai');
const assert = chai.assert;
const expect = chai.expect;
const restarter = require('./../src/cron-service-restarter.js');
const time = require('time')(Date);

const appConfig = (id, version, labels, stable) => ({
  id: id,
  version: version.toISOString(),
  labels: labels?labels:{},
  tasksHealthy: stable?1:0,
  instances: 1,
  tasksStaged: 0,
  tasksUnhealthy:stable?0:1
});

const failIfRestart = {
  marathon: {
    restartService: function() {
      assert(false, "service restart was called when it should not have");
    }
  }
};

const countRestarts = () => {
  let count = 0;
  let service = null;
  return {
    marathon: {
      restartService: function(id) {
        service = id;
        count += 1;
        return Promise.resolve("restarted!");
      }
    },
    get: () => (count),
    service: () => (service)
  };
};

const NOW = new Date().getTime();

const minutes = (m) => (m*60*1000);

describe('cron-service-restarter', function() {
  it('no apps should restart when no restart-at defined', () => {
    const testApps = [
      appConfig('/app1', new Date(NOW),{}, true)
    ];
    restarter.command(testApps, failIfRestart);
  });

  it('no apps should restart when restart-at is after current time', () => {
    const restartAt = new Date(NOW + minutes(5));
    restartAt.setTimezone('Europe/Helsinki');
    const restartAtString = restartAt.getHours() + ":" + restartAt.getMinutes();
    const testApps = [
      appConfig('/app1', new Date(NOW - minutes(23 * 60)),{"restart-at": restartAtString}, true)
    ];
    restarter.command(testApps, failIfRestart);
  });

  it('no apps should restart when last restart within default limit interval', () => {
    const restartAt = new Date(NOW - minutes(5));
    restartAt.setTimezone('Europe/Helsinki');
    const restartAtString = restartAt.getHours() + ":" + restartAt.getMinutes();
    const testApps = [
      appConfig('/app1', new Date(NOW - minutes(15 * 60)),{"restart-at": restartAtString}, true)
    ];
    restarter.command(testApps, failIfRestart);
  });

  it('no apps should restart when last restart within user set limit interval', () => {
    const restartAt = new Date(NOW - minutes(5));
    restartAt.setTimezone('Europe/Helsinki');
    const restartAtString = restartAt.getHours() + ":" + restartAt.getMinutes();
    const testApps = [
      appConfig('/app1', new Date(NOW - minutes(110)),{"restart-at": restartAtString, "restart-limit-interval": "120"}, true)
    ];
    restarter.command(testApps, failIfRestart);
  });

  it('no apps should restart when it has been over hour since when the service was supposed to restart', () => {
    const restartAt = new Date(NOW - minutes(350));
    restartAt.setTimezone('Europe/Helsinki');
    const restartAtString = restartAt.getHours() + ":" + restartAt.getMinutes();
    const testApps = [
      appConfig('/app1', new Date(NOW - minutes(600)),{"restart-at": restartAtString, "restart-limit-interval": "120"}, true)
    ];
    restarter.command(testApps, failIfRestart);
  });

  it('no apps should restart when service is not stable', () => {
    const restartAt = new Date(NOW - minutes(42));
    restartAt.setTimezone('Europe/Helsinki');
    const restartAtString = restartAt.getHours() + ":" + restartAt.getMinutes();
    const testApps = [
      appConfig('/app1', new Date(NOW - minutes(150)),{"restart-at": restartAtString, "restart-limit-interval": "120"}, false)
    ];
    restarter.command(testApps, failIfRestart);
  });

  it('stable app with last restart outside of the user set limit interval should restart', () => {
    const restartAt = new Date(NOW - minutes(1));
    restartAt.setTimezone('Europe/Helsinki');
    const restartAtString = restartAt.getHours() + ":" + restartAt.getMinutes();
    const testApps = [
      appConfig('/app1', new Date(NOW - minutes(150)),{"restart-at": restartAtString, "restart-limit-interval": "120"}, false),
      appConfig('/app2', new Date(NOW - minutes(150)),{"restart-at": restartAtString, "restart-limit-interval": "120"}, true),
      appConfig('/app3', new Date(NOW - minutes(100)),{"restart-at": restartAtString, "restart-limit-interval": "120"}, true)
    ];
    const counter = countRestarts();
    restarter.command(testApps, counter);
    expect(counter.get()).to.be.equal(1);
    expect(counter.service()).to.be.equal("/app2");
  });

  it('stable app with last restart outside of the default limit interval should restart', () => {
    const restartAt = new Date(NOW - minutes(1));
    restartAt.setTimezone('Europe/Helsinki');
    const restartAtString = restartAt.getHours() + ":" + restartAt.getMinutes();
    const testApps = [
      appConfig('/app1', new Date(NOW - minutes(23 * 60)),{"restart-at": restartAtString}, true)
    ];
    const counter = countRestarts();
    restarter.command(testApps, counter);
    expect(counter.get()).to.be.equal(1);
    expect(counter.service()).to.be.equal("/app1");
  });

  it('stable app with restart-at less than 60 mins before should restart', () => {
    const restartAt = new Date(NOW - minutes(55));
    restartAt.setTimezone('Europe/Helsinki');
    const restartAtString = restartAt.getHours() + ":" + restartAt.getMinutes();
    const testApps = [
      appConfig('/app1', new Date(NOW - minutes(23 * 60)),{"restart-at": restartAtString}, true)
    ];
    const counter = countRestarts();
    restarter.command(testApps, counter);
    expect(counter.get()).to.be.equal(1);
    expect(counter.service()).to.be.equal("/app1");
  });

  it('stable app with one restart-at time less than 60 mins before should restart once', () => {
    const restartAtFirst = new Date(NOW - minutes(55));
    const restartAtSecond = new Date(NOW - minutes(350));
    restartAtFirst.setTimezone('Europe/Helsinki');
    restartAtSecond.setTimezone('Europe/Helsinki');
    const restartAtString = restartAtFirst.getHours() + ":" + restartAtFirst.getMinutes() + ", "
      + restartAtSecond.getHours() + ":" + restartAtSecond.getMinutes();
    const testApps = [
      appConfig('/app1', new Date(NOW - minutes(23 * 60)),{"restart-at": restartAtString}, true)
    ];
    const counter = countRestarts();
    restarter.command(testApps, counter);
    expect(counter.get()).to.be.equal(1);
    expect(counter.service()).to.be.equal("/app1");
  });

  it('stable app with two restart-at time less than 60 mins before should restart once', () => {
    const restartAtFirst = new Date(NOW - minutes(25));
    const restartAtSecond = new Date(NOW - minutes(55));
    restartAtFirst.setTimezone('Europe/Helsinki');
    restartAtSecond.setTimezone('Europe/Helsinki');
    const restartAtString = restartAtFirst.getHours() + ":" + restartAtFirst.getMinutes() + ", "
      + restartAtSecond.getHours() + ":" + restartAtSecond.getMinutes();
    const testApps = [
      appConfig('/app1', new Date(NOW - minutes(23 * 60)),{"restart-at": restartAtString}, true)
    ];
    const counter = countRestarts();
    restarter.command(testApps, counter);
    expect(counter.get()).to.be.equal(1);
    expect(counter.service()).to.be.equal("/app1");
  });
});
