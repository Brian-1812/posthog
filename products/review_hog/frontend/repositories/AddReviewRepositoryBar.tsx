import { useActions, useValues } from 'kea'

import { IconGithub, IconPlus } from '@posthog/icons'
import { LemonButton, LemonInputSelect, LemonSelect, LemonSkeleton } from '@posthog/lemon-ui'

import { githubRepositorySearchLogic } from 'lib/integrations/githubRepositorySearchLogic'

import { addableRepositoryNames } from './repositoryChoices'
import { reviewHogRepositoriesLogic } from './reviewHogRepositoriesLogic'

function RepositoryPicker({ integrationId }: { integrationId: number }): JSX.Element {
    const { githubIntegrations, repositories, repositoryToAdd, addingRepository } =
        useValues(reviewHogRepositoriesLogic)
    const { selectIntegration, setRepositoryToAdd, addRepository } = useActions(reviewHogRepositoriesLogic)
    const searchLogic = githubRepositorySearchLogic({ id: integrationId })
    const { repositoryNames, loading, error, hasMore } = useValues(searchLogic)
    const { setSearchQuery } = useActions(searchLogic)

    const options = addableRepositoryNames(repositoryNames, repositories).map((name) => ({ key: name, label: name }))

    return (
        <div className="flex flex-wrap items-center gap-2">
            {githubIntegrations.length > 1 && (
                <LemonSelect
                    aria-label="GitHub account"
                    value={integrationId}
                    options={githubIntegrations.map((integration) => ({
                        value: integration.id,
                        label: integration.display_name,
                    }))}
                    onChange={(value) => {
                        selectIntegration(value)
                        setRepositoryToAdd(null)
                    }}
                />
            )}
            <LemonInputSelect
                mode="single"
                className="min-w-60 flex-1"
                placeholder="Search repositories to add"
                options={options}
                value={repositoryToAdd ? [repositoryToAdd] : []}
                onChange={(values) => setRepositoryToAdd(values[0] ?? null)}
                onInputChange={setSearchQuery}
                loading={loading}
                title={hasMore ? 'Showing the first matches. Type to narrow the list.' : undefined}
                emptyStateComponent={
                    <p className="m-0 p-1 italic text-secondary">
                        {error ?? 'No repository left to add matches this search.'}
                    </p>
                }
                disabledReason={addingRepository ? 'Adding the repository' : undefined}
                data-attr="review-hog-add-repository-picker"
            />
            <LemonButton
                type="primary"
                icon={<IconPlus />}
                onClick={addRepository}
                loading={addingRepository}
                disabledReason={repositoryToAdd ? undefined : 'Pick a repository first'}
                data-attr="review-hog-add-repository"
            >
                Add repository
            </LemonButton>
        </div>
    )
}

export function AddReviewRepositoryBar(): JSX.Element {
    const { integrations, githubIntegration, connectGitHubUrl } = useValues(reviewHogRepositoriesLogic)

    if (integrations === null) {
        return <LemonSkeleton className="h-10 w-full" />
    }
    if (!githubIntegration) {
        return (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-primary bg-surface-primary p-3">
                <span className="text-sm text-secondary">Connect GitHub to pick the repositories to review.</span>
                <LemonButton
                    type="primary"
                    size="small"
                    icon={<IconGithub />}
                    to={connectGitHubUrl}
                    disableClientSideRouting
                    data-attr="review-hog-connect-github"
                >
                    Connect GitHub
                </LemonButton>
            </div>
        )
    }
    return <RepositoryPicker integrationId={githubIntegration.id} />
}
