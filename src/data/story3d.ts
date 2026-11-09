// The 3D story: one ordinary day as a graph of rooms. Everything here is
// data; the engine (src/story/) has no story of its own. In dev, the story is
// checked on every reload (src/story/check.ts) and drawn as a map at
// /storymap.html, where any room can be played with any flags.
//
// A ROOM (a beat)
//   id, title, time 'HH:MM', theme (a set in data/sets.ts), caption
//   props   [{ id, model | build | item | animal | cutes, at: [x, z], y, rotY, scale, height, fixed, when }]
//           Coordinates are on the room floor; the camera looks toward -z.
//           fixed: built into the room, there with the walls rather than
//           springing in after them; when: only there if it holds
//   Words can name the cast: '{stranger}', '{jo.their}' ('his' or 'her'),
//           '{stranger.They}' to start a sentence (see story/cast.ts)
//   enter   an act played on the way in, before the first question, the way
//           an answer is (target, body, arms, npc, reaction); it changes
//           nothing itself, and a seat it takes is kept for the first
//           question. With a menu it takes an order on the way in (the
//           waitress coming over), the room's first decision
//   npcs    [{ id, name, look | cast, castIf, at, rotY, clip, mood, moodIf, patrol, arrive, sit, when }]
//           look: an avatar, as the player's is (presetAvatar makes one);
//           cast: someone in CAST instead, settled when the day is played
//           (castIf { condition: role } swaps them); sit: the id of a seat
//           prop it sits on, at that prop's spot;
//           name: shown over them, for someone the day keeps meeting (true:
//           the cast's name for them);
//           mood: its idle motion, of the body or the arms (dine at a table);
//           moodIf { condition: mood }; arrive: points it walks in along as
//           the player does, to `at` (or, if an answer is open only `until`
//           it gets here, once that's asked); leave: points it walks on along,
//           out of the room, once its question is answered (or straight on,
//           without stopping, once you get away `until` it is here); when:
//           only there if it holds
//   asks    the questions the room puts, one after another (see A QUESTION)
//   extras  things to do any time in the room, once each: labels in the
//           room. They answer no question and score nothing (choices with a
//           target; they can set flags). Whatever scores is a question's
//           answer, on the card at the bottom
//   next    where the room leads once they're answered (see WAYS); nextIf
//           { condition: way }, first that holds wins. None: the day ends
//   doors   [{ to: room, wall: -1 left | 1 right | 0 back, at, also }]
//           join rooms of one building; a way to a room of the building
//           goes door to door through the rooms between, not the map.
//           { to: 'out' }: the room opens onto the street at its front;
//           a room without one goes out (and comes in) through the
//           nearest room that has one
//   sets / clears   flags raised / lowered on walking in
//   captionIf, timeIf   { condition: caption or time }, first that holds wins.
//           A caption or question that starts with the time ('07:50.',
//           'Three o'clock.') says what time it is now: the checker holds it
//           to the clock, and holds the clock to going forwards
//   busAway condition: the bus is pulling away from the stop as you get there
//   ambient fx the room plays from the start (`keep: true` survives acting,
//           `when`: only if it holds)
//
// A QUESTION
//   q       the question; when: asked only if the condition holds; time:
//           the clock moves on to it
//   choices three answers at most (see CHOICE), each `when` it holds, on a
//           card at the bottom. Answers with a target are then acted out in
//           the room; answers without one are places to go, with an icon
//           and a `to`, or just carry on. Answers that each go through a
//           different door of the room are signs on those doors instead
//   phone   what's on the phone, held up beside the card while it's asked:
//           { from, texts: [{ at 'HH:MM', text, when }] }, the texts sent by
//           the time it is now (the last few), or { from, call: true }
//   at      [x, z]: where the character steps to as it comes up, out from
//           behind wherever the last answer left it (a desk), say so the
//           phone in its hand shows
//   look    a prop id or 'npc:<id>' the character turns its head to while
//           it's asked ('octopus': you notice #42)
//   think   true: not a question the room puts but one that suddenly
//           strikes the character ("hold on..."), in a thought bubble over
//           its head instead of the card
//
// A CHOICE (an answer)
//   label, target (a prop id, 'npc:<id>' or a point), score (see SCORING)
//   to      where it leads, now, instead of the room's next
//   door    the door it goes through (a room the door joins, or 'out' for
//           the mat at the front): when every answer has its own door, they
//           are signs on the doors, and the card only asks
//   body, bodyMotion, arms, hold, face, time: what the character does (three/acts.ts)
//   fx      what the room does in response (three/Fx.tsx)
//   npc     a bystander's reaction: { id, react (a body or arm motion), for:
//           seconds it lasts before they go back to their mood (else until
//           the next), emote, at0, emoteAt, walk: [x, z] to come over first,
//           leave: points they walk off along, out of the room }. A menu option's `npc` is the
//           same without the id: the one the act is with
//   emote, reaction   the floating icon and the line in the speech bubble
//   sayAt   the line waits this long into the act, when it tells how the act
//           turns out (a bystander's reaction), so it doesn't come first
//   phone   (as a question's) on screen once it's in hand
//   sets / clears     flags
//   menu    pauses the act on a question: { prompt, at, options, serve, by }
//           (`by`: a bystander here asks it, in a speech bubble over them)
//   until   a bystander who `arrive`s: the answer is open only until they get
//           here, a fuse burning down on it as they walk in; the other answers
//           wait for them to get here, and this one lasts till they've gone
//
// AN OPTION (of a menu or a card such as WAKE, FARE, CROSSING)
//   label, icon, score, reaction, emote, sets / clears, and
//   odds: 0.5 with win: {...} / lose: {...}: a gamble whose outcome adds to
//   or overrides the option; item: what you're served, and fetch { prop,
//   from, item }: served from a prop in the room, which whoever serves goes
//   to (`from`) and takes away, carrying `item`, on the way to the pickup
//
// WAYS (next, nextIf, an answer's to)
//   'room'                 that room
//   { to: 'room', by: 'bus' }   there by bus
//   { fork: ['a', 'b'] }   whichever room best tells apart the three aliens
//                          the player is closest to so far (engine forkTo)
//
// CONDITIONS (when, captionIf, timeIf, nextIf, a card's when)
//   a flag name, !flag, a && b, a || b, parentheses: 'badge && !late'
//
// SCORING: every option a player picks leans toward the aliens whose way of
// handling the moment it is: score: { reptilian: 3, avian: 1 } (aliens left
// out count 0). Each alien keeps one style all day: Grey watches, studies
// and does it by the book; Avian talks, texts and can't keep quiet;
// Reptilian charges in, competes and gets it done; Cephalopod blends in,
// hides and goes soft; Mantis is calm, odd and in tune with things; Tall
// White is polite, poised and smooths everything over. The checker plays
// many random days and warns when an alien wins too rarely or too often.
//
// THE DAY: an ordinary day, played straight by someone who isn't from
// here. Jo, a friend, texts a party invite at dawn (tonight, 9pm, at
// Jo's); the boss hands over the Henderson report in the morning and wants
// it in the afternoon. Mr Pell next door and a stray cat turn up more than
// once, and the evening remembers what you did with them. Every room is a
// question or two; where the day goes is partly the player's answer (bus or
// breakfast, where to have lunch) and partly the scores: the morning and
// the evening fork toward the rooms that test the aliens still in the
// running.

import { SKIN_TONES, emptyColors, presetAvatar } from './models'
import type { Avatar, Beat, Card, Choice, Dice, Extra, Npc, Option, Person, Phone, Point, Prop, Spot, Target, Toss } from '../story/types'

export const START = 'bedroom'

export const INTRO = 'A normal human day. Act natural.'
export const PRE_REVEAL = 'End of day. Time to take the human off.'

const LUNCH: Option[] = [
  { label: 'Burger, extra everything', icon: '🍔', item: 'burger', arms: 'eat', emote: '🍔', reaction: 'Gone in three bites. You may have eaten the paper too.', score: { reptilian: 2 } },
  { label: 'Pizza, folded in half', icon: '🍕', item: 'pizza', arms: 'eat', emote: '🍕', reaction: 'You fold it and talk with your mouth full. Extremely human.', score: { avian: 2 } },
  { label: 'A neat little sandwich', icon: '🥪', item: 'sandwich', arms: 'eat', emote: '✨', reaction: 'Crusts off, napkin on the lap. Impeccable.', score: { tallwhite: 2 } },
  { label: 'Just coffee, black', icon: '☕', item: 'mug', arms: 'sip', emote: '👀', reaction: 'You watch everyone else eat. Taking notes.', score: { grey: 3 } },
  { label: 'Milkshake, three straws', icon: '🥤', item: 'milkshake', arms: 'sip', emote: '🥤', reaction: 'All three straws at once. Nobody saw how.', score: { cephalopod: 2 } },
  { label: 'A donut, eaten very slowly', icon: '🍩', item: 'donut', arms: 'eat', emote: '🍩', reaction: 'One crumb at a time. Forty minutes. Worth it.', score: { mantis: 3 } },
]

const JO_SHE: Avatar = { ...presetAvatar('citizen-3'), skin: SKIN_TONES[3], colors: { ...emptyColors(), hair: '#1d1f2b' } }
const JO_HE: Avatar = { ...presetAvatar('prisoner'), outfit: 'citizen-2', shoes: 'generic-male', skin: SKIN_TONES[3], colors: { ...emptyColors(), hair: '#1d1f2b', top: '#e53946' } }
const JO_DINER: Spot = { at: [0.85, -1.3], rotY: -1.15 }
const YOU_DINER: Spot = { at: [-2.05, -1.3], rotY: 1.15 }
const DATE_SEAFOOD: Spot = { at: [-0.95, -0.85], rotY: 1.15 }
const YOU_SEAFOOD: Spot = { at: [1.35, -0.85], rotY: -1.15 }

const LENA: Avatar = { ...presetAvatar('generic-female'), skin: SKIN_TONES[0], outfit: 'citizen-1', shoes: 'citizen-1', colors: { ...emptyColors(), hair: '#f2c14e', top: '#7b4bd6' } }
const LEO: Avatar = { ...presetAvatar('retail-worker'), skin: SKIN_TONES[0], outfit: 'generic-male', shoes: 'generic-male', colors: { ...emptyColors(), hair: '#f2c14e', top: '#7b4bd6' } }

const SHE = { they: 'she', them: 'her', their: 'her', person: 'woman' }
const HE = { they: 'he', them: 'him', their: 'his', person: 'man' }
const JO_PEOPLE: Record<Toss, Person> = { she: { name: 'Jo', look: JO_SHE, ...SHE }, he: { name: 'Jo', look: JO_HE, ...HE } }
const BOSS_PEOPLE: Record<Toss, Person> = {
  she: { name: 'the boss', look: presetAvatar('generic-female'), ...SHE },
  he: { name: 'the boss', look: presetAvatar('crypto-bro'), ...HE },
}
export const CAST = {
  jo: (_you: unknown, dice: Dice) => JO_PEOPLE[dice.jo],
  boss: (_you: unknown, dice: Dice) => BOSS_PEOPLE[dice.boss],
  stranger: (you: Pick<Avatar, 'body'>) => (you.body === 'female' ? { name: 'Leo', look: LEO, ...HE } : { name: 'Lena', look: LENA, ...SHE }),
} satisfies Record<string, (you: Avatar, dice: Dice) => Person>

const WAITRESS: Avatar = { ...presetAvatar('citizen-2'), body: 'female', outfit: 'food-worker', shoes: 'citizen-3', colors: { ...emptyColors(), hair: '#c9ccd4', top: '#1d1f2b', top2: '#f7f3ea', shoes: '#1d1f2b' } }
const WAITRESS_AT_TABLE: Point = [2.8, -1.4]
const HATCH: Point = [3.6, -3.35]

const SEAFOOD: Option[] = [
  { label: '#7, the catch of the day', icon: '🐟', item: 'fish', arms: 'eat', emote: '🐟', reaction: 'Nobody will say what it was. It was delicious.', score: { tallwhite: 2 } },
  { label: '#15, fish and chips. Extra chips.', icon: '🍟', item: 'fries', arms: 'eat', emote: '🍟', reaction: 'Chips first, then the fish, then a bit of the napkin.', score: { reptilian: 1, avian: 1 } },
  { label: '#1, just the soup', icon: '🥣', item: 'mug', arms: 'sip', emote: '👀', reaction: 'Small sips, while you watch how the humans do dinner.', score: { grey: 2 } },
  {
    label: '#42, the octopus',
    icon: '🐙',
    item: 'grilled',
    fetch: { prop: 'octopus', from: [-4.3, -3.25], item: 'octopus' },
    arms: 'eat',
    emote: '🍋',
    sets: 'ate42',
    reaction: '#42, grilled, with a wedge of lemon. You do not look it in the eye.',
    score: { reptilian: 1, mantis: 1 },
  },
]

const JO: Phone = {
  from: 'Jo',
  texts: [
    { at: '06:44', text: 'party at mine tonight, 9pm!! 🎉' },
    { at: '06:44', text: 'you HAVE to come' },
    { at: '09:58', text: 'hello?? 👀' },
    { at: '12:15', text: 'lunch?? 🍔' },
    { at: '12:15', text: 'omw!! 🏃', me: true, when: 'lunchjo' },
    { at: '12:15', text: 'so sorry, swamped today 😩', me: true, when: 'swamped' },
    { at: '12:16', text: 'nooo ok 😢 tonight tho!!', when: 'swamped' },
    { at: '12:40', text: 'hello??? 👀👀', when: 'onread' },
    { at: '21:05', text: "party's off, I'm sick 🤒 sorry!!", when: 'sick' },
  ],
}

const TEXT_BACK: Partial<Choice> = {
  target: [-0.4, 0.6],
  face: 0,
  arms: 'phone',
  hold: { item: 'phone', at: 0 },
  phone: JO,
  emote: { text: '💬', from: 1.2 },
  time: 3.4,
}

const checkPhone = (target: Target, more?: Partial<Extra>): Extra => ({
  label: 'Check your phone',
  when: '!readjo',
  target,
  arms: 'phone',
  hold: { item: 'phone', at: 0.2 },
  time: 5.5,
  phone: JO,
  sets: 'readjo',
  ...more,
})

export const WAKE: Card = {
  prompt: 'The alarm is ringing. It is 06:45.',
  options: [
    { label: 'Up with the alarm', icon: '⏰', emote: '☀️', time: 1.2, hush: true, reaction: 'Up before the alarm finishes its sentence. The whole morning is yours.' },
    { label: 'Snooze. Five more minutes.', icon: '😴', emote: '💤', time: 3, hush: true, sets: 'late', reaction: 'Five minutes becomes an hour. It is 07:50.' },
  ],
}

const HOME_DESK: Prop[] = [
  { id: 'laptop', model: 'office/laptop-kenney', at: [2.7, -2.15], y: 1.18 },
  { id: 'chair', model: 'office/desk-chair', at: [2.7, -3.15] },
  { id: 'badge', item: 'badge', at: [1.9, -1.6], y: 1.18, height: 0.25 },
]

const PELL = presetAvatar('retail-worker')

const BOSS_OUT: Point[] = [[-4.5, -1.5], [-5.6, -1.5]]

const DESK: Prop[] = [
  { id: 'desk', model: 'office/desk', at: [-1.8, -1.9], rotY: Math.PI },
  { id: 'screen', model: 'office/laptop-kenney', at: [-1.8, -2.15], y: 1.18 },
  { id: 'chair', model: 'office/desk-chair', at: [-1.8, -3.15] },
  { id: 'cooler', model: 'office/water-cooler', at: [2.4, -3.6] },
  { id: 'board', model: 'office/whiteboard', at: [3.7, 0.3], y: 0.75, stand: 1.9, rotY: Math.PI + 0.35 },
  { id: 'beanbag', model: 'office/bean-bag', at: [-3.9, 0.9] },
]
const COWORKER: Npc = { id: 'coworker', look: presetAvatar('generic-male'), at: [3.3, -2.5], rotY: -0.8 }

export const FARE: Card = {
  when: '!buscard',
  time: '07:55',
  prompt: 'The bus pulls up. You pat every pocket. No bus card.',
  options: [
    {
      label: 'Sweet-talk the driver',
      icon: '🗣️',
      emote: '🗣️',
      score: { tallwhite: 2, avian: 1 },
      odds: 0.5,
      win: { ride: true, reaction: 'The driver sighs and waves you on. Charm 1, rules 0.' },
      lose: { sets: 'walking', reaction: "'No card, no ride.' The doors hiss shut. You walk." },
    },
    { label: 'Walk to work', icon: '🚶', emote: '🚶', sets: 'walking', reaction: 'You wave the bus off. It is a long walk. You will be late.', score: { reptilian: 2, mantis: 1 } },
  ],
}

export const CROSSING: Card = {
  prompt: 'The crossing shows the red man. There is not a car in sight.',
  options: [
    { label: 'Wait for the walk signal', icon: '🚶', how: 'wait', reaction: 'You wait. Alone. On an empty road. Rules are rules.', score: { grey: 2, tallwhite: 1 } },
    { label: 'Look both ways, then cross', icon: '👀', how: 'look', reaction: 'Left, right, left again. Nobody saw anything unusual.', score: { cephalopod: 2, mantis: 1 } },
    { label: 'Just run for it', icon: '🏃', how: 'run', reaction: 'Somewhere a horn honks. You are already gone.', score: { reptilian: 2, avian: 1 } },
  ],
}

export const BEATS: Beat[] = [
  {
    id: 'bedroom',
    theme: 'home',
    time: '06:45',
    timeIf: { late: '07:50' },
    title: 'Bedroom',
    caption: 'Your phone buzzes on the bedside table.',
    captionIf: { late: "07:50. You overslept. The bus is in five minutes, and there's a text on your phone." },
    doors: [
      { to: 'bathroom', wall: -1, at: -1.5 },
      { to: 'kitchen', wall: 1, at: -1.5 },
      { to: 'out' },
    ],
    props: [
      { id: 'bed', model: 'home/bed-double', at: [-2.4, -2.6] },
      { model: 'home/side-table', at: [0, -3.9] },
      { id: 'radio', model: 'home/radio', at: [0, -3.9], y: 1.18 },
      { model: 'home/side-table', at: [-4.8, -3.9] },
      { id: 'alarm', build: 'clock', at: [-4.8, -3.9], y: 1.18, height: 0.4 },
      { id: 'phone', item: 'phone', at: [-4.4, -3.75], y: 1.18, height: 0.2 },
      { id: 'rug', model: 'home/rug-round', at: [0.4, 0.4], scale: 0.6 },
      { id: 'rack', model: 'home/coat-rack', at: [4.7, -3.6] },
      ...HOME_DESK,
      { id: 'buscard', item: 'buscard', at: [3.5, -1.6], y: 1.18, height: 0.2 },
    ],
    ambient: [
      { type: 'shake', prop: 'alarm' },
      { type: 'emit', prop: 'alarm', text: ['⏰', '🔔'], every: 0.7 },
    ],
    asks: [
      {
        q: 'Where to first?',
        choices: [
          { label: 'Bathroom', icon: '🚿', door: 'bathroom', sets: 'tobath', score: { cephalopod: 1, tallwhite: 1 } },
          { label: 'Kitchen', icon: '🍳', door: 'kitchen', sets: 'tokitchen', score: { reptilian: 1, avian: 1 } },
          { label: 'Straight out to the bus', icon: '🚏', door: 'out', sets: 'rushed', score: { grey: 1, tallwhite: 1 } },
        ],
      },
      {
        when: '!rushed',
        think: true,
        q: 'Hold on. How do humans actually do any of this?',
        choices: [
          {
            label: 'Look up how humans do work',
            icon: '💼',
            target: 'chair',
            body: 'sit',
            arms: 'type',
            fx: [{ type: 'emit', prop: 'laptop', text: ['🔎', '💼'], every: 0.5 }],
            reaction: "Nod in meetings. Say 'circling back'. Never take the last donut. Noted.",
            score: { grey: 2, cephalopod: 1 },
          },
          {
            label: 'Look up how humans do parties',
            when: 'readjo',
            icon: '🎉',
            target: 'chair',
            body: 'sit',
            arms: 'type',
            fx: [{ type: 'emit', prop: 'laptop', text: ['🔎', '🎉'], every: 0.5 }],
            reaction: "Forty tabs. Humans bring snacks and 'just be themselves'. Noted.",
            score: { avian: 2 },
          },
          {
            label: 'Nah. Wing it.',
            icon: '🤷',
            target: [0.8, 0.2],
            face: 0,
            emote: { text: '🤷', from: 0.3 },
            reaction: 'How hard can it be? Humans do it every day.',
            score: { mantis: 2, reptilian: 1 },
          },
        ],
      },
    ],
    nextIf: { tobath: 'bathroom', tokitchen: 'kitchen' },
    next: 'street',
    extras: [
      checkPhone('phone', {
        arms: [['reach', 0.9], ['phone']],
        fx: [{ type: 'take', prop: 'phone', at0: 0.8 }],
        hold: { item: 'phone', at: 0.9 },
        reaction: 'A party. Humans, gathered on purpose, after dark. You are invited.',
      }),
      {
        label: 'Grab your office badge',
        target: 'badge',
        arms: [['reach', 1.0]],
        fx: [{ type: 'take', prop: 'badge', at0: 0.9 }],
        hold: { item: 'badge', at: 1.0 },
        time: 2.2,
        sets: 'badge',
        reaction: 'Badge. The photo looks nothing like you. Good.',
      },
      {
        label: 'Grab your bus card',
        target: 'buscard',
        arms: [['reach', 1.0]],
        fx: [{ type: 'take', prop: 'buscard', at0: 0.9 }],
        hold: { item: 'buscard', at: 1.0 },
        time: 2.2,
        sets: 'buscard',
        reaction: 'Bus card. Twelve rides left. Or one, it is hard to read.',
      },
    ],
  },
  {
    id: 'bathroom',
    theme: 'bathroom',
    time: '07:00',
    timeIf: { 'late && ate': '08:20', late: '08:00', ate: '07:25' },
    title: 'Bathroom',
    sets: 'washed',
    caption: 'One mirror. Time to put the human face on.',
    doors: [{ to: 'bedroom', wall: 1, at: -1.5 }],
    props: [
      { id: 'shower', build: 'shower', at: [-3.6, -3.1] },
      { id: 'sink', model: 'home/kitchen-sink', at: [1.2, -3.85] },
      { id: 'mirror', build: 'mirror', at: [1.2, -4.42], y: 1.75, height: 0.4 },
      { id: 'rack', model: 'home/coat-rack', at: [4.0, -3.4] },
    ],
    extras: [
      {
        label: 'Smell the soap',
        target: 'sink',
        arms: 'reach',
        emote: { text: '👃', from: 1 },
        reaction: "It smells of 'ocean breeze'. You have been to an ocean. This is not it.",
      },
    ],
    asks: [
      {
        think: true,
        q: 'Which bit of the human do you work on?',
        choices: [
          {
            label: 'Long hot shower. Very long.',
            target: [-3.6, -3.2],
            face: 0,
            arms: 'dance',
            fx: [
              { type: 'water', at: [-3.6, -3.2], height: 2.4 },
              { type: 'emit', at: [-3.6, -3.1], height: 2.6, text: ['🫧', '💧', '♨️'], every: 0.5 },
            ],
            reaction: 'Under the water until the mirror fogs over. You feel like yourself for the first time all week.',
            score: { cephalopod: 3, mantis: 1 },
          },
          {
            label: 'Brush all of your teeth',
            target: 'sink',
            arms: 'brush',
            hold: { item: 'toothbrush', at: 0.3 },
            emote: { text: '🦷', from: 0.6, every: 0.9 },
            reaction: 'All of them. Even the ones at the back. Even the second row.',
            score: { reptilian: 3, tallwhite: 1 },
          },
          {
            label: 'Practise human smiles in the mirror',
            target: [0.1, -3.1],
            face: 1.0,
            arms: 'talk',
            emote: { text: ['🙂', '😐', '😬', '🤨', '😁'], every: 0.6 },
            reaction: 'Smile number four is perfect. You save it for the boss.',
            score: { tallwhite: 3, avian: 1 },
          },
        ],
      },
      {
        when: '!ate',
        q: 'Breakfast, or straight to the bus?',
        choices: [
          { label: 'Breakfast', icon: '🍳', to: 'kitchen', score: { mantis: 1 } },
          { label: 'Straight to the bus', icon: '🚏', to: 'street' },
        ],
      },
    ],
    next: 'street',
  },
  {
    id: 'kitchen',
    theme: 'kitchen',
    time: '07:00',
    timeIf: { 'late && washed': '08:20', late: '08:00', washed: '07:25' },
    title: 'Breakfast',
    sets: 'ate',
    caption: 'Most important meal of the day, according to the humans.',
    doors: [
      { to: 'bedroom', wall: -1, at: -1.5 },
      { to: 'out' },
    ],
    props: [
      { model: 'home/kitchen-counter', at: [-3.4, -3.7] },
      { id: 'toaster', model: 'home/toaster', at: [-3.4, -3.7], y: 1.4 },
      { model: 'home/kitchen-stove', at: [-2.07, -3.7] },
      { model: 'home/kitchen-sink', at: [-0.74, -3.7] },
      { model: 'home/kitchen-counter', at: [0.59, -3.7] },
      { id: 'coffee', model: 'office/coffee-maker', at: [0.59, -3.75], y: 1.4 },
      { model: 'home/kitchen-counter', at: [1.92, -3.7] },
      { id: 'fridge', model: 'home/fridge', at: [3.4, -3.95] },
      { id: 'table', model: 'diner/table-round', at: [1.3, 0.4] },
      { id: 'chair', model: 'diner/chair', at: [-0.2, 0.4], rotY: 1.57 },
      { model: 'diner/chair', at: [2.85, 0.4], rotY: -1.57 },
    ],
    asks: [
      {
        think: true,
        q: 'What does a human have for breakfast?',
        choices: [
          {
            label: 'Coffee. Now.',
            target: 'coffee',
            arms: [['reach', 1.2], ['sip', 3.4], [null]],
            hold: { item: 'mug', at: 1.2, until: 3.4 },
            fx: [
              { type: 'emit', prop: 'coffee', text: '♨️', every: 0.4, until: 1.2 },
              { type: 'spawn', item: 'diner/coffee-cup', at: [1.15, -3.55], y: 1.4, at0: 3.4, keep: true },
            ],
            emote: { text: '😌', from: 1.8 },
            reaction: 'First sip. Your pupils go vertical for a second.',
            score: { reptilian: 3, avian: 1 },
          },
          {
            label: 'Make toast',
            target: 'toaster',
            arms: [['reach', 1.6], ['eat']],
            fx: [{ type: 'pop', prop: 'toaster', item: 'toast', at: 0.9 }],
            hold: { item: 'toast', at: 1.6 },
            emote: { text: '😋', from: 2 },
            reaction: 'It pops. You catch it without looking. Normal human reflexes.',
            score: { mantis: 3, avian: 1 },
          },
          {
            label: 'Pancakes at the table',
            target: 'chair',
            body: 'sit',
            arms: 'eat',
            fx: [{ type: 'spawn', item: 'diner/pancakes', at: [0.85, 0.4], y: 1.15 }],
            emote: '🥞',
            reaction: 'A proper breakfast, napkin on the lap. Very convincing.',
            score: { tallwhite: 3, avian: 1 },
          },
        ],
      },
      {
        when: '!washed',
        q: 'Bathroom, or out to the bus?',
        choices: [
          { label: 'Bathroom', icon: '🚿', door: 'bedroom', to: 'bathroom' },
          { label: 'Out to the bus', icon: '🚏', door: 'out', to: 'street' },
        ],
      },
    ],
    extras: [checkPhone([0.4, 1.6], { face: 0, reaction: 'Jo is having a party tonight. You read it twice, to be sure.' })],
    next: 'street',
  },
  {
    id: 'street',
    theme: 'city',
    time: '07:45',
    timeIf: { 'late && washed && ate': '08:40', 'late && !rushed': '08:20', late: '07:54' },
    title: 'Bus Stop',
    caption: 'The bus is at 07:55. Coming along the pavement: Mr Pell from next door, who once talked for forty minutes about his hedge. A stray cat is judging you.',
    captionIf: {
      'late && !rushed': 'You missed your bus long ago, and the next one pulls away just as you get there. Even the stray cat is judging you.',
      late: 'You make it with a minute to spare. Coming along the pavement: Mr Pell from next door, who once talked for forty minutes about his hedge.',
      rushed: 'Quarter to eight, after an hour at the bus stop. Coming along the pavement: Mr Pell from next door, who once talked for forty minutes about his hedge. A stray cat is judging you.',
    },
    busAway: '(late && !rushed) || walking',
    props: [
      { id: 'bench', model: 'city/bench', at: [-1.6, -2.2] },
      { id: 'cat', animal: 'cat', height: 1.25, size: [0.7, 1.1], at: [0.4, -0.6], rotY: -0.3 },
      { id: 'hedge', model: 'nature/bush', at: [-3.0, 0.2], scale: 1.2 },
      { model: 'city/stop-sign', at: [2.3, -2.4] },
    ],
    npcs: [{ id: 'pell', name: 'Mr Pell', when: '!late || rushed', look: PELL, at: [1.6, 1.4], rotY: -1.4, arrive: [[14, 1.4]], leave: [[-9, 1.4]] }],
    asks: [
      {
        when: '!late || rushed',
        q: 'Mr Pell is nearly here, and he has seen you. Talk, or hide?',
        choices: [
          {
            label: 'Say good morning to Mr Pell',
            target: 'npc:pell',
            arms: 'talk',
            npc: { id: 'pell', react: 'laugh', emote: '😅', at0: 1.0, emoteAt: 1.8 },
            emote: { text: '☁️', from: 1.8 },
            reaction: 'His hedge, his knee, his nephew. You nod in all the right places. Mr Pell thinks you are lovely, and goes on his way.',
            sets: 'metpell',
            score: { tallwhite: 3, avian: 1 },
          },
          {
            label: 'Hide behind the hedge',
            target: 'hedge',
            until: 'pell',
            body: 'hide',
            emote: '🫣',
            reaction: "Mr Pell strolls right past the hedge, humming. He hasn't seen you. Probably.",
            sets: 'hidpell',
            score: { cephalopod: 3, grey: 1 },
          },
          {
            label: 'Ignore him. Stare calmly at the road.',
            target: [-1.2, 0.4],
            face: 0,
            npc: { id: 'pell', react: 'lean', emote: '👋', at0: 0.3 },
            emote: { text: '😐', from: 0.6, every: 1.6 },
            reaction: 'He says good morning twice, then gives up and walks on. You and the road understand each other.',
            sets: 'snubpell',
            score: { mantis: 3, grey: 1 },
          },
        ],
      },
      {
        when: '!late || rushed',
        q: 'Mr Pell is gone. Here comes the bus. Get on, or walk to work?',
        choices: [
          { label: 'Get on the bus', icon: '🚌', reaction: 'Bus, then office. By the book.', score: { grey: 2, tallwhite: 1 } },
          { label: "Walk. It's a lovely morning.", icon: '🚶', sets: 'walking', reaction: 'You wave the bus off. It is a long walk, and you will be late. Worth it.', score: { mantis: 3, avian: 1 } },
        ],
      },
      {
        when: 'late && !rushed',
        q: 'Missed it. How do you get to work?',
        choices: [
          { label: 'Call a ride', icon: '🚕', sets: 'ride', score: { tallwhite: 2, reptilian: 1 } },
          { label: 'Walk. A ride costs money.', icon: '🚶', sets: 'walking', score: { grey: 2, mantis: 1 } },
        ],
      },
    ],
    extras: [
      {
        label: 'Pet the stray cat',
        target: 'cat',
        body: 'crouch',
        arms: 'stroke',
        fx: [{ type: 'anim', prop: 'cat', clip: 'Headbutt', at0: 0.9, dur: 2.2 }],
        emote: { text: '❤️', from: 1 },
        reaction: 'The cat purrs and leans into your hand. It may have decided to follow you home.',
        sets: 'cat',
      },
      checkPhone('bench', { body: 'sit', reaction: 'Jo is having a party tonight. You sit and read it until you know it by heart.' }),
    ],
    next: { to: 'office', by: 'bus' },
    nextIf: {
      walking: 'park',
      'ride && !badge': { to: 'lobby', by: 'ride' },
      ride: { to: 'office', by: 'ride' },
      '!badge': { to: 'lobby', by: 'bus' },
    },
  },
  {
    id: 'lobby',
    theme: 'lobby',
    time: '08:20',
    timeIf: { walking: '09:30', ride: '08:55' },
    title: 'Security',
    sets: 'security',
    caption: 'No badge, no entry. The guard has never seen you before, and he has worked here for years.',
    doors: [
      { to: 'office', also: ['boss'], wall: 0, at: -1.4 },
      { to: 'out' },
    ],
    props: [
      { id: 'desk', model: 'office/desk', at: [2.2, -3.0], rotY: Math.PI },
      { id: 'book', model: 'home/books', at: [1.8, -2.8], y: 1.18 },
      { id: 'arch', build: 'arch', at: [-1.4, -2.6], height: 2.4 },
      { id: 'bench', model: 'city/bench', at: [-4.0, -3.6] },
    ],
    npcs: [{ id: 'guard', look: presetAvatar('male-officer'), at: [4.0, -3.4], rotY: -0.8 }],
    extras: [
      {
        label: 'Wave at the camera over the arch',
        target: 'arch',
        arms: 'wave',
        reaction: 'Somewhere, a screen shows a very normal human waving at nothing.',
      },
    ],
    asks: [
      {
        q: 'No visitors without a host. How do you get past the guard?',
        choices: [
          {
            label: 'Sweet-talk the guard',
            target: 'npc:guard',
            arms: 'talk',
            npc: { id: 'guard', react: 'laugh', emote: '😄', at0: 1.2 },
            emote: '😎',
            reaction: 'Two jokes in, he is showing you photos of his dog. He waves you through.',
            score: { avian: 3, tallwhite: 1 },
          },
          {
            label: 'Call the boss to let you in',
            target: 'bench',
            arms: 'phone',
            hold: { item: 'phone', at: 0.2 },
            time: 4.5,
            npc: { id: 'guard', react: 'look', emote: '☎️', at0: 2.4 },
            emote: { text: '📞', from: 0.4, every: 1.4 },
            reaction: "'You forgot your WHAT?' The boss tells the guard to let you up, and says you will talk about it upstairs.",
            sets: 'calledboss',
            score: { cephalopod: 3, grey: 1 },
          },
          {
            label: 'Go back home for your badge',
            target: [0.6, 1.2],
            face: 0,
            emote: '🤦',
            time: 2.2,
            reaction: 'All the way home, and all the way back. You are going to be so late.',
            to: 'forgot',
            sets: 'goback',
            score: { grey: 3, mantis: 1 },
          },
        ],
      },
    ],
    next: 'office',
  },
  {
    id: 'forgot',
    theme: 'home',
    time: '08:50',
    timeIf: { walking: '10:00', ride: '09:25' },
    title: 'Back Home',
    caption: 'All the way home again. Your badge is on the desk, right where you left it.',
    doors: [{ to: 'out' }],
    props: [
      { id: 'bed', model: 'home/bed-double', at: [-2.4, -2.6] },
      { model: 'home/side-table', at: [0, -3.9] },
      { model: 'home/radio', at: [0, -3.9], y: 1.18 },
      { id: 'rug', model: 'home/rug-round', at: [0.4, 0.4], scale: 0.6 },
      { id: 'rack', model: 'home/coat-rack', at: [4.7, -3.6] },
      ...HOME_DESK,
    ],
    asks: [
      {
        think: true,
        q: 'Your badge, right where you left it. Now what?',
        choices: [
          {
            label: 'Grab it and run',
            target: 'badge',
            arms: [['reach', 1.0]],
            fx: [{ type: 'take', prop: 'badge', at0: 0.9 }],
            hold: { item: 'badge', at: 1.0 },
            time: 2.2,
            emote: { text: '💨', from: 1.4 },
            reaction: 'Badge. Out of the door at a run.',
            sets: 'badge',
            to: 'office',
            score: { reptilian: 2, grey: 1 },
          },
          {
            label: "Grab it, and text the boss you're on your way",
            target: 'badge',
            arms: [['reach', 1.0], ['phone']],
            fx: [{ type: 'take', prop: 'badge', at0: 0.9 }],
            hold: { item: 'phone', at: 1.3 },
            time: 4.5,
            reaction: "'On my way!!' The boss reads it, and does not reply.",
            sets: 'badge',
            score: { avian: 2 },
          },
        ],
      },
    ],
    next: 'office',
  },
  {
    id: 'office',
    theme: 'office',
    time: '08:30',
    timeIf: { 'goback && walking': '10:40', 'goback && ride': '10:05', goback: '09:35', walking: '09:40', ride: '09:05', security: '08:35' },
    title: 'The Office',
    caption: "An email from the boss: 'The Henderson report. By three o'clock. Don't let me down.'",
    captionIf: {
      goback: 'Very late, after the trip home for your badge. The boss is waiting at your desk, arms folded.',
      calledboss: 'Upstairs at last. The boss is waiting at your desk, arms folded.',
      'walking || ride': "Late. A note from the boss is stuck to your screen: 'The Henderson report. Due at three.'",
      security: "Past security at last. An email from the boss: 'The Henderson report, by three.'",
    },
    doors: [{ to: 'lobby', wall: -1, at: -1.5 }],
    props: DESK,
    npcs: [COWORKER, { id: 'boss', cast: 'boss', when: 'goback || calledboss', at: [0.6, -0.4], rotY: -0.5 }],
    extras: [
      {
        label: 'Study the whiteboard',
        target: 'board',
        emote: { text: '📈', from: 0.8 },
        reaction: 'A chart that only goes up. You nod at it like it means something.',
      },
    ],
    asks: [
      {
        when: 'goback || calledboss',
        q: "The boss taps the clock. 'Well?' What do you say?",
        choices: [
          {
            label: 'Own up: you forgot your badge',
            target: 'npc:boss',
            arms: 'talk',
            npc: { id: 'boss', react: 'look', emote: '😮‍💨', at0: 1.2, leave: BOSS_OUT },
            reaction: "'At your own job.' The boss sighs, lets it go, and leaves you the Henderson report. Due at three.",
            score: { tallwhite: 2, grey: 1 },
          },
          {
            label: 'Make a joke of it',
            target: 'npc:boss',
            arms: 'talk',
            emote: '😅',
            npc: { id: 'boss', react: 'look', emote: '😑', at0: 1.4, leave: BOSS_OUT },
            reaction: "'Funny.' The boss does not laugh, and leaves you the Henderson report. Due at three.",
            score: { avian: 2, mantis: 2 },
          },
          {
            label: 'Promise it will never happen again',
            target: 'npc:boss',
            arms: 'talk',
            emote: '🤞',
            npc: { id: 'boss', react: 'lean', emote: '🧐', at0: 1.2, leave: BOSS_OUT },
            reaction: "'It had better not.' The boss leaves you the Henderson report. Due at three.",
            score: { reptilian: 3, cephalopod: 1 },
          },
        ],
      },
      {
        think: true,
        q: 'The Henderson report. What do you do first?',
        choices: [
          {
            label: 'Start the report right now',
            target: 'chair',
            body: 'sit',
            arms: 'type',
            fx: [{ type: 'emit', prop: 'screen', text: ['📄', '⌨️'], every: 0.3 }],
            reaction: 'Done before lunch. Your coworkers are frightened.',
            sets: 'report',
            score: { reptilian: 2, grey: 1 },
          },
          {
            label: 'Gossip at the water cooler',
            target: 'npc:coworker',
            arms: 'talk',
            npc: { id: 'coworker', react: 'laugh', emote: '😂' },
            emote: '🤫',
            reaction: 'You hear three rumours about the boss and start a fourth.',
            score: { avian: 3, cephalopod: 1 },
          },
          {
            label: 'Power nap on the bean bag',
            target: 'beanbag',
            body: 'sit',
            sleep: true,
            emote: { text: '💤', from: 0.6 },
            bodyMotion: 'flop',
            reaction: 'Twenty minutes. Nobody noticed. You are very good at not being noticed.',
            score: { cephalopod: 3, mantis: 1 },
          },
        ],
      },
      {
        time: '12:15',
        q: 'A text from Jo, asking you to lunch. What do you text back?',
        phone: JO,
        at: [-0.4, 0.6],
        choices: [
          {
            label: "'omw!!' Lunch with Jo",
            icon: '🍔',
            ...TEXT_BACK,
            sets: 'lunchjo',
            to: 'carpark',
            reaction: 'Two exclamation marks. You are getting the hang of texting.',
            score: { avian: 2 },
          },
          {
            label: "'So sorry, swamped today'",
            icon: '😩',
            ...TEXT_BACK,
            sets: ['swamped', 'nolunch'],
            reaction: 'You are not swamped. Humans call this a white lie, and tell them all day long.',
            score: { avian: 1 },
          },
          {
            label: 'Leave it on read',
            icon: '👀',
            target: [-0.4, 0.6],
            face: 0,
            arms: [['phone', 1.4], [null]],
            hold: { item: 'phone', at: 0, until: 1.4 },
            emote: { text: '🙈', from: 1.5 },
            sets: ['onread', 'nolunch'],
            reaction: 'Seen at 12:15. Jo can see that you have seen it. You put the phone face down and back away.',
          },
        ],
      },
      {
        when: 'nolunch',
        q: 'An hour to yourself. Where do you go?',
        choices: [
          { label: 'Sneak out to the arcade', icon: '🕹️', to: 'carpark', sets: 'toarcade', score: { cephalopod: 1, mantis: 1, reptilian: 1 } },
          { label: 'A quiet walk on the beach', icon: '🏖️', to: 'carpark', sets: 'tobeach', score: { mantis: 1, grey: 1 } },
        ],
      },
    ],
  },
  {
    id: 'carpark',
    theme: 'city',
    time: '12:20',
    title: 'Car Park',
    caption: "Out of the office for lunch. In the car park, a {stranger.person} is glaring at {stranger.their} car. It won't start.",
    captionIf: {
      toarcade: "Sneaking out to the arcade. In the car park, a {stranger.person} is glaring at {stranger.their} car. It won't start.",
      tobeach: "Out for a walk on the beach. In the car park, a {stranger.person} is glaring at {stranger.their} car. It won't start.",
    },
    props: [
      { id: 'car', model: 'city/car-red', at: [1.8, -1.3], rotY: -0.3, scale: 1.6 },
      { model: 'city/car-orange', at: [-2.5, -1.4], rotY: 0.2, scale: 1.6 },
    ],
    npcs: [{ id: 'stranger', cast: 'stranger', at: [-0.3, -0.2], rotY: 0.5, moodIf: { '!helped': 'fume' } }],
    asks: [
      {
        q: '{stranger.They} kicks a tyre, then looks up and down the street for help. What do you do?',
        choices: [
          {
            label: 'Keep walking. Not your planet, not your car',
            target: [3.6, 0.6],
            emote: { text: '🚶', from: 0.8 },
            npc: { id: 'stranger', react: 'fume', emote: '😤', at0: 0.6 },
            reaction: "'Thanks a lot,' {stranger.they} mutters. You do not look back.",
            score: { cephalopod: 1, reptilian: 1, avian: 1 },
          },
          {
            label: "Start it with alien tech while {stranger.they} isn't looking",
            target: 'car',
            arms: [['reach', 0.6], [null]],
            fx: [
              { type: 'glow', prop: 'car', color: '#7cf27c', at0: 0.6, y: 0.9, z: 0, power: 6 },
              { type: 'emit', prop: 'car', text: ['✨', '⚡'], every: 0.35, at0: 0.6, until: 1.6 },
              { type: 'shake', prop: 'car', at0: 1.6 },
              { type: 'emit', prop: 'car', text: '💨', every: 0.5, at0: 1.8 },
            ],
            npc: { id: 'stranger', react: 'look', at0: 0.4 },
            emote: { text: '🤫', from: 1.8 },
            sets: 'helped',
            reaction: 'A little green spark under the bonnet, and the engine roars. {stranger.They} turns round. You are just standing there, being normal.',
            score: { grey: 1, tallwhite: 1 },
          },
        ],
      },
      {
        when: 'helped',
        q: "'I don't know what you did, but thank you!' What do you say?",
        choices: [
          {
            label: "'No problem.' And on you go",
            target: 'npc:stranger',
            arms: 'wave',
            npc: { id: 'stranger', react: 'laugh', emote: '👋', at0: 0.8 },
            reaction: '{stranger.They} waves you off. Another human, helped. You are getting good at this.',
            score: { cephalopod: 1 },
          },
          {
            label: 'Invite {stranger.them} to dinner',
            target: 'npc:stranger',
            arms: 'talk',
            npc: { id: 'stranger', react: 'laugh', emote: '😊', at0: 1.0, emoteAt: 1.8 },
            emote: { text: '💘', from: 1.8 },
            sets: 'date',
            reaction: "'Dinner? Go on, then. Seafood?' {stranger.They} taps {stranger.their} number into your phone.",
          },
        ],
      },
    ],
    nextIf: { toarcade: 'arcade', tobeach: 'beach' },
    next: 'diner',
  },
  {
    id: 'boss',
    theme: 'office',
    time: '15:00',
    timeIf: { longlunch: '15:40' },
    title: 'Back at Work',
    caption: "Three o'clock, after an afternoon of looking busy. The boss comes over: 'The Henderson report. How is it going?'",
    captionIf: {
      'report && longlunch': "Twenty to four, back from a very long lunch. The report has been in since before lunch, but the boss is at your desk, arms crossed: 'Long lunch?'",
      longlunch: 'Twenty to four, back from a very long lunch. The report was due at three. The boss is at your desk, arms crossed.',
      report: "Three o'clock, after a quiet afternoon. The boss has read the Henderson report, in before lunch, and comes over smiling.",
    },
    doors: [{ to: 'lobby', wall: -1, at: -1.5 }],
    props: DESK,
    npcs: [COWORKER, { id: 'boss', cast: 'boss', at: [0.6, -0.4], rotY: -0.5, moodIf: { longlunch: 'fume' } }],
    ambient: [{ type: 'emit', when: 'longlunch', at: [0.6, -0.4], height: 2.5, text: ['💢', '😤'], every: 1.1, keep: true }],
    asks: [
      {
        when: '!report',
        q: 'What do you tell the boss?',
        choices: [
          {
            label: 'Talk your way out of it',
            target: 'npc:boss',
            arms: 'talk',
            menu: {
              prompt: "The report isn't finished. How do you play it?",
              options: [
                {
                  label: 'Apologise. Mean it.',
                  icon: '🙏',
                  odds: 0.5,
                  score: { tallwhite: 2 },
                  win: { reaction: "The boss breathes out. 'Fine. Just get it done.'", emote: '😌', npc: { react: 'lean', emote: '😮‍💨' }, sets: 'calm', hush: true },
                  lose: { reaction: "'Sorry doesn't write reports.' The boss walks off, unimpressed.", emote: '😬', npc: { react: 'look', emote: '🙄', leave: BOSS_OUT } },
                },
                {
                  label: 'Blame the printer',
                  icon: '🖨️',
                  odds: 0.5,
                  score: { avian: 2 },
                  win: { reaction: 'The boss hates that printer too. You bond over it.', emote: '🤝', npc: { react: 'laugh', emote: '😂' }, sets: 'calm', hush: true },
                  lose: { reaction: "'We don't HAVE a printer.' Oh.", emote: '😬', npc: { react: 'fume', emote: '🤨' } },
                },
                {
                  label: 'Promise it by five',
                  icon: '🤝',
                  emote: '🤝',
                  npc: { react: 'lean', emote: '🧐' },
                  hush: true,
                  sets: ['calm', 'done'],
                  reaction: "'By five.' The boss squints, then nods. You make it with a minute to spare.",
                  score: { reptilian: 2, avian: 1 },
                },
              ],
            },
            score: {},
          },
          {
            label: 'Finish the report in one hour',
            target: 'chair',
            body: 'sit',
            arms: 'type',
            fx: [{ type: 'emit', prop: 'screen', text: ['⌨️', '✅'], every: 0.25 }],
            npc: { id: 'boss', react: 'lean', emote: '🧐', walk: [-0.2, -1.4], at0: 1.2 },
            reaction: 'Done within the hour. The boss checks it twice and finds nothing to say.',
            sets: 'done',
            score: { grey: 2, tallwhite: 1 },
          },
          {
            label: 'Stare back without blinking',
            target: [-0.9, 0.6],
            face: 2.2,
            emote: { text: '👁️', from: 0.4, every: 1.4 },
            npc: { id: 'boss', react: 'shiver', emote: '😳', at0: 1.4, leave: BOSS_OUT },
            reaction: 'The boss blinks first, mutters something, and goes back to their office.',
            score: { mantis: 2, tallwhite: 1 },
          },
        ],
      },
      {
        when: 'report && !longlunch',
        q: "'In before lunch. Nobody here does that.' What now?",
        choices: [
          {
            label: 'Make the most of it',
            target: 'npc:boss',
            arms: 'talk',
            menu: {
              prompt: 'The boss is in a good mood. How do you use it?',
              options: [
                { label: 'Ask for Friday off', icon: '😎', emote: '😎', npc: { react: 'shiver', emote: '😮‍💨' }, reaction: "'...Fine. You've earned it.' Nobody here has ever had a Friday off.", score: { reptilian: 2 } },
                { label: 'Share the credit with the team', icon: '🤝', emote: '🤝', npc: { react: 'laugh', emote: '👏' }, reaction: 'You name everyone who walked past your desk. The whole floor likes you now.', score: { tallwhite: 2 } },
                { label: 'Tell the boss how you did it', icon: '🗣️', emote: '🗣️', npc: { react: 'doze', emote: '😴', at0: 1.5 }, reaction: 'Twenty minutes, every step. The boss stops nodding at minute twelve.', score: { avian: 2 } },
              ],
            },
            score: {},
          },
          {
            label: "Start on next month's report",
            target: 'chair',
            body: 'sit',
            arms: 'type',
            fx: [{ type: 'emit', prop: 'screen', text: ['📄', '⌨️'], every: 0.3 }],
            npc: { id: 'boss', react: 'shiver', emote: '😰', at0: 1.2, leave: BOSS_OUT },
            reaction: 'The boss backs away slowly. Your coworkers are frightened again.',
            score: { grey: 2, tallwhite: 1 },
          },
          {
            label: 'Stare back without blinking',
            target: [-0.9, 0.6],
            face: 2.2,
            emote: { text: '👁️', from: 0.4, every: 1.4 },
            npc: { id: 'boss', react: 'shiver', emote: '😳', at0: 1.0, leave: BOSS_OUT },
            reaction: "The boss's smile wobbles, then goes. They back off to their office.",
            score: { mantis: 2, tallwhite: 1 },
          },
        ],
      },
      {
        when: 'report && longlunch',
        q: 'What do you tell the boss?',
        choices: [
          {
            label: 'Talk your way out of it',
            target: 'npc:boss',
            arms: 'talk',
            menu: {
              prompt: "The report is done. You just weren't here. How do you play it?",
              options: [
                { label: 'Point at the finished report', icon: '📄', emote: '📄', npc: { react: 'lean', emote: '🤔' }, hush: true, sets: 'calm', reaction: 'The boss reads it again, and runs out of things to be angry about.', score: { reptilian: 2 } },
                { label: 'Apologise. Mean it.', icon: '🙏', emote: '😌', npc: { react: 'lean', emote: '😮‍💨' }, hush: true, sets: 'calm', reaction: "'Just tell someone next time.' The boss uncrosses their arms.", score: { tallwhite: 2 } },
                {
                  label: 'Say lunch ran long',
                  icon: '🗣️',
                  odds: 0.5,
                  score: { avian: 2 },
                  win: { reaction: "'Mine did too, once.' The boss almost smiles.", emote: '🤝', npc: { react: 'laugh', emote: '🙂' }, sets: 'calm', hush: true },
                  lose: { reaction: "'That long?' The boss walks off.", emote: '😬', npc: { react: 'look', emote: '😑', leave: BOSS_OUT } },
                },
              ],
            },
            score: {},
          },
          {
            label: "Start on next month's report",
            target: 'chair',
            body: 'sit',
            arms: 'type',
            fx: [{ type: 'emit', prop: 'screen', text: ['📄', '⌨️'], every: 0.3 }],
            npc: { id: 'boss', react: 'look', emote: '😑', at0: 1.6, leave: BOSS_OUT },
            reaction: 'The boss watches you type for a while, then gives up and leaves.',
            score: { grey: 2, tallwhite: 1 },
          },
          {
            label: 'Stare back without blinking',
            target: [-0.9, 0.6],
            face: 2.2,
            emote: { text: '👁️', from: 0.4, every: 1.4 },
            npc: { id: 'boss', react: 'shiver', emote: '😳', at0: 1.4, leave: BOSS_OUT },
            reaction: 'The boss blinks first, mutters something, and goes back to their office.',
            score: { mantis: 2, tallwhite: 1 },
          },
        ],
      },
      {
        think: true,
        time: '17:00',
        q: "Five o'clock, home time. Hold on: how does a human do a party?",
        choices: [
          {
            label: 'Practise small talk on the water cooler',
            icon: '💬',
            target: 'cooler',
            arms: 'talk',
            emote: { text: '💬', from: 0.6, every: 1.2 },
            reaction: "'Lovely weather.' The water cooler gurgles back. You are ready.",
            score: { tallwhite: 2, avian: 1 },
          },
          {
            label: 'Look up human dance moves',
            icon: '🕺',
            target: 'chair',
            body: 'sit',
            arms: 'type',
            fx: [{ type: 'emit', prop: 'screen', text: ['🔎', '🕺'], every: 0.4 }],
            reaction: 'Twelve videos. Your knees will never be the same.',
            score: { reptilian: 2, cephalopod: 1 },
          },
          {
            label: 'Nap first. Parties go on all night.',
            icon: '😴',
            target: 'chair',
            body: 'sit',
            bodyMotion: 'doze',
            emote: { text: '💤', from: 1, every: 1.4 },
            reaction: 'You wake at seven with the keyboard printed on your cheek. Perfect timing.',
            score: { grey: 2, mantis: 1 },
          },
        ],
      },
    ],
    nextIf: { date: 'seafood' },
    next: { fork: ['party', 'couch'] },
  },
  {
    id: 'beach',
    theme: 'beach',
    time: '12:40',
    title: 'The Beach',
    caption: 'The beach, on your lunch break. Twenty minutes, you tell yourself. Up the shore, Mr Pell from next door is collecting shells.',
    captionIf: {
      hidpell: 'The beach, on your lunch break. Up the shore, Mr Pell from next door is collecting shells, and squints at you as if he once saw you behind a hedge.',
      snubpell: 'The beach, on your lunch break. Up the shore, Mr Pell from next door is collecting shells. You ignored him this morning. He waves anyway.',
      metpell: 'The beach, on your lunch break. Up the shore, Mr Pell from next door is collecting shells, and his favourite listener has just walked onto the sand.',
    },
    props: [
      { id: 'towel', model: 'home/rug-round', at: [-2.4, 0.4], scale: 0.5 },
      { id: 'umbrella', build: 'umbrella', at: [-3.3, -0.6] },
      { id: 'picnic', model: 'city/picnic-table', at: [0.4, -2.6] },
      { model: 'diner/ice-cream', at: [0.1, -2.6], y: 1.31 },
      { id: 'bench', model: 'city/bench', at: [1.6, 1.6], rotY: -0.3 },
      { id: 'shell', item: 'shell', at: [-0.9, 1.5], height: 0.25 },
    ],
    npcs: [{ id: 'pell', name: 'Mr Pell', look: PELL, at: [4.0, -1.2], rotY: -1.2, arrive: [[5.2, -13.0], [5.0, -4.4]], leave: [[5.0, 1.2], [5.4, 6.0]] }],
    extras: [
      {
        label: 'Build a sandcastle',
        target: [3.0, 1.3],
        body: 'crouch',
        arms: 'stroke',
        fx: [{ type: 'spawn', build: 'sandcastle', at: [3.0, 2.2], at0: 0.6, grow: 2.4, keep: true }],
        emote: { text: '🏰', from: 2.8 },
        reaction: 'Three towers, a moat, and a saucer on top. It looks a lot like home.',
        sayAt: 2.6,
      },
      {
        label: 'Pick up a pretty shell',
        when: '!shell',
        target: 'shell',
        body: 'crouch',
        arms: [['reach', 1.0]],
        fx: [{ type: 'take', prop: 'shell', at0: 0.9 }],
        hold: { item: 'shell', at: 1.0 },
        time: 2.8,
        sets: 'shell',
        reaction: 'Pink, and perfectly round. Humans give each other things like this. You keep it for Jo.',
      },
    ],
    asks: [
      {
        q: 'Mr Pell has seen you, and wants to show you his shells. What do you do?',
        choices: [
          {
            label: 'Admire every one of his shells',
            target: 'npc:pell',
            arms: 'talk',
            hold: { item: 'shell', at: 2.6 },
            npc: { id: 'pell', react: 'laugh', emote: '🐚', at0: 0.8, emoteAt: 1.4 },
            reaction: 'Every shell has a story, and Mr Pell tells you all of them. He gives you the best one, to keep.',
            sets: 'shell',
            score: { avian: 2, tallwhite: 1 },
          },
          {
            label: 'Hide under the umbrella',
            target: [-2.75, -0.9],
            until: 'pell',
            body: 'hide',
            emote: '🫣',
            reaction: 'Mr Pell looks all round, shrugs, and goes back to his shells. You stay under the umbrella a while longer, to be safe.',
            score: { cephalopod: 2, grey: 1 },
          },
          {
            label: 'Race him to find the best shell',
            target: [4.4, -2.6],
            body: 'crouch',
            arms: 'stroke',
            hold: { item: 'shell', at: 2.4 },
            emote: { text: '🐚', from: 1.2, every: 0.7 },
            npc: { id: 'pell', react: 'shiver', emote: '😤', at0: 2.4 },
            reaction: 'Eleven shells to his three, and a crab. Mr Pell has never been so impressed, or so annoyed.',
            sayAt: 2.4,
            sets: 'shell',
            score: { reptilian: 2, mantis: 1 },
          },
        ],
      },
      {
        think: true,
        q: 'Ten minutes of beach left. How do you spend them?',
        choices: [
          {
            label: 'Dip a toe in the sea',
            target: [5.2, -1.0],
            face: Math.PI / 2,
            bodyMotion: [[null, 0.8], ['shiver']],
            fx: [{ type: 'splash', at: [6.4, -1.0], at0: 0.6 }],
            emote: { text: '🥶', from: 0.9 },
            reaction: 'Colder than space. You shriek, and the whole beach turns round.',
            score: { avian: 3, reptilian: 1 },
          },
          {
            label: 'Sunbathe on the towel. Sunscreen first.',
            target: 'towel',
            body: 'floor',
            emote: { text: '🧴', from: 0.6 },
            reaction: 'Factor fifty, applied evenly, every twenty minutes, all afternoon. Not one freckle.',
            sets: 'longlunch',
            score: { tallwhite: 3, cephalopod: 1 },
          },
          {
            label: 'Nap on the bench',
            target: 'bench',
            body: 'sit',
            sleep: true,
            emote: { text: '💤', from: 0.6 },
            bodyMotion: 'flop',
            reaction: 'You wake up hours later, striped like the bench.',
            sets: 'longlunch',
            score: { cephalopod: 3, grey: 1 },
          },
        ],
      },
    ],
    next: 'boss',
  },
  {
    id: 'arcade',
    theme: 'arcade',
    time: '12:30',
    title: 'Arcade',
    caption: 'Out of the office without a word. A kid who should be at school holds the high score on every machine.',
    props: [
      { id: 'game', model: 'diner/arcade-machine', at: [-2.4, -2.7], rotY: Math.PI / 2 },
      { id: 'kidgame', model: 'diner/arcade-machine', at: [0.4, -4.0] },
      { id: 'vending', model: 'office/vending-machine', at: [2.6, -2.9] },
      { id: 'beanbag', model: 'office/bean-bag', at: [2.7, 0.7] },
    ],
    npcs: [{ id: 'kid', look: presetAvatar('citizen-1'), height: 1.35, at: [0.4, -3.2], rotY: Math.PI }],
    ambient: [{ type: 'glow', prop: 'kidgame', color: '#4fd8ff', flicker: true, y: 1.7, z: 0.8 }],
    extras: [
      {
        label: 'Feed the vending machine',
        target: 'vending',
        arms: 'reach',
        emote: { text: '🪙', from: 0.9 },
        reaction: 'The machine takes your coin and keeps it. You respect that.',
      },
    ],
    asks: [
      {
        think: true,
        q: 'A whole arcade, and an hour for lunch. What do you do?',
        choices: [
          {
            label: "Beat the kid's high score",
            target: 'game',
            arms: 'game',
            fx: [
              { type: 'glow', prop: 'game', color: '#ff4fd8', flicker: true, y: 1.7, z: 0.8 },
              { type: 'banner', prop: 'game', text: 'NEW HIGH SCORE', at0: 2.6 },
            ],
            npc: { id: 'kid', react: 'shiver', emote: '😭', at0: 3.1 },
            reaction: 'NEW HIGH SCORE: ZRX. It took all afternoon. The kid is inconsolable.',
            sayAt: 3.1,
            sets: ['longlunch', 'beatkid'],
            score: { reptilian: 2, avian: 1 },
          },
          {
            label: 'Become one with the bean bag',
            target: 'beanbag',
            body: 'sit',
            bodyMotion: 'flop',
            emote: '😌',
            reaction: 'You and the bean bag are now one organism.',
            score: { mantis: 2, cephalopod: 1 },
          },
          {
            label: 'Cheer the kid on',
            target: 'npc:kid',
            body: 'cheer',
            arms: 'cheer',
            npc: { id: 'kid', react: 'cheer', emote: '🎉', at0: 1.4 },
            fx: [{ type: 'banner', prop: 'kidgame', text: 'WINNER!', at0: 1.2 }],
            reaction: 'The kid wins. You were on their side all along.',
            sayAt: 1.4,
            score: { avian: 3, tallwhite: 1 },
          },
        ],
      },
      {
        when: 'beatkid',
        q: 'The kid is still crying, and the whole arcade is looking at you. What now?',
        choices: [
          {
            label: 'Buy the kid a soda',
            target: 'vending',
            arms: [['reach', 1.2], ['present']],
            hold: { item: 'soda', at: 1.2 },
            npc: { id: 'kid', react: 'cheer', emote: '😊', at0: 2.4 },
            reaction: 'One fizzy drink later, the tears stop. You are best friends now.',
            sayAt: 2.4,
            score: { tallwhite: 2, avian: 1 },
          },
          {
            label: 'Show the kid how you did it',
            target: 'npc:kid',
            arms: 'talk',
            fx: [{ type: 'banner', prop: 'kidgame', text: 'NEW HIGH SCORE: KID', at0: 2.4 }],
            npc: { id: 'kid', react: 'cheer', emote: '🤩', at0: 2.6 },
            reaction: 'Ten minutes of alien technique, and the kid takes the high score back. Everybody wins.',
            sayAt: 2.6,
            score: { cephalopod: 2, avian: 1 },
          },
          {
            label: 'Victory lap. You earned it.',
            target: [0.6, 0.8],
            body: 'cheer',
            arms: 'cheer',
            npc: { id: 'kid', react: 'shiver', emote: '😭', at0: 0.6 },
            reaction: 'Round the arcade with both arms up. The kid will remember this day forever.',
            score: { reptilian: 2, mantis: 1 },
          },
        ],
      },
    ],
    next: 'boss',
  },
  {
    id: 'diner',
    theme: 'diner',
    time: '12:30',
    title: 'Lunch with Jo',
    caption: "Jo asks what you did at the weekend. You panic and say 'rocks'.",
    props: [
      { id: 'table', model: 'diner/table-round', at: [-0.6, -1.5] },
      { id: 'chair', model: 'diner/chair', ...YOU_DINER },
      { id: 'fries', model: 'diner/fries', at: [-0.1, -1.5], y: 1.15 },
      { id: 'stool', model: 'diner/bar-stool', at: [3.2, -3.0] },
      { id: 'jochair', model: 'diner/chair', ...JO_DINER },
    ],
    npcs: [
      { id: 'jo', name: true, cast: 'jo', ...JO_DINER, sit: 'jochair' },
      { id: 'waiter', look: presetAvatar('food-worker'), at: [3.3, -0.7], rotY: -0.7, patrol: [[3.3, -0.7], [1.8, 0.9], [4.3, -2.3]] },
    ],
    extras: [
      {
        label: 'Spin on the bar stool',
        target: 'stool',
        body: 'sit',
        bodyMotion: 'spin',
        reaction: 'Three full turns. Jo pretends not to know you.',
      },
    ],
    asks: [
      {
        q: 'Jo is waiting to hear about the rocks. What now?',
        choices: [
          {
            label: 'Explain rocks for forty minutes',
            target: 'chair',
            body: 'sit',
            arms: 'talk',
            npc: { id: 'jo', react: 'doze', emote: '😴', at0: 1.2 },
            emote: '🪨',
            reaction: 'Forty minutes on granite. Jo is either asleep or hooked.',
            score: { grey: 3, cephalopod: 1 },
          },
          {
            label: 'Order from the waiter',
            target: 'chair',
            body: 'sit',
            arms: 'wave',
            npc: { id: 'waiter', walk: [1.7, -2.9], emote: '📝', at0: 0.4, emoteAt: 1.6 },
            reaction: 'You wave the waiter over like you have done this before.',
            menu: { prompt: 'The waiter is ready. What will it be?', at: 2.4, options: LUNCH, serve: { npc: 'waiter', pickup: [3.9, -3.4] }, wait: 'Coming right up.' },
          },
          {
            label: "Steal Jo's fries",
            target: [-0.1, -0.5],
            face: Math.PI,
            arms: [['reach', 1.0], ['eat']],
            fx: [{ type: 'take', prop: 'fries', at0: 0.9 }],
            hold: { item: 'fries', at: 1.0 },
            npc: { id: 'jo', react: 'shiver', emote: '😠', at0: 1.2 },
            reaction: 'Fastest hands in the diner. Possibly in the galaxy.',
            score: { reptilian: 3, avian: 1 },
          },
        ],
      },
    ],
    next: 'boss',
  },
  {
    id: 'park',
    theme: 'nature',
    time: '08:45',
    title: 'Morning Walk',
    caption: 'The long way to work, through the park. Someone\'s dog is off its lead, and the trail goes all the way round, past the duck pond.',
    captionIf: {
      'late && !rushed': "Too cheap for a ride, so it's the walk through the park. Someone's dog is off its lead, and the trail goes all the way round, past the duck pond.",
    },
    props: [
      { id: 'rock', model: 'nature/rock-1', at: [-1.7, -1.1] },
      { id: 'bench', model: 'city/bench', at: [1.0, -2.6] },
      { id: 'flowers', model: 'nature/flowers-a', at: [0.6, 1.6] },
      { id: 'duck1', cutes: 'rubber-duck', height: 0.45, at: [-12.4, -20.2], y: 0.05, rotY: 0.6 },
      { id: 'duck2', cutes: 'rubber-duck', height: 0.4, at: [-14.8, -19.6], y: 0.05, rotY: -2.2 },
      { id: 'dog', animal: 'dog', height: 1.2, size: [0.7, 1.2], at: [2.7, 1.0], rotY: -0.7 },
    ],
    asks: [
      {
        think: true,
        q: 'A whole park, and nobody watching. What does a human do here?',
        choices: [
          {
            label: 'Go for a jog round the trail',
            body: 'jog',
            emote: '💨',
            reaction: 'Off round the trail at a good clip. Humans call this fun.',
            score: { reptilian: 3, avian: 1 },
            menu: {
              stop: 'duck1',
              prompt: 'Halfway round, by the pond, and the ducks have seen you. Stop and feed them?',
              options: [
                {
                  label: 'Stop and feed the ducks',
                  icon: '🦆',
                  item: 'bread',
                  arms: 'throw',
                  fx: [
                    { type: 'come', prop: 'duck1', dist: 2.1 },
                    { type: 'come', prop: 'duck2', dist: 2.3 },
                  ],
                  emote: '🦆',
                  reaction: 'The ducks accept. Diplomatic relations established.',
                  score: { mantis: 3, tallwhite: 1 },
                },
                {
                  label: 'Keep jogging',
                  icon: '💨',
                  emote: '💨',
                  time: 1.6,
                  reaction: 'Not today, ducks. They take it personally.',
                  score: { reptilian: 2, grey: 1 },
                },
              ],
            },
          },
          {
            label: 'Sit on the bench and watch the world go by',
            target: 'bench',
            body: 'sit',
            emote: { text: '👀', from: 0.8, every: 1.4 },
            reaction: 'Ten quiet minutes on a bench. Humans call this relaxing. You take notes.',
            score: { cephalopod: 3, grey: 1 },
          },
          {
            label: 'Smell the flowers. All of them.',
            target: 'flowers',
            body: 'crouch',
            emote: { text: ['🌸', '👃'], from: 0.6, every: 0.9 },
            reaction: 'Lovely, every one. One of them may have smelled you back.',
            score: { mantis: 2, avian: 1 },
          },
        ],
      },
    ],
    extras: [
      {
        label: 'Pet the dog',
        target: 'dog',
        body: 'crouch',
        arms: 'stroke',
        fx: [{ type: 'anim', prop: 'dog', clip: 'Jump_Loop', at0: 0.8, dur: 2.4 }],
        emote: { text: ['❤️', '🐶', '💕'], from: 1, every: 0.6 },
        reaction: 'The dog adores you. You are the best thing that has happened to it all morning.',
      },
    ],
    next: 'office',
    nextIf: { '!badge': 'lobby' },
  },
  {
    id: 'seafood',
    theme: 'seafood',
    time: '19:45',
    title: 'Dinner with {stranger}',
    sets: 'dinner',
    caption: 'Dinner with {stranger} before the party, at the seafood place. {stranger.Their} car started, so {stranger.they} drove. Candles, and fish tanks all the way round.',
    props: [
      { id: 'table', build: 'dinnertable', at: [0.2, -0.9], size: [1.6, 1.3], height: 1.15 },
      { id: 'chair', model: 'diner/chair-cushion', ...YOU_SEAFOOD },
      { id: 'datechair', model: 'diner/chair-cushion', ...DATE_SEAFOOD },
      { id: 'tank', build: 'aquarium', fixed: true, at: [-4.15, -4.1], size: [1.1, 0.6], height: 2.03 },
      { id: 'aqua0', build: 'aquarium', fixed: true, at: [-2.8, -4.1], size: [1.6, 0.6], height: 2.03 },
      { id: 'aqua1', build: 'aquarium', fixed: true, at: [-1.2, -4.1], size: [1.6, 0.6], height: 2.03 },
      { id: 'aqua2', build: 'aquarium', fixed: true, at: [1.2, -4.1], size: [3.2, 0.6], height: 2.03 },
      { id: 'aqua3', build: 'aquarium', fixed: true, at: [-5.0, -2.65], rotY: Math.PI / 2, size: [3.5, 0.6], height: 2.03 },
      { id: 'octopus', item: 'octopus', at: [-4.45, -3.95], y: 0.62, height: 0.3, rotY: 0.4 },
      { model: 'diner/fish', at: [-0.38, -0.8], y: 1.15, rotY: 1.15, scale: 1.6 },
      { model: 'diner/fries', at: [-0.36, -1.24], y: 1.15, rotY: 1.15, scale: 0.8 },
    ],
    npcs: [
      { id: 'plusone', name: true, cast: 'stranger', ...DATE_SEAFOOD, sit: 'datechair', mood: 'dine' },
      { id: 'waitress', look: WAITRESS, at: [4.4, -3.0], rotY: -0.7, patrol: [[4.4, -3.0], [4.2, 0.6]] },
    ],
    ambient: [{ type: 'glow', prop: 'table', color: '#ffb347', flicker: true, x: -0.2, y: 1.45, z: 0.5, power: 1.8 }],
    enter: {
      target: 'chair',
      body: 'sit',
      arms: 'wave',
      npc: { id: 'waitress', walk: WAITRESS_AT_TABLE, emote: '📝', at0: 0.8, emoteAt: 1.8 },
      menu: {
        by: 'waitress',
        prompt: "Good evening! Tonight's special is #42, the octopus in that tank. Very fresh. What will it be?",
        at: 3.2,
        options: SEAFOOD,
        serve: { npc: 'waitress', pickup: HATCH },
        wait: 'Coming right up.',
      },
    },
    extras: [
      {
        label: 'Ask {stranger} about the car',
        target: 'chair',
        body: 'sit',
        arms: [['talk', 1.4], [null]],
        npc: { id: 'plusone', react: 'talk', for: 2.8, at0: 1.4 },
        reaction: "Purring like new, says {stranger}. The garage can't work out what you did to it. You change the subject.",
        sayAt: 1.6,
      },
      {
        label: 'Tell {stranger} a joke from back home',
        target: 'chair',
        body: 'sit',
        arms: [['talk', 1.6], [null]],
        npc: { id: 'plusone', react: 'laugh', for: 2.2, emote: '😂', at0: 1.6 },
        reaction: 'It is about a comet and three moons. {stranger} laughs at the wrong bit, then the right one, then cannot stop.',
        sayAt: 1.8,
      },
    ],
    asks: [
      {
        when: '!ate42',
        look: 'octopus',
        q: '#42 is still in its tank, looking right at you. What do you do?',
        choices: [
          {
            label: 'Save #42 and leave',
            target: 'tank',
            arms: [['reach', 0.8], [null]],
            hold: { item: 'octopus', at: 0.8, until: 1.8 },
            fx: [{ type: 'take', prop: 'octopus', at0: 0.8 }],
            emote: { text: '🤫', from: 1.2 },
            npc: { id: 'plusone', react: 'shiver', emote: '😳', at0: 1.4 },
            sets: 'octopus',
            reaction: 'Under your shirt, and out of the door before anyone can ask. Your shirt is now holding on with all eight.',
            to: { fork: ['party', 'couch'] },
            score: { cephalopod: 3, mantis: 1 },
          },
          {
            label: 'Not your problem. Finish your dinner.',
            target: 'chair',
            body: 'sit',
            emote: { text: '🤷', from: 0.4 },
            reaction: 'You clean your plate. #42 watches every bite.',
            score: { grey: 1, tallwhite: 1 },
          },
        ],
      },
    ],
    next: { fork: ['party', 'couch'] },
  },
  {
    id: 'party',
    theme: 'party',
    time: '21:00',
    title: "Jo's Party",
    caption: "Jo's party, in full swing.",
    captionIf: {
      octopus: "Jo's party. Something under your shirt is moving to the music.",
      dinner: "Jo's party. You walk in with {stranger} from dinner, and it has started without you.",
      onread: "Jo's party. Jo spots you from across the room: 'You left me on READ!' Then hugs you anyway.",
      swamped: "Jo's party. 'Not so swamped now, huh?' Jo grins, and pulls you in.",
      'done || report': "Jo's party. The report is in and the boss is off your back. Party mode.",
      calm: "Jo's party. The report can wait; the boss is off your back for today. Party mode.",
    },
    props: [
      { id: 'sofa', model: 'home/sofa-red', at: [-2.8, -2.8] },
      { model: 'home/side-table', at: [2.9, -3.4] },
      { id: 'radio', model: 'home/radio', at: [2.9, -3.4], y: 1.18 },
      { id: 'table', model: 'diner/table-round', at: [2.9, 0.7] },
      { id: 'cake', model: 'diner/cake', at: [2.9, 0.7], y: 1.15 },
    ],
    npcs: [
      { id: 'guest1', look: presetAvatar('citizen-1'), at: [-0.6, -2.5], rotY: 0.3, mood: 'dance' },
      { id: 'jo', name: true, cast: 'jo', at: [0.75, -2.4], rotY: -0.4, mood: 'dance' },
      { id: 'date', name: true, cast: 'stranger', when: 'date && !octopus', at: [2.45, -1.75], rotY: -0.8, mood: 'dance' },
    ],
    ambient: [{ type: 'emit', prop: 'radio', text: '🎵', every: 0.8 }],
    extras: [
      {
        label: 'Turn up the radio',
        target: 'radio',
        arms: 'reach',
        fx: [{ type: 'emit', prop: 'radio', text: ['🎵', '🎶'], every: 0.5, at0: 0.9 }],
        reaction: 'Louder. Everyone cheers, and nobody knows it was you.',
      },
      {
        label: 'Give Jo the shell from the beach',
        when: 'shell',
        target: 'npc:jo',
        arms: 'present',
        hold: { item: 'shell', at: 0.3, until: 2.2 },
        npc: { id: 'jo', react: 'cheer', emote: '🐚', at0: 1.4 },
        reaction: "Jo holds it to {jo.their} ear. 'I can hear the sea!' You can't. You nod anyway.",
        sayAt: 1.4,
      },
    ],
    asks: [
      {
        q: "Someone shouts 'fun facts, everyone!' and the whole room turns to you. What now?",
        choices: [
          {
            label: 'Dodge it: hit the dance floor',
            target: [0.0, 0.4],
            face: 0,
            body: 'dance',
            arms: 'dance',
            fx: [{ type: 'confetti', at: [0.0, 0.4] }],
            npc: { id: 'guest1', react: 'cheer', emote: '🔥' },
            reaction: 'Three of your joints bend the wrong way. The crowd goes wild.',
            score: { avian: 2, tallwhite: 2 },
          },
          {
            label: 'Dodge it: eat the whole cake. Fast.',
            target: 'cake',
            arms: [['reach', 0.8], ['eat']],
            hold: { item: 'cake', at: 0.8 },
            emote: { text: '🎂', from: 1 },
            reaction: 'Someone asks where the cake went. You look around too, chewing.',
            score: { reptilian: 2, cephalopod: 2 },
          },
          {
            label: 'Share your fun fact. The true one.',
            target: 'npc:jo',
            arms: 'talk',
            npc: { id: 'jo', react: 'laugh', emote: '😂', at0: 1.2 },
            emote: '👽',
            reaction: "'I am not from around here.' Everyone laughs. Jo laughs hardest.",
            score: { mantis: 2, grey: 1 },
          },
        ],
      },
    ],
  },
  {
    id: 'couch',
    theme: 'living',
    time: '21:30',
    title: 'Night In',
    sets: 'sick',
    caption: 'Home. Just you, the sofa and the TV.',
    captionIf: {
      octopus: 'Home early from dinner, with #42. It is in your bath now, and seems happy.',
      cat: 'Home. The stray cat from the bus stop was waiting on the doorstep, and now has the good end of the sofa.',
      dinner: 'Home after dinner with {stranger}. Jo is sick, so the party is off. You check your phone twice, in case {stranger} texts.',
      'done || report': 'Home. The report is in; the sofa has been earned.',
      calm: 'Home. The report can wait till tomorrow; the sofa has been earned.',
    },
    props: [
      { model: 'home/rug-round', at: [0.2, -1.7], rotY: 1.57 },
      { id: 'sofa', model: 'home/sofa-blue', at: [-2.5, -1.7], rotY: 1.0 },
      { id: 'table', model: 'home/coffee-table', at: [0.2, -1.7], rotY: 1.57 },
      { id: 'pizza', model: 'diner/pizza', at: [0.2, -1.7], y: 0.71 },
      { model: 'home/tv-cabinet', at: [3.0, -1.7], rotY: -1.0 },
      { id: 'tv', model: 'home/television', at: [3.0, -1.7], y: 0.96, rotY: -1.0 },
      { id: 'lamp', model: 'home/lamp-floor', at: [-2.6, -3.8] },
      { id: 'cat', animal: 'cat', when: 'cat', height: 1.25, size: [0.7, 1.1], at: [-3.4, 0.4], rotY: 0.8 },
    ],
    ambient: [{ type: 'glow', prop: 'tv', color: '#7fb8ff', flicker: true, y: 1.6, x: -0.6 }],
    extras: [
      {
        label: 'Have a slice of pizza',
        target: 'pizza',
        arms: [['reach', 0.9], ['eat']],
        reaction: 'Cold pizza. The humans got one thing very right.',
      },
      {
        label: 'Stroke the cat',
        when: 'cat',
        target: 'cat',
        body: 'crouch',
        arms: 'stroke',
        fx: [{ type: 'anim', prop: 'cat', clip: 'Headbutt', at0: 0.9, dur: 2.2 }],
        emote: { text: '❤️', from: 1 },
        reaction: 'The cat headbutts your hand, then turns its back on you. It lives here now.',
      },
      {
        label: 'Listen to the shell from the beach',
        when: 'shell',
        target: [-0.6, 0.6],
        face: 0,
        arms: 'sip',
        hold: { item: 'shell', at: 0.2 },
        emote: { text: '🌊', from: 1.2 },
        reaction: "The sea, or your own blood rushing. The humans aren't sure either.",
      },
    ],
    asks: [
      {
        q: "Jo's party is off. A whole evening to yourself. What do you do?",
        phone: JO,
        choices: [
          {
            label: 'Call Jo to check on {jo.them}',
            target: [0.2, 0.2],
            face: 0,
            arms: 'phone',
            hold: { item: 'phone', at: 0 },
            phone: { from: 'Jo', call: true },
            emote: { text: '📞', from: 1.2 },
            reaction: 'Twenty minutes. Jo sounds better already, and is saving you some cake.',
            score: { tallwhite: 3, avian: 1 },
          },
          {
            label: 'Binge-watch the whole season',
            target: [1.0, -0.3],
            face: 1.1,
            body: 'floor',
            emote: '📺',
            reaction: 'Episode nine. Nobody on TV suspects anything either.',
            score: { grey: 3, tallwhite: 1 },
          },
          {
            label: 'Lights out. Early night.',
            target: 'sofa',
            body: 'lie',
            fx: [{ type: 'dark', at0: 1.0 }],
            sleep: true,
            emote: { text: '💤', from: 1.4 },
            reaction: 'Lights out, and the sofa will do. Big day tomorrow. Neck release scheduled for 22:00.',
            score: { mantis: 2, avian: 1 },
          },
        ],
      },
    ],
  },
]
