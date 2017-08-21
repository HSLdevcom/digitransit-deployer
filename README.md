[![Build Status](https://travis-ci.org/HSLdevcom/digitransit-deployer.svg?branch=master)](https://travis-ci.org/HSLdevcom/digitransit-deployer)

## Autodeployer and autorestarter for Digitransit services

We deploy digitransit docker images automatically from Docker Hub. When a Docker image of a mesos service that we have deployed in our environment is updated at Docker Hub the new image is deployed automatically.

Autodeployer also takes care of restarting dependant services. For example when otp-data is updated otp is restarted etc.

Additionally, some services are restarted periodically.

## Autodeployer configuration

Deployer configuration is stored in labels. For example take a look at https://github.com/HSLdevcom/digitransit-mesos-deploy/blob/master/digitransit-azure-deploy/files/opentripplanner-hsl-prod.json where we have labels set as follows:

```json
  "labels": {
    "update": "auto",
    "restart-after-services": "/opentripplanner-data-con-hsl",
    "restart-delay": "1"
  },
```

### "update": "auto
Automatic image updates are enabled for service.

### "restart-after-services": "/opentripplanner-data-con-hsl"
Restart this service when service /opentripplanner-data-con-hsl is restarted

### "restart-delay": "1"
Wait at minimum 1 minute before restarting this service (because of dependant service has restarted=

## Autorestarter configuration

Labels are also used for the periodic (cron style) restarts. These labels can coexist with the labels required for the auto deployments. Example label use below:

```json
  "labels": {
    "update": "auto",
    "restart-after-services": "/opentripplanner-data-con-hsl",
    "restart-delay": "1",
    "restart-at": "04:30",
    "restart-limit-interval": "240"
  },
```

### "restart-at": "04:30"
Restarts service at 04:30. Attempts to restart service stop after service has been successfully restarted or an hour has passed.

### "restart-limit-interval": "240"
Optional label that defines in minutes how long time has to be since the last restart for a restart to trigger at the time defined in "restart-at" label. If "restart-limit-interval" is not defined, the default value will be 1080 minutes (18 hours).
