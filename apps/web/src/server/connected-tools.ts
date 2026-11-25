/** How the Connected tools pages group the services, in the order of their filter buttons. */
export const toolGroups = ['google', 'microsoft', 'canva', 'calendar', 'schoolSystems'] as const;

export type ToolGroup = (typeof toolGroups)[number];

/** Every service a teacher can see on the Connected tools pages, in display order. */
export const tools = [
  { id: 'googleSignIn', group: 'google' },
  { id: 'classroom', group: 'google' },
  { id: 'forms', group: 'google' },
  { id: 'slides', group: 'google' },
  { id: 'onedrive', group: 'microsoft' },
  { id: 'teams', group: 'microsoft' },
  { id: 'canva', group: 'canva' },
  { id: 'calendar', group: 'calendar' },
  { id: 'canvas', group: 'schoolSystems' },
  { id: 'schoology', group: 'schoolSystems' },
  { id: 'moodle', group: 'schoolSystems' },
  { id: 'brightspace', group: 'schoolSystems' },
  { id: 'clever', group: 'schoolSystems' },
  { id: 'classlink', group: 'schoolSystems' },
] as const satisfies readonly { readonly id: string; readonly group: ToolGroup }[];

export type Tool = (typeof tools)[number];
export type ToolId = Tool['id'];

/**
 * The school systems that work with TeacherHubPro over LTI 1.3 (launches, class lists, adding
 * content and sending grades): built, and turned on for schools that ask.
 */
export const ltiTools: ReadonlySet<ToolId> = new Set<ToolId>([
  'canvas',
  'schoology',
  'moodle',
  'brightspace',
]);

/**
 * Turned on for schools that ask: Teams (its IT approves it), the LTI systems, and Clever and
 * ClassLink (built when the first school asks). Nothing is ever shown as "coming soon".
 */
export const onRequest: ReadonlySet<ToolId> = new Set<ToolId>([
  'teams',
  'clever',
  'classlink',
  ...ltiTools,
]);

const isOneOf = <T extends string>(options: readonly T[], value: unknown): value is T =>
  typeof value === 'string' && (options as readonly string[]).includes(value);

/** The group a filter link asks for, or null (show everything) when it is missing or unknown. */
export const toolGroupFrom = (value: unknown): ToolGroup | null =>
  isOneOf(toolGroups, value) ? value : null;

/** The tool a "tell us" link names, or null when it is not one of ours. */
export const toolFrom = (value: unknown): ToolId | null =>
  isOneOf(
    tools.map((tool) => tool.id),
    value,
  )
    ? value
    : null;

export const toolsIn = (group: ToolGroup | null): readonly Tool[] =>
  group === null ? tools : tools.filter((tool) => tool.group === group);
