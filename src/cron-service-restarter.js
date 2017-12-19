const debug = require('debug')('cron-service-restarter.js');
const graph = require('./graph.js');

/*
 * Automatically restarts services if they have a restart-at label defined.
 * Restart time is defined in the restart-at label with "hh:mm" format.
 * It is possible to define multiple restart points by separating them with commas,
 * for example "13:00, 18:50".
 * Service will not be restarted if it has been less than minutes defined
 * in label restart-limi-interval or 18 hours, if the label hasn't been defined,
 * since the last restart. The last chance for the restart to occur is 60 minutes
 * past the time defined in restart-at label.
 */

const getDateObject = ([hour, minute]) => {
  const dateObject = new Date();
  dateObject.setTimezone('Europe/Helsinki');
  dateObject.setHours(parseInt(hour));
  dateObject.setMinutes(parseInt(minute));
  return dateObject;
};

module.exports = {
  name:'cron-service-restarter',
  command: (services, context) => {
    let serviceGraph = graph.build(services);
    const NOW = new Date().getTime();
    let hasBeenRestarted = false;

    services.filter((service) => service.labels['restart-at'])
    .forEach(service => {
      const serviceDate = Date.parse(service.version);
      const restartIntervalMins = parseInt(service.labels['restart-limit-interval']) || 60 * 18;

      service.labels['restart-at'].split(',').forEach(restartTime => {
        if (!hasBeenRestarted) {
          const trimmedTime = restartTime.replace(/\s/g, '');
          const timeArray = trimmedTime.split(':');
          const nextHour = parseInt(timeArray[0]) + 1;

          const cronDate = getDateObject(timeArray);
          // One hour later
          const cronDateUpperLimit = getDateObject([nextHour, timeArray[1]]);

          if (NOW - serviceDate >= restartIntervalMins * 60 * 1000 &&
            NOW >= cronDate.getTime() &&
            NOW <= cronDateUpperLimit.getTime()) {
            if(graph.isSubGraphStable(serviceGraph, service.id)) {
              debug("Restarting service %s", service.id);
              context.marathon.restartService(
                service.id).then((r) => debug("Restart called: %s", JSON.stringify(r))
              );
              hasBeenRestarted = true;
            } else {
              debug("Delaying restart for %s (subgraph not stable)", service.id);
            }
          } else {
            debug("No need to update %s", service.id);
          }
        }
      });
    });
  }
};
