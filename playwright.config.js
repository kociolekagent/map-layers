import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./browser-tests', use:{baseURL:process.env.SITE_URL || 'http://127.0.0.1:4173', headless:true}, webServer:process.env.SITE_URL?undefined:{command:'npm run preview',url:'http://127.0.0.1:4173'}, workers:1});
