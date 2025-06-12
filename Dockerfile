FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm install
RUN npm run build
CMD ["node", "dist/server.js"]
EXPOSE 4004
