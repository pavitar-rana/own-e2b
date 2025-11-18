import { execSync } from "child_process";

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
