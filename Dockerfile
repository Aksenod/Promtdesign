# Build Onlook web client
FROM oven/bun:1

WORKDIR /app

# Set build and production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV STANDALONE_BUILD=true
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Copy everything (monorepo structure)
COPY . .

# Accept build arguments for NEXT_PUBLIC_* variables
# These are needed during build time for Next.js to embed them in the client bundle
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_POSTHOG_KEY
ARG NEXT_PUBLIC_POSTHOG_HOST
ARG NEXT_PUBLIC_GLEAP_API_KEY
ARG NEXT_PUBLIC_FEATURE_COLLABORATION
ARG NEXT_PUBLIC_HOSTING_DOMAIN
ARG NEXT_PUBLIC_RB2B_ID

# Set environment variables from build args
# Render automatically passes environment variables as build args
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_POSTHOG_KEY=$NEXT_PUBLIC_POSTHOG_KEY
ENV NEXT_PUBLIC_POSTHOG_HOST=$NEXT_PUBLIC_POSTHOG_HOST
ENV NEXT_PUBLIC_GLEAP_API_KEY=$NEXT_PUBLIC_GLEAP_API_KEY
ENV NEXT_PUBLIC_FEATURE_COLLABORATION=$NEXT_PUBLIC_FEATURE_COLLABORATION
ENV NEXT_PUBLIC_HOSTING_DOMAIN=$NEXT_PUBLIC_HOSTING_DOMAIN
ENV NEXT_PUBLIC_RB2B_ID=$NEXT_PUBLIC_RB2B_ID

# Install dependencies and build
RUN bun install --frozen-lockfile
# Skip env validation during build - will be validated at runtime
ENV SKIP_ENV_VALIDATION=true
RUN cd apps/web/client && bun run build:standalone

# Expose the application port
EXPOSE 3000

# Health check to ensure the application is running
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD bun -e "fetch('http://localhost:3000').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Start the Next.js server
CMD ["bun", "apps/web/client/.next/standalone/apps/web/client/server.js"]