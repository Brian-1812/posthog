import { useActions, useValues } from 'kea'

import { IconGithub } from '@posthog/icons'
import { LemonBanner, LemonSelect, LemonSkeleton, LemonTag } from '@posthog/lemon-ui'

import { reviewHogSettingsLogic } from 'products/review_hog/frontend/reviewHogSettingsLogic'
import { SectionHeader } from 'products/review_hog/frontend/SectionHeader'

import { AddReviewRepositoryBar } from './AddReviewRepositoryBar'
import { MyRepositoryCell } from './MyRepositoryCell'
import { ProjectRepositoryCell } from './ProjectRepositoryCell'
import { DEFAULT_REVIEW_MODE_OPTIONS, withSavedOption } from './repositoryChoices'
import { reviewHogRepositoriesLogic } from './reviewHogRepositoriesLogic'

function MyDefaultSelect(): JSX.Element {
    const { settings, settingsLoading } = useValues(reviewHogSettingsLogic)
    const { setDefaultReviewMode } = useActions(reviewHogRepositoriesLogic)
    const value = settings?.default_review_mode ?? 'follow'
    return (
        <LemonSelect
            size="small"
            aria-label="My default in every repository"
            value={value}
            options={withSavedOption(DEFAULT_REVIEW_MODE_OPTIONS, value)}
            onChange={(mode) => mode !== value && setDefaultReviewMode(mode)}
            disabledReason={settings === null ? 'Loading…' : settingsLoading ? 'Saving…' : undefined}
            data-attr="review-hog-default-review-mode"
        />
    )
}

/**
 * The added repositories as two panes that share their rows: "This project" holds the rule everyone
 * shares, "My pull requests" holds the viewer's own choices. One grid carries both panes, so a row
 * in one pane always has the height of the same repository's row in the other. On a narrow
 * container the grid falls back to one column and the project pane comes first.
 */
export function RepositoriesSection(): JSX.Element {
    const { repositories, repositoriesLoadFailed } = useValues(reviewHogRepositoriesLogic)
    const { loadRepositories } = useActions(reviewHogRepositoriesLogic)

    return (
        <section className="flex flex-col gap-4">
            <SectionHeader icon={<IconGithub />} title="Repositories">
                Only added repositories get automatic reviews. Your own choices for your pull requests win over the
                project's rule.
            </SectionHeader>
            <AddReviewRepositoryBar />
            {repositories === null ? (
                repositoriesLoadFailed ? (
                    <LemonBanner type="error" action={{ children: 'Retry', onClick: () => loadRepositories() }}>
                        Could not load the repositories.
                    </LemonBanner>
                ) : (
                    <LemonSkeleton className="h-40 w-full" />
                )
            ) : (
                <div className="@container">
                    <div
                        className="grid grid-cols-1 overflow-hidden rounded border border-primary @min-[40rem]:grid-flow-col @min-[40rem]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] @min-[40rem]:[grid-template-rows:repeat(var(--repository-rows),auto)]"
                        style={{ '--repository-rows': repositories.length + 1 } as React.CSSProperties}
                    >
                        <div className="flex flex-col gap-0.5 bg-surface-primary px-4 py-3">
                            <span className="flex items-center gap-2 text-sm font-semibold">
                                This project
                                <LemonTag type="success" size="small">
                                    Everyone
                                </LemonTag>
                            </span>
                            <span className="text-xs text-secondary">
                                Who gets Flash in each repository. Any member can change it.
                            </span>
                        </div>
                        {repositories.map((repository) => (
                            <ProjectRepositoryCell
                                key={repository.id}
                                repository={repository}
                                className="border-t border-primary bg-surface-primary"
                            />
                        ))}
                        <div className="flex flex-col gap-1 border-t border-primary bg-surface-secondary px-4 py-3 @min-[40rem]:border-l @min-[40rem]:border-t-0">
                            <span className="flex items-center gap-2 text-sm font-semibold">
                                My pull requests
                                <LemonTag type="highlight" size="small">
                                    Only you
                                </LemonTag>
                            </span>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-xs text-secondary">Default in every repository</span>
                                <MyDefaultSelect />
                            </div>
                        </div>
                        {repositories.map((repository) => (
                            <MyRepositoryCell
                                key={repository.id}
                                repository={repository}
                                className="border-t border-primary bg-surface-secondary @min-[40rem]:border-l"
                            />
                        ))}
                    </div>
                    {repositories.length === 0 && (
                        <p className="m-0 mt-2 text-xs text-secondary">
                            No repositories yet. Add one above to start automatic Flash reviews there.
                        </p>
                    )}
                </div>
            )}
        </section>
    )
}
