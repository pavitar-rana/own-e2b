import { createId } from "@paralleldrive/cuid2";
import { execSync } from "child_process";
import {
    generateVmIp,
    macFromCuid,
    HOST_GATEWAY_IP,
    setupTapInterface,
    setupSocket,
    attemptSSHConnection,
    bootSetup,
    configSetup,
    startInstance,
} from "../firecracker/index.ts";
import type { VmConfigType, clientType, IPConfig } from "../lib/types.ts";
import { createFirecrackerClient } from "./index.ts";

export const createFireCracker = async (config: VmConfigType) => {
    if (!config.kernelImage || !config.rootfsPath) {
        throw new Error("Missing kernelImage or rootfsPath in config");
    }

    const id = createId();
    console.log("Creating VM with ID: ", id);

    const vmRootfs = `/tmp/vm-${id}.ext4`;
    console.log(`Creating VM-specific rootfs: ${vmRootfs}`);
    console.log(`Copying from: ${config.rootfsPath}`);

    try {
        // Use cp for fast copy
        execSync(`cp "${config.rootfsPath}" "${vmRootfs}"`);
        console.log(`Rootfs copy created successfully`);
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

    console.log(`\n VM Network Configuration:`);
    console.log(`   VM IP:    ${ipConfig.vmIP}`);
    console.log(`   Host IP:  ${ipConfig.hostIP}`);
    console.log(`   Gateway:  ${ipConfig.gateway}`);
    console.log(`   TAP:      ${tap}`);
    console.log(`   MAC:      ${mac}\n`);

    await setupTapInterface(tap);
    await setupSocket(api_socket, id);

    await bootSetup({
        ipConfig,
        client,
        config: { ...config, rootfsPath: vmRootfs },
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
        rootfsPath: vmRootfs,
    };
};
