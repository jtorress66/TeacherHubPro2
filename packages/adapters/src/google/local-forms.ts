import { err, ok, type Result } from '@thp/domain';
import type { CreatedForm, FormsError, GoogleForms } from '@thp/ports';
import { localClassroomFixture } from './local-classroom.ts';

/** A stand-in for Google Forms in local runs and E2E tests: quizzes are kept in memory. */
export class LocalForms implements GoogleForms {
  private made = 0;

  createQuiz(accessToken: string): Promise<Result<CreatedForm, FormsError>> {
    if (accessToken !== localClassroomFixture.accessToken) {
      return Promise.resolve(err({ code: 'unauthorized' }));
    }
    this.made += 1;
    const id = `local-form-${String(this.made)}`;
    return Promise.resolve(
      ok({
        id,
        editUrl: `https://forms.local/d/${id}/edit`,
        responderUrl: `https://forms.local/d/${id}/viewform`,
      }),
    );
  }
}
