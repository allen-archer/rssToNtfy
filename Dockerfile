FROM node:23-slim
WORKDIR /rsstontfy
CMD ["node", "app.js"]
COPY package*.json ./
RUN npm ci --no-audit
COPY *.js ./