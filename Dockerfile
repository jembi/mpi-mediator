FROM node:16

WORKDIR /usr/src/app

COPY . .

RUN npm run build


EXPOSE 3000

CMD [ "node", "dist/index.js" ]
