
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
    categoryName: 'ðŸ“ Fruits',
    families: [
      {
        familyName: 'Berries',
        items: [
          { id: 'strawberry_item', emoji: 'ðŸ“', name: 'Strawberry' },
          { id: 'blueberry_item', emoji: 'ðŸ«', name: 'Blueberry' },
          { id: 'raspberry_item', emoji: 'ðŸ“', name: 'Raspberry' }, // Using strawberry emoji as generic berry
          { id: 'blackberry_item', emoji: 'ðŸ«', name: 'Blackberry' }, // Using blueberry as generic dark berry
          { id: 'cranberry_item', emoji: 'ðŸ“', name: 'Cranberry' },
          { id: 'gooseberry_item', emoji: 'ðŸŸ¢', name: 'Gooseberry' },
        ],
      },
      {
        familyName: 'Citrus Fruits',
        items: [
          { id: 'orange_item', emoji: 'ðŸŠ', name: 'Orange' },
          { id: 'lemon_item', emoji: 'ðŸ‹', name: 'Lemon' },
          { id: 'lime_item', emoji: 'ðŸ‹', name: 'Lime' }, // Using lemon emoji for lime
          { id: 'grapefruit_item', emoji: 'ðŸŠ', name: 'Grapefruit' }, // Using orange emoji
          { id: 'tangerine_item', emoji: 'ðŸŠ', name: 'Tangerine' },
          { id: 'pomelo_item', emoji: 'ðŸŠ', name: 'Pomelo' },
        ],
      },
      {
        familyName: 'Stone Fruits (Drupes)',
        items: [
          { id: 'peach_item', emoji: 'ðŸ‘', name: 'Peach' },
          { id: 'plum_item', emoji: 'ðŸ‘', name: 'Plum' }, // Using peach emoji
          { id: 'cherry_item', emoji: 'ðŸ’', name: 'Cherry' },
          { id: 'apricot_item', emoji: 'ðŸ‘', name: 'Apricot' },
          { id: 'nectarine_item', emoji: 'ðŸ‘', name: 'Nectarine' },
          { id: 'mango_item_fruit', emoji: 'ðŸ¥­', name: 'Mango' },
        ],
      },
      {
        familyName: 'Pome Fruits',
        items: [
          { id: 'apple_item', emoji: 'ðŸŽ', name: 'Apple' },
          { id: 'pear_item', emoji: 'ðŸ', name: 'Pear' },
          { id: 'quince_item', emoji: 'ðŸ', name: 'Quince' },
        ],
      },
      {
        familyName: 'Tropical Fruits',
        items: [
          { id: 'banana_item', emoji: 'ðŸŒ', name: 'Banana' },
          { id: 'papaya_item', emoji: 'ðŸ¥­', name: 'Papaya' }, // Using mango emoji as general tropical
          { id: 'pineapple_item', emoji: 'ðŸ', name: 'Pineapple' },
          { id: 'coconut_item', emoji: 'ðŸ¥¥', name: 'Coconut' },
          { id: 'guava_item', emoji: 'ðŸˆ', name: 'Guava' }, // Using melon as generic
          { id: 'passionfruit_item', emoji: 'ðŸ“', name: 'Passionfruit' },
        ],
      },
      {
        familyName: 'Melons',
        items: [
          { id: 'watermelon_item', emoji: 'ðŸ‰', name: 'Watermelon' },
          { id: 'cantaloupe_item', emoji: 'ðŸˆ', name: 'Cantaloupe' },
          { id: 'honeydew_item', emoji: 'ðŸˆ', name: 'Honeydew' },
        ],
      },
      {
        familyName: 'Figs, Mulberries & More',
        items: [
          { id: 'fig_item', emoji: 'ðŸ‡', name: 'Fig' }, // Using grape as generic
          { id: 'mulberry_item', emoji: 'ðŸ‡', name: 'Mulberry' },
          { id: 'breadfruit_item', emoji: 'ðŸˆ', name: 'Breadfruit' },
          { id: 'jackfruit_item', emoji: 'ðŸˆ', name: 'Jackfruit' },
        ],
      },
      {
        familyName: 'Grapes & Vine Fruits',
        items: [
          { id: 'grape_item', emoji: 'ðŸ‡', name: 'Grape' },
          { id: 'kiwi_item', emoji: 'ðŸ¥', name: 'Kiwi' },
          { id: 'currants_item', emoji: 'ðŸ‡', name: 'Currants' },
        ],
      },
      {
        familyName: 'Exotic & Specialty Fruits',
        items: [
          { id: 'dragonfruit_item', emoji: 'ðŸ‰', name: 'Dragonfruit' },
          { id: 'starfruit_item', emoji: 'â­', name: 'Starfruit' },
          { id: 'lychee_item', emoji: 'ðŸ”´', name: 'Lychee' },
          { id: 'longan_item', emoji: 'ðŸŸ¤', name: 'Longan' },
          { id: 'durian_item', emoji: 'ðŸˆ', name: 'Durian' },
        ],
      },
    ],
  },
  {
    categoryId: 'vegetables_main',
    categoryName: 'ðŸ¥• Vegetables',
    families: [
      {
        familyName: 'Root Vegetables',
        items: [
          { id: 'carrot_item', emoji: 'ðŸ¥•', name: 'Carrot' },
          { id: 'beetroot_item', emoji: 'ðŸ’œ', name: 'Beetroot' },
          { id: 'radish_item_veg_root', emoji: 'ðŸ¥•', name: 'Radish' },
          { id: 'turnip_item', emoji: 'âšª', name: 'Turnip' },
          { id: 'parsnip_item', emoji: 'ðŸ¥•', name: 'Parsnip' },
          { id: 'sweet_potato_item', emoji: 'ðŸ ', name: 'Sweet Potato' },
          { id: 'yam_item', emoji: 'ðŸ ', name: 'Yam' },
        ],
      },
      {
        familyName: 'Tuber Vegetables',
        items: [
          { id: 'potato_item', emoji: 'ðŸ¥”', name: 'Potato' },
          { id: 'cassava_item', emoji: 'ðŸ¥”', name: 'Cassava' },
          { id: 'jerusalem_artichoke_item', emoji: 'ðŸ¥”', name: 'Jerusalem Artichoke' },
        ],
      },
      {
        familyName: 'Bulb Vegetables',
        items: [
          { id: 'onion_item', emoji: 'ðŸ§…', name: 'Onion' },
          { id: 'garlic_item', emoji: 'ðŸ§„', name: 'Garlic' },
          { id: 'leek_item', emoji: 'ðŸ¥¬', name: 'Leek' },
          { id: 'shallot_item', emoji: 'ðŸ§…', name: 'Shallot' },
          { id: 'spring_onion_item', emoji: 'ðŸ¥¬', name: 'Spring Onion' },
        ],
      },
      {
        familyName: 'Leafy Vegetables',
        items: [
          { id: 'spinach_item', emoji: 'ðŸ¥¬', name: 'Spinach' },
          { id: 'kale_item', emoji: 'ðŸ¥¬', name: 'Kale' },
          { id: 'lettuce_item', emoji: 'ðŸ¥¬', name: 'Lettuce' },
          { id: 'swiss_chard_item', emoji: 'ðŸ¥¬', name: 'Swiss Chard' },
          { id: 'cabbage_item_leafy', emoji: 'ðŸ¥¬', name: 'Cabbage' },
          { id: 'mustard_greens_item', emoji: 'ðŸ¥¬', name: 'Mustard Greens' },
          { id: 'collard_greens_item', emoji: 'ðŸ¥¬', name: 'Collard Greens' },
        ],
      },
      {
        familyName: 'Cruciferous (Brassica) Vegetables',
        items: [
          { id: 'broccoli_item', emoji: 'ðŸ¥¦', name: 'Broccoli' },
          { id: 'cauliflower_item', emoji: 'ðŸ¥¦', name: 'Cauliflower' },
          { id: 'brussels_sprouts_item', emoji: 'ðŸ¥¬', name: 'Brussels Sprouts' },
          { id: 'bok_choy_item', emoji: 'ðŸ¥¬', name: 'Bok Choy' },
          { id: 'arugula_item', emoji: 'ðŸŒ¿', name: 'Arugula' },
          { id: 'radish_item_veg_cruc', emoji: 'ðŸ¥•', name: 'Radish (also root)' },
        ],
      },
      {
        familyName: 'Stem Vegetables',
        items: [
          { id: 'asparagus_item', emoji: 'ðŸ¥¬', name: 'Asparagus' },
          { id: 'celery_item', emoji: 'ðŸ¥¬', name: 'Celery' },
          { id: 'kohlrabi_item', emoji: 'ðŸŸ¢', name: 'Kohlrabi' },
        ],
      },
      {
        familyName: 'Gourd & Squash Family',
        items: [
          { id: 'cucumber_item', emoji: 'ðŸ¥’', name: 'Cucumber' },
          { id: 'pumpkin_item', emoji: 'ðŸŽƒ', name: 'Pumpkin' },
          { id: 'zucchini_item', emoji: 'ðŸ¥’', name: 'Zucchini' },
          { id: 'bottle_gourd_item', emoji: 'ðŸ¥’', name: 'Bottle Gourd' },
          { id: 'bitter_gourd_item', emoji: 'ðŸ¥’', name: 'Bitter Gourd' },
        ],
      },
      {
        familyName: 'Nightshades (Solanaceae)',
        items: [
          { id: 'tomato_item', emoji: 'ðŸ…', name: 'Tomato' },
          { id: 'eggplant_item', emoji: 'ðŸ†', name: 'Eggplant' },
          { id: 'bell_pepper_item', emoji: 'ðŸ«‘', name: 'Bell Pepper' },
          { id: 'chili_pepper_item', emoji: 'ðŸŒ¶ï¸', name: 'Chili Pepper' },
        ],
      },
      {
        familyName: 'Podded Vegetables (Legumes as veg)',
        items: [
          { id: 'green_beans_item', emoji: 'ðŸ«›', name: 'Green Beans' },
          { id: 'snow_peas_item', emoji: 'ðŸ«›', name: 'Snow Peas' },
          { id: 'sugar_snap_peas_item', emoji: 'ðŸ«›', name: 'Sugar Snap Peas' },
        ],
      },
      {
        familyName: 'Mushrooms (Fungi)',
        items: [
          { id: 'button_mushroom_item', emoji: 'ðŸ„', name: 'Button Mushroom' },
          { id: 'portobello_item', emoji: 'ðŸ„', name: 'Portobello Mushroom' },
          { id: 'shiitake_item', emoji: 'ðŸ„', name: 'Shiitake Mushroom' },
          { id: 'oyster_mushroom_item', emoji: 'ðŸ„', name: 'Oyster Mushroom' },
        ],
      },
    ],
  },
  {
    categoryId: 'meat_seafood_main',
    categoryName: 'ðŸ¥© Meat & Seafood',
    families: [
      {
        familyName: 'Red Meat',
        items: [
          { id: 'beef_item', emoji: 'ðŸ¥©', name: 'Beef' },
          { id: 'lamb_item_meat', emoji: 'ðŸ‘', name: 'Lamb' },
          { id: 'goat_item_meat', emoji: 'ðŸ', name: 'Goat Meat' },
          { id: 'pork_item', emoji: 'ðŸ–', name: 'Pork' },
          { id: 'venison_item', emoji: 'ðŸ¦Œ', name: 'Venison' },
        ],
      },
      {
        familyName: 'White Meat',
        items: [
          { id: 'chicken_item', emoji: 'ðŸ”', name: 'Chicken' },
          { id: 'turkey_item_meat', emoji: 'ðŸ¦ƒ', name: 'Turkey' },
          { id: 'duck_item_meat', emoji: 'ðŸ¦†', name: 'Duck' },
        ],
      },
      {
        familyName: 'Game Meat',
        items: [
          { id: 'rabbit_item_meat', emoji: 'ðŸ‡', name: 'Rabbit' },
          { id: 'bison_item_meat', emoji: 'ðŸ¦¬', name: 'Bison' },
          { id: 'quail_item_meat', emoji: 'ðŸ¦', name: 'Quail' },
          { id: 'wild_boar_item_meat', emoji: 'ðŸ—', name: 'Wild Boar' },
        ],
      },
      {
        familyName: 'Processed Meats',
        items: [
          { id: 'sausages_item', emoji: 'ðŸŒ­', name: 'Sausages' },
          { id: 'bacon_item', emoji: 'ðŸ¥“', name: 'Bacon' },
          { id: 'ham_item', emoji: 'ðŸ–', name: 'Ham' },
          { id: 'salami_item', emoji: 'ðŸ•', name: 'Salami' },
          { id: 'deli_meats_item', emoji: 'ðŸ¥ª', name: 'Deli Meats' },
        ],
      },
      {
        familyName: 'Seafood (Fish & Shellfish)',
        items: [
          { id: 'salmon_item_fish', emoji: 'ðŸŸ', name: 'Salmon (Fish)' },
          { id: 'tuna_item_fish', emoji: 'ðŸŸ', name: 'Tuna (Fish)' },
          { id: 'sardines_item_fish', emoji: 'ðŸŸ', name: 'Sardines (Fish)' },
          { id: 'cod_item_fish', emoji: 'ðŸŸ', name: 'Cod (Fish)' },
          { id: 'tilapia_item_fish', emoji: 'ðŸŸ', name: 'Tilapia (Fish)' },
          { id: 'shrimp_item_shellfish', emoji: 'ðŸ¦', name: 'Shrimp (Shellfish)' },
          { id: 'crab_item_shellfish', emoji: 'ðŸ¦€', name: 'Crab (Shellfish)' },
          { id: 'lobster_item_shellfish', emoji: 'ðŸ¦ž', name: 'Lobster (Shellfish)' },
          { id: 'mussels_item_shellfish', emoji: 'ðŸ¦ª', name: 'Mussels (Shellfish)' },
          { id: 'oysters_item_shellfish', emoji: 'ðŸ¦ª', name: 'Oysters (Shellfish)' },
        ],
      },
    ],
  },
  {
    categoryId: 'dairy_main',
    categoryName: 'ðŸ§€ Dairy',
    families: [
      {
        familyName: 'Milk & Cream',
        items: [
          { id: 'cow_milk_item', emoji: 'ðŸ¥›', name: 'Cow Milk' },
          { id: 'buffalo_milk_item', emoji: 'ðŸ¥›', name: 'Buffalo Milk' },
          { id: 'goat_milk_dairy_item', emoji: 'ðŸ¥›', name: 'Goat Milk' },
          { id: 'cream_item_dairy', emoji: 'ðŸ¥›', name: 'Cream' },
          { id: 'condensed_milk_item', emoji: 'ðŸ¥›', name: 'Condensed Milk' },
          { id: 'evaporated_milk_item', emoji: 'ðŸ¥›', name: 'Evaporated Milk' },
        ],
      },
      {
        familyName: 'Cheese',
        items: [
          { id: 'cheddar_item_cheese', emoji: 'ðŸ§€', name: 'Cheddar Cheese' },
          { id: 'mozzarella_item_cheese', emoji: 'ðŸ§€', name: 'Mozzarella Cheese' },
          { id: 'parmesan_item_cheese', emoji: 'ðŸ§€', name: 'Parmesan Cheese' },
          { id: 'feta_item_cheese', emoji: 'ðŸ§€', name: 'Feta Cheese' },
          { id: 'blue_cheese_item', emoji: 'ðŸ§€', name: 'Blue Cheese' },
          { id: 'ricotta_item_cheese', emoji: 'ðŸ§€', name: 'Ricotta Cheese' },
        ],
      },
      {
        familyName: 'Yogurt & Fermented Dairy',
        items: [
          { id: 'yogurt_dairy_item', emoji: 'ðŸ¦', name: 'Yogurt (Dairy)' },
          { id: 'greek_yogurt_item', emoji: 'ðŸ¦', name: 'Greek Yogurt (Dairy)' },
          { id: 'kefir_item_dairy', emoji: 'ðŸ¥›', name: 'Kefir (Dairy)' },
          { id: 'buttermilk_item_dairy', emoji: 'ðŸ¥›', name: 'Buttermilk (Dairy)' },
        ],
      },
      {
        familyName: 'Butter & Ghee',
        items: [
          { id: 'salted_butter_item', emoji: 'ðŸ§ˆ', name: 'Salted Butter' },
          { id: 'unsalted_butter_item', emoji: 'ðŸ§ˆ', name: 'Unsalted Butter' },
          { id: 'ghee_item', emoji: 'ðŸ§ˆ', name: 'Ghee' },
        ],
      },
      {
        familyName: 'Ice Cream & Desserts',
        items: [
          { id: 'ice_cream_dairy_item', emoji: 'ðŸ¨', name: 'Ice Cream (Dairy)' },
          { id: 'custards_dairy_item', emoji: 'ðŸ®', name: 'Custards (Dairy)' },
          { id: 'pudding_dairy_item', emoji: 'ðŸ®', name: 'Pudding (Dairy-based)' },
        ],
      },
    ],
  },
  {
    categoryId: 'grains_carbs_broad',
    categoryName: 'ðŸž Grains & Carbohydrates',
    families: [
      {
        familyName: 'Grains & Carbohydrates', // Single family for this broad category
        items: [
            { id: 'bread_gluten_item', emoji: 'ðŸž', name: 'Bread/Wheat (Gluten)' },
            { id: 'pasta_gluten_item', emoji: 'ðŸ', name: 'Pasta (Gluten)' },
            { id: 'rice_item', emoji: 'ðŸš', name: 'Rice' },
            { id: 'oats_item', emoji: 'ðŸ¥£', name: 'Oats' },
            { id: 'corn_gluten_free_item', emoji: 'ðŸŒ½', name: 'Corn (Gluten-Free)' },
            { id: 'quinoa_gluten_free_item', emoji: 'ðŸ²', name: 'Quinoa (Gluten-Free)' },
        ],
      },
    ],
  },
  {
    categoryId: 'plant_proteins_alternatives_broad',
    categoryName: 'ðŸŒ° Plant Proteins & Alternatives',
    families: [
      {
        familyName: 'Plant Proteins & Alternatives', // Single family
        items: [
            { id: 'eggs_item_plant_protein_context', emoji: 'ðŸ¥š', name: 'Eggs' },
            { id: 'beans_legumes_item', emoji: 'ðŸ«˜', name: 'Beans & Legumes' },
            { id: 'tofu_soy_item', emoji: 'ðŸ§±', name: 'Tofu/Tempeh/Soy' },
            { id: 'nuts_seeds_item', emoji: 'ðŸ¥œ', name: 'Nuts & Seeds' },
            { id: 'plant_milk_item', emoji: 'ðŸ¥›', name: 'Plant-Based Milk' },
            { id: 'plant_yogurt_cheese_item', emoji: 'ðŸ§€', name: 'Plant-Based Yogurt/Cheese' },
        ],
      },
    ],
  },
  {
    categoryId: 'other_sweeteners_broad',
    categoryName: 'ðŸ¯ Other & Sweeteners',
    families: [
      {
        familyName: 'Other & Sweeteners', // Single family
        items: [
            { id: 'honey_item', emoji: 'ðŸ¯', name: 'Honey' },
            { id: 'sugar_sweets_item', emoji: 'ðŸ¬', name: 'Sugar/Sweets/Candy' },
            { id: 'processed_snacks_item', emoji: 'ðŸ¥¨', name: 'Processed Snacks' },
            { id: 'vegetable_oil_item', emoji: 'ðŸ«’', name: 'Vegetable Oils' },
            { id: 'coffee_tea_item', emoji: 'â˜•', name: 'Coffee/Tea' },
            { id: 'herbs_spices_item', emoji: 'ðŸŒ¿', name: 'Herbs & Spices' },
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
  { id: 'vegan', name: 'Vegan', emoji: 'ðŸŒ±', category: 'Vegetarian-Based', description: 'Excludes all animal products.', includes: ['Vegetables', 'Fruits', 'Grains', 'Nuts & Seeds', 'Legumes'], excludes: ['Meat', 'Poultry', 'Fish', 'Eggs', 'Dairy', 'Honey'] },
  { id: 'lacto_vegetarian', name: 'Lacto-Vegetarian', emoji: 'ðŸ¥›ðŸŒ¿', category: 'Vegetarian-Based', description: 'Excludes meat, poultry, fish, and eggs. Includes dairy.', includes: ['Vegetables', 'Fruits', 'Grains', 'Nuts & Seeds', 'Legumes', 'Dairy'], excludes: ['Meat', 'Poultry', 'Fish', 'Eggs'] },
  { id: 'ovo_vegetarian', name: 'Ovo-Vegetarian', emoji: 'ðŸ¥šðŸŒ¿', category: 'Vegetarian-Based', description: 'Excludes meat, poultry, fish, and dairy. Includes eggs.', includes: ['Vegetables', 'Fruits', 'Grains', 'Nuts & Seeds', 'Legumes', 'Eggs'], excludes: ['Meat', 'Poultry', 'Fish', 'Dairy'] },
  { id: 'lacto_ovo_vegetarian', name: 'Lacto-Ovo Vegetarian', emoji: 'ðŸ¥šðŸ¥›ðŸŒ¿', category: 'Vegetarian-Based', description: 'Excludes meat, poultry, and fish. Includes dairy and eggs.', includes: ['Vegetables', 'Fruits', 'Grains', 'Nuts & Seeds', 'Legumes', 'Eggs', 'Dairy'], excludes: ['Meat', 'Poultry', 'Fish'] },
  { id: 'eggetarian', name: 'Eggetarian', emoji: 'ðŸ¥šðŸŒ¿', category: 'Vegetarian-Based', description: 'Primarily plant-based but includes eggs. Excludes meat, poultry, fish. Dairy is optional.', includes: ['Vegetables', 'Fruits', 'Grains', 'Nuts & Seeds', 'Legumes', 'Eggs'], excludes: ['Meat', 'Poultry', 'Fish'], },
  { id: 'pescatarian', name: 'Pescatarian', emoji: 'ðŸŸðŸ¥—', category: 'Animal-Inclusive', description: 'Excludes meat and poultry. Includes fish/seafood.', includes: ['Fish/Seafood', 'Eggs', 'Dairy', 'Vegetables', 'Fruits', 'Grains'], excludes: ['Meat', 'Poultry'] },
  { id: 'pollotarian', name: 'Pollotarian', emoji: 'ðŸ—ðŸ¥—', category: 'Animal-Inclusive', description: 'Excludes red meat and fish. Includes poultry.', includes: ['Poultry', 'Vegetables', 'Fruits', 'Grains'], excludes: ['Red Meat', 'Fish'] },
  { id: 'flexitarian', name: 'Flexitarian', emoji: 'ðŸ½ï¸ðŸŒ¿', category: 'Animal-Inclusive', description: 'Mostly plant-based, with occasional, limited consumption of meat/fish.', includes: ['Primarily plant-based', 'Occasional meat/fish'], excludes: ['None strictly (limits meat)'] },
  { id: 'non_vegetarian', name: 'Non-Vegetarian (Omnivore)', emoji: 'ðŸ–', category: 'Animal-Inclusive', description: 'Consumes all food groups without broad restrictions.', includes: ['Meat', 'Poultry', 'Fish', 'Eggs', 'Dairy', 'Vegetables', 'Fruits', 'Grains'], excludes: ['None'] },
  { id: 'fruitarian', name: 'Fruitarian', emoji: 'ðŸŽ', category: 'Lifestyle or Belief-Based', description: 'Diet consists primarily of fruits, some nuts/seeds.', includes: ['Fruits', 'Some nuts/seeds'], excludes: ['Most other foods (Vegetables, Meat, Dairy etc.)'] },
  { id: 'raw_vegan', name: 'Raw Vegan', emoji: 'ðŸ¥—', category: 'Lifestyle or Belief-Based', description: 'Vegan diet where food is not heated above a certain temperature.', includes: ['Raw fruits', 'Raw vegetables', 'Nuts', 'Seeds'], excludes: ['Cooked food', 'All animal products'] },
  { id: 'sattvic', name: 'Sattvic', emoji: 'ðŸ§˜â€â™‚ï¸', category: 'Lifestyle or Belief-Based', description: 'Pure, essential foods promoting clarity and calmness (Ayurvedic).', includes: ['Fresh vegetables', 'Fruits', 'Dairy', 'Grains', 'Legumes', 'Nuts'], excludes: ['Onion', 'Garlic', 'Meat', 'Eggs', 'Stimulants', 'Stale food'] },
  { id: 'jain', name: 'Jain', emoji: 'ðŸ•Šï¸', category: 'Lifestyle or Belief-Based', description: 'Strict vegetarian diet adhering to principles of non-violence.', includes: ['Fruits', 'Non-root vegetables', 'Dairy', 'Grains', 'Legumes'], excludes: ['Root vegetables (potatoes, onions, garlic)', 'Meat', 'Eggs', 'Honey', 'Certain spices'] },
  { id: 'gluten_free', name: 'Gluten-Free', emoji: 'ðŸš«ðŸŒ¾', category: 'Health or Medical-Based', description: 'Excludes the protein gluten, found in wheat, barley, rye.', includes: ['Fruits', 'Vegetables', 'Meat', 'Fish', 'Dairy', 'Gluten-free grains (rice, corn)'], excludes: ['Wheat', 'Barley', 'Rye', 'Oats (unless certified GF)'] },
  { id: 'keto', name: 'Keto (Ketogenic)', emoji: 'ðŸ¥©ðŸ¥‘', category: 'Health or Medical-Based', description: 'Very low carbohydrate, high fat diet.', includes: ['Meat', 'Fish', 'Eggs', 'Cheese', 'High-fat dairy', 'Nuts', 'Seeds', 'Low-carb vegetables (leafy greens)'], excludes: ['Grains', 'Sugar', 'Most fruits', 'Starchy vegetables (potatoes)'] },
  { id: 'paleo', name: 'Paleo', emoji: 'ðŸ¦´ðŸ–', category: 'Health or Medical-Based', description: 'Based on foods presumed available to Paleolithic humans.', includes: ['Meat', 'Fish', 'Eggs', 'Fruits', 'Vegetables (non-starchy)', 'Nuts', 'Seeds'], excludes: ['Grains', 'Legumes', 'Dairy', 'Processed foods', 'Refined sugar'] },
  { id: 'low_fodmap', name: 'Low FODMAP', emoji: 'ðŸš«ðŸŒ¬ï¸', category: 'Health or Medical-Based', description: 'Restricts fermentable oligo-, di-, mono-saccharides and polyols.', includes: ['Specific low-FODMAP fruits & vegetables', 'Lactose-free dairy', 'Certain grains (rice, oats)'], excludes: ['High-FODMAP foods (e.g., wheat, onions, garlic, legumes, some fruits like apples)'] },
  { id: 'dairy_free', name: 'Dairy-Free', emoji: 'ðŸ¥¥ðŸ¥¦', category: 'Health or Medical-Based', description: 'Excludes all dairy products.', includes: ['All non-dairy foods', 'Plant-based milks'], excludes: ['Milk', 'Cheese', 'Yogurt', 'Butter', 'Cream (from dairy)'] },
  { id: 'intermittent_fasting', name: 'Intermittent Fasting Pattern', emoji: 'â±ï¸', category: 'General', description: 'Cycles between periods of eating and voluntary fasting.', includes: ['All food groups (during eating window)'], excludes: ['Food/caloric beverages (during fasting window)'] },
];
