import type {
    AutomaticReviewDecisionApi,
    AutomaticReviewReasonEnumApi,
    ReviewRepositoryApi,
    ReviewRepositoryFlashForEnumApi,
    ReviewUserRepositoryChoiceModeEnumApi,
    ReviewUserSettingsDefaultReviewModeEnumApi,
} from 'products/review_hog/frontend/generated/api.schemas'

export interface ChoiceOption<T extends string> {
    value: T
    label: string
}

// Automatic Full reviews do not run yet, so the UI does not offer Full. When they do, add
// `{ value: 'full', label: 'Full' }` to this list. The API accepts 'full' already.
export const OWN_CHOICE_OPTIONS: ChoiceOption<ReviewUserRepositoryChoiceModeEnumApi>[] = [
    { value: 'flash', label: 'Flash' },
    { value: 'off', label: 'Off' },
]

export const DEFAULT_REVIEW_MODE_OPTIONS: ChoiceOption<ReviewUserSettingsDefaultReviewModeEnumApi>[] = [
    { value: 'follow', label: 'Follow repository' },
    ...OWN_CHOICE_OPTIONS,
]

export const FLASH_FOR_OPTIONS: ChoiceOption<ReviewRepositoryFlashForEnumApi>[] = [
    { value: 'everyone', label: 'Everyone' },
    { value: 'listed', label: 'Only these people' },
]

const RESULT_MODE_LABELS: Record<AutomaticReviewDecisionApi['mode'], string> = {
    flash: 'Flash',
    full: 'Full',
    none: 'Not reviewed',
}

const RESULT_REASON_LABELS: Record<AutomaticReviewReasonEnumApi, string> = {
    own_repository_choice: 'your choice here',
    own_default: 'from default',
    everyone: 'for everyone',
    excepted: 'on the except list',
    listed: 'on the list',
    not_listed: 'not on the list',
    bot_excluded: 'bots excluded',
}

export function describeMyResult(result: AutomaticReviewDecisionApi): string {
    return `${RESULT_MODE_LABELS[result.mode]} · ${RESULT_REASON_LABELS[result.reason]}`
}

/**
 * A saved value the options do not offer, such as 'full' set through the API, still has to show in
 * the select. Otherwise the select renders blank and hides what the user has.
 */
export function withSavedOption<T extends string>(options: ChoiceOption<T>[], value: T | null): ChoiceOption<T>[] {
    if (value === null || options.some((option) => option.value === value)) {
        return options
    }
    return [...options, { value, label: value.charAt(0).toUpperCase() + value.slice(1) }]
}

/**
 * The per-repository choice to start with when the user presses "+": the opposite of what they
 * get now, so that adding the choice changes something.
 */
export function ownChoiceToAdd(result: AutomaticReviewDecisionApi): ReviewUserRepositoryChoiceModeEnumApi {
    return result.mode === 'none' ? 'flash' : 'off'
}

/** The picker offers only repositories that are not added yet. GitHub names compare case-insensitively. */
export function addableRepositoryNames(names: string[], added: readonly ReviewRepositoryApi[] | null): string[] {
    const addedNames = new Set((added ?? []).map((repository) => repository.full_name.toLowerCase()))
    return names.filter((name) => !addedNames.has(name.toLowerCase()))
}
