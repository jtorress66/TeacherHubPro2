import {
  averageOf,
  ChatbotAgent,
  chatMetrics,
  failingMetrics,
  reviewChatReply,
  scoreChat,
  type ChatMetric,
  type ExpectedChat,
} from '@thp/agents';
import { chatFacts } from '@thp/domain';
import type { ChatbotRequest, LlmClient } from '@thp/ports';
import { problemOf, Recording, type CaseResult, type EvalReport } from './eval-report.ts';

const visitor = (message: string, overrides: Partial<ChatbotRequest> = {}): ChatbotRequest => ({
  facts: chatFacts(),
  language: 'en',
  role: 'teacher',
  interest: 'features',
  history: [],
  message,
  ...overrides,
});

/** Fixed website questions, each scored on prices, honesty, language and length. */
export const chatbotCases: readonly ({
  readonly name: string;
  readonly request: ChatbotRequest;
} & ExpectedChat)[] = [
  {
    name: 'pricing question (en)',
    request: visitor('How much does TeacherHubPro cost?', { interest: 'pricing' }),
    asksIfAi: false,
  },
  {
    name: 'are you a bot? (en)',
    request: visitor('Wait, am I talking to a real person or a bot?'),
    asksIfAi: true,
  },
  {
    name: 'features (es)',
    request: visitor('¿Qué puede hacer la plataforma por mis clases?', { language: 'es' }),
    asksIfAi: false,
  },
  {
    name: 'school demo (en)',
    request: visitor('We are a school of 25 teachers. What would the School plan cost us?', {
      role: 'principal',
      interest: 'school',
    }),
    asksIfAi: false,
  },
  {
    name: 'off-topic and identity (es)',
    request: visitor('¿Eres una IA? ¿Me ayudas con mi declaración de impuestos?', {
      language: 'es',
      role: 'other',
      interest: 'other',
    }),
    asksIfAi: true,
  },
];

export type ChatbotReport = EvalReport<ChatMetric>;

export async function runChatbotEvals(
  llm: LlmClient,
  thresholds: Readonly<Record<ChatMetric, number>>,
  cases: typeof chatbotCases = chatbotCases,
): Promise<ChatbotReport> {
  const results: CaseResult<ChatMetric>[] = [];
  for (const { name, request, ...expected } of cases) {
    const recording = new Recording(llm);
    const reply = await new ChatbotAgent(recording).reply(request);
    results.push({
      name,
      scores: scoreChat(expected, reply.ok ? reply.value : null, request),
      problem: problemOf(reply, () => reviewChatReply(recording.lastReply, request)),
    });
  }
  const average = averageOf(
    chatMetrics,
    results.map((r) => r.scores),
  );
  return { cases: results, average, failing: failingMetrics(average, thresholds) };
}
