import { Client } from "ssh2";

type sshCon = {
    conn: Client;
    isReady: boolean;
};

export const connections = new Map<string, sshCon>();
