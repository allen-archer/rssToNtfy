FROM node:23-slim
WORKDIR /incidents
CMD ["node", "app.js"]
COPY package*.json ./
RUN npm ci --no-audit
COPY *.yml ./
COPY *.js ./