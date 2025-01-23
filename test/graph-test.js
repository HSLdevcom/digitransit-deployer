import { expect } from 'chai';
import { describe, it } from 'mocha';
import graphlib from '@dagrejs/graphlib';
import {
  build,
  isSubGraphStable,
  hasPendingDependentRestarts,
  deploymentsNeedingRestart,
  deploymentsNeedingImageFreshnessCheck,
} from './../src/graph.js';

const NOW = new Date().getTime();

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

describe('graph-builder', function () {
  it('the built graph should not have cycle if so configured', () => {
    const testApps = [
      appConfig('app1', NOW, {}, true),
      appConfig(
        'app2',
        NOW,
        { restartAfterDeployments: 'app1', restartDelay: '5' },
        true,
      ),
    ];
    const deploymentGraph = build(testApps);
    expect(graphlib.alg.findCycles(deploymentGraph).length).to.equal(0);
  });

  it('the built graph should have cycle if so configured', () => {
    const testApps = [
      appConfig(
        'app1',
        NOW,
        { restartAfterDeployments: 'app2', restartDelay: '5' },
        true,
      ),
      appConfig(
        'app2',
        NOW,
        { restartAfterDeployments: 'app1', restartDelay: '5' },
        true,
      ),
    ];
    const deploymentGraph = build(testApps);
    expect(graphlib.alg.findCycles(deploymentGraph).length).to.equal(1);
  });

  it('Sub Graph should be reported stable when it is', () => {
    const testApps = [
      appConfig('app1', NOW, {}, true),
      appConfig(
        'app2',
        NOW,
        { restartAfterDeployments: 'app1', restartDelay: '5' },
        true,
      ),
      appConfig(
        'app3',
        NOW,
        { restartAfterDeployments: 'app2', restartDelay: '5' },
        true,
      ),
    ];
    const deploymentGraph = build(testApps);
    expect(isSubGraphStable(deploymentGraph, 'app1')).to.equal(true);
    expect(isSubGraphStable(deploymentGraph, 'app2')).to.equal(true);
    expect(isSubGraphStable(deploymentGraph, 'app3')).to.equal(true);
  });

  it('Sub Graph should be reported unstable when it is', () => {
    const testApps = [
      appConfig('app1', NOW, {}, true),
      appConfig(
        'app2',
        NOW,
        { restartAfterDeployments: 'app1', restartDelay: '5' },
        false,
      ),
      appConfig(
        'app3',
        NOW,
        { restartAfterDeployments: 'app2', restartDelay: '5' },
        true,
      ),
    ];
    const deploymentGraph = build(testApps);
    expect(isSubGraphStable(deploymentGraph, 'app1')).to.equal(true);
    expect(isSubGraphStable(deploymentGraph, 'app2')).to.equal(true);
    expect(isSubGraphStable(deploymentGraph, 'app3')).to.equal(false);
  });

  it('Graph should tell us if there are pending dependent restarts upstream', () => {
    const testApps = [
      appConfig('app1', NOW, {}, true),
      appConfig(
        'app2',
        NOW + 59999,
        { restartAfterDeployments: 'app1', restartDelay: '1' },
        true,
      ),
      appConfig(
        'app3',
        NOW + 120000,
        { restartAfterDeployments: 'app2', restartDelay: '1' },
        true,
      ),
    ];
    const deploymentGraph = build(testApps);
    expect(hasPendingDependentRestarts(deploymentGraph, 'app1')).to.equal(
      false,
    );
    expect(hasPendingDependentRestarts(deploymentGraph, 'app2')).to.equal(true);
    expect(hasPendingDependentRestarts(deploymentGraph, 'app3')).to.equal(true);
  });

  it('Graph should tell us if there are no pending dependent restarts upstream', () => {
    const testApps = [
      appConfig('app1', NOW, {}, true),
      appConfig(
        'app2',
        NOW + 60000,
        { restartAfterDeployments: 'app1', restartDelay: '1' },
        true,
      ),
      appConfig(
        'app3',
        NOW + 120000,
        { restartAfterDeployments: 'app2', restartDelay: '1' },
        true,
      ),
    ];
    const deploymentGraph = build(testApps);
    expect(hasPendingDependentRestarts(deploymentGraph, 'app1')).to.equal(
      false,
    );
    expect(hasPendingDependentRestarts(deploymentGraph, 'app2')).to.equal(
      false,
    );
    expect(hasPendingDependentRestarts(deploymentGraph, 'app3')).to.equal(
      false,
    );
  });

  it('Graph should return deployments needing restart', () => {
    // restart delay passed app2 started > 1 minute before dependency
    let testApps = [
      appConfig('app1', NOW, {}, true),
      appConfig(
        'app2',
        NOW - 60001,
        { restartAfterDeployments: 'app1', restartDelay: '1' },
        true,
      ), // started > 1 minute before
    ];
    let deploymentGraph = build(testApps);
    expect(deploymentsNeedingRestart(deploymentGraph).length).to.equal(1);

    // restart delay passed app2 and app3 started > 1 minute before dependency
    testApps = [
      appConfig('app1', NOW, {}, true),
      appConfig(
        'app2',
        NOW - 60001,
        { restartAfterDeployments: 'app1', restartDelay: '1' },
        true,
      ),
      appConfig(
        'app3',
        NOW - 120001,
        { restartAfterDeployments: 'app1', restartDelay: '2' },
        true,
      ),
    ];
    deploymentGraph = build(testApps);
    expect(deploymentsNeedingRestart(deploymentGraph).length).to.equal(2);

    testApps = [
      appConfig('app1', NOW, {}, true),
      appConfig(
        'app2',
        NOW - 60001,
        { restartAfterDeployments: 'app1', restartDelay: '1' },
        true,
      ),
    ];
    deploymentGraph = build(testApps);
    expect(deploymentsNeedingRestart(deploymentGraph).length).to.equal(1);
  });

  it('Graph should return deployments needing image freshness check', () => {
    // app2 should be checked between 09:00 and 09:05
    const testApps = [
      appConfig('app1', NOW, {}, true),
      appConfig('app2', NOW, { checkImageFreshnessAt: '09.00' }, true),
    ];
    const deploymentGraph = build(testApps);
    const currentDate = new Date('2025-01-01T09:01:00');
    expect(
      deploymentsNeedingImageFreshnessCheck(deploymentGraph, currentDate)
        .length,
    ).to.equal(1);

    const beforeDate = new Date('2025-01-01T08:59:00');
    expect(
      deploymentsNeedingImageFreshnessCheck(deploymentGraph, beforeDate).length,
    ).to.equal(0);

    const afterDate = new Date('2025-01-01T09:06:00');
    expect(
      deploymentsNeedingImageFreshnessCheck(deploymentGraph, afterDate).length,
    ).to.equal(0);
  });
});
