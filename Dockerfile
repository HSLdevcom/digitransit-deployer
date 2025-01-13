FROM node:22-alpine
MAINTAINER Digitransit version: 0.1
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app
ENV TZ "Europe/Helsinki"

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
