<script setup lang="ts">
import {
  AREA_CODES,
  AREA_LABELS,
  LESSON_BODY_MAX,
  LESSON_RESOURCES_MAX,
  LESSON_SUMMARY_MAX,
  LESSON_TIER_LABELS,
  LESSON_TIERS,
  LESSON_TITLE_MAX,
  lessonInputSchema,
  LEVEL_LABELS,
  levelsForLessonTier,
  slugFromTitle,
  type AreaCode,
  type LessonInput,
  type LessonTier,
} from '@digibridge/shared'
import { computed, onUnmounted, ref, watch } from 'vue'
import type { AdminLessonRow } from '../../composables/useAdminLessons'
import type { AdminLesson } from '../../composables/useLessonEditor'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '../../lib/buttons'
import SelectField from '../form/SelectField.vue'
import TextAreaField from '../form/TextAreaField.vue'
import TextField from '../form/TextField.vue'
import FormSection from '../start/FormSection.vue'
import LessonPreview from './LessonPreview.vue'
import MarkdownEditor from './MarkdownEditor.vue'
import type { ResourceDraft, ResourceIssues } from './lesson-text'
import ResourceListField from './ResourceListField.vue'

// The lessons editor (CMS-04): a lesson's place in the library (area and tier), its card
// (title, slug, summary), its Markdown body, and its picture, video and outside resources
// (LES-02), with a live preview beside the form from `xl` and behind a Preview button below
// that. Checked with the API's own schema; errors show once Save or Publish is pressed, then
// follow each change. The page does the saving and asks before a publish replaces another
// lesson or an unpublish or a move leaves the place empty; after a save it passes the saved lesson back
// in `lesson`, and the form starts again from it, keeping anything typed while it saved.
// `dirty` tells the page about unsaved changes.

const props = defineProps<{
  /** The saved lesson, or null for a new one. */
  lesson: AdminLesson | null
  /** For a new lesson: where it goes, from the list's Write this lesson link. */
  start?: { area?: AreaCode; tier?: LessonTier }
  /** Every lesson, to tell what a publish would replace; null while it loads. */
  lessons: AdminLessonRow[] | null
  saving: boolean
  error: string | null
}>()
const emit = defineEmits<{ save: [input: LessonInput, replaces: AdminLessonRow | null] }>()
const dirty = defineModel<boolean>('dirty', { default: false })

type Draft = {
  area: AreaCode
  tier: LessonTier
  slug: string
  title: string
  summary: string
  bodyMd: string
  imageUrl: string
  videoUrl: string
  resources: ResourceDraft[]
}

const draftOf = (lesson: AdminLesson | null): Draft => ({
  area: lesson?.area ?? props.start?.area ?? AREA_CODES[0],
  tier: lesson?.tier ?? props.start?.tier ?? LESSON_TIERS[0],
  slug: lesson?.slug ?? '',
  title: lesson?.title ?? '',
  summary: lesson?.summary ?? '',
  bodyMd: lesson?.bodyMd ?? '',
  imageUrl: lesson?.imageUrl ?? '',
  videoUrl: lesson?.videoUrl ?? '',
  resources: lesson?.resources.map((r) => ({ ...r })) ?? [],
})

const draft = ref<Draft>(draftOf(props.lesson))
const snapshot = () => JSON.stringify(draft.value)
const saved = ref(snapshot())
/** A saved lesson keeps its slug, since changing it changes the lesson's address. */
const slugEdited = ref(props.lesson !== null)
const tried = ref(false)
/** The draft as it was when Save was pressed, to tell whether it changed while saving. */
let sent: string | null = null

watch(
  () => props.lesson,
  (lesson) => {
    const next = draftOf(lesson)
    // The fields stay open while saving, so keep anything typed since Save was pressed: it
    // stays unsaved against the lesson that came back.
    const typedSince = lesson !== null && sent !== null && snapshot() !== sent
    if (!typedSince) Object.assign(draft.value, next)
    saved.value = JSON.stringify(next)
    sent = null
    slugEdited.value = lesson !== null
    tried.value = false
  },
)
watch(
  () => draft.value.title,
  (title) => {
    if (!slugEdited.value) draft.value.slug = slugFromTitle(title)
  },
)

const unsaved = computed(() => snapshot() !== saved.value)
watch(unsaved, (value) => (dirty.value = value), { immediate: true })

const AREA_OPTIONS = AREA_CODES.map((code) => ({ value: code, label: AREA_LABELS[code] }))
const TIER_OPTIONS = LESSON_TIERS.map((tier) => ({ value: tier, label: LESSON_TIER_LABELS[tier] }))
const and = new Intl.ListFormat('en', { type: 'conjunction' })
/** "Foundations is for Beginner and Basic, Intermediate for Basic and Intermediate, …", from LESSON_TIERS_FOR_LEVEL. */
const TIER_HINT = `${LESSON_TIERS.map(
  (tier, i) =>
    `${LESSON_TIER_LABELS[tier]}${i === 0 ? ' is' : ''} for ${and.format(levelsForLessonTier(tier).map((level) => LEVEL_LABELS[level]))}`,
).join(', ')}.`

/** What the API gets. Empty links are null; a resource row left wholly empty is dropped. */
const inputFor = (isPublished: boolean): LessonInput => ({
  area: draft.value.area,
  tier: draft.value.tier,
  slug: draft.value.slug.trim(),
  title: draft.value.title,
  summary: draft.value.summary,
  bodyMd: draft.value.bodyMd,
  imageUrl: draft.value.imageUrl.trim() || null,
  videoUrl: draft.value.videoUrl.trim() || null,
  resources: draft.value.resources
    .filter((r) => r.label.trim() || r.url.trim())
    .map((r) => ({ label: r.label, url: r.url.trim() })),
  isPublished,
})

const result = computed(() => lessonInputSchema.safeParse(inputFor(false)))

type Field = Exclude<keyof LessonInput, 'resources' | 'isPublished'>
type Issues = { fields: Partial<Record<Field, string>>; resources: ResourceIssues }

/**
 * The first problem with each field, shown or not. Resource rows left wholly empty aren't sent,
 * so the schema numbers the rows it checks; `resources` puts its problems back on the rows on
 * screen.
 */
const issues = computed<Issues>(() => {
  const found: Issues = { fields: {}, resources: {} }
  if (result.value.success) return found
  const shownRows = draft.value.resources.flatMap((r, i) =>
    r.label.trim() || r.url.trim() ? [i] : [],
  )
  for (const issue of result.value.error.issues) {
    const [field, row, part] = issue.path
    if (field === 'resources' && typeof row === 'number' && (part === 'label' || part === 'url')) {
      const shown = shownRows[row]
      if (shown === undefined) continue
      found.resources[shown] ??= {}
      found.resources[shown][part] ??= issue.message
    } else if (typeof field === 'string' && field !== 'resources' && !(field in found.fields)) {
      found.fields[field as Field] = issue.message
    }
  }
  return found
})
const errors = computed<Issues>(() => (tried.value ? issues.value : { fields: {}, resources: {} }))

/** The lesson published in the place this one is set to go, other than this one. */
const occupant = computed(
  () =>
    props.lessons?.find(
      (l) =>
        l.isPublished &&
        l.area === draft.value.area &&
        l.tier === draft.value.tier &&
        l.id !== props.lesson?.id,
    ) ?? null,
)

const published = computed(() => props.lesson?.isPublished ?? false)
/** A published lesson set to go to another area or tier than where it is now. */
const moved = computed(
  () =>
    published.value &&
    (draft.value.area !== props.lesson?.area || draft.value.tier !== props.lesson?.tier),
)
/**
 * Publishing into a place, or moving a published lesson to one, needs the list to tell what it
 * would replace; with the list missing it's off, so nothing is replaced without asking.
 */
const placeUnknown = computed(() => props.lessons === null && (!published.value || moved.value))

const done = computed(() => {
  const f = issues.value.fields
  return {
    place: true,
    card: !f.title && !f.slug && !f.summary,
    body: !f.bodyMd,
    media:
      (draft.value.imageUrl.trim() !== '' ||
        draft.value.videoUrl.trim() !== '' ||
        draft.value.resources.length > 0) &&
      !f.imageUrl &&
      !f.videoUrl &&
      Object.keys(issues.value.resources).length === 0,
  }
})

const address = computed(() => `${window.location.origin}/lessons/${draft.value.slug || '…'}`)

function save(isPublished: boolean) {
  tried.value = true
  if (!result.value.success || (isPublished && placeUnknown.value)) return
  sent = snapshot()
  emit('save', inputFor(isPublished), isPublished ? occupant.value : null)
}

// Below `xl`, the form and the preview take turns.
const VIEWS = { edit: 'Edit', preview: 'Preview' } as const
const view = ref<keyof typeof VIEWS>('edit')

// The preview follows the text a moment after typing stops, so long lessons stay smooth.
const previewBody = ref(draft.value.bodyMd)
let timer: ReturnType<typeof setTimeout> | undefined
watch(
  () => draft.value.bodyMd,
  (body) => {
    clearTimeout(timer)
    timer = setTimeout(() => (previewBody.value = body), 200)
  },
)
onUnmounted(() => clearTimeout(timer))
</script>

<template>
  <div>
    <div
      role="group"
      aria-label="Show"
      class="mb-4 flex gap-1 rounded-card border border-line bg-surface p-1 xl:hidden"
    >
      <button
        v-for="(name, option) in VIEWS"
        :key="option"
        type="button"
        :aria-pressed="view === option"
        class="flex min-h-11 flex-1 items-center justify-center rounded-control px-3 font-semibold text-quiet transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-evergreen aria-pressed:bg-evergreen-soft aria-pressed:text-evergreen"
        @click="view = option"
      >
        {{ name }}
      </button>
    </div>

    <div class="grid gap-8 xl:grid-cols-2 xl:items-start">
      <form
        novalidate
        aria-label="Lesson"
        class="divide-y divide-line rounded-card border border-line bg-surface"
        :class="view === 'preview' && 'max-xl:hidden'"
        @submit.prevent="save(published)"
      >
        <FormSection
          :number="1"
          title="Where it goes"
          description="The area and level whose students get this lesson on their results."
          :done="done.place"
          stacked
        >
          <SelectField v-model="draft.area" label="Area" :options="AREA_OPTIONS" />
          <SelectField
            v-model="draft.tier"
            label="Level"
            :hint="TIER_HINT"
            :options="TIER_OPTIONS"
          />
          <p
            v-if="lessons"
            class="rounded-control bg-mist-soft p-4 text-quiet"
            :class="occupant && !published && 'bg-marigold-soft text-ink'"
          >
            <template v-if="occupant">
              Students see <strong class="text-ink">{{ occupant.title }}</strong> here now.
              Publishing this one takes its place, and that one goes back to a draft.
            </template>
            <template v-else>No lesson is published here yet.</template>
          </p>
        </FormSection>

        <FormSection
          :number="2"
          title="The card"
          description="What students see in the library and on their results."
          :done="done.card"
          stacked
        >
          <TextField
            v-model="draft.title"
            label="Title"
            :error="errors.fields.title"
            :maxlength="LESSON_TITLE_MAX"
            autocomplete="off"
          />
          <TextField
            v-model="draft.slug"
            label="Slug"
            :hint="
              published
                ? `The lesson’s address: ${address}. Changing it breaks links to the old one.`
                : `The lesson’s address: ${address}. Made from the title until you change it.`
            "
            :error="errors.fields.slug"
            autocomplete="off"
            @update:model-value="slugEdited = true"
          />
          <TextAreaField
            v-model="draft.summary"
            label="Summary"
            hint="One or two sentences on what students will be able to do."
            :error="errors.fields.summary"
            :maxlength="LESSON_SUMMARY_MAX"
          />
        </FormSection>

        <FormSection :number="3" title="The lesson" :done="done.body" stacked>
          <MarkdownEditor
            v-model="draft.bodyMd"
            label="Lesson text"
            :error="errors.fields.bodyMd"
            :maxlength="LESSON_BODY_MAX"
          />
        </FormSection>

        <FormSection
          :number="4"
          title="Picture, video and links"
          description="Optional."
          :done="done.media"
          stacked
        >
          <TextField
            v-model="draft.imageUrl"
            label="Picture link"
            hint="A link to an image, starting with https://. It shows at the top of the lesson."
            :error="errors.fields.imageUrl"
            inputmode="url"
            autocomplete="off"
          />
          <TextField
            v-model="draft.videoUrl"
            label="Video link"
            hint="A YouTube link plays in the lesson. Other links open in a new tab."
            :error="errors.fields.videoUrl"
            inputmode="url"
            autocomplete="off"
          />
          <ResourceListField
            v-model="draft.resources"
            :max="LESSON_RESOURCES_MAX"
            :errors="errors.resources"
          />
        </FormSection>

        <footer
          class="sticky bottom-0 flex flex-col gap-4 rounded-b-card bg-mist-soft px-5 py-4 sm:px-7"
        >
          <p v-if="error" role="alert" class="font-semibold text-error">{{ error }}</p>
          <p v-else-if="tried && !result.success" role="alert" class="font-semibold text-error">
            Fix what’s marked above.
          </p>
          <p v-else class="text-quiet">
            {{
              unsaved
                ? 'You have changes that aren’t saved.'
                : lesson
                  ? 'All changes saved.'
                  : 'Save it as a draft, or publish it for students.'
            }}
          </p>

          <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <template v-if="published">
              <button
                type="button"
                :class="SECONDARY_BUTTON"
                :disabled="saving"
                @click="save(false)"
              >
                Unpublish
              </button>
              <button type="submit" :class="PRIMARY_BUTTON" :disabled="saving || placeUnknown">
                {{ saving ? 'Saving…' : 'Save changes' }}
              </button>
            </template>
            <template v-else>
              <button type="submit" :class="SECONDARY_BUTTON" :disabled="saving">
                {{ saving ? 'Saving…' : 'Save draft' }}
              </button>
              <button
                type="button"
                :class="PRIMARY_BUTTON"
                :disabled="saving || placeUnknown"
                @click="save(true)"
              >
                Publish
              </button>
            </template>
          </div>
        </footer>
      </form>

      <section
        aria-label="Preview"
        class="overflow-hidden rounded-card border border-line xl:sticky xl:top-[calc(var(--spacing-header)+1rem)] xl:flex xl:max-h-[calc(100dvh-var(--spacing-header)-2rem)] xl:flex-col"
        :class="view === 'edit' && 'max-xl:hidden'"
      >
        <p
          class="flex items-center justify-between gap-3 border-b border-line bg-surface px-5 py-3 text-sm font-semibold text-quiet"
        >
          Preview: how students see it
        </p>
        <div class="xl:min-h-0 xl:overflow-y-auto">
          <LessonPreview
            :area="draft.area"
            :tier="draft.tier"
            :title="draft.title"
            :summary="draft.summary"
            :body-md="previewBody"
            :image-url="draft.imageUrl"
            :video-url="draft.videoUrl"
            :resources="draft.resources"
          />
        </div>
      </section>
    </div>
  </div>
</template>
