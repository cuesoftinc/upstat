FROM node:18-alpine

WORKDIR /upstat/App

COPY package.json ./

RUN npm install

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["npm", "run" , "dev"]

