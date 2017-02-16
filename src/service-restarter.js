const debug = require('debug')('digitransit-service-restarter');



const serviceIsStable = (service) =>
  service.instances > 0 && service.tasksHealthy === service.instances && service.tasksUnhealthy === 0 && service.tasksStaged === 0;
/*
 * Automatically restarts dependand services in controlled manner. This is
 * useful because we have data as container and we want to restart containers
 * that depend on that data.
 * Configured with labels as follows:
 *  restart-after-services=/service-name
 *  restart-delay=5
 *
 *  or multiple:
 *  restart-after-services=/service-name,/another-service
 *  restart-delay=5
 *
 * where /service-name is the dependent mesos service name (including the leading '/')
 * restart-delay is in minutes, specifying this to 1 means that restart is not tried before service health is 'ok' and
 * 1 minutes have elapsed from restart. The default value is 5 minutes.
 *
 * If there are multiple dependencies all dependendencies must pass criteria before restart happens
 */
module.exports = {
  name:'service-restarter',
  command: (services, context) => {
    const NOW = new Date();
    const serviceDependencies = [];
    const serviceMap = {};
    services.forEach((service) => {
      serviceMap[service.id] = service;
      if(service.labels['restart-after-services']) {
        debug('restart dependency discovered for service:%s', service.id);
        let dependencies = service.labels['restart-after-services'].split(',');
        const delay = (service.labels['restart-delay'] || 5) * 60 * 1000;
        serviceDependencies.push({
          service: service.id,
          dependencies: dependencies,
          delay: delay
        });
      }
    });

    serviceDependencies.forEach(serviceDependency => {
      let okToStartCount = 0;
      let needsRestart = false;
      serviceDependency.dependencies.forEach((dependencyName) => {
        if(serviceMap[dependencyName]) {
          const dependency = serviceMap[dependencyName];
          const service = serviceMap[serviceDependency.service];
          const dependencyDate = Date.parse(dependency.version);
          const serviceDate = Date.parse(service.version);
          const dependencyStable = serviceIsStable(dependency);
          const serviceStable = serviceIsStable(service);
          const canStart = serviceStable && dependencyStable && dependencyDate + serviceDependency.delay < NOW;
          const needsStart = serviceDate < dependencyDate + serviceDependency.delay;

          debug("dependency %s date is %s, dependency is stable: %s", dependency.id, dependency.version, dependencyStable);
          debug("Service %s is stable: %s Date is %s, needsStart: %s, canstart: %s",
            serviceDependency.service, serviceStable, service.version, needsStart, canStart);

          if(canStart) {
            okToStartCount += 1;
          }

          if(needsStart) {
            needsRestart = true;
          }

        } else {
          debug("Ignoring unknown dependency for service %s: %s", serviceDependency.service, dependencyName);
        }
      });
      if(okToStartCount === serviceDependency.dependencies.length && needsRestart) {
        debug("Restarting service %s, all %s dependencies checked", serviceDependency.service, okToStartCount);
        context.marathon.restartService(serviceDependency.service).then((e) => debug("Restarted: %s", JSON.stringify(e)));
      }
    });
  }
};
