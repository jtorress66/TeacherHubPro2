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
] as const satisfies readonly { readonly id: string; readonly group: ToolGroup }[];

export type Tool = (typeof tools)[number];
export type ToolId = Tool['id'];

/** Not built yet: listed so a school can tell us it needs one. */
export const comingSoon: ReadonlySet<ToolId> = new Set<ToolId>([
  'canvas',
  'schoology',
  'moodle',
  'brightspace',
  'clever',
]);

/** The school systems that can launch TeacherHubPro over LTI 1.3, when it is on. */
export const ltiTools: ReadonlySet<ToolId> = new Set<ToolId>([
  'canvas',
  'schoology',
  'moodle',
  'brightspace',
]);

/** What is still coming: every school system while LTI is off, only the rest while it is on. */
export const comingSoonWith = (ltiOn: boolean): ReadonlySet<ToolId> =>
  ltiOn ? new Set([...comingSoon].filter((id) => !ltiTools.has(id))) : comingSoon;

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
