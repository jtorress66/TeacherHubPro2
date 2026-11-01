import type { ContentKind, GameContent } from '@thp/domain';

/** Valid sample content for each kind, used by the game-mode contract and fixtures. */
export const sampleGameContent: { readonly [K in ContentKind]: Extract<GameContent, { kind: K }> } =
  {
    questions: {
      kind: 'questions',
      items: [
        {
          prompt: 'Which is the largest planet?',
          options: ['Mars', 'Jupiter', 'Venus'],
          answer: 1,
        },
        { prompt: 'Which planet is closest to the Sun?', options: ['Mercury', 'Earth'], answer: 0 },
        { prompt: 'Which is the red planet?', options: ['Saturn', 'Mars', 'Neptune'], answer: 1 },
        { prompt: 'Which planet has rings?', options: ['Saturn', 'Mercury', 'Venus'], answer: 0 },
      ],
    },
    statements: {
      kind: 'statements',
      items: [
        { statement: 'The Sun is a star', isTrue: true },
        { statement: 'The Moon is a planet', isTrue: false },
        { statement: 'Mars is called the red planet', isTrue: true },
        { statement: 'Jupiter is the smallest planet', isTrue: false },
      ],
    },
    sentences: {
      kind: 'sentences',
      items: [
        { text: 'The Sun is a ___.', answer: 'star' },
        { text: '___ is the red planet.', answer: 'Mars' },
        { text: 'The ___ goes around the Earth.', answer: 'Moon' },
        { text: 'Saturn has beautiful ___.', answer: 'rings' },
      ],
    },
    pairs: {
      kind: 'pairs',
      items: [
        { term: 'Sun', definition: 'The star at the centre of our solar system' },
        { term: 'Moon', definition: 'The Earth’s natural satellite' },
        { term: 'Comet', definition: 'A ball of ice and dust with a tail' },
        { term: 'Orbit', definition: 'The curved path around a star or planet' },
        { term: 'Planet', definition: 'A large body that travels around a star' },
        { term: 'Galaxy', definition: 'A huge group of stars' },
      ],
    },
    steps: {
      kind: 'steps',
      items: [
        'Water evaporates',
        'Vapour condenses into clouds',
        'Rain falls',
        'Water collects in rivers',
      ],
    },
    groups: {
      kind: 'groups',
      items: [
        { name: 'Planets', members: ['Mars', 'Venus', 'Saturn'] },
        { name: 'Stars', members: ['Sun', 'Sirius', 'Vega'] },
      ],
    },
  };
