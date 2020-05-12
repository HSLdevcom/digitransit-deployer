[![Build Status](https://travis-ci.org/HSLdevcom/digitransit-deployer.svg?branch=master)](https://travis-ci.org/HSLdevcom/digitransit-deployer) 


## Autodeployer, autorestarter and monitoring for Digitransit deployments

We deploy digitransit docker images automatically from Docker Hub. When a Docker image of a kubernetes deployment that we have deployed in our environment is updated at Docker Hub the new image is deployed automatically.

Autodeployer also takes care of restarting dependant deployments. For example when otp-data is updated otp is restarted etc.

Additionally, some deployments are restarted periodically.

## Prerequisites

Deployments should have the following labels defined as deployer uses `app` as an identifier for finding deployments/pods and `lastRestartDate` should exist because deployer at runtime restarts services by updating that label to be epoch time from the restart moment and it also checks when deployment was last "restarted" by reading that value. If the value is not a number, deployer ignores it and checks what is the age of the oldest pod to determine the age of the deployment.
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
        lastRestartDate: dummy-value
```

## Autodeployer configuration

Deployer configuration is stored in labels. For example take a look at https://github.com/HSLdevcom/digitransit-kubernetes-deploy/blob/master/roles/aks-apply/files/prod/opentripplanner-hsl-prod.yml where we have labels set as follows:

```yaml
  metadata:
    labels:
      update: "auto"
      restartAfterDeployments: "opentripplanner-data-con-hsl"
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
      restartAfterDeployments: "opentripplanner-data-con-hsl"
      restartDelay: "1"
      restartAt: "04.30"
      restartLimitInterval: "240"
```

### restartAt: "04.30"
Restarts deployment at 04:30. Attempts to restart deployment stop after deployment has been successfully restarted or an hour has passed. It is possible to define multiple restart points by separating them with underscores, for example "restartAt": "13.00_18.50".

### restartLimitInterval: "240"
Optional label that defines in minutes how long time has to be since the last restart for a restart to trigger at the time defined in "restartAt" label. If "restartLimitInterval" is not defined, the default value will be 1080 minutes (18 hours).
