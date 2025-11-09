FROM mcr.microsoft.com/powershell:lts-alpine-3.14

# Install Node.js and npm
RUN apk add --no-cache nodejs npm curl

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application files
COPY . .

# Build Tailwind CSS
RUN npm run build:css

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start the server
CMD ["node", "server.js"]
