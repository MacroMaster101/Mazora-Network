# Guarded braces

This private local fork retains the braces 3.0.3 implementation and MIT license.
Upstream: https://github.com/micromatch/braces/tree/3.0.3
Advisory: https://github.com/advisories/GHSA-vfj7-8cjw-p6xm

There is no patched upstream release as of 6 October 2026. The root npm override
replaces every transitive braces instance with this fork. The root fill-range
development dependency supplies its dependency when npm links the local folder.
It is not an upstream
release, and its package name/version intentionally identify the local changes.

Changes: parser stack nesting is capped at 64 before a recursive helper can run;
compile, expand and stringify validate child AST depth and cycles iteratively
before traversal. Inputs beyond the bound throw SyntaxError. Escaped/quoted brace
characters retain their normal meaning. Tests exercise both normal expansion and
malicious nesting, including direct AST input, through the installed dependency.

Keep this directory and its license in source control. When upstream publishes a
fix, remove the override and this fork after running the regression tests, lint,
typecheck, production build and npm audit. Do not change the version just to
silence an advisory: security depends on the guards and their tests.
