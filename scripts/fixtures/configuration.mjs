export function configurationFixture() {
  return {
    schemaVersion: 1,
    budget: 'large',
    roles: {
      'feature, refactoring': '@task',
      'bug-fix': '@task',
      'perf-issue': '@task',
      hillclimb: '@task',
      'judgment and prose': '@slow',
      'hardest tasks': '@slow',
      'how explorer': '@smol',
      'how explainer': '@slow',
      'why investigators': '@smol',
      'why synthesizer': '@slow',
      'reflect tooling': '@task',
      'reflect judgment, divergent, synthesizer': '@slow',
      'arena runners': ['@slow', '@task'],
      'arena cross-judge pool': ['@slow', '@task'],
      'swarm workers': '@task',
      'architect runners': ['@slow', '@task'],
      'interrogate reviewers': ['@slow', '@task'],
    },
  };
}
