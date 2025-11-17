// index.ts

import dotenv from "dotenv";
dotenv.config();

import express from "express";
import { createFireCracker, deleteFireCracker } from "./firecracker/index.ts";

import { attemptSSHConnection } from "./lib/connectSSH.ts";
import { createDir, runCommand, writeFile } from "./services/ssh/index.ts";
import { prisma } from "./lib/prisma.ts";
import cors from "cors";
import { VM_TO_HOST_PORT } from "./lib/constants.ts";

const app = express();
app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {
    return res.json({
        message: "Hi from firecracker wraper",
    });
});

app.post("/create", async (req, res) => {
    const { userId, config } = req.body;

    if (!userId) {
        return res.json({
            message: "userId is required",
            error: "userId is required",
        });
    }
    const sbx = await createFireCracker({
        kernelImage: "/home/pavitar/vmlinux-6.1.141",
        rootfsPath: "/home/pavitar/ubuntu-1.5G.ext4",
        memSize: 512,
        vcpuCount: 1,
    });

    if (!sbx.vmIP) {
        return res.json({
            message: "Failed to Create VM",
            error: "Failed to Create VM",
        });
    }

    const vm = await prisma.virtualmachine.create({
        data: {
            id: sbx.id,
            vcpuCount: sbx.vcpuCount,
            memSize: sbx.memSize,
            userId,
            vmMac: sbx.vmMac,
            vmIp: sbx.vmIP,
            status: "running",
            socket: sbx.socket,
            rootfsPath: sbx.rootfsPath,
        },
    });

    if (!vm) {
        return res.json({
            message: "Failed to Create VM",
            error: "Failed to Create VM",
        });
    }

    return res.json({
        vmIp: sbx.vmIP,
        mac: sbx.vmMac,
        id: sbx.id,
        socker: sbx.socket,
        message: "Success Creating sbx",
    });
});

app.post("/run", async (req, res) => {
    const { id, command, projectId, path, userId } = req.body;

    console.log("run command things  : ", {
        id,
        command,
        projectId,
        path,
        userId,
    });

    if (!id || !command || !projectId || !userId) {
        return res.json({
            message: "Id is required",
        });
    }

    const vm = await prisma.virtualmachine.findUnique({
        where: {
            id,
            userId,
        },
    });

    if (!vm) {
        return res.status(404).json({
            message: "VM not found",
        });
    }

    await attemptSSHConnection({
        vmIP: vm.vmIp,
        maxRetries: 10,
        baseDelay: 1000,
    });

    // await new Promise((r) => setTimeout(r, 1000));
    const finalPath =
        typeof path === "string" && path.trim() !== ""
            ? path
            : `/root/${projectId}/`;

    console.log("final path to run command on : ", finalPath);

    const result = await runCommand(command, finalPath, vm.vmIp);
    return res.json({
        result,
        id,
    });
});

app.post("/create-dir", async (req, res) => {
    const { path, userId, id } = req.body;

    if (!path || !userId || !id) {
        return res.status(404).json({
            message: "All params needed",
        });
    }

    const vm = await prisma.virtualmachine.findUnique({
        where: {
            id,
            userId,
        },
    });

    if (!vm) {
        return res.status(404).json({
            message: "VM not found",
        });
    }

    console.log("creating Directory for path : ", path);

    await createDir(path, vm.vmIp);

    return res.json({
        message: "Directory created",
    });
});

app.post("/get-host", async (req, res) => {
    const { userId, ip, id } = req.body;
    if (!id || !ip || !userId) {
        return res.json({
            message: "Id is required",
        });
    }

    const vm = await prisma.virtualmachine.findUnique({
        where: {
            id,
            userId,
        },
    });

    if (!vm) {
        return res.status(404).json({
            message: "Vm not found",
        });
    }

    const port = VM_TO_HOST_PORT[ip];

    const url = `http://34.158.50.146:${port}`;

    return res.json({
        messgae: "Got url",
        url,
    });
});

app.post("/write", async (req, res) => {
    const { id, path, content, projectId, userId } = req.body;

    if (!id || !path || !content || !projectId || !userId) {
        return res.json({
            message: "Id is required",
        });
    }

    const vm = await prisma.virtualmachine.findUnique({
        where: {
            id,
            userId,
        },
    });

    if (!vm) {
        return res.status(404).json({
            message: "Vm not found",
        });
    }

    console.log("writing files for  user: ", userId);

    await attemptSSHConnection({
        vmIP: vm.vmIp,
        maxRetries: 10,
        baseDelay: 1000,
    });

    // await new Promise((r) => setTimeout(r, 1000));

    // const result = await runCommand(command);
    // Join the path properly to ensure it's under /root/{projectId}
    const fullPath = `/root/${projectId}/${path}`.replace(/\/+/g, "/");
    console.log("writing files for  path : ", fullPath);

    const result = await writeFile(fullPath, content, vm.vmIp);

    return res.json({
        result,
        id,
    });
});

app.post("/delete", async (req, res) => {
    const { id, userId } = req.body;

    if (!id || !userId) {
        return res.json({
            message: "Id and userId is required",
        });
    }

    try {
        const vm = await prisma.virtualmachine.delete({
            where: {
                id: id,
                userId: userId,
            },
        });

        console.log("vmip to del : ", vm.vmIp);

        await deleteFireCracker(id, vm.vmIp, vm.rootfsPath);

        return res.json({
            message: "Deleted Vm",
        });
    } catch (e) {
        console.error("Error deleting vm : ", e);

        return res.json({
            message: "Error deleing Vm",
        });
    }
});

app.listen(8080, "0.0.0.0", () => {
    console.log("Server running on port : 8080");
});
