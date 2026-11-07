<template>
  <main class="mx-auto max-w-xl px-4 py-12 sm:py-20">
    <h1 class="text-2xl font-bold">Page not found</h1>
    <p class="mt-3 text-quiet">This page doesn't exist. It may have moved.</p>
    <RouterLink
      :to="{ name: 'landing' }"
      class="mt-6 inline-flex min-h-11 items-center rounded-control bg-evergreen px-6 font-semibold text-white hover:bg-evergreen-hover"
    >
      Go to the home page
    </RouterLink>
  </main>
</template>
