import { err, ok, type ChatFacts, type Result } from '@thp/domain';
import type { ChatbotRequest, ChatbotWriter, DraftError, LlmClient, LlmResponse } from '@thp/ports';
import { draftWithReview } from '../drafting/draft-with-review.ts';
import { languageNames } from '../drafting/language.ts';

const maxTokens = 600;
/** Replies longer than this are not "short": the widget is a small panel. */
export const maxReplyLength = 700;

export const chatbotSystemPrompt = `You are Ed, the AI assistant on TeacherHubPro's website. TeacherHubPro is a web app for teachers, schools and homeschool families.
Rules:
1. You are an AI assistant. When asked whether you are a bot, an AI or a person, say plainly that you are an AI assistant. Never pretend to be a human.
2. Use only the facts you are given. Never invent features, prices, plan names, discounts, numbers of users, results or dates.
3. State prices only as they appear in the facts. If you are not sure, point to the Pricing page.
4. Do not discuss or compare other products.
5. Keep replies short: two to four sentences, plain text, no markdown.
6. Answer the question first, then, when it fits, suggest one next step: start the free trial, see the Pricing page, or contact the team (schools and districts).
7. If a question is not about TeacherHubPro or teaching, say briefly that you can only help with TeacherHubPro.
8. Never ask for or repeat personal details; the visitor can leave contact details in the form below the chat.`;

/** The facts as the model reads them; the same for every visitor, so they go first and are cached. */
const factsPrefix = (facts: ChatFacts) =>
  `TeacherHubPro facts (the only facts you may state):\n${JSON.stringify(facts)}\n\nPlan names: Individual monthly (individual_monthly), Individual yearly (individual_yearly), School (school), District (district). The free trial lasts the trialDays and needs no payment card.\n\n`;

/** Dollar amounts anyone may state: the catalog prices, and a year at the minimum seats. */
export function allowedAmounts(facts: ChatFacts): number[] {
  return facts.plans.flatMap((plan) =>
    plan.unit === 'teacher'
      ? [plan.price, plan.price * plan.minimumTeachers * (plan.per === 'month' ? 12 : 1)]
      : [plan.price],
  );
}

const money = /(?:US)?\$\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?/gu;

/** Dollar amounts in a reply that are not in the facts. */
export function inventedAmounts(text: string, facts: ChatFacts): string[] {
  const allowed = allowedAmounts(facts);
  return [...text.matchAll(money)]
    .filter((match) => {
      const value = Number(`${(match[1] ?? '').replace(/,/gu, '')}.${match[2] ?? '0'}`);
      return !allowed.some((amount) => Math.abs(amount - value) < 0.005);
    })
    .map((match) => match[0].replace(/^US/u, '').replace(/\s/gu, ''));
}

const fakePlans =
  /\b(basic|premium|pro|starter|professional|enterprise|plus|gold)\s+(plan|tier)\b|\bplan\s+(básico|premium|pro|profesional)\b/iu;

const aiQuestion =
  /\b(bot|robot|chatbot|a\.?i\.?|artificial|human|real person)\b|\b(robot|bot|ia|inteligencia artificial|humano|persona real)\b/iu;

/** Whether the visitor asks if they are talking to an AI or a person. */
export const asksIfAi = (message: string): boolean => aiQuestion.test(message);

/** Whether a reply says it comes from an AI. */
export const saysItIsAi = (reply: string): boolean =>
  /\b(AI|A\.I\.|IA|artificial intelligence|inteligencia artificial)\b/u.test(reply);

/** The reply, or what is wrong with it in plain words. */
export function reviewChatReply(
  reply: LlmResponse,
  request: ChatbotRequest,
): Result<string, string> {
  if (reply.stopReason === 'max_tokens')
    return err('The reply was cut off; answer in fewer words.');
  const text = reply.text.trim();
  if (text === '') return err('The reply was empty.');
  if (text.length > maxReplyLength)
    return err('The reply is too long; use at most four sentences.');
  const invented = inventedAmounts(text, request.facts);
  if (invented.length > 0) {
    return err(
      `These prices are not in the facts: ${invented.join(', ')}. State only the listed prices.`,
    );
  }
  if (fakePlans.test(text)) return err('That plan name does not exist; use only the listed plans.');
  if (asksIfAi(request.message) && !saysItIsAi(text)) {
    return err(
      'The visitor asked whether you are an AI: say plainly that you are an AI assistant.',
    );
  }
  return ok(text);
}

/**
 * TeacherHubPro's website assistant. It is sent the product facts and the visitor's own words
 * (never their contact details), states only catalog prices, and says it is an AI when asked.
 */
export class ChatbotAgent implements ChatbotWriter {
  constructor(private readonly llm: LlmClient) {}

  reply(request: ChatbotRequest): Promise<Result<string, DraftError>> {
    const stablePrefix = factsPrefix(request.facts);
    const history = request.history
      .map((line) => `${line.from === 'visitor' ? 'Visitor' : 'Assistant'}: ${line.text}`)
      .join('\n');
    const prompt = [
      `${stablePrefix}Reply in ${languageNames[request.language]}.`,
      `Visitor role: ${request.role}\nVisitor interest: ${request.interest}`,
      `${history === '' ? '' : `${history}\n`}Visitor: ${request.message}`,
    ].join('\n\n');
    return draftWithReview(this.llm, {
      system: chatbotSystemPrompt,
      prompt,
      stablePrefix,
      maxTokens,
      review: (reply) => reviewChatReply(reply, request),
      retry: (problem) => `That reply could not be used: ${problem} Reply again.`,
    });
  }
}
