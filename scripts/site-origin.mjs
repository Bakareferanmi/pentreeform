import {readFileSync} from 'node:fs';
import {httpsOrigin} from './configure-deployment.mjs';
export function siteOrigin(){const config=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));return httpsOrigin(config.vars.APP_ORIGIN,'Public origin')}
