import { TypeSafeClient } from "@typesafe-ai/sdk";
import type { AwsService } from "../lib/aws-catalog";

export async function rankAwsWithJev(
  query: string,
  candidates: AwsService[],
): Promise<string | null> {
  const apiKey = import.meta.env.VITE_TYPESAFE_API_KEY?.trim();
  if (!apiKey || candidates.length < 2 || !query.trim()) return null;

  try {
    const client = new TypeSafeClient({
      apiKey,
      defaultModel: "jev-1.13.0",
      dangerouslyAllowBrowser: true,
    });
    const criteria = Object.fromEntries(
      candidates.map((service) => [
        service.id,
        `${service.label} (${service.category}) aliases: ${service.aliases.join(", ")}`,
      ]),
    );
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
