import { connectSSH } from "../runCommand.ts";
import { delay } from "./delayHelper.ts";

let connected = false;
let lastErr: any = null;
export const attemptSSHConnection = async ({
    maxRetries = 10,
    vmIP,
    baseDelay = 1000,
}) => {
    console.log(`\n Waiting for SSH to become available at ${vmIP}:22...`);
    console.log(`   Max retries: ${maxRetries}, Base delay: ${baseDelay}ms\n`);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(
            `[${attempt}/${maxRetries}] Trying SSH connection to ${vmIP}...`,
        );
        try {
            await connectSSH(vmIP);
            connected = true;
            console.log(
                `\n SSH connected successfully on attempt ${attempt}!\n`,
            );
            break;
        } catch (err) {
            lastErr = err;
            const backoff = baseDelay * Math.min(attempt, 5); // Cap exponential backoff at 5x
            console.log(
                `    Connection failed: ${err instanceof Error ? err.message : String(err)}`,
            );
            console.log(`    Retrying in ${backoff}ms...\n`);
            await delay(backoff);
        }
    }

    if (!connected) {
        const errMsg = `Failed to connect to SSH after ${maxRetries} attempts. Last error: ${String(lastErr)}`;
        console.error(errMsg);
        throw new Error(errMsg);
    }

    // await new Promise((resolve) => setTimeout(resolve, 2000));
    // await connectSSH()
};
