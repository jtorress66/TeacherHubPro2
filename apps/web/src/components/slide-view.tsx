import type { PresentationTheme, Slide } from '@thp/domain';
import { slideLook } from '../server/slide-view.ts';

/** One slide as students see it; the same view serves the editor preview, present mode and print. */
export function SlideView(props: {
  readonly slide: Slide;
  readonly theme: PresentationTheme;
  readonly animate?: boolean;
}) {
  const { slide, theme } = props;
  const look = slideLook(slide.layout);
  const half = Math.ceil(slide.bullets.length / 2);
  const columns =
    look.columns === 2
      ? [slide.bullets.slice(0, half), slide.bullets.slice(half)]
      : [slide.bullets];
  const picture =
    slide.emoji === '' ? null : (
      <span className="slide-emoji" aria-hidden="true">
        {slide.emoji}
      </span>
    );
  const transition = props.animate === true ? ` transition-${slide.transition}` : '';
  return (
    <div className={`${look.className} theme-${theme}${transition}`}>
      {look.picture === 'top' ? picture : null}
      <div className={`slide-body picture-${look.picture}`}>
        {look.picture === 'start' ? picture : null}
        <div className="slide-text">
          {slide.title === '' ? null : <h2 className="slide-title">{slide.title}</h2>}
          {slide.subtitle === null ? null : <p className="slide-subtitle">{slide.subtitle}</p>}
          {slide.content === null ? null : look.quote ? (
            <blockquote className="slide-quote">{slide.content}</blockquote>
          ) : (
            <p className="slide-content">{slide.content}</p>
          )}
          {slide.bullets.length === 0 ? null : (
            <div className={`slide-columns columns-${String(look.columns)}`}>
              {columns.map((points, index) => (
                <ul key={index}>
                  {points.map((point, i) => (
                    <li key={i}>{point}</li>
                  ))}
                </ul>
              ))}
            </div>
          )}
        </div>
        {look.picture === 'end' ? picture : null}
      </div>
    </div>
  );
}
