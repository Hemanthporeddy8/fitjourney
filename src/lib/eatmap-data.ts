
export interface FoodItem {
  id: string;
  emoji: string;
  name: string;
}

export interface FoodFamily {
  familyName: string;
  items: FoodItem[];
}

export interface FoodItemCategory {
  categoryId: string;
  categoryName: string; // Includes emoji for the main category
  families: FoodFamily[];
}

export const foodItemCategoriesData: FoodItemCategory[] = [
  {
    categoryId: 'fruits_main',
    categoryName: ' Fruits',
    families: [
      {
        familyName: 'Berries',
        items: [
          { id: 'strawberry_item', emoji: '', name: 'Strawberry' },
          { id: 'blueberry_item', emoji: '', name: 'Blueberry' },
          { id: 'raspberry_item', emoji: '', name: 'Raspberry' }, // Using strawberry emoji as generic berry
          { id: 'blackberry_item', emoji: '', name: 'Blackberry' }, // Using blueberry as generic dark berry
          { id: 'cranberry_item', emoji: '', name: 'Cranberry' },
          { id: 'gooseberry_item', emoji: '', name: 'Gooseberry' },
        ],
      },
      {
        familyName: 'Citrus Fruits',
        items: [
          { id: 'orange_item', emoji: '', name: 'Orange' },
          { id: 'lemon_item', emoji: '', name: 'Lemon' },
          { id: 'lime_item', emoji: '', name: 'Lime' }, // Using lemon emoji for lime
          { id: 'grapefruit_item', emoji: '', name: 'Grapefruit' }, // Using orange emoji
          { id: 'tangerine_item', emoji: '', name: 'Tangerine' },
          { id: 'pomelo_item', emoji: '', name: 'Pomelo' },
        ],
      },
      {
        familyName: 'Stone Fruits (Drupes)',
        items: [
          { id: 'peach_item', emoji: '', name: 'Peach' },
          { id: 'plum_item', emoji: '', name: 'Plum' }, // Using peach emoji
          { id: 'cherry_item', emoji: '', name: 'Cherry' },
          { id: 'apricot_item', emoji: '', name: 'Apricot' },
          { id: 'nectarine_item', emoji: '', name: 'Nectarine' },
          { id: 'mango_item_fruit', emoji: '', name: 'Mango' },
        ],
      },
      {
        familyName: 'Pome Fruits',
        items: [
          { id: 'apple_item', emoji: '', name: 'Apple' },
          { id: 'pear_item', emoji: '', name: 'Pear' },
          { id: 'quince_item', emoji: '', name: 'Quince' },
        ],
      },
      {
        familyName: 'Tropical Fruits',
        items: [
          { id: 'banana_item', emoji: '', name: 'Banana' },
          { id: 'papaya_item', emoji: '', name: 'Papaya' }, // Using mango emoji as general tropical
          { id: 'pineapple_item', emoji: '', name: 'Pineapple' },
          { id: 'coconut_item', emoji: '', name: 'Coconut' },
          { id: 'guava_item', emoji: '', name: 'Guava' }, // Using melon as generic
          { id: 'passionfruit_item', emoji: '', name: 'Passionfruit' },
        ],
      },
      {
        familyName: 'Melons',
        items: [
          { id: 'watermelon_item', emoji: '', name: 'Watermelon' },
          { id: 'cantaloupe_item', emoji: '', name: 'Cantaloupe' },
          { id: 'honeydew_item', emoji: '', name: 'Honeydew' },
        ],
      },
      {
        familyName: 'Figs, Mulberries & More',
        items: [
          { id: 'fig_item', emoji: '', name: 'Fig' }, // Using grape as generic
          { id: 'mulberry_item', emoji: '', name: 'Mulberry' },
          { id: 'breadfruit_item', emoji: '', name: 'Breadfruit' },
          { id: 'jackfruit_item', emoji: '', name: 'Jackfruit' },
        ],
      },
      {
        familyName: 'Grapes & Vine Fruits',
        items: [
          { id: 'grape_item', emoji: '', name: 'Grape' },
          { id: 'kiwi_item', emoji: '', name: 'Kiwi' },
          { id: 'currants_item', emoji: '', name: 'Currants' },
        ],
      },
      {
        familyName: 'Exotic & Specialty Fruits',
        items: [
          { id: 'dragonfruit_item', emoji: '', name: 'Dragonfruit' },
          { id: 'starfruit_item', emoji: '', name: 'Starfruit' },
          { id: 'lychee_item', emoji: '', name: 'Lychee' },
          { id: 'longan_item', emoji: '', name: 'Longan' },
          { id: 'durian_item', emoji: '', name: 'Durian' },
        ],
      },
    ],
  },
  {
    categoryId: 'vegetables_main',
    categoryName: ' Vegetables',
    families: [
      {
        familyName: 'Root Vegetables',
        items: [
          { id: 'carrot_item', emoji: '', name: 'Carrot' },
          { id: 'beetroot_item', emoji: '', name: 'Beetroot' },
          { id: 'radish_item_veg_root', emoji: '', name: 'Radish' },
          { id: 'turnip_item', emoji: '', name: 'Turnip' },
          { id: 'parsnip_item', emoji: '', name: 'Parsnip' },
          { id: 'sweet_potato_item', emoji: '', name: 'Sweet Potato' },
          { id: 'yam_item', emoji: '', name: 'Yam' },
        ],
      },
      {
        familyName: 'Tuber Vegetables',
        items: [
          { id: 'potato_item', emoji: '', name: 'Potato' },
          { id: 'cassava_item', emoji: '', name: 'Cassava' },
          { id: 'jerusalem_artichoke_item', emoji: '', name: 'Jerusalem Artichoke' },
        ],
      },
      {
        familyName: 'Bulb Vegetables',
        items: [
          { id: 'onion_item', emoji: '', name: 'Onion' },
          { id: 'garlic_item', emoji: '', name: 'Garlic' },
          { id: 'leek_item', emoji: '', name: 'Leek' },
          { id: 'shallot_item', emoji: '', name: 'Shallot' },
          { id: 'spring_onion_item', emoji: '', name: 'Spring Onion' },
        ],
      },
      {
        familyName: 'Leafy Vegetables',
        items: [
          { id: 'spinach_item', emoji: '', name: 'Spinach' },
          { id: 'kale_item', emoji: '', name: 'Kale' },
          { id: 'lettuce_item', emoji: '', name: 'Lettuce' },
          { id: 'swiss_chard_item', emoji: '', name: 'Swiss Chard' },
          { id: 'cabbage_item_leafy', emoji: '', name: 'Cabbage' },
          { id: 'mustard_greens_item', emoji: '', name: 'Mustard Greens' },
          { id: 'collard_greens_item', emoji: '', name: 'Collard Greens' },
        ],
      },
      {
        familyName: 'Cruciferous (Brassica) Vegetables',
        items: [
          { id: 'broccoli_item', emoji: '', name: 'Broccoli' },
          { id: 'cauliflower_item', emoji: '', name: 'Cauliflower' },
          { id: 'brussels_sprouts_item', emoji: '', name: 'Brussels Sprouts' },
          { id: 'bok_choy_item', emoji: '', name: 'Bok Choy' },
          { id: 'arugula_item', emoji: '', name: 'Arugula' },
          { id: 'radish_item_veg_cruc', emoji: '', name: 'Radish (also root)' },
        ],
      },
      {
        familyName: 'Stem Vegetables',
        items: [
          { id: 'asparagus_item', emoji: '', name: 'Asparagus' },
          { id: 'celery_item', emoji: '', name: 'Celery' },
          { id: 'kohlrabi_item', emoji: '', name: 'Kohlrabi' },
        ],
      },
      {
        familyName: 'Gourd & Squash Family',
        items: [
          { id: 'cucumber_item', emoji: '', name: 'Cucumber' },
          { id: 'pumpkin_item', emoji: '', name: 'Pumpkin' },
          { id: 'zucchini_item', emoji: '', name: 'Zucchini' },
          { id: 'bottle_gourd_item', emoji: '', name: 'Bottle Gourd' },
          { id: 'bitter_gourd_item', emoji: '', name: 'Bitter Gourd' },
        ],
      },
      {
        familyName: 'Nightshades (Solanaceae)',
        items: [
          { id: 'tomato_item', emoji: '', name: 'Tomato' },
          { id: 'eggplant_item', emoji: '', name: 'Eggplant' },
          { id: 'bell_pepper_item', emoji: '', name: 'Bell Pepper' },
          { id: 'chili_pepper_item', emoji: '', name: 'Chili Pepper' },
        ],
      },
      {
        familyName: 'Podded Vegetables (Legumes as veg)',
        items: [
          { id: 'green_beans_item', emoji: '', name: 'Green Beans' },
          { id: 'snow_peas_item', emoji: '', name: 'Snow Peas' },
          { id: 'sugar_snap_peas_item', emoji: '', name: 'Sugar Snap Peas' },
        ],
      },
      {
        familyName: 'Mushrooms (Fungi)',
        items: [
          { id: 'button_mushroom_item', emoji: '', name: 'Button Mushroom' },
          { id: 'portobello_item', emoji: '', name: 'Portobello Mushroom' },
          { id: 'shiitake_item', emoji: '', name: 'Shiitake Mushroom' },
          { id: 'oyster_mushroom_item', emoji: '', name: 'Oyster Mushroom' },
        ],
      },
    ],
  },
  {
    categoryId: 'meat_seafood_main',
    categoryName: ' Meat & Seafood',
    families: [
      {
        familyName: 'Red Meat',
        items: [
          { id: 'beef_item', emoji: '', name: 'Beef' },
          { id: 'lamb_item_meat', emoji: '', name: 'Lamb' },
          { id: 'goat_item_meat', emoji: '', name: 'Goat Meat' },
          { id: 'pork_item', emoji: '', name: 'Pork' },
          { id: 'venison_item', emoji: '', name: 'Venison' },
        ],
      },
      {
        familyName: 'White Meat',
        items: [
          { id: 'chicken_item', emoji: '', name: 'Chicken' },
          { id: 'turkey_item_meat', emoji: '', name: 'Turkey' },
          { id: 'duck_item_meat', emoji: '', name: 'Duck' },
        ],
      },
      {
        familyName: 'Game Meat',
        items: [
          { id: 'rabbit_item_meat', emoji: '', name: 'Rabbit' },
          { id: 'bison_item_meat', emoji: '', name: 'Bison' },
          { id: 'quail_item_meat', emoji: '', name: 'Quail' },
          { id: 'wild_boar_item_meat', emoji: '', name: 'Wild Boar' },
        ],
      },
      {
        familyName: 'Processed Meats',
        items: [
          { id: 'sausages_item', emoji: '', name: 'Sausages' },
          { id: 'bacon_item', emoji: '', name: 'Bacon' },
          { id: 'ham_item', emoji: '', name: 'Ham' },
          { id: 'salami_item', emoji: '', name: 'Salami' },
          { id: 'deli_meats_item', emoji: '', name: 'Deli Meats' },
        ],
      },
      {
        familyName: 'Seafood (Fish & Shellfish)',
        items: [
          { id: 'salmon_item_fish', emoji: '', name: 'Salmon (Fish)' },
          { id: 'tuna_item_fish', emoji: '', name: 'Tuna (Fish)' },
          { id: 'sardines_item_fish', emoji: '', name: 'Sardines (Fish)' },
          { id: 'cod_item_fish', emoji: '', name: 'Cod (Fish)' },
          { id: 'tilapia_item_fish', emoji: '', name: 'Tilapia (Fish)' },
          { id: 'shrimp_item_shellfish', emoji: '', name: 'Shrimp (Shellfish)' },
          { id: 'crab_item_shellfish', emoji: '', name: 'Crab (Shellfish)' },
          { id: 'lobster_item_shellfish', emoji: '', name: 'Lobster (Shellfish)' },
          { id: 'mussels_item_shellfish', emoji: '', name: 'Mussels (Shellfish)' },
          { id: 'oysters_item_shellfish', emoji: '', name: 'Oysters (Shellfish)' },
        ],
      },
    ],
  },
  {
    categoryId: 'dairy_main',
    categoryName: ' Dairy',
    families: [
      {
        familyName: 'Milk & Cream',
        items: [
          { id: 'cow_milk_item', emoji: '', name: 'Cow Milk' },
          { id: 'buffalo_milk_item', emoji: '', name: 'Buffalo Milk' },
          { id: 'goat_milk_dairy_item', emoji: '', name: 'Goat Milk' },
          { id: 'cream_item_dairy', emoji: '', name: 'Cream' },
          { id: 'condensed_milk_item', emoji: '', name: 'Condensed Milk' },
          { id: 'evaporated_milk_item', emoji: '', name: 'Evaporated Milk' },
        ],
      },
      {
        familyName: 'Cheese',
        items: [
          { id: 'cheddar_item_cheese', emoji: '', name: 'Cheddar Cheese' },
          { id: 'mozzarella_item_cheese', emoji: '', name: 'Mozzarella Cheese' },
          { id: 'parmesan_item_cheese', emoji: '', name: 'Parmesan Cheese' },
          { id: 'feta_item_cheese', emoji: '', name: 'Feta Cheese' },
          { id: 'blue_cheese_item', emoji: '', name: 'Blue Cheese' },
          { id: 'ricotta_item_cheese', emoji: '', name: 'Ricotta Cheese' },
        ],
      },
      {
        familyName: 'Yogurt & Fermented Dairy',
        items: [
          { id: 'yogurt_dairy_item', emoji: '', name: 'Yogurt (Dairy)' },
          { id: 'greek_yogurt_item', emoji: '', name: 'Greek Yogurt (Dairy)' },
          { id: 'kefir_item_dairy', emoji: '', name: 'Kefir (Dairy)' },
          { id: 'buttermilk_item_dairy', emoji: '', name: 'Buttermilk (Dairy)' },
        ],
      },
      {
        familyName: 'Butter & Ghee',
        items: [
          { id: 'salted_butter_item', emoji: '', name: 'Salted Butter' },
          { id: 'unsalted_butter_item', emoji: '', name: 'Unsalted Butter' },
          { id: 'ghee_item', emoji: '', name: 'Ghee' },
        ],
      },
      {
        familyName: 'Ice Cream & Desserts',
        items: [
          { id: 'ice_cream_dairy_item', emoji: '', name: 'Ice Cream (Dairy)' },
          { id: 'custards_dairy_item', emoji: '', name: 'Custards (Dairy)' },
          { id: 'pudding_dairy_item', emoji: '', name: 'Pudding (Dairy-based)' },
        ],
      },
    ],
  },
  {
    categoryId: 'grains_carbs_broad',
    categoryName: ' Grains & Carbohydrates',
    families: [
      {
        familyName: 'Grains & Carbohydrates', // Single family for this broad category
        items: [
            { id: 'bread_gluten_item', emoji: '', name: 'Bread/Wheat (Gluten)' },
            { id: 'pasta_gluten_item', emoji: '', name: 'Pasta (Gluten)' },
            { id: 'rice_item', emoji: '', name: 'Rice' },
            { id: 'oats_item', emoji: '', name: 'Oats' },
            { id: 'corn_gluten_free_item', emoji: '', name: 'Corn (Gluten-Free)' },
            { id: 'quinoa_gluten_free_item', emoji: '', name: 'Quinoa (Gluten-Free)' },
        ],
      },
    ],
  },
  {
    categoryId: 'plant_proteins_alternatives_broad',
    categoryName: ' Plant Proteins & Alternatives',
    families: [
      {
        familyName: 'Plant Proteins & Alternatives', // Single family
        items: [
            { id: 'eggs_item_plant_protein_context', emoji: '', name: 'Eggs' },
            { id: 'beans_legumes_item', emoji: '', name: 'Beans & Legumes' },
            { id: 'tofu_soy_item', emoji: '', name: 'Tofu/Tempeh/Soy' },
            { id: 'nuts_seeds_item', emoji: '', name: 'Nuts & Seeds' },
            { id: 'plant_milk_item', emoji: '', name: 'Plant-Based Milk' },
            { id: 'plant_yogurt_cheese_item', emoji: '', name: 'Plant-Based Yogurt/Cheese' },
        ],
      },
    ],
  },
  {
    categoryId: 'other_sweeteners_broad',
    categoryName: ' Other & Sweeteners',
    families: [
      {
        familyName: 'Other & Sweeteners', // Single family
        items: [
            { id: 'honey_item', emoji: '', name: 'Honey' },
            { id: 'sugar_sweets_item', emoji: '', name: 'Sugar/Sweets/Candy' },
            { id: 'processed_snacks_item', emoji: '', name: 'Processed Snacks' },
            { id: 'vegetable_oil_item', emoji: '', name: 'Vegetable Oils' },
            { id: 'coffee_tea_item', emoji: '', name: 'Coffee/Tea' },
            { id: 'herbs_spices_item', emoji: '', name: 'Herbs & Spices' },
        ],
      },
    ],
  }
];

// Helper to map food item ID to concept name for AI analysis
export const foodIdToConcept: Record<string, string> = {};
foodItemCategoriesData.forEach(category => {
  category.families.forEach(family => {
    family.items.forEach(item => {
      foodIdToConcept[item.id] = item.name;
    });
  });
});


export const knownDietaryProfiles: string[] = [
  "Vegan", "Lacto-Vegetarian", "Ovo-Vegetarian", "Lacto-Ovo Vegetarian", "Eggetarian",
  "Pescatarian", "Pollotarian", "Flexitarian", "Non-Vegetarian (Omnivore)",
  "Fruitarian", "Raw Vegan", "Sattvic", "Jain",
  "Gluten-Free", "Keto (Ketogenic)", "Paleo", "Low FODMAP", "Dairy-Free",
  "Generally Healthy", "Custom Selection / Unclear Pattern"
];


export interface DetailedDietProfile {
  id: string;
  name: string;
  emoji: string;
  category: DietProfileCategory;
  description: string;
  includes: string[];
  excludes: string[];
}

export type DietProfileCategory =
  | "Vegetarian-Based"
  | "Animal-Inclusive"
  | "Lifestyle or Belief-Based"
  | "Health or Medical-Based"
  | "General";

export const dietProfileCategories: DietProfileCategory[] = [
  "Vegetarian-Based",
  "Animal-Inclusive",
  "Lifestyle or Belief-Based",
  "Health or Medical-Based",
  "General"
];

export const detailedDietProfilesData: DetailedDietProfile[] = [
  { id: 'vegan', name: 'Vegan', emoji: '', category: 'Vegetarian-Based', description: 'Excludes all animal products.', includes: ['Vegetables', 'Fruits', 'Grains', 'Nuts & Seeds', 'Legumes'], excludes: ['Meat', 'Poultry', 'Fish', 'Eggs', 'Dairy', 'Honey'] },
  { id: 'lacto_vegetarian', name: 'Lacto-Vegetarian', emoji: '', category: 'Vegetarian-Based', description: 'Excludes meat, poultry, fish, and eggs. Includes dairy.', includes: ['Vegetables', 'Fruits', 'Grains', 'Nuts & Seeds', 'Legumes', 'Dairy'], excludes: ['Meat', 'Poultry', 'Fish', 'Eggs'] },
  { id: 'ovo_vegetarian', name: 'Ovo-Vegetarian', emoji: '', category: 'Vegetarian-Based', description: 'Excludes meat, poultry, fish, and dairy. Includes eggs.', includes: ['Vegetables', 'Fruits', 'Grains', 'Nuts & Seeds', 'Legumes', 'Eggs'], excludes: ['Meat', 'Poultry', 'Fish', 'Dairy'] },
  { id: 'lacto_ovo_vegetarian', name: 'Lacto-Ovo Vegetarian', emoji: '', category: 'Vegetarian-Based', description: 'Excludes meat, poultry, and fish. Includes dairy and eggs.', includes: ['Vegetables', 'Fruits', 'Grains', 'Nuts & Seeds', 'Legumes', 'Eggs', 'Dairy'], excludes: ['Meat', 'Poultry', 'Fish'] },
  { id: 'eggetarian', name: 'Eggetarian', emoji: '', category: 'Vegetarian-Based', description: 'Primarily plant-based but includes eggs. Excludes meat, poultry, fish. Dairy is optional.', includes: ['Vegetables', 'Fruits', 'Grains', 'Nuts & Seeds', 'Legumes', 'Eggs'], excludes: ['Meat', 'Poultry', 'Fish'], },
  { id: 'pescatarian', name: 'Pescatarian', emoji: '', category: 'Animal-Inclusive', description: 'Excludes meat and poultry. Includes fish/seafood.', includes: ['Fish/Seafood', 'Eggs', 'Dairy', 'Vegetables', 'Fruits', 'Grains'], excludes: ['Meat', 'Poultry'] },
  { id: 'pollotarian', name: 'Pollotarian', emoji: '', category: 'Animal-Inclusive', description: 'Excludes red meat and fish. Includes poultry.', includes: ['Poultry', 'Vegetables', 'Fruits', 'Grains'], excludes: ['Red Meat', 'Fish'] },
  { id: 'flexitarian', name: 'Flexitarian', emoji: '', category: 'Animal-Inclusive', description: 'Mostly plant-based, with occasional, limited consumption of meat/fish.', includes: ['Primarily plant-based', 'Occasional meat/fish'], excludes: ['None strictly (limits meat)'] },
  { id: 'non_vegetarian', name: 'Non-Vegetarian (Omnivore)', emoji: '', category: 'Animal-Inclusive', description: 'Consumes all food groups without broad restrictions.', includes: ['Meat', 'Poultry', 'Fish', 'Eggs', 'Dairy', 'Vegetables', 'Fruits', 'Grains'], excludes: ['None'] },
  { id: 'fruitarian', name: 'Fruitarian', emoji: '', category: 'Lifestyle or Belief-Based', description: 'Diet consists primarily of fruits, some nuts/seeds.', includes: ['Fruits', 'Some nuts/seeds'], excludes: ['Most other foods (Vegetables, Meat, Dairy etc.)'] },
  { id: 'raw_vegan', name: 'Raw Vegan', emoji: '', category: 'Lifestyle or Belief-Based', description: 'Vegan diet where food is not heated above a certain temperature.', includes: ['Raw fruits', 'Raw vegetables', 'Nuts', 'Seeds'], excludes: ['Cooked food', 'All animal products'] },
  { id: 'sattvic', name: 'Sattvic', emoji: '', category: 'Lifestyle or Belief-Based', description: 'Pure, essential foods promoting clarity and calmness (Ayurvedic).', includes: ['Fresh vegetables', 'Fruits', 'Dairy', 'Grains', 'Legumes', 'Nuts'], excludes: ['Onion', 'Garlic', 'Meat', 'Eggs', 'Stimulants', 'Stale food'] },
  { id: 'jain', name: 'Jain', emoji: '', category: 'Lifestyle or Belief-Based', description: 'Strict vegetarian diet adhering to principles of non-violence.', includes: ['Fruits', 'Non-root vegetables', 'Dairy', 'Grains', 'Legumes'], excludes: ['Root vegetables (potatoes, onions, garlic)', 'Meat', 'Eggs', 'Honey', 'Certain spices'] },
  { id: 'gluten_free', name: 'Gluten-Free', emoji: '', category: 'Health or Medical-Based', description: 'Excludes the protein gluten, found in wheat, barley, rye.', includes: ['Fruits', 'Vegetables', 'Meat', 'Fish', 'Dairy', 'Gluten-free grains (rice, corn)'], excludes: ['Wheat', 'Barley', 'Rye', 'Oats (unless certified GF)'] },
  { id: 'keto', name: 'Keto (Ketogenic)', emoji: '', category: 'Health or Medical-Based', description: 'Very low carbohydrate, high fat diet.', includes: ['Meat', 'Fish', 'Eggs', 'Cheese', 'High-fat dairy', 'Nuts', 'Seeds', 'Low-carb vegetables (leafy greens)'], excludes: ['Grains', 'Sugar', 'Most fruits', 'Starchy vegetables (potatoes)'] },
  { id: 'paleo', name: 'Paleo', emoji: '', category: 'Health or Medical-Based', description: 'Based on foods presumed available to Paleolithic humans.', includes: ['Meat', 'Fish', 'Eggs', 'Fruits', 'Vegetables (non-starchy)', 'Nuts', 'Seeds'], excludes: ['Grains', 'Legumes', 'Dairy', 'Processed foods', 'Refined sugar'] },
  { id: 'low_fodmap', name: 'Low FODMAP', emoji: '', category: 'Health or Medical-Based', description: 'Restricts fermentable oligo-, di-, mono-saccharides and polyols.', includes: ['Specific low-FODMAP fruits & vegetables', 'Lactose-free dairy', 'Certain grains (rice, oats)'], excludes: ['High-FODMAP foods (e.g., wheat, onions, garlic, legumes, some fruits like apples)'] },
  { id: 'dairy_free', name: 'Dairy-Free', emoji: '', category: 'Health or Medical-Based', description: 'Excludes all dairy products.', includes: ['All non-dairy foods', 'Plant-based milks'], excludes: ['Milk', 'Cheese', 'Yogurt', 'Butter', 'Cream (from dairy)'] },
  { id: 'intermittent_fasting', name: 'Intermittent Fasting Pattern', emoji: '', category: 'General', description: 'Cycles between periods of eating and voluntary fasting.', includes: ['All food groups (during eating window)'], excludes: ['Food/caloric beverages (during fasting window)'] },
];
