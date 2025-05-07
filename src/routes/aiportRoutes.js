import express from "express";
import * as aiportController from "../controllers/aiportController.js";

const router = express.Router();

router.get("/", aiportController.getAllAirports);

export default router;