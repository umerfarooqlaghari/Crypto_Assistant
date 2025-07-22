# Crypto Assistant Frontend - Vercel Deployment Guide

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **GitHub Repository**: Push your code to GitHub
3. **Backend API**: Ensure your backend is deployed and accessible

## Deployment Steps

### 1. Connect to Vercel

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click "New Project"
3. Import your GitHub repository
4. Select the `frontend` folder as the root directory

### 2. Configure Environment Variables

In your Vercel project settings, add the following environment variable:

```
NEXT_PUBLIC_API_URL=https://your-backend-api-url.com
```

**Important**: Replace `https://your-backend-api-url.com` with your actual backend API URL.

### 3. Build Settings

Vercel should automatically detect Next.js. If not, configure:

- **Framework Preset**: Next.js
- **Root Directory**: `frontend`
- **Build Command**: `npm run build`
- **Output Directory**: `.next`

### 4. Deploy

Click "Deploy" and wait for the build to complete.

## Environment Variables

### Required Variables

- `NEXT_PUBLIC_API_URL`: Your backend API URL (must start with `NEXT_PUBLIC_` to be accessible in the browser)

### Local Development

For local development, create a `.env.local` file:

```bash
NEXT_PUBLIC_API_URL=http://localhost:5001
```

## Backend Requirements

Your backend must:

1. **Enable CORS** for your Vercel domain
2. **Support HTTPS** (required for production)
3. **Handle WebSocket connections** (if using real-time features)

### CORS Configuration

Add your Vercel domain to your backend CORS settings:

```javascript
// Example for Express.js
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://your-vercel-app.vercel.app'
  ]
}));
```

## Custom Domain (Optional)

1. Go to your Vercel project settings
2. Navigate to "Domains"
3. Add your custom domain
4. Update DNS records as instructed

## Troubleshooting

### Build Errors

1. Check that all dependencies are in `package.json`
2. Ensure environment variables are set correctly
3. Verify API endpoints are accessible

### Runtime Errors

1. Check browser console for errors
2. Verify `NEXT_PUBLIC_API_URL` is set correctly
3. Ensure backend CORS is configured for your domain

### WebSocket Issues

1. Ensure backend supports WebSocket connections
2. Check that the WebSocket URL uses the correct protocol (ws:// for HTTP, wss:// for HTTPS)

## Performance Optimization

The frontend is configured with:

- Static optimization
- Image optimization
- Compression enabled
- Security headers
- Webpack optimizations

## Monitoring

Monitor your deployment:

1. **Vercel Analytics**: Built-in performance monitoring
2. **Function Logs**: Check serverless function logs in Vercel dashboard
3. **Real User Monitoring**: Consider adding tools like Sentry

## Support

For deployment issues:
- Check Vercel documentation
- Review build logs in Vercel dashboard
- Ensure backend API is accessible from Vercel's servers
