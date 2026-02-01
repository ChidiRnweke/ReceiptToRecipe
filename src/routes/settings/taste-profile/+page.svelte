<script lang="ts">
    import { enhance } from '$app/forms';
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import { Badge } from "$lib/components/ui/badge";
    import { Plus, X, Heart, ThumbsDown, AlertTriangle, ChefHat, Salad, Utensils } from 'lucide-svelte';
    import Notepad from "$lib/components/Notepad.svelte";
    import PinnedNote from "$lib/components/PinnedNote.svelte";
    import WashiTape from "$lib/components/WashiTape.svelte";

    let { data } = $props();
    let profile = $derived(data.profile);

    let newAllergen = $state('');
    let newIngredient = $state('');
    let ingredientPrefLevel = $state('dislike');

    const commonAllergens = ['Peanuts', 'Tree Nuts', 'Dairy', 'Gluten', 'Shellfish', 'Eggs', 'Soy', 'Sesame'];
    const dietTypes = [
        { value: 'omnivore', label: 'Omnivore', desc: 'No restrictions' },
        { value: 'vegetarian', label: 'Vegetarian', desc: 'No meat' },
        { value: 'vegan', label: 'Vegan', desc: 'No animal products' },
        { value: 'pescatarian', label: 'Pescatarian', desc: 'Fish, no meat' },
        { value: 'keto', label: 'Keto', desc: 'Low carb, high fat' },
        { value: 'paleo', label: 'Paleo', desc: 'No grains, dairy, legumes' }
    ];
    const cuisines = ['Italian', 'Mexican', 'Thai', 'Indian', 'Japanese', 'Mediterranean', 'French', 'American'];

    function getDietLabel(value: string) {
        return dietTypes.find(d => d.value === value)?.label || value;
    }
</script>

<div class="space-y-10 pb-20">
    
    <!-- Diet Type -->
    <section>
        <div class="flex items-center gap-2 mb-4">
            <Salad class="h-5 w-5 text-sage-600" />
            <h2 class="font-display text-2xl text-ink">Dietary Lifestyle</h2>
        </div>
        
        <Notepad class="bg-white/50">
            <div class="p-6">
                <form method="POST" action="?/setDiet" use:enhance>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {#each dietTypes as diet}
                            <label class="flex items-start space-x-3 border rounded-lg p-4 hover:bg-stone-50 transition-colors cursor-pointer 
                                {profile.dietType === diet.value ? 'border-sage-500 bg-sage-50' : 'border-stone-200'}">
                                <input 
                                    type="radio" 
                                    name="dietType" 
                                    value={diet.value} 
                                    checked={profile.dietType === diet.value}
                                    class="mt-1.5 h-4 w-4 text-sage-600 border-stone-300 focus:ring-sage-500"
                                />
                                <div class="grid gap-1">
                                    <span class="font-medium font-serif text-lg">{diet.label}</span>
                                    <span class="text-xs text-stone-500 font-sans">{diet.desc}</span>
                                </div>
                            </label>
                        {/each}
                    </div>
                    <div class="mt-6 flex justify-end">
                        <Button type="submit" variant="default" class="bg-ink text-white">Save Diet</Button>
                    </div>
                </form>
            </div>
        </Notepad>
    </section>

    <!-- Allergies -->
    <section>
        <div class="flex items-center gap-2 mb-4">
            <AlertTriangle class="h-5 w-5 text-amber-600" />
            <h2 class="font-display text-2xl text-ink">Allergies & Intolerances</h2>
        </div>

        <div class="bg-white rounded-xl border border-stone-200 p-6 shadow-sm relative overflow-hidden">
            <div class="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                <AlertTriangle class="h-32 w-32" />
            </div>

            <div class="flex flex-wrap gap-2 mb-6">
                {#each profile.allergies as allergy}
                    <Badge variant={allergy.severity === 'severe' ? 'destructive' : 'secondary'} class="pl-2 pr-1 py-1 text-sm gap-1">
                        {allergy.allergen}
                        <form method="POST" action="?/removeAllergy" use:enhance class="inline-flex">
                            <input type="hidden" name="allergen" value={allergy.allergen} />
                            <button type="submit" class="ml-1 hover:text-white/80"><X class="h-3 w-3" /></button>
                        </form>
                    </Badge>
                {/each}
                {#if profile.allergies.length === 0}
                    <span class="text-stone-400 italic text-sm">No allergies listed.</span>
                {/if}
            </div>

            <div class="space-y-4 max-w-md">
                <p class="text-sm font-medium text-ink-light">Add Common Allergens:</p>
                <div class="flex flex-wrap gap-2">
                    {#each commonAllergens as ca}
                        {#if !profile.allergies.find(a => a.allergen.toLowerCase() === ca.toLowerCase())}
                            <form method="POST" action="?/addAllergy" use:enhance class="inline-block">
                                <input type="hidden" name="allergen" value={ca} />
                                <button type="submit" class="px-3 py-1 rounded-full border border-stone-200 text-xs hover:border-amber-400 hover:bg-amber-50 transition-colors">
                                    + {ca}
                                </button>
                            </form>
                        {/if}
                    {/each}
                </div>

                <div class="pt-4 border-t border-dashed border-stone-200">
                    <form method="POST" action="?/addAllergy" use:enhance class="flex gap-2 items-end">
                        <div class="grid gap-1.5 flex-1">
                            <Label for="custom-allergen">Custom Allergen</Label>
                            <Input type="text" id="custom-allergen" name="allergen" placeholder="e.g. Strawberries" />
                        </div>
                        <div class="grid gap-1.5 w-32">
                            <Label for="severity">Severity</Label>
                            <select name="severity" id="severity" class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                                <option value="avoid">Avoid</option>
                                <option value="severe">Severe</option>
                            </select>
                        </div>
                        <Button type="submit" size="icon" variant="outline"><Plus class="h-4 w-4" /></Button>
                    </form>
                </div>
            </div>
        </div>
    </section>

    <!-- Ingredients -->
    <section>
        <div class="flex items-center gap-2 mb-4">
            <Utensils class="h-5 w-5 text-ink-muted" />
            <h2 class="font-display text-2xl text-ink">Ingredient Preferences</h2>
        </div>

        <div class="grid md:grid-cols-2 gap-6">
            <!-- Loves -->
            <PinnedNote color="yellow" rotate="-rotate-1">
                <div class="flex items-center gap-2 mb-4 border-b border-amber-200 pb-2">
                    <Heart class="h-4 w-4 text-red-500 fill-red-500" />
                    <h3 class="font-serif font-bold text-lg">I Love</h3>
                </div>
                <div class="flex flex-wrap gap-2 mb-4">
                    {#each profile.ingredientPreferences.filter(p => p.preference === 'love') as pref}
                        <span class="inline-flex items-center bg-white px-2 py-1 rounded shadow-sm text-sm border border-amber-100">
                            {pref.ingredientName}
                            <form method="POST" action="?/removeIngredientPref" use:enhance class="inline-flex ml-1">
                                <input type="hidden" name="ingredient" value={pref.ingredientName} />
                                <button class="text-stone-400 hover:text-red-500"><X class="h-3 w-3" /></button>
                            </form>
                        </span>
                    {/each}
                </div>
                <form method="POST" action="?/setIngredientPref" use:enhance class="flex gap-2">
                    <input type="hidden" name="preference" value="love" />
                    <Input name="ingredient" placeholder="Add ingredient..." class="bg-white/80 h-8 text-sm" />
                    <Button type="submit" size="sm" variant="ghost" class="h-8 w-8 p-0"><Plus class="h-4 w-4" /></Button>
                </form>
            </PinnedNote>

            <!-- Dislikes -->
            <div class="relative bg-stone-100 p-6 rounded-xl border border-stone-200 rotate-1 shadow-sm">
                <div class="absolute -top-3 left-1/2 -translate-x-1/2">
                    <WashiTape color="white" width="w-24" />
                </div>
                <div class="flex items-center gap-2 mb-4 border-b border-stone-200 pb-2 mt-2">
                    <ThumbsDown class="h-4 w-4 text-stone-500" />
                    <h3 class="font-serif font-bold text-lg text-stone-600">I Avoid / Dislike</h3>
                </div>
                <div class="flex flex-wrap gap-2 mb-4">
                    {#each profile.ingredientPreferences.filter(p => ['dislike', 'avoid'].includes(p.preference)) as pref}
                        <span class="inline-flex items-center bg-white px-2 py-1 rounded shadow-sm text-sm border border-stone-200 text-stone-600">
                            {pref.ingredientName}
                            <form method="POST" action="?/removeIngredientPref" use:enhance class="inline-flex ml-1">
                                <input type="hidden" name="ingredient" value={pref.ingredientName} />
                                <button class="text-stone-400 hover:text-red-500"><X class="h-3 w-3" /></button>
                            </form>
                        </span>
                    {/each}
                </div>
                <form method="POST" action="?/setIngredientPref" use:enhance class="flex gap-2">
                    <select name="preference" class="h-8 text-xs rounded border-stone-200">
                        <option value="dislike">Dislike</option>
                        <option value="avoid">Avoid</option>
                    </select>
                    <Input name="ingredient" placeholder="Add ingredient..." class="bg-white h-8 text-sm" />
                    <Button type="submit" size="sm" variant="ghost" class="h-8 w-8 p-0"><Plus class="h-4 w-4" /></Button>
                </form>
            </div>
        </div>
    </section>

    <!-- Cuisines -->
    <section>
        <div class="flex items-center gap-2 mb-4">
            <ChefHat class="h-5 w-5 text-ink-muted" />
            <h2 class="font-display text-2xl text-ink">Cuisines</h2>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {#each cuisines as cuisine}
                {@const pref = profile.cuisinePreferences.find(c => c.cuisineType === cuisine)}
                <div class="bg-white p-4 rounded-lg border shadow-sm flex flex-col items-center gap-3 transition-colors
                    {pref?.preference === 'love' ? 'border-sage-400 bg-sage-50' : 
                     pref?.preference === 'dislike' ? 'border-stone-200 opacity-60 bg-stone-50' : 'border-stone-200 hover:border-stone-300'}">
                    <span class="font-serif font-medium">{cuisine}</span>
                    <div class="flex gap-2">
                        <form method="POST" action="?/setCuisinePref" use:enhance>
                            <input type="hidden" name="cuisine" value={cuisine} />
                            <input type="hidden" name="preference" value={pref?.preference === 'dislike' ? 'neutral' : 'dislike'} />
                            <button type="submit" class="p-1 rounded hover:bg-stone-200 {pref?.preference === 'dislike' ? 'text-red-500' : 'text-stone-300'}">
                                <ThumbsDown class="h-4 w-4" />
                            </button>
                        </form>
                        <form method="POST" action="?/setCuisinePref" use:enhance>
                            <input type="hidden" name="cuisine" value={cuisine} />
                            <input type="hidden" name="preference" value={pref?.preference === 'love' ? 'neutral' : 'love'} />
                            <button type="submit" class="p-1 rounded hover:bg-sage-200 {pref?.preference === 'love' ? 'text-red-500 fill-red-500' : 'text-stone-300'}">
                                <Heart class="h-4 w-4" />
                            </button>
                        </form>
                    </div>
                </div>
            {/each}
        </div>
    </section>
</div>
