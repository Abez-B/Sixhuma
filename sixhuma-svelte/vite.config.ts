import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
	plugins: [sveltekit()],
	resolve: {
		alias: {
			'sixhuma-core': resolve(__dirname, '../sixhuma-core/src/index.ts'),
		},
	},
	server: {
		port: parseInt(process.env.PORT || '5173'),
		host: '0.0.0.0',
	},
});
