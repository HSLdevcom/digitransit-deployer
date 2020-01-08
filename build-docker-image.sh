#!/bin/bash
ORG=${ORG:-hsldevcom}
DOCKER_IMAGE=digitransit-deployer

DOCKER_TAG="ci-${TRAVIS_COMMIT}"
# Set these environment variables
#DOCKER_USER=
#DOCKER_AUTH=

function tagandpush {
  docker tag $ORG/$DOCKER_IMAGE:$DOCKER_TAG $ORG/$DOCKER_IMAGE:$1
  docker push $ORG/$DOCKER_IMAGE:$1
}

if [ "$TRAVIS_PULL_REQUEST" = "false" ]; then

  docker login -u $DOCKER_USER -p $DOCKER_AUTH
  if [ "$TRAVIS_TAG" ];then
    echo "processing release $TRAVIS_TAG"
    #release do not rebuild, just tag
    docker pull $ORG/$DOCKER_IMAGE:$DOCKER_TAG
    tagandpush "prod"
  else
    echo "processing $TRAVIS_BRANCH build $TRAVIS_COMMIT"
    if [ "$TRAVIS_BRANCH" = "master" ]; then
      #master branch, build and tag as latest
      docker build --tag="$ORG/$DOCKER_IMAGE:$DOCKER_TAG" .
      docker push $ORG/$DOCKER_IMAGE:$DOCKER_TAG
      tagandpush "latest"
    elif [ "$TRAVIS_BRANCH" = "kubernetes" ]; then
      #kubernetes branch, build and tag as kubernetes
      docker build --tag="$ORG/$DOCKER_IMAGE:$DOCKER_TAG" .
      docker push $ORG/$DOCKER_IMAGE:$DOCKER_TAG
      tagandpush "kubernetes"
    else
      #check if branch is greenkeeper branch
      echo Not Pushing greenkeeper to docker hub
      exit 0
    fi
  fi
else
  echo "processing pr $TRAVIS_PULL_REQUEST"
  docker build --tag="$ORG/$DOCKER_IMAGE:$DOCKER_TAG" .
fi
