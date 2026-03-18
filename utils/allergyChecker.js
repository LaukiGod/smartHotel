exports.checkAllergyRisk = (userAllergies = [], ingredientNames = []) => {
  if (!userAllergies.length || !ingredientNames.length) {
    return { alert: false, matches: [] };
  }

  const allergies = userAllergies.map(a => a.trim().toLowerCase());
  const ingredients = ingredientNames.map(i => i.trim().toLowerCase());

  const matches = [];

  for (const allergy of allergies) {
    for (const ingredient of ingredients) {
      if (ingredient.includes(allergy)) {
        matches.push({ allergy, ingredient });
      }
    }
  }

  return {
    alert: matches.length > 0,
    matches  // e.g. [{ allergy: "nut", ingredient: "peanut" }, ...]
  };
};