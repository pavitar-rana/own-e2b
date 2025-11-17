import { createClient } from "redis";

let client: ReturnType<typeof createClient> | null = null;

export const getRedisClient = async () => {
    if (client && client.isOpen) return client;

    client = createClient();

    client.on("error", (err) => {
        console.error("Redis Client Error", err);
    });

    if (!client.isOpen) {
        await client.connect();
    }

    return client;
};
