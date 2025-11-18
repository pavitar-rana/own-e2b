import { Router } from "express";
import {
    createDirController,
    runCommandController,
    writeFileController,
} from "../controller/exec.controller.ts";

const router = Router();

router.post("/run", runCommandController);
router.post("/create-dir", createDirController);
router.post("/write", writeFileController);

export default router;
