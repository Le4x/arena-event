# 🤝 Contributing to Arena Event

Thank you for your interest in contributing to Arena Event!

---

## 📋 Code of Conduct

Be respectful, inclusive, and constructive in all interactions.

---

## 🛠️ Development Setup

1. **Fork the repository**
2. **Clone your fork**
   ```bash
   git clone https://github.com/your-username/arena-event.git
   cd arena-event
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

5. **Start development**
   ```bash
   npm run docker:up
   npm run db:migrate
   npm run dev
   ```

---

## 📝 Commit Guidelines

Use conventional commits:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

**Examples:**
```bash
git commit -m "feat: add team name validation"
git commit -m "fix: resolve buzzer lock race condition"
git commit -m "docs: update API documentation"
```

---

## 🧪 Testing

Run tests before submitting:

```bash
npm run test
npm run lint
```

---

## 🔄 Pull Request Process

1. **Update documentation** if needed
2. **Add tests** for new features
3. **Ensure all tests pass**
4. **Update CHANGELOG** if applicable
5. **Submit PR** with clear description

---

## 🐛 Reporting Bugs

Include:
- Clear title and description
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, Node version, etc.)
- Screenshots if applicable

---

## 💡 Suggesting Features

Open an issue with:
- Use case description
- Proposed solution
- Alternatives considered
- Mockups/examples if applicable

---

## 📚 Resources

- [NestJS Documentation](https://docs.nestjs.com)
- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Socket.IO Documentation](https://socket.io/docs)

---

**Thank you for contributing! 🎉**
