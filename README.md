[![Build Status](https://travis-ci.org/HSLdevcom/digitransit-deployer.svg?branch=master)](https://travis-ci.org/HSLdevcom/digitransit-deployer)

## Autodeployer, autorestarter and monitoring for Digitransit services

We deploy digitransit docker images automatically from Docker Hub. When a Docker image of a mesos service that we have deployed in our environment is updated at Docker Hub the new image is deployed automatically.

Autodeployer also takes care of restarting dependant services. For example when otp-data is updated otp is restarted etc.

Additionally, some services are restarted periodically.

This service also monitors configurations, deployments, and nodes. 

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
Restarts service at 04:30. Attempts to restart service stop after service has been successfully restarted or an hour has passed. It is possible to define multiple restart points by separating them with commas, for example "restart-at": "13:00, 18:50".

### "restart-limit-interval": "240"
Optional label that defines in minutes how long time has to be since the last restart for a restart to trigger at the time defined in "restart-at" label. If "restart-limit-interval" is not defined, the default value will be 1080 minutes (18 hours).

## Monitoring

Monitoring is used for five purposes, to check if configurations match between the environment and a repository where configurations are stored, if services are configured to restart each other in a cycle, to check if there are service deployments stuck in waiting state, to see if nodes drop out of network and to check the health status of the nodes.

If service is missing from either environment, repository, or they dont match, a message will be sent to given slack webhook. Similarly, if services are configured to start each other in a cycle or a service is stuck in waiting state, message will be sent to given slack webhook.

If a node goes unhealthy or drops out of the network, a message will be sent to slack. If node(s) are added to the network, the number of added nodes will be posted to slack.
