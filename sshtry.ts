import { readFileSync } from "fs";
import { Client } from "ssh2";

const conn = new Client();
conn.on("ready", () => {
    console.log("Client :: ready");
    // conn.exec(command, options, callback)
    conn.shell((err, stream) => {
        if (err) throw err;
        stream
            .on("close", () => {
                console.log("Stream :: close");
                conn.end();
            })
            .on("data", (data) => {
                console.log("OUTPUT: " + data);
            });
        stream.end(` echo "hi there" > ~/h.txt\nnode -v\nls -la\nexit\n`);
    });
})
    .on("error", (err) => {
        console.error("Connection error:", err.message);
        console.error(
            "Make sure the VM has your public key in ~/.ssh/authorized_keys",
        );
        console.error(
            "You can add it with: ssh-copy-id -i ~/.ssh/id_ed25519 root@172.16.0.2",
        );
    })
    .connect({
        host: "172.16.0.2",
        port: 22,
        username: "root",
        privateKey: readFileSync("/home/pavitar/.ssh/id_ed25519"),
        // algorithms: {
        //     serverHostKey: ["ssh-ed25519", "ecdsa-sha2-nistp256", "rsa-sha2-512", "rsa-sha2-256"],
        // },
        // tryKeyboard: true,
        // debug: (msg) => {
        //     if (msg.includes("USERAUTH") || msg.includes("publickey") || msg.includes("auth")) {
        //         console.log(msg);
        //     }
        // },
    });
