import express from "express";
import * as seatsController from "../controllers/seatsController.js";

const router = express.Router();

router.post("/getSeats", seatsController.getSeats);
router.patch("/bookSeat/:flightId/:SeatID", seatsController.bookSeat);


export default router;