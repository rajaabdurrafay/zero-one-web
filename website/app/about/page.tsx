import { PageIntro } from "@/components/redesign/PageIntro";
import { BookingBanner } from "@/components/redesign/BookingBanner";
import { venueImages } from "@/components/redesign/content";

export const metadata = {
  title: "About ZeroOne — Cue & Play, Karachi",
  description:
    "Games, private rooms and good company at ZeroOne in Gulistan-e-Jauhar, Karachi.",
};

const standards = [
  [
    "01",
    "Find your kind of play.",
    "Snooker, PS5 gaming, private cinema, table tennis and car simulation. Pick your pace and bring your people.",
  ],
  [
    "02",
    "Make room for your squad.",
    "Choose a private PS5 room or cinema session when you want a space of your own.",
  ],
  [
    "03",
    "Know your session.",
    "Explore activity rates, choose your duration and review the total in the booking flow before confirming.",
  ],
  [
    "04",
    "Make it any time.",
    "We are open 24/7 in Gulistan-e-Jauhar, Karachi. Check availability for the activity and time you want.",
  ],
];

export default function AboutPage() {
  return (
    <div className="zo-page-spacing">
      <PageIntro
        label="About us"
        title="Good games. Better company."
        description="A place to switch off, show up and play. Welcome to ZeroOne Cue & Play, your local gaming spot in Karachi."
        image={venueImages.snooker}
        alt="Players at the ZeroOne snooker hall"
      />
      <section className="zo-container zo-story" data-reveal>
        <div>
          <span className="zo-eyebrow">More than a game</span>
          <h2>
            Your people.
            <br />
            Your place to play.
          </h2>
        </div>
        <div>
          <p>
            Some nights are for a close frame of snooker. Others are for a
            console match with friends, a movie in your own room or one more lap
            on the simulator.
          </p>
          <p>
            ZeroOne brings those experiences together under one roof. Come for
            your favourite game, try something new, or make a whole night of it.
          </p>
        </div>
      </section>
      <section
        className="zo-container zo-numbered-section"
        aria-labelledby="standards-title"
      >
        <span className="zo-eyebrow">The ZeroOne experience</span>
        <h2 id="standards-title">
          A little competition.
          <br />A lot of good times.
        </h2>
        {standards.map(([number, title, copy]) => (
          <article className="zo-numbered-row" key={number} data-reveal>
            <span>{number}</span>
            <h3>{title}</h3>
            <p>{copy}</p>
          </article>
        ))}
      </section>
      <section className="zo-container zo-faq">
        <div data-reveal>
          <span className="zo-eyebrow">Before you visit</span>
          <h2>A few things to know.</h2>
        </div>
        <div>
          <details>
            <summary>How do I book a session?</summary>
            <p>
              Choose an activity, date and duration in Book Now. Select an
              available slot, enter your details and review your booking before
              confirming.
            </p>
          </details>
          <details>
            <summary>Can I book a private room?</summary>
            <p>
              Yes. Choose Private PS5 Room or Private Cinema from the activities
              list, then check the available times.
            </p>
          </details>
          <details>
            <summary>When are you open?</summary>
            <p>
              ZeroOne is open 24/7 in Gulistan-e-Jauhar, Karachi. Availability
              depends on the activity and bookings for your chosen time.
            </p>
          </details>
        </div>
      </section>
      <BookingBanner />
    </div>
  );
}
