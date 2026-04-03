FROM node:20-alpine

WORKDIR /app
ENV VITE_API_BASE_URL=http://localhost:3000/api

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

EXPOSE 5173
CMD ["npm", "run", "dev"]
