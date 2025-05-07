import express from "express";
import passport from 'passport';
import * as userController from "../controllers/userController.js";

const router = express.Router();


router.post('/register', userController.registerUser);

router.post('/login', passport.authenticate('local'), (req, res) => {
  res.json({ message: 'Logged in successfully', user: req.user });
});

router.post('/logout', (req, res) => {
    req.logout(err => {
      if (err) return res.status(500).json({ error: 'Logout failed' });
      res.json({ message: 'Logged out successfully' });
    });
});

router.get('/me', (req, res) => {
    if (req.isAuthenticated()) {
      res.json(req.user);
    } else {
      res.status(401).json({ message: 'Not authenticated' });
    }
});
  

router.get("/", userController.getAllUsers);
router.get("/:id", userController.getUserById);
router.delete("/:id", userController.deleteUser);

export default router;