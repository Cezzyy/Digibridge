<script setup lang="ts">
import type { SchoolLinkInput } from '@digibridge/shared'
import { computed, onMounted, ref, useTemplateRef } from 'vue'
import ConfirmDialog from '../../components/admin/ConfirmDialog.vue'
import LinkCard from '../../components/admin/LinkCard.vue'
import LinkForm from '../../components/admin/LinkForm.vue'
import { useSchoolLinks, type SchoolLinkRow } from '../../composables/useSchoolLinks'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '../../lib/buttons'

// School links (LNK-01), admin only: make a link for a class, copy it to send to the students,
// see each link's school, expiry, status and how many have started, and close it. With no links
// yet, the form is already open.
const { links, loadError, load, creating, createError, create, closingId, closeError, close } =
  useSchoolLinks()
onMounted(load)

const formOpen = ref(false)
const showForm = computed(() => formOpen.value || links.value?.length === 0)
const form = useTemplateRef('form')

/** The link just made, outlined in the list until another is made. */
const newId = ref<string | null>(null)

async function submit(input: SchoolLinkInput) {
  const link = await create(input)
  if (!link) return
  newId.value = link.id
  formOpen.value = false
  form.value?.reset()
}

// Closing asks first: students who haven't started can't use the link after that.
const closing = ref<SchoolLinkRow | null>(null)
async function confirmClose() {
  if (closing.value && (await close(closing.value.id))) closing.value = null
}
const newLabel = computed(() => links.value?.find((link) => link.id === newId.value)?.label)
</script>

<template>
  <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <h1 class="text-3xl leading-tight font-bold sm:text-4xl">School links</h1>
      <p class="mt-2 max-w-2xl text-lg text-quiet">
        Make a link for a class, then send it only to the students you choose. They open it on their
        own phone or laptop, without signing in.
      </p>
    </div>
    <button
      v-if="links && !showForm"
      type="button"
      :class="PRIMARY_BUTTON"
      class="shrink-0"
      @click="formOpen = true"
    >
      New link
    </button>
  </div>

  <LinkForm
    v-if="showForm"
    ref="form"
    class="mt-8"
    :creating="creating"
    :error="createError"
    :cancellable="(links?.length ?? 0) > 0"
    @submit="submit"
    @cancel="formOpen = false"
  />

  <p
    v-if="newLabel && !showForm"
    role="status"
    class="mt-8 rounded-card bg-evergreen-soft p-4 font-semibold text-evergreen"
  >
    The link for {{ newLabel }} is ready. Copy it below and send it to the students.
  </p>

  <section aria-labelledby="links-heading" class="mt-10">
    <h2 id="links-heading" class="text-xl font-bold">Your links</h2>

    <div
      v-if="loadError"
      role="alert"
      class="mt-4 flex flex-col gap-4 rounded-card bg-error-soft p-5 sm:flex-row sm:items-center sm:justify-between"
    >
      <p class="font-semibold text-error">{{ loadError }}</p>
      <button type="button" :class="SECONDARY_BUTTON" class="bg-surface" @click="load">
        Try again
      </button>
    </div>

    <ul v-else-if="!links" class="mt-4 space-y-4" aria-busy="true">
      <li v-for="n in 3" :key="n" class="rounded-card border border-line bg-surface p-6">
        <span class="sr-only">Loading</span>
        <span class="block h-6 w-40 rounded bg-track motion-safe:animate-pulse" />
        <span class="mt-3 block h-4 w-64 max-w-full rounded bg-track motion-safe:animate-pulse" />
        <span class="mt-5 block h-4 w-full rounded bg-track motion-safe:animate-pulse" />
      </li>
    </ul>

    <p v-else-if="links.length === 0" class="mt-4 rounded-card bg-mist-soft p-5 text-quiet">
      No school links yet. Make the first one above.
    </p>

    <ul v-else class="mt-4 space-y-4">
      <li v-for="link in links" :key="link.id">
        <LinkCard :link="link" :is-new="link.id === newId" @close="closing = link" />
      </li>
    </ul>
  </section>

  <ConfirmDialog
    :open="closing !== null"
    :title="`Close ${closing?.label ?? 'this link'}?`"
    message="Students who haven’t started yet won’t be able to use it. Anyone already taking the assessment can still finish. You can’t open it again, but you can make a new link."
    confirm-label="Close link"
    busy-label="Closing…"
    :busy="closingId !== null"
    :error="closeError"
    @confirm="confirmClose"
    @close="closing = null"
  />
</template>
