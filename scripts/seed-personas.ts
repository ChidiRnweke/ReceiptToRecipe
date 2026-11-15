/**
 * Seeds the prototype personas into the database, for local runs and PR screenshots:
 * Noor & Sam, Marc (with Ines), Lea and Jonas. Each household gets the same ~30 recipes with
 * their steps and ingredients, a plan from today, what is in the kitchen, and what they cooked.
 * Each recipe gets its committed seed picture (static/seed/recipes) and that photo's credit.
 *
 *   npm run db:seed:personas [-- --no-pictures] [-- --time-zone Europe/Brussels]
 *
 * `--no-pictures` leaves every recipe without a picture and does not touch the picture columns,
 * so it also runs against a database from before migration recipe_pictures.
 * Running it again removes the personas first. It prints a session id per member: set it as
 * the `session` cookie to be signed in as that member.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import pg from 'pg';

type Verb =
	| 'Sweat'
	| 'Bloom'
	| 'Simmer'
	| 'Fold'
	| 'Boil'
	| 'Sear'
	| 'Sauté'
	| 'Roast'
	| 'Rest'
	| 'Reduce';

const TECHNIQUE_KEYS: Record<Verb, string> = {
	Sweat: 'sweat',
	Bloom: 'bloom',
	Simmer: 'simmer',
	Fold: 'fold',
	Boil: 'boil',
	Sear: 'sear',
	Sauté: 'saute',
	Roast: 'roast',
	Rest: 'rest',
	Reduce: 'reduce'
};

/** The prototype's ingredients: name, unit and how many days they keep. */
const ING: Record<string, [string, string, number]> = {
	spinach: ['Baby spinach', 'g', 4],
	chicken: ['Chicken thighs', 'g', 3],
	salmon: ['Salmon', 'g', 2],
	tofu: ['Tofu', 'g', 7],
	egg: ['Eggs', '', 21],
	feta: ['Feta', 'g', 7],
	halloumi: ['Halloumi', 'g', 10],
	parmesan: ['Parmesan', 'g', 30],
	milk: ['Milk', 'ml', 5],
	yogurt: ['Yogurt', 'g', 6],
	cream: ['Cream', 'ml', 4],
	tomato: ['Tomatoes', '', 5],
	pepper: ['Peppers', '', 6],
	mushroom: ['Mushrooms', 'g', 4],
	broccoli: ['Broccoli', 'g', 5],
	courgette: ['Courgettes', '', 6],
	coriander: ['Coriander', 'bunch', 4],
	basil: ['Basil', 'bunch', 4],
	tortilla: ['Tortillas', '', 10],
	gnocchi: ['Gnocchi', 'pack', 14],
	peas: ['Frozen peas', 'g', 90],
	onion: ['Onions', '', 30],
	garlic: ['Garlic', 'clove', 30],
	potato: ['Potatoes', 'g', 21],
	carrot: ['Carrots', '', 14],
	celery: ['Celery', 'stick', 10],
	lime: ['Limes', '', 14],
	lemon: ['Lemons', '', 14],
	rice: ['Rice', 'g', 999],
	pasta: ['Pasta', 'g', 999],
	chickpeas: ['Chickpeas', 'can', 999],
	beans: ['Black beans', 'can', 999],
	coconut: ['Coconut milk', 'can', 999],
	lentils: ['Red lentils', 'g', 999],
	tins: ['Chopped tomatoes', 'can', 999],
	paneer: ['Paneer', 'g', 10],
	leek: ['Leeks', '', 10],
	flour: ['Flour', 'g', 999],
	banana: ['Bananas', '', 5],
	oats: ['Oats', 'g', 999],
	berries: ['Berries', 'g', 4],
	mozzarella: ['Mozzarella', 'g', 7],
	cucumber: ['Cucumber', '', 7],
	olives: ['Olives', 'g', 60],
	noodles: ['Rice noodles', 'g', 999],
	peanuts: ['Peanuts', 'g', 120],
	aubergine: ['Aubergine', '', 7],
	pitta: ['Pitta breads', '', 5],
	butter: ['Butter', 'g', 30],
	wholechicken: ['Whole chicken', '', 3]
};

interface SeedRecipe {
	slug: string;
	title: string;
	description: string;
	minutes: number;
	kcal: number;
	cuisine: string;
	ing: [string, number][];
	st: [Verb | null, string][];
}

const RECIPES: SeedRecipe[] = [
	{
		slug: 'spinach-chickpea-curry',
		title: 'Spinach & chickpea curry',
		description: 'Chickpeas and spinach in a coconut tomato sauce, with rice.',
		minutes: 35,
		kcal: 620,
		cuisine: 'Indian',
		ing: [
			['onion', 1],
			['garlic', 2],
			['chickpeas', 1],
			['coconut', 1],
			['tins', 1],
			['spinach', 200],
			['rice', 150]
		],
		st: [
			['Sweat', 'the onion with a pinch of salt, 8 min.'],
			['Bloom', 'the spices and garlic in the oil, 1 min.'],
			['Simmer', 'with the tomatoes, coconut milk and chickpeas, 15 min.'],
			['Fold', 'in the spinach, off the heat.'],
			['Boil', 'the rice meanwhile, 12 min.']
		]
	},
	{
		slug: 'creamy-spinach-pasta',
		title: 'Creamy spinach pasta',
		description: 'Pasta in a garlicky cream sauce with spinach and parmesan.',
		minutes: 15,
		kcal: 690,
		cuisine: 'Italian',
		ing: [
			['pasta', 200],
			['spinach', 150],
			['cream', 150],
			['parmesan', 40],
			['garlic', 2]
		],
		st: [
			['Boil', 'the pasta, 10 min.'],
			['Sauté', 'the garlic for a minute, then add the cream.'],
			['Reduce', 'the cream by a third, 3 min.'],
			['Fold', 'in the spinach, pasta and parmesan.']
		]
	},
	{
		slug: 'chicken-tacos',
		title: 'Chicken tacos',
		description: 'Seared chicken with peppers, coriander and lime.',
		minutes: 25,
		kcal: 690,
		cuisine: 'Mexican',
		ing: [
			['chicken', 400],
			['tortilla', 8],
			['pepper', 2],
			['onion', 1],
			['coriander', 1],
			['lime', 1]
		],
		st: [
			['Sear', 'the chicken, 4 min a side.'],
			['Sauté', 'the peppers and onion, 6 min.'],
			['Rest', 'the chicken 3 min, then slice.'],
			[null, 'Warm the tortillas and fill them, with coriander and lime.']
		]
	},
	{
		slug: 'tomato-basil-pasta',
		title: 'Tomato & basil pasta',
		description: 'Fresh tomatoes, garlic and basil tossed through pasta.',
		minutes: 20,
		kcal: 640,
		cuisine: 'Italian',
		ing: [
			['pasta', 200],
			['tomato', 4],
			['garlic', 2],
			['basil', 1],
			['parmesan', 40]
		],
		st: [
			['Boil', 'the pasta, 10 min.'],
			['Sauté', 'the garlic and tomatoes, 6 min.'],
			['Fold', 'in the pasta, basil and parmesan.']
		]
	},
	{
		slug: 'shakshuka',
		title: 'Shakshuka',
		description: 'Eggs poached in a pepper and tomato sauce, with feta.',
		minutes: 30,
		kcal: 480,
		cuisine: 'Middle Eastern',
		ing: [
			['onion', 1],
			['pepper', 1],
			['tomato', 4],
			['egg', 4],
			['feta', 60]
		],
		st: [
			['Sweat', 'the onion and pepper, 8 min.'],
			['Simmer', 'the tomatoes into a thick sauce, 10 min.'],
			[null, 'Make wells, crack in the eggs, cover for 6 min.'],
			[null, 'Crumble the feta over.']
		]
	},
	{
		slug: 'mushroom-risotto',
		title: 'Mushroom risotto',
		description: 'Creamy rice with golden mushrooms and parmesan.',
		minutes: 40,
		kcal: 650,
		cuisine: 'Italian',
		ing: [
			['onion', 1],
			['garlic', 1],
			['mushroom', 250],
			['rice', 160],
			['parmesan', 40]
		],
		st: [
			['Sweat', 'the onion and garlic, 6 min.'],
			['Sauté', 'the mushrooms until golden.'],
			['Simmer', 'the rice, adding stock a ladle at a time, 18 min.'],
			['Rest', '2 min with the parmesan folded in.']
		]
	},
	{
		slug: 'salmon-potatoes-greens',
		title: 'Salmon, potatoes & greens',
		description: 'Crisp-skinned salmon, roast potatoes and broccoli.',
		minutes: 35,
		kcal: 690,
		cuisine: 'European',
		ing: [
			['salmon', 260],
			['potato', 500],
			['broccoli', 250],
			['lemon', 1]
		],
		st: [
			['Roast', 'the potatoes, 25 min at 220 °C.'],
			['Sear', 'the salmon skin-side down, 4 min.'],
			['Boil', 'the broccoli, 3 min.']
		]
	},
	{
		slug: 'chicken-rice-bowls',
		title: 'Chicken & rice bowls',
		description: 'Sliced chicken, rice and roast broccoli, boxed for lunches.',
		minutes: 40,
		kcal: 640,
		cuisine: 'Asian',
		ing: [
			['chicken', 500],
			['rice', 250],
			['broccoli', 300],
			['garlic', 2],
			['lime', 1]
		],
		st: [
			['Boil', 'the rice, 12 min.'],
			['Roast', 'the broccoli, 15 min at 220 °C.'],
			['Sear', 'the chicken, 5 min a side.'],
			['Rest', 'the chicken, then slice it into the boxes.']
		]
	},
	{
		slug: 'bean-chili',
		title: 'Bean chili',
		description: 'Black bean chili with cumin, served with rice.',
		minutes: 45,
		kcal: 590,
		cuisine: 'Mexican',
		ing: [
			['onion', 1],
			['garlic', 2],
			['pepper', 1],
			['beans', 2],
			['tins', 1],
			['rice', 150]
		],
		st: [
			['Sweat', 'the onion and pepper, 8 min.'],
			['Bloom', 'the cumin and chilli, 1 min.'],
			['Simmer', 'with the beans and tomatoes, 25 min.'],
			['Boil', 'the rice meanwhile.']
		]
	},
	{
		slug: 'spinach-feta-frittata',
		title: 'Spinach & feta frittata',
		description: 'Eggs, potato and spinach, finished under the grill.',
		minutes: 25,
		kcal: 520,
		cuisine: 'Mediterranean',
		ing: [
			['potato', 200],
			['onion', 1],
			['spinach', 100],
			['egg', 6],
			['feta', 80]
		],
		st: [
			['Sauté', 'the potato and onion, 10 min.'],
			['Fold', 'in the spinach until it wilts.'],
			[null, 'Pour over the eggs, crumble the feta, grill for 5 min.']
		]
	},
	{
		slug: 'cheese-omelette',
		title: 'Cheese omelette & tomatoes',
		description: 'A soft parmesan omelette with sliced tomatoes.',
		minutes: 10,
		kcal: 450,
		cuisine: 'French',
		ing: [
			['egg', 4],
			['parmesan', 30],
			['tomato', 2]
		],
		st: [
			[null, 'Beat the eggs with the parmesan.'],
			['Sauté', 'in butter, moving gently, 3 min.'],
			[null, 'Serve with sliced tomatoes.']
		]
	},
	{
		slug: 'veg-lentil-soup',
		title: 'Veg & lentil soup',
		description: 'A thick soup of carrots, celery, potato and lentils.',
		minutes: 35,
		kcal: 420,
		cuisine: 'European',
		ing: [
			['onion', 1],
			['carrot', 3],
			['celery', 2],
			['potato', 300],
			['lentils', 100]
		],
		st: [
			['Sweat', 'the onion, carrot and celery, 10 min.'],
			['Simmer', 'with the potato and lentils, 20 min.']
		]
	},
	{
		slug: 'tofu-broccoli-stir-fry',
		title: 'Tofu & broccoli stir-fry',
		description: 'Crisp tofu with broccoli and peppers over rice.',
		minutes: 20,
		kcal: 580,
		cuisine: 'Chinese',
		ing: [
			['tofu', 400],
			['broccoli', 250],
			['pepper', 1],
			['garlic', 2],
			['rice', 150]
		],
		st: [
			['Boil', 'the rice.'],
			['Sear', 'the tofu until crisp, 8 min.'],
			['Sauté', 'the broccoli, pepper and garlic, 4 min.']
		]
	},
	{
		slug: 'red-lentil-dal',
		title: 'Red lentil dal',
		description: 'Red lentils simmered with tomato and coconut.',
		minutes: 35,
		kcal: 560,
		cuisine: 'Indian',
		ing: [
			['onion', 1],
			['garlic', 2],
			['lentils', 200],
			['tomato', 2],
			['coconut', 1],
			['rice', 150]
		],
		st: [
			['Sweat', 'the onion, 8 min.'],
			['Bloom', 'the spices and garlic.'],
			['Simmer', 'the lentils with tomato and coconut, 20 min.']
		]
	},
	{
		slug: 'crispy-gnocchi-peas',
		title: 'Crispy gnocchi, peas & lemon',
		description: 'Pan-crisped gnocchi with peas, lemon and parmesan.',
		minutes: 20,
		kcal: 640,
		cuisine: 'Italian',
		ing: [
			['gnocchi', 1],
			['peas', 200],
			['parmesan', 40],
			['lemon', 1]
		],
		st: [
			['Sauté', 'the gnocchi in one layer until crisp, 8 min.'],
			['Fold', 'in the peas, lemon and parmesan.']
		]
	},
	{
		slug: 'halloumi-traybake',
		title: 'Halloumi traybake',
		description: 'Roast potatoes, peppers and courgettes with golden halloumi.',
		minutes: 40,
		kcal: 720,
		cuisine: 'Mediterranean',
		ing: [
			['potato', 400],
			['pepper', 2],
			['courgette', 2],
			['halloumi', 250]
		],
		st: [
			['Roast', 'the potatoes and veg, 25 min at 220 °C.'],
			[null, 'Add the halloumi for the last 10 min.']
		]
	},
	{
		slug: 'saag-paneer',
		title: 'Saag paneer',
		description: 'Golden paneer in a spiced spinach sauce.',
		minutes: 30,
		kcal: 560,
		cuisine: 'Indian',
		ing: [
			['paneer', 225],
			['spinach', 300],
			['onion', 1],
			['garlic', 2],
			['cream', 50]
		],
		st: [
			['Sear', 'the paneer until golden, 5 min.'],
			['Sweat', 'the onion, 8 min.'],
			['Bloom', 'the garlic and spices, 1 min.'],
			['Fold', 'in the spinach and cream, then the paneer.']
		]
	},
	{
		slug: 'yogurt-chicken-traybake',
		title: 'Yogurt chicken traybake',
		description: 'Yogurt-marinated chicken roasted with potatoes and peppers.',
		minutes: 50,
		kcal: 680,
		cuisine: 'Middle Eastern',
		ing: [
			['chicken', 600],
			['yogurt', 150],
			['potato', 500],
			['pepper', 2],
			['lemon', 1]
		],
		st: [
			[null, 'Coat the chicken in yogurt, lemon and spices.'],
			['Roast', 'with the potatoes and peppers, 40 min at 210 °C.'],
			['Rest', 'the chicken 5 min.']
		]
	},
	{
		slug: 'minestrone',
		title: 'Minestrone',
		description: 'A vegetable soup with beans and small pasta.',
		minutes: 40,
		kcal: 430,
		cuisine: 'Italian',
		ing: [
			['onion', 1],
			['carrot', 2],
			['celery', 2],
			['courgette', 1],
			['tins', 1],
			['beans', 1],
			['pasta', 80]
		],
		st: [
			['Sweat', 'the onion, carrot and celery, 10 min.'],
			['Simmer', 'with the tomatoes, beans and courgette, 15 min.'],
			['Boil', 'the pasta in the soup, 8 min.']
		]
	},
	{
		slug: 'greek-salad',
		title: 'Greek salad',
		description: 'Tomatoes, cucumber, olives and a slab of feta.',
		minutes: 10,
		kcal: 380,
		cuisine: 'Greek',
		ing: [
			['tomato', 3],
			['cucumber', 1],
			['onion', 1],
			['olives', 60],
			['feta', 150]
		],
		st: [
			[null, 'Cut the tomatoes, cucumber and onion into chunks.'],
			[null, 'Top with olives and the feta, then olive oil and oregano.']
		]
	},
	{
		slug: 'margherita-pizza',
		title: 'Margherita pizza',
		description: 'Tomato, mozzarella and basil on a thin crust.',
		minutes: 30,
		kcal: 760,
		cuisine: 'Italian',
		ing: [
			['flour', 250],
			['tins', 1],
			['mozzarella', 125],
			['basil', 1]
		],
		st: [
			[null, 'Stretch the dough thin.'],
			[null, 'Spread the tomato, tear over the mozzarella.'],
			['Roast', 'at the hottest setting, 10 min.'],
			[null, 'Scatter the basil.']
		]
	},
	{
		slug: 'roast-chicken',
		title: 'Roast chicken',
		description: 'A whole chicken roasted over lemon and garlic.',
		minutes: 90,
		kcal: 720,
		cuisine: 'European',
		ing: [
			['wholechicken', 1],
			['lemon', 1],
			['garlic', 4],
			['potato', 800]
		],
		st: [
			['Roast', 'the chicken over the potatoes, 75 min at 200 °C.'],
			['Rest', 'the chicken 15 min before carving.']
		]
	},
	{
		slug: 'falafel-wraps',
		title: 'Falafel wraps',
		description: 'Crisp falafel in warm pitta with salad and yogurt.',
		minutes: 30,
		kcal: 640,
		cuisine: 'Middle Eastern',
		ing: [
			['chickpeas', 2],
			['onion', 1],
			['coriander', 1],
			['pitta', 4],
			['yogurt', 100],
			['tomato', 2]
		],
		st: [
			[null, 'Blitz the chickpeas with onion, coriander and spices.'],
			['Sear', 'small patties until crisp, 3 min a side.'],
			[null, 'Fill the pittas with falafel, salad and yogurt.']
		]
	},
	{
		slug: 'ratatouille',
		title: 'Ratatouille',
		description: 'Aubergine, courgette and peppers stewed in tomato.',
		minutes: 50,
		kcal: 320,
		cuisine: 'French',
		ing: [
			['aubergine', 1],
			['courgette', 2],
			['pepper', 2],
			['onion', 1],
			['tins', 1]
		],
		st: [
			['Sauté', 'the aubergine and courgette in batches.'],
			['Sweat', 'the onion and peppers, 8 min.'],
			['Simmer', 'everything with the tomatoes, 25 min.']
		]
	},
	{
		slug: 'pancakes',
		title: 'Pancakes',
		description: 'Thick pancakes with butter and berries.',
		minutes: 20,
		kcal: 520,
		cuisine: 'American',
		ing: [
			['flour', 200],
			['egg', 2],
			['milk', 300],
			['butter', 30],
			['berries', 150]
		],
		st: [
			[null, 'Whisk the flour, eggs and milk into a thick batter.'],
			['Sauté', 'ladlefuls in butter, 2 min a side.'],
			[null, 'Stack with berries.']
		]
	},
	{
		slug: 'porridge-berries',
		title: 'Porridge with berries',
		description: 'Oats cooked in milk, topped with berries.',
		minutes: 10,
		kcal: 380,
		cuisine: 'British',
		ing: [
			['oats', 80],
			['milk', 300],
			['berries', 100]
		],
		st: [
			['Simmer', 'the oats in the milk, stirring, 5 min.'],
			[null, 'Top with the berries.']
		]
	},
	{
		slug: 'pad-thai',
		title: 'Pad thai',
		description: 'Rice noodles with egg, tofu, lime and peanuts.',
		minutes: 25,
		kcal: 680,
		cuisine: 'Thai',
		ing: [
			['noodles', 200],
			['tofu', 200],
			['egg', 2],
			['lime', 1],
			['peanuts', 40]
		],
		st: [
			['Boil', 'the noodles, 4 min, then drain.'],
			['Sear', 'the tofu until golden.'],
			['Sauté', 'the noodles with the sauce and egg, 3 min.'],
			[null, 'Finish with lime and crushed peanuts.']
		]
	},
	{
		slug: 'potato-leek-soup',
		title: 'Potato & leek soup',
		description: 'A smooth, comforting soup of leeks and potatoes.',
		minutes: 35,
		kcal: 360,
		cuisine: 'French',
		ing: [
			['leek', 2],
			['potato', 500],
			['onion', 1],
			['cream', 50]
		],
		st: [
			['Sweat', 'the leeks and onion, 10 min.'],
			['Simmer', 'with the potatoes, 20 min.'],
			[null, 'Blend smooth and stir in the cream.']
		]
	},
	{
		slug: 'banana-bread',
		title: 'Banana bread',
		description: 'A moist loaf for the bananas going brown.',
		minutes: 70,
		kcal: 310,
		cuisine: 'American',
		ing: [
			['banana', 3],
			['flour', 200],
			['egg', 2],
			['butter', 100]
		],
		st: [
			[null, 'Mash the bananas and mix in the butter, eggs and flour.'],
			['Roast', 'in a loaf tin, 55 min at 175 °C.'],
			['Rest', '15 min before slicing.']
		]
	},
	{
		slug: 'caprese-salad',
		title: 'Caprese salad',
		description: 'Tomatoes, mozzarella and basil with olive oil.',
		minutes: 5,
		kcal: 340,
		cuisine: 'Italian',
		ing: [
			['tomato', 3],
			['mozzarella', 125],
			['basil', 1]
		],
		st: [
			[null, 'Slice the tomatoes and mozzarella.'],
			[null, 'Layer with basil, olive oil and salt.']
		]
	}
];

interface Member {
	key: string;
	name: string;
	color: string;
	plans?: boolean;
	shops?: boolean;
	cooks?: boolean;
}

interface Persona {
	key: string;
	name: string;
	members: Member[];
	/** [ingredient, quantity, days it keeps from today] */
	kitchen: [string, number, number][];
	/** [days from today, meal type, recipe slug, servings] */
	plan: [number, 'DINNER' | 'LUNCH', string, number][];
	/** [recipe slug, days ago] */
	made: [string, number][];
}

const PERSONAS: Persona[] = [
	{
		key: 'noor',
		name: 'Noor & Sam',
		members: [
			{ key: 'noor', name: 'Noor', color: '#4a8560', shops: false },
			{ key: 'sam', name: 'Sam', color: '#c2410c', plans: false, cooks: false }
		],
		kitchen: [
			['spinach', 550, 1],
			['cream', 200, 1],
			['feta', 120, 3],
			['egg', 6, 14],
			['tomato', 4, 3],
			['pepper', 1, 2],
			['onion', 4, 30],
			['garlic', 8, 30],
			['milk', 600, 2],
			['yogurt', 450, 3],
			['parmesan', 120, 20],
			['pasta', 500, 99],
			['rice', 800, 99],
			['chickpeas', 2, 99],
			['coconut', 1, 99],
			['tins', 2, 99],
			['lime', 1, 10]
		],
		plan: [
			[0, 'DINNER', 'spinach-feta-frittata', 2],
			[1, 'DINNER', 'spinach-chickpea-curry', 2],
			[2, 'DINNER', 'shakshuka', 2],
			[3, 'DINNER', 'chicken-tacos', 2],
			[5, 'DINNER', 'mushroom-risotto', 2],
			[6, 'DINNER', 'yogurt-chicken-traybake', 2]
		],
		made: [
			['tomato-basil-pasta', 2],
			['spinach-feta-frittata', 6],
			['spinach-chickpea-curry', 9],
			['red-lentil-dal', 13]
		]
	},
	{
		key: 'marc',
		name: 'Marc',
		members: [
			{ key: 'marc', name: 'Marc', color: '#2f4f7a' },
			{ key: 'ines', name: 'Ines', color: '#7a4f8a', plans: false, shops: false }
		],
		kitchen: [
			['onion', 5, 30],
			['garlic', 6, 30],
			['potato', 1500, 14],
			['carrot', 4, 8],
			['celery', 3, 6],
			['pasta', 1000, 99],
			['rice', 1000, 99],
			['beans', 2, 99],
			['tins', 3, 99],
			['lentils', 300, 99],
			['tomato', 6, 3],
			['pepper', 3, 4],
			['broccoli', 300, 3],
			['milk', 2000, 3],
			['yogurt', 1000, 4],
			['parmesan', 100, 20],
			['egg', 10, 14],
			['basil', 1, 2],
			['lemon', 2, 12]
		],
		plan: [
			[0, 'DINNER', 'bean-chili', 4],
			[1, 'DINNER', 'tomato-basil-pasta', 4],
			[2, 'DINNER', 'salmon-potatoes-greens', 4],
			[3, 'DINNER', 'chicken-tacos', 4],
			[4, 'DINNER', 'veg-lentil-soup', 4]
		],
		made: [
			['bean-chili', 7],
			['tomato-basil-pasta', 8],
			['veg-lentil-soup', 10],
			['salmon-potatoes-greens', 12]
		]
	},
	{
		key: 'lea',
		name: 'Lea',
		members: [{ key: 'lea', name: 'Lea', color: '#92560a' }],
		kitchen: [],
		plan: [],
		made: [
			['cheese-omelette', 3],
			['creamy-spinach-pasta', 8]
		]
	},
	{
		key: 'jonas',
		name: 'Jonas',
		members: [{ key: 'jonas', name: 'Jonas', color: '#5b6bb5' }],
		kitchen: [
			['rice', 1000, 99],
			['beans', 2, 99],
			['tins', 2, 99],
			['onion', 3, 30],
			['garlic', 6, 30],
			['egg', 12, 14],
			['broccoli', 250, 2],
			['tofu', 400, 6],
			['pepper', 1, 4],
			['parmesan', 60, 20],
			['tomato', 3, 3]
		],
		plan: [
			[0, 'LUNCH', 'chicken-rice-bowls', 1],
			[0, 'DINNER', 'cheese-omelette', 1],
			[1, 'LUNCH', 'chicken-rice-bowls', 1],
			[2, 'DINNER', 'tofu-broccoli-stir-fry', 1],
			[3, 'DINNER', 'chicken-tacos', 1]
		],
		made: [
			['chicken-rice-bowls', 2],
			['bean-chili', 5],
			['tofu-broccoli-stir-fry', 9]
		]
	}
];

interface Credit {
	file: string;
	author: string;
	licence: string;
	licenceUrl: string | null;
	sourceUrl: string;
}

const DAY_MS = 86_400_000;

function argument(name: string): string | undefined {
	const index = process.argv.indexOf(`--${name}`);
	return index >= 0 ? process.argv[index + 1] : undefined;
}

async function databaseUrl(): Promise<string> {
	if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
	const env = await readFile(join(process.cwd(), '.env'), 'utf8').catch(() => '');
	const line = env.split('\n').find((row) => row.startsWith('DATABASE_URL='));
	if (!line) throw new Error('Set DATABASE_URL (or put it in .env).');
	return line.slice('DATABASE_URL='.length).trim();
}

/** Midday, local time in `timeZone`, `days` days from today: when the app files a planned meal. */
function localNoon(days: number, timeZone: string): Date {
	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).formatToParts(new Date(Date.now() + days * DAY_MS));
	const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
	const utcNoon = Date.UTC(get('year'), get('month') - 1, get('day'), 12);
	const offsetHours =
		Number(
			new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hourCycle: 'h23' }).format(
				new Date(utcNoon)
			)
		) - 12;
	return new Date(utcNoon - offsetHours * 3_600_000);
}

function unitTypeOf(unit: string): 'WEIGHT' | 'VOLUME' | 'COUNT' {
	if (unit === 'g') return 'WEIGHT';
	if (unit === 'ml') return 'VOLUME';
	return 'COUNT';
}

async function main(): Promise<void> {
	const withPictures = !process.argv.includes('--no-pictures');
	const timeZone = argument('time-zone') ?? 'Europe/Brussels';
	const credits: Record<string, Credit> = withPictures
		? JSON.parse(
				await readFile(join(process.cwd(), 'static', 'seed', 'recipes', 'credits.json'), 'utf8')
			)
		: {};
	const client = new pg.Client({ connectionString: await databaseUrl() });
	await client.connect();

	try {
		await client.query('BEGIN');
		const emails = PERSONAS.flatMap((persona) =>
			persona.members.map((member) => `${member.key}@personas.local`)
		);
		const old = await client.query<{ household_id: string }>(
			`SELECT hm.household_id FROM household_members hm JOIN users u ON u.id = hm.user_id WHERE u.email = ANY($1)`,
			[emails]
		);
		await client.query(`DELETE FROM households WHERE id = ANY($1)`, [
			old.rows.map((row) => row.household_id)
		]);
		await client.query(`DELETE FROM users WHERE email = ANY($1)`, [emails]);

		for (const persona of PERSONAS) {
			const household = await client.query<{ id: string }>(
				`INSERT INTO households (name, time_zone) VALUES ($1, $2) RETURNING id`,
				[persona.name, timeZone]
			);
			const householdId = household.rows[0].id;
			const users: Record<string, string> = {};
			for (const member of persona.members) {
				const user = await client.query<{ id: string }>(
					`INSERT INTO users (email, name, role, auth_provider, auth_provider_id) VALUES ($1, $2, 'USER', 'seed', $3) RETURNING id`,
					[`${member.key}@personas.local`, member.name, `seed-${member.key}`]
				);
				users[member.key] = user.rows[0].id;
				await client.query(
					`INSERT INTO household_members (household_id, user_id, display_name, color, plans, shops, cooks) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
					[
						householdId,
						user.rows[0].id,
						member.name,
						member.color,
						member.plans ?? true,
						member.shops ?? true,
						member.cooks ?? true
					]
				);
				await client.query(
					`INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, now() + interval '30 days')`,
					[`seed-session-${member.key}`, user.rows[0].id]
				);
			}
			const ownerId = users[persona.members[0].key];

			const recipeIds: Record<string, string> = {};
			for (const [index, recipe] of RECIPES.entries()) {
				const credit = withPictures ? credits[recipe.slug] : undefined;
				const instructions = recipe.st
					.map(([verb, text]) => (verb ? `${verb} ${text}` : text))
					.join('\n');
				const columns = [
					'user_id',
					'household_id',
					'title',
					'description',
					'instructions',
					'servings',
					'prep_time',
					'cook_time',
					'cuisine_type',
					'estimated_calories',
					'source',
					'image_status',
					'created_at'
				];
				const values: unknown[] = [
					ownerId,
					householdId,
					recipe.title,
					recipe.description,
					instructions,
					2,
					Math.round(recipe.minutes / 3),
					recipe.minutes - Math.round(recipe.minutes / 3),
					recipe.cuisine,
					recipe.kcal,
					'GENERATED',
					credit ? 'DONE' : 'QUEUED',
					new Date(Date.now() - (60 - index) * DAY_MS)
				];
				if (credit) {
					columns.push('image_url', 'image_source', 'image_credit');
					values.push(`/seed/recipes/${credit.file}`, 'COMMONS', {
						author: credit.author,
						licence: credit.licence,
						licenceUrl: credit.licenceUrl,
						sourceUrl: credit.sourceUrl
					});
				}
				const placeholders = values.map((_, at) => `$${at + 1}`).join(', ');
				const inserted = await client.query<{ id: string }>(
					`INSERT INTO recipes (${columns.join(', ')}) VALUES (${placeholders}) RETURNING id`,
					values
				);
				const recipeId = inserted.rows[0].id;
				recipeIds[recipe.slug] = recipeId;
				for (const [at, [key, quantity]] of recipe.ing.entries()) {
					const [name, unit] = ING[key];
					await client.query(
						`INSERT INTO recipe_ingredients (recipe_id, name, quantity, unit, unit_type, order_index) VALUES ($1, $2, $3, $4, $5, $6)`,
						[recipeId, name.toLowerCase(), quantity, unit, unitTypeOf(unit), at]
					);
				}
				for (const [position, [verb, text]] of recipe.st.entries()) {
					const minutes = /(\d+) min/.exec(text);
					await client.query(
						`INSERT INTO recipe_steps (recipe_id, position, verb, text, minutes, technique_key) VALUES ($1, $2, $3, $4, $5, $6)`,
						[
							recipeId,
							position,
							verb,
							text,
							minutes ? Number(minutes[1]) : null,
							verb ? TECHNIQUE_KEYS[verb] : null
						]
					);
				}
			}

			const boughtAt = new Date(Date.now() - 2 * DAY_MS);
			for (const [key, quantity, keeps] of persona.kitchen) {
				const [name, unit] = ING[key];
				await client.query(
					`INSERT INTO kitchen_events (household_id, actor_user_id, occurred_at, kind, item_key, quantity, unit, expires_at, known, method, payload)
					 VALUES ($1, $2, $3, 'BOUGHT', $4, $5, $6, $7, true, 'RECEIPT', $8)`,
					[
						householdId,
						ownerId,
						boughtAt,
						name.toLowerCase(),
						quantity,
						unit || null,
						keeps >= 99 ? null : new Date(Date.now() + keeps * DAY_MS),
						{ name }
					]
				);
			}

			for (const [days, mealType, slug, servings] of persona.plan) {
				const recipe = RECIPES.find((row) => row.slug === slug)!;
				await client.query(
					`INSERT INTO planned_meals (user_id, household_id, recipe_id, meal_name, planned_date, planned_calories, meal_type, servings)
					 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
					[
						ownerId,
						householdId,
						recipeIds[slug],
						recipe.title,
						localNoon(days, timeZone),
						recipe.kcal,
						mealType,
						servings
					]
				);
			}

			for (const [slug, daysAgo] of persona.made) {
				await client.query(
					`INSERT INTO kitchen_events (household_id, actor_user_id, occurred_at, kind, recipe_id) VALUES ($1, $2, $3, 'COOKED', $4)`,
					[householdId, ownerId, new Date(Date.now() - daysAgo * DAY_MS), recipeIds[slug]]
				);
			}
			console.info(
				`${persona.name}: ${RECIPES.length} recipes, ${persona.plan.length} planned, ${persona.kitchen.length} at home.`
			);
		}
		await client.query('COMMIT');
	} catch (error) {
		await client.query('ROLLBACK');
		throw error;
	} finally {
		await client.end();
	}

	const pictured = RECIPES.filter((recipe) => withPictures && credits[recipe.slug]).length;
	console.info(`Recipes with a seed picture: ${pictured} of ${RECIPES.length}.`);
	console.info('Sign in by setting the `session` cookie to one of:');
	for (const member of PERSONAS.flatMap((persona) => persona.members)) {
		console.info(`  ${member.name}: seed-session-${member.key}`);
	}
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
