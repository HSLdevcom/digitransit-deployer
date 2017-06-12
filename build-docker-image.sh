#!/bin/bash
ORG=${ORG:-hsldevcom}
DOCKER_IMAGE=digitransit-deployer

DOCKER_TAG="ci-${TRAVIS_COMMIT}"
# Set these environment variables
#DOCKER_EMAIL=
#DOCKER_USER=
#DOCKER_AUTH=

function tagandpush
  docker tag $ORG/$DOCKER_IMAGE:$DOCKER_TAG $ORG/$DOCKER_IMAGE:$1
  docker login -e $DOCKER_EMAIL -u $DOCKER_USER -p $DOCKER_AUTH
  docker push $ORG/$DOCKER_IMAGE:$DOCKER_TAG $ORG/$DOCKER_IMAGE:$1
fi

if [ "$TRAVIS_PULL_REQUEST" = "false" ]; then

  if [ -n $TRAVIS_TAG ];then
    #release do not rebuild, just tag
    docker pull $ORG/$DOCKER_IMAGE:$DOCKER_TAG
    tagandpush "prod"
  else
    #master branch, build and tag as latest
    docker build --tag="$ORG/$DOCKER_IMAGE:$DOCKER_TAG" .
    tagandpush "latest"
  fi
else
  #pr just build
  docker build --tag="$ORG/$DOCKER_IMAGE:$DOCKER_TAG" .
fi
