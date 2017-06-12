#!/bin/bash
ORG=hsldevcom
DOCKER_IMAGE=digitransit-deployer

# Set these environment variables
DOCKER_TAG=${VARIABLE:-latest}
#DOCKER_EMAIL=
#DOCKER_USER=
#DOCKER_AUTH=

# Build image
docker build --tag="$ORG/$DOCKER_IMAGE:$DOCKER_TAG" .
docker login -e $DOCKER_EMAIL -u $DOCKER_USER -p $DOCKER_AUTH
docker push $ORG/$DOCKER_IMAGE:$DOCKER_TAG
