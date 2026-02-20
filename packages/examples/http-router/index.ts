import {
  TypedRouter,
  json,
  type RequestSpec,
  type ResponseSpec,
  type Json,
  Controller,
  Endpoint,
} from "@di-framework/di-framework-http";

const router = TypedRouter();

type EchoPayload = { message: string };
type EchoResponse = { echoed: string; timestamp: string };

@Controller()
export class EchoController {
  @Endpoint({
    summary: "Echo a message",
    description: "Returns the provided message with a server timestamp.",
    responses: {
      "200": { description: "Successful echo" },
    },
  })
  static post = router.post<
    RequestSpec<Json<EchoPayload>>,
    ResponseSpec<EchoResponse>
  >("/echo", (req) => {
    return json({
      echoed: req.content.message,
      timestamp: new Date().toISOString(),
    });
  });
}

router.get("/", () => json({ message: "API is healthy" }));

export default {
  fetch: (request: Request, env: any, ctx: any) =>
    router.fetch(request, env, ctx),
};
export { router };
