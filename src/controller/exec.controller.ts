import type { RequestHandler } from "express";
import { attemptSSHConnection } from "../firecracker/index.ts";
import { prisma } from "../lib/prisma.ts";
import { createDir, runCommand, writeFile } from "../services/ssh/index.ts";

const runCommandController: RequestHandler = async (req, res) => {
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

    const result = await runCommand(command, vm.vmIp, finalPath);
    return res.json({
        result,
        id,
    });
};

const createDirController: RequestHandler = async (req, res) => {
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
};

const writeFileController: RequestHandler = async (req, res) => {
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

    const fullPath = `/root/${projectId}/${path}`.replace(/\/+/g, "/");
    console.log("writing files for  path : ", fullPath);

    const result = await writeFile(fullPath, content, vm.vmIp);

    return res.json({
        result,
        id,
    });
};

export { runCommandController, createDirController, writeFileController };
