import {
  EndLiveSession,
  GetLiveView,
  NextLiveQuestion,
  RemoveLivePlayer,
  RevealLiveAnswer,
  StartLiveGame,
  SubmitLiveAnswer,
  VerifyLiveTicket,
} from '@thp/application';

/** The use cases the realtime server runs. */
export interface LiveCommands {
  readonly verify: VerifyLiveTicket;
  readonly view: GetLiveView;
  readonly start: StartLiveGame;
  readonly next: NextLiveQuestion;
  readonly reveal: RevealLiveAnswer;
  readonly end: EndLiveSession;
  readonly remove: RemoveLivePlayer;
  readonly answer: SubmitLiveAnswer;
}

type LiveDeps = ConstructorParameters<typeof VerifyLiveTicket>[0] &
  ConstructorParameters<typeof GetLiveView>[0] &
  ConstructorParameters<typeof SubmitLiveAnswer>[0] &
  ConstructorParameters<typeof RemoveLivePlayer>[0];

export const createLiveCommands = (deps: LiveDeps): LiveCommands => ({
  verify: new VerifyLiveTicket(deps),
  view: new GetLiveView(deps),
  start: new StartLiveGame(deps),
  next: new NextLiveQuestion(deps),
  reveal: new RevealLiveAnswer(deps),
  end: new EndLiveSession(deps),
  remove: new RemoveLivePlayer(deps),
  answer: new SubmitLiveAnswer(deps),
});
