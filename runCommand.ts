import { readFileSync } from "fs";
import { Client } from "ssh2";
import pathModule from "path";

const connections = new Map<string, { conn: Client; isReady: boolean }>();

export const connectSSH = (host: string) => {
    return new Promise((resolve, reject) => {
        if (!host) return reject("Host not provided");

        // Check if we already have a ready connection for THIS host
        const existing = connections.get(host);
        if (existing && existing.isReady) {
            console.log(`♻️  Reusing existing SSH connection to ${host}`);
            return resolve(existing.conn);
        }

        // Create new connection for this host
        console.log(`🔌 Creating new SSH connection to ${host}`);
        const conn = new Client();

        // Store in map immediately (not ready yet)
        connections.set(host, { conn, isReady: false });

        conn.removeAllListeners();

        conn.on("ready", () => {
            console.log(`✅ SSH Client ready for ${host}`);
            const entry = connections.get(host);
            if (entry) {
                entry.isReady = true;
            }
            resolve(conn);
        })
            .on("error", (err) => {
                console.error(`❌ SSH Connection error for ${host}:`, err.message);
                // Remove failed connection
                connections.delete(host);
                reject(new Error(`Failed to connect to SSH: ${err.message}`));
            })
            .on("close", () => {
                console.log(`🔚 SSH connection closed for ${host}`);
                connections.delete(host);
            })
            .connect({
                host,
                port: 22,
                username: "root",
                privateKey: readFileSync("/home/pavitar/.ssh/id_rsa"),
                readyTimeout: 30000, // 30 second timeout
            });
    });
};

export const disconnect = (host?: string) => {
    if (host) {
        // Disconnect specific host
        const entry = connections.get(host);
        if (entry && entry.isReady) {
            entry.conn.end();
            connections.delete(host);
            console.log(`🔚 SSH disconnected from ${host}`);
        }
    } else {
        // Disconnect all
        for (const [host, entry] of connections.entries()) {
            if (entry.isReady) {
                entry.conn.end();
            }
        }
        connections.clear();
        console.log("🔚 All SSH connections disconnected");
    }
};

export const runCommand = async (command: string, path?: string, host?: string) => {
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
        console.log(`Running command on ${vmHost} in path: ${path || "default"}`);
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
                    else reject(new Error(`Command failed: ${error || output}`));
                })
                .on("data", (data: Buffer) => (output += data.toString()))
                .stderr.on("data", (data: Buffer) => (error += data.toString()));
        });
    });
};

export const writeFile = async (path: string, content: string, host?: string) => {
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
