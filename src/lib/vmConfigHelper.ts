// vmConfigHelper.ts
import { exec, execSync, spawn } from "child_process";
import { delay } from "./delayHelper.ts";
import fs from "fs";
import { getRedisClient } from "../services/redis/index.ts";

const redisClient = await getRedisClient();

export const setupSocket = async (api_socket: string, id: string) => {
    const fc = spawn(
        "sudo",
        ["/home/pavitar/firecracker", "--api-sock", api_socket],
        {
            stdio: ["ignore", "inherit", "inherit"],
            detached: true,
        },
    );

    // detach so process continues if Node exits
    fc.unref();

    const pid = -fc.pid;

    const key = "firecracker:list";

    let arr = JSON.parse(String(await redisClient.get(key)) || String([]));

    if (!arr || arr.length === 0) {
        arr = [];
    }

    arr.push({ api_socket, pid });

    await redisClient.set(key, JSON.stringify(arr));

    // wait for socket to appear
    const maxWait = 5000;
    const interval = 100;
    const start = Date.now();
    while (Date.now() - start < maxWait) {
        if (fs.existsSync(api_socket)) break;
        await delay(interval);
    }

    if (!fs.existsSync(api_socket)) {
        throw new Error(`Firecracker API socket not created at ${api_socket}`);
    }

    try {
        execSync(`sudo chmod 666 "${api_socket}"`);
        console.log(`Fix socket permissions : ${api_socket}`);
    } catch (err) {
        console.error("Error fixing socket permissions:", err);
        throw err;
    }

    // done
    return;
};
