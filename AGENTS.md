# Harness Rules

Read `CLAUDE.md` for project scope, conventions, and implementation constraints.

## Proportionate Verification

- For small, scoped changes, run only the closest relevant tests or checks. Use targeted
  test files, test classes, or test methods instead of the full suite.
- Run full verification only at milestone completion or immediately before committing.
  Select the full checks for the affected areas; documentation-only changes require no
  application build or test suite.
- Broaden verification earlier only when a failure or concrete evidence shows that the
  change affects additional areas. Explain the reason briefly before doing so.
- Once relevant checks pass, finish the task without repeating them unless further edits
  or new evidence invalidate the result. Reuse still-valid verification at commit time.
- For documentation and harness-rule edits, inspect the diff and run `git diff --check`.
- For configuration-only changes, validate the configuration and affected runtime behavior.
  Rebuild or restart services only when necessary to apply the change.

Examples: frontend `npm run test -- src/path/feature.test.tsx`; backend
`.\gradlew.bat test --tests com.erpapproid.core.feature.FeatureTest`.
