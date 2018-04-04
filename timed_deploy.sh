#/bin/bash

# This script is a separate tool for making manual production deployments
# at a given hour tomorrow. Default time is early tomorrow morning 03:00
# when service load is presumuably low. By default, deploys th 'digitransit-ui'
# image, but another image name can be given as a command line argument.
# Dockerhub credentials must be defined as env. variables.
# The deployment hour is an optional environment variable.

set -e
ORG=${ORG:-hsldevcom}
IMAGE=$1
IMAGE=${IMAGE:-digitransit-ui}
HOUR=${HOUR:-03}

if [ -z $DOCKER_USER ] || [ -z $DOCKER_AUTH ]; then
    echo 'Usage: DOCKER_USER=<username> DOCKER_AUTH=<password> [HOUR=<hh>] ./timed_deploy.sh [imagename]'
    exit 1
fi

docker login -u $DOCKER_USER -p $DOCKER_AUTH

DOCKER_IMAGE=$ORG/$IMAGE
LATEST_IMAGE=$DOCKER_IMAGE:latest
PROD_IMAGE=$DOCKER_IMAGE:prod

echo Deploying $LATEST_IMAGE to production tomorrow $HOUR:00

current_epoch=$(date +%s)
target_epoch=$(date -d "tomorrow $HOUR:00" +%s)
sleep_seconds=$(( $target_epoch - $current_epoch ))

echo sleeping $sleep_seconds seconds
sleep $sleep_seconds
echo Deploying
docker pull $LATEST_IMAGE
echo "Pushing :prod release to Docker Hub"
docker tag $LATEST_IMAGE $PROD_IMAGE
docker push $PROD_IMAGE
