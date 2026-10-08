import {
    MOCK_DEFAULT_BASIC_USER,
    MOCK_DEFAULT_ORGANIZATION_MEMBER,
    MOCK_DEFAULT_USER,
    MOCK_SECOND_BASIC_USER,
} from 'lib/api.mock'

import { Decorator, Meta, StoryObj } from '@storybook/react'
import { waitFor, within } from '@testing-library/dom'
import { router } from 'kea-router'
import { useEffect } from 'react'

import { FEATURE_FLAGS } from 'lib/constants'
import { urls } from 'scenes/urls'
import { userLogic } from 'scenes/userLogic'

import { mswDecorator } from '~/mocks/browser'
import { OrganizationMemberType, UserBasicType } from '~/types'

import type {
    AutomaticReviewDecisionApi,
    PatchedReviewRepositoryUpdateApi,
    PatchedReviewUserSettingsApi,
    ReviewPerspectiveStatsApi,
    ReviewRecentReviewApi,
    ReviewRepositoryApi,
    ReviewRepositoryChoiceRequestApi,
    ReviewRepositoryPersonRequestApi,
    ReviewUserSettingsApi,
    UserBasicApi,
} from 'products/review_hog/frontend/generated/api.schemas'

import { expect } from 'storybook/test'

import { CodeReviewScene } from './CodeReviewScene'
import { CodeReviewTab } from './reviewHogSettingsLogic'

const defaultSettings: ReviewUserSettingsApi = {
    review_inbox_prs: false,
    stamphog_review_inbox_prs: false,
    review_labeled_prs: true,
    resolve_comments: true,
    celebrate_clean_reviews: true,
    review_authored_prs: false,
    default_review_mode: 'follow',
    flash_reasoning_effort: 'medium',
    urgency_threshold: 'consider',
    can_trigger_reviews: true,
    show_internal_features: false,
    stamphog_connected: false,
}

function completedReview(overrides: Partial<ReviewRecentReviewApi>): ReviewRecentReviewApi {
    return {
        id: 'review-1',
        repository: 'example-org/example-repo',
        pr_number: 101,
        pr_title: 'Add retry to the export job',
        pr_author: 'example-dev',
        additions: 120,
        deletions: 34,
        changed_files: 6,
        head_branch: 'feat/export-retry',
        github_url: 'https://github.com/example-org/example-repo/pull/101',
        run_count: 1,
        last_run_at: '2026-09-30T10:00:00Z',
        published: true,
        in_progress: false,
        progress: null,
        resolution: null,
        must_fix_count: 1,
        should_fix_count: 2,
        consider_count: 1,
        candidate_count: 7,
        dismissed_count: 3,
        files_reviewed: 6,
        chunk_count: 2,
        perspective_count: 3,
        perspective_issue_count: 8,
        blind_spot_issue_count: 2,
        ...overrides,
    }
}

const recentReviews: ReviewRecentReviewApi[] = [
    completedReview({}),
    completedReview({
        id: 'review-2',
        pr_number: 98,
        pr_title: 'Fix timezone handling in the weekly digest',
        github_url: 'https://github.com/example-org/example-repo/pull/98',
        head_branch: 'fix/digest-timezone',
        last_run_at: '2026-09-29T15:30:00Z',
        must_fix_count: 0,
        should_fix_count: 1,
        consider_count: 0,
        dismissed_count: 1,
    }),
    // Started by the viewer on a teammate's pull request, so "Mine" shows its author.
    completedReview({
        id: 'review-3',
        pr_number: 95,
        pr_title: 'Cache the billing summary',
        pr_author: 'example-teammate',
        github_url: 'https://github.com/example-org/example-repo/pull/95',
        head_branch: 'feat/billing-cache',
        last_run_at: '2026-09-28T09:00:00Z',
        must_fix_count: 0,
        should_fix_count: 0,
        consider_count: 1,
        dismissed_count: 2,
    }),
]

const perspectiveStats: ReviewPerspectiveStatsApi = {
    report_count: 2,
    perspectives: [
        { skill_name: 'review-hog-perspective-logic-correctness', raised: 6, kept: 4, dismissed: 2 },
        { skill_name: 'review-hog-perspective-performance-reliability', raised: 3, kept: 1, dismissed: 2 },
        { skill_name: 'review-hog-blind-spots-general', raised: 2, kept: 1, dismissed: 1 },
    ],
}

const ADA: UserBasicType = {
    id: 301,
    uuid: '0b3f6a52-6a0e-4b8e-9d2f-4a1c7e9e0301',
    distinct_id: 'mock-user-301-distinct-id',
    first_name: 'Ada',
    last_name: 'Example',
    email: 'ada@example.com',
}

const members: OrganizationMemberType[] = [
    MOCK_DEFAULT_ORGANIZATION_MEMBER,
    { ...MOCK_DEFAULT_ORGANIZATION_MEMBER, id: 'member-rose', user: MOCK_SECOND_BASIC_USER },
    { ...MOCK_DEFAULT_ORGANIZATION_MEMBER, id: 'member-ada', user: ADA },
]

function toApiUser(user: UserBasicType): UserBasicApi {
    return {
        id: user.id,
        uuid: user.uuid,
        distinct_id: user.distinct_id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        hedgehog_config: null,
    }
}

const githubRepositoryNames = [
    'example-org/web',
    'example-org/api',
    'example-org/docs',
    'example-org/mobile',
    'example-org/infra',
]

/** A story-sized copy of the backend rule, so the panes answer like the real API after each change. */
function resolveMyResult(repo: ReviewRepositoryApi, defaultMode: string): AutomaticReviewDecisionApi {
    const ownMode = (mode: string): AutomaticReviewDecisionApi['mode'] => (mode === 'off' ? 'none' : 'flash')
    if (repo.my_choice) {
        return { mode: ownMode(repo.my_choice), reason: 'own_repository_choice' }
    }
    if (defaultMode !== 'follow') {
        return { mode: ownMode(defaultMode), reason: 'own_default' }
    }
    const onList = (kind: string): boolean =>
        repo.people.some((person) => person.kind === kind && person.user.id === MOCK_DEFAULT_BASIC_USER.id)
    if (repo.flash_for === 'everyone') {
        return onList('excepted') ? { mode: 'none', reason: 'excepted' } : { mode: 'flash', reason: 'everyone' }
    }
    return onList('listed') ? { mode: 'flash', reason: 'listed' } : { mode: 'none', reason: 'not_listed' }
}

function repository(overrides: Partial<ReviewRepositoryApi>): ReviewRepositoryApi {
    return {
        id: 'repo-web',
        full_name: 'example-org/web',
        flash_for: 'everyone',
        exclude_bots: true,
        created_by: toApiUser(MOCK_DEFAULT_BASIC_USER),
        created_at: '2026-09-20T10:00:00Z',
        people: [],
        my_choice: null,
        my_result: { mode: 'flash', reason: 'everyone' },
        ...overrides,
    }
}

function initialRepositories(): ReviewRepositoryApi[] {
    return [
        repository({
            people: [{ id: 'person-rose', user: toApiUser(MOCK_SECOND_BASIC_USER), kind: 'excepted' }],
        }),
        repository({
            id: 'repo-api',
            full_name: 'example-org/api',
            flash_for: 'listed',
            people: [
                { id: 'person-rose-api', user: toApiUser(MOCK_SECOND_BASIC_USER), kind: 'listed' },
                { id: 'person-ada-api', user: toApiUser(ADA), kind: 'listed' },
            ],
            my_choice: 'off',
        }),
        repository({ id: 'repo-docs', full_name: 'example-org/docs', flash_for: 'listed' }),
    ]
}

/** Mutable API state, reset before each story, so clicks in the panes behave like a real backend. */
const storyState: { settings: ReviewUserSettingsApi; repositories: ReviewRepositoryApi[]; nextId: number } = {
    settings: defaultSettings,
    repositories: [],
    nextId: 1,
}

function withResult(repo: ReviewRepositoryApi): ReviewRepositoryApi {
    return { ...repo, my_result: resolveMyResult(repo, storyState.settings.default_review_mode ?? 'follow') }
}

function updateRepository(id: string, change: (repo: ReviewRepositoryApi) => ReviewRepositoryApi): ReviewRepositoryApi {
    const index = storyState.repositories.findIndex((repo) => repo.id === id)
    storyState.repositories[index] = withResult(change(storyState.repositories[index]))
    return storyState.repositories[index]
}

function OpenTab({ tab, children }: { tab: CodeReviewTab; children: JSX.Element }): JSX.Element {
    useEffect(() => {
        router.actions.replace(urls.codeReview(), tab === 'settings' ? { tab } : {})
    }, [tab])
    return children
}

const meta: Meta<typeof CodeReviewScene> = {
    component: CodeReviewScene,
    title: 'Scenes/Code review',
    parameters: {
        layout: 'fullscreen',
        featureFlags: [FEATURE_FLAGS.REVIEW_HOG],
        mockDate: '2026-10-01T12:00:00Z',
    },
    beforeEach: ({ parameters }) => {
        storyState.settings = {
            ...defaultSettings,
            show_internal_features: parameters.showInternalFeatures ?? false,
            stamphog_connected: parameters.showInternalFeatures ?? false,
            ...parameters.savedSettings,
        }
        storyState.repositories = initialRepositories().map(withResult)
        storyState.nextId = 1
    },
    decorators: [
        (Story, context): JSX.Element => (
            <OpenTab tab={context.parameters.tab ?? 'activity'}>
                <div className="p-4">
                    <Story />
                </div>
            </OpenTab>
        ),
        (Story, context): JSX.Element => {
            return mswDecorator({
                get: {
                    '/api/users/@me/': () => [
                        200,
                        { ...MOCK_DEFAULT_USER, is_staff: context.parameters.isStaff ?? false },
                    ],
                    '/api/users/@me/github_login/': { github_login: 'example-dev' },
                    '/api/projects/:team_id/review_hog/settings/': () => [200, storyState.settings],
                    '/api/projects/:team_id/review_hog/repositories/': () => [200, storyState.repositories],
                    '/api/organizations/:organization_id/members/': {
                        results: members,
                        next: null,
                        previous: null,
                        count: members.length,
                    },
                    '/api/projects/:team_id/integrations/': {
                        results: [
                            {
                                id: 7,
                                kind: 'github',
                                display_name: 'example-org',
                                icon_url: '',
                                config: {},
                                created_at: '2026-09-01T10:00:00Z',
                                errors: '',
                            },
                        ],
                        next: null,
                        previous: null,
                        count: 1,
                    },
                    '/api/projects/:team_id/integrations/:id/github_repos/': ({ request }) => {
                        const search = new URL(request.url).searchParams.get('search')?.toLowerCase() ?? ''
                        const names = githubRepositoryNames.filter((name) => name.includes(search))
                        return [
                            200,
                            {
                                repositories: names.map((full_name, i) => ({
                                    id: i + 1,
                                    name: full_name.split('/')[1],
                                    full_name,
                                })),
                                has_more: false,
                                next_offset: null,
                                total: names.length,
                            },
                        ]
                    },
                    '/api/projects/:team_id/review_hog/reviews/': { results: recentReviews, has_more: false },
                    '/api/projects/:team_id/review_hog/reviews/perspective_stats/': perspectiveStats,
                    '/api/projects/:team_id/review_hog/perspectives/': [],
                    '/api/projects/:team_id/review_hog/blind_spots/': [],
                    '/api/projects/:team_id/review_hog/validators/': [],
                    '/api/projects/:team_id/review_hog/resolution/': [],
                },
                post: {
                    '/api/projects/:team_id/review_hog/repositories/': async ({ request }) => {
                        const { full_name } = (await request.json()) as { full_name: string }
                        const added = withResult(repository({ id: `repo-new-${storyState.nextId++}`, full_name }))
                        storyState.repositories.push(added)
                        return [201, added]
                    },
                    '/api/projects/:team_id/review_hog/repositories/:id/people/': async ({ request, params }) => {
                        const { user_id, kind } = (await request.json()) as ReviewRepositoryPersonRequestApi
                        const member = members.find((m) => m.user.id === user_id)
                        if (!member) {
                            return [400, { detail: 'This user is not an active member of the organization.' }]
                        }
                        const repo = updateRepository(String(params.id), (current) => ({
                            ...current,
                            people: [
                                ...current.people,
                                { id: `person-${storyState.nextId++}`, user: toApiUser(member.user), kind },
                            ],
                        }))
                        return [201, repo]
                    },
                },
                patch: {
                    '/api/projects/:team_id/review_hog/settings/': async ({ request }) => {
                        const update = (await request.json()) as PatchedReviewUserSettingsApi
                        storyState.settings = { ...storyState.settings, ...update }
                        storyState.repositories = storyState.repositories.map(withResult)
                        return [200, storyState.settings]
                    },
                    '/api/projects/:team_id/review_hog/repositories/:id/': async ({ request, params }) => {
                        const update = (await request.json()) as PatchedReviewRepositoryUpdateApi
                        return [200, updateRepository(String(params.id), (current) => ({ ...current, ...update }))]
                    },
                },
                put: {
                    '/api/projects/:team_id/review_hog/repositories/:id/my_choice/': async ({ request, params }) => {
                        const { mode } = (await request.json()) as ReviewRepositoryChoiceRequestApi
                        return [
                            200,
                            updateRepository(String(params.id), (current) => ({ ...current, my_choice: mode })),
                        ]
                    },
                },
                delete: {
                    '/api/projects/:team_id/review_hog/repositories/:id/my_choice/': ({ params }) => [
                        200,
                        updateRepository(String(params.id), (current) => ({ ...current, my_choice: null })),
                    ],
                    '/api/projects/:team_id/review_hog/repositories/:id/people/:personId/': ({ params }) => [
                        200,
                        updateRepository(String(params.id), (current) => ({
                            ...current,
                            people: current.people.filter((person) => person.id !== params.personId),
                        })),
                    ],
                    '/api/projects/:team_id/review_hog/repositories/:id/': ({ params }) => {
                        storyState.repositories = storyState.repositories.filter((repo) => repo.id !== params.id)
                        return [204]
                    },
                },
            })(Story, context)
        },
    ],
}
export default meta

type Story = StoryObj<typeof CodeReviewScene>

export const Default: Story = {
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement)
        await expect(await canvas.findByText('Review a pull request')).toBeVisible()
        await expect(await canvas.findByText('Add retry to the export job')).toBeVisible()
        await expect(canvas.getByText('Mine')).toBeVisible()
        await expect(canvas.queryByLabelText('Celebrate clean reviews')).not.toBeInTheDocument()
    },
}

export const Settings: Story = {
    parameters: { tab: 'settings' },
    play: async ({ canvasElement }) => {
        userLogic.actions.loadUser()
        await waitFor(() => expect(userLogic.values.user?.is_staff).toBe(false))
        const canvas = within(canvasElement)
        await expect(await canvas.findByText('More for my pull requests')).toBeVisible()
        await expect(await canvas.findByText('Flash · for everyone')).toBeVisible()
        await expect(canvas.getByText('Not reviewed · your choice here')).toBeVisible()
        await expect(canvas.getByText('Not reviewed · not on the list')).toBeVisible()
        await expect(canvas.queryByText('Review a pull request')).not.toBeInTheDocument()
        await expect(canvas.queryByLabelText('Review all your Inbox PRs')).not.toBeInTheDocument()
        await expect(canvas.queryByLabelText('Let Stamphog review your Inbox PRs')).not.toBeInTheDocument()
        await expect(canvas.queryByLabelText('Review all your PRs with the reviewhog label')).not.toBeInTheDocument()
        await expect(canvas.queryByLabelText('Review all your PRs in Flash mode')).not.toBeInTheDocument()
        await expect(canvas.getByLabelText('Resolve comments on your PRs')).toBeVisible()
        await expect(canvas.getByLabelText('Celebrate clean reviews')).toBeVisible()
        await expect(canvas.queryByText('Flash strength')).not.toBeInTheDocument()
    },
}

export const InternalFeatures: Story = {
    parameters: { showInternalFeatures: true, tab: 'settings' },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement)
        await expect(await canvas.findByLabelText('Review all your Inbox PRs')).toBeVisible()
        await expect(canvas.getByLabelText('Let Stamphog review your Inbox PRs')).toBeVisible()
        await expect(canvas.getByLabelText('Review all your PRs with the reviewhog label')).toBeVisible()
        await expect(canvas.queryByLabelText('Review all your PRs in Flash mode')).not.toBeInTheDocument()
        await expect(canvas.getByText('Flash strength')).toBeVisible()
    },
}

export const SavedInboxOptIns: Story = {
    parameters: { savedSettings: { review_inbox_prs: true, stamphog_review_inbox_prs: true }, tab: 'settings' },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement)
        const inboxSwitch = await canvas.findByLabelText('Review all your Inbox PRs')
        const stamphogSwitch = canvas.getByLabelText('Let Stamphog review your Inbox PRs')
        await expect(inboxSwitch).toBeChecked()
        await expect(inboxSwitch).toBeEnabled()
        await expect(stamphogSwitch).toBeChecked()
        await expect(stamphogSwitch).toBeEnabled()
        await expect(canvas.queryByLabelText('Review all your PRs with the reviewhog label')).not.toBeInTheDocument()
        await expect(canvas.queryByLabelText('Review all your PRs in Flash mode')).not.toBeInTheDocument()
    },
}

export const FlagDisabledForStaff: Story = {
    parameters: { featureFlags: [], isStaff: true },
    play: async ({ canvasElement }) => {
        userLogic.actions.loadUser()
        await waitFor(() => expect(userLogic.values.user?.is_staff).toBe(true))
        const canvas = within(canvasElement)
        await expect(await canvas.findByText('Page not found')).toBeVisible()
        await expect(canvas.queryByText('Review a pull request')).not.toBeInTheDocument()
    },
}

const narrowDecorator: Decorator = (Story): JSX.Element => (
    <div className="max-w-130">
        <Story />
    </div>
)

export const Narrow: Story = {
    decorators: [narrowDecorator],
}

export const NarrowSettings: Story = {
    parameters: { tab: 'settings' },
    decorators: [narrowDecorator],
}
