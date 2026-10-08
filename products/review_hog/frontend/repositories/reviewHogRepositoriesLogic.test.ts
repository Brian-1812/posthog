import { expectLogic } from 'kea-test-utils'

import { useMocks } from '~/mocks/jest'
import { initKeaTests } from '~/test/init'

import type { ReviewRepositoryApi } from 'products/review_hog/frontend/generated/api.schemas'

import { reviewHogRepositoriesLogic } from './reviewHogRepositoriesLogic'

function repository(overrides: Partial<ReviewRepositoryApi>): ReviewRepositoryApi {
    return {
        id: 'repo-web',
        full_name: 'example-org/web',
        flash_for: 'everyone',
        exclude_bots: true,
        created_by: { id: 1, uuid: 'user-1', email: 'dev@example.com', hedgehog_config: null },
        created_at: '2026-09-20T10:00:00Z',
        people: [],
        my_choice: null,
        my_result: { mode: 'flash', reason: 'everyone' },
        ...overrides,
    }
}

describe('reviewHogRepositoriesLogic', () => {
    let logic: ReturnType<typeof reviewHogRepositoriesLogic.build>
    let clearedRepositoryIds: string[]
    let listCalls: number

    beforeEach(() => {
        clearedRepositoryIds = []
        listCalls = 0
        useMocks({
            get: {
                '/api/projects/:team_id/review_hog/repositories/': () => {
                    listCalls += 1
                    return [
                        200,
                        [
                            repository({
                                my_choice: 'off',
                                my_result: { mode: 'none', reason: 'own_repository_choice' },
                            }),
                        ],
                    ]
                },
                '/api/projects/:team_id/review_hog/settings/': () => [200, { default_review_mode: 'follow' }],
            },
            patch: {
                '/api/projects/:team_id/review_hog/settings/': async ({ request }) => [200, await request.json()],
            },
            delete: {
                '/api/projects/:team_id/review_hog/repositories/:id/my_choice/': ({ params }) => {
                    clearedRepositoryIds.push(String(params.id))
                    return [200, repository({ my_choice: null, my_result: { mode: 'flash', reason: 'everyone' } })]
                },
            },
        })
        initKeaTests()
        logic = reviewHogRepositoriesLogic()
        logic.mount()
    })

    afterEach(() => {
        logic.unmount()
    })

    it('clearing my choice for a repository shows the result the server resolves from my default', async () => {
        await expectLogic(logic).toDispatchActions(['loadRepositoriesSuccess'])

        await expectLogic(logic, () => logic.actions.clearMyChoice(logic.values.repositories![0]))
            .toDispatchActions(['clearMyChoice', 'repositorySaved'])
            .toMatchValues({ busyRepositoryIds: [] })

        expect(clearedRepositoryIds).toEqual(['repo-web'])
        expect(logic.values.repositories![0]).toMatchObject({
            my_choice: null,
            my_result: { mode: 'flash', reason: 'everyone' },
        })
    })

    it('changing my default reloads the repositories, because the default decides every inherited result', async () => {
        await expectLogic(logic).toDispatchActions(['loadRepositoriesSuccess'])
        expect(listCalls).toBe(1)

        await expectLogic(logic, () => logic.actions.setDefaultReviewMode('off')).toDispatchActions([
            'updateSettingsSuccess',
            'loadRepositories',
            'loadRepositoriesSuccess',
        ])
        expect(listCalls).toBe(2)
    })
})
