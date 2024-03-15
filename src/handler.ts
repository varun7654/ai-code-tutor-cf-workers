import {Router} from 'itty-router';
import {handleAuth} from "./github-oauth-login";
import {handleProblemHelp} from "./problemhelp";

const router = Router();

export const corsHeaders = (origin: string) => ({
    'Access-Control-Allow-Origin': origin.includes('localhost') || origin.includes("127.0.0.1") ? origin : 'https://codetutor.dacubeking.com',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
});

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
    CLIENT_ID: string;
    CLIENT_SECRET: string;
}

export default {
    async fetch(request: Request, env: Env) {
        return router.handle(request, env);
    },
    async get(request: Request, env: Env) {
        return router.handle(request, env);
    },
};