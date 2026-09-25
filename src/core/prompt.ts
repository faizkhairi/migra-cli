import * as readline from 'node:readline';

/**
 * Ask the user a yes/no question on stdin. Resolves to `true` for "y"/"yes"
 * (case-insensitive), `false` for anything else including an empty answer.
 */
export async function confirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${message} (y/N): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}
