FROM node:boron
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app
ENV MARATHON_URL http://127.0.0.1:8080/service/marathon/
ENV CHECK_INTERVAL_MINUTES 5
ENV DEBUG ""
COPY package.json /usr/src/app/
RUN npm install
COPY src /usr/src/app/src
CMD [ "npm", "start" ]
