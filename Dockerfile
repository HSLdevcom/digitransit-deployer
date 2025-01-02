FROM node:22-alpine
MAINTAINER Digitransit version: 0.1
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app
ENV CHECK_INTERVAL_MINUTES 5
ENV DEBUG ""
ENV TZ "Europe/Helsinki"
ENV DOCKER_USER ""
ENV DOCKER_AUTH ""

RUN apk add --update \
    python3 \
    build-base \
    tzdata \
  && rm -rf /var/cache/apk/*
COPY package.json /usr/src/app/
COPY package-lock.json /usr/src/app/
RUN npm install
COPY src /usr/src/app/src
CMD ["npm", "start" ]
