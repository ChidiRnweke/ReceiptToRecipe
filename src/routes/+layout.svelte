<script lang="ts">
  import "../app.css";
  import { Button } from "$lib/components/ui/button";
  import * as Avatar from "$lib/components/ui/avatar";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
  import WorkflowNav from "$lib/components/WorkflowNav.svelte";
  import { Settings, LogOut, Menu, X } from "lucide-svelte";
  import { setContext } from "svelte";
  import { WorkflowState } from "$lib/state/workflow.svelte";
  import logo from "$lib/assets/logo.svg";
  import favicon from "$lib/assets/favicon.svg";

  let { data, children } = $props();

  // Initialize state
  // FIX: Access data.workflowCounts safely inside a closure or directly
  let workflowState = new WorkflowState(data.workflowCounts ?? undefined);

  // Sync state when data changes (e.g. after navigation)
  $effect(() => {
    if (data.workflowCounts) {
      workflowState.sync(data.workflowCounts);
    }
  });

  // Provide to children
  setContext("workflowState", workflowState);

  let mobileMenuOpen = $state(false);
</script>

<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link
    rel="preconnect"
    href="https://fonts.gstatic.com"
    crossorigin="anonymous"
  />
  <link
    href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Newsreader:ital,wght@0,400;0,500;0,600;1,400&display=swap"
    rel="stylesheet"
  />
  <link rel="icon" href={favicon} />
</svelte:head>

<div class="min-h-screen bg-bg-paper">
  <!-- Header -->
  <header
    class="sticky top-0 z-50 border-b border-border bg-bg-paper/95 backdrop-blur-sm"
  >
    <div
      class="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8"
    >
      <!-- Logo -->
      <a href="/" class="flex items-center gap-3 group">
        <img
          src={logo}
          alt="Receipt2Recipe Logo"
          class="h-8 w-8 transition-transform duration-500 group-hover:rotate-6"
        />
        <span
          class="font-serif text-2xl font-medium tracking-tight text-text-primary"
          >Receipt2Recipe</span
        >
      </a>

      <!-- Desktop Navigation -->
      {#if data.user}
        <WorkflowNav state={workflowState} />
      {/if}

      <!-- User Menu -->
      <div class="flex items-center gap-4">
        {#if data.user}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              <Avatar.Root class="h-9 w-9 cursor-pointer">
                <Avatar.Image src={data.user.avatarUrl} alt={data.user.name} />
                <Avatar.Fallback class="bg-primary-100 text-primary-700">
                  {data.user.name.slice(0, 2).toUpperCase()}
                </Avatar.Fallback>
              </Avatar.Root>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end" class="w-56">
              <DropdownMenu.Label class="font-normal">
                <div class="flex flex-col space-y-1">
                  <p class="text-sm font-medium leading-none">
                    {data.user.name}
                  </p>
                  <p class="text-xs leading-none text-text-muted">
                    {data.user.email}
                  </p>
                </div>
              </DropdownMenu.Label>
              <DropdownMenu.Separator />
              <DropdownMenu.Item>
                <a href="/preferences" class="flex w-full items-center">
                  <Settings class="mr-2 h-4 w-4" />
                  Preferences
                </a>
              </DropdownMenu.Item>
              <DropdownMenu.Separator />
              <DropdownMenu.Item>
                <a
                  href="/logout"
                  data-sveltekit-reload
                  class="flex w-full items-center"
                >
                  <LogOut class="mr-2 h-4 w-4" />
                  Log out
                </a>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>

          <!-- Mobile Menu Button -->
          <button
            class="rounded-lg p-2 text-text-secondary hover:bg-bg-paper-dark md:hidden"
            onclick={() => (mobileMenuOpen = !mobileMenuOpen)}
          >
            {#if mobileMenuOpen}
              <X class="h-5 w-5" />
            {:else}
              <Menu class="h-5 w-5" />
            {/if}
          </button>
        {:else}
          <div class="flex items-center gap-2">
            <Button href="/login">Start here</Button>
          </div>
        {/if}
      </div>
    </div>

    <!-- Mobile Navigation -->
    {#if mobileMenuOpen && data.user}
      <button
        type="button"
        class="block w-full border-t border-border bg-bg-paper px-4 py-3 text-left md:hidden"
        onclick={() => (mobileMenuOpen = false)}
      >
        <WorkflowNav state={workflowState} />
      </button>
    {/if}
  </header>

  <!-- Main Content -->
  <main class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
    {@render children()}
  </main>

  <!-- Footer -->
  <footer class="border-t border-border bg-bg-paper-dark">
    <div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <p class="text-center text-sm text-text-muted">
        Receipt2Recipe - Transform your groceries into delicious meals
      </p>
    </div>
  </footer>
</div>
