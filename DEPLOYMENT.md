# 🚀 Deployment Guide — Tasty Station POS

This guide covers deployment to **Vercel** (recommended) and alternatives like Railway, Render, or self-hosted with Docker.

---

## 📋 Pre-deployment Checklist

Before deploying, ensure you have:

- [ ] MongoDB Atlas cluster (free tier is fine for development)
- [ ] Redis instance (optional — Upstash free tier works)
- [ ] Cloudinary account (for menu item images)
- [ ] Google Gemini API key (optional — for AI chat + inventory forecast)
- [ ] JWT secret generated (`node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`)

---

## 🌐 Vercel Deployment (Recommended)

Tasty Station POS is a **monorepo** with two separate apps:
1. **Frontend** — React + Vite static site
2. **Backend** — Node.js + Express serverless functions

### Step 1: Deploy Backend

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repo: `markec12345678/Tasty-Station-POS`
3. **Configure project:**
   - **Root Directory:** `backend`
   - **Framework Preset:** Node.js
   - **Build Command:** (leave empty — no build step)
   - **Output Directory:** (leave empty)
   - **Install Command:** `npm install`

4. **Environment Variables** (add all):
   ```
   NODE_ENV=production
   PORT=3000
   MONGO_URI=mongodb+srv://USER:PASS@cluster.mongodb.net/tastystation
   JWT_SECRET=<your_64_char_random_string>
   REDIS_URL=rediss://default:PASSWORD@upstash-redis.upstash.io:6379
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   GEMINI_API_KEY=your_gemini_key
   CLIENT_URL=https://tasty-station-pos-frontend.vercel.app
   ```

5. Click **Deploy** and wait ~2 minutes
6. Note your backend URL (e.g., `https://tasty-station-pos-backend.vercel.app`)

### Step 2: Deploy Frontend

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import the same GitHub repo: `markec12345678/Tasty-Station-POS`
3. **Configure project:**
   - **Root Directory:** `frontend`
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`

4. **Environment Variables:**
   ```
   VITE_API_BASE_URL=https://tasty-station-pos-backend.vercel.app
   ```

5. Click **Deploy** and wait ~3 minutes
6. Your frontend is live at `https://tasty-station-pos-frontend.vercel.app`

### Step 3: Update Backend CORS

After frontend is deployed, update your backend environment variable:
```
CLIENT_URL=https://tasty-station-pos-frontend.vercel.app
```

Redeploy backend to apply the change.

### Step 4: Update Frontend API URL

The frontend `axiosInstace.js` auto-detects localhost vs production. For custom backend URLs, set:
```
VITE_API_BASE_URL=https://your-backend.vercel.app
```

---

## 🚂 Railway Deployment (Alternative)

Railway is great for full-stack apps with WebSockets support (Socket.io).

### Single Railway project

1. Go to [railway.app/new](https://railway.app/new)
2. Deploy from GitHub repo: `markec12345678/Tasty-Station-POS`
3. Add two services:

**Backend service:**
- Root: `backend`
- Start command: `node index.js`
- Add all environment variables (same as Vercel)

**Frontend service:**
- Root: `frontend`
- Build: `npm run build && npm run preview --port $PORT`
- Add `VITE_API_BASE_URL` pointing to backend Railway URL

### Add MongoDB + Redis

In Railway dashboard:
- Click **+** → **Database** → **MongoDB**
- Click **+** → **Database** → **Redis**
- Railway provides connection URLs automatically

---

## 🐳 Self-hosted with Docker

### Production Docker Compose

```yaml
# docker-compose.prod.yml
version: '3.9'

services:
  mongodb:
    image: mongo:7
    restart: unless-stopped
    ports: ["27017:27017"]
    volumes: [mongo_data:/data/db]
    environment:
      MONGO_INITDB_ROOT_USERNAME: ${MONGO_USER}
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_PASS}
      MONGO_INITDB_DATABASE: tastystation

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    ports: ["6379:6379"]
    command: redis-server --requirepass ${REDIS_PASS}

  backend:
    build: ./backend
    restart: unless-stopped
    ports: ["3000:3000"]
    depends_on: [mongodb, redis]
    env_file: ./backend/.env

  frontend:
    build: ./frontend
    restart: unless-stopped
    ports: ["80:80"]
    depends_on: [backend]

volumes:
  mongo_data:
```

### Build and run:

```bash
# Create production .env files
cp backend/.env.example backend/.env
# Edit with production values

# Build and start all services
docker compose -f docker-compose.prod.yml up -d --build

# View logs
docker compose -f docker-compose.prod.yml logs -f

# Stop
docker compose -f docker-compose.prod.yml down
```

---

## 🔐 Security Hardening for Production

### 1. Generate Strong JWT Secret

```bash
# Generate 64-char hex string
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 2. MongoDB Atlas Security
- Enable IP whitelist (only your backend server IP)
- Use strong database user password
- Enable MongoDB audit log
- Set up automated backups (daily)

### 3. Redis Security
- Set a strong Redis password
- Use TLS (rediss:// protocol)
- Bind to private network only

### 4. CORS Configuration
Backend `index.js` has a CORS whitelist. Update for production:

```js
const allowedOrigins = [
    "https://tasty-station-pos.vercel.app",
    "https://your-custom-domain.com",
];
```

### 5. Rate Limiting
Already configured in backend:
- 100 requests / 15 minutes / IP for API routes
- Configure higher limits for trusted IPs if needed

---

## 🌍 Custom Domain Setup

### Vercel Custom Domain

1. Go to your frontend Vercel project → **Settings** → **Domains**
2. Add your domain: `pos.yourrestaurant.com`
3. Add DNS records at your domain registrar:
   - **Type:** CNAME
   - **Name:** pos
   - **Value:** cname.vercel-dns.com

4. Update `CLIENT_URL` in backend env:
   ```
   CLIENT_URL=https://pos.yourrestaurant.com
   ```

5. Update `VITE_API_BASE_URL` in frontend env if using custom backend domain

### SSL/TLS
Vercel automatically provisions SSL certificates via Let's Encrypt. No action needed.

---

## 📊 Monitoring & Analytics

### Vercel Analytics
Enable in Vercel dashboard → **Analytics** tab. Provides:
- Web Vitals (LCP, FID, CLS)
- Page views
- Top pages
- Audience insights

### Backend Logging
Winston + Morgan already configured. For production log aggregation:
- **Logtail** (free tier) — forward logs via Winston transport
- **Sentry** — error tracking
- **DataDog** — full APM

### MongoDB Monitoring
Atlas provides free monitoring:
- Connection metrics
- Query performance
- Storage usage
- Replica set health

---

## 🔄 CI/CD Pipeline

GitHub Actions CI (`.github/workflows/ci.yml`) runs on every push:
- ✅ Backend lint + test + build
- ✅ Frontend lint + test + build
- ✅ Security audit (npm audit --audit-level=high)
- ✅ Artifact uploads for debugging

Vercel auto-deploys on every push to `main` branch.

---

## 🆘 Troubleshooting

### Backend won't start
- Check MongoDB connection string format: `mongodb+srv://...`
- Verify JWT_SECRET is set (64+ characters)
- Check Cloudinary credentials
- View logs: `vercel logs <deployment-url>`

### Frontend can't reach backend
- Verify `VITE_API_BASE_URL` is set correctly
- Check browser console for CORS errors
- Ensure backend `CLIENT_URL` matches your frontend URL
- Try hard refresh (Ctrl+Shift+R) to clear Service Worker cache

### Socket.io not working
- WebSockets require sticky sessions (Vercel supports this)
- Verify Socket.io URL in `frontend/src/config/socket.config.js`
- Check that backend is running and accessible

### Database connection issues
- MongoDB Atlas: whitelist your server IP
- Use `mongodb+srv://` protocol (not `mongodb://`)
- Verify user has readWrite permissions

### PWA cache issues
After deploying new version, users may need to:
1. Close all app tabs
2. Hard refresh (Ctrl+Shift+R)
3. Or clear site data in DevTools → Application → Storage

---

## 📞 Support

- **GitHub Issues:** [github.com/markec12345678/Tasty-Station-POS/issues](https://github.com/markec12345678/Tasty-Station-POS/issues)
- **Security issues:** See [SECURITY.md](./SECURITY.md)
- **Documentation:** [README.md](./readme.md)

---

**Last updated:** June 2025
