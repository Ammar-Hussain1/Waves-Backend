import express from "express";
import * as seatsController from "../controllers/seatsController.js";

const router = express.Router();

router.post("/getSeats", seatsController.getSeats);
router.post("/bookSeat", seatsController.bookSeat);
router.post("/bookSeatRoundTrip", seatsController.bookSeatRoundTrip);


export default router;