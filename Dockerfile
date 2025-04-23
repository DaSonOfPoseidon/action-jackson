FROM node:14-alpine

# Create app directory
WORKDIR /usr/src/app

# Copy only package files first (leverages caching)
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy the rest of the app
COPY . .

# Expose the app port
EXPOSE 3000

# Start the app
CMD ["node", "server.js"]
