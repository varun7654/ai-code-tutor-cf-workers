import { RequestLike, Router } from 'itty-router';
import handle from "./github-oauth-login";


const router = Router();

router
.get("/auth", handle)
.all("*", () => new Response("Not Found", { status: 404 }));






export interface Env {
    //This will be auto-populated with the KV Namespace that is bound in the wrangler.toml
    //and exposes all the methods you'll need (get, put, list etc.)
}

export default {
    async fetch(request: Request, env: Env) {
        return router.handle(request);
    },
    async get(request: Request, env: Env) {
        return router.handle(request);
    },
};