import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  compilerOptions: {
    runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
  },
  kit: {
    adapter: adapter(),
    alias: {
      '$core': '../core/lib',
      '$core/*': '../core/lib/*',
      '$pipelines': '../pipelines',
      '$pipelines/*': '../pipelines/*'
    }
  }
};

export default config;
