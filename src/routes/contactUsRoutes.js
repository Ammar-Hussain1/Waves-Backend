import express from "express";
import * as contactUsController from "../controllers/contactUsController.js";

const router = express.Router();

router.get("/", contactUsController.getAllContactUs);
router.post("/insert", contactUsController.insertContactUs);
router.patch('/:contactId/seen', contactUsController.updateContactSeen);

export default router;