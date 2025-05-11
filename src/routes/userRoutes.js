import express from "express";
import passport from 'passport';
import * as userController from "../controllers/userController.js";
import { ensureAuthenticated, ensureAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();


router.post('/register', userController.registerUser);

router.post('/login', (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
      if (err) {
        return next(err);
      }

      if (!user) {
        return res.status(401).json({ error: info?.message || 'Invalid email or password' });
      }

      req.logIn(user, (err) => {
        if (err) {
          return next(err);
        }
        return res.json({ message: 'Logged in successfully', user });
      });
    })(req, res, next);
  }
);

router.get("/admin-data", ensureAdmin, userController.getAllUsers);
router.get("/me", ensureAuthenticated, (req, res) => {
  res.json(req.user);
});

router.post('/logout', (req, res) => {
    req.logout(err => {
      if (err) return res.status(500).json({ error: 'Logout failed' });
      res.json({ message: 'Logged out successfully' });
    });
});  

router.get("/", userController.getAllUsers);
router.get("/:id", userController.getUserById);
router.delete("/:id", userController.deleteUser);

export default router;