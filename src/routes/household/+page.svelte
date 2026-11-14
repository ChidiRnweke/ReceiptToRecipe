<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import SubmitButton from '$lib/components/SubmitButton.svelte';
	import Notepad from '$lib/components/Notepad.svelte';
	import { ArrowLeft, Users, Link, Copy, Check } from 'lucide-svelte';

	let { data, form } = $props();

	let inviting = $state(false);
	let copied = $state(false);

	const roleLabels = [
		{ key: 'plans', label: 'Plans meals' },
		{ key: 'shops', label: 'Shops' },
		{ key: 'cooks', label: 'Cooks' }
	] as const;

	type RoleKey = (typeof roleLabels)[number]['key'];

	function rolesWith(
		roles: { plans: boolean; shops: boolean; cooks: boolean },
		key: RoleKey
	): Record<RoleKey, boolean> {
		return { ...roles, [key]: !roles[key] };
	}

	async function copyInvite(link: string) {
		await navigator.clipboard.writeText(link);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}
</script>

<svelte:head>
	<title>Household - Receipt2Recipe</title>
</svelte:head>

<div class="font-ui relative min-h-screen overflow-x-hidden bg-bg-paper p-4 md:p-8">
	<div
		class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(113,128,150,0.08),transparent_30%),radial-gradient(circle_at_90%_15%,rgba(237,137,54,0.08),transparent_28%)]"
	></div>

	<div class="relative z-10 mx-auto max-w-3xl">
		<div class="mb-8">
			<Button
				href="/"
				variant="ghost"
				class="pl-0 font-serif text-text-muted hover:bg-transparent hover:text-ink"
			>
				<ArrowLeft class="mr-2 h-4 w-4" />
				Back to Kitchen
			</Button>
			<h1
				class="font-display mt-2 text-4xl leading-[0.9] text-ink drop-shadow-[0_1px_0_rgba(255,255,255,0.8)] md:text-5xl"
			>
				{data.household.name}
			</h1>
			<p class="mt-3 max-w-2xl font-serif text-lg text-ink-light italic">
				Everyone here shares the same receipts, recipes, cupboard, shopping list and meal plan.
			</p>
		</div>

		<Notepad class="w-full shadow-[0_10px_40px_-15px_rgba(0,0,0,0.1)]">
			<div class="space-y-10 p-4 sm:p-8">
				{#if form && 'error' in form && form.error}
					<div
						class="font-hand -rotate-1 rounded-sm border border-sienna-200 bg-sienna-50 p-4 text-center text-xl text-sienna-800 shadow-sm"
					>
						{form.error}
					</div>
				{/if}

				<section>
					<div class="mb-4 flex items-center gap-3 border-b-2 border-text-primary pb-2">
						<Users class="h-5 w-5 text-sage-600" />
						<h2 class="font-hand pt-1 text-3xl font-bold text-ink">Members</h2>
					</div>

					<ul class="space-y-4">
						{#each data.members as member (member.id)}
							<li
								class="flex flex-col gap-3 border-b border-dashed border-stone-200 pb-4 sm:flex-row sm:items-center sm:justify-between"
							>
								<span class="font-serif text-lg text-ink">
									{member.displayName}
									{#if member.id === data.currentMemberId}
										<span class="text-sm text-text-muted italic">(you)</span>
									{/if}
								</span>
								<div class="flex flex-wrap gap-2">
									{#each roleLabels as role (role.key)}
										{@const next = rolesWith(member.roles, role.key)}
										<form method="POST" action="?/setRoles" use:enhance>
											<input type="hidden" name="memberId" value={member.id} />
											<input type="hidden" name="plans" value={String(next.plans)} />
											<input type="hidden" name="shops" value={String(next.shops)} />
											<input type="hidden" name="cooks" value={String(next.cooks)} />
											<button
												type="submit"
												aria-pressed={member.roles[role.key]}
												class="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200
													{member.roles[role.key]
													? 'border border-sage-300 bg-sage-100 text-sage-900'
													: 'border border-stone-200 bg-stone-100 text-stone-600 hover:bg-stone-200 hover:text-stone-800'}"
											>
												{role.label}
											</button>
										</form>
									{/each}
								</div>
							</li>
						{/each}
					</ul>
				</section>

				<section>
					<div class="mb-4 flex items-center gap-3 border-b-2 border-text-primary pb-2">
						<Link class="h-5 w-5 text-sienna-600" />
						<h2 class="font-hand pt-1 text-3xl font-bold text-ink">Invite someone</h2>
					</div>
					<p class="mb-4 font-serif text-sm text-ink-light italic">
						Share the link with the person you live with. It works once and expires in 7 days.
					</p>

					<form
						method="POST"
						action="?/invite"
						use:enhance={() => {
							inviting = true;
							return async ({ update }) => {
								inviting = false;
								await update({ reset: false });
							};
						}}
					>
						<SubmitButton loading={inviting} loadingText="Creating link...">
							Invite someone
						</SubmitButton>
					</form>

					{#if form && 'inviteUrl' in form && form.inviteUrl}
						{@const inviteUrl = form.inviteUrl}
						<div class="mt-4 flex max-w-xl gap-2">
							<Input
								readonly
								value={inviteUrl}
								aria-label="Invite link"
								class="font-mono text-sm"
							/>
							<Button type="button" variant="outline" onclick={() => copyInvite(inviteUrl)}>
								{#if copied}
									<Check class="mr-2 h-4 w-4" /> Copied
								{:else}
									<Copy class="mr-2 h-4 w-4" /> Copy
								{/if}
							</Button>
						</div>
					{/if}
				</section>
			</div>
		</Notepad>
	</div>
</div>
