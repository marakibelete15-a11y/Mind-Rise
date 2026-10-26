# Contributing to MindRise

Thank you for your interest in contributing to MindRise! We are building a safe, supportive, and accessible mental health platform for Ethiopian youth.

## Code of Conduct

All contributors and community members are expected to maintain an empathetic, supportive, and respectful environment. Zero tolerance for harassment, discrimination, or privacy violations.

## Branch Naming Conventions

When creating branches, use descriptive prefixes followed by a short kebab-case description:

- `feature/<feature-name>`: New functionality or UI components (e.g., `feature/amharic-toggle`, `feature/assessment-card`)
- `fix/<bug-description>`: Bug fixes (e.g., `fix/auth-token-refresh`, `fix/viewport-scroll`)
- `docs/<docs-topic>`: Documentation updates (e.g., `docs/api-specs`, `docs/setup-guide`)
- `chore/<task-name>`: Maintenance, dependency updates, tooling (e.g., `chore/eslint-config`)
- `refactor/<target>`: Code refactoring without behavior change (e.g., `refactor/prisma-models`)

Example:

```bash
git checkout -b feature/anonymous-avatar-selector
```

## Commit Message Convention (Conventional Commits)

We follow the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) specification:

```text
<type>(<optional scope>): <description>

[optional body]

[optional footer(s)]
```

### Allowed Types:

- `feat`: A new feature for the user
- `fix`: A bug fix
- `docs`: Documentation changes only
- `style`: Changes that do not affect the meaning of the code (white-space, formatting, etc.)
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding missing tests or correcting existing tests
- `chore`: Changes to the build process, tooling, or auxiliary tools

### Examples:

- `feat(client): add Amharic language switcher in header`
- `fix(server): return 401 when bearer token is expired`
- `docs(readme): clarify two-layer identity architecture`

## Pull Request Guidelines

1. **Keep PRs focused**: Each PR should address a single concern or feature.
2. **Ensure tests and lint pass**:
   ```bash
   npm run lint
   npm run test
   ```
3. **Verify Identity Privacy**: Double-check that no endpoint, query, or view leaks real names or phone numbers to community-facing structures.
4. **Fill out the PR template**: Provide context, screenshots for UI changes, and test verification details.
