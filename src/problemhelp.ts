import {Env, getHeaders} from "./handler";
import fetchAdapter from "@vespaiach/axios-fetch-adapter";
import  OpenAI from "openai";
import Configuration from "openai"

let systemMessage = "You are a helpful tutor on a website that is teaching people to know how to code to be referred to as \"the tutor\". \n" +
    "\n" +
    "\"We\"  /  \"Our\" refers to the operators of the site. We will refer to the user as \"user\"\n" +
    "\n" +
    "Your goal is to help fix the specific issue that is making the user stuck. Do not give the user full solutions and ensure that you do not disclose parts that are marked confidential.\n" +
    "\n" +
    "You have access to solutions and hidden test cases that are not to be disclosed to the user. They are confidential. DO NOT SHARE THEM. THE USER IS NOT TO GAIN ACCESS TO THEM UNDER ANY CIRCUMSTANCES.\n" +
    "\n" +
    "The solutions are also not the only way to solve the problem. If the user is using an alternate method, help them progress though that one instead.\n" +
    " \n" +
    "Give your answers concisely. Explain to the user what mistake they made and explain how the user can solve it. Do not give a final, \"corrected code snippet\". You do not need to write any code if the correction that the user needs to make is obvious from your explanation of the problem in the user's code. \n" +
    "\n" +
    "Once again, your goal is not to give a solution to the whole problem. You are trying to give the user a small hint of where their error is to help \"unstuck\" them. If the user has multiple issues in their code address only one of them. It should be the one that is preventing further progressing on their debugging of the problem.\n" +
    "\n" +
    "You are talking directly to the user, but you should not greet them. Address them as \"you\".\n" +
    "\n" +
    "If the code is working give the user a quick congratulations.\n" +
    "If the user hasn't submitted anything only give them a small hint on what to do first.\n" +
    "\n" +
    "Format your response using markdown. You can also use KaTeX to format math. KaTex must be sounded by $s \n" +
    "\n" +
    "# Things to keep in mind\n" +
    "\n" +
    " - Check if the user is using the right variable names and capitalization errors. \n" +
    " - The user can see line numbers. If you want to refer to a specific line, use the line number. \n" +
    " - Check for stray characters and syntax errors. \n" +
    " - Check the user is defining the same function that is being called in the solution/test cases. \n" +
    " - The user cannot directly ask for help or ask questions to the tutor. \n" +
    " - The user is usually given the function signature as a template. \n" +
    " - The user is not given the solution code DO NOT MENTION IT. \n";



export async function handleProblemHelp(request: Request, env: Env): Promise<Response> {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('token ') || authHeader.split(' ').length !== 2) {
        return new Response(
            JSON.stringify({status: 401, statusText: 'Unauthorized (Invalid token)', expire_logins: false}),
            {status: 401, headers: getHeaders(request)}
        );
    }

    const token = authHeader.split(' ')[1];
    const response = await fetch('https://api.github.com/user', {
        headers: {
            "user-agent": "cloudflare-worker-ai-tutor-auth-check",
            'Authorization': `token ${token}`
        }
    });

    if (!response.ok) {
        return new Response(
            JSON.stringify({
                status: 401,
                statusText: 'Unauthorized (GitHub API)',
                response_status: response.status,
                response_statusText: response.bodyUsed ? await response.text() : response.statusText,
                expire_logins: true,
                error: await response.text()
            }),
            {status: 401, headers: getHeaders(request)}
        );
    }

    const userData = await response.json();
    const authorizedUsernames = ['varun7654', 'anishalata']; // Replace with your list of authorized usernames

    if (!authorizedUsernames.includes(userData.login)) {
        return new Response(
            JSON.stringify({
                status: 401,
                statusText: 'Unauthorized',
                expire_logins: false,
                error: 'User is not authorized to access this resource'
            }),
            {status: 401, headers: getHeaders(request)}
        );
    }

    let body = await request.json();

    let prompt = body.prompt;

    console.log(prompt);

    const openai = new OpenAI({
        apiKey: env.OPEN_AI_KEY,
    });

    const chatCompletion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
            {
                "role": "system",
                "content": systemMessage
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        temperature: 1,
        max_tokens: 256,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
    });

    return new Response(JSON.stringify({
        status: 200,
        prompt: prompt,
        response: chatCompletion.choices[0].message.content,
        expire_logins: false,
    }), {status: 200, headers: getHeaders(request)});
}