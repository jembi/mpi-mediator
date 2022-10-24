FROM node:16

WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./

RUN yarn

COPY . .

CMD [ "yarn", "start" ]
