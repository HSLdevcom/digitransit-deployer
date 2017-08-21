const debug = require('debug')('cron-service-restarter.js');
const graph = require('./graph.js');
const time = require('time')(Date);

/*
 * Automatically restarts services if they have a restart-at label defined.
 * Restart time is defined in the restart-at label with "hh:mm" format.
 * Service will not be restarted if it has been less than minutes defined
 * in label restart-limi-interval or 18 hours, if the label hasn't been defined,
 * since the last restart. The last chance for the restart to occur is 60 minutes
 * past the time defined in restart-at label.
 */
module.exports = {
  name:'cron-service-restarter',
  command: (services, context) => {
    let serviceGraph = graph.build(services);
    const NOW = new Date().getTime();

    services.filter((service) => service.labels['restart-at'])
    .forEach(service => {
      const serviceDate = Date.parse(service.version);
      const restartIntervalMins = parseInt(service.labels['restart-limit-interval']) || 60 * 18;
      const cronTimeArray = service.labels['restart-at'].split(':');
      const cronDate = new Date();
      cronDate.setTimezone('Europe/Helsinki');
      cronDate.setHours(parseInt(cronTimeArray[0]));
      cronDate.setMinutes(parseInt(cronTimeArray[1]));
      const cronDateUpperLimit = new Date();
      cronDateUpperLimit.setTimezone('Europe/Helsinki');
      cronDateUpperLimit.setHours(parseInt(cronTimeArray[0]) + 1);
      cronDateUpperLimit.setMinutes(parseInt(cronTimeArray[1]));
      if (NOW - serviceDate >= restartIntervalMins * 60 * 1000 &&
        NOW >= cronDate.getTime() &&
        NOW <= cronDateUpperLimit.getTime()) {
        if(graph.isSubGraphStable(serviceGraph, service.id)) {
          debug("Restarting service %s", service.id);
          context.marathon.restartService(service.id).then((r) => debug("Restart called: %s", JSON.stringify(r)));
        } else {
          debug("Delaying restart for %s (subgraph not stable)", service.id);
        }
      } else {
        debug("No need to update %s", service.id);
      }
    });
  }
};
