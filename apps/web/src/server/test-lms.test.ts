import { describe, expect, it } from 'vitest';
import {
  autoPostPage,
  readServiceTokenRequest,
  readTestLmsLoginHint,
  testLmsLoginHint,
} from './test-lms.ts';

describe('the pretend course system', () => {
  it('reads back the role and user it put in its login hint', () => {
    expect(readTestLmsLoginHint(testLmsLoginHint('teacher', 'teacher-1'))).toEqual({
      role: 'teacher',
      subject: 'teacher-1',
    });
    expect(readTestLmsLoginHint('learner:student:1')).toEqual({
      role: 'learner',
      subject: 'student:1',
    });
    expect(readTestLmsLoginHint('admin:x')).toBeNull();
    expect(readTestLmsLoginHint('teacher:')).toBeNull();
    expect(readTestLmsLoginHint(null)).toBeNull();
  });

  it('posts the launch back with a self-submitting form, escaping every value', () => {
    const page = autoPostPage('http://localhost:3100/api/lti/launch', {
      id_token: 'a.b.c',
      state: '"><script>',
    });
    expect(page).toContain('<form method="post" action="http://localhost:3100/api/lti/launch">');
    expect(page).toContain('<input type="hidden" name="id_token" value="a.b.c">');
    expect(page).toContain('value="&quot;&gt;&lt;script&gt;"');
    expect(page).not.toContain('"><script>');
    expect(page).toContain('document.forms[0].submit()');
  });

  it('reads a client credentials request from its form', () => {
    const form = new URLSearchParams({
      grant_type: 'client_credentials',
      client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
      client_assertion: 'a.b.c',
      scope: 'scope-1',
    });
    expect(readServiceTokenRequest(form)).toEqual({
      grantType: 'client_credentials',
      clientAssertionType: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
      clientAssertion: 'a.b.c',
      scope: 'scope-1',
    });
    expect(readServiceTokenRequest(new URLSearchParams())).toEqual({
      grantType: null,
      clientAssertionType: null,
      clientAssertion: null,
      scope: null,
    });
  });
});
