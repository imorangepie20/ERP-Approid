FROM node:22-alpine AS builder

WORKDIR /app

ARG VITE_API_CORE_URL=http://127.0.0.1:38080/api/core
ARG VITE_API_ANALYTICS_URL=http://127.0.0.1:38000/api/analytics
ENV VITE_API_CORE_URL=$VITE_API_CORE_URL
ENV VITE_API_ANALYTICS_URL=$VITE_API_ANALYTICS_URL

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runtime

RUN rm /etc/nginx/conf.d/default.conf
COPY infra/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
