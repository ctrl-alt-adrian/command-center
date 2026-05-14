export interface RegressionTestResult {
  ok: boolean;
  testFiles: string[];
}

const TEST_PATTERNS: RegExp[] = [
  /^backend\/.*test[^/]*$/i,
  /^backend\/.*test.*\.go$/i,
  /^frontend\/.*test.*$/i,
  /^services\/.*test.*$/i,
  /^testing\//i,
];

function isTestPath(p: string): boolean {
  for (const re of TEST_PATTERNS) {
    if (re.test(p)) return true;
  }
  return false;
}

/**
 * Pass when the diff contains ≥1 file under a recognized test path.
 * Used by the verify gate to enforce the regression-test requirement.
 */
export function checkRegressionTests(paths: string[]): RegressionTestResult {
  const testFiles = paths.filter(isTestPath);
  return { ok: testFiles.length > 0, testFiles };
}
