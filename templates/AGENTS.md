# Agent Configuration

This file guides AI coding agents working in this repository.

## Project Context

<!-- Replace this with your project-specific context -->
- **Project Name**: [Your Project]
- **Purpose**: [Brief description of what this project does]
- **Tech Stack**: [Main languages, frameworks, and tools]

## Architecture Overview

<!-- High-level architecture description -->
- The codebase follows [pattern/architecture style]
- Key modules: [main components and their responsibilities]
- Data flow: [how data moves through the system]

## Coding Conventions

### General Principles
- **Prefer existing patterns**: Look at similar code before introducing new approaches
- **No premature abstraction**: Three similar usages are better than one unclear abstraction
- **Clear naming**: Names should reveal intent without needing extra comments

### Language-Specific Guidelines

#### TypeScript/JavaScript
- Use strict mode and proper type definitions
- Prefer `const` over `let`, avoid `var`
- Use async/await over Promise chains
- Handle errors appropriately - never silently swallow exceptions

#### Python
- Follow PEP 8 style guidelines
- Use type hints for function signatures
- Prefer context managers (`with` statements) for resource management
- Use explicit error handling with specific exception types

#### Go
- Follow effective Go guidelines
- Use goroutines and channels carefully, document concurrency patterns
- Prefer explicit error returns over panic/recover
- Keep interfaces small and focused

### Testing
- Write tests for new features and bug fixes
- Test edge cases and error conditions
- Use descriptive test names that explain what is being tested
- Maintain test independence - tests should not depend on each other

## Git Workflow

### Branching Strategy
- Branch from `main` for all work
- Use descriptive branch names: `feature/`, `fix/`, `refactor/`
- Keep branches focused and short-lived

### Commit Practices
- Write clear commit messages that explain WHY, not WHAT
- Use conventional commit format: `type(scope): description`
- Types: feat, fix, refactor, docs, test, chore
- Example: `feat(auth): add OAuth2 login support`

### Pull Requests
- All changes require PR review before merging to main
- PR descriptions should include:
  - Summary of changes
  - Testing performed
  - Breaking changes (if any)
  - Related issues/tickets

## Development Workflow

### Before Making Changes
1. Read existing code in the area you'll modify
2. Understand the existing patterns and conventions
3. Check for open issues or PRs related to your work

### While Coding
1. Keep changes focused and atomic
2. Run tests frequently during development
3. Update documentation as you go
4. Handle errors gracefully

### Before Submitting
1. Run the full test suite
2. Check for linting issues
3. Update related documentation
4. Review your own changes one more time

## Communication Style

- **Be concise**: Provide necessary context without verbosity
- **Be technical**: Assume the reader is familiar with the codebase
- **Explain tradeoffs**: When making decisions, briefly explain alternatives considered
- **Ask questions**: When requirements are unclear, ask rather than assume

## Environment Setup

```bash
# Install dependencies
npm install  # or pip install, go mod download, etc.

# Run tests
npm test     # or pytest, go test, etc.

# Start development server
npm run dev  # or appropriate command for your stack
```

## Common Tasks

### Adding a New Feature
1. Check existing implementations for similar features
2. Follow established patterns and conventions
3. Write tests first (TDD) or alongside development
4. Update documentation

### Debugging
- Check logs for error messages and stack traces
- Use the debugger in your IDE
- Add temporary logging to trace execution flow
- Consult the issue tracker for known problems

### Performance Optimization
- Profile before optimizing
- Focus on hot paths and bottlenecks
- Document optimization decisions
- Add benchmarks for critical code paths

## Resources

- Documentation: [link to docs if applicable]
- Issue Tracker: [link to issues if applicable]
- Team Communication: [Slack/Teams channel, etc.]

---

**Note**: This template should be customized for your specific project. Remove placeholders and add details relevant to your codebase.