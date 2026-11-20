# TeacherHubPro accessibility conformance report

Based on the VPAT® 2.5 template (WCAG edition). This is the report schools ask for as a "VPAT" or "ACR". Send it when a school asks; keep it true when the app changes.

| | |
| --- | --- |
| **Product** | TeacherHubPro web app (teacher app, school admin pages, student links, family portal links and the public website), teacherhubpro.com |
| **Report date** | 2026-11-20 |
| **Standard** | WCAG 2.1, levels A and AA |
| **Contact** | the contact page at teacherhubpro.com, or privacy@teacherhubpro.com |

## How it was evaluated

- **Automated checks on every page:** every page a teacher, student or family can reach (about 40 teacher, student and family pages, plus every public page) is checked with axe-core 4.14 against the WCAG 2.0 and 2.1 A and AA rules. The checks run in English and Spanish, with a class full of sample data, on a 320-pixel-wide screen. They run on every change to the code (`apps/web/e2e/accessibility-pages.spec.ts`, `accessibility.spec.ts`).
- **Extra automated checks:**
  - Pages must not scroll sideways at 320 pixels wide (1.4.10).
  - Form field outlines must have at least 3:1 contrast (1.4.11).
  - The hero animation must stop when the device asks for less motion.
  - Phone-width layouts are tested separately (`phone.spec.ts`).
- **Keyboard test:** a teacher takes attendance and confirms a grade, and a student answers and hands in work, using only the keyboard. At each step the test checks that the focused control shows a focus ring (`keyboard.spec.ts`).
- **Review of the code** for the items automated tools cannot judge, noted in the remarks below.
- **Not used:** testing with real screen readers (NVDA, JAWS, VoiceOver) or by users with disabilities. This should be done before a large district contract.

## Terms

- **Supports:** works as the requirement asks, with no known problems.
- **Partially Supports:** some parts do not yet meet the requirement.
- **Does Not Support:** most of it does not meet the requirement.
- **Not Applicable:** the product has nothing the requirement covers.

## Table 1: WCAG 2.1 Level A

| Criteria | Conformance level | Remarks and explanations |
| --- | --- | --- |
| 1.1.1 Non-text Content | Supports | Images, icons and buttons have text names or are marked decorative (automated checks pass on every page). Files teachers upload, such as PDF tests, are shown as files and are not described by the app. |
| 1.2.1 Audio-only and Video-only (Prerecorded) | Not Applicable | There is no audio-only or video-only media. |
| 1.2.2 Captions (Prerecorded) | Supports | The website's narrated tour has captions in all seven languages. |
| 1.2.3 Audio Description or Media Alternative (Prerecorded) | Supports | The tour's full script is on the same page. |
| 1.3.1 Info and Relationships | Partially Supports | Pages use real headings, lists, tables with header cells, labelled form fields and landmarks. Downloaded PDFs (report cards, printouts) are not tagged for screen readers; the same information is on the page in the app. |
| 1.3.2 Meaningful Sequence | Supports | The reading order follows the order on screen. |
| 1.3.3 Sensory Characteristics | Supports | Instructions do not rely on shape, size, position or sound alone. |
| 1.4.1 Use of Color | Supports | Status, errors and selections are also shown in words or with a marked control, not by color alone. |
| 1.4.2 Audio Control | Supports | Nothing plays sound by itself. Read-aloud starts only when the Listen button is pressed and has a Stop button. |
| 2.1.1 Keyboard | Supports | All controls are standard buttons, links and form fields, and wide tables can be scrolled with the keyboard. In the sorting game, dragging has a dropdown alternative. The main teacher and student tasks are tested with the keyboard alone. |
| 2.1.2 No Keyboard Trap | Supports | Focus can always move on. Presentation mode leaves with Esc. |
| 2.1.4 Character Key Shortcuts | Supports | There are no single-letter shortcuts. Presentation mode uses the arrow keys, only while it is open. |
| 2.2.1 Timing Adjustable | Supports | There are no time limits on forms or answers. Timed questions in live games fall under the real-time exception. |
| 2.2.2 Pause, Stop, Hide | Partially Supports | The website's home-page drawings move in a loop and have no on-page pause button. They stop when the device or browser asks for reduced motion. The app itself has no moving content. |
| 2.3.1 Three Flashes or Below Threshold | Supports | Nothing flashes. |
| 2.4.1 Bypass Blocks | Supports | Every page has a main landmark and headings, so assistive technology can jump past the menu. |
| 2.4.2 Page Titled | Supports | Every page has a title. |
| 2.4.3 Focus Order | Supports | Focus follows the order on screen (keyboard test). |
| 2.4.4 Link Purpose (In Context) | Supports | Link text, or the link with its row or heading, says where it goes. Repeated links such as Edit and Remove name the student. |
| 2.5.1 Pointer Gestures | Supports | No action needs a path-based or multi-finger gesture. |
| 2.5.2 Pointer Cancellation | Supports | Actions run on release (standard buttons and links). |
| 2.5.3 Label in Name | Supports | A control's spoken name starts with its visible words. A unit test checks the report card buttons in all seven languages. |
| 2.5.4 Motion Actuation | Not Applicable | Nothing is triggered by moving the device. |
| 3.1.1 Language of Page | Supports | Each page declares its language, one of the seven the interface is fully translated into. |
| 3.2.1 On Focus | Supports | Focusing a control does not change the page. |
| 3.2.2 On Input | Supports | Changing a field does not submit a form or move to another page by itself. |
| 3.3.1 Error Identification | Supports | Errors are named in words next to the field, and the field is marked invalid. |
| 3.3.2 Labels or Instructions | Supports | Every field has a visible label; hints explain formats. |
| 4.1.1 Parsing | Supports | The app produces valid markup. (WCAG 2.2 notes that this criterion is always met.) |
| 4.1.2 Name, Role, Value | Supports | Standard controls with names, roles and states (automated checks pass on every page). |

## Table 2: WCAG 2.1 Level AA

| Criteria | Conformance level | Remarks and explanations |
| --- | --- | --- |
| 1.2.4 Captions (Live) | Not Applicable | There is no live audio or video. |
| 1.2.5 Audio Description (Prerecorded) | Partially Supports | The narrated tour describes what is on screen and its full script is on the page. There is no separate audio-description track. |
| 1.3.4 Orientation | Supports | Pages work upright and sideways. |
| 1.3.5 Identify Input Purpose | Supports | Name, email and password fields carry the standard autocomplete values. |
| 1.4.3 Contrast (Minimum) | Supports | Text contrast passes the automated check on every page. |
| 1.4.4 Resize Text | Supports | Sizes are relative, and pages reflow at 320 pixels wide, which covers 200% zoom. |
| 1.4.5 Images of Text | Supports | Text is real text, except the logo. |
| 1.4.10 Reflow | Supports | No page scrolls sideways at 320 pixels wide (automated check on every page). Wide data tables scroll inside their own box, which WCAG allows for tables. |
| 1.4.11 Non-text Contrast | Supports | Form field outlines are checked at 3:1 or more on every page. The focus ring is 7.9:1. |
| 1.4.12 Text Spacing | Not Evaluated | Not yet tested with increased letter, word and line spacing. No problems are known. |
| 1.4.13 Content on Hover or Focus | Supports | There are no custom tooltips or pop-ups on hover. |
| 2.4.5 Multiple Ways | Supports | Pages can be reached through the menu, the dashboard and links within each class. |
| 2.4.6 Headings and Labels | Supports | Headings and labels describe their content. |
| 2.4.7 Focus Visible | Supports | A clear focus ring is shown; the keyboard test checks it at each step. |
| 3.1.2 Language of Parts | Partially Supports | When a teacher asks the AI for material in a language other than the page's (for example, a Spanish worksheet in the English interface), that text is not marked with its own language. |
| 3.2.3 Consistent Navigation | Supports | The menu is the same on every app page. |
| 3.2.4 Consistent Identification | Supports | The same actions use the same names throughout. |
| 3.3.3 Error Suggestion | Supports | Error messages say how to fix the problem. |
| 3.3.4 Error Prevention (Legal, Financial, Data) | Supports | Payments go through Stripe's checkout with a review step. Deleting school data needs the school's name typed in and has a 30-day hold. Submitted attendance can be reopened, and AI grades stay drafts until the teacher confirms them. |
| 4.1.3 Status Messages | Supports | Saved, sent and error messages are announced as status or alert messages. |

## Known gaps and plans

1. **Tag downloaded PDFs for screen readers** (1.3.1): report cards and printouts.
2. **Add a pause button** to the home-page drawings (2.2.2).
3. **Mark the language** of AI material written in another language (3.1.2).
4. **Test text spacing** (1.4.12).
5. **Test with screen readers** (NVDA, JAWS, VoiceOver), ideally with users with disabilities.
6. **Add a Listen button** to assignment questions. This is not a WCAG requirement, but schools ask for it.

Third-party pages, such as Stripe checkout and Google or Microsoft sign-in, follow those companies' own accessibility reports.
