[![Build Status](https://travis-ci.org/HSLdevcom/digitransit-deployer.svg?branch=master)](https://travis-ci.org/HSLdevcom/digitransit-deployer) [![Greenkeeper badge](https://badges.greenkeeper.io/HSLdevcom/digitransit-deployer.svg)](https://greenkeeper.io/)


## Autodeployer, autorestarter and monitoring for Digitransit deployments

We deploy digitransit docker images automatically from Docker Hub. When a Docker image of a kubernetes deployment that we have deployed in our environment is updated at Docker Hub the new image is deployed automatically.

Autodeployer also takes care of restarting dependant deployments. For example when otp-data is updated otp is restarted etc.

Additionally, some deployments are restarted periodically.

This deployment also monitors configurations, deployments, and nodes. 

## Autodeployer configuration

Deployer configuration is stored in labels. For example take a look at TODO CHANGE THIS https://github.com/HSLdevcom/digitransit-mesos-deploy/blob/master/digitransit-azure-deploy/files/opentripplanner-hsl-prod.json where we have labels set as follows:

```json
  "labels": {
    "update": "auto",
    "restartAfterDeployments": "opentripplanner-data-con-hsl",
    "restartDelay": "1"
  },
```

### "update": "auto
Automatic image updates are enabled for deployment.

### "restartAfterDeployments": "opentripplanner-data-con-hsl"
Restart this deployment when deployment /opentripplanner-data-con-hsl is restarted.
It is possible to add multiple dependencies by separating them with whitespace

### "restartDelay": "1"
Wait at minimum 1 minute before restarting this deployment (because of dependant deployment has restarted)

## Restarts based on dependencies to other images

```json
  "labels": {
    "update": "auto",
    "restartAfterImageUpdates": "digitransit-ui:prod, digitransit-site:prod"
  },
```

### "restartAfterImageUpdates": "digitransit-ui:prod, digitransit-site:prod"
Restart deployment if digitransit-ui:prod or digitransit-site:prod images have been updated.

## Cron style autorestarter configuration

Labels are also used for the periodic (cron style) restarts. These labels can coexist with the labels required for the auto deployments. Example label use below:

```json
  "labels": {
    "update": "auto",
    "restartAfterDeployments": "opentripplanner-data-con-hsl",
    "restartDelay": "1",
    "restartAt": "04.30",
    "restartLimitInterval": "240"
  },
```

### "restartAt": "04.30"
Restarts deployment at 04:30. Attempts to restart deployment stop after deployment has been successfully restarted or an hour has passed. It is possible to define multiple restart points by separating them with whitespace, for example "restartAt": "13.00 18.50".

### "restartLimitInterval": "240"
Optional label that defines in minutes how long time has to be since the last restart for a restart to trigger at the time defined in "restartAt" label. If "restartLimitInterval" is not defined, the default value will be 1080 minutes (18 hours).

## Monitoring

Monitoring is used for four purposes, if deployments are configured to restart each other in a cycle, to check if there are deployment deployments stuck in waiting state, to see if nodes drop out of network and to check the health status of the nodes.

If deployments are configured to start each other in a cycle or a deployment is stuck in waiting state, message will be sent to given slack webhook.

If a node goes unhealthy or drops out of the network, a message will be sent to slack. If node(s) are added to the network, the number of added nodes will be posted to slack.
