import express from "express";
import * as flightController from "../controllers/flightController.js";

const router = express.Router();

router.get("/", flightController.getAllFlights);

export default router;