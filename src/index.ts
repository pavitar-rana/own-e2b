import express from "express";
import { execRoute, vmRoute } from "./routes/index.ts";
import cors from "cors";

const app = express();

app.use(express.json());

app.use(cors());
app.use("/firecracker", vmRoute);
app.use("/firecracker/exec", execRoute);

app.listen(8080, "0.0.0.0", () => {
    console.log("Server running on port : 8080");
});
