const userService = require("../services/user.service");

/**
 * Public customer/kiosk endpoints. These are unauthenticated, so `req.db` —
 * scoped by `resolveTenant` from the `:slug` in the URL — is the only isolation
 * boundary. Never call a service here without it.
 */

exports.loginTable = async (req, res) => {
  try {
    const result = await userService.loginTable(req.db, req.body);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.setAllergies = async (req, res) => {
  try {
    const result = await userService.setAllergies(req.db, req.body);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.getMenu = async (req, res) => {
  try {
    const result = await userService.getMenu(req.db);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/** Public tenant identity for the kiosk/customer shell (name, branding, table count). */
exports.getRestaurantInfo = async (req, res) => {
  try {
    const tables = await req.db.Table.countDocuments();
    res.status(200).json({ ...req.restaurant.toPublicJSON(), tableCount: tables });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getTableSession = async (req, res) => {
  try {
    const result = await userService.getTableSession(req.db, Number(req.params.tableNo));
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

/** Quick table entry: returns JSON for API callers, redirects browser document requests to customer menu. */
exports.selectTableQuickBrowse = async (req, res) => {
  try {
    const result = await userService.selectTableQuickBrowse(req.db, Number(req.params.tableNo));
    const base = process.env.CUSTOMER_APP_ORIGIN || process.env.FRONTEND_URL;
    const isDocRequest = req.get("sec-fetch-dest") === "document";
    const wantsRedirect = req.query.redirect === "1" || (req.query.redirect == null && isDocRequest);
    if (wantsRedirect) {
      // entryPath is tenant-RELATIVE (e.g. "/customer/menu?..."), matching what
      // the frontend's own tenant-aware navigate() expects when the JSON body is
      // used instead. Building an absolute redirect here — which bypasses that
      // client-side prefixing — must add /r/:slug itself, exactly once.
      const path = `/r/${req.restaurant.slug}${result.entryPath}`;
      const url = base ? `${String(base).replace(/\/$/, "")}${path}` : path;
      return res.redirect(302, url);
    }
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.orderFood = async (req, res) => {
  try {
    const result = await userService.orderFood(req.db, req.body);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.confirmOrder = async (req, res) => {
  try {
    const result = await userService.confirmOrder(req.db, req.body);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.getTableOrders = async (req, res) => {
  try {
    const result = await userService.getTableOrders(req.db, Number(req.params.tableNo));
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.callWaiter = async (req, res) => {
  try {
    const result = await userService.callWaiter(req.db, req.body);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.completeMeal = async (req, res) => {
  try {
    const result = await userService.completeMeal(req.db, req.body);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.submitReview = async (req, res) => {
  try {
    const result = await userService.submitReview(req.db, req.body);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.clearTable = async (req, res) => {
  try {
    const result = await userService.clearTable(req.db, req.body);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
