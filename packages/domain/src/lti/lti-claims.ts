const claimBase = 'https://purl.imsglobal.org/spec/lti/claim';
const deepLinkingBase = 'https://purl.imsglobal.org/spec/lti-dl/claim';

/** The LTI 1.3 claim names a launch is read from, and a deep linking response is written with. */
export const ltiClaim = {
  version: `${claimBase}/version`,
  messageType: `${claimBase}/message_type`,
  deploymentId: `${claimBase}/deployment_id`,
  roles: `${claimBase}/roles`,
  context: `${claimBase}/context`,
  resourceLink: `${claimBase}/resource_link`,
  launchPresentation: `${claimBase}/launch_presentation`,
  targetLinkUri: `${claimBase}/target_link_uri`,
  /** The custom parameters of the link that was launched (a placed item's reference). */
  custom: `${claimBase}/custom`,
  /** Names and Role Provisioning Services: where the course's class list can be read. */
  namesRoleService: 'https://purl.imsglobal.org/spec/lti-nrps/claim/namesroleservice',
  /** Deep Linking: where to send the chosen items, and which kinds and how many it accepts. */
  deepLinkingSettings: `${deepLinkingBase}/deep_linking_settings`,
  /** Deep Linking: the items a teacher chose, in the response. */
  contentItems: `${deepLinkingBase}/content_items`,
  /** Deep Linking: the course system's own value, handed back unchanged in the response. */
  deepLinkingData: `${deepLinkingBase}/data`,
} as const;

/** The two LTI messages TeacherHubPro answers. */
export const ltiMessageType = {
  resourceLink: 'LtiResourceLinkRequest',
  deepLinking: 'LtiDeepLinkingRequest',
  deepLinkingResponse: 'LtiDeepLinkingResponse',
} as const;
