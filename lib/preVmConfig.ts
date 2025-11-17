//  preVmConfig.ts
import { execSync } from "child_process";
import crypto from "crypto";
import { createClient } from "redis";

const redisClient = await createClient()
    .on("error", (err) => console.log("Redis Client Error", err))
    .connect();

export const generateVmIp = async () => {
    for (let i = 2; i < 255; i++) {
        const ip = `172.16.0.${i}`;
        const isAllocated = await redisClient.sIsMember("allocated_ips", ip);
        if (!isAllocated) {
            await redisClient.sAdd("allocated_ips", ip);
            return ip;
        }
    }
    throw new Error("No available IPs in the 172.16.0.0/24 range");
};

export const HOST_GATEWAY_IP = "172.16.0.1";

export const macFromCuid = (cuid: string) => {
    const hash = crypto.createHash("sha1").update(cuid).digest();
    const mac = Buffer.alloc(6);
    hash.copy(mac, 0, 0, 6);
    mac[0] = (mac[0] & 0xfe) | 0x02;

    return [...mac].map((b) => b.toString(16).padStart(2, "0")).join(":");
};

export const setupTapInterface = async (tap: string): Promise<void> => {
    execSync(`sudo ip link show br0 || sudo ip link add name br0 type bridge`);
    execSync(`sudo ip addr add 172.16.0.1/24 dev br0 2>/dev/null || true`);
    execSync(`sudo ip link set br0 up`);

    execSync(`sudo ip link del ${tap} 2>/dev/null || true`);
    execSync(`sudo ip tuntap add dev ${tap} mode tap user $(whoami)`);
    execSync(`sudo ip link set ${tap} master br0`);
    execSync(`sudo ip link set ${tap} up`);

    execSync(`sudo sysctl -w net.ipv4.ip_forward=1`);

    execSync(
        `sudo iptables -t nat -C POSTROUTING -o eth0 -j MASQUERADE 2>/dev/null || sudo iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE`,
    );
    execSync(`sudo iptables -C FORWARD -i br0 -j ACCEPT 2>/dev/null || sudo iptables -A FORWARD -i br0 -j ACCEPT`);
    execSync(`sudo iptables -C FORWARD -o br0 -j ACCEPT 2>/dev/null || sudo iptables -A FORWARD -o br0 -j ACCEPT`);
};
