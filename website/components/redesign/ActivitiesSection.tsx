import Image from 'next/image';
import Link from 'next/link';
import type { Activity } from '@/lib/api';
import { experiences, imageRoot, bookingHref, livePrice } from './content';
import { Arrow, PillLink, SectionHeading } from './ui';

export function ActivitiesSection({ activities }: { activities: Activity[] }) {
  return <section className="zo-section zo-activities" id="experiences" aria-labelledby="zo-activities-title">
    <div className="zo-container">
      <SectionHeading label="Choose your kind of play" title="Great nights start with one more game." description="A solo escape, a friendly match or the whole squad. Find a space that feels like your kind of fun." centered />
      <h2 id="zo-activities-title" className="sr-only">Our gaming activities</h2>
      <div className="zo-activity-grid">
        {experiences.map((experience, index) => {
          const activity = activities.find(item => item.resourceType === experience.type);
          return <Link prefetch={false} key={experience.type} className="zo-activity-card" href={bookingHref(activity)} data-reveal>
            <div className="zo-activity-photo"><Image src={`${imageRoot}/${experience.image}`} alt={`${experience.name} illustration placeholder for a venue photograph`} fill sizes="(max-width: 600px) 92vw, (max-width: 1000px) 45vw, 30vw" /><span className="zo-activity-number">0{index + 1}</span></div>
            <div className="zo-activity-copy"><div><h3>{experience.name}</h3><p>{experience.description}</p><span className="zo-activity-rate">{activity ? livePrice(activity) : 'See rates at booking'}</span></div><span className="zo-circle-arrow"><Arrow /></span></div>
          </Link>;
        })}
      </div>
      <div className="zo-section-action"><PillLink href="/activities">View All Activities</PillLink></div>
    </div>
  </section>;
}
