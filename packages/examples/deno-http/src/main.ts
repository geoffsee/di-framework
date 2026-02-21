import {
    Container,
    Component,
    Telemetry,
    getInjectionContainer,
} from "@di-framework/di-framework/decorators";
import {
    TypedRouter,
    json,
    Endpoint,
    type RequestSpec,
    type ResponseSpec,
    type Json,
} from "@di-framework/di-framework-http";

const data = {
    subjects: [
        "You",
        "The version of you they approved",
        "The man staring back from the mirror",
        "The consumer they built you to be",
        "Your fear of being nobody",
        "The life you keep postponing",
        "The animal underneath the resume",
    ],
    verbs: [
        "is chasing",
        "is addicted to",
        "is hiding behind",
        "is slowly becoming",
        "is terrified of losing",
        "mistakes for freedom",
        "calls success",
    ],
    objects: [
        "a life that was never yours",
        "approval from strangers",
        "a job that owns your time",
        "things you don't need",
        "a story someone else wrote",
        "comfort dressed up as purpose",
        "a cage with better lighting",
    ],
    modifiers: [
        "and wonders why it feels empty",
        "while calling it progress",
        "because silence feels dangerous",
        "so you never have to be alone with yourself",
        "and you know it",
        "but you keep buying anyway",
        "and that's the joke",
    ],
}

function pick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

function capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

@Container()
class NaturalLanguageService {
    @Telemetry({logging: true})
    getText(sentenceCount: number): string {
        return Array.from({length: sentenceCount}, () => {
            const sentence = `${pick(data.subjects)} ${pick(data.verbs)} ${pick(data.objects)} ${pick(data.modifiers)}.`;
            return capitalize(sentence);
        }).join(" ");
    }
}

// Types of stuff supplied to router
type Env = {};
type ExecutionContext = {};

const router = TypedRouter<[Env, ExecutionContext]>();

// Response Types
type SentencesResponse = { nonsense: string; count: number };
type SentenceResponse = { nonsense: string };

// Denosaur LLM
@Container()
export class NaturalLanguageController {
    @Component(NaturalLanguageService)
    private service!: NaturalLanguageService;

    @Endpoint({summary: "Get random nonsense", responses: {"200": {description: "Nonsense sentences"}}})
    static getRoot = router.get<RequestSpec<Json<void>>, ResponseSpec<SentenceResponse>>(
        "/",
        () => {
            const ctrl = getInjectionContainer().resolve(NaturalLanguageController);
            return json({nonsense: ctrl.service.getText(5)});
        },
    );

    @Endpoint({summary: "Get N nonsense sentences", responses: {"200": {description: "Nonsense sentences with count"}}})
    static getCount = router.get<RequestSpec<Json<void>>, ResponseSpec<SentencesResponse>>(
        "/:count",
        (req) => {
            const ctrl = getInjectionContainer().resolve(NaturalLanguageController);
            const count = parseInt(req.params.count) || 5;
            return json({nonsense: ctrl.service.getText(count), count});
        },
    );
}


if (import.meta.main) {
    Deno.serve({port: 8000}, router.fetch);
}
