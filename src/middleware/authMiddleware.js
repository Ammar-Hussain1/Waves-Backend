export const ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ message: "Not authenticated" });
};

export const ensureAdmin = (req, res, next) => {
  if (req.isAuthenticated() && req.user.UserType === 'Admin') return next();
  res.status(403).json({ message: "Admins only" });
};