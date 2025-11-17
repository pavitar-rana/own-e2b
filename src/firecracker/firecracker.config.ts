import type { VmConfigType } from "../lib/types.ts";

export const configSetup = async (client: any, config: VmConfigType) => {
    await client.put("/machine-config", {
        vcpu_count: config.vcpuCount ?? 1,
        mem_size_mib: config.memSize ?? 512,
    });
};
