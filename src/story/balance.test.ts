import { test, expect } from 'vitest'
import { storyJSON, uneven } from './count'
import { countStory } from '../../scripts/storycount.mjs'

test('every alien wins an even share of the day', () => {
  const { wins } = countStory(storyJSON())
  expect(uneven(wins)).toEqual([])
}, 300_000)
