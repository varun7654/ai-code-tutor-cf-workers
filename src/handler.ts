import {Router} from 'itty-router';
import {handleAuth} from "./github-oauth-login";
import {handleProblemHelp} from "./problemhelp";

import type { Database } from '@cloudflare/d1';

const router = Router();

export const corsHeaders = (origin: string) => ({
    'Access-Control-Allow-Origin': origin.includes('localhost') || origin.includes("127.0.0.1") ? origin : 'https://wecode.dacubeking.com',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
});

export const isRefererLocalhost = (request: Request) => {
    const origin = request.headers.get('Referer') || '';
    return origin.includes('localhost') || origin.includes("127.0.0.1");
}

export const withCorsPreflight = (request: Request) => {
    if (request.method.toLowerCase() === 'options') {
        return new Response('ok', {
            headers: getHeaders(request),
        });
    }
};

export const getHeaders = (request: Request) => {
    const origin = request.headers.get('origin') || '';
    return corsHeaders(origin);
}


router
    .all('*', withCorsPreflight)
    .get("/auth*", handleAuth)
    .post("/auth*", handleAuth)
    .get("/ai-tutor*", handleProblemHelp)
    .post("/ai-tutor*", handleProblemHelp)
    .all("*", (request) => new Response("Not Found", { status: 404, headers: getHeaders(request)}));






export interface Env {
    //This will be auto-populated with the KV Namespace that is bound in the wrangler.toml
    //and exposes all the methods you'll need (get, put, list etc.)
    OPEN_AI_KEY: string;
    CLIENT_ID: string;
    CLIENT_SECRET: string;
    CLIENT_ID_DEV: string;
    CLIENT_SECRET_DEV: string
    DB: Database;
}

export default {
    async fetch(request: Request, env: Env) {
        try {
            let response = await router.handle(request, env);
            console.log(JSON.stringify(response));
            return response;
        } catch (e) {
            return new Response(
                JSON.stringify({
                    status: 500,
                    statusText: 'Internal Server Error 3',
                    error: e.toString(),
                    expire_logins: false,
                }),
                {status: 500, headers: getHeaders(request)}
            );
        }
    },
    async get(request: Request, env: Env) {
        try {
            let response = await router.handle(request, env);
            console.log(JSON.stringify(response));
            return response;
        } catch (e) {
            return new Response(
                JSON.stringify({
                    status: 500,
                    statusText: 'Internal Server Error 3',
                    error: JSON.stringify(e, Object.getOwnPropertyNames(e)),
                    expire_logins: false,
                }),
                {status: 500, headers: getHeaders(request)}
            );
        }
    },
};