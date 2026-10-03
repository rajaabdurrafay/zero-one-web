import { Arrow } from './ui';

const benefits = [
  ['Premium setup', 'Comfortable spaces built around the games and moments you enjoy.'],
  ['Easy online booking', 'Choose your activity, check availability and reserve your session online.'],
  ['Private rooms', 'A little space of your own for movie nights and squad sessions.'],
  ['Clear, fair pricing', 'Per-minute snooker and clear session rates. Know your price before you book.'],
];

export function WhyZeroOneSection() {
  return <section className="zo-why zo-container zo-section" aria-labelledby="zo-why-title">
    <div className="zo-why-heading" data-reveal><span className="zo-eyebrow">Why ZeroOne</span><h2 id="zo-why-title">A good setup makes<br />every session better.</h2><p>Come for the game. Stay for the experience.</p></div>
    <div className="zo-benefit-grid">{benefits.map(([title, description], index) => <article key={title} className="zo-benefit" data-reveal><span className="zo-benefit-icon">{index === 1 ? <Arrow /> : <span aria-hidden="true">{['✦', '', '◈', '✳'][index]}</span>}</span><h3>{title}</h3><p>{description}</p></article>)}</div>
  </section>;
}
