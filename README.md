[![Build](https://github.com/hsldevcom/digitransit-deployer/workflows/Process%20master%20push/badge.svg)](https://github.com/HSLdevcom/digitransit-deployer/actions)


## Autodeployer, autorestarter and monitoring for Digitransit deployments

We deploy digitransit docker images automatically from Docker Hub. When a Docker image of a kubernetes deployment that we have deployed in our environment is updated at Docker Hub the new image is deployed automatically.

Autodeployer also takes care of restarting dependant deployments.

Additionally, some deployments are restarted periodically.

## Env variable configuration

These following environmental variables should be added:
* "SLACK_ACCESS_TOKEN" access token used for sending slack messages through a Slack app
* "MONITORING_SLACK_CHANNEL_ID" slack channel id (not the name) for most of the Slack messages
* "ALERT_SLACK_CHANNEL_ID" slack channel id (not the name) for sending messages about image freshness checks
* "DOCKER_USER" docker user that is used for interacting with the Docker API
* "DOCKER_AUTH" docker password that is used for interacting with the Docker API
* "TZ" optional timezone (defaults to "Europe/Helsinki")

## Prerequisites

Deployments should have the following labels defined as deployer uses `app` as an identifier for finding deployments/pods.
```yaml
metadata:
  name: <deployment name>
  labels:
    app: <deployment name>
spec:
  template:
    metadata:
      labels:
        app: <deployment name>
```

## Autodeployer configuration

Deployer configuration is stored in labels. For example take a look at https://github.com/HSLdevcom/digitransit-kubernetes-deploy/blob/master/roles/aks-apply/files/prod/opentripplanner-hsl-prod.yml where we have labels set as follows:

```yaml
  metadata:
    labels:
      update: "auto"
      restartAfterDeployments: "digitransit-ui-hsl-v3"
      restartDelay: "5"
```

### update: "auto"
Automatic image updates are enabled for deployment.

### restartAfterDeployments: "opentripplanner-data-con-hsl"
Restart this deployment when deployment opentripplanner-data-con-hsl is restarted.
It is possible to add multiple dependencies by separating them with underscore

### restartDelay: "1"
Wait at minimum 1 minute before restarting this deployment (because of dependant deployment has restarted)

## Cron style autorestarter configuration

Labels are also used for the periodic (cron style) restarts. These labels can coexist with the labels required for the auto deployments. Example label use below:

```yaml
  metadata:
    labels:
      update: "auto"
      restartAfterDeployments: "digitransit-ui-hsl-v3"
      restartDelay: "1"
      restartAt: "04.30"
      restartLimitInterval: "240"
```

### restartAt: "04.30"
Restarts deployment at 04:30. Attempts to restart deployment stop after deployment has been successfully restarted or an hour has passed. It is possible to define multiple restart points by separating them with underscores, for example "restartAt": "13.00_18.50".

### restartLimitInterval: "240"
Optional label that defines in minutes how long time has to be since the last restart for a restart to trigger at the time defined in "restartAt" label. If "restartLimitInterval" is not defined, the default value will be 1080 minutes (18 hours).

## Deployment image freshness monitoring

Optionally, it can be checked that an image has been updated within the last 12 hours.

Example config:

```yaml
  metadata:
    labels:
      update: "auto"
      checkImageFreshnessAt: "09.00"
      imageFreshnessTitle: "Service_X"
```

### checkImageFreshnessAt: "04.30"
Label that defines when the check is done in `hh.mm`. If multiple deployments have identical check times, the checks and messaging are grouped together.

### imageFreshnessTitle: "240"
The title which is used for the deployment when messaging about image freshness over slack.
