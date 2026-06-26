# Security Policy

## 🔒 Supported Versions

We actively support the following versions of Tasty Station POS with security updates:

| Version | Supported          |
|---------|--------------------|
| 1.0.x   | ✅ Active support  |
| < 1.0   | ❌ Not supported   |

## 🚨 Reporting a Vulnerability

**Please DO NOT open public GitHub issues for security vulnerabilities.**

If you discover a security vulnerability, please report it responsibly:

### How to Report

1. **Email**: Send details to the maintainer via GitHub's private vulnerability reporting:
   - Go to: https://github.com/markec12345678/Tasty-Station-POS/security/advisories/new
   - Click "Report a vulnerability"

2. **Include in your report**:
   - Description of the vulnerability
   - Steps to reproduce
   - Affected versions
   - Potential impact
   - Suggested fix (if any)
   - Your contact information (optional)

### Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 5 business days
- **Status Update**: Every 7 days until resolved
- **Fix Release**: Critical issues within 7 days, others within 30 days

### What to Expect

- We will acknowledge your report promptly
- We will investigate and verify the vulnerability
- We will work on a fix and coordinate disclosure with you
- We will credit you in the security advisory (unless you prefer to remain anonymous)

## 🛡️ Security Features

Tasty Station POS implements the following security measures:

### Authentication & Authorization
- **JWT tokens** stored in HttpOnly, Secure, SameSite cookies
- **bcryptjs** password hashing (10 rounds)
- **express-rate-limit** for API endpoint protection (100 req / 15 min / IP)
- **Role-Based Access Control (RBAC)** with 6 roles: admin, manager, cashier, waiter, kitchen, client
- **PIN-based quick login** support (for POS terminals)

### Data Protection
- **MongoDB ACID transactions** for financial consistency
- **Input validation** with express-validator on all mutation endpoints
- **CORS whitelist** — only allowed origins can access the API
- **Cookie security**: HttpOnly + Secure (production) + SameSite=Strict (production)
- **Password hashing** before database insertion (fixed in seed script)

### Infrastructure
- **Redis** for rate limiting and caching (graceful fallback if unavailable)
- **Winston + Morgan** structured logging for audit trail
- **Environment variables** for all secrets (`.env` files git-ignored)
- **Backup encryption** recommended for ZIP files containing PII

### Frontend
- **React 19** with strict mode enabled
- **Zustand** state management (no global mutable state)
- **Shadcn UI** components (accessible by default)
- **PWA** with Service Worker for offline security

## 🔐 Best Practices for Deployment

### Production Environment Variables
```env
NODE_ENV=production
JWT_SECRET=<generate_a_64_char_random_string>
MONGO_URI=<your_mongodb_atlas_uri>
REDIS_URL=<your_redis_url>
CLOUDINARY_CLOUD_NAME=<your_cloud_name>
CLOUDINARY_API_KEY=<your_api_key>
CLOUDINARY_API_SECRET=<your_api_secret>
CLIENT_URL=https://yourdomain.com
```

### Generate a secure JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### HTTPS Setup
- Always serve over HTTPS in production
- Use a reverse proxy (Nginx, Caddy) with automatic TLS
- Set `secure: true` for cookies (automatic when `NODE_ENV=production`)

### Database Security
- Use MongoDB Atlas with IP whitelist
- Enable MongoDB authentication
- Regular backups (use the built-in `/api/backup` endpoint)
- Encrypt backup ZIP files at rest

### Redis Security
- Set a Redis password
- Use Redis 6+ with ACL support
- Bind to localhost or private network only

## ⚠️ Known Security Considerations

### Demo Credentials
The following demo accounts are seeded for development:
- `admin@pos.com` / `password123`
- `sarah@pos.com` / `password123`
- `john@pos.com` / `password123`
- `michael@pos.com` / `password123`
- `gordon@pos.com` / `password123`

**⚠️ These MUST be removed or changed in production deployments.**

### In-Memory MongoDB Fallback
When MongoDB is unreachable, the backend automatically falls back to `mongodb-memory-server`. This is for **development only** — data is lost on restart. In production, always ensure MongoDB is available.

### Service Worker (PWA)
The PWA Service Worker caches the app shell for offline use. After a security update, users may need to:
1. Close all tabs of the app
2. Clear site data
3. Reopen the app

## 📚 Security Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [MongoDB Security Checklist](https://docs.mongodb.com/manual/security/)
- [Express.js Production Best Practices: Security](https://expressjs.com/en/advanced/best-practice-security.html)

## 🏆 Hall of Fame

We gratefully acknowledge security researchers who have responsibly disclosed vulnerabilities:

*(No reports yet — be the first!)*

---

**Last updated**: June 2025
**Maintainer**: markec12345678
