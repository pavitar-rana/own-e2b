// bootSetupHelper.ts
import { execSync } from "node:child_process";
import fs from "fs";
import path from "path";
import type { IPConfig, VmConfigType } from "./types.ts";

export const buildIpBootParam = (config: IPConfig): string => {
    const { vmIP, gateway, netmask } = config;
    // Firecracker kernel ip= format: ip=<IP>::<GATEWAY>:<NETMASK>::eth0:off
    return `${vmIP}::${gateway}:${netmask}::eth0:off`;
};

export const bootSetup = async ({
    client,
    config,
    mac,
    tap,
    ipConfig,
}: {
    client: any;
    config: VmConfigType;
    mac: string;
    tap: string;
    ipConfig: IPConfig;
}) => {
    const ipBootParam = buildIpBootParam(ipConfig);
    const bootArgs = ["console=ttyS0", "reboot=k", "panic=1", "pci=off", `ip=${ipBootParam}`, "root=/dev/vda rw"].join(
        " ",
    );

    console.log(`Boot args: ${bootArgs}\n`);

    // Use firecracker API: set boot source, drive and network interface
    await Promise.all([
        client.put("/boot-source", {
            kernel_image_path: config.kernelImage,
            boot_args: bootArgs,
        }),
        client.put("/drives/rootfs", {
            drive_id: "rootfs",
            path_on_host: config.rootfsPath,
            is_root_device: true,
            is_read_only: false,
        }),
        client.put("/network-interfaces/eth0", {
            iface_id: "eth0",
            guest_mac: mac,
            host_dev_name: tap,
        }),
    ]);
};

export const configSetup = async (client: any, config: VmConfigType) => {
    await client.put("/machine-config", {
        vcpu_count: config.vcpuCount ?? 1,
        mem_size_mib: config.memSize ?? 512,
    });
};

export const startInstance = async (client: any) => {
    const res = await client.put("/actions", {
        action_type: "InstanceStart",
    });
    console.log("Started VM : ", res);
};
