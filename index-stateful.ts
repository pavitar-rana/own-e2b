// index-stateful.ts
import { createFirecrackerClient } from "./client.ts";
import { createId } from "@paralleldrive/cuid2";
import fs from "fs";
import type { clientType, IPConfig, VmConfigType } from "./lib/types.ts";
import {
    generateVmIp,
    HOST_GATEWAY_IP,
    macFromCuid,
    setupTapInterface,
} from "./lib/preVmConfig.ts";
import { setupSocket } from "./lib/vmConfigHelper.ts";
import {
    bootSetup,
    configSetup,
    startInstance,
} from "./lib/bootSetupHelper.ts";
import { attemptSSHConnection } from "./lib/connectSsh.ts";
import { createClient } from "redis";
import dotenv from "dotenv";
import { runCommand } from "./runCommand.ts";
import { execSync } from "node:child_process";
import path from "path";

dotenv.config();

const redisClient = await createClient()
    .on("error", (err) => console.log("Redis Client Error", err))
    .connect();

export const createFireCracker = async (config: VmConfigType) => {
    if (!config.kernelImage || !config.rootfsPath) {
        throw new Error("Missing kernelImage or rootfsPath in config");
    }

    const id = createId();
    console.log("Creating VM with ID: ", id);

    // Create per-VM rootfs copy to prevent filesystem corruption
    const vmRootfs = `/tmp/vm-${id}.ext4`;
    console.log(`📀 Creating VM-specific rootfs: ${vmRootfs}`);
    console.log(`   Copying from: ${config.rootfsPath}`);

    try {
        // Use cp for fast copy
        execSync(`cp "${config.rootfsPath}" "${vmRootfs}"`);
        console.log(`✅ Rootfs copy created successfully`);
    } catch (err) {
        console.error("Failed to create rootfs copy:", err);
        throw new Error("Failed to create VM rootfs");
    }

    const api_socket = `/tmp/firecracker-${id}.socket`;
    const client: clientType = createFirecrackerClient(api_socket);

    const vmIP = await generateVmIp();
    const tap = `tap_${id.slice(0, 8)}`;
    const mac = macFromCuid(id);

    if (!mac || !vmIP) {
        throw new Error("Cant generate mac address or VM IP");
    }

    const ipConfig: IPConfig = {
        vmIP: vmIP,
        hostIP: HOST_GATEWAY_IP,
        gateway: HOST_GATEWAY_IP,
        netmask: "255.255.255.0",
        nameservers: ["8.8.8.8", "8.8.4.4"],
    };

    console.log(`\n🌐 VM Network Configuration:`);
    console.log(`   VM IP:    ${ipConfig.vmIP}`);
    console.log(`   Host IP:  ${ipConfig.hostIP}`);
    console.log(`   Gateway:  ${ipConfig.gateway}`);
    console.log(`   TAP:      ${tap}`);
    console.log(`   MAC:      ${mac}\n`);

    await setupTapInterface(tap);
    await setupSocket(api_socket, id);

    // Boot -> config -> start (pass vmRootfs instead of base image)
    await bootSetup({
        ipConfig,
        client,
        config: { ...config, rootfsPath: vmRootfs }, // Use VM-specific rootfs
        mac,
        tap,
    });

    await configSetup(client, config);
    await startInstance(client);

    // wait for SSH
    const maxRetries = config.sshMaxRetries ?? 10;
    const baseDelay = config.sshBaseDelayMs ?? 1000;
    await attemptSSHConnection({
        maxRetries,
        baseDelay,
        vmIP,
    });

    return {
        id,
        vmIP,
        vmMac: mac,
        socket: api_socket,
        vcpuCount: config.vcpuCount,
        memSize: config.memSize,
        rootfsPath: vmRootfs, // Return this so we can delete it later
    };
};

export const deleteFireCracker = async (
    id: string,
    ip: string,
    rootfsPath?: string,
    projectId?: string,
) => {
    const api_socket = `/tmp/firecracker-${id}.socket`;
    const client: clientType = createFirecrackerClient(api_socket);

    console.log("Deleting VM with IP:", ip);

    // Disconnect SSH for this specific IP
    const { disconnect } = await import("./runCommand.ts");
    disconnect(ip);

    await redisClient.sRem("allocated_ips", ip);

    try {
        await client.put("/actions", { action_type: "SendCtrlAltDel" });
        await new Promise((r) => setTimeout(r, 2000)); // Wait for shutdown
    } catch (err) {
        console.error("CtrlAltDel failed:", err);
    }

    try {
        const key = "firecracker:list";
        let arr = JSON.parse(String(await redisClient.get(key)) || "[]");

        const idx = arr.findIndex((x) => x.api_socket === api_socket);
        if (idx !== -1) {
            const { pid } = arr[idx];

            try {
                process.kill(pid, "SIGKILL");
            } catch (err: any) {
                if (err.code !== "ESRCH") {
                    console.error("Error killing Firecracker PGID:", err);
                }
            }

            arr.splice(idx, 1);
            await redisClient.set(key, JSON.stringify(arr));
        }
    } catch (err) {
        console.error("Error removing Firecracker process:", err);
    }

    // Clean up socket file (needs sudo since firecracker was run with sudo)
    try {
        console.log(`🧹 Cleaning up socket: ${api_socket}`);
        execSync(`sudo rm -f ${api_socket}`);
    } catch (err: any) {
        console.error("Error removing socket:", err?.message || err);
        // Non-fatal, continue with cleanup
    }

    // Clean up VM-specific rootfs
    if (rootfsPath) {
        try {
            console.log(`🗑️  Deleting VM rootfs: ${rootfsPath}`);
            execSync(`rm -f ${rootfsPath}`);
            console.log(`✅ Rootfs deleted successfully`);
        } catch (err: any) {
            console.error("Error removing VM rootfs:", err?.message || err);
            // Non-fatal, continue
        }
    }

    // Clean up TAP interface
    const tap = `tap_${id.slice(0, 8)}`;
    try {
        console.log(`🧹 Cleaning up TAP interface: ${tap}`);
        execSync(`sudo ip link del ${tap} 2>/dev/null || true`);
    } catch (err: any) {
        console.error("Error removing TAP interface:", err?.message || err);
        // Non-fatal
    }

    console.log(`✅ VM ${id} cleanup completed`);
};

// (async () => {
//     const result = await createFireCracker({
//         kernelImage: "./vmlinux-6.1.141",
//         rootfsPath: "./ubuntu-nodejs.ext4",
//         tapInterface: "tap0",
//         memSize: 512,
//         vcpuCount: 2,
//     });

//     console.log("Result from creating cracker : ", result);

//     // const rwf = await writeFile("~/pavitar.txt", "HI this is my sdk");

//     // console.log("Write File resule : ", rwf);
//     const rs = await runCommand("uptime");
//     console.log("result of run command : ", rs);
//     const disk = await runCommand("df -h");
//     console.log("Disk usage:", disk);
//     // const wf = await writeFile("~/hello.txt", "HI from pavitar there");
//     // console.log("hi : ", wf);

//     const rgf = await runCommand("ls -la");
//     console.log("result get files : ", rgf);
//     const rcat = await runCommand("cat hello.txt");
//     console.log("result cat hello : ", rcat);
// })();
