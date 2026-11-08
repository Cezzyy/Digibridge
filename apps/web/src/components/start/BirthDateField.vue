<script setup lang="ts">
import { ageOn, birthDateRange, birthDateSchema } from '@digibridge/shared'
import { computed } from 'vue'
import { useToday } from '../../composables/useToday'
import DateField from '../form/DateField.vue'

// Date of birth (PRO-01): a DateField limited to ages AGE_MIN to AGE_MAX today in the
// Philippines. The calendar opens on the year someone turning 18 was born, and a date the
// profile takes is confirmed with the age it gives. All of it follows the date if the page
// stays open past midnight.

defineProps<{ error?: string | null }>()
const model = defineModel<string | null>({ required: true })
const emit = defineEmits<{ touch: [] }>()

const today = useToday()
const range = computed(() => birthDateRange(today.value))
const startYear = computed(() => Number(today.value.slice(0, 4)) - 18)

const confirmation = computed(() => {
  const on = today.value // read first, so a new day runs the check again
  return model.value && birthDateSchema.safeParse(model.value).success
    ? `You’re ${ageOn(model.value, on)} years old.`
    : null
})
</script>

<template>
  <DateField
    v-model="model"
    label="Date of birth"
    hint="Type it as MM/DD/YYYY, or pick it on the calendar."
    :error="error"
    :confirmation="confirmation"
    :min="range.earliest"
    :max="range.latest"
    :start-year="startYear"
    @touch="emit('touch')"
  />
</template>
