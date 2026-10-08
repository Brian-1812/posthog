import { useActions, useValues } from 'kea'

import { IconPlus, IconX } from '@posthog/icons'
import { LemonButton, LemonSelect } from '@posthog/lemon-ui'

import type { ReviewRepositoryApi } from 'products/review_hog/frontend/generated/api.schemas'

import { OWN_CHOICE_OPTIONS, describeMyResult, ownChoiceToAdd, withSavedOption } from './repositoryChoices'
import { reviewHogRepositoriesLogic } from './reviewHogRepositoriesLogic'

export function MyRepositoryCell({
    repository,
    className,
}: {
    repository: ReviewRepositoryApi
    className?: string
}): JSX.Element {
    const { busyRepositoryIds } = useValues(reviewHogRepositoriesLogic)
    const { setMyChoice, clearMyChoice } = useActions(reviewHogRepositoriesLogic)

    const name = repository.full_name
    const saving = busyRepositoryIds.includes(repository.id)
    const choice = repository.my_choice

    return (
        <div className={`flex min-w-0 items-center gap-2 px-4 py-3 ${className ?? ''}`}>
            {choice === null ? (
                <LemonButton
                    size="small"
                    type="secondary"
                    icon={<IconPlus />}
                    className="border-dashed"
                    tooltip="Set my own choice for this repository"
                    aria-label={`Set my own choice for ${name}`}
                    onClick={() => setMyChoice(repository, ownChoiceToAdd(repository.my_result))}
                    loading={saving}
                    data-attr="review-hog-my-choice-add"
                />
            ) : (
                <>
                    <LemonSelect
                        size="small"
                        aria-label={`My pull requests in ${name}`}
                        value={choice}
                        options={withSavedOption(OWN_CHOICE_OPTIONS, choice)}
                        onChange={(mode) => mode !== choice && setMyChoice(repository, mode)}
                        disabledReason={saving ? 'Saving…' : undefined}
                        data-attr="review-hog-my-choice"
                    />
                    <LemonButton
                        size="small"
                        icon={<IconX />}
                        tooltip="Use my default"
                        aria-label={`Use my default in ${name}`}
                        onClick={() => clearMyChoice(repository)}
                        disabledReason={saving ? 'Saving…' : undefined}
                        data-attr="review-hog-my-choice-clear"
                    />
                </>
            )}
            <div className="flex min-w-0 flex-col">
                {/* The name keeps the cell readable on its own when the panes stack. */}
                <span className="truncate font-mono text-xs text-tertiary" title={name}>
                    {name}
                </span>
                <span className={`text-xs ${choice === null ? 'text-tertiary' : 'font-semibold'}`}>
                    {describeMyResult(repository.my_result)}
                </span>
            </div>
        </div>
    )
}
