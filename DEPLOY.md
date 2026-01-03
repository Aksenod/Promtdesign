# Deployment Guide - Render.com

This guide explains how to deploy the Onlook application to Render.com.

## Prerequisites

- GitHub account with the repository pushed
- Render.com account (free tier available)
- Supabase project set up
- Required API keys (CodeSandbox, OpenAI, etc.)

## Step 1: Prepare Your Repository

The repository already includes:
- `render.yaml` - Render configuration file
- `Dockerfile` - Docker configuration for Bun
- `.env.example` - Example environment variables

## Step 2: Create a Render Account

1. Go to https://render.com
2. Sign up or log in with your GitHub account
3. Authorize Render to access your GitHub repositories

## Step 3: Create a New Web Service

1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub repository: `Aksenod/Promtdesign`
3. Render will automatically detect the `render.yaml` file

## Step 4: Configure Environment Variables

In the Render dashboard, add the following environment variables:

### Required Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/dbname
SUPABASE_DATABASE_URL=postgresql://postgres:postgres@host:5432/postgres

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# CodeSandbox (required for preview functionality)
CSB_API_KEY=csb_v1_your_api_key

# AI APIs (at least one required)
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key

# Node Environment
NODE_ENV=production
PORT=3000
```

### Optional Variables

```bash
# Firecrawl (for screenshots)
FIRECRAWL_API_KEY=fc-your-firecrawl-key

# Langfuse (AI observability)
LANGFUSE_SECRET_KEY=sk-lf-your-secret-key
LANGFUSE_PUBLIC_KEY=pk-lf-your-public-key
LANGFUSE_HOST=https://cloud.langfuse.com

# PostHog (analytics)
NEXT_PUBLIC_POSTHOG_KEY=phc_your_posthog_key
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

## Step 5: Deploy

1. Click **"Create Web Service"**
2. Render will:
   - Clone your repository
   - Build the Docker image using Bun
   - Deploy the application
   - Assign a URL (e.g., `https://onlook-app.onrender.com`)

## Step 6: Database Setup

If using Render's PostgreSQL:

1. Create a PostgreSQL database in Render
2. Copy the **Internal Database URL**
3. Add it as `DATABASE_URL` and `SUPABASE_DATABASE_URL`
4. Run migrations (if needed)

## Step 7: Verify Deployment

1. Visit your Render URL
2. Check the deployment logs for any errors
3. Test the CodeSandbox preview functionality
4. Verify database connections

## Troubleshooting

### Build Fails

- Check the build logs in Render dashboard
- Verify all environment variables are set
- Ensure `Dockerfile` is in the root directory

### Application Crashes

- Check runtime logs in Render
- Verify database connection strings
- Ensure all required API keys are valid

### CodeSandbox Preview Issues

- Verify `CSB_API_KEY` is set correctly
- Check that the API key has `VM Manage` scope
- Review server logs for CodeSandbox SDK errors

## Automatic Deployments

Render automatically deploys when you push to the `main` branch:

```bash
git add .
git commit -m "Update application"
git push origin main
```

## Custom Domain (Optional)

1. Go to your service settings in Render
2. Click **"Custom Domain"**
3. Add your domain and configure DNS records

## Monitoring

- **Logs**: Available in Render dashboard
- **Metrics**: CPU, memory, and request metrics
- **Alerts**: Configure in Render settings

## Cost

- **Free Tier**: 750 hours/month (enough for one service)
- **Starter**: $7/month for always-on service
- **Database**: Free tier available, $7/month for production

## Support

For issues:
- Check Render documentation: https://render.com/docs
- Review application logs
- Check GitHub issues: https://github.com/Aksenod/Promtdesign/issues
