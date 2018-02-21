FROM mhart/alpine-node:7.8.0

ADD . /app
WORKDIR /app

RUN npm install
RUN npm run build

EXPOSE 3000
VOLUME /app

ENTRYPOINT [ "node",  "dist/index.js" ]
