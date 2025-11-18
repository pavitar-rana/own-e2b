import type { RequestHandler } from "express";
import { createFireCracker, deleteFireCracker } from "../firecracker/index.ts";
import { prisma } from "../lib/prisma.ts";
import { VM_TO_HOST_PORT } from "../lib/constants.ts";

const createFireCrackerController: RequestHandler = async (req, res) => {
    try {
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
    } catch (e) {
        return res.json({
            success: false,
            message: "Internal server error",
        });
    }
};

const deleteFireCrackerController: RequestHandler = async (req, res) => {
    try {
        const { id, userId } = req.body;

        if (!id || !userId) {
            return res.json({
                message: "Id and userId is required",
            });
        }

        const vm = await prisma.virtualmachine.delete({
            where: {
                id: id,
                userId: userId,
            },
        });

        console.log("vmip to del : ", vm.vmIp);

        await deleteFireCracker(id, vm.vmIp, vm.rootfsPath);

        return res.json({
            success: true,
            message: "Deleted Vm",
        });
    } catch (e) {
        console.error("Error deleting vm : ", e);

        return res.json({
            success: false,
            message: "Error deleing Vm",
        });
    }
};
const hostFireCrackerController: RequestHandler = async (req, res) => {
    try {
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
            success: true,
            messgae: "Got url",
            url,
        });
    } catch (e) {
        return res.json({
            success: false,
            messgae: "Internal Server Error",
        });
    }
};

export {
    createFireCrackerController,
    deleteFireCrackerController,
    hostFireCrackerController,
};
