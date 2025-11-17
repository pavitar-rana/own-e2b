import type { IPConfig, VmConfigType } from "../lib/types.ts";

export const buildIpBootParam = (config: IPConfig): string => {
    const { vmIP, gateway, netmask } = config;
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
    const bootArgs = [
        "console=ttyS0",
        "reboot=k",
        "panic=1",
        "pci=off",
        `ip=${ipBootParam}`,
        "root=/dev/vda rw",
    ].join(" ");

    console.log(`Boot args: ${bootArgs}\n`);

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

export const startInstance = async (client: any) => {
    const res = await client.put("/actions", {
        action_type: "InstanceStart",
    });
    console.log("Started VM : ", res);
};
