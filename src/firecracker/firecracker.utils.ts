import { getRedisClient } from "../services/redis/index.ts";
import crypto from "crypto";

const redisClient = await getRedisClient();

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
