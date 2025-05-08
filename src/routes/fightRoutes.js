import express from "express";
import * as flightController from "../controllers/flightController.js";

const router = express.Router();

router.get("/", flightController.getAllFlights);
router.post("/createFlight", flightController.createFlight);
router.post("/searchFlight", flightController.searchFlight);

export default router;