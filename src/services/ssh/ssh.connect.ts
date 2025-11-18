import { readFileSync } from "fs";
import { Client } from "ssh2";
import { connections } from "./index.ts";

export const connectSSH = (host: string) => {
    return new Promise((resolve, reject) => {
        if (!host) return reject("Host not provided");

        const existing = connections.get(host);
        if (existing && existing.isReady) {
            console.log(`Reusing existing SSH connection to ${host}`);
            return resolve(existing.conn);
        }

        console.log(`Creating new SSH connection to ${host}`);
        const conn = new Client();

        connections.set(host, { conn, isReady: false });

        conn.removeAllListeners();

        conn.on("ready", () => {
            console.log(`SSH Client ready for ${host}`);
            const entry = connections.get(host);
            if (entry) {
                entry.isReady = true;
            }
            resolve(conn);
        })
            .on("error", (err) => {
                console.error(`SSH Connection error for ${host}:`, err.message);
                connections.delete(host);
                reject(new Error(`Failed to connect to SSH: ${err.message}`));
            })
            .on("close", () => {
                console.log(`SSH connection closed for ${host}`);
                connections.delete(host);
            })
            .connect({
                host,
                port: 22,
                username: "root",
                privateKey: readFileSync("/home/pavitar/.ssh/id_rsa"),
                readyTimeout: 30000,
            });
    });
};

export const disconnectSSH = (host?: string) => {
    if (host) {
        const entry = connections.get(host);
        if (entry && entry.isReady) {
            entry.conn.end();
            connections.delete(host);
            console.log(`SSH disconnected from ${host}`);
        }
    } else {
        for (const [host, entry] of connections.entries()) {
            if (entry.isReady) {
                entry.conn.end();
            }
        }
        connections.clear();
        console.log("All SSH connections disconnected");
    }
};
