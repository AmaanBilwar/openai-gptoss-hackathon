function sortNumberArray(numbers: number[]): number[] {
  return numbers.sort((a, b) => {
    // Handle special cases like NaN and Infinity
    if (isNaN(a)) return 1;
    if (isNaN(b)) return -1;
    if (a === Infinity) return 1;
    if (b === Infinity) return -1;
    return a - b;
  });
}

function logGitOperationStatus(operation: string, success: boolean, details?: string): void {
  const timestamp = new Date().toISOString();
  const status = success ? 'SUCCESS' : 'FAILED';
  console.log(`[${timestamp}] Git ${operation} - ${status}`);
  if (details) {
    console.log(`Details: ${details}`);
  }
  console.log('-'.repeat(50));
}


