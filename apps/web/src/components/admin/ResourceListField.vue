<script setup lang="ts">
import { nextTick, useId } from 'vue'
import { SECONDARY_BUTTON } from '../../lib/buttons'
import TextField from '../form/TextField.vue'
import { ICONS } from './admin-icons'
import type { ResourceDraft, ResourceIssues } from './lesson-text'
import StrokeIcon from './StrokeIcon.vue'

// A lesson's outside resources (LES-02): a name and a link per row, shown under the lesson as
// Learn more. Rows can be added up to `max` and removed. `errors` holds each row's problems.

defineProps<{ max: number; errors: ResourceIssues }>()
const model = defineModel<ResourceDraft[]>({ required: true })

const id = useId()
const nameId = (i: number) => `${id}-row-${i}`

function update(i: number, field: keyof ResourceDraft, value: string) {
  model.value = model.value.map((row, j) => (j === i ? { ...row, [field]: value } : row))
}

async function add() {
  model.value = [...model.value, { label: '', url: '' }]
  await nextTick()
  document
    .getElementById(nameId(model.value.length - 1))
    ?.querySelector('input')
    ?.focus()
}

function remove(i: number) {
  model.value = model.value.filter((_, j) => j !== i)
}
</script>

<template>
  <fieldset>
    <legend class="text-lg font-semibold">Learn more</legend>
    <p class="mt-0.5 text-quiet">
      Optional. Other sites for students who want to go further, up to {{ max }}.
    </p>

    <ol v-if="model.length" class="mt-4 space-y-4">
      <li
        v-for="(resource, i) in model"
        :id="nameId(i)"
        :key="i"
        class="rounded-card border border-line bg-mist-soft p-4"
      >
        <div class="flex items-center justify-between gap-3">
          <p class="font-semibold text-quiet">Resource {{ i + 1 }}</p>
          <button
            type="button"
            class="inline-flex min-h-11 items-center gap-1.5 px-2 text-sm font-semibold text-error hover:underline"
            @click="remove(i)"
          >
            <StrokeIcon :d="ICONS.cross" class="size-4" />
            Remove<span class="sr-only">&nbsp;resource {{ i + 1 }}</span>
          </button>
        </div>
        <div class="mt-2 grid gap-4">
          <TextField
            :model-value="resource.label"
            label="Name"
            hint="What students see, like National Privacy Commission."
            :error="errors[i]?.label"
            autocomplete="off"
            @update:model-value="(value) => update(i, 'label', value)"
          />
          <TextField
            :model-value="resource.url"
            label="Link"
            :error="errors[i]?.url"
            inputmode="url"
            autocomplete="off"
            @update:model-value="(value) => update(i, 'url', value)"
          />
        </div>
      </li>
    </ol>

    <button
      v-if="model.length < max"
      type="button"
      :class="SECONDARY_BUTTON"
      class="mt-4"
      @click="add"
    >
      <StrokeIcon :d="ICONS.plus" class="size-5" />
      Add a resource
    </button>
  </fieldset>
</template>
