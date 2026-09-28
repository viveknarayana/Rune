import type { AwsService } from "../lib/aws-catalog";
import { createJevClient, hasJevKey } from "./jev-client";

export async function rankAwsWithJev(
  query: string,
  candidates: AwsService[],
): Promise<string | null> {
  if (!hasJevKey() || candidates.length < 2 || !query.trim()) return null;

  try {
    const client = createJevClient();
    const criteria = Object.fromEntries(
      candidates.map((service) => [
        service.id,
        `${service.label} (${service.category}) aliases: ${service.aliases.join(", ")}`,
      ]),
    );
    console.info("[jev] rank", query.slice(0, 80));
    const result = await client.systemOne({
      state: { search_query: query },
      questions: {
        best_service: {
          type: "choice",
          instructions:
            "Pick the AWS service the user is most likely searching for. Prefer exact product names over generic category matches.",
          criteria,
        },
      },
    });
    return result.answers.best_service.choice;
  } catch {
    return null;
  }
}
