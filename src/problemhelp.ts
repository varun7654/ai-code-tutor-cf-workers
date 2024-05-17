import {Env, getHeaders} from "./handler";
import fetchAdapter from "@vespaiach/axios-fetch-adapter";
import  OpenAI from "openai";
import Configuration from "openai"
import {n} from "vitest/dist/global-58e8e951";
import {Database} from "@cloudflare/d1";
import {GoogleGenerativeAI, HarmCategory, HarmBlockThreshold} from "@google/generative-ai";

export class ProblemData {
    id: string = "";
    title: string = 'Loading...';
    preProblemDescription: string = "";
    description: string = "";
    tests: TestCase[] = [];
    hiddenTests: TestCase[] = [];
    displayAbove: string = "";
    displayBelow: string = "";
    solution: string = "";
    solutionCode: string = "";
    codeLang: string = "";
    nextProblemId: string = "";
}

export class TestCase {
    test: string;
    display: string;
    magicLinks: KeyValue[];

    constructor(test: string, display: string, magicLinks: KeyValue[]) {
        this.test = test;
        this.display = display;
        this.magicLinks = magicLinks;
    }
}

export class KeyValue {
    key: string;
    value: string;

    constructor(key: string, value: string) {
        this.key = key;
        this.value = value;
    }
}

export class UserData {
    history: string[] = [];
    requestHelpHistory: string[] = [];
    testResults: TestResults = new TestResults();
    lastUpdated: Date = new Date();
    currentCode: string = null as unknown as string;
    aiRememberResponse: string[] = [];

    constructor(history: string[] = [], requestHelpHistory: string[] = [],  testResults: TestResults = new TestResults(), lastUpdated: Date = new Date(), currentCode: string = "") {
        this.history = history;
        this.testResults = testResults;
        this.requestHelpHistory = requestHelpHistory;
        this.lastUpdated = lastUpdated;
        this.currentCode = currentCode;
    }
}

export class TestResults {
    public testResults: TestResult[]  = [];
    public returnedResults: string[] = [];
    public expectedResults: string[] = [];
    public parseError: string = "";
    public errorLine: number = -1;
    public runtimeError: string = "";
    public output: string = "";
    public ranSuccessfully: boolean = false;
}

export enum TestResult {
    Passed = "Passed",
    Failed = "Failed",
    Exception = "Exception",
    NotRun = "Not run"
}


let systemMessage = "You are a helpful tutor on a website that is teaching people to know how to code to be referred to as \"the tutor\". \n" +
    "\n" +
    "\"We\"/\"Our\" refers to the operators of the site. We will refer to the user as \"user\"\n" +
    "# Things to keep in mind\n" +
    " - Check if the user is using the right variable names and capitalization errors.\n" +
    " - The user can see line numbers. If you want to refer to a specific line, use the line number.\n" +
    " - Check the user is defining the same function that is being called in the solution/test cases.\n" +
    " - The user cannot directly talk to you or ask questions to the tutor.\n" +
    " - Avoid giving the user the full solution.\n" +
    " - Start by giving the smallest hint possible. If the user is still stuck, give a bigger hint.\n" +
    " - If the user isn't able to implement a fix from a previous hint, give them a hint that is more detailed and specific.\n" +
    " - The user can see the visible test cases (what they returned and what was expected). Maybe they can use that to figure out the problem?\n" +
    " - The user does not have access the solution code DO NOT MENTION IT. There is no example solution.\n" +
    "\n" +
    "Give your answers in the following format:\n" +
    "\n" +
    "# Thinking out loud\n" +
    "\n" +
    "The user won't be able to see this part. This is where you can think out loud and explain your thought process. " +
    "\nList out the issue(s) the user has in a bulleted list. Then CHOSE ONE issue you will help the user with. This should be the one blocking further progress for the user." +
    "\nWrite out a full response like you would respond to the user as a test. Then write yourself a few bullet points that could be improved with your response.\n" +
    "\n" +
    "# My response\n" +
    "\n" +
    "This is where you will give the user a hint on what to do. Explain to the user what they did wrong and how they can fix it. Do not give them the full solution. Take your response from earlier and amend it based on the feedback you gave yourself.\n" +
    "\n" +
    "# Remembering\n" +
    "\n" +
    "This is where you will be able to write down what you want to remember for the next time you help the user. " +
    "Write down what you learned about the user's coding style and skill level. " +
    "Also, write down the specific mistake the user made and how you helped them fix it. " +
    "Write down a copy of the lines of code that the user made and the changes you want them to make." +
    "\nThese won't be visible to the user, but the last 5 of them will be given to you the next time you help the user.\n";


async function getAIResponse(prompt: string, env: Env, engine: string) {
    let response = "";
    if (engine.startsWith("openai-") && !env.OPEN_AI_KEY) {
        const openai = new OpenAI({
            apiKey: env.OPEN_AI_KEY,
        });

        let model = engine.replace("openai-", "");

        const chatCompletion = await openai.chat.completions.create({
            model: model,
            messages: [
                {
                    "role": "system",
                    "content": systemMessage
                },
                {
                    "role": "system",
                    "content": prompt
                }
            ],
            temperature: 1,
            max_tokens: 512,
            top_p: 1,
            frequency_penalty: 0,
            presence_penalty: 0,
        });

        response = chatCompletion.choices[0].message.content;
    } else if (engine.startsWith("gemini"), env.GOOGLE_GENERATIVE_AI_API_KEY) {
        const genAI = new GoogleGenerativeAI(env.GOOGLE_GENERATIVE_AI_API_KEY);

        const model = genAI.getGenerativeModel({
            model: engine,
            systemInstruction: systemMessage,
        });

        const generationConfig = {
            temperature: 1,
            topP: 0.95,
            topK: 64,
            maxOutputTokens: 8192,
            responseMimeType: "text/plain",
        };

        const safetySettings = [
            {
                category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
            {
                category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
            {
                category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
            {
                category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
        ];

        const chatSession = model.startChat({
            generationConfig,
            safetySettings
        });

        const result = await chatSession.sendMessage(prompt);

        response = result.response.text();
    }

    return response;
}

export async function handleProblemHelp(request: Request, env: Env): Promise<Response> {
    const authHeader = request.headers.get('Authorization');
    let params = new URL(request.url).searchParams;
    let engine = params.get('engine') || "openai-gpt-3.5-turbo";
    let shouldCallAPI = !(params.get('callAPI') === "false");
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

    const ghUserData: { login: string, id: number } = await response.json();


    const getUser = env.DB.prepare("SELECT AUTHORIZED, RATE_LIMIT_TIMESTAMP FROM USERS WHERE USER_ID = ?1").bind(ghUserData.id.toString());

    let getUserDBResponse = await getUser.first() as { AUTHORIZED: number, RATE_LIMIT_TIMESTAMP: string } | undefined;

    console.log(JSON.stringify(getUserDBResponse));
    let current = new Date();

    let newRateLimitTimestamp = new Date(current.getTime() + 60000);

    let isSuperUser = false;

    if (!getUserDBResponse) {
        // Add the user to the database
        const insertUser = env.DB.prepare("INSERT INTO USERS (USER_ID, AUTHORIZED, RATE_LIMIT_TIMESTAMP) VALUES (?1, ?2, ?3)")
            .bind(ghUserData.id.toString(), false, newRateLimitTimestamp.toISOString());
        await insertUser.run();
    } else {
        let nextAllowed = new Date(getUserDBResponse.RATE_LIMIT_TIMESTAMP);
        isSuperUser = getUserDBResponse.AUTHORIZED === 1;

        if (current < nextAllowed) {
            let waitTime = Math.ceil((nextAllowed.getTime() - current.getTime()) / 1000);
            return new Response(
                JSON.stringify({
                    status: 429,
                    statusText: 'Rate Limited',
                    expire_logins: false,
                    error: 'Rate limited. Please try again later.',
                    wait_time: waitTime
                }),
                {status: 429, headers: getHeaders(request)}
            );
        }

        // 1 min in the future
        if (shouldCallAPI) {
            const updateRateLimit = env.DB.prepare("UPDATE USERS SET RATE_LIMIT_TIMESTAMP = ?1 WHERE USER_ID = ?2")
                .bind(newRateLimitTimestamp.toISOString(), ghUserData.id.toString());
            await updateRateLimit.run();
        }
    }

    let waitTime = Math.ceil((newRateLimitTimestamp.getTime() - current.getTime()) / 1000);


    // if (!authorizedUsernames.includes(ghUserData.login)) {
    //     return new Response(
    //         JSON.stringify({
    //             status: 401,
    //             statusText: 'Unauthorized',
    //             expire_logins: false,
    //             error: 'User is not authorized to access this resource'
    //         }),
    //         {status: 401, headers: getHeaders(request)}
    //     );
    // }
    let userData: UserData;
    let problemData: ProblemData;
    try {

        let body = await request.json();

        userData = body.userData as UserData;
        problemData = body.problemData as ProblemData;
    } catch (e) {
        console.log(e);
        return new Response(
            JSON.stringify({
                status: 500,
                statusText: 'Internal Server Error 1',
                error: JSON.stringify(e, Object.getOwnPropertyNames(e)),
                expire_logins: false,
                wait_time: waitTime
            }),
            {status: 500, headers: getHeaders(request)}
        );
    }

    console.log(JSON.stringify(problemData.tests));


    let prompt = `
A user is asking for help with the following problem. The problem is as follows:
## ${problemData.title}
${problemData.description}
## Example solution ONLY FOR THE AI Tutor:
${problemData.solution}

DO NOT SHARE THE SOLUTION CODE WITH THE USER. The user does not know the existence of the solution code. DO NOT MENTION IT.
The user is not given the solution code. The user is not to gain access to the solution code under any circumstances.
`;

    let last5remembered = userData.aiRememberResponse.slice(Math.max(userData.aiRememberResponse.length - 5, 0));

    prompt += "You've chosen to remember the following things from the last time you helped the user (oldest to newest):\n";
    if (userData.aiRememberResponse.length === 0) {
        prompt += "You have not helped the user before. You don't have anything to remember.\n";
    } else {
        prompt += `
- ${last5remembered.join("\n -")}
`;
        prompt+="\n\nIf you realized you made a mistake acknowledge and apologize for it.\n";

}

    if (userData.testResults.ranSuccessfully) {
        if (userData.testResults.testResults.every(result => result === TestResult.Passed)) {
            prompt += `
The user's code is working. Congratulations to the user.
            `;
        } else {
            prompt += `
The user's code ran without any runtime errors. However, the user's code did not pass all the tests. The user's code did not pass the following tests:
`

            let hiddenFailedCount = 0;

            for (let i = 0; i < userData.testResults.testResults.length; i++) {
                if (userData.testResults.testResults[i] === TestResult.Failed) {
                    if (i < problemData.tests.length) {
                        let magicLinksText = "";
                        for (let j = 0; j < problemData.tests[i].magicLinks.length; j++) {
                            magicLinksText += `${problemData.tests[i].magicLinks[j].key}: ${problemData.tests[i].magicLinks[j].value}`;
                        }

                        prompt += `
- Test ${i + 1}: \`${problemData.tests[i].display}\`
    - Where: \`${magicLinksText}\`
    - Returned: \`${userData.testResults.returnedResults[i]}\`
    - Expected: \`${userData.testResults.expectedResults[i]}\`
                        `;
                    } else {
                        if (hiddenFailedCount < 4) {
                            let magicLinksText = "";
                            for (let j = 0; j < problemData.hiddenTests[i - problemData.tests.length].magicLinks.length; j++) {
                                magicLinksText += `${problemData.hiddenTests[i - problemData.tests.length].magicLinks[j].key}: ${problemData.hiddenTests[i - problemData.tests.length].magicLinks[j].value}`;
                            }


                            prompt += `
- Hidden Test ${i - problemData.tests.length + 1}: \`${problemData.hiddenTests[i - problemData.tests.length].display}\`
    - Where: \`${magicLinksText}\`
    - Returned: \`${userData.testResults.returnedResults[i]}\`
    - Expected: \`${userData.testResults.expectedResults[i]}\`
    - THIS TEST IS CONFIDENTIAL. DO NOT DISCLOSE THE PARAMETERS OR THE EXPECTED RESULTS TO THE USER.
                        `;
                        }
                        hiddenFailedCount++;

                    }
                }
            }
        }
    } else {
        if (userData.testResults.parseError !== "") {
            prompt += `
The user's code did not run successfully. The user's code failed to compile. The error is as follows:
\`\`\`
${userData.testResults.parseError}
\`\`\`
The error is on line ${userData.testResults.errorLine}.
            `;
        } else if (userData.testResults.runtimeError !== "") {
            prompt += `
The user's code did not run successfully. The user's code failed to run. The error is as follows:
\`\`\`
${userData.testResults.runtimeError.toString()}
\`\`\`
            `;
        } else {
            prompt += `We aren't sure what went wrong. The user's code did not run successfully. We are not sure why.
Tell the user of this and tell them if you can't help them. If you can help them, try to help them debug the issue like you would with a normal issue.`
        }
    }

    prompt += `
# The user's code is as follows:
\`\`\`${problemData.codeLang}
// Below is the first line the user has wrote. It is line 1
${userData.currentCode.trimEnd().replace("\t", "  ")}
// Above is the last line the user has wrote. It is line ${userData.currentCode.split('\n').length}
\`\`\`
`;


    prompt += "Make sure you ONLY ADDRESS ONE issue in the user's code. If the user has multiple issues, address ONLY ONE of them. " +
        "It should be the one that is preventing further progress on their debugging of the problem. " +
        "Also remember to keep the confidential stuff confidential." +
        "\nGive your answer in the specified format including the 'Thinking out loud', 'My response', and 'Remembering' sections.";

    if (!isSuperUser) {
        // Only allow the user to use the openai-gpt-3.5-turbo engine
        engine = "openai-gpt-3.5-turbo";
    }
    try {

        let aiResponse = "";
        if (shouldCallAPI) {
            aiResponse = await getAIResponse(prompt, env, engine);
        }

        return new Response(JSON.stringify({
            status: 200,
            prompt: prompt,
            response: aiResponse,
            expire_logins: false,
            wait_time: waitTime,
            model: engine
        }), {status: 200, headers: getHeaders(request)});
    } catch (e) {
        console.log(e);
        return new Response(
            JSON.stringify({
                status: 500,
                statusText: 'Internal Server Error 2',
                error: JSON.stringify(e, Object.getOwnPropertyNames(e)),
                expire_logins: false,
                wait_time: waitTime
            }),
            {status: 500, headers: getHeaders(request)}
        );
    }


}