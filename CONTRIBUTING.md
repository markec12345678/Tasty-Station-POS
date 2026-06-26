# Contributing to Tasty Station POS

First off, **thank you** for taking the time to contribute! 🎉

## 🚀 Quick Contribution Workflow

1. **Fork** the repository to your GitHub account
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/Tasty-Station-POS.git
   cd Tasty-Station-POS
   ```
3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/markec12345678/Tasty-Station-POS.git
   ```
4. **Create a feature branch**:
   ```bash
   git checkout -b feature/my-amazing-feature
   ```
5. **Make your changes** and test them locally:
   ```bash
   cd backend && npm run dev:seed   # backend with auto-seed
   cd frontend && npm run dev        # frontend
   ```
6. **Commit** using Conventional Commits (enforced by Husky + commitlint):
   ```bash
   git commit -m "feat: add new loyalty tier"
   ```
7. **Push** to your fork:
   ```bash
   git push origin feature/my-amazing-feature
   ```
8. **Open a Pull Request** on GitHub

## 📝 Conventional Commits

This project uses [Conventional Commits](https://www.conventionalcommits.org/) for automatic changelog generation. Allowed types:

| Type       | Use for                                                 |
|------------|---------------------------------------------------------|
| `feat`     | A new feature                                           |
| `fix`      | A bug fix                                               |
| `docs`     | Documentation only changes                              |
| `style`    | Changes that do not affect the meaning of the code      |
| `refactor` | A code change that neither fixes a bug nor adds a feature|
| `perf`     | A code change that improves performance                 |
| `test`     | Adding missing tests or correcting existing tests       |
| `chore`    | Changes to the build process or auxiliary tools         |
| `ci`       | Changes to CI configuration files and scripts           |

**Examples:**
```
feat: add waiter terminal with quick-order actions
fix: hash passwords before insertMany in seed script
docs: update README with loyalty program screenshots
refactor: replace alert() with Shadcn Dialog in ManageTables
```

## 🧪 Testing

Before submitting a PR, please:

1. **Run the linter**:
   ```bash
   cd backend && npm run lint
   cd frontend && npm run lint
   ```

2. **Run the tests**:
   ```bash
   cd backend && npm test
   cd frontend && npm test
   ```

3. **Test manually**:
   - Start backend: `cd backend && npm run dev:seed`
   - Start frontend: `cd frontend && npm run dev`
   - Open http://localhost:5173
   - Login: `admin@pos.com` / `password123`
   - Test the affected feature

## 🎨 Code Style

### Frontend (React + Tailwind)

- Use **functional components with hooks** only
- Use **Zustand** for state management (not Redux)
- Use **Shadcn UI** components when possible (check `/frontend/src/components/ui/`)
- Use **Lucide React** icons
- Use **Tailwind CSS** for styling — no inline CSS, no styled-components
- Use **i18next** for all user-facing text (Slovenian + English)
- Use **camelCase** for variables and functions
- Use **PascalCase** for components and types
- Keep components under 400 lines — split if larger

### Backend (Node.js + Express)

- Use **CommonJS** (`require` / `module.exports`)
- Use **async/await** — no callbacks
- Use **Mongoose** models with validation
- Use **express-validator** for request validation
- Use **Try/catch** with proper error handling
- Use the **ApiError** class for custom errors
- All routes must use the **protectedRoute** middleware (or be explicitly public)

## 🌍 Internationalization (i18n)

All new user-facing text MUST be added to both:
- `frontend/src/i18n/locales/sl.json` (Slovenian — default)
- `frontend/src/i18n/locales/en.json` (English)

Use the `t()` function in components:
```jsx
import { useTranslation } from 'react-i18next';
const { t } = useTranslation();
return <h1>{t('dashboard.title')}</h1>;
```

## 🐛 Reporting Bugs

Before creating a bug report, please **search existing issues** to avoid duplicates.

When creating a bug report, include:
- **Clear title** and description
- **Steps to reproduce** the behavior
- **Expected behavior** vs **actual behavior**
- **Screenshots** if applicable
- **Environment**: OS, browser, Node.js version, MongoDB version
- **Logs** from backend or terminal output

## 💡 Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. Use the "Feature request" template and include:
- **Clear title** and description
- **Use case** — why is this enhancement useful?
- **Possible implementation** — how would you implement it?
- **Alternatives considered**

## 🔄 Pull Request Process

1. Update the **README.md** with details of changes if applicable
2. Update the **docs/** folder with any new screenshots or architecture diagrams
3. The PR title should follow Conventional Commits
4. PR description should reference any related issues (`Closes #123`)
5. **Be kind** — review processes are for quality, not criticism

## 🏗️ Development Setup

For detailed setup instructions, see the [README.md](./readme.md#-quick-start).

### Quick start:
```bash
git clone https://github.com/markec12345678/Tasty-Station-POS.git
cd Tasty-Station-POS
./start.sh
```

This starts both backend (port 3000) and frontend (port 5173) with auto-seeded demo data.

---

**Questions?** Open an issue on GitHub or contact the maintainer.

**If you found this project helpful, please ⭐ it on GitHub!**
