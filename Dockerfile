# Etapa 1 - Build do projeto
FROM node:18-alpine AS build

WORKDIR /app

# Copiar package.json e instalar dependências
COPY package*.json ./
RUN npm install

# Copiar todo o projeto
COPY . .

# Rodar build (ajustável se usar yarn/pnpm)
RUN npm run build

# Etapa 2 - Servidor Nginx
FROM nginx:alpine

# Remover config padrão e usar nosso nginx.conf
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiar arquivos buildados para pasta do Nginx
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
