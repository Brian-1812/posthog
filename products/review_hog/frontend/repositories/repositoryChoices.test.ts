import type { ReviewRepositoryApi } from 'products/review_hog/frontend/generated/api.schemas'

import { addableRepositoryNames } from './repositoryChoices'

describe('addableRepositoryNames', () => {
    it('leaves out repositories that are already added, whatever their spelling', () => {
        const added = [{ full_name: 'Example-Org/Web' }] as ReviewRepositoryApi[]

        expect(addableRepositoryNames(['example-org/web', 'example-org/api'], added)).toEqual(['example-org/api'])
    })
})
