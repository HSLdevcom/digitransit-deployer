FROM node:18-alpine
MAINTAINER Digitransit version: 0.1
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app
ENV CHECK_INTERVAL_MINUTES 5
ENV DEBUG ""
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
