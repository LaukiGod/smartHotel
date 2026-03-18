const User = require("../entities/user.entity");
const Table = require("../entities/table.entity");
const Order = require("../entities/order.entity");
const Dish = require("../entities/dish.entity");
const { checkAllergyRisk } = require("../utils/allergyChecker");
const { isTableValid } = require("../utils/helpers");

exports.loginTable = async (data) => {
  const { tableNo, name, phoneNo } = data;

  if (tableNo === undefined || isTableValid(tableNo) === false) {
    throw new Error("Invalid table number");
  }

  if (!name) {
    throw new Error("Name is required");
  }

  if (!phoneNo) {
    throw new Error("Phone number is required");
  }

  let table = await Table.findOne({ tableNo });

  if (!table) {
    table = await Table.create({ tableNo });
  }

  if (table.status === "occupied") {
    throw new Error("Table already occupied");
  }

  const user = await User.create({
    tableNo,
    name,
    phoneNo,
    role: "user",
  });

  table.status = "occupied";
  table.currentUser = user._id;
  await table.save();

  return { message: "Table session started", user };
};

exports.setAllergies = async (data) => {
  const { tableNo, allergies } = data;

  // [Added] Basic validation
  if (!tableNo) throw new Error("tableNo is required");
  if (!Array.isArray(allergies)) throw new Error("allergies must be an array");

  const session = await mongoose.startSession(); // [Added] start session
  session.startTransaction(); // [Added]

  try {
    const currentTable = await Table.findOneAndUpdate(
      { tableNo },
      { allergyAlert: allergies.length > 0 },
      {
        new: true,
        projection: { currentUser: 1 }, // [Added] fetch only needed field
        session // [Added]
      }
    );

    if (!currentTable) {
      throw new Error("Table not found");
    }

    if (!currentTable.currentUser) { // [Added] safety check
      throw new Error("No user assigned to this table");
    }

    const updatedUser = await User.findByIdAndUpdate(
      currentTable.currentUser,
      { allergies },
      { new: true, session } // [Added]
    );

    if (!updatedUser) {
      throw new Error("User not found");
    }

    await session.commitTransaction(); // [Added]
    session.endSession(); // [Added]

    return {
      message: "Allergies updated successfully",
      user: updatedUser // [Added] useful response
    };

  } catch (error) {
    await session.abortTransaction(); // [Added]
    session.endSession(); // [Added]
    throw error; // [Modified] let controller handle it
  }
};

exports.getMenu = async () => {
  const dishes = await Dish.find();
  return dishes;
};

exports.orderFood = async (data) => {
  const { tableNo, dishes } = data;

  // Populate currentUser to access their allergies
  const table = await Table.findOne({ tableNo }).populate("currentUser");
  if (!table) {
    throw new Error(`Table ${tableNo} not found`);
  }

  // Fetch dishes — ingredients is [String], so no populate needed
  const dishDocs = await Dish.find({ _id: { $in: dishes } });
  if (dishDocs.length !== dishes.length) {
    throw new Error("One or more dishes not found");
  }

  // Collect all ingredient names
  const ingredientNames = dishDocs.flatMap(dish => dish.ingredients);

  // Get allergies from populated user — default to [] if none
  const allergiesInput = table.currentUser?.allergies || [];
  console.log("User allergies:", allergiesInput);

  // Check allergy risk — always run so allergyResult is always defined
  const allergyResult = checkAllergyRisk(allergiesInput, ingredientNames);

  if (allergyResult.alert) {
    console.warn("Allergy alert for table", tableNo, "matches:", allergyResult.matches);
  }

  // Create order
  const order = await Order.create({
    tableNo,
    dishes,
    allergiesInput,
    allergyAlert: allergyResult.alert
  });

  // Mark table as occupied
  await Table.findOneAndUpdate({ tableNo }, { status: "occupied" });

  return {
    message: "Order placed",
    allergyAlert: allergyResult.alert,
    allergyMatches: allergyResult.matches,
    order
  };
};

exports.clearTable = async (data) => {
  const { tableNo } = data;

  const table = await Table.findOne({ tableNo });

  if (!table) throw new Error("Table not found");

  table.status = "free";
  table.currentUser = null;

  await table.save();

  return { message: "Table cleared" };
};