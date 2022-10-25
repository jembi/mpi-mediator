FROM node:16

WORKDIR /usr/src/app

RUN yarn

COPY . .

CMD [ "yarn", "start" ]
