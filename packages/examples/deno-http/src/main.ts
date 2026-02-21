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

const subjects = [
  "The engineer",
  "A curious developer",
  "The system",
  "An automated agent",
  "The application",
  "A distributed service",
  "The algorithm",
];

const verbs = [
  "analyzes",
  "optimizes",
  "generates",
  "processes",
  "transforms",
  "evaluates",
  "orchestrates",
];

const objects = [
  "incoming requests",
  "structured data",
  "user input",
  "real-time signals",
  "network traffic",
  "application state",
  "complex workflows",
];

const modifiers = [
  "with precision",
  "in real time",
  "at scale",
  "without hesitation",
  "under heavy load",
  "with measurable impact",
  "in a distributed environment",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

@Container()
class NaturalLanguageService {
  @Telemetry({ logging: true })
  getText(sentenceCount: number): string {
    return Array.from({ length: sentenceCount }, () => {
      const sentence = `${pick(subjects)} ${pick(verbs)} ${pick(objects)} ${pick(modifiers)}.`;
      return capitalize(sentence);
    }).join(" ");
  }
}

const router = TypedRouter();

@Container()
export class NaturalLanguageController {
  @Component(NaturalLanguageService)
  private service!: NaturalLanguageService;

  @Endpoint({ summary: "Get random nonsense", responses: { "200": { description: "Nonsense sentences" } } })
  static getRoot = router.get<RequestSpec<Json<void>>, ResponseSpec<{ nonsense: string }>>(
    "/",
    () => {
      const ctrl = getInjectionContainer().resolve(NaturalLanguageController);
      return json({ nonsense: ctrl.service.getText(5) });
    },
  );

  @Endpoint({ summary: "Get N nonsense sentences", responses: { "200": { description: "Nonsense sentences with count" } } })
  static getCount = router.get<RequestSpec<Json<void>>, ResponseSpec<{ nonsense: string; count: number }>>(
    "/:count",
    (req) => {
      const ctrl = getInjectionContainer().resolve(NaturalLanguageController);
      const count = parseInt(req.params.count) || 5;
      return json({ nonsense: ctrl.service.getText(count), count });
    },
  );
}

export { router };

if (import.meta.main) {
  Deno.serve({ port: 8000 }, router.fetch);
}
