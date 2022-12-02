FROM node:16

WORKDIR /usr/src/app

COPY node_modules ./
COPY dist ./

EXPOSE 3000

CMD [ "node", "dist/index.js" ]
