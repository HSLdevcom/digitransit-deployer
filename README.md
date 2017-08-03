[![Build Status](https://travis-ci.org/HSLdevcom/digitransit-deployer.svg?branch=master)](https://travis-ci.org/HSLdevcom/digitransit-deployer)

## Autodeployer for Digitransit services

We deploy digitransit docker images automatically from Docker Hub. When a Docker image of a mesos service that we have deployed in our environment is updated at Docker Hub the new image is deployed automatically.

Autodeployer also takes care of restarting dependant services. For example when otp-data is updated otp is restarted etc.

## Configuration

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
