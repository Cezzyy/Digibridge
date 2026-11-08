<script setup lang="ts">
import { ageOn, birthDateRange, birthDateSchema, todayInPhilippines } from '@digibridge/shared'
import { computed } from 'vue'
import DateField from '../form/DateField.vue'

// Date of birth (PRO-01): a DateField limited to ages AGE_MIN to AGE_MAX today in the
// Philippines. The calendar opens on the year someone turning 18 was born, and a date the
// profile takes is confirmed with the age it gives.

defineProps<{ error?: string | null }>()
const model = defineModel<string | null>({ required: true })
const emit = defineEmits<{ touch: [] }>()

const today = todayInPhilippines()
const { earliest, latest } = birthDateRange(today)
const startYear = Number(today.slice(0, 4)) - 18

const confirmation = computed(() =>
  model.value && birthDateSchema.safeParse(model.value).success
    ? `You’re ${ageOn(model.value, today)} years old.`
    : null,
)
</script>

<template>
  <DateField
    v-model="model"
    label="Date of birth"
    hint="Type it as MM/DD/YYYY, or pick it on the calendar."
    :error="error"
    :confirmation="confirmation"
    :min="earliest"
    :max="latest"
    :start-year="startYear"
    @touch="emit('touch')"
  />
</template>
