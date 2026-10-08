import { useActions, useValues } from 'kea'

import { IconPlus, IconTrash } from '@posthog/icons'
import { LemonButton, LemonCheckbox, LemonDialog, LemonSelect, LemonSnack } from '@posthog/lemon-ui'

import { MemberSelect } from 'lib/components/MemberSelect'
import { fullName } from 'lib/utils/strings'
import { userLogic } from 'scenes/userLogic'

import type { ReviewRepositoryApi } from 'products/review_hog/frontend/generated/api.schemas'

import { FLASH_FOR_OPTIONS } from './repositoryChoices'
import { reviewHogRepositoriesLogic } from './reviewHogRepositoriesLogic'

export function ProjectRepositoryCell({
    repository,
    className,
}: {
    repository: ReviewRepositoryApi
    className?: string
}): JSX.Element {
    const { busyRepositoryIds } = useValues(reviewHogRepositoriesLogic)
    const { setFlashFor, setExcludeBots, addPerson, removePerson, removeRepository } =
        useActions(reviewHogRepositoriesLogic)
    const { user } = useValues(userLogic)

    const name = repository.full_name
    const savingReason = busyRepositoryIds.includes(repository.id) ? 'Saving…' : undefined
    const flashFor = repository.flash_for ?? 'everyone'
    // Each mode has its own list, so switching the mode never turns an except list into a people list.
    const kind = flashFor === 'everyone' ? 'excepted' : 'listed'
    const people = repository.people.filter((person) => person.kind === kind)

    const confirmRemove = (): void => {
        LemonDialog.open({
            title: `Remove ${name}?`,
            description:
                "Pull requests in this repository stop getting automatic reviews. Its people lists and everyone's own choices for it are deleted.",
            primaryButton: {
                children: 'Remove',
                status: 'danger',
                onClick: () => removeRepository(repository),
                'data-attr': 'review-hog-repository-remove-confirm',
            },
            secondaryButton: { children: 'Cancel' },
        })
    }

    return (
        <div className={`flex min-w-0 flex-col justify-center gap-2 px-4 py-3 ${className ?? ''}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 truncate font-mono text-sm font-semibold" title={name}>
                    {name}
                </span>
                <div className="flex items-center gap-1">
                    <LemonSelect
                        size="small"
                        aria-label={`Flash for, ${name}`}
                        value={flashFor}
                        options={FLASH_FOR_OPTIONS}
                        onChange={(value) => value !== flashFor && setFlashFor(repository, value)}
                        disabledReason={savingReason}
                        data-attr="review-hog-repository-flash-for"
                    />
                    <LemonButton
                        size="small"
                        icon={<IconTrash />}
                        tooltip="Remove repository"
                        aria-label={`Remove ${name}`}
                        onClick={confirmRemove}
                        disabledReason={savingReason}
                        data-attr="review-hog-repository-remove"
                    />
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-secondary">{kind === 'excepted' ? 'Except:' : 'People:'}</span>
                {people.map((person) => (
                    <LemonSnack
                        key={person.id}
                        title={person.user.email}
                        onClose={() => removePerson(repository, person)}
                        data-attr="review-hog-repository-person"
                    >
                        {fullName(person.user)}
                        {person.user.id === user?.id ? ' (you)' : ''}
                    </LemonSnack>
                ))}
                {people.length === 0 && (
                    <span className="text-tertiary">
                        {kind === 'excepted'
                            ? 'Nobody'
                            : 'Nobody yet. Only people who chose Flash themselves get reviewed.'}
                    </span>
                )}
                <MemberSelect
                    value={null}
                    allowNone={false}
                    excludedMembers={people.map((person) => person.user.id)}
                    onChange={(member) => member && addPerson(repository, member.id, kind)}
                >
                    {() => (
                        <LemonButton
                            size="xsmall"
                            type="tertiary"
                            icon={<IconPlus />}
                            disabledReason={savingReason}
                            data-attr="review-hog-repository-add-person"
                        >
                            Person
                        </LemonButton>
                    )}
                </MemberSelect>
                {kind === 'excepted' && (
                    <LemonCheckbox
                        size="small"
                        className="ml-auto"
                        label="Skip bots"
                        checked={repository.exclude_bots ?? true}
                        onChange={(checked) => setExcludeBots(repository, checked)}
                        disabledReason={savingReason}
                        data-attr="review-hog-repository-exclude-bots"
                    />
                )}
            </div>
        </div>
    )
}
