exports.checkAllergyRisk = (userAllergies = [], ingredientNames = []) => {
  const allergies = userAllergies.map(a => a.toLowerCase());
  const ingredients = ingredientNames.map(i => i.toLowerCase());

  for (let allergy of allergies) {
    for (let ingredient of ingredients) {
      if (ingredient.includes(allergy)) {
        return {
          alert: true,
          matched: allergy,
          ingredient
        };
      }
    }
  }

  return {
    alert: false
  };
};