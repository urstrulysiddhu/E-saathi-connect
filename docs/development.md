# Development Workflow

## Local Validation

Before submitting a pull request, run the comprehensive validation suite:

```bash
npm run validate
```

This ensures that the code passes formatting, linting, strict typechecking, unit testing, and CDK synthesis.

## Branching & Commits

- Use feature branches.
- Write clear, descriptive commit messages. Do not create meaningless commits (e.g. "update", "fix").
- Do not commit local environment files or AWS credentials.

## Pull Requests

- All PRs must pass the GitHub Actions CI workflow.
- PRs should be reviewed for alignment with Phase 0 architectural constraints.
