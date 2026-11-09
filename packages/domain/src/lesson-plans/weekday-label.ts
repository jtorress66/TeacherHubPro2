// Weekday names, Monday to Friday, in the app's seven languages (zh in both common forms).
const weekdays = [
  'monday|tuesday|wednesday|thursday|friday',
  'lunes|martes|miércoles|miercoles|jueves|viernes',
  'lundi|mardi|mercredi|jeudi|vendredi',
  'segunda-feira|terça-feira|terca-feira|quarta-feira|quinta-feira|sexta-feira|segunda|terça|terca|quarta|quinta|sexta',
  'montag|dienstag|mittwoch|donnerstag|freitag',
  'lunedì|lunedi|martedì|martedi|mercoledì|mercoledi|giovedì|giovedi|venerdì|venerdi',
  '星期一|星期二|星期三|星期四|星期五|周一|周二|周三|周四|周五',
].join('|');

const leadingWeekday = new RegExp(`^\\s*(?:${weekdays})\\s*[:：\\-–—]\\s*(?=\\S)`, 'iu');

/**
 * A day's title without a weekday in front ("Monday: Intro" becomes "Intro"): the plan already
 * shows the day, so a model that repeats it would print "Monday: Monday: Intro".
 */
export const stripWeekdayLabel = (title: string): string => title.replace(leadingWeekday, '');
