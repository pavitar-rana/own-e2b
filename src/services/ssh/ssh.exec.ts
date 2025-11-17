import { connections } from "./index.ts";
import pathModule from "path";

export const runCommand = async (
    command: string,
    path?: string,
    host?: string,
) => {
    // Get the connection for this host
    const vmHost = host || Array.from(connections.keys())[0];
    if (!vmHost) {
        throw new Error("No SSH connection available. Call connectSSH first.");
    }

    const entry = connections.get(vmHost);
    if (!entry || !entry.isReady) {
        throw new Error(`Not connected to SSH for host ${vmHost}`);
    }

    return new Promise((resolve, reject) => {
        console.log(
            `Running command on ${vmHost} in path: ${path || "default"}`,
        );
        const nvmInit = `export NVM_DIR="/root/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"`;

        const finalCommand = path
            ? `${nvmInit} && mkdir -p '${path}' && cd '${path}' && ${command}`
            : `${nvmInit} && ${command}`;

        entry.conn.exec(finalCommand, (err, stream) => {
            if (err) return reject(err);

            let output = "";
            let error = "";

            stream
                .on("close", (code: number, signal: unknown) => {
                    if (code === 0) resolve(output.trim());
                    else
                        reject(new Error(`Command failed: ${error || output}`));
                })
                .on("data", (data: Buffer) => (output += data.toString()))
                .stderr.on(
                    "data",
                    (data: Buffer) => (error += data.toString()),
                );
        });
    });
};

export const writeFile = async (
    path: string,
    content: string,
    host?: string,
) => {
    const safeContent = content.replace(/'/g, "'\\''");
    const parentDir = pathModule.dirname(path);

    console.log("PATH to write: ", path);
    console.log("Parent Dir: ", parentDir);

    await runCommand(`mkdir -p '${parentDir}'`, undefined, host);

    const command = `bash -c 'cat > '${path}' <<'EOF'
${safeContent}
EOF'`;
    await runCommand(command, undefined, host);

    const result = await runCommand(`ls -la '${parentDir}'`, undefined, host);
    return result;
};

export const createDir = async (path: string, host?: string) => {
    await runCommand(`mkdir -p '${path}'`, undefined, host);
    return "Directory created";
};
