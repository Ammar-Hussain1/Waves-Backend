import express from "express";
import * as refundsController from "../controllers/refundsController.js";

const router = express.Router();

router.get("/", refundsController.getAllRefunds);
router.get("/Processing", refundsController.getAllProcessingRefunds);
router.get("/Rejected", refundsController.getAllRejectedRefunds);
router.get("/Completed", refundsController.getAllCompletedRefunds);
router.patch('/:refundId/:status', refundsController.updateRefundStatus);
router.post("/applyRefund", refundsController.createRefund);
router.post("/getAllBookings", refundsController.getAllBookings);
router.post("/user-refund-status", refundsController.getAllRefundsForUser);

export default router;