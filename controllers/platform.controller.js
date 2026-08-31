const platformService = require("../services/platform.service");

const handle = (fn, okStatus = 200, errStatus = 400) => async (req, res) => {
  try {
    const result = await fn(req);
    res.status(okStatus).json(result);
  } catch (error) {
    res.status(errStatus).json({ message: error.message });
  }
};

exports.listRestaurants = handle((req) => platformService.listRestaurants(req), 200, 500);
exports.getRestaurant = handle((req) => platformService.getRestaurant(req.params.id), 200, 404);
exports.createRestaurant = handle((req) => platformService.createRestaurant(req.body), 201, 400);
exports.updateRestaurant = handle((req) => platformService.updateRestaurant(req.params.id, req.body));
exports.setRestaurantStatus = handle((req) =>
  platformService.setRestaurantStatus(req.params.id, req.body?.status)
);
exports.deleteRestaurant = handle((req) =>
  platformService.deleteRestaurant(req.params.id, req.body?.confirmSlug)
);
exports.stats = handle(() => platformService.platformStats(), 200, 500);
exports.addSuperAdmin = handle((req) => platformService.addSuperAdmin(req.body), 201, 400);
exports.listSuperAdmins = handle(() => platformService.listSuperAdmins(), 200, 500);

exports.me = (req, res) => res.json(req.staff);
