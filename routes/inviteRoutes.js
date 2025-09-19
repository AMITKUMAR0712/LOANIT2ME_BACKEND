import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { getInvite, acceptInvite } from "../controllers/inviteController.js";

const router = express.Router();

// Public route to get invite details
router.get("/:token", getInvite);

// Route to accept an invite
router.post("/accept", acceptInvite);

export default router;