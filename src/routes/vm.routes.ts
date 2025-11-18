import { Router } from "express";
import {
    createFireCrackerController,
    deleteFireCrackerController,
    hostFireCrackerController,
} from "../controller/createVM.controller.ts";

const router = Router();

router.post("/create", createFireCrackerController);
router.post("/delete", deleteFireCrackerController);
router.post("/get-host", hostFireCrackerController);

export default router;
