# Dockerfile para deploy
FROM node:18-alpine

WORKDIR /app

# Copiar package files
COPY package*.json ./

# Instalar dependências
RUN npm ci --only=production

# Copiar código fonte
COPY src ./src

# Criar diretório para sessões
RUN mkdir -p sessions

# Expor porta
EXPOSE 3001

# Comando de start
CMD ["npm", "start"]

