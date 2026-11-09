type AlienSpec = {
  name: string
  title: string
  color: string
  accent: string
  tagline: string
  blurb: string
  traits: string[]
  readings: Record<'social' | 'calm' | 'cunning' | 'weird', number>
  disguise: string
}

export const ALIENS = {
  grey: {
    name: 'Grey',
    title: 'The Observer',
    color: '#9fb4ad',
    accent: '#bfe9dd',
    tagline: 'You watch. You wait. You file reports.',
    blurb:
      'Emotionally economical and quietly all-knowing. You have a detailed mental dossier on everyone who has ever wronged you, and infinite patience. You do not need to speak to win.',
    traits: ['Patient', 'Observant', 'Unreadable'],
    readings: { social: 1, calm: 5, cunning: 4, weird: 3 },
    disguise: 'generic-male',
  },
  avian: {
    name: 'Avian',
    title: 'The Messenger',
    color: '#e6b84c',
    accent: '#ffe08a',
    tagline: 'Fast, loud, three tabs ahead of everyone.',
    blurb:
      'You turn every moment into a signal and broadcast it to the flock. The group chat is your natural habitat and gossip is a renewable energy source. Deeply social, impossible to surprise.',
    traits: ['Social', 'Quick', 'Loud'],
    readings: { social: 5, calm: 1, cunning: 3, weird: 2 },
    disguise: 'food-worker',
  },
  reptilian: {
    name: 'Reptilian',
    title: 'The Warrior',
    color: '#4f7a3a',
    accent: '#9ad16a',
    tagline: 'Cold-blooded, in the best possible way.',
    blurb:
      'You run the meeting, win the argument, and feel nothing about the thermostat. Ruthlessly competent and secretly very loyal to the few you let past the perimeter.',
    traits: ['Competent', 'Cold-blooded', 'Loyal'],
    readings: { social: 2, calm: 4, cunning: 5, weird: 1 },
    disguise: 'male-officer',
  },
  cephalopod: {
    name: 'Cephalopod',
    title: 'The Hidden One',
    color: '#8a5bd6',
    accent: '#c9a7ff',
    tagline: 'Soft inside, unknowable outside.',
    blurb:
      'You change color to match the room and vanish before anyone can ask a follow-up question. Endlessly adaptable, a little mysterious, and smarter than you let on. People trust you instantly and can never say why.',
    traits: ['Adaptable', 'Mysterious', 'Trusted'],
    readings: { social: 3, calm: 3, cunning: 4, weird: 4 },
    disguise: 'crypto-bro',
  },
  mantis: {
    name: 'Mantis',
    title: 'The Mystic',
    color: '#6fae3a',
    accent: '#c6f08a',
    tagline: 'Still, patient, and deeply, wonderfully weird.',
    blurb:
      'You see patterns humans miss and you are completely comfortable with very long pauses. Spiritually you are already on another planet and you brought snacks. Serene, uncanny, quietly in charge of the vibe.',
    traits: ['Serene', 'Uncanny', 'Intuitive'],
    readings: { social: 2, calm: 5, cunning: 2, weird: 5 },
    disguise: 'citizen-1',
  },
  tallwhite: {
    name: 'Tall White',
    title: 'The Diplomat',
    color: '#e9e4df',
    accent: '#ffffff',
    tagline: 'Elegant, composed, suspiciously good at small talk.',
    blurb:
      'You could defuse an intergalactic war or a tense family dinner with the exact same serene smile. Poised, persuasive, and always the most put-together entity in the room. Leadership comes to you.',
    traits: ['Poised', 'Persuasive', 'Leader'],
    readings: { social: 5, calm: 5, cunning: 3, weird: 1 },
    disguise: 'citizen-3',
  },
} satisfies Record<string, AlienSpec>

export type Alien = keyof typeof ALIENS
export const ALIEN_KEYS = Object.keys(ALIENS) as Alien[]
export const isAlien = (k: string | null | undefined): k is Alien => ALIEN_KEYS.includes(k as Alien)

export const READINGS: [key: keyof AlienSpec['readings'], label: string][] = [
  ['social', 'Sociability'],
  ['calm', 'Composure'],
  ['cunning', 'Cunning'],
  ['weird', 'Weirdness'],
]
