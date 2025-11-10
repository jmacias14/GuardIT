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

# Create startup script
RUN printf '#!/bin/sh\necho "Waiting for database to be ready..."\nsleep 5\necho "Running database migrations..."\nnode db/migrate.js\necho "Starting GuardIT server..."\nnode server.js\n' > /app/start.sh && chmod +x /app/start.sh

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start the server with migration
CMD ["/app/start.sh"]
