export type clientType = {
    put: <T>(path: string, data: any) => Promise<T>;
    get: <T>(path: string) => Promise<T>;
};
export type VmConfigType = {
    kernelImage: string;
    rootfsPath: string;
    memSize?: number;
    vcpuCount?: number;
    sshBaseDelayMs?: number;
    sshMaxRetries?: number;
    // macAddr: string;
};

export type IPConfig = {
    vmIP: string;
    hostIP: string;
    gateway: string;
    netmask: string;
    nameservers: string[];
};
