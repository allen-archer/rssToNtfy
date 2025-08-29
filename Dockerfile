FROM node:lts-slim
WORKDIR /rsstontfy
CMD ["node", "app.js"]
COPY package*.json ./
RUN npm ci --no-audit
COPY *.js ./
