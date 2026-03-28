const validateSecret = (req, res, next) => {
  const secret = req.headers['x-restaurant-secret']

  if (!secret || secret !== process.env.RESTAURANT_SECRET) {
    return res.status(403).json({ message: 'Unauthorized: Invalid or missing secret' })
  }

  next()
}

module.exports = { validateSecret }